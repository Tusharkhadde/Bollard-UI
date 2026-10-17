// Bollard UI — port-expose-guard · MIT licence · https://bollard-ui.vercel.app/components/port-expose-guard

/** Where a mapping came from. */
export type PortSource = "docker" | "compose" | "k8s"
export type ServiceType = "ClusterIP" | "NodePort" | "LoadBalancer" | "ExternalName"

/** A text span in the pasted config, for one-tap rewrites. */
export interface Span { start: number; end: number }

/** One published port, read out of a docker run command, a compose file or a Kubernetes Service. */
export interface PortMapping {
  source: PortSource
  /** Compose service or Kubernetes Service name. */
  service?: string
  image?: string
  /** Bind address as written; `null` means every interface (Docker's default). May be a `${VAR}`. */
  hostIp: string | null
  /** Host port or range; `null` means Docker picks a random one. For Services this is `port`. May be a `${VAR}`. */
  hostPort: string | null
  /** Port the container listens on (`targetPort` for Services); `null` when named, a range or an unset variable. */
  containerPort: number | null
  /** The container part as written, e.g. `5432` or `${PG_PORT:-5432}`. */
  containerRaw?: string
  protocol: string
  /** The spec as written, e.g. `5432:5432` or `port: 6379`. */
  raw: string
  /** Where the short spec sits, without quotes. */
  span?: Span
  /** Where a literal container port number sits (absent for variables). */
  containerSpan?: Span
  /** Compose short syntax written without quotes. */
  unquoted?: boolean
  /** Compose long syntax: the existing `host_ip:` value, or where to insert one (`inline` inside `{ … }`). */
  hostIpSpan?: Span
  insertHostIp?: { at: number; indent: string; inline?: boolean }
  serviceType?: ServiceType
  nodePort?: number
  /** Service has an internal-only load balancer annotation or source ranges. */
  restricted?: "internal" | "sourceRanges"
}

export type PortFinding =
  | { kind: "exposed"; mapping: PortMapping; what: string }
  | { kind: "serviceType"; mapping: PortMapping; what: string; typeSpan?: Span; nodePortSpans: Span[] }
  | { kind: "mismatch"; mapping: PortMapping; expected: number[] }
  | { kind: "base60"; mapping: PortMapping; parsed: number }
  | { kind: "hostNetwork"; service?: string; span: Span }
  | { kind: "publishAll"; span: Span }

/** Drops a BOM and turns CRLF into LF so offsets are stable. `fixPort` puts both back. */
export const clean = (text: string) => (typeof text === "string" ? text : "").replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n")
const unquote = (s: string) => s.replace(/^\s*["']|["']\s*$/g, "")
const VAR = /\$\{[^}]*\}|\$[A-Za-z_]\w*/g

/** `${PG_PORT:-5432}` → `5432`; `${PG_PORT}` → `null` (unknown until run time); a literal stays as is. */
export function resolveVar(value: string | null): string | null {
  if (value === null) return null
  const v = value.trim()
  const withDefault = v.match(/^\$\{\w+:?-([^}]*)\}$/)
  if (withDefault) return withDefault[1]
  return /^\$(\{[^}]*\}|[A-Za-z_]\w*)$/.test(v) ? null : v
}
export const isVariable = (value: string | null) => value !== null && /\$(\{|[A-Za-z_])/.test(value)

const portLike = (s: string) => /^\d+(-\d+)?$/.test(s) || /^(\$\{[^}]*\}|\$[A-Za-z_]\w*)$/.test(s)

