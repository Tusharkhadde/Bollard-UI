// Bollard UI — address-check · MIT licence · https://bollard-ui.vercel.app/components/address-check

/** A postal address as the form holds it. `country` is an ISO 3166-1 alpha-2 code. */
export interface Address {
  country: string
  line1: string
  line2: string
  city: string
  region: string
  postcode: string
}

export type AddressField = Exclude<keyof Address, "country">

export interface CountryRule {
  name: string
  /** What the postcode is called there, or null when the country has no postcodes (UAE). */
  postcodeLabel: string | null
  regionLabel: string
  /** Canonical shape, uppercase with the right separator. */
  pattern?: RegExp
  /** Turns "sw1a1aa" into "SW1A 1AA", "4110 39" into "411039", "560O01" into "560001". */
  normalize?: (raw: string) => string
  /** Shape shown in the warning, e.g. "6 digits, like 411001". */
  example?: string
  /** How the city / region / postcode line prints on a label. */
  cityLine: (a: Address) => string[]
}

const compact = (s: string) => s.toUpperCase().replace(/[\s-]+/g, "")
/** O and I typed for 0 and 1 in an all-digit code. */
const digits = (s: string) => compact(s).replace(/O/g, "0").replace(/[IL]/g, "1")
/** Re-inserts the space before the last `n` characters. */
const split = (n: number) => (s: string) => {
  const c = compact(s)
  return c.length > n ? `${c.slice(0, -n)} ${c.slice(-n)}` : c
}
const join = (...parts: string[]) => parts.filter(Boolean).join(" ")

export const COUNTRIES: Record<string, CountryRule> = {
  IN: { name: "India", postcodeLabel: "PIN code", regionLabel: "State", pattern: /^[1-9]\d{5}$/, normalize: digits, example: "6 digits, like 411001",
    cityLine: (a) => [join(a.city, a.postcode && `- ${a.postcode}`), a.region] },
  US: { name: "United States", postcodeLabel: "ZIP code", regionLabel: "State", pattern: /^\d{5}(-\d{4})?$/, example: "5 digits, like 94103",
    normalize: (s) => { const d = digits(s); return d.length === 9 ? `${d.slice(0, 5)}-${d.slice(5)}` : d },
    cityLine: (a) => [join(a.city && `${a.city},`, a.region, a.postcode)] },
  GB: { name: "United Kingdom", postcodeLabel: "Postcode", regionLabel: "County", pattern: /^(GIR 0AA|[A-PR-UWYZ][A-HK-Y]?\d[A-Z\d]? \d[ABD-HJLNP-UW-Z]{2})$/, normalize: split(3), example: "like SW1A 1AA",
    cityLine: (a) => [a.city.toUpperCase(), a.region, a.postcode] },
  CA: { name: "Canada", postcodeLabel: "Postal code", regionLabel: "Province", pattern: /^[ABCEGHJ-NPRSTVXY]\d[A-Z] \d[A-Z]\d$/, normalize: split(3), example: "like K1A 0B1",
    cityLine: (a) => [join(a.city, a.region, a.postcode && ` ${a.postcode}`)] },
  AU: { name: "Australia", postcodeLabel: "Postcode", regionLabel: "State", pattern: /^\d{4}$/, normalize: digits, example: "4 digits, like 2000",
    cityLine: (a) => [join(a.city.toUpperCase(), a.region, a.postcode)] },
  DE: { name: "Germany", postcodeLabel: "Postleitzahl", regionLabel: "State", pattern: /^\d{5}$/, normalize: digits, example: "5 digits, like 10115",
    cityLine: (a) => [join(a.postcode, a.city)] },
  NL: { name: "Netherlands", postcodeLabel: "Postcode", regionLabel: "Province", pattern: /^[1-9]\d{3} [A-RT-Z][A-Z]$/, normalize: split(2), example: "like 1012 AB",
    cityLine: (a) => [join(a.postcode, a.city.toUpperCase())] },
  SG: { name: "Singapore", postcodeLabel: "Postal code", regionLabel: "District", pattern: /^\d{6}$/, normalize: digits, example: "6 digits, like 018956",
    cityLine: (a) => [join(a.city || "Singapore", a.postcode)] },
  JP: { name: "Japan", postcodeLabel: "Postal code", regionLabel: "Prefecture", pattern: /^\d{3}-\d{4}$/, example: "like 100-0001",
    normalize: (s) => { const d = digits(s); return d.length === 7 ? `${d.slice(0, 3)}-${d.slice(3)}` : d },
    cityLine: (a) => [join(a.postcode && `〒${a.postcode}`), join(a.region, a.city)] },
  AE: { name: "United Arab Emirates", postcodeLabel: null, regionLabel: "Emirate", cityLine: (a) => [join(a.city, a.region)] },
}

