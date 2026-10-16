/** The kinds of personal detail the guard looks for. */
export type PiiKind = "otp" | "card" | "aadhaar" | "pan" | "email" | "address" | "phone"

export interface PiiMatch {
  kind: PiiKind
  /** The text as written. */
  value: string
  start: number
  end: number
}

/** Kinds in priority order: when two overlap, the earlier kind wins. */
export const PII_KINDS: PiiKind[] = ["otp", "card", "aadhaar", "pan", "email", "address", "phone"]

const D = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], [1, 2, 3, 4, 0, 6, 7, 8, 9, 5], [2, 3, 4, 0, 1, 7, 8, 9, 5, 6], [3, 4, 0, 1, 2, 8, 9, 5, 6, 7],
  [4, 0, 1, 2, 3, 9, 5, 6, 7, 8], [5, 9, 8, 7, 6, 0, 4, 3, 2, 1], [6, 5, 9, 8, 7, 1, 0, 4, 3, 2], [7, 6, 5, 9, 8, 2, 1, 0, 4, 3],
  [8, 7, 6, 5, 9, 3, 2, 1, 0, 4], [9, 8, 7, 6, 5, 4, 3, 2, 1, 0],
]
const P = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], [1, 5, 7, 6, 2, 8, 3, 0, 9, 4], [5, 8, 0, 3, 7, 9, 6, 1, 4, 2], [8, 9, 1, 6, 0, 4, 3, 5, 2, 7],
  [9, 4, 5, 3, 1, 2, 6, 8, 7, 0], [4, 2, 8, 6, 5, 7, 3, 9, 0, 1], [2, 7, 9, 3, 8, 0, 6, 4, 1, 5], [7, 0, 4, 6, 9, 1, 3, 2, 5, 8],
]

/** Verhoeff check used by Aadhaar: catches every single wrong digit and every swapped neighbour pair. */
export function verhoeff(digits: string) {
  let c = 0
  const list = digits.replace(/\D/g, "").split("").reverse()
  list.forEach((d, i) => (c = D[c][P[i % 8][Number(d)]]))
  return list.length > 0 && c === 0
}

/** Luhn check used by payment cards. */
export function luhn(digits: string) {
  const list = digits.replace(/\D/g, "")
  let sum = 0
  for (let i = 0; i < list.length; i++) {
    let d = Number(list[list.length - 1 - i])
    if (i % 2) d = d * 2 > 9 ? d * 2 - 9 : d * 2
    sum += d
  }
  return list.length >= 13 && sum % 10 === 0
}

const digitCount = (s: string) => s.replace(/\D/g, "").length
const ADDRESS_WORDS = /\b(flat|house|h\.?\s?no|plot|apt|apartment|floor|wing|tower|block|sector|road|rd|street|lane|marg|nagar|colony|society|chowk|layout|cross|near|opp|opposite|behind|village|taluka|district)\b/i
const ADDRESS_START = /\b(?:flat|house|h\.?\s?no|plot|apt|apartment|room|door|shop)\b|(?:^|[\s,])[A-Za-z]?[-/]?\d{1,4}[A-Za-z]?(?:[-/]\d{1,4}[A-Za-z]?)?\s*,/i
const NOT_OTP_CODE = "(?<!(?:promo|coupon|discount|zip|postal|pin|area|country|referral|source|error|status|dress|qr)[\\s-]?)"

