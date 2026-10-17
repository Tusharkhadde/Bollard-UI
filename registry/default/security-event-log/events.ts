// Bollard UI — security-event-log · MIT licence · https://bollard-ui.vercel.app/components/security-event-log

/** Pure helpers for SecurityEventLog: risk, takeover-pattern grouping and time zone aware day keys. */

export type SecurityEventType =
  | "password_changed"
  | "new_device"
  | "two_factor_off"
  | "two_factor_on"
  | "recovery_changed"
  | "email_changed"
  | "api_key_created"
  | "passkey_added"
  | "sign_in"

export interface SecurityEvent {
  id: string
  /** One of the known types; anything else is shown with its `title`. */
  type: SecurityEventType | (string & {})
  /** When it happened: epoch ms, ISO string or Date. */
  at: number | string | Date
  /** "Chrome on Windows". */
  device?: string
  /** Approximate place from the IP: "Near Lagos, Nigeria". */
  location?: string
  /** It happened on the device you are using now. */
  thisDevice?: boolean
  /** Extra detail: the new recovery address (masked), the key's name. */
  detail?: string
  /** Label for unknown types. */
  title?: string
  /** Already handled (e.g. on a previous visit): shown as Reported or Marked as you, with no actions. */
  status?: "reported" | "confirmed"
}

/** Changes that hand an attacker the account or lock the owner out. */
export const LOCKOUT_TYPES = new Set<string>(["password_changed", "two_factor_off", "recovery_changed", "email_changed"])
/** Everything worth a second look. */
export const RISKY_TYPES = new Set<string>([...LOCKOUT_TYPES, "new_device", "api_key_created", "passkey_added"])

export interface EventGroup {
  id: string
  events: SecurityEvent[]
  /** Two or more risky changes close together, not from this device. */
  burst: boolean
  /** A new device followed by lock-out changes: the usual takeover order. */
  takeover: boolean
  risky: boolean
  /** Newest and oldest time in the group. */
  start: number
  end: number
}

/** Epoch ms or null for anything that isn't a real date. */
export function toTime(value: unknown): number | null {
  if (value instanceof Date) return Number.isFinite(value.getTime()) ? value.getTime() : null
  if (typeof value === "number") return Number.isFinite(value) ? value : null
  if (typeof value === "string" && value.trim()) {
    const t = Date.parse(value.replace(/^\uFEFF/, "").trim())
    return Number.isFinite(t) ? t : null
  }
  return null
}

export const isRisky = (event: SecurityEvent) => RISKY_TYPES.has(event.type) && !event.thisDevice

/**
 * Sorts newest first and gathers risky events from other devices that happen within `windowMinutes`
 * of each other into one group, so "new device, then 2FA off, then recovery changed" reads as one incident.
 */
export function groupEvents(input: SecurityEvent[], windowMinutes = 60): EventGroup[] {
  const window = Math.max(1, Number(windowMinutes) || 60) * 60_000
  const events = (Array.isArray(input) ? input : [])
    .filter((e): e is SecurityEvent => !!e && typeof e.id === "string" && toTime(e.at) !== null)
    .sort((a, b) => (toTime(b.at) as number) - (toTime(a.at) as number))
  const groups: EventGroup[] = []
  for (const event of events) {
    const time = toTime(event.at) as number
    const last = groups[groups.length - 1]
    if (last && last.risky && isRisky(event) && last.end - time <= window) {
      last.events.push(event)
      last.end = time
      continue
    }
    groups.push({ id: event.id, events: [event], burst: false, takeover: false, risky: isRisky(event), start: time, end: time })
  }
  for (const group of groups) {
    group.burst = group.risky && group.events.length > 1
    // Oldest first: did a new device come before a lock-out change?
    const ordered = [...group.events].reverse()
    const firstDevice = ordered.findIndex((e) => e.type === "new_device")
    group.takeover = group.burst && firstDevice >= 0 && ordered.slice(firstDevice + 1).some((e) => LOCKOUT_TYPES.has(e.type))
  }
  return groups
}

/** One step "This wasn't me" can take. `key` is the event type it undoes, "sign_out_device" or "sign_out_all". */
export interface SecurityRemedy {
  key: string
  /** The events this step undoes. */
  events: SecurityEvent[]
}

const REMEDY_KEY: Record<string, string> = {
  new_device: "sign_out_device",
  sign_in: "sign_out_device",
  password_changed: "password_changed",
  two_factor_off: "two_factor_off",
  two_factor_on: "two_factor_on",
  recovery_changed: "recovery_changed",
  email_changed: "email_changed",
  api_key_created: "api_key_created",
  passkey_added: "passkey_added",
}

/**
 * The steps that undo these events, in the order they happened, plus "sign out everywhere else".
 * A sign-in from this device gets no "sign that device out" step, since that would sign the owner out.
 */
export function remediesFor(events: SecurityEvent[]): SecurityRemedy[] {
  const out = new Map<string, SecurityEvent[]>()
  for (const event of [...events].reverse()) {
    const key = REMEDY_KEY[event.type]
    if (!key || (key === "sign_out_device" && event.thisDevice)) continue
    out.set(key, [...(out.get(key) ?? []), event])
  }
  return [...[...out].map(([key, list]) => ({ key, events: list })), { key: "sign_out_all", events: [...events] }]
}

/** "2026-10-14" for the instant in the given zone, so "Today" follows the account's zone, not the browser's. */
export function dayKey(time: number, timeZone?: string) {
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(time)
  } catch {
    return new Date(time).toISOString().slice(0, 10)
  }
}
