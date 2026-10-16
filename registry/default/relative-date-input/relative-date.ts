/**
 * Reads everyday date phrases ("next Fri", "in 2 weeks", "the 15th", "15 Oct") against a given
 * today, with date-fns, and returns every date the phrase can honestly mean. Two readings mean the
 * phrase is ambiguous and the user must choose: "next Friday" said on a Wednesday is this week's
 * Friday to some people and next week's to others (see the BBC Learning English note on next/this,
 * and Microsoft Research's study of time expressions, which found "next weekend" bimodal early in
 * the week). Pure and server-safe.
 */
import {
  addDays,
  addMonths,
  addWeeks,
  addYears,
  format,
  getDate,
  getDaysInMonth,
  isSameWeek,
  isValid,
  lastDayOfMonth,
  setDate,
  startOfWeek,
  subDays,
} from "date-fns"

export type Day = 0 | 1 | 2 | 3 | 4 | 5 | 6

export interface DateReading {
  /** Local midnight of the date meant. */
  date: Date
  /** Why this reading: "this-week", "next-week", "this-month", "next-month", "this-year", "next-year", "today", "in-a-week", "exact". */
  basis: string
}

export interface RelativeDateResult {
  /** One reading, or two when the phrase is ambiguous. Empty when it can't be read. */
  readings: DateReading[]
  /** Set when the text is an all-number date like 05/06 that reads two ways by country. */
  numeric?: boolean
}

export interface RelativeDateOptions {
  /** First day of the week: 1 = Monday (ISO, most of the world), 0 = Sunday (US, India). */
  weekStartsOn?: Day
  /** Only future (bookings, deadlines) or only past (expenses) dates make sense here. */
  expect?: "future" | "past"
}

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"]
const NUMBERS: Record<string, number> = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12 }

const FULL_DAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"]
/** "fri", "Thurs.", "tues", "weds" → 0–6, or -1. */
const weekdayOf = (word: string) => {
  const w = word.replace(/\.$/, "").replace(/^weds$/, "wed")
  return w.length >= 3 ? FULL_DAYS.findIndex((d) => d.startsWith(w)) : -1
}
const monthOf = (word: string) => (word.length >= 3 ? MONTHS.findIndex((m) => word.startsWith(m)) : -1)

/** `YYYY-MM-DD` for a local date. */
export const toIsoDay = (date: Date) => format(date, "yyyy-MM-dd")

/** Local midnight for `YYYY-MM-DD`, or null when it isn't a real date. */
export function fromIsoDay(iso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso ?? "").trim())
  if (!m) return null
  const date = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  return isValid(date) && date.getDate() === Number(m[3]) && date.getMonth() === Number(m[2]) - 1 ? date : null
}

/** The `day` of the month after `from`'s month, skipping months too short to have it (31st). */
function dayInMonth(from: Date, day: number, monthsAhead: number): Date | null {
  for (let i = monthsAhead; i < monthsAhead + 12; i++) {
    const month = addMonths(setDate(from, 1), i)
    if (day <= getDaysInMonth(month)) return setDate(month, day)
  }
  return null
}

const one = (date: Date, basis = "exact"): RelativeDateResult => ({ readings: [{ date, basis }] })
const two = (a: DateReading, b: DateReading): RelativeDateResult => ({ readings: [a, b] })

/** Picks one of two readings when `expect` rules the other out. */
function narrow(result: RelativeDateResult, today: Date, expect?: "future" | "past"): RelativeDateResult {
  if (!expect || result.readings.length < 2) return result
  const kept = result.readings.filter((r) => (expect === "future" ? r.date >= today : r.date <= today))
  return kept.length === 1 ? { readings: kept } : result
}