const DETECTORS: Record<PiiKind, (text: string) => { start: number; end: number }[]> = {
  otp: (text) => {
    const found: { start: number; end: number }[] = []
    const before = new RegExp(`\\b(?:otp|one[- ]time (?:password|code)|verification code|security code|passcode|login code|${NOT_OTP_CODE}code|pin(?![\\s-]?code))\\b[^\\d\\n]{0,20}?(\\d{4,8})(?!\\d)|ओटीपी[^\\d\\n]{0,20}?(\\d{4,8})(?!\\d)`, "gi")
    for (const m of text.matchAll(before)) {
      const digits = m[1] ?? m[2]
      const start = m.index + m[0].lastIndexOf(digits)
      found.push({ start, end: start + digits.length })
    }
    for (const m of text.matchAll(/(?<![\d,.])(\d{4,8})(?!\d)\s+(?:is\s+(?:my|the|your)\s+)?(?:otp|verification code)\b/gi))
      found.push({ start: m.index, end: m.index + m[1].length })
    return found
  },
  card: (text) =>
    [...text.matchAll(/(?<![\d-])\d(?:[ -]?\d){12,18}(?![\d-])/g)]
      // Real card numbers start 2–6 (Visa, Mastercard, Amex, Discover, RuPay 6x) or 8 (RuPay 8x).
      .filter((m) => /^[2-68]/.test(m[0]) && luhn(m[0]) && !/^(\d)\1+$/.test(m[0].replace(/\D/g, "")))
      .map((m) => ({ start: m.index, end: m.index + m[0].length })),
  aadhaar: (text) =>
    [...text.matchAll(/(?<![\d-])[2-9]\d{3}([ -]?)\d{4}\1\d{4}(?![\d-])/g)].filter((m) => verhoeff(m[0])).map((m) => ({ start: m.index, end: m.index + m[0].length })),
  pan: (text) => [...text.matchAll(/\b[A-Z]{3}[ABCFGHJLPT][A-Z]\d{4}[A-Z]\b/gi)].map((m) => ({ start: m.index, end: m.index + m[0].length })),
  email: (text) => [...text.matchAll(/[\p{L}\p{N}._%+-]+@[\p{L}\p{N}-]+(?:\.[\p{L}\p{N}-]+)*\.\p{L}{2,}/gu)].map((m) => ({ start: m.index, end: m.index + m[0].length })),
  address: (text) => {
    const found: { start: number; end: number }[] = []
    // Indian addresses: an address word within the same line before a 6-digit PIN code.
    for (const pin of text.matchAll(/(?<![\d-])[1-9]\d{2}\s?\d{3}(?![\d-])/g)) {
      const from = Math.max(0, pin.index - 140)
      let window = text.slice(from, pin.index)
      // Start after the last line break, "!", "?", "Label:" or full stop before a capital ("Thanks. Flat 12…").
      const breaks = [...window.matchAll(/\n|[!?]|:\s|\.\s+(?=[A-Z])/g)]
      const cut = breaks.length ? breaks[breaks.length - 1].index + breaks[breaks.length - 1][0].length : 0
      const offset = from + cut
      window = window.slice(cut)
      if (!ADDRESS_WORDS.test(window)) continue
      const startMatch = window.match(ADDRESS_START) ?? window.match(ADDRESS_WORDS)
      const lead = startMatch ? startMatch.index! + (startMatch[0].length - startMatch[0].trimStart().replace(/^,/, "").trimStart().length) : 0
      found.push({ start: offset + lead, end: pin.index + pin[0].length })
    }
    // US-style street lines: "221 Baker Street", "1600 Amphitheatre Pkwy, Suite 4".
    for (const m of text.matchAll(/\b\d{1,5}\s+(?:[A-Z][a-z]+\s+){1,3}(?:St|Street|Ave|Avenue|Rd|Road|Blvd|Boulevard|Lane|Ln|Dr|Drive|Way|Court|Ct|Pkwy|Parkway)\b\.?(?:,?\s+(?:Apt|Suite|Unit|#)\s*\w+)?/g))
      found.push({ start: m.index, end: m.index + m[0].length })
    return found
  },
  phone: (text) =>
    [
      ...text.matchAll(/(?<![\w+])(?:(?:\+|00)91[\s-]?|0)?[6-9]\d{4}[\s-]?\d{5}(?!\d)/g),
      ...text.matchAll(/(?<![\w+])\+\d{1,3}[\s.-]?\(?\d{1,4}\)?(?:[\s.-]?\d{2,4}){2,4}(?!\d)/g),
      ...text.matchAll(/(?<![\d(])\(?\b\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}(?!\d)/g),
    ]
      .filter((m) => digitCount(m[0]) >= 10 && digitCount(m[0]) <= 15)
      .map((m) => ({ start: m.index, end: m.index + m[0].length })),
}

/**
 * Finds personal details in text: OTPs next to words like "OTP" or "code", Luhn-valid card numbers,
 * Verhoeff-valid Aadhaar numbers, PANs with a real holder-type letter, emails, street addresses
 * ending in a PIN code, and phone numbers. Overlaps go to the likelier kind. Never throws.
 */
export function detectPii(text: string, kinds: PiiKind[] = PII_KINDS): PiiMatch[] {
  if (typeof text !== "string" || !text) return []
  const accepted: PiiMatch[] = []
  for (const kind of PII_KINDS) {
    if (!kinds.includes(kind)) continue
    let spans: { start: number; end: number }[] = []
    try {
      spans = DETECTORS[kind](text)
    } catch {
      continue
    }
    for (const { start, end } of spans) {
      if (end <= start || accepted.some((m) => start < m.end && end > m.start)) continue
      accepted.push({ kind, value: text.slice(start, end), start, end })
    }
  }
  return accepted.sort((a, b) => a.start - b.start)
}

/** Keeps the last `keep` digits and the layout: "98765 43210" → "XXXXX XXX10". */
const maskDigits = (value: string, keep: number) => {
  let left = value.replace(/\D/g, "").length - keep
  return value.replace(/\d/g, (d) => (left-- > 0 ? "X" : d))
}

/**
 * The masked form of a detail, following each format's convention (UIDAI's "XXXX XXXX 1234",
 * cards' last four). `addressText` replaces an address outright.
 */
export function maskPii(match: Pick<PiiMatch, "kind" | "value">, addressText = "[address removed]"): string {
  const { kind, value } = match
  switch (kind) {
    case "otp": return value.replace(/\d/g, "X")
    case "card":
    case "aadhaar": return maskDigits(value, 4)
    case "pan": return "XXXXXX" + value.slice(-4)
    case "email": {
      const at = value.lastIndexOf("@")
      return `${value[0]}•••${value.slice(at)}`
    }
    case "address": return addressText
    case "phone": {
      const country = value.match(/^(?:\+|00)\d{1,3}[\s-]?/)?.[0] ?? ""
      return country + maskDigits(value.slice(country.length), 2)
    }
  }
}

/**
 * Replaces each match by its position, so masking one detail never touches the same digits
 * inside another number ("OTP 4829" masked leaves "order 148290" alone). Matches must come
 * from `detectPii(text)`; any whose text no longer sits at its offset is skipped.
 */
export function maskMatches(text: string, matches: PiiMatch[], replace: (match: PiiMatch) => string = (m) => maskPii(m)): string {
  let out = text
  for (const m of [...matches].sort((a, b) => b.start - a.start)) {
    if (out.slice(m.start, m.end) === m.value) out = out.slice(0, m.start) + replace(m) + out.slice(m.end)
  }
  return out
}
