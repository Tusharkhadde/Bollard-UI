/** How long a sent message stays editable and removable on a platform. Times are in ms; Infinity means any time, 0 never. */
export interface RetractPolicy {
  editFor: number
  /** Edits allowed within the window (iMessage: 5). */
  maxEdits?: number
  unsendFor: number
  /** What the platform calls removing it for everyone. */
  unsendLabel: string
  /** What still holds after an unsend, in plain words. */
  caveats: string[]
  /** Where the rule comes from. */
  source?: string
}

const MIN = 60_000

/**
 * Sourced defaults. Replace them when your own product sets the rules.
 * - iMessage: unsend for 2 minutes, edit up to five times within 15 minutes, on iOS 16,
 *   iPadOS 16.1, macOS 13 or later; people on older systems keep the original, and SMS, MMS
 *   and RCS messages can't be edited or unsent. (Apple, support.apple.com/en-us/105083 and
 *   support.apple.com/guide/iphone/unsend-and-edit-messages-iphe67195653/ios)
 * - WhatsApp: edit for 15 minutes, request Delete for everyone for two days; recipients may
 *   already have seen it, iPhone users may keep media in Photos, and you aren't told if it
 *   fails. (faq.whatsapp.com/1370476507114859, faq.whatsapp.com/6614640168569481)
 * - Slack: members can edit and delete their own messages any time by default; admins can
 *   limit editing to a timeframe or switch it off, and owners can take deletion away from
 *   some roles. Pass your workspace's real limits. (slack.com/help/articles/115004868646)
 */
export const RETRACT_POLICIES = {
  imessage: {
    editFor: 15 * MIN,
    maxEdits: 5,
    unsendFor: 2 * MIN,
    unsendLabel: "Undo Send",
    caveats: ["Anyone on an older system than iOS 16, iPadOS 16.1 or macOS 13 keeps the original. Green-bubble texts (SMS, RCS) can't be unsent at all."],
    source: "https://support.apple.com/en-us/105083",
  },
  whatsapp: {
    editFor: 15 * MIN,
    unsendFor: 2 * 24 * 60 * MIN,
    unsendLabel: "Delete for everyone",
    caveats: ["Anyone who has opened it has already seen it, and photos may already be saved on their iPhone.", "It only works if everyone is on the latest WhatsApp, and WhatsApp doesn't tell you if it fails."],
    source: "https://faq.whatsapp.com/1370476507114859",
  },
  slack: {
    editFor: Infinity,
    unsendFor: Infinity,
    unsendLabel: "Delete",
    caveats: ["Your workspace may keep a record of edits and deletions."],
    source: "https://slack.com/help/articles/115004868646",
  },
} satisfies Record<string, RetractPolicy>

export type RetractPlatform = keyof typeof RETRACT_POLICIES

export interface RetractRecipient {
  id: string
  name: string
  /** They have opened it. */
  read?: boolean
  /** False when their app or channel can't remove it (an old app version, SMS). */
  canRetract?: boolean
}

const ms = (v: Date | string | number) => (v instanceof Date ? v.getTime() : typeof v === "number" ? v : Date.parse(v))

/** Where each window stands at `now`: ms left (Infinity for no limit, 0 when closed) and when it closes. */
export function retractState(sentAt: Date | string | number, now: number, policy: RetractPolicy, editsUsed = 0) {
  const sent = ms(sentAt)
  const valid = Number.isFinite(sent) && Number.isFinite(now)
  const left = (span: number) => (!valid || !(span > 0) ? 0 : span === Infinity ? Infinity : Math.max(0, sent + span - now))
  const editsLeft = policy.maxEdits === undefined ? Infinity : Math.max(0, policy.maxEdits - Math.max(0, Math.floor(editsUsed || 0)))
  return {
    edit: { left: editsLeft > 0 ? left(policy.editFor) : 0, closesAt: valid && Number.isFinite(policy.editFor) ? sent + policy.editFor : NaN, editsLeft },
    unsend: { left: left(policy.unsendFor), closesAt: valid && Number.isFinite(policy.unsendFor) ? sent + policy.unsendFor : NaN },
  }
}

/** "1:24", "12 min", "1 h 5 min", "2 days": coarse far out, to the second near the end. */
export function formatLeft(left: number) {
  if (left === Infinity) return ""
  const s = Math.ceil(left / 1000)
  if (s < 600) return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`
  const m = Math.ceil(s / 60)
  if (m < 60) return `${m} min`
  if (m < 48 * 60) return `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ""}`
  return `${Math.round(m / 1440)} days`
}
