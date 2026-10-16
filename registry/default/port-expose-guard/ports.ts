// Bollard UI — port-expose-guard · MIT licence · https://bollard-ui.vercel.app/components/port-expose-guard

import { clean, detectSource, isVariable, parseCompose, parseDocker, parseServices, resolveVar, type PortFinding, type PortMapping, type PortSource, type Span } from "./parse-ports"

export { clean, detectSource, isVariable, parsePortSpec, resolveVar, type PortFinding, type PortMapping, type PortSource, type ServiceType, type Span } from "./parse-ports"

export interface PortReport { source: PortSource | null; mappings: PortMapping[]; findings: PortFinding[] }

/** Ports that should almost never face the internet. */
export const SENSITIVE_PORTS: Record<number, string> = {
  22: "SSH", 1433: "SQL Server", 1521: "Oracle", 2375: "the Docker API (root on the host, no TLS)", 2376: "the Docker API",
  2379: "etcd", 3306: "MySQL", 5432: "PostgreSQL", 5601: "Kibana", 5672: "RabbitMQ", 5984: "CouchDB", 6379: "Redis",
  6443: "the Kubernetes API", 7474: "Neo4j", 8086: "InfluxDB", 8200: "Vault", 8500: "Consul", 9042: "Cassandra",
  9200: "Elasticsearch", 10250: "the kubelet", 11211: "Memcached", 15672: "the RabbitMQ admin", 27017: "MongoDB",
}

/** Admin UIs that are sensitive whatever port they use. */
const ADMIN_IMAGES: Record<string, string> = {
  adminer: "Adminer", phpmyadmin: "phpMyAdmin", pgadmin4: "pgAdmin", portainer: "Portainer", "mongo-express": "mongo-express",
  "redis-commander": "Redis Commander", kibana: "Kibana", minio: "MinIO",
}

/** Ports well-known images listen on by default, for catching `5432:5433`. */
export const IMAGE_PORTS: Record<string, number[]> = {
  postgres: [5432], postgis: [5432], mysql: [3306, 33060], mariadb: [3306], redis: [6379], valkey: [6379], mongo: [27017],
  nginx: [80, 443], httpd: [80, 443], elasticsearch: [9200, 9300], opensearch: [9200, 9600], memcached: [11211],
  rabbitmq: [5672, 15672, 4369, 25672], adminer: [8080], phpmyadmin: [80], grafana: [3000], prometheus: [9090],
  minio: [9000, 9001], "mongo-express": [8081], mailhog: [1025, 8025], mailpit: [1025, 8025], couchdb: [5984],
  cassandra: [9042, 7000], neo4j: [7474, 7687], influxdb: [8086], keycloak: [8080, 8443], wordpress: [80], ghost: [2368],
}

const LOCAL = new Set(["127.0.0.1", "::1", "[::1]", "localhost"])
const ANY = new Set(["", "0.0.0.0", "::", "[::]", "*"])

/** A `${VAR}` bind with no default can't be judged until run time. */
const unknownBind = (ip: string | null) => isVariable(ip) && resolveVar(ip) === null
const bindOf = (ip: string | null) => (isVariable(ip) ? resolveVar(ip) : ip)

/** True when a bind address means "every interface". `${BIND:-0.0.0.0}` counts by its default. */
export const isAllInterfaces = (ip: string | null) => ip === null || (!unknownBind(ip) && ANY.has((bindOf(ip) ?? "").trim()))
export const isLoopback = (ip: string | null) => {
  const v = bindOf(ip)?.trim()
  return v !== undefined && (LOCAL.has(v) || /^127\./.test(v))
}
/** True for IPv6 wildcard binds, so the fix keeps the port on IPv6 loopback. */
const isIpv6 = (ip: string | null) => /^\[?::\]?$/.test((bindOf(ip) ?? "").trim())

/** Loopback address that matches the original bind's family. */
export const bindAddressFor = (finding: PortFinding) => ("mapping" in finding && isIpv6(finding.mapping.hostIp) ? "::1" : "127.0.0.1")

