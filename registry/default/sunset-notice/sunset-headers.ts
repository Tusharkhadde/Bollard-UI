// Bollard UI — sunset-notice · MIT licence · https://bollard-ui.vercel.app/components/sunset-notice

// Pure parsing for the Sunset (RFC 8594) and Deprecation (RFC 9745) response headers.
// No "use client": safe to run on the server, e.g. in a fetch wrapper or a route handler.

export interface SunsetInfo {
  /** When the resource was or will be deprecated. `true` means deprecated with no date (pre-RFC `Deprecation: true`). */
  deprecation?: Date | true
  /** When it is expected to stop responding. */
  sunset?: Date
  /** Link with rel="deprecation": the migration or policy page. */
  deprecationLink?: string
  /** Link with rel="sunset": the sunset policy page. */
  sunsetLink?: string
  /** Sunset is earlier than Deprecation, which RFC 9745 §4 forbids: ask the API owner which is right. */
  inconsistent: boolean
}

/** A fetch Response, a Headers object, or a plain header map from any HTTP client. */
export type HeaderSource = Headers | { headers: Headers; url?: string } | Record<string, string | undefined>

const valid = (date: Date) => (Number.isNaN(date.getTime()) ? undefined : date)

/** HTTP-date ("Sun, 30 Jun 2024 23:59:59 GMT") to a Date. */
export function parseHttpDate(value?: string | null) {
  return value ? valid(new Date(value.trim())) : undefined
}

/** RFC 9745 structured Date ("@1688169599"), plus the draft forms "true", "?1" and an HTTP-date. */
export function parseDeprecation(value?: string | null): Date | true | undefined {
  const text = value?.trim()
  if (!text) return undefined
  if (/^@-?\d+$/.test(text)) return valid(new Date(Number(text.slice(1)) * 1000))
  if (/^(true|\?1)$/i.test(text)) return true
  return parseHttpDate(text)
}

/** Every link in a Link header with its rel tokens, resolved against `base` when given. */
export function parseLinks(value?: string | null, base?: string) {
  const links: { href: string; rel: string[] }[] = []
  const pattern = /<([^>]*)>((?:\s*;\s*[\w*-]+(?:\s*=\s*(?:"[^"]*"|[^\s",;]+))?)*)/g
  for (const [, target, params] of (value ?? "").matchAll(pattern)) {
    const rel = /;\s*rel\s*=\s*(?:"([^"]*)"|([^\s",;]+))/i.exec(params)
    let href = target
    try {
      href = new URL(target, base).href
    } catch {}
    links.push({ href, rel: (rel?.[1] ?? rel?.[2] ?? "").toLowerCase().split(/\s+/).filter(Boolean) })
  }
  return links
}

/** Reads Sunset, Deprecation and their Link relations from a response's headers. */
export function readSunsetHeaders(source: HeaderSource): SunsetInfo {
  const isHeaders = (value: unknown): value is Headers => typeof Headers !== "undefined" && value instanceof Headers
  const headers = isHeaders(source) ? source : "headers" in source && isHeaders(source.headers) ? source.headers : undefined
  const map = headers ? undefined : Object.fromEntries(Object.entries(source as Record<string, string | undefined>).map(([key, value]) => [key.toLowerCase(), value]))
  const get = (name: string) => (headers ? headers.get(name) : map?.[name])
  const base = "url" in source && typeof source.url === "string" && source.url ? source.url : undefined
  const links = parseLinks(get("link"), base)
  const deprecation = parseDeprecation(get("deprecation"))
  const sunset = parseHttpDate(get("sunset"))
  return {
    deprecation,
    sunset,
    deprecationLink: links.find((link) => link.rel.includes("deprecation"))?.href,
    sunsetLink: links.find((link) => link.rel.includes("sunset"))?.href,
    inconsistent: deprecation instanceof Date && sunset !== undefined && sunset < deprecation,
  }
}

export type SunsetPhase = "announced" | "deprecated" | "soon" | "final" | "past"

const DAY = 86_400_000

/** Where `now` sits: deprecation still ahead, deprecated, within `soonDays` / `finalDays` of sunset, or past it. */
export function sunsetPhase(info: Pick<SunsetInfo, "deprecation" | "sunset">, now: number, soonDays = 30, finalDays = 7): SunsetPhase | undefined {
  if (info.sunset) {
    const left = info.sunset.getTime() - now
    if (left <= 0) return "past"
    if (left <= finalDays * DAY) return "final"
    if (left <= soonDays * DAY) return "soon"
  }
  if (info.deprecation instanceof Date && info.deprecation.getTime() > now) return "announced"
  return info.deprecation || info.sunset ? "deprecated" : undefined
}

/** "6 days", "1 day", "5 h", "40 min": never rounds up, so "1 day" is never really 20 hours. */
export function formatTimeLeft(ms: number) {
  if (ms >= 2 * DAY) return `${Math.floor(ms / DAY)} days`
  if (ms >= DAY) return "1 day"
  if (ms >= 3_600_000) return `${Math.floor(ms / 3_600_000)} h`
  return `${Math.max(1, Math.floor(ms / 60_000))} min`
}

/** The calendar day of `date` in `timeZone`, e.g. "2026-10-19". */
export function dayIn(date: Date, timeZone?: string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(date)
}
