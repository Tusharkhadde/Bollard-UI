/** Which tax number a TaxIdInput holds. */
export type TaxIdKind = "gstin" | "pan" | "vat"

/** GST state and UT codes (Census 2011 numbering, as used on the GST portal). */
export const GST_STATES: Record<string, string> = {
  "01": "Jammu and Kashmir", "02": "Himachal Pradesh", "03": "Punjab", "04": "Chandigarh", "05": "Uttarakhand",
  "06": "Haryana", "07": "Delhi", "08": "Rajasthan", "09": "Uttar Pradesh", "10": "Bihar", "11": "Sikkim",
  "12": "Arunachal Pradesh", "13": "Nagaland", "14": "Manipur", "15": "Mizoram", "16": "Tripura", "17": "Meghalaya",
  "18": "Assam", "19": "West Bengal", "20": "Jharkhand", "21": "Odisha", "22": "Chhattisgarh", "23": "Madhya Pradesh",
  "24": "Gujarat", "25": "Daman and Diu (before 2020)", "26": "Dadra and Nagar Haveli and Daman and Diu",
  "27": "Maharashtra", "28": "Andhra Pradesh (before 2014)", "29": "Karnataka", "30": "Goa", "31": "Lakshadweep",
  "32": "Kerala", "33": "Tamil Nadu", "34": "Puducherry", "35": "Andaman and Nicobar Islands", "36": "Telangana",
  "37": "Andhra Pradesh", "38": "Ladakh", "96": "Foreign country", "97": "Other Territory", "99": "Centre Jurisdiction",
}

/** PAN holder status from its 4th character (Income Tax Department). */
export const PAN_HOLDERS: Record<string, string> = {
  P: "Individual", C: "Company", H: "Hindu Undivided Family", F: "Firm / LLP", A: "Association of Persons",
  T: "Trust", B: "Body of Individuals", L: "Local Authority", J: "Artificial Juridical Person", G: "Government",
}

/**
 * EU VAT number bodies after the prefix (VIES). `d` digit, `l` letter, `x` letter or digit, anything else literal.
 * Greece is EL, not GR; Northern Ireland is XI.
 */
export const VAT_FORMATS: Record<string, string[]> = {
  AT: ["Udddddddd"], BE: ["0ddddddddd", "1ddddddddd"], BG: ["ddddddddd", "dddddddddd"], CY: ["ddddddddl"],
  CZ: ["dddddddd", "ddddddddd", "dddddddddd"], DE: ["ddddddddd"], DK: ["dddddddd"], EE: ["ddddddddd"],
  EL: ["ddddddddd"], ES: ["xdddddddx"], FI: ["dddddddd"], FR: ["xxddddddddd"], HR: ["ddddddddddd"],
  HU: ["dddddddd"], IE: ["dddddddl", "dddddddll", "dxdddddl"], IT: ["ddddddddddd"],
  LT: ["ddddddddd", "dddddddddddd"], LU: ["dddddddd"], LV: ["ddddddddddd"], MT: ["dddddddd"],
  NL: ["dddddddddBdd"], PL: ["dddddddddd"], PT: ["ddddddddd"],
  RO: ["dd", "ddd", "dddd", "ddddd", "dddddd", "ddddddd", "dddddddd", "ddddddddd", "dddddddddd"],
  SE: ["dddddddddd01"], SI: ["dddddddd"], SK: ["dddddddddd"], XI: ["ddddddddd", "dddddddddddd", "GDddd", "HAddd"],
}

const GSTIN = "ddlllllddddlxZx"
const PAN = "lllllddddl"
const CHARSET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ"
const TO_DIGIT: Record<string, string> = { O: "0", Q: "0", D: "0", I: "1", L: "1", Z: "2", S: "5", G: "6", T: "7", B: "8" }
const TO_LETTER: Record<string, string> = { "0": "O", "1": "I", "2": "Z", "5": "S", "6": "G", "7": "T", "8": "B" }
const CONFUSABLE = new Set(["O0", "0O", "I1", "1I", "L1", "1L", "Z2", "2Z", "S5", "5S", "B8", "8B", "G6", "6G"])

