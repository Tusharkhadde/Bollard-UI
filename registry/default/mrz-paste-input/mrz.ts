/**
 * ICAO Doc 9303 TD3 (passport) machine readable zone: two lines of 44 characters.
 * Part 3 §4.9: check digits use weights 7-3-1, modulus 10, with 0–9 = 0–9, A–Z = 10–35 and "<" = 0.
 * Part 4 §4.2.2: line 2 holds the document number (1–9, check 10), nationality (11–13), date of birth (14–19,
 * check 20), sex (21), date of expiry (22–27, check 28), personal number (29–42, check 43) and a composite
 * check (44) over positions 1–10, 14–20 and 22–43.
 */

export interface MrzFields {
  /** "P" plus the type letter, e.g. "P<" or "PD". */
  documentCode: string
  issuingState: string
  surname: string
  givenNames: string
  number: string
  nationality: string
  /** YYYY-MM-DD, century guessed from today. */
  birthDate: string | null
  sex: "M" | "F" | "X" | "<"
  expiryDate: string | null
  personalNumber: string
}

export type MrzField = "number" | "birthDate" | "expiryDate" | "personalNumber" | "composite"

export type MrzIssue =
  | { kind: "length"; lengths: number[]; fixed?: string }
  | { kind: "idCard"; format: "TD1" | "TD2" }
  | { kind: "swapped"; fixed: string }
  | { kind: "notPassport"; code: string }
  | { kind: "badChar"; line: 1 | 2; position: number; char: string }
  | { kind: "ocr"; what: "digits" | "letters" | "filler"; line: 1 | 2; positions: number[]; from: string; to: string; fixed: string; certain: boolean }
  | { kind: "check"; field: MrzField; found: string; expected: string; fixes: { fixed: string; change: "digit" | "data"; from: string; to: string }[] }
  | { kind: "badDate"; field: "birthDate" | "expiryDate"; value: string }
  /** 9303-3 §4.8: an unknown day, month or year of birth is written as "<". Not an error; `year` is set when known. */
  | { kind: "unknownBirthDate"; year: number | null }
  | { kind: "truncated" }
  | { kind: "expired"; date: string; days: number }
  | { kind: "expiresSoon"; date: string; days: number }

export interface MrzResult {
  /** The two cleaned lines, or what could be cleaned. */
  lines: string[]
  fields: MrzFields | null
  issues: MrzIssue[]
  /** True when the MRZ as pasted passes every structural and check-digit test. */
  valid: boolean
  /**
   * Each check digit as pasted: "ok", "fail", or "pending" when it only passes once a suggested OCR fix is taken.
   * Fields and dates are read as if the certain OCR fixes were taken, so use this before trusting a value.
   */
  checks: Partial<Record<MrzField, "ok" | "fail" | "pending">>
}

const MAX_INPUT = 600
const VALUE = (c: string) => (c >= "0" && c <= "9" ? c.charCodeAt(0) - 48 : c >= "A" && c <= "Z" ? c.charCodeAt(0) - 55 : c === "<" ? 0 : NaN)

/** ICAO 9303 check digit of `s`, or NaN if it holds a character the MRZ can't contain. */
export function checkDigit(s: string): number {
  let sum = 0
  for (let i = 0; i < s.length; i++) sum += VALUE(s[i]) * [7, 3, 1][i % 3]
  return sum % 10
}

/** Pasted text → MRZ lines: drops a BOM, CRLF, spaces and zero-width marks, upper-cases and maps «‹ to "<". */
export function cleanMrz(text: unknown): string[] {
  const s = String(text ?? "").slice(0, MAX_INPUT).replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n").toUpperCase()
  const lines = s.split("\n").map((l) => l.replace(/[\s\u200B-\u200D\u2060]/g, "").replace(/[«‹〈＜]/g, "<")).filter(Boolean)
  if (lines.length === 1 && lines[0].length === 88) return [lines[0].slice(0, 44), lines[0].slice(44)]
  return lines
}