/** Splits `[ip:][host:]container[/proto]`, the format docker run and compose short syntax share. Understands `${VAR}` parts and `[::]` binds. */
export function parsePortSpec(spec: string): (Pick<PortMapping, "hostIp" | "hostPort" | "containerPort" | "containerRaw" | "protocol"> & { containerOffset: number }) | null {
  // Mask variables first: `${PORT:-5432}` contains a colon that is not a separator.
  const vars: string[] = []
  const masked = spec.replace(VAR, (v) => `\u0000${vars.push(v) - 1}\u0001`)
  const unmask = (s: string) => s.replace(/\u0000(\d+)\u0001/g, (_, i: string) => vars[Number(i)])
  const slash = masked.lastIndexOf("/")
  const body = slash >= 0 ? masked.slice(0, slash) : masked
  const proto = slash >= 0 ? masked.slice(slash + 1) : "tcp"
  let ip: string | null = null
  let rest = body
  if (body.startsWith("[")) {
    const close = body.indexOf("]")
    if (close < 0 || body[close + 1] !== ":") return null
    ip = body.slice(0, close + 1)
    rest = body.slice(close + 2)
  }
  const parts = rest.split(":")
  if (!ip && parts.length > 3) ip = parts.splice(0, parts.length - 2).join(":")
  else if (!ip && parts.length === 3) ip = parts.shift() ?? null
  const container = unmask(parts.pop() ?? "")
  const host = parts.length ? unmask(parts.pop() ?? "") : null
  if (!portLike(container) || (host !== null && host !== "" && !portLike(host))) return null
  const resolved = resolveVar(container)
  const containerPort = resolved !== null && /^\d+$/.test(resolved) ? Number(resolved) : null
  return {
    hostIp: ip === null ? null : unmask(ip),
    hostPort: host || null,
    containerPort,
    containerRaw: container,
    protocol: unmask(proto).toLowerCase() || "tcp",
    containerOffset: unmask(body).length - container.length,
  }
}

interface Token { text: string; start: number; end: number }

/** Shell-style split that keeps offsets and understands quotes. */
function tokenize(line: string, offset: number): Token[] {
  const tokens: Token[] = []
  let i = 0
  while (i < line.length) {
    while (i < line.length && /\s/.test(line[i])) i++
    if (i >= line.length) break
    const start = i
    let text = ""
    while (i < line.length && !/\s/.test(line[i])) {
      const q = line[i]
      if (q === '"' || q === "'") {
        const close = line.indexOf(q, i + 1)
        const end = close < 0 ? line.length : close
        text += line.slice(i + 1, end)
        i = end + 1
      } else {
        text += q
        i++
      }
    }
    tokens.push({ text, start: offset + start, end: offset + i })
  }
  return tokens
}

const VALUE_FLAGS = new Set(["-e", "--env", "-v", "--volume", "--name", "-w", "--workdir", "-u", "--user", "--env-file", "--mount", "-l", "--label", "--restart", "--entrypoint", "-h", "--hostname", "--add-host", "--cpus", "-m", "--memory", "--platform", "--pull", "--log-driver", "--log-opt", "--dns", "--device", "--tmpfs", "--ulimit", "--cap-add", "--cap-drop", "--security-opt", "--health-cmd", "--ip", "--expose", "--link", "--volumes-from", "--gpus", "--shm-size", "--stop-signal", "--network-alias", "--runtime", "--cidfile"])
const SHORT_VALUE = new Set(["p", "e", "v", "w", "u", "h", "m", "l"])

const withSpans = (source: PortSource, parsed: NonNullable<ReturnType<typeof parsePortSpec>>, spec: string, start: number): PortMapping => {
  const { containerOffset, ...rest } = parsed
  const literal = rest.containerRaw !== undefined && /^\d+$/.test(rest.containerRaw)
  return {
    source, ...rest, raw: spec, span: { start, end: start + spec.length },
    containerSpan: literal ? { start: start + containerOffset, end: start + containerOffset + (rest.containerRaw ?? "").length } : undefined,
  }
}

