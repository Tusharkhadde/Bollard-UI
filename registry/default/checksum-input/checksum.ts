// Bollard UI — checksum-input · MIT licence · https://bollard-ui.vercel.app/components/checksum-input

/** Which kind of number a ChecksumInput holds. */
export type ChecksumKind = "iban" | "card" | "isbn" | "ifsc"

/** IBAN length per country, from the ISO 13616 / SWIFT IBAN registry. */
export const IBAN_LENGTHS: Record<string, number> = {
  AD: 24, AE: 23, AL: 28, AT: 20, AZ: 28, BA: 20, BE: 16, BG: 22, BH: 22, BI: 27, BR: 29, BY: 28, CH: 21,
  CR: 22, CY: 28, CZ: 24, DE: 22, DJ: 27, DK: 18, DO: 28, EE: 20, EG: 29, ES: 24, FI: 18, FK: 18, FO: 18,
  FR: 27, GB: 22, GE: 22, GI: 23, GL: 18, GR: 27, GT: 28, HN: 28, HR: 21, HU: 28, IE: 22, IL: 23, IQ: 23,
  IS: 26, IT: 27, JO: 30, KW: 30, KZ: 20, LB: 28, LC: 32, LI: 21, LT: 20, LU: 20, LV: 21, LY: 25, MC: 27,
  MD: 24, ME: 22, MK: 19, MN: 20, MR: 27, MT: 31, MU: 30, NI: 28, NL: 18, NO: 15, OM: 23, PK: 24, PL: 28,
  PS: 29, PT: 25, QA: 29, RO: 24, RS: 22, RU: 33, SA: 24, SC: 31, SD: 18, SE: 24, SI: 19, SK: 24, SM: 27,
  SO: 23, ST: 25, SV: 28, TL: 23, TN: 24, TR: 26, UA: 29, VA: 22, VG: 24, XK: 20, YE: 30,
}

/** Card brands by prefix, with their valid lengths and print grouping. First match wins. */
export const CARD_BRANDS = [
  { name: "Amex", prefix: /^3[47]/, lengths: [15], groups: [4, 6, 5] },
  { name: "Diners", prefix: /^(30[0-5]|36|38|39)/, lengths: [14, 16, 19], groups: [4, 6, 4] },
  { name: "JCB", prefix: /^35(2[89]|[3-8])/, lengths: [16, 19], groups: [4, 4, 4, 4, 3] },
  { name: "Visa", prefix: /^4/, lengths: [13, 16, 19], groups: [4, 4, 4, 4, 3] },
  { name: "Mastercard", prefix: /^(5[1-5]|222[1-9]|22[3-9]|2[3-6]|27[01]|2720)/, lengths: [16], groups: [4, 4, 4, 4] },
  { name: "Discover", prefix: /^(6011|64[4-9]|65)/, lengths: [16, 19], groups: [4, 4, 4, 4, 3] },
  { name: "RuPay", prefix: /^(508|60|81|82)/, lengths: [16], groups: [4, 4, 4, 4] },
]

/** A few IFSC bank codes, read back so a wrong bank stands out. */
export const IFSC_BANKS: Record<string, string> = {
  SBIN: "State Bank of India", HDFC: "HDFC Bank", ICIC: "ICICI Bank", UTIB: "Axis Bank", PUNB: "Punjab National Bank",
  BARB: "Bank of Baroda", KKBK: "Kotak Mahindra Bank", CNRB: "Canara Bank", UBIN: "Union Bank of India",
  BKID: "Bank of India", IDIB: "Indian Bank", MAHB: "Bank of Maharashtra", YESB: "Yes Bank", IDFB: "IDFC First Bank",
  INDB: "IndusInd Bank", IOBA: "Indian Overseas Bank", CBIN: "Central Bank of India", FDRL: "Federal Bank",
}

/** Strips separators and normalises case, keeping only the characters the kind allows. */
export function cleanChecksum(kind: ChecksumKind, text: string) {
  const upper = text.toUpperCase()
  if (kind === "card") return upper.replace(/\D/g, "").slice(0, 19)
  if (kind === "isbn") return upper.replace(/[^\dX]/g, "").slice(0, 13)
  return upper.replace(/[^A-Z\d]/g, "").slice(0, kind === "iban" ? 34 : 11)
}