const DIGIT_FOR: Record<string, string> = { O: "0", Q: "0", D: "0", U: "0", I: "1", L: "1", Z: "2", S: "5", G: "6", B: "8", T: "7" }
const LETTER_FOR: Record<string, string> = { "0": "O", "1": "I", "2": "Z", "5": "S", "6": "G", "8": "B" }
const LOOKALIKE: Record<string, string[]> = { "0": ["O", "D", "Q"], O: ["0"], D: ["0"], Q: ["0"], "1": ["I", "L"], I: ["1"], L: ["1"], "2": ["Z"], Z: ["2"], "5": ["S"], S: ["5"], "6": ["G"], G: ["6"], "8": ["B"], B: ["8"] }

/** Line 2 positions (0-based) that must be digits: check digits and both dates. */
const DIGIT_POS = [9, 13, 14, 15, 16, 17, 18, 19, 21, 22, 23, 24, 25, 26, 27, 43]
const join = (a: string, b: string) => `${a}\n${b}`
const put = (s: string, i: number, c: string) => s.slice(0, i) + c + s.slice(i + 1)

function date(yymmdd: string, kind: "birth" | "expiry", today: Date): string | null {
  if (!/^\d{6}$/.test(yymmdd)) return null
  const yy = +yymmdd.slice(0, 2), mm = +yymmdd.slice(2, 4), dd = +yymmdd.slice(4, 6)
  const now = today.getUTCFullYear()
  let year = 2000 + yy
  const todayDay = Date.UTC(now, today.getUTCMonth(), today.getUTCDate())
  if (kind === "birth" && Date.UTC(year, mm - 1, dd) > todayDay) year -= 100
  if (kind === "expiry" && year > now + 30) year -= 100
  const d = new Date(Date.UTC(year, mm - 1, dd))
  return d.getUTCMonth() === mm - 1 && d.getUTCDate() === dd ? d.toISOString().slice(0, 10) : null
}

const FIELDS: { field: MrzField; start: number; end: number; check: number; letters: boolean }[] = [
  { field: "number", start: 0, end: 9, check: 9, letters: true },
  { field: "birthDate", start: 13, end: 19, check: 19, letters: false },
  { field: "expiryDate", start: 21, end: 27, check: 27, letters: false },
  { field: "personalNumber", start: 28, end: 42, check: 42, letters: true },
]
const compositeOf = (l2: string) => l2.slice(0, 10) + l2.slice(13, 20) + l2.slice(21, 43)
const fieldOk = (l2: string, f: (typeof FIELDS)[number]) => {
  const data = l2.slice(f.start, f.end)
  const cd = l2[f.check]
  // 9303-4: with no personal number, its check digit may be "<" or 0.
  if (f.field === "personalNumber" && /^<*$/.test(data) && (cd === "<" || cd === "0")) return true
  return String(checkDigit(data)) === cd
}
const compositeOk = (l2: string) => String(checkDigit(compositeOf(l2))) === l2[43]

