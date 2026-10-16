// Pure redirect_uri checks. Authorization servers compare redirect URIs with simple
// string comparison (RFC 6749 §3.1.2.3, RFC 9700 §2.1), so "close" is a failure.

export type RedirectIssueKind =
  | "whitespace" | "relative" | "dangerous-scheme" | "invalid" | "wildcard" | "fragment" | "userinfo"
  | "localhost-prod" | "http" | "uppercase" | "localhost-name" | "query" | "custom-scheme" | "mismatch"

/** Why a URI that looks registered still fails the exact match. */
export type MismatchReason = "trailing-slash" | "scheme" | "case" | "www" | "port" | "loopback" | "encoding" | "path" | "query" | "unlisted"

export interface RedirectIssue {
  kind: RedirectIssueKind
  severity: "error" | "warning" | "hint"
  /** The corrected URI for a one-tap fix. Undefined when there is no safe fix. */
  fix?: string
  /** For "mismatch": the closest registered URI and how it differs. */
  registered?: string
  reason?: MismatchReason
}

export interface RedirectContext {
  /** URIs registered with the provider. Enables the exact-match check. */
  registered?: string[]
  /** The URI is for a production client: localhost becomes an error. (http to a non-loopback host is always one.) */
  production?: boolean
  /** A native or desktop app (RFC 8252): loopback ports may vary and custom schemes are expected. */
  native?: boolean
}

const SCHEME = /^([a-z][a-z\d+.-]*):/i
const LOOPBACK = /^(localhost|127(?:\.\d{1,3}){3}|\[::1\])$/i
const DANGEROUS = new Set(["javascript", "data", "vbscript", "file", "blob"])

const parse = (uri: string) => {
  try {
    return new URL(uri)
  } catch {
    return null
  }
}
const isLoopback = (url: URL | null) => !!url && LOOPBACK.test(url.hostname)
const decode = (s: string) => {
  try {
    return decodeURIComponent(s)
  } catch {
    return s
  }
}

