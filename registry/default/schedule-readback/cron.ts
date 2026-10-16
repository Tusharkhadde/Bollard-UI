/** A 5-field cron expression (minute hour day-of-month month day-of-week), Vixie/POSIX semantics. */
export interface CronSchedule {
  /** The five fields as written (macros like @daily are expanded). */
  fields: [string, string, string, string, string]
  minutes: number[]
  hours: number[]
  days: number[]
  months: number[]
  weekdays: number[]
  /** Vixie cron: a day field that starts with "*" is unrestricted, even "*\/2". */
  domStar: boolean
  dowStar: boolean
}

export type CronResult = { ok: true; schedule: CronSchedule } | { ok: false; field?: number; error: string }

const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"]
const DAYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"]
export const FIELD_NAMES = ["Minute", "Hour", "Day of month", "Month", "Day of week"]
const LIMITS: [number, number][] = [[0, 59], [0, 23], [1, 31], [1, 12], [0, 7]]
const MACROS: Record<string, string> = {
  "@yearly": "0 0 1 1 *", "@annually": "0 0 1 1 *", "@monthly": "0 0 1 * *",
  "@weekly": "0 0 * * 0", "@daily": "0 0 * * *", "@midnight": "0 0 * * *", "@hourly": "0 * * * *",
}
/** Days in each month of a leap year: the most a month can ever have. */
export const MAX_DAYS = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]

function parseField(text: string, index: number): number[] | string {
  const [min, max] = LIMITS[index]
  const names = index === 3 ? MONTHS : index === 4 ? DAYS : null
  const name = FIELD_NAMES[index]
  const atom = (token: string) => {
    const named = names?.indexOf(token.toUpperCase()) ?? -1
    if (named >= 0) return named + (index === 3 ? 1 : 0)
    if (!/^\d+$/.test(token)) return NaN
    return Number(token)
  }
  const values = new Set<number>()
  for (const part of text.split(",")) {
    const match = /^([^/-]+)(?:-([^/]+))?(?:\/(\d+))?$/.exec(part)
    if (!match) return `${name}: "${part}" isn't a number, range or step.`
    const [, from, to, stepText] = match
    const step = stepText === undefined ? 1 : Number(stepText)
    if (step < 1) return `${name}: a step must be 1 or more.`
    const start = from === "*" ? min : atom(from)
    const end = from === "*" || (stepText && !to) ? max : to === undefined ? start : atom(to)
    for (const value of [start, end]) {
      if (Number.isNaN(value)) return `${name}: "${part}" isn't a number${names ? " or name" : ""}.`
      if (value < min || value > max) return `${name} must be ${min}–${index === 4 ? 6 : max}, got ${value}.`
    }
    if (end < start) return `${name}: range ${part} runs backwards.`
    for (let v = start; v <= end; v += step) values.add(index === 4 && v === 7 ? 0 : v)
  }
  return [...values].sort((a, b) => a - b)
}

/** Parses a 5-field cron expression or a macro (@daily, @hourly…). Errors name the field. */
export function parseCron(expression: string): CronResult {
  const trimmed = expression.trim().replace(/\s+/g, " ")
  if (trimmed === "@reboot") return { ok: false, error: "@reboot runs at startup, not on a schedule." }
  const text = MACROS[trimmed.toLowerCase()] ?? trimmed
  const parts = text.split(" ")
  if (!text) return { ok: false, error: "Enter five fields: minute hour day month weekday." }
  if (parts.length !== 5) {
    return { ok: false, error: `Cron needs 5 fields, this has ${parts.length}.${parts.length === 6 ? " Seconds aren't supported." : ""}` }
  }
  const sets: number[][] = []
  for (let i = 0; i < 5; i++) {
    const result = parseField(parts[i], i)
    if (typeof result === "string") return { ok: false, field: i, error: result }
    sets.push(result)
  }
  const [minutes, hours, days, months, weekdays] = sets
  const fields = parts as CronSchedule["fields"]
  return { ok: true, schedule: { fields, minutes, hours, days, months, weekdays, domStar: fields[2].startsWith("*"), dowStar: fields[4].startsWith("*") } }
}

/** True when the calendar day (month 1–12, weekday 0–6) is a run day. Both day fields restricted means OR. */
function dayMatches(s: CronSchedule, month: number, day: number, weekday: number) {
  if (!s.months.includes(month)) return false
  const dom = s.days.includes(day)
  const dow = s.weekdays.includes(weekday)
  if (!s.domStar && !s.dowStar) return dom || dow
  return dom && dow
}