/** Validates a pasted TD3 MRZ, explains every problem and offers corrected text for each fixable one. Never throws. */
export function parseMrz(text: unknown, today: Date = new Date()): MrzResult {
  const lines = cleanMrz(text)
  const issues: MrzIssue[] = []
  const now = Number.isNaN(today?.getTime?.()) ? new Date() : today
  if (!lines.length) return { lines, fields: null, issues, valid: false, checks: {} }

  if (lines.length === 3 && lines.every((l) => l.length === 30)) return { lines, fields: null, issues: [{ kind: "idCard", format: "TD1" }], valid: false, checks: {} }
  if (lines.length === 2 && lines.every((l) => l.length === 36)) return { lines, fields: null, issues: [{ kind: "idCard", format: "TD2" }], valid: false, checks: {} }
  if (lines.length !== 2 || lines.some((l) => l.length !== 44)) {
    // Copying often drops the trailing "<" fillers of the name line: pad it back when line 2 is complete.
    const [a, b] = lines
    const fixed = lines.length === 2 && a.startsWith("P") && a.length >= 30 && a.length < 44 && b.length === 44 ? join(a.padEnd(44, "<"), b) : undefined
    return { lines, fields: null, issues: [{ kind: "length", lengths: lines.map((l) => l.length), fixed }], valid: false, checks: {} }
  }

  let [l1, l2] = lines
  if (!l1.startsWith("P") && l2.startsWith("P")) {
    issues.push({ kind: "swapped", fixed: join(l2, l1) })
    ;[l1, l2] = [l2, l1]
  }
  if (!l1.startsWith("P")) issues.push({ kind: "notPassport", code: l1.slice(0, 2) })

  // OCR slips the reader could not have meant: letters in digit-only places, digits in names, "K" read for "<".
  // Each fix is offered on its own; validation below runs as if every certain fix were taken, and `checks`
  // marks the fields that only pass because of one. Uncertain fixes are offered but never assumed.
  const [b1, b2] = [l1, l2]
  const pending2 = new Set<number>()
  const ocr = (what: "digits" | "letters" | "filler", line: 1 | 2, positions: number[], map: (c: string) => string, certain = true) => {
    if (!positions.length) return
    const apply = (s: string) => positions.reduce((a, p) => put(a, p, map(a[p])), s)
    const cur = line === 1 ? l1 : l2
    const from = positions.map((p) => cur[p]).join("")
    const to = positions.map((p) => map(cur[p])).join("")
    if (certain && line === 1) l1 = apply(l1)
    else if (certain) { l2 = apply(l2); positions.forEach((p) => pending2.add(p)) }
    issues.push({ kind: "ocr", what, line, positions, from, to, fixed: line === 1 ? join(apply(b1), b2) : join(b1, apply(b2)), certain })
  }
  const positionsIn = (s: string, from: number, to: number, test: (c: string) => boolean) => Array.from({ length: to - from }, (_, i) => from + i).filter((p) => test(s[p]))
  ocr("digits", 2, DIGIT_POS.filter((p) => DIGIT_FOR[l2[p]]), (c) => DIGIT_FOR[c])
  ocr("letters", 1, positionsIn(l1, 2, 44, (c) => !!LETTER_FOR[c]), (c) => LETTER_FOR[c])
  ocr("letters", 2, positionsIn(l2, 10, 13, (c) => !!LETTER_FOR[c]), (c) => LETTER_FOR[c])
  // A run of "<" and "K" at the end of the name: every K after the first "<" was a misread filler.
  const tailStart = 44 - (/[<K]*$/.exec(l1.slice(5))?.[0].length ?? 0)
  const firstFill = l1.indexOf("<", tailStart)
  ocr("filler", 1, firstFill < 0 ? [] : positionsIn(l1, firstFill, 44, (c) => c === "K"), () => "<")
  const opt = l2.slice(28, 42)
  if (/^[<K]+$/.test(opt) && /K/.test(opt) && /</.test(opt)) ocr("filler", 2, positionsIn(l2, 28, 42, (c) => c === "K"), () => "<")
  // No "<<" between surname and given names but a "KK" between letters: probably the separator. Only a suggestion.
  const nameZone = l1.slice(5).replace(/<+$/, "")
  const kk = nameZone.includes("<<") ? null : /[A-Z]KK[A-Z]/.exec(nameZone)
  if (kk) ocr("filler", 1, [5 + kk.index + 1, 5 + kk.index + 2], () => "<", false)

  for (const [line, s] of [[1, l1], [2, l2]] as const)
    for (let i = 0; i < 44; i++) if (Number.isNaN(VALUE(s[i]))) issues.push({ kind: "badChar", line, position: i + 1, char: s[i] })
  if (issues.some((i) => i.kind === "badChar")) return { lines: [l1, l2], fields: null, issues, valid: false, checks: {} }

  // Check digits, each with the likeliest fix: a lookalike character in the data, or the check digit itself.
  const checks: MrzResult["checks"] = {}
  const touched = (from: number, to: number) => [...pending2].some((p) => p >= from && p <= to)
  for (const f of FIELDS) {
    checks[f.field] = fieldOk(l2, f) ? (touched(f.start, f.check) ? "pending" : "ok") : "fail"
    if (fieldOk(l2, f)) continue
    const data = l2.slice(f.start, f.end)
    const fixes: { fixed: string; change: "digit" | "data"; from: string; to: string }[] = []
    if (f.letters)
      for (let i = f.start; i < f.end; i++)
        for (const alt of LOOKALIKE[l2[i]] ?? []) {
          const next = put(l2, i, alt)
          if (fieldOk(next, f) && compositeOk(next)) fixes.push({ fixed: join(l1, next), change: "data", from: l2[i], to: alt })
        }
    const withDigit = put(l2, f.check, String(checkDigit(data)))
    if (compositeOk(withDigit) || !fixes.length) fixes.push({ fixed: join(l1, withDigit), change: "digit", from: l2[f.check], to: String(checkDigit(data)) })
    issues.push({ kind: "check", field: f.field, found: l2[f.check], expected: String(checkDigit(data)), fixes: fixes.slice(0, 2) })
  }
  checks.composite = compositeOk(l2) ? (touched(0, 9) || touched(13, 19) || touched(21, 43) ? "pending" : "ok") : "fail"
  if (!issues.some((i) => i.kind === "check") && !compositeOk(l2)) {
    const expected = String(checkDigit(compositeOf(l2)))
    issues.push({ kind: "check", field: "composite", found: l2[43], expected, fixes: [{ fixed: join(l1, put(l2, 43, expected)), change: "digit", from: l2[43], to: expected }] })
  }

  const names = l1.slice(5).replace(/<+$/, "")
  const [surname, ...given] = names.split("<<")
  const fields: MrzFields = {
    documentCode: l1.slice(0, 2),
    issuingState: l1.slice(2, 5).replace(/</g, ""),
    surname: surname.replace(/</g, " ").trim(),
    givenNames: given.join(" ").replace(/</g, " ").replace(/\s+/g, " ").trim(),
    number: l2.slice(0, 9).replace(/<+$/, ""),
    nationality: l2.slice(10, 13).replace(/</g, ""),
    birthDate: date(l2.slice(13, 19), "birth", now),
    sex: (["M", "F", "X"].includes(l2[20]) ? l2[20] : "<") as MrzFields["sex"],
    expiryDate: date(l2.slice(21, 27), "expiry", now),
    personalNumber: l2.slice(28, 42).replace(/<+$/, "").replace(/</g, " "),
  }
  const dob = l2.slice(13, 19)
  if (!fields.birthDate && /^[\d<]{6}$/.test(dob) && dob.includes("<") && /^(\d\d|<<)(\d\d|<<)(\d\d|<<)$/.test(dob)) {
    const yy = /^\d\d/.test(dob) ? +dob.slice(0, 2) : null
    issues.push({ kind: "unknownBirthDate", year: yy === null ? null : 2000 + yy > now.getUTCFullYear() ? 1900 + yy : 2000 + yy })
  } else if (!fields.birthDate) issues.push({ kind: "badDate", field: "birthDate", value: dob })
  if (!fields.expiryDate) issues.push({ kind: "badDate", field: "expiryDate", value: l2.slice(21, 27) })
  // 9303-3 §4.6: a name that fills the last position may have been cut short.
  if (l1[43] !== "<") issues.push({ kind: "truncated" })
  if (fields.expiryDate) {
    const days = Math.round((Date.parse(fields.expiryDate) - Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())) / 86_400_000)
    if (days < 0) issues.push({ kind: "expired", date: fields.expiryDate, days: -days })
    else if (days <= 182) issues.push({ kind: "expiresSoon", date: fields.expiryDate, days })
  }
  const blocking = issues.some((i) => !["truncated", "expiresSoon", "expired", "unknownBirthDate"].includes(i.kind))
  return { lines: [l1, l2], fields, issues, valid: !blocking, checks }
}
