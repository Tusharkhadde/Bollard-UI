// Bollard UI — retry-after · MIT licence · https://bollard-ui.vercel.app/components/retry-after

/** Anything shaped like a fetch Response: a status and its headers. */
export interface RateLimitResponse {
  status: number
  headers: Headers | Record<string, string>
}

export interface RateLimitInfo {
  status: number
  /** How long to wait from when the response arrived, in ms, before any jitter. */
  waitMs: number
  /** Where `waitMs` came from. `backoff` means the server didn't say. */
  source: "retry-after" | "ratelimit" | "backoff"
  /** Requests allowed per window, e.g. 5. */
  limit?: number
  /** Requests left in the window. */
  remaining?: number
  /** Window length in seconds, e.g. 60. */
  windowSeconds?: number
  /** Policy name from RateLimit-Policy, e.g. "messages". */
  policy?: string
}

export function getHeader(headers: RateLimitResponse["headers"], name: string) {
  if (headers instanceof Headers) return headers.get(name) ?? undefined
  const key = Object.keys(headers).find((k) => k.toLowerCase() === name)
  return key ? headers[key] : undefined
}

export const isRateLimitResponse = (value: unknown): value is RateLimitResponse =>
  !!value &&
  typeof value === "object" &&
  typeof (value as RateLimitResponse).status === "number" &&
  typeof (value as RateLimitResponse).headers === "object" &&
  [429, 503].includes((value as RateLimitResponse).status)

/**
 * Retry-After is delay-seconds ("120") or an HTTP-date (RFC 9110 §10.2.3).
 * A date is measured against the response's own Date header when there is
 * one, so a wrong device clock can't turn "wait 30s" into "wait 4 minutes".
 */
export function parseRetryAfter(value: string | undefined, serverDate?: string, now = Date.now()): number | null {
  if (!value) return null
  const trimmed = value.trim()
  if (/^\d+$/.test(trimmed)) return Number(trimmed) * 1000
  const target = Date.parse(trimmed)
  if (Number.isNaN(target)) return null
  const reference = serverDate ? Date.parse(serverDate) : NaN
  return Math.max(0, target - (Number.isNaN(reference) ? now : reference))
}

/** Reads a structured-field item like `"messages";q=5;w=60` or the older `limit=5, remaining=0, reset=20`. */
function parseParams(value: string) {
  const params: Record<string, string> = {}
  const name = value.match(/^\s*"([^"]*)"/)?.[1]
  for (const match of value.matchAll(/([a-z-]+)=("?)([^;,"]*)\2/gi)) params[match[1].toLowerCase()] = match[3]
  const leading = value.match(/^\s*(\d+)\s*(?:;|$)/)?.[1]
  return { name, params, leading }
}

/**
 * Understands the IETF RateLimit / RateLimit-Policy fields and the common
 * X-RateLimit-* family. X-RateLimit-Reset is ambiguous across vendors: values
 * that look like Unix timestamps (seconds or ms) are treated as such, smaller
 * ones as seconds from now.
 */
export function parseRateLimitHeaders(headers: RateLimitResponse["headers"], now = Date.now()) {
  const get = (name: string) => getHeader(headers, name)
  const serverNow = Date.parse(get("date") ?? "") || now
  const info: Pick<RateLimitInfo, "limit" | "remaining" | "windowSeconds" | "policy"> & { resetMs?: number } = {}

  const policy = get("ratelimit-policy")
  if (policy) {
    const { name, params, leading } = parseParams(policy.split(",")[0])
    info.policy = name
    info.limit = Number(params.q ?? leading) || undefined
    info.windowSeconds = Number(params.w) || undefined
  }
  const current = get("ratelimit")
  if (current) {
    const { params } = parseParams(current)
    if (params.r ?? params.remaining) info.remaining = Number(params.r ?? params.remaining)
    if (params.t ?? params.reset) info.resetMs = Number(params.t ?? params.reset) * 1000
    info.limit ??= Number(params.limit) || undefined
  }

  const x = (suffix: string) => get(`x-ratelimit-${suffix}`) ?? get(`x-rate-limit-${suffix}`)
  info.limit ??= Number(x("limit")) || undefined
  if (info.remaining === undefined && x("remaining") !== undefined) info.remaining = Number(x("remaining"))
  const reset = Number(x("reset"))
  if (info.resetMs === undefined && reset > 0)
    info.resetMs = reset > 1e12 ? reset - serverNow : reset > 1e9 ? reset * 1000 - serverNow : reset * 1000
  if (info.resetMs !== undefined) info.resetMs = Math.max(0, info.resetMs)
  return info
}

/** "Full jitter" exponential backoff (AWS): a random wait in [0, min(cap, base·2^attempt)]. */
export const backoffDelay = (attempt: number, base = 1000, cap = 60_000, random = Math.random) =>
  Math.round(random() * Math.min(cap, base * 2 ** attempt))

/**
 * Jitter for a server-given wait only ever adds time: never retry before the
 * server said, but don't let every blocked client return in the same instant.
 */
export const jitterAfter = (waitMs: number, random = Math.random) =>
  Math.round(waitMs + random() * Math.min(5000, Math.max(500, waitMs * 0.1)))

/** Turns a 429/503 into how long to wait and which limit was hit. Null for any other response. */
export function readRateLimit(
  response: unknown,
  attempt = 0,
  now = Date.now(),
  random = Math.random,
): RateLimitInfo | null {
  if (!isRateLimitResponse(response)) return null
  const { headers, status } = response
  const { resetMs, ...limits } = parseRateLimitHeaders(headers, now)
  const retryAfter = parseRetryAfter(getHeader(headers, "retry-after"), getHeader(headers, "date"), now)
  // Retry-After takes precedence over the RateLimit reset (draft-ietf-httpapi-ratelimit-headers).
  if (retryAfter !== null) return { status, waitMs: retryAfter, source: "retry-after", ...limits }
  if (resetMs !== undefined) return { status, waitMs: resetMs, source: "ratelimit", ...limits }
  return {
    status,
    waitMs: Math.max(1000, backoffDelay(attempt + 1, 1000, 60_000, random)),
    source: "backoff",
    ...limits,
  }
}