/** How `uri` differs from one `registered` entry, or null when it is unrelated. */
export function mismatchReason(uri: string, registered: string): MismatchReason | null {
  if (uri.replace(/\/$/, "") === registered.replace(/\/$/, "")) return "trailing-slash"
  if (uri.toLowerCase() === registered.toLowerCase()) return "case"
  if (decode(uri) === decode(registered)) return "encoding"
  const a = parse(uri)
  const b = parse(registered)
  if (!a || !b) return null
  const rest = (u: URL) => u.pathname + u.search
  if (rest(a) !== rest(b)) {
    if (a.origin === b.origin && a.pathname.replace(/\/$/, "") !== b.pathname.replace(/\/$/, "")) return "path"
    if (a.origin === b.origin) return "query"
    return null
  }
  // The URL parser hides differences the string match still sees, like a default ":443" or an empty "?".
  if (a.protocol === b.protocol && a.host === b.host) {
    const authority = (u: string) => u.match(/^[^:]+:\/\/([^/?#]*)/)?.[1] ?? ""
    if (authority(uri) !== authority(registered)) return "port"
    return uri.includes("?") || registered.includes("?") ? "query" : null
  }
  if (isLoopback(a) && isLoopback(b) && a.protocol === b.protocol) return a.hostname === b.hostname ? "port" : "loopback"
  if (a.host === b.host) return "scheme"
  if (a.hostname === b.hostname) return "port"
  if (a.protocol === b.protocol && a.host.replace(/^www\./, "") === b.host.replace(/^www\./, "")) return "www"
  return null
}

const RANK: MismatchReason[] = ["trailing-slash", "case", "encoding", "scheme", "www", "port", "loopback", "query", "path"]

/** Is `uri` in `registered`, honouring the RFC 8252 loopback-port exception for native apps? */
export function findRegistered(uri: string, registered: string[], native = false): string | undefined {
  if (registered.includes(uri)) return uri
  const url = parse(uri)
  if (!native || !isLoopback(url) || !url) return undefined
  return registered.find((entry) => {
    const other = parse(entry)
    return !!other && isLoopback(other) && other.hostname === url.hostname && other.protocol === url.protocol && other.pathname + other.search === url.pathname + url.search
  })
}

/** Checks a redirect URI the way an authorization server will. Issues are ordered by severity. */
export function checkRedirectUri(raw: string, { registered = [], production = false, native = false }: RedirectContext = {}): RedirectIssue[] {
  const uri = raw.trim()
  if (!uri) return []
  let issues: RedirectIssue[] = []
  // Spaces anywhere are compared too (a pasted line break or a space in the path).
  if (uri !== raw || /\s/.test(uri)) issues.push({ kind: "whitespace", severity: "error", fix: raw.replace(/\s+/g, "") })
  const scheme = uri.match(SCHEME)?.[1]?.toLowerCase()
  if (!scheme || uri.startsWith("//")) {
    const bare = uri.replace(/^\/+/, "")
    const hosty = /^[^/\s]+\.[^/\s]+|^localhost\b/i.test(bare)
    issues.push({ kind: "relative", severity: "error", fix: hosty ? `${/^localhost\b|^127\./i.test(bare) ? "http" : "https"}://${bare}` : undefined })
    return issues
  }
  if (DANGEROUS.has(scheme)) return [...issues, { kind: "dangerous-scheme", severity: "error" }]
  if (uri.includes("*")) issues.push({ kind: "wildcard", severity: "error" })
  const url = parse(uri)
  if (!url) return [...issues, { kind: "invalid", severity: "error" }]
  if (uri.includes("#")) issues.push({ kind: "fragment", severity: "error", fix: uri.slice(0, uri.indexOf("#")) })

  const web = scheme === "http" || scheme === "https"
  if (web) {
    const authority = uri.match(/^[^:]+:\/\/([^/?#]*)/)?.[1] ?? ""
    if (authority.includes("@")) issues.push({ kind: "userinfo", severity: "error", fix: uri.replace(`${authority.slice(0, authority.lastIndexOf("@") + 1)}`, "") })
    const loop = isLoopback(url)
    if (production && loop) issues.push({ kind: "localhost-prod", severity: "error" })
    // RFC 9700 §2.6: servers MUST NOT allow http redirect URIs except loopback for native apps.
    else if (scheme === "http" && !loop) issues.push({ kind: "http", severity: "error", fix: uri.replace(/^http:/i, "https:") })
    const head = uri.match(/^[^:]+:\/\/[^/?#]*/)?.[0] ?? ""
    if (head !== head.toLowerCase()) issues.push({ kind: "uppercase", severity: "warning", fix: head.toLowerCase() + uri.slice(head.length) })
    if (native && url.hostname.toLowerCase() === "localhost") issues.push({ kind: "localhost-name", severity: "hint", fix: uri.replace(/localhost/i, "127.0.0.1") })
    if (url.search) issues.push({ kind: "query", severity: "hint" })
  } else if (!scheme.includes(".")) {
    issues.push({ kind: "custom-scheme", severity: "hint" })
  }

  // Compare without a #fragment: that has its own issue, and stripping it may be the whole fix.
  const target = uri.split("#")[0]
  // Skip the diff when removing the whitespace already lands on a registered URI.
  const spaced = issues.find((i) => i.kind === "whitespace")?.fix
  if (registered.length && !findRegistered(target, registered, native) && !(spaced && findRegistered(spaced, registered, native))) {
    let best: { entry: string; reason: MismatchReason } | undefined
    for (const entry of registered) {
      const reason = mismatchReason(target, entry)
      if (reason && (!best || RANK.indexOf(reason) < RANK.indexOf(best.reason))) best = { entry, reason }
    }
    // A case-only mismatch says the same thing as the uppercase warning, with the diff, so keep one.
    if (best?.reason === "case") issues = issues.filter((i) => i.kind !== "uppercase")
    issues.push(best ? { kind: "mismatch", severity: "error", fix: best.entry, registered: best.entry, reason: best.reason } : { kind: "mismatch", severity: "error", reason: "unlisted" })
  }
  const order = { error: 0, warning: 1, hint: 2 }
  return issues.sort((a, b) => order[a.severity] - order[b.severity])
}

/** Splits two strings into shared prefix, differing middles and shared suffix, for highlighting. */
export function diffParts(a: string, b: string): [prefix: string, aMid: string, bMid: string, suffix: string] {
  let start = 0
  while (start < a.length && start < b.length && a[start] === b[start]) start++
  let end = 0
  while (end < a.length - start && end < b.length - start && a[a.length - 1 - end] === b[b.length - 1 - end]) end++
  return [a.slice(0, start), a.slice(start, a.length - end), b.slice(start, b.length - end), a.slice(a.length - end)]
}
