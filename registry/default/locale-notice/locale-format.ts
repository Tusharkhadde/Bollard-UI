/** Pure helpers for reading numbers and dates the way another locale would. Safe on the server. */

export interface Separators {
  group: string
  decimal: string
}

const SPACE = /[\s\u00a0\u202f\u2009]/g
const QUOTE = /[\u2019']/g

/** Swaps every space-like and apostrophe-like character for one canonical form. */
const canon = (text: string) => text.replace(SPACE, " ").replace(QUOTE, "'").replace(/\u2212/g, "-")

/** The locale's grouping and decimal characters, read from Intl (de-CH changed ’ to ' in CLDR 48). */
export function getSeparators(locale: string): Separators {
  const parts = new Intl.NumberFormat(locale).formatToParts(1234567.5)
  return {
    group: canon(parts.find((p) => p.type === "group")?.value ?? ""),
    decimal: canon(parts.find((p) => p.type === "decimal")?.value ?? "."),
  }
}

/** True for 1,234,567 and the Indian 12,34,567 grouping; false for 1,5 or 12,34. */
const validGrouping = (int: string, group: string) => {
  if (!group || !int.includes(group)) return true
  const groups = int.split(group)
  const [head, ...rest] = groups
  if (!/^\d{1,3}$/.test(head)) return false
  if (rest.every((g) => /^\d{3}$/.test(g))) return true
  return /^\d{1,2}$/.test(head) && rest.slice(0, -1).every((g) => /^\d{2}$/.test(g)) && /^\d{3}$/.test(rest[rest.length - 1])
}

export interface LocaleReading {
  /** The number a reader in that locale takes the text to mean, or null when it isn't one. */
  value: number | null
  /** False when separators sit in places that locale never puts them (1,5 in en-US). */
  confident: boolean
}

/** Reads `text` strictly as a reader in `locale` would: "1,000" in de-DE is 1, in en-US 1000. */
export function readNumberAs(text: string, locale: string): LocaleReading {
  const { group, decimal } = getSeparators(locale)
  const t = canon(text.trim())
  const sign = t.startsWith("-") ? -1 : 1
  const body = t.replace(/^[-+]/, "")
  const halves = body.split(decimal)
  if (!body || halves.length > 2 || (halves.length === 2 && !/^\d+$/.test(halves[1]))) return { value: null, confident: false }
  const int = group === " " ? halves[0].replace(/ +/g, " ") : halves[0]
  const digits = group ? int.split(group).join("") : int
  if (!/^\d+$/.test(digits)) return { value: null, confident: false }
  const value = sign * Number(`${digits}.${halves[1] ?? ""}`)
  return { value, confident: validGrouping(int, group) }
}

/** Formats a number the way `locale` writes it. */
export const formatNumber = (value: number, locale: string, options?: Intl.NumberFormatOptions) =>
  new Intl.NumberFormat(locale, { maximumFractionDigits: 20, ...options }).format(value)

/** SI style (1 000 000.5 with thin spaces): grouping no locale reads as a decimal point. */
export const formatSafeNumber = (value: number) =>
  formatNumber(value, "en-US").replace(/,/g, "\u2009")

/** "Germany" for de-DE, "Switzerland" for de-CH, the language name when no region is known. */
export function placeName(locale: string, inLocale: string) {
  try {
    const { region, language } = new Intl.Locale(locale).maximize()
    if (region) return new Intl.DisplayNames([inLocale], { type: "region" }).of(region) ?? locale
    return new Intl.DisplayNames([inLocale], { type: "language" }).of(language) ?? locale
  } catch {
    return locale
  }
}

export interface SeparatorSlip {
  /** "mismatch": the other convention's decimal mark; "ambiguous": 1.500 could be 1½ or 1500. */
  kind: "mismatch" | "ambiguous"
  /** What the field will store if left as typed (null when it doesn't parse). */
  reads: number | null
  /** What the person most likely meant. */
  meant: number
  /** `meant`, written the way `locale` expects. */
  suggestion: string
}

/**
 * Catches a number typed with the other convention's separators: "1,5" in an
 * en-US field (reads as 15), "1.234,56" or "1 234,56" in en-US, "1.5" in de-DE.
 * A single mark followed by exactly three digits ("1.500") reads two ways and
 * comes back as "ambiguous".
 */
export function detectSeparatorSlip(text: string, locale: string): SeparatorSlip | null {
  const t = canon(text.trim())
  if (!/^[-+]?[\d., ']*\d[\d., ']*$/.test(t) || !/[.,]/.test(t)) return null
  const { decimal } = getSeparators(locale)
  const here = readNumberAs(t, locale)
  const marks = t.match(/[.,]/g) ?? []
  const last = marks[marks.length - 1]
  const lastAt = t.lastIndexOf(last)
  const fraction = t.slice(lastAt + 1).replace(/\D/g, "")
  const sign = t.startsWith("-") ? -1 : 1
  const asDecimal = sign * Number(`${t.slice(0, lastAt).replace(/\D/g, "")}.${fraction}`)
  const write = (n: number, places: number) => formatNumber(n, locale, { minimumFractionDigits: places })

  const repeated = marks.filter((m) => m === last).length > 1
  const mixed = new Set(marks).size > 1
  if (last !== decimal && !repeated && (fraction.length !== 3 || mixed || !here.confident)) {
    return { kind: "mismatch", reads: here.value, meant: asDecimal, suggestion: write(asDecimal, fraction.length) }
  }
  // "1.234.567" in an en-US field: the decimal mark used as grouping.
  if (last === decimal && repeated && !mixed) {
    const whole = Number(t.replace(/[^\d]/g, "")) * sign
    return { kind: "mismatch", reads: here.value, meant: whole, suggestion: write(whole, 0) }
  }
  if (last === decimal && marks.length === 1 && fraction.length === 3 && /^\D?\d{1,3}$/.test(t.slice(0, lastAt))) {
    const whole = Number(t.replace(/\D/g, "")) * sign
    return { kind: "ambiguous", reads: here.value, meant: whole, suggestion: write(whole, 0) }
  }
  return null
}

const DATE_NUMERIC: Intl.DateTimeFormatOptions = { year: "numeric", month: "numeric", day: "numeric" }

/** The order a locale writes numeric dates in, e.g. ["month", "day", "year"] for en-US. */
export function dateOrder(locale: string) {
  return new Intl.DateTimeFormat(locale, DATE_NUMERIC)
    .formatToParts(new Date(2026, 10, 23))
    .filter((p) => p.type === "day" || p.type === "month" || p.type === "year")
    .map((p) => p.type as "day" | "month" | "year")
}

export const formatNumericDate = (date: Date, locale: string) => new Intl.DateTimeFormat(locale, DATE_NUMERIC).format(date)

/** "4 Mar 2026" with a worded month, which no reader can flip. */
export const formatWordedDate = (date: Date, locale: string) =>
  new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", year: "numeric" }).format(date)

/** Reads "3/4/2026" in `locale`'s field order; null when that order makes it an impossible date. */
export function readDateAs(text: string, locale: string): Date | null {
  const nums = text.match(/\d+/g)
  const order = dateOrder(locale)
  if (!nums || nums.length !== 3 || order.length !== 3) return null
  const field = Object.fromEntries(order.map((key, i) => [key, Number(nums[i])])) as Record<"day" | "month" | "year", number>
  const year = field.year < 100 ? 2000 + field.year : field.year
  const date = new Date(year, field.month - 1, field.day)
  return date.getMonth() === field.month - 1 && date.getDate() === field.day ? date : null
}

export const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
