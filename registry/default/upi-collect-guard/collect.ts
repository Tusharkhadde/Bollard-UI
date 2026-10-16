/**
 * Pure risk checks for an incoming UPI collect ("request money") or any screen that asks for the
 * UPI PIN. The PIN only ever authorises money leaving the account (RBI "BE(A)WARE" booklet;
 * NPCI safety advice). NPCI circular NPCI/UPI/OC/220/2025-26 (29 Jul 2025) stopped person-to-person
 * collect requests from 1 Oct 2025, so a collect that claims to be from a person is itself a red flag.
 */

export interface CollectRequest {
  /** Name shown on the request (what the requester's bank returned, or what they typed). */
  name?: string
  /** Requester's UPI ID. */
  vpa?: string
  /** Amount in rupees. */
  amount: number
  /** The note or remark on the request. */
  note?: string
  /** True when the PSP marks the payee as a verified merchant. */
  verifiedMerchant?: boolean
}

export type CollectRisk =
  | { kind: "receiveWording"; word: string }
  | { kind: "refund"; word: string }
  | { kind: "prize"; word: string }
  | { kind: "buyer"; word: string }
  | { kind: "kyc"; word: string }
  | { kind: "personCollect" }
  | { kind: "unknown" }
  | { kind: "nameMismatch"; expected: string }
  | { kind: "testAmount" }

const PATTERNS: { kind: "receiveWording" | "refund" | "prize" | "buyer" | "kyc"; re: RegExp }[] = [
  { kind: "receiveWording", re: /\b(receive|receiving|get (your )?money|credit(ed)? to you|accept (the )?(money|payment)|to receive|paise? (milenge|milega|lene|aayenge)|paisa (milega|lene)|lene ke liye)\b/i },
  { kind: "refund", re: /\b(refund|return(ing)? (your )?(money|amount)|reversal|cashback|cash back|chargeback|excess (amount|payment))\b/i },
  { kind: "prize", re: /\b(prize|lottery|lucky draw|winner|reward|bonus|kbc|jackpot)\b/i },
  { kind: "buyer", re: /\b(olx|quikr|marketplace|advance|token amount|army|cantonment|crpf|bsf|posted|courier charges?|delivery charges?|booking amount)\b/i },
  { kind: "kyc", re: /\b(kyc|verify|verification|activate|unblock|electricity|disconnect(ion)?|account (will be )?(blocked|suspended))\b/i },
]

/** Looks like a person's UPI ID: a 10-digit mobile number, or a Google Pay personal handle. */
export const looksPersonal = (vpa = "") => /^(\+?91)?[6-9]\d{9}@/.test(vpa.trim()) || /@ok(axis|hdfcbank|icici|sbi)$/i.test(vpa.trim())

const plain = (text: string) => text.normalize("NFKC").replace(/^\uFEFF/, "").replace(/\r\n?/g, " ")
const words = (text: string) => plain(text).toLowerCase()
const tokens = (text = "") => words(text).split(/[^\p{L}\p{N}]+/u).filter(Boolean)
/** Every word the user expects appears in the bank's name ("Rahul" matches "RAHUL KUMAR SHARMA"; "R Sharma" matches too). */
const sameName = (expected = "", actual = "") => {
  const want = tokens(expected)
  const have = tokens(actual)
  return want.every((w) => have.some((h) => h === w || (w.length === 1 && h.startsWith(w)) || (h.length === 1 && w.startsWith(h))))
}

/**
 * Every reason to stop. `contacts` are UPI IDs the user has paid before; `expectedName` is who the
 * user thinks is asking.
 */
export function detectCollectRisks(request: CollectRequest, options: { contacts?: string[]; expectedName?: string } = {}): CollectRisk[] {
  if (!request || typeof request !== "object") return []
  const risks: CollectRisk[] = []
  const note = plain(typeof request.note === "string" ? request.note.slice(0, 2000) : "")
  for (const { kind, re } of PATTERNS) {
    const match = note.match(re)
    if (match) risks.push({ kind, word: match[0] })
  }
  const vpa = typeof request.vpa === "string" ? request.vpa.trim().toLowerCase() : ""
  if (!request.verifiedMerchant && looksPersonal(vpa)) risks.push({ kind: "personCollect" })
  const contacts = (options.contacts ?? []).map((c) => String(c).trim().toLowerCase())
  if (!request.verifiedMerchant && vpa && !contacts.includes(vpa)) risks.push({ kind: "unknown" })
  if (options.expectedName && request.name && !sameName(options.expectedName, request.name)) risks.push({ kind: "nameMismatch", expected: options.expectedName })
  const amount = Number(request.amount)
  if (Number.isFinite(amount) && amount > 0 && amount <= 10) risks.push({ kind: "testAmount" })
  return risks
}