/** ISO 7064 MOD 97-10 on an IBAN: true when the remainder is 1. */
export function ibanChecksumOk(iban: string) {
  let rest = 0
  for (const ch of iban.slice(4) + iban.slice(0, 4)) {
    const value = /\d/.test(ch) ? ch : String(ch.charCodeAt(0) - 55)
    for (const digit of value) rest = (rest * 10 + Number(digit)) % 97
  }
  return rest === 1
}

/** Luhn (mod 10) check used by payment cards. */
export function luhnOk(digits: string) {
  let sum = 0
  for (let i = 0; i < digits.length; i++) {
    let n = Number(digits[digits.length - 1 - i])
    if (i % 2) n = n * 2 > 9 ? n * 2 - 9 : n * 2
    sum += n
  }
  return digits.length > 0 && sum % 10 === 0
}

/** ISBN-10 (mod 11, X = 10) or ISBN-13 (weights 1 and 3, mod 10). */
export function isbnOk(isbn: string) {
  if (/^\d{9}[\dX]$/.test(isbn)) {
    const sum = [...isbn].reduce((total, ch, i) => total + (10 - i) * (ch === "X" ? 10 : Number(ch)), 0)
    return sum % 11 === 0
  }
  if (/^97[89]\d{10}$/.test(isbn)) return [...isbn].reduce((total, ch, i) => total + Number(ch) * (i % 2 ? 3 : 1), 0) % 10 === 0
  return false
}

export const cardBrand = (digits: string) => (digits.length >= 2 ? CARD_BRANDS.find((b) => b.prefix.test(digits)) : undefined)

/** Print grouping for a cleaned value, e.g. IBAN in fours, Amex as 4-6-5, IFSC as bank · 0 · branch. */
export function checksumGroups(kind: ChecksumKind, clean: string): number[] {
  if (kind === "card") {
    const brand = cardBrand(clean)
    return brand && !(brand.name === "Diners" && clean.length > 14) ? brand.groups : [4, 4, 4, 4, 3]
  }
  if (kind === "isbn") return clean.length > 10 || clean.startsWith("97") ? [3, 9, 1] : [9, 1]
  if (kind === "ifsc") return [4, 1, 6]
  return Array(9).fill(4)
}

/** Splits a cleaned value into its printed groups. */
export function splitGroups(clean: string, groups: number[]) {
  const out: string[] = []
  let at = 0
  for (const size of groups) {
    if (at >= clean.length) break
    out.push(clean.slice(at, at + size))
    at += size
  }
  if (at < clean.length) out.push(clean.slice(at))
  return out
}

export type ChecksumCode =
  | "tooShort" | "tooLong" | "doubled" | "swapped" | "checksum" | "country" | "letterO" | "bankLetters" | "format"

export interface ChecksumResult {
  status: "empty" | "incomplete" | "valid" | "invalid"
  /** What went wrong, when `status` is `invalid`. */
  code?: ChecksumCode
  /** Expected length, when known. */
  expected?: number
  /** Brand, country or bank, for the readback. */
  label?: string
  /** Indexes in the cleaned value to highlight. */
  suspects?: number[]
  /** A safe structural fix (letter O for zero), never a guessed digit. */
  fix?: string
}

const swapsThatPass = (s: string, ok: (s: string) => boolean, from = 0) => {
  const hits: number[] = []
  for (let i = from; i < s.length - 1; i++) {
    if (s[i] !== s[i + 1] && ok(s.slice(0, i) + s[i + 1] + s[i] + s.slice(i + 2))) hits.push(i, i + 1)
  }
  return hits
}
const doublesThatPass = (s: string, ok: (s: string) => boolean) => {
  const hits: number[] = []
  // A run like "111" counts once: dropping any of its characters gives the same string.
  for (let i = 0; i < s.length - 1; i++) if (s[i] === s[i + 1] && s[i - 1] !== s[i] && ok(s.slice(0, i) + s.slice(i + 1))) hits.push(i, i + 1)
  return hits
}

