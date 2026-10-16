/** What `checkExpiry` found. `fix` is the corrected MM/YY when one reading is clearly meant. */
export type ExpiryCheck =
  | { kind: "empty" | "incomplete" }
  | { kind: "error"; issue: "month" | "past"; month?: number; expires?: Date }
  | { kind: "warning"; issue: "swapped" | "long-year" | "far" | "renewal"; fix?: string; expires?: Date }
  | { kind: "ok"; expires: Date; thisMonth: boolean }

/** A pasted or autofilled "2028-10" / "2028/10" (Firefox fills YYYY-MM when it can't read the mask). */
const ISO = /^\s*(20\d{2})\s*[-/.]\s*(\d{1,2})\s*$/

/**
 * Masks typing into MM/YY: digits only, the slash added as soon as the month is complete (and not
 * re-added while deleting), a lone 2–9 padded to 02–09. A year-first paste is kept as YYYY/MM so it
 * can be caught instead of silently turned into a different month.
 */
export function formatExpiry(raw: string, previous = "") {
  const iso = raw.match(ISO)
  if (iso) return `${iso[1]}/${iso[2].padStart(2, "0")}`
  const lone = raw.match(/^(\d)\s*[/\-. ]$/)
  if (lone) return `0${lone[1]}/`
  let digits = raw.replace(/\D/g, "").slice(0, 6)
  if (/^[2-9]$/.test(digits) && raw.trim().length === 1) digits = `0${digits}`
  if (digits.length > 2) return `${digits.slice(0, 2)}/${digits.slice(2)}`
  const adding = raw.length > previous.length
  return digits.length === 2 && (adding || raw.endsWith("/")) ? `${digits}/` : digits
}

/** The card works through the last day of its expiry month, so that is the date to read back. */
export function lastDayOfMonth(year: number, month: number) {
  return new Date(year, month, 0)
}

const months = (from: Date, to: Date) => (to.getFullYear() - from.getFullYear()) * 12 + to.getMonth() - from.getMonth()

/**
 * Checks an MM/YY expiry: month 00 or 13+, a year-first entry (28/10 or 2028-10), a four-digit year,
 * a card already expired, one implausibly far out, and one that runs out before the next renewal.
 */
export function checkExpiry(
  value: string,
  { today, renewsOn, maxYears = 20 }: { today?: Date; renewsOn?: Date; maxYears?: number } = {},
): ExpiryCheck {
  const text = value.trim()
  if (!text) return { kind: "empty" }
  const yy = (today ?? new Date(2000, 0, 1)).getFullYear() % 100
  const plausibleYear = (two: number) => (today ? two >= yy - 1 && two <= yy + maxYears : true)

  const iso = text.match(/^(\d{4})\/(\d{2})$/)
  if (iso) {
    const month = Number(iso[2])
    if (month < 1 || month > 12) return { kind: "error", issue: "month", month }
    return { kind: "warning", issue: "swapped", fix: `${iso[2]}/${iso[1].slice(2)}`, expires: lastDayOfMonth(Number(iso[1]), month) }
  }

  const [mm = "", rest = ""] = text.split("/")
  if (mm.length < 2) return { kind: "incomplete" }
  const month = Number(mm)
  if (month < 1 || month > 12) {
    // "28/10": the year typed first. Offer the swap only when both halves make sense the other way.
    const asMonth = Number(rest)
    if (rest.length === 2 && asMonth >= 1 && asMonth <= 12 && plausibleYear(month))
      return { kind: "warning", issue: "swapped", fix: `${rest}/${mm}`, expires: lastDayOfMonth(2000 + month, asMonth) }
    return { kind: "error", issue: "month", month }
  }
  if (rest.length === 4 && rest.startsWith("20"))
    return { kind: "warning", issue: "long-year", fix: `${mm}/${rest.slice(2)}`, expires: lastDayOfMonth(Number(rest), month) }
  if (rest.length !== 2) return { kind: "incomplete" }

  const expires = lastDayOfMonth(2000 + Number(rest), month)
  if (!today) return { kind: "ok", expires, thisMonth: false }
  const left = months(today, expires)
  if (left < 0) return { kind: "error", issue: "past", expires }
  if (left > maxYears * 12) return { kind: "warning", issue: "far", expires }
  if (renewsOn && expires < renewsOn) return { kind: "warning", issue: "renewal", expires }
  return { kind: "ok", expires, thisMonth: left === 0 }
}

/** "2 years 4 months" / "5 months" / "this month" between today and the expiry month. */
export function timeLeft(today: Date, expires: Date) {
  const total = months(today, expires)
  const years = Math.floor(total / 12)
  const rest = total % 12
  const part = (n: number, unit: string) => (n ? `${n} ${unit}${n === 1 ? "" : "s"}` : "")
  return [part(years, "year"), part(rest, "month")].filter(Boolean).join(" ") || "this month"
}

