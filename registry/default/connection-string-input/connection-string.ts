// Bollard UI — connection-string-input · MIT licence · https://bollard-ui.vercel.app/components/connection-string-input

/**
 * Database connection URLs, split the way drivers split them and checked for
 * the mistakes that break or weaken a connection. Sources: libpq connection
 * URIs and sslmode (https://www.postgresql.org/docs/current/libpq-connect.html),
 * the MongoDB connection-string and SRV specs
 * (https://github.com/mongodb/specifications/tree/master/source),
 * RFC 3986 percent-encoding, and the WHATWG URL parser most JS drivers use.
 */

export type DbEnvironment = "production" | "staging" | "development"
export type DbFamily = "postgres" | "mysql" | "mongodb" | "redis"

export interface ParsedConnection {
  /** The text after cleaning (quotes, KEY= prefix, BOM, line breaks removed). */
  clean: string
  scheme: string
  family?: DbFamily
  user: string
  /** Password exactly as written in the URL (still percent-encoded). */
  rawPassword: string
  hasPassword: boolean
  hosts: { host: string; port: string }[]
  database: string
  params: [string, string][]
  /** Index range of the raw password in `clean`, for masking. */
  passwordRange?: [number, number]
  /** Index in `clean` where the path, query or fragment after the host starts. */
  tailStart: number
}

export type ConnectionIssueKind =
  | "pasted-wrapper"
  | "not-a-url"
  | "jdbc"
  | "scheme-typo"
  | "unknown-scheme"
  | "password-at"
  | "password-ends-early"
  | "password-hash"
  | "password-colon"
  | "password-space"
  | "bad-percent"
  | "localhost-prod"
  | "no-host"
  | "bad-port"
  | "wrong-port"
  | "srv-port"
  | "srv-hosts"
  | "rootcert-system-mode"
  | "mongo-password-colon"
  | "no-database"
  | "no-sslmode"
  | "weak-sslmode"
  | "bad-sslmode"
  | "unknown-param"
  | "redis-plain"
  | "mongo-no-tls"
export interface ConnectionFix {
  /** Message key for the button label. */
  label: string
  /** Values filled into the label. */
  detail?: Record<string, string>
  /** The whole connection string after the fix. */
  next: string
}
export interface ConnectionIssue {
  kind: ConnectionIssueKind
  severity: "error" | "warning" | "info"
  detail: Record<string, string>
  fixes: ConnectionFix[]
}

const SCHEMES: Record<string, DbFamily> = { postgres: "postgres", postgresql: "postgres", mysql: "mysql", mariadb: "mysql", mongodb: "mongodb", "mongodb+srv": "mongodb", redis: "redis", rediss: "redis" }
const DEFAULT_PORT: Record<DbFamily, string> = { postgres: "5432", mysql: "3306", mongodb: "27017", redis: "6379" }
const PORT_OWNER: Record<string, string> = { "5432": "PostgreSQL", "3306": "MySQL", "27017": "MongoDB", "6379": "Redis", "1433": "SQL Server" }
const LOCAL_HOSTS = /^(localhost|127(?:\.\d{1,3}){3}|\[?::1\]?|0\.0\.0\.0|host\.docker\.internal)$/i
const SSLMODES = ["disable", "allow", "prefer", "require", "verify-ca", "verify-full"]
// libpq rejects any URI parameter that isn't one of its key words (case-sensitive). Only ssl=true is translated (to
// sslmode=require) for JDBC compatibility; ssl=false or ssl=1 fail with "invalid URI query parameter".
const LIBPQ_KEYWORDS = ["host", "hostaddr", "port", "dbname", "user", "password", "passfile", "require_auth", "channel_binding", "connect_timeout", "client_encoding", "options", "application_name", "fallback_application_name", "keepalives", "keepalives_idle", "keepalives_interval", "keepalives_count", "tcp_user_timeout", "replication", "gssencmode", "sslmode", "requiressl", "sslnegotiation", "sslcompression", "sslcert", "sslkey", "sslkeylogfile", "sslpassword", "sslcertmode", "sslrootcert", "sslcrl", "sslcrldir", "sslsni", "requirepeer", "ssl_min_protocol_version", "ssl_max_protocol_version", "min_protocol_version", "max_protocol_version", "krbsrvname", "gsslib", "gssdelegation", "service", "target_session_attrs", "load_balance_hosts"]
// Parameters common drivers (node-postgres, Prisma, psycopg pools) accept on top of libpq's own.
const DRIVER_EXTRAS = ["schema", "connection_limit", "pool_timeout", "pgbouncer", "statement_cache_size", "socket_timeout", "connect_timeout", "sslaccept", "uselibpqcompat"]