/** Matches "PO Box 12", "P.O. Box", "Post Office Box", "GPO Box", "Locked Bag", "Postfach" but not "Box Hill" or "Pobox Lane". */
const PO_BOX = /\b(p\.?\s*o\.?\s*box|post\s*office\s*box|g\.?p\.?o\.?\s*box|po\s*#|locked\s+bag|postfach)(?=[\s\d#.,]|$)/i

export const isPoBox = (text: string) => PO_BOX.test(text)

/** A street address needs a number somewhere: house, flat, plot, unit or building number. */
export const hasPremiseNumber = (a: Address) => /\d/.test(`${a.line1} ${a.line2}`)

export type PostcodeCheck =
  | { status: "ok" | "empty" | "none" }
  | { status: "fixable"; fixed: string }
  | { status: "other-country"; country: string }
  | { status: "invalid" }

/**
 * Checks a postcode against the country's shape. A near miss that only needs
 * case, spacing or an O→0 swap is "fixable"; a code that only fits one other
 * supported country's shape (a UK postcode with Country = India) says which.
 */
export function checkPostcode(country: string, raw: string): PostcodeCheck {
  const rule = COUNTRIES[country]
  if (!rule?.pattern) return { status: "none" }
  const value = raw.trim()
  if (!value) return { status: "empty" }
  if (rule.pattern.test(value)) return { status: "ok" }
  const fixed = rule.normalize ? rule.normalize(value) : value.toUpperCase()
  if (rule.pattern.test(fixed)) return { status: "fixable", fixed }
  // Only letter or dash shapes are distinctive enough to name another country; a 4-digit typo isn't "Australian".
  if (!/[A-Z-]/i.test(value)) return { status: "invalid" }
  const matches = Object.entries(COUNTRIES).filter(
    ([code, other]) => code !== country && other.pattern && other.pattern.test(other.normalize ? other.normalize(value) : value.toUpperCase()),
  )
  return matches.length === 1 ? { status: "other-country", country: matches[0][0] } : { status: "invalid" }
}

/** What a postcode lookup returns: the place the code belongs to. */
export interface PostcodePlace {
  city: string
  /** Other accepted names, e.g. ["Bangalore"] for Bengaluru. */
  aliases?: string[]
  region?: string
}

export type AddressIssue =
  | { field: "line1" | "line2"; kind: "po-box" }
  | { field: "line1"; kind: "no-number" }
  | { field: "postcode"; kind: "postcode"; check: Exclude<PostcodeCheck, { status: "ok" | "empty" | "none" }> }
  | { field: "city"; kind: "city"; place: PostcodePlace }

/** Every problem a courier would hit, in form order. `place` is the lookup result for the current postcode. */
export function findAddressIssues(a: Address, place?: PostcodePlace | null): AddressIssue[] {
  const issues: AddressIssue[] = []
  if (isPoBox(a.line1)) issues.push({ field: "line1", kind: "po-box" })
  else if (isPoBox(a.line2)) issues.push({ field: "line2", kind: "po-box" })
  else if (a.line1.trim() && !hasPremiseNumber(a)) issues.push({ field: "line1", kind: "no-number" })
  const check = checkPostcode(a.country, a.postcode)
  if (check.status === "fixable" || check.status === "other-country" || check.status === "invalid") issues.push({ field: "postcode", kind: "postcode", check })
  if (place && (!a.city.trim() || !sameCity(a.city, [place.city, ...(place.aliases ?? [])]))) issues.push({ field: "city", kind: "city", place })
  return issues
}

const simplify = (s: string) => s.toLowerCase().normalize("NFD").replace(/[^\p{L}]/gu, "")

/** True when the typed city is the looked-up one or one of its aliases (Bengaluru / Bangalore). */
export function sameCity(typed: string, names: string[]) {
  const t = simplify(typed)
  return names.some((name) => {
    const n = simplify(name)
    return !!n && (t === n || (t.length >= 3 && (t.includes(n) || n.includes(t))))
  })
}

/** The lines a courier label would print, in the country's order, ending with the country name in capitals. `fields` says what each line carries. */
export function formatLabel(a: Address): { fields: (keyof Address)[]; text: string }[] {
  const rule = COUNTRIES[a.country]
  const carried = (text: string) =>
    (["city", "region", "postcode"] as const).filter((field) => a[field].trim() && text.toUpperCase().includes(a[field].trim().toUpperCase()))
  const lines = [
    { fields: ["line1"] as (keyof Address)[], text: a.line1.trim() },
    { fields: ["line2"] as (keyof Address)[], text: a.line2.trim() },
    ...(rule?.cityLine(a) ?? [a.city]).map((text) => ({ fields: carried(text) as (keyof Address)[], text: text.trim() })),
    { fields: ["country"] as (keyof Address)[], text: (rule?.name ?? a.country).toUpperCase() },
  ]
  return lines.filter((line) => line.text)
}