/** Wall-clock parts of an instant in a time zone. */
const formatters = new Map<string, Intl.DateTimeFormat>()
function wallParts(time: number, timeZone: string) {
  let format = formatters.get(timeZone)
  if (!format) {
    format = new Intl.DateTimeFormat("en-US", {
      timeZone, hourCycle: "h23", year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric",
    })
    formatters.set(timeZone, format)
  }
  const parts = format.formatToParts(time)
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value)
  return { year: get("year"), month: get("month"), day: get("day"), hour: get("hour"), minute: get("minute") }
}

/** The instant a wall-clock time happens in a zone, or null if it doesn't exist (a DST gap). */
function fromWall(y: number, mo: number, d: number, h: number, mi: number, timeZone: string) {
  const guess = Date.UTC(y, mo - 1, d, h, mi)
  let time = guess
  for (let i = 0; i < 2; i++) {
    const w = wallParts(time, timeZone)
    time += guess - Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute)
  }
  const w = wallParts(time, timeZone)
  return w.hour === h && w.minute === mi && w.day === d ? time : null
}

/**
 * The next `count` run instants after `from`, reading the schedule as wall-clock time in `timeZone`.
 * A time that falls in a daylight-saving gap is skipped.
 */
export function nextRuns(s: CronSchedule, from: number, count = 5, timeZone = "UTC"): Date[] {
  const start = wallParts(from, timeZone)
  const runs: Date[] = []
  // Eight years covers schedules that only exist on 29 February.
  for (let offset = 0; offset < 366 * 8 && runs.length < count; offset++) {
    const date = new Date(Date.UTC(start.year, start.month - 1, start.day + offset))
    const [y, mo, d] = [date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate()]
    if (!dayMatches(s, mo, d, date.getUTCDay())) continue
    for (const h of s.hours) {
      for (const mi of s.minutes) {
        if (runs.length === count) return runs
        const time = fromWall(y, mo, d, h, mi, timeZone)
        if (time !== null && time > from) runs.push(new Date(time))
      }
    }
  }
  return runs
}

const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]
const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
const ordinal = (n: number) => n + (n % 100 >= 11 && n % 100 <= 13 ? "th" : ["th", "st", "nd", "rd"][n % 10] ?? "th")
const pad = (n: number) => String(n).padStart(2, "0")
const join = (items: string[]) => (items.length < 2 ? items.join("") : `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`)

/** Groups sorted values into consecutive [start, end] spans. */
function spans(values: number[]) {
  const out: [number, number][] = []
  for (const v of values) {
    const last = out.at(-1)
    if (last && v === last[1] + 1) last[1] = v
    else out.push([v, v])
  }
  return out
}

/** "1 to 3 and 5"; an even sequence of five or more reads "1st, 3rd … 31st". */
function runs(values: number[], label: (n: number) => string) {
  const gap = values[1] - values[0]
  if (values.length >= 5 && gap > 1 && values.every((v, i) => i === 0 || v - values[i - 1] === gap)) {
    return `${label(values[0])}, ${label(values[1])} … ${label(values.at(-1) as number)}`
  }
  return join(spans(values).flatMap(([a, b]) => (b - a >= 2 ? [`${label(a)} to ${label(b)}`] : a === b ? [label(a)] : [label(a), label(b)])))
}

const stepOf = (field: string) => /^\*\/(\d+)$/.exec(field)?.[1]

/** Plain-English readback, e.g. "At 09:00, Monday to Friday". The two day fields are spelled out as "or". */
export function describeCron(s: CronSchedule): string {
  const [minF, hourF] = s.fields
  const allMin = s.minutes.length === 60
  const allHour = s.hours.length === 24
  const minuteStep = stepOf(minF)
  const hourStep = stepOf(hourF)
  let time: string
  if (allMin && allHour) time = "Every minute"
  else if (allMin) time = `Every minute, ${join(spans(s.hours).map(([a, b]) => `${pad(a)}:00–${pad(b)}:59`))}`
  else if (allHour) {
    time = minuteStep ? `Every ${minuteStep} minutes` : s.minutes.length === 1 && s.minutes[0] === 0 ? "Every hour, on the hour" : `Every hour at ${runs(s.minutes, (m) => `:${pad(m)}`)}`
  } else if (hourStep && s.minutes.length === 1) time = `Every ${hourStep} hours at :${pad(s.minutes[0])}`
  else if (s.minutes.length * s.hours.length <= 4) {
    time = `At ${join(s.hours.flatMap((h) => s.minutes.map((m) => `${pad(h)}:${pad(m)}`)))}`
  } else {
    const minutes = minuteStep ? `every ${minuteStep} minutes` : `at ${runs(s.minutes, (m) => `:${pad(m)}`)}`
    time = `${minutes[0].toUpperCase()}${minutes.slice(1)}, ${join(spans(s.hours).map(([a, b]) => `${pad(a)}:00–${pad(b)}:59`))}`
  }
  const domLimited = s.days.length < 31
  const dowLimited = s.weekdays.length < 7
  const dom = `on the ${runs(s.days, ordinal)}`
  const dow = runs(s.weekdays, (d) => DAY_NAMES[d])
  let day = ""
  if (!s.domStar && !s.dowStar) day = `, ${dom}, and also every ${dow}`
  else if (domLimited && dowLimited) day = `, ${dom}, only if it's a ${dow}`
  else if (domLimited) day = `, ${dom}`
  else if (dowLimited) day = `, ${dow}`
  const month = s.months.length === 12 ? "" : `, in ${runs(s.months, (m) => MONTH_NAMES[m - 1])}`
  return `${time}${day}${month}`
}