/** Strips spaces, dots and dashes and upper-cases. */
export const cleanTaxId = (text: string) => text.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 16)

const fits = (slot: string, ch: string) =>
  slot === "d" ? /\d/.test(ch) : slot === "l" ? /[A-Z]/.test(ch) : slot === "x" ? /[A-Z\d]/.test(ch) : slot === ch

/** Index of the first character that breaks the pattern, or -1. */
function firstMismatch(value: string, pattern: string) {
  for (let i = 0; i < Math.min(value.length, pattern.length); i++) if (!fits(pattern[i], value[i])) return i
  return -1
}

/** The GSTIN check character for its first 14 characters (GSTN mod-36, weights 1,2,1,2… from the left). */
export function gstinCheckChar(first14: string) {
  let sum = 0
  for (let i = 0; i < 14; i++) {
    const product = CHARSET.indexOf(first14[i]) * (i % 2 ? 2 : 1)
    sum += Math.floor(product / 36) + (product % 36)
  }
  return CHARSET[(36 - (sum % 36)) % 36]
}

export interface TaxIdResult {
  status: "empty" | "incomplete" | "invalid" | "valid"
  /** Print grouping, e.g. [2, 10, 3] for a GSTIN. */
  groups: number[]
  /** Expected length, when there is exactly one. */
  expected?: number
  /** Message key and the characters it is about. */
  code?: "short" | "long" | "letter" | "digit" | "literal" | "state" | "holder" | "entity" | "check" | "swapped" | "prefix" | "greece" | "country"
  at?: number[]
  /** The literal character a fixed slot needs, for "literal" errors. */
  want?: string
  /** The value with the one-tap correction applied. */
  fix?: string
  /** Facts decoded from the number, for the readback. */
  facts: string[]
}

/** A mismatch at `i`: name what the slot wants and offer the look-alike when there is an obvious one. */
function slotError(value: string, pattern: string, i: number, offset = 0): Partial<TaxIdResult> {
  const slot = pattern[i - offset]
  const ch = value[i]
  const swap = slot === "d" ? TO_DIGIT[ch] : slot === "l" ? TO_LETTER[ch] : slot === ch ? undefined : TO_LETTER[ch] === slot ? slot : undefined
  return {
    code: slot === "d" ? "digit" : slot === "l" || slot === "x" ? "letter" : "literal",
    at: [i],
    want: slot,
    fix: swap ? value.slice(0, i) + swap + value.slice(i + 1) : undefined,
  }
}

function checkGstin(v: string, done: boolean): TaxIdResult {
  const base: TaxIdResult = { status: "invalid", groups: [2, 10, 3], expected: 15, facts: [] }
  const miss = firstMismatch(v, GSTIN)
  if (miss >= 0) return { ...base, ...slotError(v, GSTIN, miss) }
  if (v.length >= 2 && !GST_STATES[v.slice(0, 2)]) return { ...base, code: "state", at: [0, 1] }
  if (v.length >= 6 && !PAN_HOLDERS[v[5]]) return { ...base, code: "holder", at: [5] }
  if (v[12] === "0") return { ...base, code: "entity", at: [12] }
  if (v.length > 15) return { ...base, code: "long" }
  if (v.length < 15) return { ...base, status: done ? "invalid" : "incomplete", code: done ? "short" : undefined }
  const facts = [GST_STATES[v.slice(0, 2)], PAN_HOLDERS[v[5]], `Registration ${CHARSET.indexOf(v[12])}`]
  const want = gstinCheckChar(v)
  if (want === v[14]) return { ...base, status: "valid", facts }
  // A look-alike in the check slot is the likeliest slip; otherwise look for exactly one adjacent swap.
  if (CONFUSABLE.has(v[14] + want)) return { ...base, code: "check", at: [14], fix: v.slice(0, 14) + want }
  const swaps: number[] = []
  for (let i = 0; i < 14; i++) {
    if (v[i] === v[i + 1]) continue
    const s = v.slice(0, i) + v[i + 1] + v[i] + v.slice(i + 2)
    if (firstMismatch(s, GSTIN) < 0 && GST_STATES[s.slice(0, 2)] && gstinCheckChar(s) === s[14]) swaps.push(i)
  }
  return swaps.length === 1 ? { ...base, code: "swapped", at: [swaps[0], swaps[0] + 1] } : { ...base, code: "check", at: [14] }
}

