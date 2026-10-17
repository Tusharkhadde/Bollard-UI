// Bollard UI — epoch-input · MIT licence · https://bollard-ui.vercel.app/components/epoch-input

/**
 * Unix timestamps and date strings, read the way code reads them. Sources:
 * ECMAScript date-time string format (date-only = UTC, date-time without an
 * offset = local time; https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date/parse),
 * Excel's 1900 date system (serial 1 = 1 Jan 1900, with the phantom 29 Feb 1900),
 * Windows FILETIME (100 ns ticks since 1601) and .NET ticks (100 ns since year 1).
 */

import { tzOffset } from "@date-fns/tz"

export type EpochUnit = "s" | "ms" | "us" | "ns"
export type ReadingKind = "epoch" | "excel" | "filetime" | "ticks" | "iso"

export interface TimestampReading {
  kind: ReadingKind
  /** The instant, in milliseconds since 1970-01-01T00:00:00Z. */
  ms: number
  /** For epoch numbers, the unit it was read in. */
  unit?: EpochUnit
  /** The cleaned number or string that was read. */
  source: string
  /** ISO date-time with no Z or offset (read as local by JavaScript, as UTC by most servers). */
  noOffset?: boolean
  /** Date-only ISO string (read as UTC midnight). */
  dateOnly?: boolean
  /** Wall-clock parts of an offset-less ISO string, for re-reading it in another zone. */
  wall?: [number, number, number, number, number, number, number]
}

export type TimestampIssueKind = "invalid" | "impossible-date" | "implausible" | "wrong-unit" | "excel" | "filetime" | "ticks" | "no-offset" | "date-only" | "y2038" | "cleaned" | "near-1970"
export interface TimestampIssue {
  kind: TimestampIssueKind
  severity: "error" | "warning" | "info"
  detail: Record<string, string>
  fixes: { label: string; detail?: Record<string, string>; next: string }[]
}

export interface TimestampOptions {
  /** The unit the field stores. When set, a value in another unit is flagged with a one-tap conversion. */
  unit?: EpochUnit
  /** Years a real value falls in. Defaults to 1970–2100. */
  range?: [number, number]
  /** Flag values a signed 32-bit time can't hold (MySQL TIMESTAMP, older time_t): after 19 Jan 2038 03:14:07 UTC. */
  int32?: boolean
  /** Time zone for readbacks and the "it's local time" fix. Defaults to UTC. */
  timeZone?: string
  /** Clock used to pick the likeliest unit, in ms. */
  now?: number
}

const PER_MS: Record<EpochUnit, number> = { s: 1 / 1000, ms: 1, us: 1000, ns: 1_000_000 }
const UNIT_ORDER: EpochUnit[] = ["s", "ms", "us", "ns"]
const EXCEL_EPOCH = Date.UTC(1899, 11, 30)
const FILETIME_EPOCH = Date.UTC(1601, 0, 1)
const TICKS_EPOCH = -62135596800000
const INT32_MAX = 2147483647

