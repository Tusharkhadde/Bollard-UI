// Bollard UI — duration-input · MIT licence · https://bollard-ui.vercel.app/components/duration-input

/** Unit for a bare number such as "90". */
export type DurationUnit = "d" | "h" | "m" | "s"
/** How "1:30" is read: hours and minutes, minutes and seconds, or decided from the limits (asking when both fit). */
export type ColonMode = "auto" | "h:mm" | "m:ss"

export interface DurationOptions {
  /** Unit of a bare number. */
  unit?: DurationUnit
  colon?: ColonMode
  /** Smallest allowed duration in seconds. */
  min?: number
  /** Largest allowed duration in seconds. */
  max?: number
  /** Hours in a "day" (8 for work-day estimates, as Jira does). */
  hoursPerDay?: number
}

export type DurationResult =
  | { kind: "empty" }
  | { kind: "error" }
  /** "1:30" where both readings fit: seconds for h:mm and for m:ss. */
  | { kind: "ambiguous"; hm: number; ms: number }
  | {
      kind: "ok"
      seconds: number
      /** Typed as decimal hours, e.g. "1.50": the reading where the decimals were minutes ("1 h 50 min"). */
      clockMinutes?: number
      /** Decimal hours that are correct but often misread, e.g. "1.5h", for a quiet note. */
      decimal?: boolean
    }

const UNIT_SECONDS = { d: 86400, h: 3600, m: 60, s: 1 }
const SMALLER: Record<DurationUnit, DurationUnit> = { d: "h", h: "m", m: "s", s: "s" }
const TOKEN = /^(\d+(?:\.\d+)?|\.\d+)\s*(days?|d|hours?|hrs?|h|minutes?|mins?|m|seconds?|secs?|s)?\s*(?:and\s*|,\s*)?/

const unitOf = (word: string): DurationUnit => (word[0] as DurationUnit)
const inRange = (s: number, { min = 0, max = Infinity }: DurationOptions) => s >= min && s <= max

/**
 * Parses "1h30", "90m", "1.5h", "1:30", "2d 4h", "1 hour 30 minutes" or ISO "PT1H30M" into seconds.
 * Flags decimal hours that look like clock minutes ("1.50" as 1 h 50 min) and a "1:30" that could be
 * h:mm or m:ss when the limits don't settle it.
 */
export function parseDuration(text: string, options: DurationOptions = {}): DurationResult {
  const { unit = "m", colon = "auto", hoursPerDay = 24 } = options
  const size = (u: DurationUnit) => (u === "d" ? hoursPerDay * 3600 : UNIT_SECONDS[u])
  const raw = text.trim().toLowerCase().replace(/(\d),(\d)/g, "$1.$2")
  if (!raw) return { kind: "empty" }

  const iso = raw.match(/^p(?:(\d+(?:\.\d+)?)d)?(?:t(?:(\d+(?:\.\d+)?)h)?(?:(\d+(?:\.\d+)?)m)?(?:(\d+(?:\.\d+)?)s)?)?$/)
  if (iso && raw !== "p") {
    const [d, h, m, s] = iso.slice(1).map((n) => Number(n ?? 0))
    return { kind: "ok", seconds: Math.round(d * size("d") + h * 3600 + m * 60 + s) }
  }

  const clock = raw.match(/^(\d+):(\d{1,2})(?::(\d{1,2}))?$/)
  if (clock) {
    const [a, b, c] = clock.slice(1).map(Number)
    if (b > 59 || (clock[3] && c > 59)) return { kind: "error" }
    if (clock[3]) return { kind: "ok", seconds: a * 3600 + b * 60 + c }
    const hm = a * 3600 + b * 60
    const ms = a * 60 + b
    if (colon === "h:mm") return { kind: "ok", seconds: hm }
    if (colon === "m:ss") return { kind: "ok", seconds: ms }
    if (inRange(hm, options) !== inRange(ms, options)) return { kind: "ok", seconds: inRange(hm, options) ? hm : ms }
    return { kind: "ambiguous", hm, ms }
  }

  let rest = raw
  let seconds = 0
  let last: DurationUnit | undefined
  let count = 0
  let clockMinutes: number | undefined
  let decimal = false
  while (rest) {
    const match = rest.match(TOKEN)
    if (!match) return { kind: "error" }
    const [whole, number, word] = match
    // "1h30": a trailing bare number takes the next unit down; a lone bare number takes `unit`.
    const u = word ? unitOf(word) : last ? SMALLER[last] : unit
    if (!word && last && whole.length !== rest.length) return { kind: "error" }
    const fraction = number.split(".")[1]
    if (u === "h" && fraction) {
      const asMinutes = Number(fraction)
      if (fraction.length === 2 && asMinutes >= 10 && asMinutes < 60 && asMinutes !== 25 && asMinutes !== 75) {
        clockMinutes = Math.floor(Number(number)) * 3600 + asMinutes * 60
      } else decimal = true
    }
    seconds += Number(number) * size(u)
    last = u
    count++
    rest = rest.slice(whole.length)
  }
  if (clockMinutes !== undefined && count > 1) clockMinutes = undefined
  return { kind: "ok", seconds: Math.round(seconds), clockMinutes, decimal }
}

const NAMES: Record<DurationUnit, [string, string]> = { d: ["day", "days"], h: ["hour", "hours"], m: ["minute", "minutes"], s: ["second", "seconds"] }

/** Splits seconds into days, hours, minutes and seconds (days only when `hoursPerDay` is set). */
function parts(seconds: number, hoursPerDay?: number) {
  const out: [number, DurationUnit][] = []
  let rest = Math.round(seconds)
  for (const u of ["d", "h", "m", "s"] as DurationUnit[]) {
    const step = u === "d" ? (hoursPerDay ?? 0) * 3600 : UNIT_SECONDS[u]
    if (!step) continue
    const n = Math.floor(rest / step)
    rest -= n * step
    if (n) out.push([n, u])
  }
  return out
}

/** "1 hour 30 minutes". Days appear only when `hoursPerDay` is given. */
export function formatDuration(seconds: number, hoursPerDay?: number) {
  const list = parts(seconds, hoursPerDay)
  if (!list.length) return "0 minutes"
  return list.map(([n, u]) => `${n} ${NAMES[u][n === 1 ? 0 : 1]}`).join(" ")
}

/** "1h 30m": compact and unambiguous, used when a fix rewrites the field. */
export function compactDuration(seconds: number, hoursPerDay?: number) {
  return parts(seconds, hoursPerDay).map(([n, u]) => `${n}${u}`).join(" ") || "0m"
}