export function parseDocker(text: string): { mappings: PortMapping[]; extra: PortFinding[] } {
  const mappings: PortMapping[] = []
  const extra: PortFinding[] = []
  // Join `\` continuations into one logical command, keeping offsets.
  const commands: { body: string; offset: number }[] = []
  let offset = 0
  let current: { body: string; offset: number } | null = null
  for (const line of text.split("\n")) {
    // Same length as the line, so token offsets still point into the original text.
    const piece = line.replace(/\\\s*$/, (tail) => " ".repeat(tail.length))
    if (current) current.body += " " + piece
    else current = { body: piece, offset }
    if (!/\\\s*$/.test(line)) { commands.push(current); current = null }
    offset += line.length + 1
  }
  if (current) commands.push(current)
  for (const { body, offset: base } of commands) {
    const tokens = tokenize(body, base)
    const runAt = tokens.findIndex((t, i) => t.text === "run" && i > 0 && /(^|\/)(docker|podman)$/.test(tokens[i - 1].text))
    const from = runAt >= 0 ? runAt + 1 : tokens[0]?.text.startsWith("-") ? 0 : -1
    if (from < 0) continue
    let image: string | undefined
    const found: PortMapping[] = []
    for (let i = from; i < tokens.length && !image; i++) {
      const tok = tokens[i]
      const t = tok.text
      let spec: Token | null = null
      if (t === "-p" || t === "--publish") { spec = tokens[++i] ?? null }
      else if (t.startsWith("--publish=")) spec = { text: t.slice(10), start: tok.end - (t.length - 10), end: tok.end }
      else if (t === "-P" || t === "--publish-all") extra.push({ kind: "publishAll", span: { start: tok.start, end: tok.end } })
      else if (/^--(network|net)(=host)?$/.test(t)) {
        const value = t.includes("=") ? "host" : tokens[++i]?.text
        if (value === "host") extra.push({ kind: "hostNetwork", span: { start: tok.start, end: (t.includes("=") ? tok : tokens[i]).end } })
      } else if (/^--(network|net)=/.test(t)) continue
      else if (/^-[a-zA-Z]+$/.test(t)) {
        const letters = t.slice(1)
        const last = letters[letters.length - 1]
        if (letters.length > 1 && last === "p") spec = tokens[++i] ?? null
        else if (SHORT_VALUE.has(last)) i++
      } else if (/^-p\d/.test(t)) spec = { text: t.slice(2), start: tok.start + 2, end: tok.end }
      else if (t.startsWith("--") && !t.includes("=") && VALUE_FLAGS.has(t)) i++
      else if (!t.startsWith("-")) image = t
      if (spec) {
        const parsed = parsePortSpec(spec.text)
        if (!parsed) continue
        const quoteShift = text[spec.start] === '"' || text[spec.start] === "'" ? 1 : 0
        found.push(withSpans("docker", parsed, spec.text, spec.start + quoteShift))
      }
    }
    for (const m of found) mappings.push({ ...m, image })
  }
  return { mappings, extra }
}

const indentOf = (line: string) => line.length - line.trimStart().length

