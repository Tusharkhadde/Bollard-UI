// Bollard UI — set-cookie-check · MIT licence · https://bollard-ui.vercel.app/components/set-cookie-check

/**
 * Set-Cookie logic for SetCookieCheck. Pure functions, safe on the server.
 * Parsing and limits follow RFC 6265bis (draft-ietf-httpbis-rfc6265bis);
 * Partitioned follows CHIPS (privacycg/CHIPS).
 */

export type CookieIssueKind =
  | "samesite-none-insecure" | "partitioned-insecure" | "insecure-origin" | "host-prefix" | "secure-prefix" | "too-big"
  | "domain-mismatch" | "domain-public-suffix" | "domain-parent" | "domain-self" | "session-no-httponly" | "session-no-secure"
  | "expires-conflict" | "expires-invalid" | "max-age-invalid" | "capped" | "bad-samesite" | "bad-chars" | "no-name"
  | "attr-too-big" | "typo" | "domain-dot" | "path-relative" | "deletes" | "third-party" | "partitioned-samesite" | "no-samesite"
  | "http-prefix" | "nameless-prefix" | "control-char" | "folded" | "overwritten"

/** Set an attribute (added at the end when missing), remove one, replace the cookie value, split a comma-folded line into one line per cookie, or drop the line. */
export type CookieEdit = { op: "set"; attr: string; value?: string } | { op: "remove"; attr: string } | { op: "value"; value: string } | { op: "split" } | { op: "drop" }

export interface CookieIssue {
  /** 0-based source line of the cookie. */
  line: number
  kind: CookieIssueKind
  severity: "error" | "warning" | "info"
  /** Filled into the message: an attribute, a date, a size, a domain. */
  detail?: string
  /** Edits that fix it. Undefined: no safe automatic fix. */
  fix?: CookieEdit[]
}

export interface CookieAttr {
  /** Lowercased attribute name. */
  name: string
  /** Attribute name as written. */
  raw: string
  value?: string
}

export interface ParsedCookie {
  line: number
  /** "Set-Cookie: " when the line had it, else "". */
  prefix: string
  name: string
  value: string
  /** The line had no "=", so browsers read the whole thing as a value with an empty name. */
  nameless: boolean
  attrs: CookieAttr[]
}

export interface CookieContext {
  /** Host of the page or API that sends the header, e.g. "app.acme.com". Enables Domain checks. */
  host?: string
  /** The response is served over https (default true). Secure cookies can't be set over http. */
  https?: boolean
  /** Clock in ms for Expires maths and the 400-day cap. */
  now?: number
  /** Names treated as sign-in sessions (default: sess, sid, auth, token, jwt, login, remember). */
  sessionPattern?: RegExp
}

export interface CookieReadback {
  name: string
  /** host: only the host that set it · domain: that domain and every subdomain. */
  scope: "host" | "domain"
  domain?: string
  path: string
  secure: boolean
  httpOnly: boolean
  sameSite: "Strict" | "Lax" | "None" | "default"
  partitioned: boolean
  session: boolean
  /** session: until the browser closes · delete: removes the cookie · until: an end time (ms) · unknown: needs a clock. */
  lifetime: { kind: "session" } | { kind: "delete" } | { kind: "until"; at: number; capped: boolean; requestedSeconds: number } | { kind: "unknown"; seconds: number; capped: boolean; requestedSeconds: number }
  bytes: number
}