/** Reads a date phrase. Returns every honest reading; the caller asks when there are two. */
export function readRelativeDate(raw: string, today: Date, options: RelativeDateOptions = {}): RelativeDateResult {
  const weekStartsOn = options.weekStartsOn ?? 1
  const t = String(raw ?? "")
    .replace(/^\uFEFF/, "")
    .toLowerCase()
    .replace(/[,.!?]+$/g, "")
    .replace(/\s+/g, " ")
    .trim()
  if (!t || t.length > 60 || !isValid(today)) return { readings: [] }
  const sameWeek = (d: Date) => isSameWeek(d, today, { weekStartsOn })
  const result = (r: RelativeDateResult) => narrow(r, today, options.expect)

  const iso = fromIsoDay(t)
  if (iso) return one(iso)
  if (/^\d{1,2}[/.-]\d{1,2}(?:[/.-]\d{2,4})?$/.test(t)) return { readings: [], numeric: true }

  const fixed: Record<string, number> = { today: 0, tdy: 0, tonight: 0, tomorrow: 1, tmrw: 1, tmr: 1, tomorow: 1, yesterday: -1, "day after tomorrow": 2, "day before yesterday": -2 }
  if (t in fixed) return one(addDays(today, fixed[t]), "today")

  let m = /^(?:in )?(\d{1,3}|a|an|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve) (day|week|month|year)s?(?: (from now|later|time|ago))?$/.exec(t)
  if (m && (t.startsWith("in ") || m[3])) {
    const n = (NUMBERS[m[1]] ?? Number(m[1])) * (m[3] === "ago" ? -1 : 1)
    const add = { day: addDays, week: addWeeks, month: addMonths, year: addYears }[m[2] as "day"]
    return one(add(today, n))
  }

  if (/^(?:end of (?:the )?month|eom)$/.test(t)) return one(lastDayOfMonth(today))

  m = /^(this|next|last|coming|this coming)? ?weekend$/.exec(t)
  if (m) {
    const day = today.getDay()
    const saturday = addDays(today, (6 - day + 7) % 7)
    if (m[1] === "next") {
      // Said Monday to Friday, "next weekend" splits listeners between the coming one and the one after.
      return day >= 1 && day <= 5 ? result(two({ date: saturday, basis: "this-week" }, { date: addWeeks(saturday, 1), basis: "next-week" })) : one(day === 6 ? addWeeks(today, 1) : saturday, "next-week")
    }
    if (m[1] === "last") return one(subDays(day === 0 ? today : saturday, day === 0 ? 1 + 7 : 7), "last-week")
    return one(day === 0 ? today : saturday, "this-week")
  }

  m = /^(?:on )?(this coming|coming|this|next|last)? ?([a-z]+\.?)(?: (next week|this week|week|after next))?$/.exec(t)
  const weekday = m ? weekdayOf(m[2]) : -1
  if (m && weekday >= 0) {
    const [, which, , tail] = m
    const ahead = (weekday - today.getDay() + 7) % 7
    const coming = addDays(today, ahead || 7)
    const previous = subDays(today, (today.getDay() - weekday + 7) % 7 || 7)
    const inWeek = (offset: number) => addDays(startOfWeek(addWeeks(today, offset), { weekStartsOn }), (weekday - weekStartsOn + 7) % 7)
    if (tail === "next week") return one(inWeek(1), "next-week")
    if (tail === "this week") return one(inWeek(0), "this-week")
    if (tail === "week" || tail === "after next") return one(addWeeks(coming, 1), "next-week")
    if (which === "coming" || which === "this coming") return one(coming, sameWeek(coming) ? "this-week" : "next-week")
    if (which === "next") {
      return sameWeek(coming) ? result(two({ date: coming, basis: "this-week" }, { date: addWeeks(coming, 1), basis: "next-week" })) : one(coming, "next-week")
    }
    if (which === "last") {
      return sameWeek(previous) ? result(two({ date: previous, basis: "this-week" }, { date: subDays(previous, 7), basis: "last-week" })) : one(previous, "last-week")
    }
    if (which === "this") {
      const thisOne = inWeek(0)
      return thisOne < today ? result(two({ date: thisOne, basis: "this-week" }, { date: coming, basis: "next-week" })) : one(thisOne, "this-week")
    }
    if (ahead === 0) return result(two({ date: today, basis: "today" }, { date: addWeeks(today, 1), basis: "in-a-week" }))
    return options.expect === "past" ? one(previous, "last-week") : one(coming, sameWeek(coming) ? "this-week" : "next-week")
  }

  // "the 15th" or "15th" (a bare "15" could be anything).
  m = /^(?:on )?(the )?(\d{1,2})(st|nd|rd|th)?$/.exec(t)
  if (m && (m[1] || m[3] || t.startsWith("on ")) && Number(m[2]) >= 1 && Number(m[2]) <= 31) {
    const day = Number(m[2])
    const thisMonth = day <= getDaysInMonth(today) ? setDate(today, day) : null
    const nextMonth = dayInMonth(today, day, 1)
    if (thisMonth && getDate(thisMonth) >= getDate(today)) return one(thisMonth, "this-month")
    if (!nextMonth) return { readings: [] }
    if (!thisMonth) return one(nextMonth, "next-month")
    return result(two({ date: thisMonth, basis: "this-month" }, { date: nextMonth, basis: "next-month" }))
  }

  m = /^(?:(?:mon|tue|wed|thu|fri|sat|sun)[a-z]*\.?,? )?(?:on )?(?:the )?(?:(\d{1,2})(?:st|nd|rd|th)? (?:of )?([a-z]+\.?)|([a-z]+\.?) (\d{1,2})(?:st|nd|rd|th)?)(?:,? (\d{4}))?$/.exec(t)
  if (m) {
    const day = Number(m[1] ?? m[4])
    const month = monthOf((m[2] ?? m[3]).replace(/\.$/, ""))
    if (month < 0 || day < 1) return { readings: [] }
    const at = (year: number) => {
      const d = new Date(year, month, day)
      return d.getMonth() === month ? d : null
    }
    if (m[5]) {
      const d = at(Number(m[5]))
      return d ? one(d) : { readings: [] }
    }
    const thisYear = at(today.getFullYear())
    const nextYear = at(today.getFullYear() + 1)
    if (thisYear && thisYear >= today) return one(thisYear, "this-year")
    if (thisYear && nextYear) return result(two({ date: thisYear, basis: "this-year" }, { date: nextYear, basis: "next-year" }))
    // 29 Feb: the next year that has one.
    for (let year = today.getFullYear() + (thisYear ? 1 : 0); year <= today.getFullYear() + 8; year++) {
      const d = at(year)
      if (d && d >= today) return one(d, year === today.getFullYear() ? "this-year" : "next-year")
    }
    return { readings: [] }
  }

  return { readings: [] }
}