function applyLongKey(m: PortMapping, key: string, raw: string, at: number) {
  const value = unquote(raw)
  const valueAt = at + (raw.length - raw.trimStart().length) + (/^["']/.test(raw.trim()) ? 1 : 0)
  if (key === "target") {
    const resolved = resolveVar(value)
    m.containerPort = resolved !== null && /^\d+$/.test(resolved) ? Number(resolved) : null
    m.containerRaw = value
    m.containerSpan = /^\d+$/.test(value) ? { start: valueAt, end: valueAt + value.length } : undefined
    m.raw = m.raw || `target: ${value}`
  }
  if (key === "published") m.hostPort = value || null
  if (key === "protocol") m.protocol = value.toLowerCase()
  if (key === "host_ip") { m.hostIp = value; m.hostIpSpan = { start: valueAt, end: valueAt + value.length } }
  if (!m.insertHostIp?.inline && ["target", "published", "host_ip", "protocol", "mode", "name", "app_protocol"].includes(key)) {
    if (m.insertHostIp && at > m.insertHostIp.at) m.insertHostIp = { ...m.insertHostIp, at: at + raw.length }
  }
}

/** `- { target: 5432, published: 5432 }`, the flow-mapping spelling of the long syntax. */
function flowMapping(body: string, bodyAt: number, service?: string): PortMapping {
  const m: PortMapping = { source: "compose", service, hostIp: null, hostPort: null, containerPort: null, protocol: "tcp", raw: `{${body}}`, insertHostIp: { at: bodyAt, indent: "", inline: true } }
  for (const pair of body.matchAll(/([\w]+)\s*:\s*("[^"]*"|'[^']*'|[^,]*)/g)) {
    applyLongKey(m, pair[1], pair[2].trimEnd(), bodyAt + (pair.index ?? 0) + pair[0].indexOf(pair[2]))
  }
  return m
}

export function parseCompose(text: string): { mappings: PortMapping[]; extra: PortFinding[] } {
  const lines = text.split("\n")
  const starts: number[] = []
  lines.reduce((at, line) => (starts.push(at), at + line.length + 1), 0)
  const mappings: PortMapping[] = []
  const extra: PortFinding[] = []
  let serviceIndent = -1
  let service: string | undefined
  let images: Record<string, string> = {}
  let portsIndent = -1
  let long: PortMapping | null = null
  let longIndent = -1
  const flush = () => { if (long) { mappings.push(long); long = null } }
  for (let n = 0; n < lines.length; n++) {
    const line = lines[n]
    if (!line.trim() || line.trimStart().startsWith("#")) continue
    const indent = indentOf(line)
    const at = starts[n]
    if (long && indent <= longIndent) flush()
    if (portsIndent >= 0 && indent <= portsIndent && !line.trimStart().startsWith("-")) portsIndent = -1
    if (portsIndent >= 0 && indent < portsIndent) portsIndent = -1
    if (indent === 0) {
      flush()
      serviceIndent = line.trim() === "services:" ? -2 : -1
      service = undefined
      portsIndent = -1
      if (serviceIndent === -2) continue
    }
    if (serviceIndent === -2 && indent > 0) serviceIndent = indent
    if (serviceIndent > 0 && indent === serviceIndent && /^[\w.-]+:\s*$/.test(line.trim())) { flush(); service = line.trim().slice(0, -1); portsIndent = -1; continue }
    const image = line.match(/^\s*image:\s*["']?([^"'\s#]+)/)
    if (image && service) images = { ...images, [service]: image[1] }
    const net = line.match(/^(\s*)network_mode:\s*["']?host["']?\s*$/)
    if (net) extra.push({ kind: "hostNetwork", service, span: { start: at + net[1].length, end: at + line.length } })
    const ports = line.match(/^(\s*)ports:\s*(\[(.*)\])?\s*(#.*)?$/)
    if (ports) {
      if (ports[2]) {
        // Flow style: ports: ["5432:5432", 8080:80]
        const body = ports[3]
        const bodyAt = at + line.indexOf("[") + 1
        for (const item of body.matchAll(/\s*(["']?)([^,"']+)\1\s*(,|$)/g)) {
          const spec = item[2].trim()
          const parsed = parsePortSpec(spec)
          if (!parsed) continue
          const start = bodyAt + (item.index ?? 0) + item[0].indexOf(spec)
          mappings.push({ ...withSpans("compose", parsed, spec, start), unquoted: !item[1], service })
        }
      } else portsIndent = indent
      continue
    }
    if (portsIndent < 0) continue
    const item = line.match(/^(\s*)-\s*(.*?)\s*(#.*)?$/)
    if (item && indent >= portsIndent) {
      flush()
      const value = item[2]
      const flow = value.match(/^\{(.*)\}$/)
      if (flow) {
        mappings.push(flowMapping(flow[1], at + line.indexOf("{") + 1, service))
        continue
      }
      const keyed = value.match(/^(\w+):\s*(.*)$/)
      if (keyed && !/^\d/.test(value)) {
        long = { source: "compose", service, hostIp: null, hostPort: null, containerPort: null, protocol: "tcp", raw: "", insertHostIp: { at: at + line.length, indent: " ".repeat(item[1].length + 2) } }
        longIndent = indent
        applyLongKey(long, keyed[1], keyed[2], at + line.indexOf(keyed[2], line.indexOf(":") + 1))
        continue
      }
      const quoted = /^["']/.test(value)
      const spec = unquote(value)
      const parsed = parsePortSpec(spec)
      if (!parsed) continue
      mappings.push({ ...withSpans("compose", parsed, spec, at + line.indexOf(spec, item[1].length + 1)), unquoted: !quoted, service })
      continue
    }
    const keyed = line.match(/^\s*(\w+):\s*(.*?)\s*(#.*)?$/)
    if (long && keyed) applyLongKey(long, keyed[1], keyed[2], at + line.indexOf(keyed[2], line.indexOf(":") + 1))
  }
  flush()
  return { mappings: mappings.map((m) => ({ ...m, image: m.service ? images[m.service] : undefined })), extra }
}

const INTERNAL_LB = /(load-balancer-type:\s*["']?internal|aws-load-balancer-internal|aws-load-balancer-scheme:\s*["']?internal|azure-load-balancer-internal:\s*["']?true|load-balancer-internal)/i

export interface ParsedService { mappings: PortMapping[]; typeSpan?: Span; nodePortSpans: Span[] }

export function parseServices(text: string): { mappings: PortMapping[]; services: ParsedService[] } {
  const all: PortMapping[] = []
  const services: ParsedService[] = []
  let offset = 0
  for (const doc of text.split(/^---.*$/m)) {
    const base = text.indexOf(doc, offset)
    offset = base + doc.length
    if (!/^kind:\s*Service\s*$/m.test(doc)) continue
    const name = doc.match(/^metadata:\s*\n(?:\s+.*\n)*?\s+name:\s*["']?([\w.-]+)/m)?.[1]
    const typeMatch = doc.match(/^(\s+)type:\s*["']?(\w+)["']?\s*$/m)
    const serviceType = (typeMatch?.[2] as ServiceType) ?? "ClusterIP"
    const typeAt = typeMatch ? base + (typeMatch.index ?? 0) + typeMatch[0].indexOf(typeMatch[2]) : 0
    const typeSpan = typeMatch ? { start: typeAt, end: typeAt + typeMatch[2].length } : undefined
    const restricted = INTERNAL_LB.test(doc) ? "internal" : /^\s+loadBalancerSourceRanges:/m.test(doc) ? "sourceRanges" : undefined
    const nodePortSpans: Span[] = []
    const mappings: PortMapping[] = []
    let current: PortMapping | null = null
    let at = base
    for (const line of doc.split("\n")) {
      const item = line.match(/^(\s*)(-\s*)?(port|targetPort|nodePort|protocol|name):\s*["']?([\w.-]+)["']?\s*$/)
      if (item) {
        if (item[2] || !current) {
          if (current) mappings.push(current)
          current = { source: "k8s", service: name, hostIp: null, hostPort: null, containerPort: null, protocol: "tcp", raw: "", serviceType, restricted }
        }
        const valueAt = at + line.lastIndexOf(item[4])
        if (item[3] === "port") { current.hostPort = item[4]; current.raw = `port: ${item[4]}`; if (current.containerPort === null) current.containerPort = Number(item[4]) || null }
        if (item[3] === "targetPort") { current.containerPort = /^\d+$/.test(item[4]) ? Number(item[4]) : null; current.containerSpan = current.containerPort === null ? undefined : { start: valueAt, end: valueAt + item[4].length } }
        if (item[3] === "nodePort") {
          current.nodePort = Number(item[4]) || undefined
          // The whole line, so switching to ClusterIP can drop it (nodePort is invalid there).
          nodePortSpans.push({ start: at, end: at + line.length + 1 })
        }
        if (item[3] === "protocol") current.protocol = item[4].toLowerCase()
      }
      at += line.length + 1
    }
    if (current) mappings.push(current)
    const real = mappings.filter((m) => m.hostPort !== null)
    all.push(...real)
    services.push({ mappings: real, typeSpan, nodePortSpans })
  }
  return { mappings: all, services }
}

/** Guesses the format: a Kubernetes Service, a compose file, or docker run commands. */
export function detectSource(input: string): PortSource | null {
  const text = clean(input)
  if (/^kind:\s*Service\s*$/m.test(text)) return "k8s"
  if (/^\s*(services|ports):/m.test(text) || /^\s*-\s*["']?(\d+|\$\{)/m.test(text)) return "compose"
  if (/\b(docker|podman)\b[\s\\]+run\b/.test(text) || /(^|\s)(-p|--publish)[\s=]/.test(text)) return "docker"
  return null
}