/** `docker.io/library/postgres:16-alpine@sha…` → `postgres`. */
export const imageName = (image?: string) =>
  (image ?? "").replace(/@.*$/, "").split("/").pop()?.replace(/:.*$/, "").toLowerCase() ?? ""

/** Service or image names that give a database away even on an unusual port. */
const NAME_HINTS: [RegExp, string][] = [
  [/\b(postgres(ql)?|pg)\b/, "PostgreSQL"], [/\b(mysql|mariadb)\b/, "MySQL"], [/\bredis\b/, "Redis"], [/\bmongo(db)?\b/, "MongoDB"],
  [/\belastic(search)?\b/, "Elasticsearch"], [/\brabbitmq\b/, "RabbitMQ"], [/\betcd\b/, "etcd"], [/\b(db|database)\b/, "a database"],
]

const what = (m: PortMapping, sensitive: Record<number, string>) => {
  const image = imageName(m.image)
  const admin = Object.entries(ADMIN_IMAGES).find(([key]) => image === key || image.includes(key))
  if (admin) return admin[1]
  if (m.containerPort !== null && sensitive[m.containerPort]) return sensitive[m.containerPort]
  const host = Number(resolveVar(m.hostPort))
  if (sensitive[host]) return sensitive[host]
  const name = `${m.service ?? ""} ${image}`.toLowerCase()
  return NAME_HINTS.find(([pattern]) => pattern.test(name))?.[1] ?? null
}

export interface CheckPortsOptions {
  /** Ports each image or Service actually listens on, keyed by image name or Service name. Extends `IMAGE_PORTS`. */
  listening?: Record<string, number[]>
  /** Extra or replacement sensitive ports. */
  sensitivePorts?: Record<number, string>
}

/** Reads every published port out of the config and lists what is exposed by mistake. Never throws. */
export function checkPorts(input: string, options: CheckPortsOptions = {}): PortReport {
  const text = clean(input).slice(0, 200_000)
  const source = detectSource(text)
  const sensitive = { ...SENSITIVE_PORTS, ...options.sensitivePorts }
  const listening = { ...IMAGE_PORTS, ...options.listening }
  const findings: PortFinding[] = []
  if (!source) return { source, mappings: [], findings }
  let mappings: PortMapping[] = []
  if (source === "k8s") {
    const parsed = parseServices(text)
    mappings = parsed.mappings
    for (const svc of parsed.services) {
      const risky = svc.mappings.map((m) => ({ m, label: what(m, sensitive) })).find(({ m, label }) => label && (m.serviceType === "LoadBalancer" || m.serviceType === "NodePort") && !m.restricted)
      if (risky?.label) findings.push({ kind: "serviceType", mapping: risky.m, what: risky.label, typeSpan: svc.typeSpan, nodePortSpans: svc.nodePortSpans })
    }
  } else {
    const parsed = source === "docker" ? parseDocker(text) : parseCompose(text)
    mappings = parsed.mappings
    const hostNet = parsed.extra.filter((f): f is Extract<PortFinding, { kind: "hostNetwork" }> => f.kind === "hostNetwork")
    findings.push(...parsed.extra)
    for (const m of mappings) {
      const ignored = hostNet.some((h) => source === "docker" || h.service === m.service)
      const label = what(m, sensitive)
      if (!ignored && label && isAllInterfaces(m.hostIp)) findings.push({ kind: "exposed", mapping: m, what: label })
      if (m.unquoted && m.raw.includes(":")) {
        const parsedValue = sexagesimal(m.raw)
        if (parsedValue !== null) findings.push({ kind: "base60", mapping: m, parsed: parsedValue })
      }
    }
  }
  for (const m of mappings) {
    const expected = listening[m.service ?? ""] ?? (m.source !== "k8s" ? listening[imageName(m.image)] : undefined)
    if (expected?.length && m.containerPort !== null && m.containerSpan && !expected.includes(m.containerPort)) findings.push({ kind: "mismatch", mapping: m, expected })
  }
  return { source, mappings, findings }
}