export const COOKIE_AGE_LIMIT = 34560000
const DAY = 86400
const SESSION = /(sess|^sid$|[_.-]sid$|auth|token|jwt|login|remember)/i
const KNOWN = ["expires", "max-age", "domain", "path", "secure", "httponly", "samesite", "partitioned", "priority"]
const CANONICAL: Record<string, string> = { expires: "Expires", "max-age": "Max-Age", domain: "Domain", path: "Path", secure: "Secure", httponly: "HttpOnly", samesite: "SameSite", partitioned: "Partitioned", priority: "Priority" }
const TYPOS: Record<string, string> = {
  "http-only": "httponly", http_only: "httponly", httponely: "httponly", "same-site": "samesite", same_site: "samesite", maxage: "max-age",
  max_age: "max-age", expire: "expires", expiry: "expires", secured: "secure", partition: "partitioned", domian: "domain",
}
/** Public suffixes people actually try to set cookies on. Browsers reject a Domain that is one (unless it is the host itself). */
const PUBLIC_SUFFIXES = new Set([
  "com", "net", "org", "io", "dev", "app", "co", "in", "uk", "de", "fr", "jp", "au", "ca", "eu", "co.uk", "org.uk", "ac.uk", "gov.uk", "com.au", "co.in", "co.jp", "com.br",
  "github.io", "vercel.app", "netlify.app", "pages.dev", "workers.dev", "herokuapp.com", "web.app", "firebaseapp.com", "appspot.com",
  "azurewebsites.net", "cloudfront.net", "onrender.com", "fly.dev", "glitch.me", "surge.sh", "blogspot.com",
])
const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"]
const CTL = /[\x00-\x08\x0a-\x1f\x7f]/
const encoder = new TextEncoder()
const bytes = (text: string) => encoder.encode(text).length
const isLocal = (host: string) => /^(localhost|127\.0\.0\.1|\[::1\])$/i.test(host) || host.endsWith(".localhost")
const normalHost = (host: unknown) => (typeof host === "string" ? host : "").trim().toLowerCase().replace(/^[a-z]+:\/\//, "").replace(/[/:].*$/, "").replace(/\.$/, "")

/** Drops a NaN clock or a non-RegExp pattern so bad props never crash the check. */
const clean = (context: CookieContext | null | undefined): CookieContext => ({
  ...context,
  now: Number.isFinite(context?.now) ? context?.now : undefined,
  sessionPattern: context?.sessionPattern instanceof RegExp ? context.sessionPattern : undefined,
})
/**
 * Parses an Expires value the way browsers do (RFC 6265bis §5.1.1): tokens in any order, a time, a day,
 * a month name and a year must all be there, any zone is ignored (read as UTC), 70–99 → 19xx, 0–69 → 20xx.
 * ISO dates like 2027-01-01T00:00:00Z have no month name, so they fail: NaN.
 */
export function parseCookieDate(value: string | undefined) {
  let time: number[] | undefined
  let day: number | undefined
  let month: number | undefined
  let year: number | undefined
  for (const token of String(value ?? "").split(/[\x09\x20-\x2f\x3b-\x40\x5b-\x60\x7b-\x7e]+/).filter(Boolean)) {
    const hms = /^(\d{1,2}):(\d{1,2}):(\d{1,2})(?:\D.*)?$/.exec(token)
    if (!time && hms) time = hms.slice(1).map(Number)
    else if (day === undefined && /^\d{1,2}(?:\D.*)?$/.test(token)) day = parseInt(token, 10)
    else if (month === undefined && MONTHS.includes(token.slice(0, 3).toLowerCase())) month = MONTHS.indexOf(token.slice(0, 3).toLowerCase())
    else if (year === undefined && /^\d{2,4}(?:\D.*)?$/.test(token)) year = parseInt(token, 10)
  }
  if (!time || day === undefined || month === undefined || year === undefined) return NaN
  if (year >= 70 && year <= 99) year += 1900
  else if (year >= 0 && year <= 69) year += 2000
  if (day < 1 || day > 31 || year < 1601 || time[0] > 23 || time[1] > 59 || time[2] > 59) return NaN
  const at = Date.UTC(year, month, day, time[0], time[1], time[2])
  return new Date(at).getUTCDate() === day ? at : NaN
}

/** Splits a line that joined several Set-Cookie values with commas (a common proxy or fetch() mistake). Expires dates keep their comma. */
export function splitFoldedSetCookie(body: string) {
  const parts: string[] = []
  let start = 0
  for (const match of body.matchAll(/,(?=\s*[!#$%&'*+\-.^_`|~0-9A-Za-z]+=)/g)) {
    const before = body.slice(start, match.index)
    if (/expires\s*=\s*[a-z]{3,9}\s*$/i.test(before)) continue
    parts.push(before.trim())
    start = (match.index ?? 0) + 1
  }
  parts.push(body.slice(start).trim())
  return parts.filter(Boolean)
}

/** Prefixes are matched case-insensitively (RFC 6265bis §4.1.3), so __host-x gets the same rules as __Host-x. */
const hasPrefix = (name: string, prefix: string) => name.toLowerCase().startsWith(prefix.toLowerCase())

/** Splits one Set-Cookie line the way browsers do (RFC 6265bis §5.6). Returns null for blank lines. */
export function parseCookieLine(raw: string, line = 0): ParsedCookie | null {
  const match = /^\s*(set-cookie\s*:\s*)?(.*)$/is.exec(String(raw ?? ""))
  const prefix = match?.[1] ?? ""
  const body = (match?.[2] ?? "").trim()
  if (!body) return null
  const [pair, ...rest] = body.split(";")
  const eq = pair.indexOf("=")
  const attrs = rest
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const at = part.indexOf("=")
      const rawName = (at < 0 ? part : part.slice(0, at)).trim()
      return { name: rawName.toLowerCase(), raw: rawName, value: at < 0 ? undefined : part.slice(at + 1).trim() }
    })
  return { line, prefix: prefix ? "Set-Cookie: " : "", name: eq < 0 ? "" : pair.slice(0, eq).trim(), value: (eq < 0 ? pair : pair.slice(eq + 1)).trim(), nameless: eq < 0, attrs }
}

/** Every cookie in the pasted text, one per line. Handles CRLF and a BOM. */
export function parseCookies(text: string) {
  return String(text ?? "")
    .replace(/^\uFEFF/, "")
    .split(/\r\n|\r|\n/)
    .map((raw, line) => parseCookieLine(raw, line))
    .filter((cookie): cookie is ParsedCookie => cookie !== null)
}

/** The last occurrence of an attribute wins (RFC 6265bis §5.7). */
const attr = (cookie: ParsedCookie, name: string) => cookie.attrs.filter((a) => a.name === name).at(-1)
const flag = (cookie: ParsedCookie, name: string) => cookie.attrs.some((a) => a.name === name)

const isHttpPrefixed = (name: string) => hasPrefix(name, "__Http-") || hasPrefix(name, "__Host-Http-")

function maxAgeOf(cookie: ParsedCookie) {
  const raw = attr(cookie, "max-age")?.value
  if (raw === undefined) return undefined
  return /^-?\d+$/.test(raw) ? Number(raw) : NaN
}

/** What the browser will do with the cookie. */
export function readCookie(cookie: ParsedCookie, input: CookieContext = {}): CookieReadback {
  const context = clean(input)
  const domainRaw = attr(cookie, "domain")?.value?.trim().toLowerCase().replace(/^\./, "")
  const host = normalHost(context.host)
  const sameRaw = attr(cookie, "samesite")?.value?.toLowerCase()
  const sameSite = sameRaw === "strict" ? "Strict" : sameRaw === "lax" ? "Lax" : sameRaw === "none" ? "None" : "default"
  const maxAge = maxAgeOf(cookie)
  const expires = parseCookieDate(attr(cookie, "expires")?.value)
  let lifetime: CookieReadback["lifetime"] = { kind: "session" }
  const requested = maxAge !== undefined && !Number.isNaN(maxAge) ? maxAge : !Number.isNaN(expires) && context.now !== undefined ? Math.round((expires - context.now) / 1000) : undefined
  if (requested !== undefined && requested <= 0) lifetime = { kind: "delete" }
  else if (requested !== undefined) {
    const seconds = Math.min(requested, COOKIE_AGE_LIMIT)
    const capped = requested > COOKIE_AGE_LIMIT
    lifetime = context.now === undefined ? { kind: "unknown", seconds, capped, requestedSeconds: requested } : { kind: "until", at: context.now + seconds * 1000, capped, requestedSeconds: requested }
  } else if (!Number.isNaN(expires)) lifetime = { kind: "unknown", seconds: NaN, capped: false, requestedSeconds: NaN }
  return {
    name: cookie.name,
    scope: domainRaw ? "domain" : "host",
    domain: domainRaw || host || undefined,
    path: attr(cookie, "path")?.value?.startsWith("/") ? (attr(cookie, "path")?.value ?? "/") : "/",
    secure: flag(cookie, "secure"),
    httpOnly: flag(cookie, "httponly"),
    sameSite,
    partitioned: flag(cookie, "partitioned"),
    session: (context.sessionPattern ?? SESSION).test(cookie.name.replace(/^__(Host-Http|Host|Secure|Http)-/i, "")),
    lifetime,
    bytes: bytes(cookie.name) + bytes(cookie.value),
  }
}

/** "30 days", "1.1 years". */
export function formatLifetime(seconds: number) {
  if (!Number.isFinite(seconds)) return "?"
  if (seconds >= 1000 * 365 * DAY) return "over 1,000 years"
  if (seconds >= 365 * DAY) return `${Math.round((seconds / (365 * DAY)) * 10) / 10} years`.replace(/^1 years/, "1 year")
  if (seconds >= DAY) return `${Math.round(seconds / DAY)} day${Math.round(seconds / DAY) === 1 ? "" : "s"}`
  if (seconds >= 3600) return `${Math.round(seconds / 3600)} hour${Math.round(seconds / 3600) === 1 ? "" : "s"}`
  return `${Math.max(1, Math.round(seconds / 60))} minute${Math.round(seconds / 60) === 1 ? "" : "s"}`
}

/** Every problem with every cookie, worst first. */
export function checkCookies(text: string, input: CookieContext = {}): CookieIssue[] {
  const context = clean(input)
  const issues: CookieIssue[] = []
  const host = normalHost(context.host)
  const https = context.https !== false
  const cookies = parseCookies(text)
  // Same name, Domain and Path later in the same response: the later one replaces this one.
  const identity = (cookie: ParsedCookie) => {
    const read = readCookie(cookie, context)
    return `${cookie.name}\u0000${read.scope}\u0000${read.domain ?? ""}\u0000${read.path}\u0000${read.partitioned}`
  }
  for (const cookie of cookies) {
    const read = readCookie(cookie, context)
    const push = (kind: CookieIssueKind, severity: CookieIssue["severity"], detail?: string, fix?: CookieEdit[]) => issues.push({ line: cookie.line, kind, severity, detail, fix })
    const secure = flag(cookie, "secure")
    const domain = attr(cookie, "domain")?.value?.trim().toLowerCase()

    const folded = splitFoldedSetCookie(String(text ?? "").replace(/^\uFEFF/, "").split(/\r\n|\r|\n/)[cookie.line]?.replace(/^\s*set-cookie\s*:\s*/i, "") ?? "")
    if (folded.length > 1) push("folded", "error", String(folded.length), [{ op: "split" }])
    const later = cookies.find((other) => other.line > cookie.line && identity(other) === identity(cookie))
    if (later && !cookie.nameless) push("overwritten", "warning", String(later.line + 1), [{ op: "drop" }])
    const ctl = CTL.exec([cookie.name, cookie.value, ...cookie.attrs.map((a) => `${a.raw}=${a.value ?? ""}`)].join(";"))
    if (ctl) push("control-char", "error", `U+${ctl[0].charCodeAt(0).toString(16).toUpperCase().padStart(4, "0")}`, CTL.test(cookie.value) && !CTL.test(cookie.name) ? [{ op: "value", value: encodeURIComponent(cookie.value.replace(/^"(.*)"$/, "$1")) }] : undefined)
    if (cookie.nameless || !cookie.name) push("no-name", "warning", cookie.value.slice(0, 24))
    if (!cookie.name && ["__Secure-", "__Host-", "__Http-", "__Host-Http-"].some((p) => hasPrefix(cookie.value, p))) push("nameless-prefix", "error")
    if (read.bytes > 4096) push("too-big", "error", String(read.bytes))
    for (const a of cookie.attrs) if (bytes(a.value ?? "") > 1024) push("attr-too-big", "warning", a.raw, [{ op: "remove", attr: a.name }])
    for (const a of cookie.attrs) {
      const typo = TYPOS[a.name]
      if (typo) push("typo", "warning", `${a.raw}→${CANONICAL[typo]}`, [{ op: "remove", attr: a.name }, { op: "set", attr: typo, value: a.value }])
    }
    const bad = /[\s",\\]|[^\x21-\x7e]/.exec(cookie.value.replace(/^"(.*)"$/, "$1"))
    if (bad && !ctl && !cookie.nameless) push("bad-chars", "warning", bad[0] === " " ? "space" : bad[0].trim() ? bad[0] : "whitespace", [{ op: "value", value: encodeURIComponent(cookie.value.replace(/^"(.*)"$/, "$1")) }])

    if (hasPrefix(cookie.name, "__Host-")) {
      const missing = [!secure && "Secure", attr(cookie, "path")?.value !== "/" && "Path=/", domain !== undefined && "no Domain"].filter(Boolean)
      if (missing.length) push("host-prefix", "error", missing.join(", "), [{ op: "set", attr: "secure" }, { op: "set", attr: "path", value: "/" }, { op: "remove", attr: "domain" }].filter((edit, i) => [!secure, attr(cookie, "path")?.value !== "/", domain !== undefined][i]) as CookieEdit[])
    } else if (hasPrefix(cookie.name, "__Secure-") && !secure) push("secure-prefix", "error", undefined, [{ op: "set", attr: "secure" }])
    // __Http- and __Host-Http- (layered cookies draft; Chrome 140/141, Firefox, Safari) also need HttpOnly.
    if (isHttpPrefixed(cookie.name)) {
      const missing = [!secure && "Secure", !flag(cookie, "httponly") && "HttpOnly"].filter(Boolean)
      if (missing.length) push("http-prefix", "error", missing.join(", "), [...(secure ? [] : [{ op: "set", attr: "secure" } as const]), ...(flag(cookie, "httponly") ? [] : [{ op: "set", attr: "httponly" } as const])])
    }
    if (secure && !https && !isLocal(host)) push("insecure-origin", "error")

    if (read.sameSite === "None" && !secure) push("samesite-none-insecure", "error", undefined, [{ op: "set", attr: "secure" }])
    if (read.partitioned && !secure) push("partitioned-insecure", "error", undefined, [{ op: "set", attr: "secure" }])
    const sameRaw = attr(cookie, "samesite")
    if (sameRaw && read.sameSite === "default") push("bad-samesite", "warning", sameRaw.value ?? "", [{ op: "set", attr: "samesite", value: "Lax" }])

    if (domain !== undefined) {
      const bare = domain.replace(/^\./, "")
      if (domain.startsWith(".")) push("domain-dot", "info", undefined, [{ op: "set", attr: "domain", value: bare }])
      if (PUBLIC_SUFFIXES.has(bare) && bare !== host) push("domain-public-suffix", "error", bare, [{ op: "remove", attr: "domain" }])
      else if (host && bare !== host && !host.endsWith(`.${bare}`)) push("domain-mismatch", "error", bare, [{ op: "remove", attr: "domain" }])
      else if (host && bare !== host) push("domain-parent", read.session ? "warning" : "info", bare, [{ op: "remove", attr: "domain" }])
      else if (read.session) push("domain-self", host ? "warning" : "info", bare, [{ op: "remove", attr: "domain" }])
    }
    if (read.session && read.lifetime.kind !== "delete") {
      if (!read.httpOnly && !isHttpPrefixed(cookie.name)) push("session-no-httponly", "warning", undefined, [{ op: "set", attr: "httponly" }])
      if (!secure && https) push("session-no-secure", "warning", undefined, [{ op: "set", attr: "secure" }])
      if (!sameRaw) push("no-samesite", "info", undefined, [{ op: "set", attr: "samesite", value: "Lax" }])
    }

    const maxAge = maxAgeOf(cookie)
    const expiresRaw = attr(cookie, "expires")?.value
    const expires = parseCookieDate(expiresRaw)
    if (maxAge !== undefined && Number.isNaN(maxAge)) push("max-age-invalid", "warning", attr(cookie, "max-age")?.value ?? "", [{ op: "remove", attr: "max-age" }])
    if (expiresRaw !== undefined && Number.isNaN(expires)) {
      const loose = Date.parse(expiresRaw)
      push("expires-invalid", "warning", expiresRaw, [Number.isNaN(loose) ? { op: "remove", attr: "expires" } : { op: "set", attr: "expires", value: new Date(loose).toUTCString() }])
    }
    if (maxAge !== undefined && !Number.isNaN(maxAge) && !Number.isNaN(expires) && context.now !== undefined && Math.abs(expires - (context.now + maxAge * 1000)) > DAY * 1000) {
      push("expires-conflict", "warning", formatLifetime(Math.max(maxAge, 0)), [{ op: "remove", attr: "expires" }])
    }
    if (read.lifetime.kind === "delete") push("deletes", "info")
    if ((read.lifetime.kind === "until" || read.lifetime.kind === "unknown") && read.lifetime.capped) push("capped", "warning", formatLifetime(read.lifetime.requestedSeconds), [{ op: "remove", attr: "expires" }, { op: "set", attr: "max-age", value: String(COOKIE_AGE_LIMIT) }])

    if (read.sameSite === "None" && !read.partitioned) push("third-party", "info", undefined, [{ op: "set", attr: "partitioned" }, ...(secure ? [] : [{ op: "set", attr: "secure" } as const])])
    if (read.partitioned && read.sameSite !== "None") push("partitioned-samesite", "info", undefined, [{ op: "set", attr: "samesite", value: "None" }])
    const path = attr(cookie, "path")?.value
    if (path !== undefined && !path.startsWith("/")) push("path-relative", "info", path, [{ op: "set", attr: "path", value: "/" }])
  }
  const rank = { error: 0, warning: 1, info: 2 }
  return issues.sort((a, b) => rank[a.severity] - rank[b.severity] || a.line - b.line)
}

/** Applies edits to one cookie line and returns the whole text, keeping line endings and BOM. */
export function applyCookieEdits(text: string, line: number, edits: CookieEdit[]) {
  const source = String(text ?? "")
  const bom = source.startsWith("\uFEFF") ? "\uFEFF" : ""
  const eol = /\r\n/.test(source) ? "\r\n" : "\n"
  const lines = source.replace(/^\uFEFF/, "").split(/\r\n|\r|\n/)
  const cookie = parseCookieLine(lines[line] ?? "", line)
  if (!cookie) return source
  if (edits.some((edit) => edit.op === "drop")) {
    lines.splice(line, 1)
    return bom + lines.join(eol)
  }
  if (edits.some((edit) => edit.op === "split")) {
    const prefix = /^\s*set-cookie\s*:\s*/i.exec(lines[line])?.[0] ?? ""
    lines.splice(line, 1, ...splitFoldedSetCookie(lines[line].slice(prefix.length)).map((part) => prefix + part))
    return bom + lines.join(eol)
  }
  let value = cookie.value
  let attrs = [...cookie.attrs]
  for (const edit of edits) {
    if (edit.op === "value") value = edit.value
    else if (edit.op === "split" || edit.op === "drop") continue
    else if (edit.op === "remove") attrs = attrs.filter((a) => a.name !== edit.attr)
    else {
      const index = attrs.findIndex((a) => a.name === edit.attr)
      const next = { name: edit.attr, raw: index >= 0 ? attrs[index].raw : (CANONICAL[edit.attr] ?? edit.attr), value: edit.value }
      if (index >= 0) attrs = attrs.filter((a, i) => i === index || a.name !== edit.attr).map((a) => (a.name === edit.attr ? next : a))
      else attrs.push(next)
    }
  }
  const pair = cookie.nameless ? value : `${cookie.name}=${value}`
  lines[line] = cookie.prefix + [pair, ...attrs.map((a) => (a.value === undefined ? a.raw : `${a.raw}=${a.value}`))].join("; ")
  return bom + lines.join(eol)
}
