/** Wordy words and phrases with a plainer swap (plainlanguage.gov, GOV.UK style). Keys are lowercase. */
export const PLAIN_WORDS: Record<string, string> = {
  utilize: "use", utilise: "use", utilization: "use", commence: "start", commencement: "start", terminate: "end",
  approximately: "about", assistance: "help", purchase: "buy", sufficient: "enough", additional: "more",
  numerous: "many", demonstrate: "show", facilitate: "help", "prior to": "before", "in order to": "to",
  subsequently: "later", endeavor: "try", endeavour: "try", obtain: "get", inquire: "ask", enquire: "ask",
  modify: "change", initiate: "start", regarding: "about", ascertain: "find out", nevertheless: "still",
  "in the event that": "if", "at this point in time": "now", "due to the fact that": "because",
  individuals: "people", remuneration: "pay", expedite: "speed up", consequently: "so", notify: "tell",
  aforementioned: "this", "in accordance with": "under", "with regard to": "about", "a number of": "some",
  discontinue: "stop", transmit: "send", possess: "have", reside: "live", whilst: "while", henceforth: "from now on",
  // Common inflections, so "utilized" and "purchasing" are caught too.
  utilized: "used", utilizes: "uses", utilizing: "using", utilised: "used", utilising: "using", commenced: "started",
  commences: "starts", terminated: "ended", purchased: "bought", purchasing: "buying", purchases: "buys",
  demonstrated: "showed", demonstrates: "shows", facilitates: "helps", facilitated: "helped", obtained: "got",
  obtaining: "getting", modified: "changed", modifying: "changing", initiated: "started", notified: "told",
  transmitted: "sent", discontinued: "stopped", inquired: "asked", enquired: "asked",
}

/** Every place `word` occurs, as whole words, in the order they appear. */
export function findWord(text: string, word: string) {
  const pattern = word.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+")
  return [...text.matchAll(new RegExp(`(?<![\\p{L}\\p{N}])${pattern}(?![\\p{L}\\p{N}])`, "giu"))].map((m) => ({ start: m.index, end: m.index + m[0].length, match: m[0] }))
}

/** `plain` with the capital of the word it replaces. */
export const matchCase = (original: string, plain: string) => (/^\p{Lu}/u.test(original) ? plain.charAt(0).toUpperCase() + plain.slice(1) : plain)

