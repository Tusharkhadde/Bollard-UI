// Bollard UI — cache-control-input · MIT licence · https://bollard-ui.vercel.app/components/cache-control-input

/**
 * Cache header logic for CacheControlInput. Pure functions, safe on the server.
 * Semantics follow RFC 9111 (HTTP Caching), RFC 9213 (CDN-Cache-Control),
 * RFC 8246 (immutable) and RFC 5861 (stale-while-revalidate).
 */

export type CacheTier = "browser" | "cdn" | "shared"
export type CacheIssueKind =
  | "personal-shared" | "personal-unset" | "set-cookie-shared" | "no-cache-personal" | "no-store-asset" | "immutable-unhashed"
  | "html-long" | "vary-encoding" | "vary-missing" | "vary-user-agent" | "vary-star" | "typo" | "quoted" | "bad-value"
  | "unknown" | "duplicate" | "public-private" | "pragma" | "no-cache-max-age" | "immutable-no-age" | "expires-invalid" | "expires-duplicate"

/** Set a header to a new value, or remove it with null. */
export interface HeaderEdit {
  header: string
  value: string | null
}

export interface CacheIssue {
  kind: CacheIssueKind
  severity: "error" | "warning" | "info"
  /** Header the issue is about, as it is usually written ("Cache-Control"). */
  header: string
  /** Filled into the message: a directive, a duration, a header name. */
  detail?: string
  /** Edits that fix it. Undefined: no safe automatic fix. */
  fix?: HeaderEdit[]
}

export interface TierReadback {
  tier: CacheTier
  /** never: not stored · revalidate: stored, checked before each reuse · fresh: reused for `seconds` · heuristic: lifetime guessed · unset: no lifetime given */
  state: "never" | "revalidate" | "fresh" | "heuristic" | "unset"
  /** Which header or directive decided it ("no-store", "s-maxage", "CDN-Cache-Control max-age"). */
  source: string
  seconds?: number
  staleWhileRevalidate?: number
  immutable?: boolean
}

export interface CacheContext {
  /** The response differs per signed-in user (account pages, carts, API responses with user data). */
  personalized?: boolean
  /** The URL path the headers are sent for, e.g. "/assets/app.3f9a1c2b.js" or "/account". */
  path?: string
  /** Request headers that change the body, e.g. ["Accept-Language"]. Each must appear in Vary. */
  varyOn?: string[]
  /** Clock for Expires maths, in ms. Without it, Expires is only judged against the Date header. */
  now?: number
}

export interface Directive {
  name: string
  value?: string
  quoted: boolean
}

interface Field {
  name: string
  value: string
}

const HEADER_LINE = /^([A-Za-z][A-Za-z0-9-]*)[ \t]*:(.*)$/
const MAX_DELTA = 2147483648
const KNOWN = [
  "max-age", "s-maxage", "no-cache", "no-store", "no-transform", "must-revalidate", "proxy-revalidate", "must-understand",
  "private", "public", "immutable", "stale-while-revalidate", "stale-if-error",
]
const TYPOS: Record<string, string> = {
  maxage: "max-age", max_age: "max-age", "max-ago": "max-age", smaxage: "s-maxage", "s-max-age": "s-maxage", s_maxage: "s-maxage",
  "s-maxage-age": "s-maxage", nocache: "no-cache", no_cache: "no-cache", nostore: "no-store", no_store: "no-store",
  privat: "private", pubic: "public", publc: "public", must_revalidate: "must-revalidate", "must-re-validate": "must-revalidate",
  immutible: "immutable", inmutable: "immutable", "stale-while-validate": "stale-while-revalidate",
}
const NAMES: Record<string, string> = { "cache-control": "Cache-Control", "cdn-cache-control": "CDN-Cache-Control", "surrogate-control": "Surrogate-Control", vary: "Vary", pragma: "Pragma", expires: "Expires" }
const UNITS: Record<string, number> = { s: 1, sec: 1, m: 60, min: 60, h: 3600, hr: 3600, d: 86400, day: 86400, w: 604800, y: 31536000, yr: 31536000 }

