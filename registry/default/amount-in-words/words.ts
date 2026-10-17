// Bollard UI — amount-in-words · MIT licence · https://bollard-ui.vercel.app/components/amount-in-words

/** Number systems: lakh/crore (`indian`) or thousand/million/billion (`international`). */
export type NumberSystem = "indian" | "international"

/** How a currency is written on a cheque. `prefix` puts the unit first ("Rupees Ten Only"). */
export interface CurrencyWords {
  major: string
  majorOne: string
  minor: string
  minorOne: string
  prefix?: boolean
}

export const CURRENCY_WORDS: Record<string, CurrencyWords> = {
  INR: { major: "Rupees", majorOne: "Rupee", minor: "Paise", minorOne: "Paisa", prefix: true },
  USD: { major: "Dollars", majorOne: "Dollar", minor: "Cents", minorOne: "Cent" },
  EUR: { major: "Euros", majorOne: "Euro", minor: "Cents", minorOne: "Cent" },
  GBP: { major: "Pounds", majorOne: "Pound", minor: "Pence", minorOne: "Penny" },
  AED: { major: "Dirhams", majorOne: "Dirham", minor: "Fils", minorOne: "Fils" },
  SGD: { major: "Dollars", majorOne: "Dollar", minor: "Cents", minorOne: "Cent" },
}

const ONES = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"]
const TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"]
const SCALES: Record<string, number> = {
  hundred: 100, thousand: 1e3, lakh: 1e5, lakhs: 1e5, lac: 1e5, lacs: 1e5, crore: 1e7, crores: 1e7, cr: 1e7,
  million: 1e6, millions: 1e6, billion: 1e9, billions: 1e9, trillion: 1e12,
}
const SMALL: Record<string, number> = Object.fromEntries([
  ...ONES.map((w, i) => [w, i] as const),
  ...TENS.slice(2).map((w, i) => [w, (i + 2) * 10] as const),
  ["fourty", 40], ["ninty", 90],
])
const MAJOR_WORDS = new Set(["rupees", "rupee", "rs", "inr", "dollars", "dollar", "usd", "euros", "euro", "pounds", "pound", "dirhams", "dirham", "aed", "sgd"])
const MINOR_WORDS = new Set(["paise", "paisa", "cents", "cent", "pence", "penny", "fils"])
const FILLER = new Set(["and", "only", "of", "a", "exactly"])

function below1000(n: number) {
  const hundreds = Math.floor(n / 100)
  const rest = n % 100
  const tail = rest === 0 ? "" : rest < 20 ? ONES[rest] : TENS[Math.floor(rest / 10)] + (rest % 10 ? `-${ONES[rest % 10]}` : "")
  return [hundreds ? `${ONES[hundreds]} hundred` : "", tail].filter(Boolean).join(" ")
}

/** Spells a whole number: 250000 → "two lakh fifty thousand" (indian) or "two hundred fifty thousand". */
export function integerToWords(n: number, system: NumberSystem): string {
  n = Math.floor(Math.abs(n))
  if (n === 0) return "zero"
  const parts: string[] = []
  if (system === "indian") {
    const crore = Math.floor(n / 1e7)
    if (crore) parts.push(`${integerToWords(crore, "indian")} crore`)
    for (const [size, name] of [[1e5, "lakh"], [1e3, "thousand"]] as const) {
      const chunk = Math.floor(n / size) % 100
      if (chunk) parts.push(`${below1000(chunk)} ${name}`)
    }
  } else {
    const names = ["", "thousand", "million", "billion", "trillion"]
    for (let i = names.length - 1; i >= 1; i--) {
      const chunk = Math.floor(n / 1000 ** i) % 1000
      if (chunk) parts.push(`${below1000(chunk)} ${names[i]}`)
    }
  }
  if (n % 1000) parts.push(below1000(n % 1000))
  return parts.join(" ")
}

const titleCase = (text: string) => text.replace(/(^|[\s-])([a-z])/g, (_, gap: string, ch: string) => gap + ch.toUpperCase())

