// Bollard UI — chat-audience-check · MIT licence · https://bollard-ui.vercel.app/components/chat-audience-check

export interface ChatMember {
  id: string
  /** The name the chat shows for them (their own profile name). */
  name: string
  /** What you saved them as in your contacts, when the app knows it. */
  savedAs?: string
  /** Their organisation, if known. */
  org?: string
  /** The platform marks them as outside your organisation (Slack Connect, Teams external, a guest). */
  external?: boolean
  /** When they joined this chat. */
  joinedAt?: Date | string | number
  /** Who added them. */
  addedBy?: string
  /** You. Never flagged. */
  isYou?: boolean
}

export type MemberFlag = "outside" | "new" | "unclear" | "mismatch"

export interface FlaggedMember {
  member: ChatMember
  flags: MemberFlag[]
}

/** Words that make a message worth a second look at who is in the room. Override with `sensitiveTerms`. */
export const DEFAULT_CHAT_SENSITIVE_TERMS = [
  "confidential", "internal only", "do not share", "don't share", "do not forward", "don't forward", "between us",
  "password", "OTP", "PIN", "salary", "offer letter", "layoff", "layoffs", "acquisition", "term sheet", "board deck",
  "unreleased", "embargo", "NDA", "account number", "card number", "launch date",
]

const letters = (s: string) => s.normalize("NFKD").replace(/[^\p{L}]/gu, "").toLowerCase()
const tokens = (s: string) => s.split(/[\s.,()_-]+/).map(letters).filter((t) => t.length > 1)
const time = (v: ChatMember["joinedAt"]) => {
  const ms = v instanceof Date ? v.getTime() : typeof v === "number" ? v : typeof v === "string" ? Date.parse(v) : NaN
  return Number.isFinite(ms) ? ms : NaN
}

const CJK = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u

/**
 * A display name nobody can identify: initials ("JG", "A. K."), a bare number or emoji,
 * or a single letter. Short real names ("Ali", "Bo", "王伟") are fine: in Chinese,
 * Japanese and Korean two or three characters is a full name.
 */
export function isUnclearName(name: string) {
  const raw = String(name ?? "").normalize("NFKD")
  const l = raw.replace(/[^\p{L}]/gu, "")
  if (CJK.test(l)) return l.length < 2
  if (l.length <= 1) return true
  // Initials: "JG", "jg", "A. K.", "RKS". A capitalised short name ("Bo", "Ali") is a name.
  const caps = l === l.toUpperCase() && l !== l.toLowerCase()
  return (l.length === 2 && (caps || l === l.toLowerCase())) || (l.length === 3 && caps)
}

/** True when the chat's name and your saved contact name look like two different people. */
export function namesDisagree(name: string, savedAs?: string) {
  if (!savedAs) return false
  const a = tokens(String(name ?? ""))
  const b = tokens(savedAs)
  // A one-word nickname ("Mom", "Priya work") is normal; two full names with nothing in common are not.
  if (a.length < 2 || b.length < 2) return false
  return !a.some((t) => b.includes(t))
}

/** Case-insensitive whole-word match against the term list; code in backticks doesn't count. */
export function findSensitive(text: string, terms = DEFAULT_CHAT_SENSITIVE_TERMS) {
  const prose = String(text ?? "")
    .replace(/```[\s\S]*?```|`[^`\n]*`/g, " ")
    .replace(/[\u2018\u2019\u02BC]/g, "'") // "don’t share" from a phone keyboard
    .replace(/\bPIN\s*code\b/gi, " ") // an Indian postal code, not a secret
  return terms.filter((term) => {
    const escaped = term.replace(/[\u2018\u2019\u02BC]/g, "'").replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    const caseSensitive = term.length <= 4 && term === term.toUpperCase() // OTP, PIN, NDA: only in capitals
    return new RegExp(`(?<![\\p{L}\\d])${escaped}(?![\\p{L}\\d])`, caseSensitive ? "u" : "iu").test(prose)
  })
}

/**
 * Who in this chat needs a look before you post: people outside your organisation,
 * people who joined since your last message, names nobody can identify, and members
 * whose name disagrees with what you saved them as (the slip that put a journalist,
 * shown only as "JG", in the US officials' Signal chat in March 2025).
 */
export function flagMembers(members: ChatMember[], organization: string, lastPostedAt?: Date | string | number, vouched: string[] = []) {
  const since = time(lastPostedAt)
  const org = organization.trim().toLowerCase()
  const out: FlaggedMember[] = []
  for (const member of members ?? []) {
    if (!member || member.isYou || vouched.includes(member.id)) continue
    const flags: MemberFlag[] = []
    if (namesDisagree(member.name, member.savedAs)) flags.push("mismatch")
    if (isUnclearName(member.name)) flags.push("unclear")
    if (member.external || (member.org && member.org.trim().toLowerCase() !== org)) flags.push("outside")
    const joined = time(member.joinedAt)
    if (Number.isFinite(since) && Number.isFinite(joined) && joined > since) flags.push("new")
    if (flags.length) out.push({ member, flags })
  }
  const rank = (f: FlaggedMember) => (f.flags.includes("mismatch") ? 0 : f.flags.includes("unclear") ? 1 : f.flags.includes("new") ? 2 : 3)
  return out.sort((a, b) => rank(a) - rank(b))
}