/** Removes digit separators, quotes, a trailing n or L, BOM, CR/LF and surrounding spaces. */
export function cleanTimestamp(raw: string): string {
  const text = String(raw ?? "").replace(/^\uFEFF/, "").replace(/[\r\n]+/g, " ").trim().replace(/^(["'`])(.*)\1$/, "$2").trim()
  return /^[+-]?[\d_, ]+(?:\.\d+)?[nL]?$/.test(text) && /\d/.test(text) ? text.replace(/[_, ]/g, "").replace(/[nL]$/, "") : text
}

const yearOf = (ms: number) => new Date(ms).getUTCFullYear()
const finite = (ms: number) => Number.isFinite(ms) && Math.abs(ms) <= 8.64e15

/** Converts an instant to an epoch number in `unit`, as a string with no exponent. */
export function toUnit(ms: number, unit: EpochUnit): string {
  if (unit === "s") return Number.isInteger(ms / 1000) ? String(ms / 1000) : String(Math.floor(ms / 1000))
  if (unit === "ms") return String(Math.round(ms))
  return (BigInt(Math.round(ms)) * BigInt(PER_MS[unit])).toString()
}

/** Reads a number in every unit (and as Excel, FILETIME and .NET ticks) and keeps the reading nearest to now. */
export function readNumber(text: string, range: [number, number] = [1970, 2100], now = Date.UTC(2026, 0, 1)): TimestampReading | null {
  if (!/^[+-]?\d+(?:\.\d+)?$/.test(text)) return null
  const integer = /^[+-]?\d+$/.test(text)
  const big = integer ? BigInt(text) : null
  const value = Number(text)
  // Sub-millisecond units only make sense for values with enough digits to carry them.
  const units = Math.abs(value) >= 1e12 ? UNIT_ORDER : UNIT_ORDER.slice(0, 2)
  const readings: TimestampReading[] = units.map((unit) => ({
    kind: "epoch" as const,
    unit,
    source: text,
    ms: big !== null && unit !== "s" && unit !== "ms" ? Number(big / BigInt(PER_MS[unit])) : value / PER_MS[unit],
  }))
  if (value > 0 && value < 2958466) readings.push({ kind: "excel", source: text, ms: excelToMs(value) })
  if (big !== null && big > 0n) {
    readings.push({ kind: "filetime", source: text, ms: Number(big / 10000n) + FILETIME_EPOCH })
    readings.push({ kind: "ticks", source: text, ms: Number(big / 10000n) + TICKS_EPOCH })
  }
  const plausible = readings.filter((reading) => finite(reading.ms) && yearOf(reading.ms) >= range[0] && yearOf(reading.ms) <= range[1])
  if (!plausible.length) return null
  // Landing in 1970 is the signature of a unit mix-up, so those readings only count when nothing else fits.
  let pool = plausible.filter((reading) => yearOf(reading.ms) > 1970)
  if (!pool.length) pool = plausible
  // A plain epoch reading within 30 years of now wins; only otherwise do Excel, FILETIME and .NET ticks get a say.
  const near = (reading: TimestampReading) => Math.abs(reading.ms - now) < 30 * 365.25 * 86_400_000
  const epochs = pool.filter((reading) => reading.kind === "epoch" && near(reading))
  if (epochs.length) pool = epochs
  return pool.reduce((best, reading) => (Math.abs(reading.ms - now) < Math.abs(best.ms - now) ? reading : best))
}

/** Excel / Google Sheets serial day number to an instant (1900 system, honouring the phantom 29 Feb 1900). */
export function excelToMs(serial: number): number {
  const days = serial < 60 ? serial + 1 : serial
  return EXCEL_EPOCH + days * 86_400_000
}

// ECMAScript Date Time String Format: YYYY-MM or YYYY-MM-DD (or ±YYYYYY expanded years), optionally THH:mm[:ss[.sss]] and Z or ±HH:mm.
// A bare YYYY is a valid date-only form too, but in a timestamp field it's read as a number and flagged instead.
const ISO = /^([+-]\d{6}|\d{4})-(\d{2})(?:-(\d{2}))?(?:[T ](\d{2}):(\d{2})(?::(\d{2})(?:[.,](\d{1,9}))?)?(Z|[+-]\d{2}:?\d{2})?)?$/i

/** Date.UTC that keeps years 0–99 as written instead of mapping them to 1900–1999. */
function utc(y: number, mo: number, d: number, h = 0, mi = 0, s = 0, ms = 0) {
  const date = new Date(Date.UTC(2000, mo, d, h, mi, s, ms))
  date.setUTCFullYear(y + date.getUTCFullYear() - 2000)
  return date.getTime()
}

/** Reads an ISO 8601 string, validating the calendar date instead of letting it roll over (2026-02-30 → 2 Mar). */
export function readIso(text: string): TimestampReading | "impossible" | null {
  const match = ISO.exec(text)
  if (!match) return null
  const [, y, mo, d = "01", h, mi, s = "0", fraction = "0", zone] = match
  // The spec calls -000000 invalid: year zero is written +000000.
  if (y === "-000000") return null
  const parts = [Number(y), Number(mo), Number(d), Number(h ?? 0), Number(mi ?? 0), Number(s), Number(fraction.padEnd(3, "0").slice(0, 3))] as [number, number, number, number, number, number, number]
  const check = new Date(utc(parts[0], parts[1] - 1, parts[2]))
  // 24:00 is the midnight that ends the day, so it's allowed only with zero minutes, seconds and fraction.
  const endOfDay = parts[3] === 24 && !parts[4] && !parts[5] && !Number(fraction)
  if (check.getUTCMonth() !== parts[1] - 1 || check.getUTCDate() !== parts[2] || (parts[3] > 23 && !endOfDay) || parts[4] > 59 || parts[5] > 59) return "impossible"
  const wallMs = utc(parts[0], parts[1] - 1, parts[2], parts[3], parts[4], parts[5], parts[6])
  if (h === undefined) return { kind: "iso", ms: wallMs, source: text, dateOnly: true }
  if (!zone) return { kind: "iso", ms: wallMs, source: text, noOffset: true, wall: parts }
  const offset = zone.toUpperCase() === "Z" ? 0 : (zone[0] === "-" ? -1 : 1) * (Number(zone.slice(1, 3)) * 60 + Number(zone.slice(-2))) * 60_000
  return { kind: "iso", ms: wallMs - offset, source: text }
}

/** Offset of `timeZone` from UTC at `ms`, in ms (IST is +19,800,000), via @date-fns/tz. 0 for an unknown zone. */
export function zoneOffset(ms: number, timeZone = "UTC"): number {
  if (!Number.isFinite(ms)) return 0
  const minutes = tzOffset(timeZone, new Date(ms))
  return Number.isFinite(minutes) ? minutes * 60_000 : 0
}

/** "+05:30" for an offset in ms. */
export function formatOffset(offset: number): string {
  const minutes = Math.round(Math.abs(offset) / 60_000)
  return `${offset < 0 ? "-" : "+"}${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`
}

/** The instant a wall-clock time means in `timeZone`. */
export function wallToInstant(wallMs: number, timeZone: string): number {
  let guess = wallMs - zoneOffset(wallMs, timeZone)
  guess = wallMs - zoneOffset(guess, timeZone)
  return guess
}

/** Reads a timestamp or date string, or returns null for garbage. */
export function readTimestamp(raw: string, options: TimestampOptions = {}): TimestampReading | null {
  const text = cleanTimestamp(raw)
  if (!text) return null
  const iso = readIso(text)
  if (iso && iso !== "impossible") return iso
  if (iso === "impossible") return null
  return readNumber(text, options.range, options.now)
}

const UNIT_WORDS: Record<EpochUnit, string> = { s: "seconds", ms: "milliseconds", us: "microseconds", ns: "nanoseconds" }

/** Checks a timestamp field's text and returns every problem, most serious first. */
export function checkTimestamp(raw: string, options: TimestampOptions = {}, describe: (ms: number) => string = (ms) => new Date(ms).toISOString()): TimestampIssue[] {
  const text = String(raw ?? "")
  const clean = cleanTimestamp(text)
  if (!clean) return []
  const issues: TimestampIssue[] = []
  const range = options.range ?? [1970, 2100]
  const zone = options.timeZone ?? "UTC"
  const target = options.unit ?? "s"
  const iso = readIso(clean)
  if (iso === "impossible") return [{ kind: "impossible-date", severity: "error", detail: { value: clean }, fixes: [] }]
  const reading = readTimestamp(clean, options)
  if (!reading) {
    const numeric = /^[+-]?\d+(?:\.\d+)?$/.test(clean)
    return [{ kind: numeric ? "implausible" : "invalid", severity: "error", detail: { value: clean, min: String(range[0]), max: String(range[1]) }, fixes: [] }]
  }
  if (clean !== text.trim() && /^[+-]?\d/.test(clean)) issues.push({ kind: "cleaned", severity: "info", detail: { value: clean }, fixes: [{ label: "fix-clean", next: clean }] })
  if (reading.kind === "epoch" && options.unit && reading.unit !== options.unit) {
    const wrongMs = Number(reading.source) / PER_MS[options.unit]
    issues.push({ kind: "wrong-unit", severity: "error", detail: { found: UNIT_WORDS[reading.unit as EpochUnit], expected: UNIT_WORDS[options.unit], asIs: finite(wrongMs) ? describe(wrongMs) : "" }, fixes: [{ label: "fix-convert", detail: { value: toUnit(reading.ms, options.unit) }, next: toUnit(reading.ms, options.unit) }] })
  }
  if (reading.kind === "excel" || reading.kind === "filetime" || reading.kind === "ticks") {
    issues.push({ kind: reading.kind, severity: "warning", detail: { value: reading.source, date: describe(reading.ms) }, fixes: [{ label: "fix-convert", detail: { value: toUnit(reading.ms, target) }, next: toUnit(reading.ms, target) }] })
  }
  if (reading.noOffset && reading.wall) {
    const [y, mo, d, h, mi, s, msPart] = reading.wall
    const wallMs = utc(y, mo - 1, d, h, mi, s, msPart)
    const local = wallToInstant(wallMs, zone)
    const offset = formatOffset(wallMs - local)
    issues.push({
      kind: "no-offset",
      severity: "warning",
      detail: { utc: describe(wallMs), zone, offset },
      fixes: [
        { label: "fix-utc", next: `${clean}Z` },
        ...(wallMs !== local ? [{ label: "fix-local", detail: { zone, offset }, next: `${clean}${offset}` }] : []),
      ],
    })
  }
  if (reading.dateOnly && zoneOffset(reading.ms, zone) !== 0) issues.push({ kind: "date-only", severity: "info", detail: { local: describe(reading.ms), zone }, fixes: [] })
  const seconds = Math.floor(reading.ms / 1000)
  // Readings that land moments after 1 Jan 1970 are almost always a year, a compact date or the wrong unit.
  if (reading.kind === "epoch" && yearOf(reading.ms) === 1970 && Number(reading.source) !== 0) {
    const compact = /^(\d{4})(\d{2})(\d{2})$/.exec(clean)
    const asDate = compact ? `${compact[1]}-${compact[2]}-${compact[3]}` : /^\d{4}$/.test(clean) && Number(clean) >= range[0] ? `${clean}-01-01` : ""
    const valid = asDate && readIso(asDate)
    issues.push({ kind: "near-1970", severity: "warning", detail: { value: clean, date: describe(reading.ms) }, fixes: valid && valid !== "impossible" ? [{ label: "fix-convert", detail: { value: asDate }, next: asDate }] : [] })
  }
  if (options.int32 && (seconds > INT32_MAX || seconds < -INT32_MAX - 1)) issues.push({ kind: "y2038", severity: "error", detail: {}, fixes: [] })
  const order = { error: 0, warning: 1, info: 2 }
  return issues.sort((a, b) => order[a.severity] - order[b.severity])
}
