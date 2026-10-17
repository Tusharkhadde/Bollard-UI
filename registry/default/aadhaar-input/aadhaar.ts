// Bollard UI — aadhaar-input · MIT licence · https://bollard-ui.vercel.app/components/aadhaar-input

// Verhoeff tables (dihedral group D5), as used for the Aadhaar and VID check digit.
const D = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], [1, 2, 3, 4, 0, 6, 7, 8, 9, 5], [2, 3, 4, 0, 1, 7, 8, 9, 5, 6], [3, 4, 0, 1, 2, 8, 9, 5, 6, 7], [4, 0, 1, 2, 3, 9, 5, 6, 7, 8],
  [5, 9, 8, 7, 6, 0, 4, 3, 2, 1], [6, 5, 9, 8, 7, 1, 0, 4, 3, 2], [7, 6, 5, 9, 8, 2, 1, 0, 4, 3], [8, 7, 6, 5, 9, 3, 2, 1, 0, 4], [9, 8, 7, 6, 5, 4, 3, 2, 1, 0],
]
const P = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], [1, 5, 7, 6, 2, 8, 3, 0, 9, 4], [5, 8, 0, 3, 7, 9, 6, 1, 4, 2], [8, 9, 1, 6, 0, 4, 3, 5, 2, 7],
  [9, 4, 5, 3, 1, 2, 6, 8, 7, 0], [4, 2, 8, 6, 5, 7, 3, 9, 0, 1], [2, 7, 9, 3, 8, 0, 6, 4, 1, 5], [7, 0, 4, 6, 9, 1, 3, 2, 5, 8],
]

/** True when the last digit is a valid Verhoeff check digit. Catches every single wrong digit and every swapped neighbour pair. */
export function verhoeffValid(digits: string): boolean {
  if (!/^\d+$/.test(digits)) return false
  let c = 0
  for (let i = 0; i < digits.length; i++) c = D[c][P[i % 8][Number(digits[digits.length - 1 - i])]]
  return c === 0
}

export type AadhaarKind = "aadhaar" | "vid" | "enrolment" | "masked" | "pan" | "mobile" | "unknown"

export type AadhaarProblem =
  | { kind: "first-digit" }
  | { kind: "checksum"; swap?: { at: number; fixed: string } }
  | { kind: "letters"; fixed: string }
  | { kind: "length"; count: number; expected: number }
  | { kind: "wrong-kind"; found: AadhaarKind }

export interface AadhaarReading {
  /** Digits only (Devanagari and other Indian-script digits converted). */
  digits: string
  kind: AadhaarKind
  valid: boolean
  /** Spaces, dashes or dots were removed: typical of a number copied from a photocopy or PDF. */
  hadSeparators: boolean
  problem?: AadhaarProblem
}

const LOOKALIKE: Record<string, string> = { O: "0", o: "0", D: "0", I: "1", l: "1", i: "1", "|": "1", Z: "2", z: "2", S: "5", s: "5", B: "8", b: "6", G: "6", q: "9", g: "9" }

/** Converts Devanagari, Bengali, Gujarati, Gurmukhi, Odia, Tamil, Telugu, Kannada, Malayalam and full-width digits to ASCII. */
export function toAsciiDigits(text: string): string {
  return text.replace(/[\u0966-\u096F\u09E6-\u09EF\u0A66-\u0A6F\u0AE6-\u0AEF\u0B66-\u0B6F\u0BE6-\u0BEF\u0C66-\u0C6F\u0CE6-\u0CEF\u0D66-\u0D6F\uFF10-\uFF19]/g, (ch) => {
    const code = ch.charCodeAt(0)
    return String(code >= 0xff10 ? code - 0xff10 : (code - 0x0966) % 0x80)
  })
}

/** "XXXX XXXX 1234": the form UIDAI recommends showing and keeping. */
export function maskAadhaar(digits: string, mask = "X"): string {
  const d = digits.replace(/\D/g, "")
  if (d.length < 4) return d
  const masked = mask.repeat(d.length - 4) + d.slice(-4)
  return masked.match(/.{1,4}/g)!.join(" ")
}