function checkPan(v: string, done: boolean): TaxIdResult {
  const base: TaxIdResult = { status: "invalid", groups: [5, 4, 1], expected: 10, facts: [] }
  const miss = firstMismatch(v, PAN)
  if (miss >= 0) return { ...base, ...slotError(v, PAN, miss) }
  if (v.length >= 4 && !PAN_HOLDERS[v[3]]) return { ...base, code: "holder", at: [3] }
  if (v.length > 10) return { ...base, code: "long" }
  if (v.length < 10) return { ...base, status: done ? "invalid" : "incomplete", code: done ? "short" : undefined }
  return { ...base, status: "valid", facts: [PAN_HOLDERS[v[3]], `${v[3] === "P" ? "Surname" : "Name"} starts with ${v[4]}`] }
}

function checkVat(v: string, done: boolean, countryName: (code: string) => string | undefined): TaxIdResult {
  const prefix = v.slice(0, 2)
  const base: TaxIdResult = { status: "invalid", groups: [2, Math.max(v.length - 2, 1)], facts: [] }
  if (/^\d/.test(v)) return { ...base, code: "prefix", at: [0] }
  if (v.length < 2) return { ...base, status: "incomplete" }
  if (prefix === "GR") return { ...base, code: "greece", at: [0, 1], fix: "EL" + v.slice(2) }
  const formats = VAT_FORMATS[prefix]
  if (!formats) return { ...base, code: "country", at: [0, 1] }
  const body = v.slice(2)
  const lengths = formats.map((f) => f.length)
  const expected = new Set(lengths).size === 1 ? lengths[0] + 2 : undefined
  const out = { ...base, expected, facts: [countryName(prefix) ?? prefix] }
  if (formats.some((f) => f.length === body.length && firstMismatch(body, f) < 0)) return { ...out, status: "valid" }
  // Compare against the format of the same length, or the nearest one that is still being typed.
  const target = formats.find((f) => f.length === body.length) ?? formats.find((f) => f.length > body.length) ?? formats[formats.length - 1]
  const miss = firstMismatch(body, target)
  if (miss >= 0 && !formats.some((f) => f.length >= body.length && firstMismatch(body, f) < 0)) return { ...out, ...slotError(v, target, miss + 2, 2) }
  if (prefix === "BE" && body.length === 9 && done) return { ...out, code: "short", fix: "BE0" + body }
  if (body.length > Math.max(...lengths)) return { ...out, code: "long" }
  return { ...out, status: done ? "invalid" : "incomplete", code: done ? "short" : undefined }
}

/**
 * Checks a GSTIN (format, state code, PAN holder type, mod-36 check character), a PAN (format and holder type)
 * or an EU VAT number (country format). `done` is true once the user has left the field, so a short value
 * becomes an error instead of "still typing".
 */
export function checkTaxId(kind: TaxIdKind, value: string, done = false, countryName: (code: string) => string | undefined = () => undefined): TaxIdResult {
  const v = cleanTaxId(value)
  if (!v) return { status: "empty", groups: kind === "pan" ? [5, 4, 1] : kind === "gstin" ? [2, 10, 3] : [2], facts: [] }
  return kind === "gstin" ? checkGstin(v, done) : kind === "pan" ? checkPan(v, done) : checkVat(v, done, countryName)
}

/** Splits a value into its print groups; whatever is left over forms one last group. */
export function groupTaxId(value: string, groups: number[]) {
  const parts: string[] = []
  let at = 0
  for (const size of groups) {
    if (at >= value.length) break
    parts.push(value.slice(at, (at += size)))
  }
  if (at < value.length) parts.push(value.slice(at))
  return parts
}
