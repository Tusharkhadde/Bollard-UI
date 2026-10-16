/** One line of the gift card order. */
export interface GiftCardLine {
  /** Brand, e.g. "Google Play". */
  brand: string
  /** Value of one card, in the order's currency. */
  amount: number
  /** How many of this card. Defaults to 1. */
  quantity?: number
}

/** The stories gift card scams tell, after the FTC's list. */
export type ScamStory = "codes" | "boss" | "government" | "refund" | "techSupport" | "utility" | "prize" | "emergency"

export type ScamSignal =
  | { kind: "large"; total: number }
  | { kind: "several"; count: number; brands: string[] }
  | { kind: "story"; story: ScamStory; words: string[] }
  | { kind: "firstPurchase" }

/**
 * Word lists per story, lower case. Phrases match on word boundaries. English first, then the
 * Hinglish (romanised Hindi) and Devanagari phrases Indian scam calls use, e.g. "sir ne bola".
 */
export const SCAM_WORDS: Record<ScamStory, string[]> = {
  codes: [
    "send the code", "send the codes", "send me the code", "send me the codes", "the codes", "read me the", "scratch", "photo of the card", "picture of the card", "pic of the card", "card number and pin", "the pin", "the numbers on the back", "claim code", "redemption code",
    "code bhejo", "code bhej do", "code bhejna", "codes bhejo", "code send karo", "code share karo", "pin bhejo", "card ki photo", "card ka photo", "photo bhejo",
    "कोड भेजो", "कोड भेज दो", "कोड बताओ", "पिन भेजो",
  ],
  boss: [
    "boss", "manager", "ceo", "director", "my supervisor", "for the office", "for staff", "employee rewards", "urgent favor", "urgent favour", "client gifts", "keep it confidential",
    "sir ne bola", "sir ne kaha", "madam ne bola", "ma'am ne bola", "boss ne bola", "office ke liye", "client ke liye", "kisi ko mat batana",
    "सर ने बोला", "सर ने कहा", "बॉस ने बोला",
  ],
  government: [
    "irs", "tax", "taxes", "income tax", "social security", "customs", "pay the fine", "penalty", "warrant", "arrest", "police", "court case", "cbi", "digital arrest", "cyber crime", "narcotics", "immigration", "visa fee", "jury duty",
    "police case", "arrest ho", "giraftar", "challan", "customs duty", "parcel mein drugs", "aadhaar misuse",
    "पुलिस", "गिरफ्तार", "डिजिटल अरेस्ट", "जुर्माना",
  ],
  refund: [
    "refund", "overpaid", "overpayment", "cashback", "reimburse", "chargeback", "send back the difference",
    "refund ke liye", "paisa wapas", "paise wapas", "galti se bhej", "extra paise",
    "रिफंड", "पैसे वापस",
  ],
  techSupport: ["tech support", "technical support", "virus", "hacked", "microsoft", "apple support", "geek squad", "remote access", "anydesk", "teamviewer", "your computer", "antivirus", "app download karo"],
  utility: [
    "electricity", "power cut", "disconnection", "disconnected", "gas bill", "water bill", "utility", "light bill",
    "bijli bill", "bijli kat", "light kat", "connection kat", "बिजली",
  ],
  prize: [
    "prize", "lottery", "you won", "winner", "sweepstakes", "lucky draw", "claim fee", "processing fee",
    "kbc", "lottery lagi", "inaam", "jeet gaye", "इनाम", "लॉटरी",
  ],
  emergency: [
    "bail", "hospital", "accident", "stranded", "don't tell", "dont tell", "grandma", "grandpa", "in jail",
    "hospital mein", "jaldi bhejo", "ghar pe mat batana", "papa ko mat batana", "अस्पताल",
  ],
}

/**
 * Roughly the same "a lot to put on gift cards" level (about US$500) in common currencies.
 * Unknown currencies skip the size check unless you pass `largeTotal`, so ¥500 never looks large.
 */
export const LARGE_TOTAL_BY_CURRENCY: Record<string, number> = {
  USD: 500, EUR: 500, GBP: 400, CAD: 700, AUD: 750, NZD: 800, CHF: 450, SGD: 650, HKD: 4000, AED: 1800, SAR: 1900,
  INR: 20_000, PKR: 140_000, BDT: 60_000, LKR: 150_000, NPR: 65_000, JPY: 75_000, KRW: 700_000, CNY: 3500,
  PHP: 28_000, IDR: 8_000_000, MYR: 2200, THB: 17_000, VND: 12_500_000, MXN: 9000, BRL: 2800, ZAR: 9000, NGN: 750_000, KES: 65_000,
  SEK: 5000, NOK: 5000, DKK: 3500, PLN: 2000, TRY: 17_000,
}