/** Damerau-Levenshtein distance, capped for speed. */
export function editDistance(a: string, b: string): number {
  if (Math.abs(a.length - b.length) > 2) return 3
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)])
  for (let j = 1; j <= b.length; j++) d[0][j] = j
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost)
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1)
    }
  return d[a.length][b.length]
}
const nearest = (word: string, list: string[], max = 2) => {
  let best: string | undefined
  let score = max + 1
  for (const candidate of list) {
    const distance = editDistance(word.toLowerCase(), candidate)
    if (distance < score) [best, score] = [candidate, distance]
  }
  return score <= max ? best : undefined
}

/** Removes what a copy from a .env file or a shell brings along: KEY=, quotes, BOM, CR/LF and spaces. */
export function cleanConnectionString(raw: string): string {
  return String(raw ?? "")
    .replace(/^\uFEFF/, "")
    .replace(/[\r\n]+/g, "")
    .trim()
    .replace(/^(?:export\s+)?[A-Z][A-Z0-9_]*\s*=\s*/, "")
    .replace(/^(["'`])(.*)\1;?$/, "$2")
    .trim()
}

/** Percent-encodes what a password needs encoded, leaving existing %XX escapes alone. */
export function encodePassword(raw: string): string {
  return raw.replace(/%(?![0-9A-Fa-f]{2})|[^A-Za-z0-9\-._~!$&'()*+,;=%]/g, (char) => encodeURIComponent(char))
}

/** Decodes a percent-encoded part, or returns null when it would throw (a stray %). */
export function safeDecode(part: string): string | null {
  try {
    return decodeURIComponent(part)
  } catch {
    return null
  }
}

/**
 * Splits a connection URL the forgiving way, taking the host after the last
 * `@`, so a password with an unencoded @, / or # still comes out whole and
 * can be re-encoded in one tap.
 */
export function parseConnectionString(raw: string): ParsedConnection | null {
  const clean = cleanConnectionString(raw)
  const scheme = /^([a-z][a-z0-9+.-]*):\/\//i.exec(clean)
  if (!scheme) return null
  const start = scheme[0].length
  const rest = clean.slice(start)
  let at = rest.lastIndexOf("@")
  // An @ inside the query string (?application_name=a@b) isn't the credentials separator: step back to the one before it.
  while (at > 0) {
    const previous = rest.lastIndexOf("@", at - 1)
    if (previous < 0 || !/\?[^@]*=/.test(rest.slice(previous + 1, at))) break
    at = previous
  }
  const userinfo = at >= 0 ? rest.slice(0, at) : ""
  const afterAt = at >= 0 ? rest.slice(at + 1) : rest
  const hostEnd = afterAt.search(/[/?#]/)
  const hostPart = hostEnd < 0 ? afterAt : afterAt.slice(0, hostEnd)
  const tail = hostEnd < 0 ? "" : afterAt.slice(hostEnd)
  const colon = userinfo.indexOf(":")
  const user = colon >= 0 ? userinfo.slice(0, colon) : userinfo
  const rawPassword = colon >= 0 ? userinfo.slice(colon + 1) : ""
  const pathMatch = /^\/([^?#]*)/.exec(tail)
  const query = /\?([^#]*)/.exec(tail)?.[1] ?? ""
  const hosts = hostPart
    ? hostPart.split(",").map((entry) => {
        const ipv6 = /^(\[[^\]]*\])(?::(.*))?$/.exec(entry)
        if (ipv6) return { host: ipv6[1], port: ipv6[2] ?? "" }
        const index = entry.lastIndexOf(":")
        return index >= 0 ? { host: entry.slice(0, index), port: entry.slice(index + 1) } : { host: entry, port: "" }
      })
    : []
  const params = query
    ? query.split("&").filter(Boolean).map((pair): [string, string] => {
        const index = pair.indexOf("=")
        return index >= 0 ? [pair.slice(0, index), pair.slice(index + 1)] : [pair, ""]
      })
    : []
  const passwordStart = start + colon + 1
  return {
    clean,
    scheme: scheme[1].toLowerCase(),
    family: SCHEMES[scheme[1].toLowerCase()],
    user,
    rawPassword,
    hasPassword: colon >= 0,
    hosts,
    database: pathMatch?.[1] ?? "",
    params,
    passwordRange: colon >= 0 ? [passwordStart, passwordStart + rawPassword.length] : undefined,
    tailStart: start + (at >= 0 ? at + 1 : 0) + hostPart.length,
  }
}

/** The connection string with the password replaced by a fixed-length mask, safe for logs and tickets. */
export function maskConnectionString(raw: string, mask = "••••••••"): string {
  const parsed = parseConnectionString(raw)
  const text = String(raw ?? "")
  if (!parsed?.passwordRange || !parsed.rawPassword) return text
  // Mask inside the text as typed, so quotes or a KEY= prefix stay visible until they're fixed.
  const offset = Math.max(0, text.indexOf(parsed.clean))
  const [from, to] = parsed.passwordRange
  return text.slice(0, offset + from) + mask + text.slice(offset + to)
}

/** What a strict parser that stops at the first @ or / (libpq, psql) would take as the host. */
export function strictHost(clean: string): string {
  const rest = clean.replace(/^[a-z][a-z0-9+.-]*:\/\//i, "")
  const stop = rest.search(/[@/]/)
  const afterUser = stop >= 0 && rest[stop] === "@" ? rest.slice(stop + 1) : rest
  // libpq ends the host at : / ? or , (fe-connect.c); # is not special to it. An IPv6 host runs to its ].
  if (afterUser.startsWith("[")) return afterUser.slice(0, afterUser.indexOf("]") + 1 || undefined)
  return afterUser.split(/[:/?,]/)[0]
}

function withPassword(parsed: ParsedConnection, password: string) {
  const [from, to] = parsed.passwordRange ?? [0, 0]
  return parsed.clean.slice(0, from) + password + parsed.clean.slice(to)
}
function setParam(parsed: ParsedConnection, key: string, value: string) {
  const head = parsed.clean.slice(0, parsed.tailStart)
  const [tail, hash] = parsed.clean.slice(parsed.tailStart).split(/#(.*)/s)
  // MongoDB wants the slash before the options (mongodb://host/?tls=true).
  const base = parsed.family === "mongodb" && !tail.startsWith("/") ? `/${tail}` : tail
  const pattern = new RegExp(`([?&])${key}=[^&]*`)
  const next = pattern.test(base) ? base.replace(pattern, `$1${key}=${value}`) : `${base}${base.includes("?") ? "&" : "?"}${key}=${value}`
  return head + next + (hash !== undefined ? `#${hash}` : "")
}

/** Checks a connection URL for the environment it's being saved to and returns every problem, most serious first. */
export function checkConnectionString(raw: string, environment: DbEnvironment = "production"): ConnectionIssue[] {
  const text = String(raw ?? "")
  if (!text.trim()) return []
  const issues: ConnectionIssue[] = []
  const clean = cleanConnectionString(text)
  if (clean !== text.trim()) issues.push({ kind: "pasted-wrapper", severity: "warning", detail: {}, fixes: [{ label: "fix-pasted-wrapper", next: clean }] })
  if (/^jdbc:/i.test(clean)) {
    issues.push({ kind: "jdbc", severity: "warning", detail: {}, fixes: [{ label: "fix-jdbc", next: clean.replace(/^jdbc:/i, "") }] })
    return issues
  }
  const parsed = parseConnectionString(clean)
  if (!parsed) {
    issues.push({ kind: "not-a-url", severity: "error", detail: {}, fixes: [] })
    return issues
  }
  if (!parsed.family) {
    const guess = nearest(parsed.scheme, Object.keys(SCHEMES))
    issues.push(guess ? { kind: "scheme-typo", severity: "error", detail: { scheme: parsed.scheme, guess }, fixes: [{ label: "fix-use", detail: { value: `${guess}://` }, next: clean.replace(/^[^:]+/, guess) }] } : { kind: "unknown-scheme", severity: "info", detail: { scheme: parsed.scheme }, fixes: [] })
  }
  const family = parsed.family
  const prod = environment === "production"
  const param = (key: string) => parsed.params.find(([name]) => name.toLowerCase() === key)?.[1]

  if (parsed.hasPassword) {
    const password = parsed.rawPassword
    const encoded = encodePassword(password)
    const fix = [{ label: "fix-encode", next: withPassword(parsed, encoded) }]
    const strict = strictHost(clean)
    // One line per password, naming its worst character and listing every character that needs encoding.
    const chars = [...new Set(password.replace(/%[0-9A-Fa-f]{2}/g, "").match(/[^A-Za-z0-9\-._~!$&'()*+,;=]/g) ?? [])].map((char) => (char === " " ? "space" : char)).join(" ")
    const detail = { host: strict, chars }
    const worst: [ConnectionIssueKind, boolean][] = [["password-at", password.includes("@")], ["password-hash", password.includes("#")], ["password-ends-early", /[/?]/.test(password)], ["bad-percent", /%(?![0-9A-Fa-f]{2})/.test(password)], ["password-colon", password.includes(":")], ["password-space", /\s/.test(password)]]
    const found = worst.find(([, hit]) => hit)
    // The MongoDB connection-string spec makes drivers throw on a second unencoded colon in the userinfo.
    if (found?.[0] === "password-colon" && family === "mongodb") issues.push({ kind: "mongo-password-colon", severity: "error", detail, fixes: fix })
    else if (found) issues.push({ kind: found[0], severity: ["password-colon", "password-space"].includes(found[0]) ? "warning" : "error", detail, fixes: fix })
  }

  const hosts = parsed.hosts.filter((entry) => entry.host)
  if (!hosts.length && !parsed.params.some(([key]) => key === "host")) issues.push({ kind: "no-host", severity: "warning", detail: {}, fixes: [] })
  for (const { host, port } of parsed.hosts) {
    if (prod && LOCAL_HOSTS.test(host)) issues.push({ kind: "localhost-prod", severity: "error", detail: { host }, fixes: [] })
    if (port && !/^\d{1,5}$/.test(port)) issues.push({ kind: "bad-port", severity: "error", detail: { port }, fixes: [] })
    else if (port && parsed.scheme === "mongodb+srv") issues.push({ kind: "srv-port", severity: "error", detail: { port }, fixes: [{ label: "fix-drop-port", next: clean.replace(`${host}:${port}`, host) }] })
    else if (port && family && PORT_OWNER[port] && port !== DEFAULT_PORT[family] && !(family === "postgres" && port === "6543")) {
      issues.push({ kind: "wrong-port", severity: "warning", detail: { port, owner: PORT_OWNER[port] }, fixes: [{ label: "fix-use", detail: { value: `:${DEFAULT_PORT[family]}` }, next: clean.replace(`${host}:${port}`, `${host}:${DEFAULT_PORT[family]}`) }] })
    }
  }
  if (family === "postgres" && !parsed.database && !parsed.params.some(([key]) => key === "dbname")) issues.push({ kind: "no-database", severity: "info", detail: { user: safeDecode(parsed.user) ?? parsed.user }, fixes: [] })

  const remote = hosts.length > 0 && hosts.every(({ host }) => !LOCAL_HOSTS.test(host))
  if (parsed.scheme === "mongodb+srv" && hosts.length > 1) issues.push({ kind: "srv-hosts", severity: "error", detail: { count: String(hosts.length) }, fixes: [] })
  if (family === "postgres") {
    for (const [key] of parsed.params) {
      if (LIBPQ_KEYWORDS.includes(key) || DRIVER_EXTRAS.includes(key) || (key === "ssl" && param("ssl") === "true")) continue
      const guess = key === "ssl" ? undefined : nearest(key, LIBPQ_KEYWORDS)
      issues.push({ kind: "unknown-param", severity: "warning", detail: { key, guess: guess ?? "" }, fixes: guess ? [{ label: "fix-use", detail: { value: guess }, next: clean.replace(new RegExp(`([?&])${key}=`), `$1${guess}=`) }] : [] })
    }
    const mode = param("sslmode")
    const systemRoots = param("sslrootcert") === "system"
    if (mode !== undefined && !SSLMODES.includes(mode)) {
      const guess = nearest(mode.replace(/_/g, "-"), SSLMODES, 3) ?? "require"
      issues.push({ kind: "bad-sslmode", severity: "error", detail: { mode, guess }, fixes: [{ label: "fix-use", detail: { value: `sslmode=${guess}` }, next: setParam(parsed, "sslmode", guess) }] })
    } else if (systemRoots && mode !== undefined && mode !== "verify-full") {
      // libpq: "When using sslrootcert=system, the default sslmode is changed to verify-full, and any weaker setting will result in an error."
      issues.push({ kind: "rootcert-system-mode", severity: "error", detail: { mode }, fixes: [{ label: "fix-use", detail: { value: "sslmode=verify-full" }, next: setParam(parsed, "sslmode", "verify-full") }] })
    } else if (prod && remote && mode === undefined && param("ssl") === undefined && !systemRoots) {
      issues.push({ kind: "no-sslmode", severity: "warning", detail: {}, fixes: [{ label: "fix-use", detail: { value: "sslmode=verify-full" }, next: setParam(parsed, "sslmode", "verify-full") }, { label: "fix-use", detail: { value: "sslmode=require" }, next: setParam(parsed, "sslmode", "require") }] })
    } else if (prod && remote && mode && ["disable", "allow", "prefer"].includes(mode)) {
      issues.push({ kind: "weak-sslmode", severity: mode === "disable" ? "error" : "warning", detail: { mode }, fixes: [{ label: "fix-use", detail: { value: "sslmode=verify-full" }, next: setParam(parsed, "sslmode", "verify-full") }] })
    }
  }
  if (family === "redis" && parsed.scheme === "redis" && prod && remote) issues.push({ kind: "redis-plain", severity: "warning", detail: {}, fixes: [{ label: "fix-use", detail: { value: "rediss://" }, next: clean.replace(/^redis:/i, "rediss:") }] })
  // mongodb:// is plaintext unless tls/ssl=true; mongodb+srv:// turns TLS on implicitly unless tls/ssl=false.
  const mongoTls = parsed.scheme === "mongodb+srv" ? param("tls") !== "false" && param("ssl") !== "false" : param("tls") === "true" || param("ssl") === "true"
  if (family === "mongodb" && prod && remote && !mongoTls) issues.push({ kind: "mongo-no-tls", severity: "warning", detail: {}, fixes: [{ label: "fix-use", detail: { value: "tls=true" }, next: setParam(parsed, param("ssl") !== undefined && param("tls") === undefined ? "ssl" : "tls", "true") }] })

  const order = { error: 0, warning: 1, info: 2 }
  return issues.sort((a, b) => order[a.severity] - order[b.severity])
}