function distance(a: string, b: string) {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0]
    row[0] = i
    for (let j = 1; j <= b.length; j++) {
      const temp = row[j]
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1))
      prev = temp
    }
  }
  return row[b.length]
}

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"]
const DAYS = "(?:mon|tue|wed|thu|fri|sat|sun)"
const HTTP_DATES = [
  // IMF-fixdate: Sun, 06 Nov 1994 08:49:37 GMT
  new RegExp(`^${DAYS}, (\\d{2}) ([a-z]{3}) (\\d{4}) (\\d{2}):(\\d{2}):(\\d{2}) gmt$`, "i"),
  // obsolete RFC 850: Sunday, 06-Nov-94 08:49:37 GMT
  new RegExp(`^${DAYS}[a-z]*, (\\d{2})-([a-z]{3})-(\\d{2}) (\\d{2}):(\\d{2}):(\\d{2}) gmt$`, "i"),
]
// obsolete asctime: Sun Nov  6 08:49:37 1994
const ASCTIME = new RegExp(`^${DAYS} ([a-z]{3}) ([ \\d]\\d) (\\d{2}):(\\d{2}):(\\d{2}) (\\d{4})$`, "i")

/**
 * Parses an HTTP-date (RFC 9110 §5.6.7) the strict way caches do: IMF-fixdate, RFC 850 or asctime, GMT only,
 * case-insensitive (RFC 9111 §4.2). ISO dates, other zones and "0" are invalid: NaN.
 */
export function parseHttpDate(value: string | undefined) {
  const text = String(value ?? "").trim().replace(/\s+/g, " ")
  let parts: string[] | undefined
  const imf = HTTP_DATES.map((re) => re.exec(text)).find(Boolean)
  if (imf) parts = [imf[3], imf[2], imf[1], imf[4], imf[5], imf[6]]
  const asc = imf ? null : ASCTIME.exec(String(value ?? "").trim())
  if (asc) parts = [asc[6], asc[1], asc[2].trim(), asc[3], asc[4], asc[5]]
  if (!parts) return NaN
  const month = MONTHS.indexOf(parts[1].toLowerCase())
  let year = Number(parts[0])
  // RFC 850 two-digit years: 70–99 are 19xx, 00–69 are 20xx (a fixed pivot, so the result never depends on the clock).
  if (parts[0].length === 2) year += year >= 70 ? 1900 : 2000
  const [day, h, m, sec] = parts.slice(2).map(Number)
  if (month < 0 || day < 1 || day > 31 || h > 23 || m > 59 || sec > 60) return NaN
  const at = Date.UTC(year, month, day, h, m, Math.min(sec, 59))
  return new Date(at).getUTCDate() === day ? at : NaN
}

const headerName = (name: string) => NAMES[name] ?? name.replace(/(^|-)([a-z])/g, (_, dash: string, letter: string) => dash + letter.toUpperCase())

/** Splits pasted headers into lines. A paste with no "Name:" lines is read as a bare Cache-Control value. */
export function parseHeaders(text: string) {
  const lines = String(text ?? "").replace(/^\uFEFF/, "").split(/\r\n|\r|\n/)
  const fields: (Field & { line: number })[] = []
  lines.forEach((line, index) => {
    const match = HEADER_LINE.exec(line.trim())
    if (match) fields.push({ name: match[1].toLowerCase(), value: match[2].trim(), line: index })
  })
  const bare = fields.length === 0
  if (bare) {
    const value = lines.map((line) => line.trim()).filter(Boolean).join(", ")
    if (value) fields.push({ name: "cache-control", value, line: -1 })
  }
  return { lines, fields, bare }
}

/** Field lines with the same name combine with commas (RFC 9110 §5.3). */
function get(fields: Field[], name: string) {
  const values = fields.filter((field) => field.name === name).map((field) => field.value)
  return values.length ? values.join(", ") : undefined
}