const ABBREVIATIONS = /\b(e\.g|i\.e|etc|vs|mr|mrs|ms|dr|prof|st|no|approx|fig|inc|ltd|jr|sr|[A-Z])\.$/i
const WORD = /[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu

// Vowel pairs that are usually two syllables (po-em, li-on, ac-tu-al, i-de-a), and endings that add or drop one.
const SPLIT_PAIRS = [/oe(?!s?$)/g, /(?<![cgst])ia/g, /(?<![cgstxn]|ll)io(?!u)/g, /iu/g, /(?<![gq])ua/g, /uo/g, /(?<![pg])eo/g, /(?<![tcu])ie(?:t|n[tc])/g, /^scien/g]
const ADD_END = [/(?<![aeiou])[eo]ing$/, /ism$/, /ie(?:r|st)$/, /[ds]nt$/]

/** Vowel-group syllable estimate with the usual silent-e, -ed and vowel-split fixes (accurate to roughly ±10%). */
export function countSyllables(word: string) {
  const w = word.toLowerCase().replace(/[^a-z]/g, "")
  if (!w) return 1
  if (w.length <= 3) return 1
  const trimmed = w.replace(/(?:[^laeiouy]es|(?<![td])ed|[^laeiouy]e)$/, "").replace(/^y/, "")
  let count = trimmed.match(/[aeiouy]{1,2}/g)?.length ?? 1
  for (const pair of SPLIT_PAIRS) count += trimmed.match(pair)?.length ?? 0
  for (const end of ADD_END) if (end.test(trimmed)) count++
  if (/ea$|^creat(?!ur)/.test(w)) count++
  if (/[^aeiouy]ely$/.test(w)) count--
  if (/[cgtx]iou/.test(w)) count--
  return Math.max(1, count)
}

/** Share of letters that are Latin (1 for text without letters). */
const latinShare = (text: string) => {
  const letters = text.match(/\p{L}/gu)?.length ?? 0
  return letters ? (text.match(/[a-z\u00c0-\u024f]/gi)?.length ?? 0) / letters : 1
}

const STOPWORDS = new Set("the a an and or but to of in on at for from with by as is are was were be been it its this that these those you your we our they their he she his her i me my not no if can will would should have has had do does did so than then there here what which who when where how all any some more just about into out up".split(" "))

export type ReadabilitySupport = "ok" | "script" | "language"

/**
 * Whether an English grade means anything for this text. "script": mostly non-Latin letters (Hindi, Marathi,
 * Arabic...). "language": Latin letters but almost none of the small words every English text is full of.
 */
export function readabilitySupport(text: string): ReadabilitySupport {
  if ((text.match(/\p{L}/gu)?.length ?? 0) >= 8 && latinShare(text) < 0.7) return "script"
  const words = (text.toLowerCase().match(/[a-z]+(?:['’][a-z]+)?/g) ?? [])
  const common = words.filter((w) => STOPWORDS.has(w)).length
  if (words.length >= 12 && common / words.length < 0.1) return "language"
  return "ok"
}

/** Flesch-Kincaid grade: 0.39 × words per sentence + 11.8 × syllables per word − 15.59. */
export const fleschKincaid = (words: number, sentences: number, syllables: number) =>
  words && sentences ? Math.max(0, 0.39 * (words / sentences) + 11.8 * (syllables / words) - 15.59) : 0

export interface Sentence {
  start: number
  end: number
  words: number
  syllables: number
  grade: number
}

/** Splits text into sentences, keeping e.g., Dr., initials, decimals and new lines (list items, headings) right. */
export function splitSentences(text: string): Sentence[] {
  const out: Sentence[] = []
  let start = 0
  const push = (end: number) => {
    const body = text.slice(start, end).replace(/https?:\/\/\S+/g, "link")
    const tokens = body.match(WORD) ?? []
    if (tokens.length) {
      const syllables = tokens.reduce((sum, t) => sum + (/^\d/.test(t) ? 1 : countSyllables(t)), 0)
      const lead = text.slice(start, end).search(/\S/)
      out.push({ start: start + lead, end, words: tokens.length, syllables, grade: fleschKincaid(tokens.length, 1, syllables) })
    }
    start = end
  }
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (ch === "\n") push(i)
    else if (/[.!?]/.test(ch) && !/[.!?]/.test(text[i + 1] ?? "")) {
      const next = text.slice(i + 1).match(/^["'’)\]]*\s+(\S)/)?.[1]
      if (i + 1 < text.length && (!next || /[\p{Ll}\d]/u.test(next) || (ch === "." && ABBREVIATIONS.test(text.slice(Math.max(0, i - 6), i + 1))))) continue
      let end = i + 1
      while (/["'’)\]]/.test(text[end] ?? "")) end++
      push(end)
    }
  }
  push(text.length)
  return out
}

export type Difficulty = "hard" | "very-hard"

export interface ReadabilityReport {
  /** "ok", or why the English grade was skipped. When not "ok", grade is 0 and no sentence is flagged. */
  support: ReadabilitySupport
  grade: number
  words: number
  sentences: (Sentence & { difficulty?: Difficulty; long: boolean; dense: boolean })[]
  swaps: { start: number; end: number; word: string; plain: string }[]
}

/**
 * Grades the text and marks hard sentences relative to the target. A sentence is only flagged when it is long
 * enough to matter (12+ words) and dense, or very long: a long run of short words isn't hard to read.
 */
export function analyzeReadability(text: string, { targetGrade = 8, swaps = PLAIN_WORDS }: { targetGrade?: number; swaps?: Record<string, string> } = {}): ReadabilityReport {
  const support = readabilitySupport(text)
  // A line in another script inside English text (a Hindi greeting) is left out of the grade.
  const graded = splitSentences(text).filter((s) => support !== "ok" || latinShare(text.slice(s.start, s.end)) >= 0.5)
  const sentences = graded.map((s) => {
    const perWord = s.syllables / s.words
    const long = s.words > 22
    const dense = perWord >= 1.6
    const counts = support === "ok" && s.words >= 12 && (perWord >= 1.4 || s.words >= 28)
    const difficulty: Difficulty | undefined = !counts ? undefined : s.grade >= targetGrade + 6 ? "very-hard" : s.grade >= targetGrade + 2 ? "hard" : undefined
    return { ...s, difficulty, long, dense }
  })
  const words = sentences.reduce((sum, s) => sum + s.words, 0)
  const syllables = sentences.reduce((sum, s) => sum + s.syllables, 0)
  const keys = Object.keys(swaps).sort((a, b) => b.length - a.length).map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/ /g, "\\s+"))
  const found = keys.length ? [...text.matchAll(new RegExp(`(?<![\\p{L}\\p{N}])(${keys.join("|")})(?![\\p{L}\\p{N}])`, "giu"))] : []
  return {
    support,
    grade: support === "ok" ? Math.round(fleschKincaid(words, sentences.length, syllables) * 10) / 10 : 0,
    words,
    sentences,
    swaps: found.map((m) => ({ start: m.index, end: m.index + m[0].length, word: m[0], plain: swaps[m[0].toLowerCase().replace(/\s+/g, " ")] })),
  }
}

/** Replaces every use of a wordy word, keeping a leading capital. */
export function applySwap(text: string, word: string, plain: string) {
  return findWord(text, word).reduceRight((out, m) => out.slice(0, m.start) + matchCase(m.match, plain) + out.slice(m.end), text)
}