export function groupDigits(digits: string): string {
  return digits.match(/.{1,4}/g)?.join(" ") ?? ""
}

/**
 * The one swap of neighbouring digits that makes the checksum pass, when there is exactly one.
 * Only a candidate: a single mistyped digit (the commonest error) also yields exactly one "passing"
 * swap about 40% of the time, and applying it gives a different, valid-looking number. Never auto-apply it.
 */
function findSwap(digits: string, kind: "aadhaar" | "vid") {
  const fixes: { at: number; fixed: string }[] = []
  for (let i = 0; i < digits.length - 1; i++) {
    if (digits[i] === digits[i + 1]) continue
    const fixed = digits.slice(0, i) + digits[i + 1] + digits[i] + digits.slice(i + 2)
    if (verhoeffValid(fixed) && (kind === "vid" || /^[2-9]/.test(fixed))) fixes.push({ at: i, fixed })
  }
  return fixes.length === 1 ? fixes[0] : undefined
}

/**
 * Reads whatever was typed or pasted into an Aadhaar field. `accept` is what the field wants.
 * Recognises a 16-digit VID, a 28-digit enrolment ID from the enrolment slip, a masked Aadhaar,
 * a PAN and a mobile number pasted by mistake, and letters that are really digits (O, I, l, S).
 */
export function readAadhaar(input: unknown, accept: "aadhaar" | "vid" | "either" = "aadhaar"): AadhaarReading {
  const raw = toAsciiDigits(typeof input === "string" ? input.replace(/^\uFEFF/, "").slice(0, 200) : typeof input === "number" && Number.isFinite(input) ? String(input) : "")
  const compact = raw.replace(/[\s\u00A0\-–—.·/]+/g, "")
  const hadSeparators = /\d[\s\u00A0\-–—.·/]+\d/.test(raw.trim())
  const digits = compact.replace(/\D/g, "")
  const base = { digits, hadSeparators }
  if (!compact) return { ...base, kind: "unknown", valid: false }
  if (/^[A-Z]{5}\d{4}[A-Z]$/i.test(compact)) return { ...base, kind: "pan", valid: false, problem: { kind: "wrong-kind", found: "pan" } }
  if (/^[xX*•]{4,12}\d{4}$/.test(compact)) return { ...base, kind: "masked", valid: false, problem: { kind: "wrong-kind", found: "masked" } }
  if (/[^\d]/.test(compact)) {
    const fixed = compact.replace(/[^\d]/g, (ch) => LOOKALIKE[ch] ?? ch)
    if (/^\d+$/.test(fixed) && (fixed.length === 12 || fixed.length === 16)) return { ...base, digits: fixed, kind: fixed.length === 16 ? "vid" : "aadhaar", valid: false, problem: { kind: "letters", fixed } }
  }
  // A mobile number pasted with its +91 or 0 prefix: "+91 98765 43210", "098765 43210".
  const mobile = (digits.length === 10 && /^[6-9]/.test(digits)) || (digits.length === 11 && /^0[6-9]/.test(digits)) || (digits.length === 12 && /^\+\s*91/.test(compact) && /^91[6-9]/.test(digits))
  const kind: AadhaarKind = mobile ? "mobile" : digits.length === 16 ? "vid" : digits.length === 28 || digits.length === 14 ? "enrolment" : digits.length === 12 ? "aadhaar" : "unknown"
  if (kind === "enrolment" || kind === "mobile") return { ...base, kind, valid: false, problem: { kind: "wrong-kind", found: kind } }
  if (kind === "unknown") {
    const expected = accept === "vid" || (accept === "either" && digits.length > 12) ? 16 : 12
    return { ...base, kind, valid: false, problem: { kind: "length", count: digits.length, expected } }
  }
  if (accept !== "either" && kind !== accept) return { ...base, kind, valid: false, problem: { kind: "wrong-kind", found: kind } }
  if (kind === "aadhaar" && /^[01]/.test(digits)) return { ...base, kind, valid: false, problem: { kind: "first-digit" } }
  if (!verhoeffValid(digits)) return { ...base, kind, valid: false, problem: { kind: "checksum", swap: findSwap(digits, kind) } }
  return { ...base, kind, valid: true }
}