/** Splits a Cache-Control value into directives, keeping commas inside quotes. */
export function parseDirectives(value: string): Directive[] {
  const parts = String(value ?? "").match(/(?:[^,"]|"(?:[^"\\]|\\.)*"?)+/g) ?? []
  return parts
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const eq = part.indexOf("=")
      if (eq < 0) return { name: part.toLowerCase(), quoted: false }
      const raw = part.slice(eq + 1).trim()
      const quoted = raw.startsWith('"')
      return { name: part.slice(0, eq).trim().toLowerCase(), value: quoted ? raw.replace(/^"|"$/g, "") : raw, quoted }
    })
}

export const serializeDirectives = (list: Directive[]) =>
  list.map((d) => (d.value === undefined ? d.name : `${d.name}=${d.quoted ? `"${d.value}"` : d.value}`)).join(", ")

/** delta-seconds: digits only, capped at 2^31 as RFC 9111 §1.2.2 asks. NaN when invalid. */
export function deltaSeconds(value: string | undefined) {
  if (value === undefined || !/^\d+$/.test(value.trim())) return NaN
  return Math.min(Number(value.trim()), MAX_DELTA)
}

/** Reads "1y", "30d", "60s" or "1h" as seconds, for one-tap fixes of a non-numeric max-age. */
export function looseSeconds(value: string | undefined) {
  const match = /^\s*(\d+(?:\.\d+)?)\s*([a-z]+)\s*$/i.exec(value ?? "")
  const unit = match ? UNITS[match[2].toLowerCase()] : undefined
  return match && unit ? Math.round(Number(match[1]) * unit) : NaN
}

/** "1 year", "10 minutes". */
export function formatDuration(seconds: number) {
  if (!Number.isFinite(seconds)) return "a very long time"
  const steps: [number, string][] = [[31536000, "year"], [86400, "day"], [3600, "hour"], [60, "minute"], [1, "second"]]
  const [size, unit] = steps.find(([s]) => seconds >= s) ?? [1, "second"]
  const amount = Math.round((seconds / size) * 10) / 10
  return `${amount.toLocaleString("en-US")} ${unit}${amount === 1 ? "" : "s"}`
}

/** True for build-fingerprinted URLs (app.3f9a1c2b.js, main-DLzx_4Qp.css, /_next/static/, ?v=…) that change name on every deploy. */
export function isFingerprinted(path: string) {
  const clean = path.trim()
  if (/\/_next\/static\/|[?&](v|ver|version|h|hash)=[\w.-]{4,}/i.test(clean)) return true
  const file = clean.split(/[?#]/)[0].split("/").pop() ?? ""
  return file.split(/[.\-~]/).slice(0, -1).some((part) => part.length >= 8 && /\d/.test(part) && /^[A-Za-z0-9_]+$/.test(part))
}

/** HTML: a text/html Content-Type, or a path that names a page rather than a file. */
function isHtml(fields: Field[], path: string | undefined) {
  const type = get(fields, "content-type")
  if (type) return /text\/html|application\/xhtml/i.test(type)
  if (!path?.trim()) return false
  const file = path.trim().split(/[?#]/)[0].split("/").pop() ?? ""
  return file === "" || /\.html?$/i.test(file) || !file.includes(".")
}

const has = (list: Directive[], name: string) => list.some((d) => d.name === name)
const find = (list: Directive[], name: string) => list.find((d) => d.name === name)
const qualified = (d: Directive | undefined) => d !== undefined && d.value !== undefined && d.value.trim() !== ""

/** The directives a tier obeys: a CDN reads CDN-Cache-Control, then Surrogate-Control, and only then Cache-Control (RFC 9213 §2.2). */
function policyFor(fields: Field[], tier: CacheTier) {
  if (tier === "cdn") {
    for (const name of ["cdn-cache-control", "surrogate-control"]) {
      const value = get(fields, name)
      if (value && parseDirectives(value).length) return { list: parseDirectives(value), header: headerName(name), targeted: true }
    }
  }
  return { list: parseDirectives(get(fields, "cache-control") ?? ""), header: "Cache-Control", targeted: false }
}

/** Works out who stores the response and for how long, per tier. */
export function readTier(fields: Field[], tier: CacheTier, now?: number): TierReadback {
  const shared = tier !== "browser"
  const { list, header, targeted } = policyFor(fields, tier)
  const label = (name: string) => (targeted ? `${header} ${name}` : name)
  const vary = (get(fields, "vary") ?? "").split(",").map((v) => v.trim())
  if (has(list, "no-store")) return { tier, state: "never", source: label("no-store") }
  if (shared && has(list, "private") && !qualified(find(list, "private"))) return { tier, state: "never", source: label("private") }
  if (vary.includes("*")) return { tier, state: "never", source: "Vary: *" }
  const swr = deltaSeconds(find(list, "stale-while-revalidate")?.value)
  const extra = { staleWhileRevalidate: Number.isNaN(swr) ? undefined : swr, immutable: has(list, "immutable") || undefined }
  if (has(list, "no-cache") && !qualified(find(list, "no-cache"))) return { tier, state: "revalidate", source: label("no-cache") }

  const smax = shared ? find(list, "s-maxage") : undefined
  const maxAge = find(list, "max-age")
  const explicit = smax ?? maxAge
  if (explicit) {
    const seconds = deltaSeconds(explicit.value)
    const source = label(explicit.name)
    return Number.isNaN(seconds) || seconds === 0 ? { tier, state: "revalidate", source: label(`${explicit.name}=${explicit.value ?? ""}`) } : { tier, state: "fresh", source, seconds, ...extra }
  }
  const expires = targeted ? undefined : get(fields, "expires")
  if (expires !== undefined) {
    const at = parseHttpDate(expires)
    const date = parseHttpDate(get(fields, "date"))
    const base = Number.isNaN(date) ? now : date
    // Two Expires lines: use the first or treat it as stale (RFC 9111 §4.2.1); we take the safe reading.
    if (fields.filter((field) => field.name === "expires").length > 1) return { tier, state: "revalidate", source: "Expires" }
    // An invalid Expires (including "0") means already expired (RFC 9111 §5.3).
    if (Number.isNaN(at)) return { tier, state: "revalidate", source: "Expires" }
    if (base === undefined) return { tier, state: "fresh", source: "Expires", ...extra }
    const seconds = Math.round((at - base) / 1000)
    return seconds > 0 ? { tier, state: "fresh", source: "Expires", seconds, ...extra } : { tier, state: "revalidate", source: "Expires" }
  }
  const modified = parseHttpDate(get(fields, "last-modified"))
  const date = parseHttpDate(get(fields, "date"))
  const base = Number.isNaN(date) ? now : date
  if (!Number.isNaN(modified) && base !== undefined && base > modified) {
    return { tier, state: "heuristic", source: "Last-Modified", seconds: Math.round(((base - modified) / 1000) * 0.1) }
  }
  return { tier, state: "unset", source: "" }
}

const stores = (read: TierReadback) => read.state === "fresh" || read.state === "heuristic"

/** Cache-Control made safe for per-user data: private first, shared-only directives dropped. */
function privatized(list: Directive[]) {
  const kept = list.filter((d) => !["public", "s-maxage", "proxy-revalidate", "private"].includes(d.name))
  return serializeDirectives([{ name: "private", quoted: false }, ...kept])
}
const without = (list: Directive[], ...names: string[]) => list.filter((d) => !names.includes(d.name))
const addVary = (vary: string | undefined, name: string) => (vary?.trim() ? `${vary.trim()}, ${name}` : name)

/** Every problem with the headers, worst first. */
export function checkCacheHeaders(text: string, context: CacheContext = {}): CacheIssue[] {
  const { fields } = parseHeaders(text)
  const issues: CacheIssue[] = []
  const cc = get(fields, "cache-control")
  const list = parseDirectives(cc ?? "")
  const now = Number.isFinite(context.now) ? context.now : undefined
  const tiers = (["browser", "cdn", "shared"] as const).map((tier) => readTier(fields, tier, now))
  const [browser, cdn, shared] = tiers
  const personal = context.personalized === true
  const path = typeof context.path === "string" ? context.path.trim() : ""
  const removeTargeted: HeaderEdit[] = ["CDN-Cache-Control", "Surrogate-Control"].filter((name) => get(fields, name.toLowerCase()) !== undefined).map((header) => ({ header, value: null }))
  const makePrivate: HeaderEdit[] = [{ header: "Cache-Control", value: privatized(list) }, ...removeTargeted]
  const sharedStores = [cdn, shared].filter(stores)
  const who = sharedStores.map((read) => (read.tier === "cdn" ? "CDNs" : "shared caches")).join(" and ")

  if (personal && sharedStores.length) {
    issues.push({ kind: "personal-shared", severity: "error", header: /^(CDN-Cache-Control|Surrogate-Control) /.exec(sharedStores[0].source)?.[1] ?? "Cache-Control", detail: who, fix: makePrivate })
  } else if (personal && [cdn, shared].some((read) => read.state === "revalidate" && read.source.endsWith("no-cache"))) {
    issues.push({ kind: "no-cache-personal", severity: "error", header: "Cache-Control", fix: [{ header: "Cache-Control", value: serializeDirectives([{ name: "private", quoted: false }, { name: "no-store", quoted: false }, ...without(list, "no-cache", "max-age", "s-maxage", "public", "private", "no-store")]) }, ...removeTargeted] })
  } else if (personal && [cdn, shared].some((read) => read.state === "unset")) {
    issues.push({ kind: "personal-unset", severity: "warning", header: "Cache-Control", fix: [{ header: "Cache-Control", value: privatized([...list, { name: "no-cache", quoted: false }].filter((d, i, all) => all.findIndex((o) => o.name === d.name) === i)) }] })
  }
  // private="Set-Cookie" / no-cache="Set-Cookie" keep the cookie out of shared copies (RFC 9111 §5.2.2.4, §5.2.2.7).
  const shieldsCookie = list.some((d) => (d.name === "private" || d.name === "no-cache") && (d.value ?? "").toLowerCase().split(/\s*,\s*/).includes("set-cookie"))
  if (!personal && get(fields, "set-cookie") !== undefined && sharedStores.length && !shieldsCookie) {
    issues.push({ kind: "set-cookie-shared", severity: "error", header: "Set-Cookie", detail: who, fix: makePrivate })
  }
  if (!personal && path && isFingerprinted(path) && has(list, "no-store")) {
    issues.push({ kind: "no-store-asset", severity: "warning", header: "Cache-Control", fix: [{ header: "Cache-Control", value: "public, max-age=31536000, immutable" }] })
  }
  if (has(list, "immutable") && path && !isFingerprinted(path) && browser.state === "fresh") {
    issues.push({ kind: "immutable-unhashed", severity: "warning", header: "Cache-Control", detail: browser.seconds ? formatDuration(browser.seconds) : undefined, fix: [{ header: "Cache-Control", value: serializeDirectives(without(list, "immutable")) }] })
  }
  if (isHtml(fields, path || undefined) && browser.state === "fresh" && (browser.seconds ?? Infinity) > 3600) {
    const kept = without(list, "max-age", "immutable", "stale-while-revalidate", "no-cache")
    issues.push({ kind: "html-long", severity: "warning", header: "Cache-Control", detail: browser.seconds ? formatDuration(browser.seconds) : undefined, fix: [{ header: "Cache-Control", value: serializeDirectives([{ name: "no-cache", quoted: false }, ...kept]) }, ...(get(fields, "expires") !== undefined ? [{ header: "Expires", value: null }] : [])] })
  }

  const varyRaw = get(fields, "vary")
  const vary = (varyRaw ?? "").split(",").map((v) => v.trim().toLowerCase()).filter(Boolean)
  const encoding = get(fields, "content-encoding")
  if (vary.includes("*")) issues.push({ kind: "vary-star", severity: "warning", header: "Vary" })
  else {
    if (encoding && !/^\s*identity\s*$/i.test(encoding) && !vary.includes("accept-encoding")) {
      issues.push({ kind: "vary-encoding", severity: "warning", header: "Vary", detail: encoding.trim(), fix: [{ header: "Vary", value: addVary(varyRaw, "Accept-Encoding") }] })
    }
    for (const name of Array.isArray(context.varyOn) ? context.varyOn : []) {
      if (typeof name !== "string" || !name.trim() || vary.includes(name.trim().toLowerCase())) continue
      issues.push({ kind: "vary-missing", severity: "warning", header: "Vary", detail: headerName(name.trim().toLowerCase()), fix: [{ header: "Vary", value: addVary(varyRaw, headerName(name.trim().toLowerCase())) }] })
    }
    if (vary.includes("user-agent")) {
      const rest = (varyRaw ?? "").split(",").map((v) => v.trim()).filter((v) => v && v.toLowerCase() !== "user-agent")
      issues.push({ kind: "vary-user-agent", severity: "warning", header: "Vary", fix: [{ header: "Vary", value: rest.length ? rest.join(", ") : null }] })
    }
  }

  for (const [header, value] of [["Cache-Control", cc], ["CDN-Cache-Control", get(fields, "cdn-cache-control")]] as const) {
    if (value === undefined) continue
    const directives = parseDirectives(value)
    const fixed = (map: (d: Directive) => Directive | null) => serializeDirectives(directives.map(map).filter((d): d is Directive => d !== null))
    const seen = new Map<string, Directive>()
    for (const d of directives) {
      const typo = TYPOS[d.name] ?? (KNOWN.includes(d.name) || d.name.length < 5 ? undefined : KNOWN.find((known) => distance(d.name, known) <= 2))
      if (typo) issues.push({ kind: "typo", severity: "error", header, detail: `${d.name}→${typo}`, fix: [{ header, value: fixed((o) => (o === d ? { ...o, name: typo } : o)) }] })
      else if (!KNOWN.includes(d.name)) issues.push({ kind: "unknown", severity: "info", header, detail: d.name })
      const timed = ["max-age", "s-maxage", "stale-while-revalidate", "stale-if-error"].includes(typo ?? d.name)
      if (timed && d.quoted && !Number.isNaN(deltaSeconds(d.value))) issues.push({ kind: "quoted", severity: "warning", header, detail: d.name, fix: [{ header, value: fixed((o) => (o === d ? { ...o, quoted: false } : o)) }] })
      else if (timed && Number.isNaN(deltaSeconds(d.value))) {
        const loose = looseSeconds(d.value)
        issues.push({ kind: "bad-value", severity: "error", header, detail: `${d.name}=${d.value ?? ""}`, fix: Number.isNaN(loose) ? undefined : [{ header, value: fixed((o) => (o === d ? { name: o.name, value: String(Math.min(loose, MAX_DELTA)), quoted: false } : o)) }] })
      }
      const prior = seen.get(d.name)
      if (prior && prior.value !== d.value) issues.push({ kind: "duplicate", severity: "warning", header, detail: d.name, fix: [{ header, value: fixed((o) => (o === d ? null : o)) }] })
      seen.set(d.name, prior ?? d)
    }
    if (has(directives, "public") && has(directives, "private")) issues.push({ kind: "public-private", severity: "warning", header, fix: [{ header, value: fixed((o) => (o.name === "public" ? null : o)) }] })
    const age = deltaSeconds(find(directives, "max-age")?.value)
    if (has(directives, "no-cache") && age > 0) issues.push({ kind: "no-cache-max-age", severity: "info", header, detail: formatDuration(age) })
    if (has(directives, "immutable") && !has(directives, "max-age") && !has(directives, "s-maxage")) issues.push({ kind: "immutable-no-age", severity: "info", header })
  }
  const expiresLines = fields.filter((field) => field.name === "expires")
  const expiresMatters = !has(list, "max-age") && !(has(list, "s-maxage") && expiresLines.length)
  if (expiresLines.length > 1) issues.push({ kind: "expires-duplicate", severity: "warning", header: "Expires", fix: [{ header: "Expires", value: expiresLines[0].value }] })
  else if (expiresLines.length === 1 && expiresMatters && Number.isNaN(parseHttpDate(expiresLines[0].value)) && !/^\s*(0|-1)\s*$/.test(expiresLines[0].value)) {
    const loose = Date.parse(expiresLines[0].value)
    issues.push({ kind: "expires-invalid", severity: "warning", header: "Expires", detail: expiresLines[0].value, fix: Number.isNaN(loose) ? undefined : [{ header: "Expires", value: new Date(loose).toUTCString() }] })
  }
  if (get(fields, "pragma") !== undefined) issues.push({ kind: "pragma", severity: "info", header: "Pragma", fix: [{ header: "Pragma", value: null }] })

  const rank = { error: 0, warning: 1, info: 2 }
  return issues.sort((a, b) => rank[a.severity] - rank[b.severity])
}

/** Applies header edits to the pasted text, keeping its line endings and BOM. */
export function applyCacheEdits(text: string, edits: HeaderEdit[]) {
  const source = String(text ?? "")
  const bom = source.startsWith("\uFEFF") ? "\uFEFF" : ""
  const eol = /\r\n/.test(source) ? "\r\n" : "\n"
  const parsed = parseHeaders(source)
  if (parsed.bare && edits.every((edit) => edit.header.toLowerCase() === "cache-control")) {
    const value = edits.at(-1)?.value
    return bom + (value ?? "")
  }
  let lines = parsed.bare ? (parsed.fields[0] ? [`Cache-Control: ${parsed.fields[0].value}`] : []) : [...parsed.lines]
  for (const edit of edits) {
    const name = edit.header.toLowerCase()
    const at = lines.map((line, index) => ({ index, match: HEADER_LINE.exec(line.trim()) })).filter((row) => row.match?.[1].toLowerCase() === name)
    if (edit.value === null) {
      const drop = new Set(at.map((row) => row.index))
      lines = lines.filter((_, index) => !drop.has(index))
    } else if (at.length) {
      const first = at[0]
      const drop = new Set(at.slice(1).map((row) => row.index))
      lines[first.index] = `${first.match?.[1] ?? edit.header}: ${edit.value}`
      lines = lines.filter((_, index) => !drop.has(index))
    } else {
      let last = -1
      lines.forEach((line, index) => {
        if (HEADER_LINE.test(line.trim())) last = index
      })
      lines.splice(last + 1, 0, `${edit.header}: ${edit.value}`)
    }
  }
  return bom + lines.join(eol)
}

/** The tiers' readback for the pasted headers. */
export function readCacheHeaders(text: string, now?: number) {
  const { fields } = parseHeaders(text)
  const clock = Number.isFinite(now) ? now : undefined
  return (["browser", "cdn", "shared"] as const).map((tier) => readTier(fields, tier, clock))
}
