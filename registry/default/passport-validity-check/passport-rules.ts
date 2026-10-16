/** One destination's passport rule. Check it against the official source before relying on it. */
export interface PassportRule {
  /** Shown in the heading: "Schengen area". */
  name: string
  /** How long the passport must still be valid. */
  validFor: { months?: number; days?: number }
  /** Counted from the day you arrive, or the day you leave. */
  from: "arrival" | "departure"
  /** The passport must have been issued within this many years, on the day you arrive. */
  issuedWithinYears?: number
  /** Blank pages needed. */
  blankPages?: number
  /** The blank pages must face each other. */
  facingPages?: boolean
  /** Where the rule comes from. */
  source?: string
  /** One plain line on what the source says. */
  note?: string
}

/**
 * Starter data, checked against primary sources on 14 Oct 2026. Rules change and airlines may apply
 * stricter ones, so pass your own `rules` (Timatic, Sherpa, your own table) in production.
 */
export const PASSPORT_RULES: Record<string, PassportRule> = {
  schengen: {
    name: "Schengen area",
    validFor: { months: 3 },
    from: "departure",
    issuedWithinYears: 10,
    source: "https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32016R0399",
    note: "Schengen Borders Code, Art. 6(1)(a), for non-EU visitors: valid 3 months after you leave the Schengen area (not just one country), issued within the previous 10 years.",
  },
  singapore: {
    name: "Singapore",
    validFor: { months: 6 },
    from: "arrival",
    source: "https://www.ica.gov.sg/enter-transit-depart/entering-singapore",
    note: "ICA: at least 6 months' validity when you enter.",
  },
  "south-africa": {
    name: "South Africa",
    validFor: { days: 30 },
    from: "departure",
    blankPages: 2,
    facingPages: true,
    source: "https://www.dha.gov.za/index.php/civic-services/travel-documents",
    note: "Home Affairs: valid 30 days after you leave, two facing blank pages (not the endorsement page).",
  },
  "six-months": {
    name: "6-month rule",
    validFor: { months: 6 },
    from: "arrival",
    note: "Many countries and airlines ask for 6 months' validity on arrival. Check your destination.",
  },
}

export interface PassportDetails {
  /** Expiry date, "YYYY-MM-DD" or a Date. */
  expiry?: string | Date | null
  /** Issue date. */
  issued?: string | Date | null
  /** Blank visa pages left. */
  blankPages?: number | null
}

export interface Trip {
  arrival?: string | Date | null
  departure?: string | Date | null
}

export type CheckStatus = "pass" | "fail" | "unknown"

export interface PassportCheck {
  kind: "validity" | "issued" | "pages" | "expired"
  status: CheckStatus
  /** The date the rule needs, when it is a date rule. */
  needed?: Date
  /** Days short (validity) or days over (issued), when failing. */
  days?: number
  /** The date entered can't be right (issued after you arrive): likely a typo. */
  invalid?: boolean
}

export interface PassportResult {
  status: CheckStatus
  /** The date the passport must still be valid on. */
  validUntil?: Date
  checks: PassportCheck[]
  /** Latest day you could leave with this passport, when validity fails and the rule counts from departure. */
  latestDeparture?: Date
  /** Trip dates are missing or back to front. */
  tripInvalid?: boolean
  /** Both trip dates are set but departure is before arrival. */
  tripReversed?: boolean
}

const DAY = 86_400_000

/** Reads "YYYY-MM-DD" (or a Date) as a local calendar day. Anything else is undefined, never a crash. */
export function toDay(input: unknown): Date | undefined {
  if (input instanceof Date) return Number.isNaN(input.getTime()) ? undefined : new Date(input.getFullYear(), input.getMonth(), input.getDate())
  if (typeof input !== "string") return undefined
  const m = /^\s*\uFEFF?(\d{4})-(\d{1,2})-(\d{1,2})\s*$/.exec(input)
  if (!m) return undefined
  const [y, mo, d] = [Number(m[1]), Number(m[2]) - 1, Number(m[3])]
  const date = new Date(y, mo, d)
  return date.getFullYear() === y && date.getMonth() === mo && date.getDate() === d && y > 1900 && y < 2200 ? date : undefined
}

/** Adds months the calendar way: 31 Aug + 6 months is 28 Feb (29 in a leap year), never 3 Mar. */
export function addMonths(date: Date, months: number): Date {
  const target = new Date(date.getFullYear(), date.getMonth() + months, 1)
  const last = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate()
  return new Date(target.getFullYear(), target.getMonth(), Math.min(date.getDate(), last))
}

const addValidity = (date: Date, v: PassportRule["validFor"], sign = 1) => {
  const shifted = addMonths(date, sign * (v.months ?? 0))
  return new Date(shifted.getFullYear(), shifted.getMonth(), shifted.getDate() + sign * (v.days ?? 0))
}
const daysBetween = (a: Date, b: Date) => Math.round((b.getTime() - a.getTime()) / DAY)

/** Checks a passport against one destination rule for one trip. */
export function checkPassport(passport: PassportDetails, trip: Trip, rule: PassportRule): PassportResult {
  const expiry = toDay(passport?.expiry)
  const issued = toDay(passport?.issued)
  const arrival = toDay(trip?.arrival)
  const departure = toDay(trip?.departure) ?? arrival
  if (!rule || !arrival || !departure || departure < arrival) return { status: "unknown", checks: [], tripInvalid: true, tripReversed: !!arrival && !!departure && departure < arrival }

  const validFor = rule.validFor ?? {}
  const anchor = rule.from === "departure" ? departure : arrival
  const validUntil = addValidity(anchor, validFor)
  const checks: PassportCheck[] = []

  if (expiry && expiry < arrival) checks.push({ kind: "expired", status: "fail", days: daysBetween(expiry, arrival) })
  else checks.push({ kind: "validity", status: !expiry ? "unknown" : expiry >= validUntil ? "pass" : "fail", needed: validUntil, days: expiry && expiry < validUntil ? daysBetween(expiry, validUntil) : undefined })

  if (rule.issuedWithinYears) {
    const limit = issued ? new Date(issued.getFullYear() + rule.issuedWithinYears, issued.getMonth(), issued.getDate()) : undefined
    if (issued && issued > arrival) checks.push({ kind: "issued", status: "fail", invalid: true })
    else checks.push({ kind: "issued", status: !limit ? "unknown" : arrival <= limit ? "pass" : "fail", needed: limit, days: limit && arrival > limit ? daysBetween(limit, arrival) : undefined })
  }
  if (rule.blankPages) {
    const pages = typeof passport?.blankPages === "number" && Number.isFinite(passport.blankPages) ? passport.blankPages : undefined
    checks.push({ kind: "pages", status: pages === undefined ? "unknown" : pages >= rule.blankPages ? "pass" : "fail" })
  }

  const status: CheckStatus = checks.some((c) => c.status === "fail") ? "fail" : checks.some((c) => c.status === "unknown") ? "unknown" : "pass"
  const validity = checks.find((c) => c.kind === "validity")
  let latestDeparture: Date | undefined
  if (validity?.status === "fail" && expiry && rule.from === "departure") {
    const latest = addValidity(expiry, validFor, -1)
    // Months don't subtract cleanly (31 May − 3 months = 28 Feb, which adds back to 28 May), so step back until it holds.
    while (addValidity(latest, validFor) > expiry) latest.setDate(latest.getDate() - 1)
    if (latest >= arrival) latestDeparture = latest
  }
  return { status, validUntil, checks, latestDeparture }
}