export interface CronWarning {
  id: "every-minute" | "day-or" | "short-months" | "never" | "leap-day" | "uneven-step"
  message: string
  /** One-tap rewrites of the expression. */
  fixes?: { label: string; expression: string }[]
}

const withField = (s: CronSchedule, index: number, value: string) => s.fields.map((f, i) => (i === index ? value : f)).join(" ")

/** The classic cron mistakes in a schedule, most serious first. */
export function cronWarnings(s: CronSchedule): CronWarning[] {
  const warnings: CronWarning[] = []
  const restrictedDays = !s.domStar
  const possible = s.months.filter((m) => s.days.some((d) => d <= MAX_DAYS[m - 1]))
  if (restrictedDays && s.dowStar && possible.length === 0) {
    const month = s.months.length === 1 ? MONTH_NAMES[s.months[0] - 1] : "Those months"
    warnings.push({ id: "never", message: `This never runs: ${month} has no ${runs(s.days, ordinal)}.` })
    return warnings
  }
  if (s.fields[0] === "*" || s.fields[0] === "*/1") {
    warnings.push({
      id: "every-minute",
      message: `Runs every minute, ${(s.hours.length * 60).toLocaleString("en")} times a day.`,
      fixes: [{ label: "Once an hour instead", expression: withField(s, 0, "0") }],
    })
  }
  if (!s.domStar && !s.dowStar) {
    warnings.push({
      id: "day-or",
      message: `Cron reads two day fields as OR: this runs on the ${runs(s.days, ordinal)} and on every ${runs(s.weekdays, (d) => DAY_NAMES[d])}, not only when both match.`,
      fixes: [
        { label: `Only the ${runs(s.days, ordinal)}`, expression: withField(s, 4, "*") },
        { label: `Only ${runs(s.weekdays, (d) => DAY_NAMES[d].slice(0, 3))}`, expression: withField(s, 2, "*") },
      ],
    })
  } else if (restrictedDays && s.dowStar) {
    if (s.months.every((m) => m === 2) && s.days.every((d) => d >= 29) && s.days.includes(29)) {
      warnings.push({ id: "leap-day", message: "29 February only exists in leap years, so this runs once every four years." })
    } else {
      const skipped = s.months.filter((m) => s.days.some((d) => d > 28 && d > (m === 2 ? 28 : MAX_DAYS[m - 1])))
      if (skipped.length && s.days.every((d) => d > 28)) {
        warnings.push({
          id: "short-months",
          message: `There's no ${runs(s.days, ordinal)} in ${join(skipped.map((m) => MONTH_NAMES[m - 1].slice(0, 3)))}, so ${skipped.length === 1 ? "that month is" : "those months are"} skipped. Cron has no "last day".`,
          fixes: [{ label: "Use the 28th instead", expression: withField(s, 2, "28") }],
        })
      }
    }
  }
  for (const [index, size, unit] of [[0, 60, "minute"], [1, 24, "hour"]] as const) {
    const step = Number(stepOf(s.fields[index]))
    if (step > 1 && size % step !== 0) {
      const last = Math.floor((size - 1) / step) * step
      warnings.push({
        id: "uneven-step",
        message: `*/${step} restarts every ${unit === "minute" ? "hour" : "day"}: it runs at ${unit === "minute" ? `:${pad(last)} then :00` : `${pad(last)}:00 then 00:00`}, only ${size - last} ${unit}s apart.`,
      })
    }
  }
  return warnings
}
