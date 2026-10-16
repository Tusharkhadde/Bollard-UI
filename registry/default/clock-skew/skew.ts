/** A clock offset estimate: add `offset` to the device's Date.now() to get server time. */
export interface ClockOffset {
  /** Server time minus device time, in ms. Positive means the device is behind. */
  offset: number
  /** How far off the estimate itself can be, in ms (Date header resolution + half the round trip). */
  uncertainty: number
}

/**
 * NTP-style offset from one request. The Date header is truncated to whole
 * seconds, so the server's clock was somewhere in [date, date + 1s) when it
 * answered; a cached response is older by its Age header. The device clock is
 * read at send and receive, and the server is assumed to answer halfway.
 */
export function estimateClockOffset({
  sentAt,
  receivedAt,
  serverDate,
  ageSeconds = 0,
}: {
  /** Device Date.now() just before the request. */
  sentAt: number
  /** Device Date.now() when the headers arrived. */
  receivedAt: number
  /** The response's Date header (or any server timestamp in ms). */
  serverDate: string | number
  /** The response's Age header, when it came from a cache. */
  ageSeconds?: number
}): ClockOffset | null {
  const date = typeof serverDate === "number" ? serverDate : Date.parse(serverDate)
  if (!Number.isFinite(date)) return null
  const resolution = typeof serverDate === "number" ? 0 : 500
  const server = date + resolution + ageSeconds * 1000
  const rtt = Math.max(0, receivedAt - sentAt)
  return { offset: Math.round(server - (sentAt + receivedAt) / 2), uncertainty: Math.round(resolution + rtt / 2) }
}

/**
 * Measures the offset against a same-origin URL (cross-origin servers must send
 * `Access-Control-Expose-Headers: Date`). Takes a few samples and keeps the one
 * with the shortest round trip, which is the most trustworthy.
 */
export async function measureClockOffset(url: string, samples = 3): Promise<ClockOffset | null> {
  let best: ClockOffset | null = null
  for (let i = 0; i < samples; i++) {
    const sentAt = Date.now()
    const response = await fetch(url, { method: "HEAD", cache: "no-store" })
    const receivedAt = Date.now()
    const date = response.headers.get("date")
    if (!date) continue
    const estimate = estimateClockOffset({
      sentAt,
      receivedAt,
      serverDate: date,
      ageSeconds: Number(response.headers.get("age")) || 0,
    })
    if (estimate && (!best || estimate.uncertainty < best.uncertainty)) best = estimate
  }
  return best
}

/** Offsets this small are within the estimate's own error, so they're not reported. */
export const isSignificantSkew = (estimate: ClockOffset, threshold: number) =>
  Math.abs(estimate.offset) - estimate.uncertainty >= threshold

export type SkewSeverity = "none" | "minor" | "major"

/**
 * "minor" from one TOTP step (30s): authenticator codes start failing.
 * "major" from 5 minutes: the usual Kerberos/TLS tolerance, so secure sites and sign-in links break too.
 */
export function skewSeverity(estimate: ClockOffset, threshold = 30_000, major = 300_000): SkewSeverity {
  if (!isSignificantSkew(estimate, threshold)) return "none"
  return Math.abs(estimate.offset) >= major ? "major" : "minor"
}

/** 252_000 → "4 min 12 s", 7_380_000 → "2 h 3 min", 86_400_000 → "1 day". */
export function formatSkew(ms: number) {
  const s = Math.round(Math.abs(ms) / 1000)
  if (s >= 86_400) {
    const days = Math.round(s / 86_400)
    return `${days} ${days === 1 ? "day" : "days"}`
  }
  if (s >= 3600) return `${Math.floor(s / 3600)} h${s % 3600 >= 60 ? ` ${Math.floor((s % 3600) / 60)} min` : ""}`
  if (s >= 60) return `${Math.floor(s / 60)} min${s % 60 ? ` ${s % 60} s` : ""}`
  return `${s} s`
}

/** 252_000 → "4:12", 3_725_000 → "1:02:05". */
export function formatCountdown(ms: number) {
  const total = Math.max(0, Math.ceil(ms / 1000))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = String(total % 60).padStart(2, "0")
  return h ? `${h}:${String(m).padStart(2, "0")}:${s}` : `${m}:${s}`
}