export interface ScamOptions {
  /** Order total at or above which it counts as large: one number, or one per ISO 4217 code. Defaults to `LARGE_TOTAL_BY_CURRENCY`. */
  largeTotal?: number | Record<string, number>
  /** ISO 4217 code of the amounts, used to pick the large-total level. Defaults to USD. */
  currency?: string
  /** Card count at or above which it counts as several. */
  severalCards?: number
  /** Replace or extend the word lists. */
  words?: Partial<Record<ScamStory, string[]>>
}

const num = (n: unknown) => (typeof n === "number" && Number.isFinite(n) && n > 0 ? n : 0)
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")

/** Normalises a note so full-width letters, curly quotes, CRLF and odd spacing don't slip past. */
export function normalizeNote(note: unknown): string {
  if (typeof note !== "string") return ""
  return note.replace(/^\uFEFF/, "").normalize("NFKC").replace(/[’‘]/g, "'").replace(/\s+/g, " ").toLowerCase().slice(0, 5000)
}

/** Large-total level for a currency, or null when none is known. */
export function largeTotalFor(currency = "USD", largeTotal?: ScamOptions["largeTotal"]): number | null {
  const code = String(currency).toUpperCase()
  if (typeof largeTotal === "number" && Number.isFinite(largeTotal) && largeTotal > 0) return largeTotal
  const own = typeof largeTotal === "object" && largeTotal ? largeTotal[code] : undefined
  return own ?? LARGE_TOTAL_BY_CURRENCY[code] ?? null
}

/** Finds each story's words in the note, on word boundaries (letters, digits and combining marks such as Hindi matras count as word characters). */
export function findStories(note: unknown, words: Record<ScamStory, string[]> = SCAM_WORDS): { story: ScamStory; words: string[] }[] {
  const text = normalizeNote(note)
  if (!text) return []
  return (Object.keys(words) as ScamStory[]).flatMap((story) => {
    const hits = words[story].filter((w) => new RegExp(`(^|[^\\p{L}\\p{M}\\p{N}])${escape(w.normalize("NFKC").toLowerCase())}($|[^\\p{L}\\p{M}\\p{N}])`, "u").test(text))
    // "the codes" inside "send me the codes" is one hit, not two.
    const distinct = hits.filter((w) => !hits.some((other) => other !== w && other.includes(w)))
    return distinct.length ? [{ story, words: distinct }] : []
  })
}

/** Every warning sign in a gift card order. Never throws. */
export function scamSignals(lines: GiftCardLine[], note?: string, firstPurchase?: boolean, options: ScamOptions = {}): ScamSignal[] {
  const valid = (Array.isArray(lines) ? lines : []).filter((l) => l && num(l.amount) > 0)
  const count = valid.reduce((n, l) => n + Math.max(1, Math.floor(num(l.quantity) || 1)), 0)
  const total = valid.reduce((sum, l) => sum + num(l.amount) * Math.max(1, Math.floor(num(l.quantity) || 1)), 0)
  const words = { ...SCAM_WORDS, ...options.words }
  const signals: ScamSignal[] = []
  // Someone asking for the codes is the scam itself, so it leads.
  const stories = findStories(note, words).sort((a, b) => Number(b.story === "codes") - Number(a.story === "codes"))
  for (const s of stories) signals.push({ kind: "story", ...s })
  const large = largeTotalFor(options.currency, options.largeTotal)
  if (large !== null && total >= large) signals.push({ kind: "large", total })
  if (count >= (options.severalCards ?? 3)) signals.push({ kind: "several", count, brands: [...new Set(valid.map((l) => String(l.brand ?? "").trim()).filter(Boolean))] })
  if (firstPurchase && signals.length) signals.push({ kind: "firstPurchase" })
  return signals
}

/** Pause only when a story is told, or when several weaker signs stack up. */
export function shouldPause(signals: ScamSignal[]): boolean {
  return signals.some((s) => s.kind === "story") || signals.length >= 2
}