/** YAML 1.1 reads unquoted `22:22` as the base-60 number 1342; returns that number, or null. */
export function sexagesimal(raw: string): number | null {
  if (!/^[1-9][0-9_]*(:[0-5]?[0-9])+$/.test(raw)) return null
  return raw.split(":").reduce((total, part) => total * 60 + Number(part.replace(/_/g, "")), 0)
}

const splice = (text: string, span: Span, insert: string) => text.slice(0, span.start) + insert + text.slice(span.end)

/** Puts back the BOM and CRLF line endings `clean` took out, so a fix never rewrites a whole file. */
function restore(original: string, out: string) {
  const crlf = /\r\n/.test(original) && !/(^|[^\r])\n/.test(original)
  return (original.startsWith("\uFEFF") ? "\uFEFF" : "") + (crlf ? out.replace(/\n/g, "\r\n") : out)
}

/** The one-tap rewrite for a finding, or null when there is no safe automatic fix. Keeps the input's line endings. */
export function fixPort(input: string, finding: PortFinding, bindTo?: string): string | null {
  const original = typeof input === "string" ? input : ""
  const out = rewrite(clean(original), finding, bindTo ?? bindAddressFor(finding))
  return out === null ? null : restore(original, out)
}

function rewrite(text: string, finding: PortFinding, bindTo: string): string | null {
  switch (finding.kind) {
    case "exposed": {
      const m = finding.mapping
      if (m.span) {
        // An empty host part keeps Docker's random port: `127.0.0.1::80`.
        const host = m.hostPort ?? ""
        const ip = bindTo.includes(":") ? `[${bindTo}]` : bindTo
        const proto = m.protocol !== "tcp" || /\/tcp$/i.test(m.raw) ? `/${m.raw.split("/").pop()}` : ""
        return splice(text, m.span, `${ip}:${host}:${m.containerRaw ?? m.containerPort ?? ""}${proto}`)
      }
      if (m.hostIpSpan) return splice(text, m.hostIpSpan, bindTo)
      const value = bindTo.includes(":") ? `"${bindTo}"` : bindTo
      if (m.insertHostIp?.inline) return splice(text, { start: m.insertHostIp.at, end: m.insertHostIp.at }, ` host_ip: ${value},`)
      if (m.insertHostIp) return splice(text, { start: m.insertHostIp.at, end: m.insertHostIp.at }, `\n${m.insertHostIp.indent}host_ip: ${value}`)
      return null
    }
    case "base60":
      return finding.mapping.span ? splice(text, finding.mapping.span, `"${finding.mapping.raw}"`) : null
    case "mismatch":
      return finding.mapping.containerSpan ? splice(text, finding.mapping.containerSpan, String(finding.expected[0])) : null
    case "serviceType": {
      if (!finding.typeSpan) return null
      // Drop nodePort lines (invalid on ClusterIP) from the bottom up so earlier offsets stay valid.
      const spans = [...finding.nodePortSpans, finding.typeSpan].sort((a, b) => b.start - a.start)
      return spans.reduce((out, span) => (span === finding.typeSpan ? splice(out, span, "ClusterIP") : splice(out, span, "")), text)
    }
    default:
      return null
  }
}

/** Who can reach a mapping, as a short machine-readable reach. */
export function reachOf(m: PortMapping, hostNetwork = false): "anyone" | "local" | "address" | "variable" | "cluster" | "nodes" | "internet" | "internal" | "ranges" | "host" {
  if (hostNetwork) return "host"
  if (m.source === "k8s") {
    if (m.serviceType === "LoadBalancer") return m.restricted === "internal" ? "internal" : m.restricted === "sourceRanges" ? "ranges" : "internet"
    if (m.serviceType === "NodePort") return "nodes"
    return "cluster"
  }
  if (unknownBind(m.hostIp)) return "variable"
  if (isAllInterfaces(m.hostIp)) return "anyone"
  return isLoopback(m.hostIp) ? "local" : "address"
}