/** Points at an adjacent swap or a doubled character when exactly one explains the failure. */
function diagnose(s: string, ok: (s: string) => boolean, expected: number | undefined, from = 0): ChecksumResult {
  if (expected !== undefined && s.length > expected) {
    const doubled = s.length === expected + 1 ? doublesThatPass(s, ok) : []
    if (doubled.length === 2) return { status: "invalid", code: "doubled", suspects: doubled, expected }
    return { status: "invalid", code: "tooLong", expected }
  }
  const swapped = swapsThatPass(s, ok, from)
  if (swapped.length === 2) return { status: "invalid", code: "swapped", suspects: swapped, expected }
  return { status: "invalid", code: "checksum", expected }
}

/**
 * Validates a cleaned value. `complete` means the user has left the field, so a
 * short value is reported instead of treated as still being typed.
 */
export function checkChecksum(kind: ChecksumKind, s: string, complete = false): ChecksumResult {
  if (!s) return { status: "empty" }
  const short = (expected: number): ChecksumResult =>
    complete ? { status: "invalid", code: "tooShort", expected } : { status: "incomplete", expected }

  if (kind === "iban") {
    if (!/^[A-Z]{0,2}$/.test(s.slice(0, 2))) return { status: "invalid", code: "format" }
    if (s.length < 2) return short(15)
    const expected = IBAN_LENGTHS[s.slice(0, 2)]
    if (!expected) return { status: "invalid", code: "country", suspects: [0, 1] }
    const o = [2, 3].filter((i) => s[i] === "O")
    if (o.length) return { status: "invalid", code: "letterO", suspects: o, fix: s.slice(0, 2) + s.slice(2, 4).replace(/O/g, "0") + s.slice(4) }
    if (/\D/.test(s.slice(2, 4))) return { status: "invalid", code: "format", suspects: [2, 3] }
    if (s.length < expected) return short(expected)
    if (s.length === expected && ibanChecksumOk(s)) return { status: "valid", expected }
    return diagnose(s, (t) => t.length === expected && ibanChecksumOk(t), expected, 2)
  }

  if (kind === "card") {
    const brand = cardBrand(s)
    const lengths = brand?.lengths ?? [12, 13, 14, 15, 16, 17, 18, 19]
    // Most brands print 16 digits; only warn before that once the field is left.
    const typical = lengths.includes(16) ? 16 : lengths[0]
    const label = brand?.name
    if (lengths.includes(s.length) && luhnOk(s)) return { status: "valid", label, expected: s.length }
    if (s.length < typical && !complete) return { status: "incomplete", label, expected: typical }
    if (s.length < Math.min(...lengths)) return { ...short(Math.min(...lengths)), label }
    const fits = (t: string) => lengths.includes(t.length) && luhnOk(t)
    return { ...diagnose(s, fits, lengths.includes(s.length) ? undefined : typical), label }
  }

  if (kind === "isbn") {
    if (/X./.test(s)) return { status: "invalid", code: "format", suspects: [s.indexOf("X")] }
    const thirteen = s.length > 10 || (/^97[89]/.test(s) && !complete)
    const expected = thirteen ? 13 : 10
    if (thirteen && s.length >= 3 && !/^97[89]/.test(s)) return { status: "invalid", code: "format", suspects: [0, 1, 2] }
    if (s.length < expected) return short(expected)
    const label = thirteen ? "ISBN-13" : "ISBN-10"
    if (isbnOk(s)) return { status: "valid", label, expected }
    return { ...diagnose(s, isbnOk, undefined), label }
  }

  // IFSC: 4 letters (bank), the digit 0, then 6 letters or digits (branch). No check digit exists.
  const bank = s.slice(0, 4)
  const lookalike: Record<string, string> = { "0": "O", "1": "I", "5": "S", "8": "B", "2": "Z" }
  if (/\d/.test(bank)) {
    const fixed = bank.replace(/\d/g, (d) => lookalike[d] ?? d)
    const suspects = [...bank].flatMap((ch, i) => (/\d/.test(ch) ? [i] : []))
    return { status: "invalid", code: "bankLetters", suspects, fix: /\d/.test(fixed) ? undefined : fixed + s.slice(4) }
  }
  if (s[4] === "O") return { status: "invalid", code: "letterO", suspects: [4], fix: bank + "0" + s.slice(5) }
  if (s.length > 4 && s[4] !== "0") return { status: "invalid", code: "format", suspects: [4] }
  if (s.length < 11) return short(11)
  return { status: "valid", expected: 11, label: IFSC_BANKS[bank] }
}
