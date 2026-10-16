const DAY = 1440

export interface ParsedClock {
  /** Minutes after the start of the day; above 1440 for "26:00"-style next-day notation. */
  minutes: number
  /** How the meridiem was decided: typed am/pm, unmistakably 24-hour, or ambiguous (1–12 with no marker). */
  basis: "am" | "pm" | "24h" | "ambiguous"
}

/** Reads 9, 9:30, 930, 0930, 21:30, 9pm, 9.30 p.m., noon, midnight, 24:00 and 26:00. */
export function parseClock(raw: string): ParsedClock | null {
  const text = raw.trim().toLowerCase().replace(/\s+/g, "").replace(/\./g, ":").replace(/:(?=[ap])/, "")
  if (!text) return null
  if (text === "noon") return { minutes: 720, basis: "pm" }
  if (text === "midnight") return { minutes: 0, basis: "am" }
  const m = text.match(/^(\d{1,2})(?::?(\d{2}))?(a|p|am|pm|a:m|p:m)?$/)
  if (!m) return null
  const [, h, min = "00", mer] = m
  let hour = Number(h)
  const minute = Number(min)
  if (minute > 59) return null
  if (mer) {
    if (hour < 1 || hour > 12) return null
    const pm = mer.startsWith("p")
    hour = (hour % 12) + (pm ? 12 : 0)
    return { minutes: hour * 60 + minute, basis: pm ? "pm" : "am" }
  }
  if (hour > 47) return null
  // "9:00" and "10:00" could be either half of the day; "09:00", "0:30" and "17:00" are 24-hour.
  return { minutes: hour * 60 + minute, basis: hour >= 1 && hour <= 12 && h[0] !== "0" ? "ambiguous" : "24h" }
}

/** 22:00 → "10:00 PM" (or "22:00" with hour12 false); wraps next-day minutes. */
export function formatClock(minutes: number, hour12 = true) {
  const m = ((minutes % DAY) + DAY) % DAY
  const [h, mm] = [Math.floor(m / 60), String(m % 60).padStart(2, "0")]
  if (!hour12) return `${String(h).padStart(2, "0")}:${mm}`
  return `${h % 12 || 12}:${mm} ${h < 12 ? "AM" : "PM"}`
}

/** 450 → "7 h 30 min". */
export function formatLength(minutes: number) {
  const [h, m] = [Math.floor(minutes / 60), minutes % 60]
  return [h && `${h} h`, m && `${m} min`].filter(Boolean).join(" ") || "0 min"
}

export interface BreakRule {
  /** A shift longer than this many minutes needs a break... */
  afterMinutes: number
  /** ...of at least this many minutes. */
  minBreakMinutes: number
}

export type ShiftIssue =
  | { kind: "meridiem"; message: string; options: { field: "start" | "end"; minutes: number; length: number }[] }
  | { kind: "next-day-notation"; message: string; fixMinutes: number }
  | { kind: "zero" | "too-long" | "break-too-long"; message: string }
  | { kind: "break-in-hours" | "break-missing"; message: string; fixBreak: number }

export interface ShiftSummary {
  start: number
  end: number
  overnight: boolean
  lengthMinutes: number
  paidMinutes: number
  issues: ShiftIssue[]
}

/** Works out a shift's length across midnight and the slips that make it implausible. */
export function analyzeShift(
  start: ParsedClock,
  end: ParsedClock,
  breakMinutes: number,
  { maxMinutes = 12 * 60, breakRule }: { maxMinutes?: number; breakRule?: BreakRule | null } = {}
): ShiftSummary {
  const issues: ShiftIssue[] = []
  const s = start.minutes % DAY
  const e = end.minutes % DAY
  if (end.minutes >= DAY) issues.push({ kind: "next-day-notation", message: `${Math.floor(end.minutes / 60)}:${String(end.minutes % 60).padStart(2, "0")} means ${formatClock(e)} the next day.`, fixMinutes: e })
  const length = (e - s + DAY) % DAY
  if (length === 0) issues.push({ kind: "zero", message: "Start and end are the same time, so this shift is 0 h long." })
  else if (length > maxMinutes) {
    // 9:00–5:00 read as 20 h: the 12-hour slip is the likelier story when it gives a normal shift.
    // "10–6" may be a day shift ending 6 PM or a night shift starting 10 PM, so offer each reading that works.
    const options = (["end", "start"] as const).flatMap((field) => {
      const p = field === "end" ? end : start
      if (p.basis !== "ambiguous") return []
      const minutes = (p.minutes + 720) % DAY
      const alt = field === "end" ? (minutes - s + DAY) % DAY : (e - minutes + DAY) % DAY
      return alt > 0 && alt <= maxMinutes ? [{ field, minutes, length: alt }] : []
    })
    if (options.length) issues.push({ kind: "meridiem", message: `That reads as a ${formatLength(length)} shift. Did you mean`, options })
    else issues.push({ kind: "too-long", message: `${formatLength(length)} is longer than the ${formatLength(maxMinutes)} a shift usually runs.` })
  }
  if (length && breakMinutes >= length) issues.push({ kind: "break-too-long", message: "The break is as long as the whole shift." })
  else if (length >= 240 && breakMinutes > 0 && breakMinutes <= 4 && breakMinutes * 60 < length)
    issues.push({ kind: "break-in-hours", message: `A ${breakMinutes} min break? Did you mean ${breakMinutes} h?`, fixBreak: breakMinutes * 60 })
  else if (breakRule && length > breakRule.afterMinutes && breakMinutes < breakRule.minBreakMinutes)
    issues.push({ kind: "break-missing", message: `Shifts over ${formatLength(breakRule.afterMinutes)} need a ${formatLength(breakRule.minBreakMinutes)} break.`, fixBreak: breakRule.minBreakMinutes })
  return { start: s, end: e, overnight: e < s, lengthMinutes: length, paidMinutes: Math.max(0, length - breakMinutes), issues }
}