/**
 * Cheque wording for an amount in minor units (paise, cents):
 * 25000050 → "Rupees Two Lakh Fifty Thousand and Fifty Paise Only".
 */
export function amountToWords(minorUnits: number, currency: string, system: NumberSystem): string {
  const units = CURRENCY_WORDS[currency] ?? { major: currency, majorOne: currency, minor: "/100", minorOne: "/100" }
  const major = Math.floor(minorUnits / 100)
  const minor = minorUnits % 100
  const majorText = titleCase(integerToWords(major, system))
  const majorUnit = major === 1 ? units.majorOne : units.major
  const head = units.prefix ? `${majorUnit} ${majorText}` : `${majorText} ${majorUnit}`
  const tail = minor ? ` and ${titleCase(integerToWords(minor, "international"))} ${minor === 1 ? units.minorOne : units.minor}` : ""
  return `${head}${tail} Only`
}

/** Optimal string alignment distance, for "fivty" → "fifty" and "lack" → "lakh". */
function distance(a: string, b: string) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array<number>(b.length).fill(0)])
  for (let j = 1; j <= b.length; j++) d[0][j] = j
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1)
    }
  }
  return d[a.length][b.length]
}

export interface ParsedWords {
  /** The amount the words describe, in minor units, or null when any word could not be read. */
  minorUnits: number | null
  /** Words that are not numbers, each with the number word it most likely meant. */
  unknown: { word: string; suggestion?: string }[]
  /** Whether the text ends with "only", which stops anything being added after it. */
  endsWithOnly: boolean
}

/**
 * Reads an amount written in words, in either system and in mixed forms:
 * "Rupees Two Lakh Fifty Thousand Only", "2.5 lakh", "twenty five lacs",
 * "two hundred and fifty thousand dollars and 50/100", "one crore twenty lakh".
 */
export function parseAmountWords(text: string): ParsedWords {
  const tokens = text.toLowerCase().replace(/\/-/g, " only ").replace(/(\d),(?=\d)/g, "$1").replace(/[-–,]/g, " ").replace(/[.](?!\d)/g, " ").split(/\s+/).filter(Boolean)
  const known = [...Object.keys(SMALL), ...Object.keys(SCALES), ...MAJOR_WORDS, ...MINOR_WORDS, ...FILLER]
  const unknown: ParsedWords["unknown"] = []
  let total = 0
  let current = 0
  let largest = 1
  let minor = 0
  let mark = 0 // value of `current` at the last "and" or currency word, where paise/cents may start
  let seen = false

  for (const token of tokens) {
    const fraction = token.match(/^(\d{1,2})\/100$/)
    if (fraction) {
      minor = Number(fraction[1])
      seen = true
    } else if (/^\d+(\.\d+)?$/.test(token)) {
      current += Number(token)
      seen = true
    } else if (token in SMALL) {
      current += SMALL[token]
      seen = true
    } else if (token === "hundred") {
      current = (current || 1) * 100
      seen = true
    } else if (token in SCALES) {
      const scale = SCALES[token]
      // "five thousand crore" multiplies everything before it; "two lakh fifty thousand" adds.
      if (scale > largest) total = (total + current || 1) * scale
      else total += (current || 1) * scale
      largest = Math.max(largest, scale)
      current = mark = 0
      seen = true
    } else if (MINOR_WORDS.has(token)) {
      minor = current - mark
      current = mark
    } else if (token === "and" || MAJOR_WORDS.has(token)) {
      mark = current
    } else if (!MAJOR_WORDS.has(token) && !FILLER.has(token)) {
      const best = known.reduce<{ word?: string; score: number }>(
        (acc, word) => {
          const score = distance(token, word)
          return score < acc.score ? { word, score } : acc
        },
        { score: token.length > 4 ? 3 : 2 },
      )
      unknown.push({ word: token, suggestion: best.word })
    }
  }

  const major = total + current
  return {
    minorUnits: seen && !unknown.length && minor < 100 ? Math.round(major * 100) + minor : null,
    unknown,
    endsWithOnly: tokens[tokens.length - 1] === "only",
  }
}
