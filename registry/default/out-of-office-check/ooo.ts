// Bollard UI — out-of-office-check · MIT licence · https://bollard-ui.vercel.app/components/out-of-office-check

/**
 * Pure checks for an out-of-office auto-reply. Dates are wall-clock strings in the
 * account's time zone: "YYYY-MM-DD" for Gmail (which runs from 12:00 AM on the start
 * date to 11:59 PM on the end date) and "YYYY-MM-DDTHH:mm" for Outlook.
 */
export type AutoReplyPlatform = "gmail" | "outlook"
/** Who gets a reply. Gmail: "organization" is "Only send a response to people in my domain" (Workspace), "contacts" limits everyone, colleagues too, to your Contacts. Outlook: outside senders get the outside message, from your contacts only or from anyone. */
export type AutoReplyAudience = "organization" | "contacts" | "everyone"

export interface AutoReply {
  start: string
  /** Empty means it runs until switched off. */
  end?: string
  /** The reply. On Outlook, the one people inside your organisation get. */
  message: string
  /** Outlook only: the reply outside senders get. Left blank, Outlook sends them nothing. */
  externalMessage?: string
  audience: AutoReplyAudience
}

export type LeakKind = "phone" | "email" | "place" | "health"
export interface Leak {
  kind: LeakKind
  match: string
  sentence: string
}

export type AutoReplyFinding =
  | { kind: "no-start" }
  | { kind: "end-before-start" }
  | { kind: "already-over"; end: string }
  | { kind: "no-end"; suggestedEnd?: string }
  | { kind: "ends-on-return"; back: string; suggestedEnd: string }
  | { kind: "ends-early"; back: string; gapFrom: string; gapTo: string; suggestedEnd: string }
  | { kind: "ends-late"; back: string; days: number; suggestedEnd: string }
  | { kind: "stale-date"; back: string; phrase: string }
  | { kind: "everyone" }
  | { kind: "leak"; leak: Leak }
  | { kind: "no-outside-reply" }

const DATE = /^(\d{4})-(\d{2})-(\d{2})$/
const pad = (n: number) => String(n).padStart(2, "0")
const toUTC = (date: string) => {
  const m = DATE.exec(date)
  if (!m) return NaN
  const d = Date.UTC(+m[1], +m[2] - 1, +m[3])
  const back = new Date(d)
  return back.getUTCMonth() === +m[2] - 1 && back.getUTCDate() === +m[3] ? d : NaN
}
const fromUTC = (ms: number) => {
  const d = new Date(ms)
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`
}
export const isDate = (date: string) => !Number.isNaN(toUTC(date))
export const addDays = (date: string, days: number) => fromUTC(toUTC(date) + days * 86_400_000)
export const daysBetween = (a: string, b: string) => Math.round((toUTC(b) - toUTC(a)) / 86_400_000)

/** "YYYY-MM-DDTHH:mm" (or a bare date at 00:00) → normalised, or "" when invalid. */
export function parseWall(value: string | undefined) {
  const m = /^(\d{4}-\d{2}-\d{2})(?:[T ](\d{2}):(\d{2}))?/.exec(String(value ?? "").trim())
  if (!m || !isDate(m[1])) return ""
  const [h, min] = [Number(m[2] ?? 0), Number(m[3] ?? 0)]
  return h < 24 && min < 60 ? `${m[1]}T${pad(h)}:${pad(min)}` : ""
}

/** The current wall-clock time in a zone, "YYYY-MM-DDTHH:mm". */
export function wallNow(now: Date, timeZone: string) {
  try {
    const p = Object.fromEntries(
      new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
        .formatToParts(now)
        .map((x) => [x.type, x.value]),
    )
    return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`
  } catch {
    return now.toISOString().slice(0, 16)
  }
}

/** When replies really start and stop, as wall times. Gmail's end date runs to 11:59 PM. */
export function replyWindow(reply: AutoReply, platform: AutoReplyPlatform) {
  const from = parseWall(reply.start)
  const end = parseWall(reply.end)
  const to = !end ? "" : platform === "gmail" ? `${end.slice(0, 10)}T23:59` : end
  return { from, to }
}

/**
 * The last full day away. An Outlook end at or before noon (00:00, or 09:00 on the
 * morning you're back) means the day before was the last one away.
 */
export const lastAwayDay = (to: string) => (to.slice(11, 16) <= "12:00" ? addDays(to.slice(0, 10), -1) : to.slice(0, 10))

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"]
const DAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"]
const MONTH = "(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\\.?"
const DAY_NUM = "(\\d{1,2})(?:st|nd|rd|th)?"
const WEEKDAY = "(?:sun|mon|tues?|wed(?:nes)?|thu(?:rs)?|fri|sat(?:ur)?)(?:day)?"
const DATE_PART = `(?:${WEEKDAY},?\\s+)?(?:${DAY_NUM}\\s+(?:of\\s+)?${MONTH}|${MONTH}\\s+${DAY_NUM})(?:,?\\s+(\\d{4}))?|(\\d{4})-(\\d{2})-(\\d{2})|(\\d{1,2})[/.](\\d{1,2})(?:[/.](\\d{2,4}))?|(?:next\\s+)?(sun|mon|tues?|wed(?:nes)?|thu(?:rs)?|fri|sat(?:ur)?)(?:day)?`
const RETURN = new RegExp(`\\b(back|return(?:ing)?|in the office|in office|available)\\b[^.\\n]{0,24}?\\b(?:on|from)?\\s*(?:${DATE_PART})\\b|\\buntil\\s+(?:${DATE_PART})\\b`, "gi")

/**
 * The return date a message states ("back on Monday 27 October", "returning 27/10",
 * "out until Oct 24"). Years are inferred around `after` (the start date). A bare weekday
 * means the one nearest the reply's own end (`lastDay`, the last day away) when there is
 * one, else the first after the start. "until" dates are the last day away. The first
 * phrase that makes a real date wins, so "available at 10.30" is skipped.
 */
export function findReturnDate(text: string, after: string, order: "dmy" | "mdy" = "dmy", lastDay?: string) {
  if (!isDate(after)) return null
  for (const m of String(text ?? "").replace(/^\uFEFF/, "").matchAll(RETURN)) {
    const found = readMatch(m, after, order, lastDay)
    if (found) return found
  }
  return null
}

function readMatch(m: RegExpMatchArray, after: string, order: "dmy" | "mdy", lastDay?: string) {
  const until = m[1] === undefined
  const g = until ? m.slice(14, 26) : m.slice(2, 14)
  const [d1, mon1, mon2, d2, year, iy, im, id, n1, n2, ny, wd] = g
  let date = ""
  const near = (month: number, day: number, y?: string) => {
    if (y) return `${y.length === 2 ? "20" + y : y}-${pad(month)}-${pad(day)}`
    let candidate = `${after.slice(0, 4)}-${pad(month)}-${pad(day)}`
    if (isDate(candidate) && daysBetween(candidate, after) > 180) candidate = `${+after.slice(0, 4) + 1}-${pad(month)}-${pad(day)}`
    return candidate
  }
  if (iy) date = `${iy}-${im}-${id}`
  else if (n1) {
    const [day, month] = order === "dmy" ? [+n1, +n2] : [+n2, +n1]
    date = near(month, day, ny)
  } else if (wd) {
    const target = DAYS.findIndex((d) => d.startsWith(wd.toLowerCase().slice(0, 3)))
    const base = new Date(toUTC(after)).getUTCDay()
    date = addDays(after, ((target - base + 7) % 7) || 7)
    // "Back Monday" on a two-week trip means the Monday after it, not the first one.
    const anchor = lastDay && isDate(lastDay) ? (until ? lastDay : addDays(lastDay, 1)) : ""
    while (anchor && Math.abs(daysBetween(addDays(date, 7), anchor)) < Math.abs(daysBetween(date, anchor))) date = addDays(date, 7)
  } else {
    const month = MONTHS.indexOf((mon1 ?? mon2 ?? "").toLowerCase().slice(0, 3)) + 1
    date = near(month, Number(d1 ?? d2), year)
  }
  if (!isDate(date)) return null
  return { back: until ? addDays(date, 1) : date, until, phrase: m[0].trim() }
}

const ROLE_INBOX = /^(support|help|helpdesk|team|info|hello|contact|office|admin|sales|service|care|ops|hr|accounts|billing|enquiries|inquiries)[\w.+-]*@/i
const LEAKS: { kind: LeakKind; pattern: RegExp }[] = [
  { kind: "phone", pattern: /(?:\+\d{1,3}[\s-]?)?(?:\(?\d{2,5}\)?[\s-]?){2,4}\d{3,5}/g },
  { kind: "email", pattern: /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g },
  { kind: "place", pattern: /\b(?:(?:on (?:holiday|vacation|leave|a trip)|travel(?:l)?ing|holidaying|visiting|I['’]?m|I am|away) (?:in|to)|flying to|at my (?:parents'|home|in-laws))\s+[A-Z][\p{L}-]+(?:\s+[A-Z][\p{L}-]+)?/gu },
  { kind: "health", pattern: /\b(?:surgery|operation|hospital(?:ised|ized)?|medical (?:leave|reasons|procedure)|sick leave|maternity|paternity|funeral|bereavement|chemo(?:therapy)?)\b/gi },
]

const NOT_PLACES = /^(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|mon|tue|wed|thu|fri|sat|sun)[a-z]*$/i
const sentences = (text: string) => text.replace(/\r\n?/g, "\n").split(/(?<=[.!?])\s+|\n+/).filter((s) => s.trim())

/**
 * Personal details an outside sender doesn't need: phone numbers, a named person's
 * address (team inboxes are fine), where you are and health reasons. Security
 * guidance (NHS England, Kaspersky) says to keep external replies to the bare minimum.
 */
export function findLeaks(text: string): Leak[] {
  const leaks: Leak[] = []
  for (const sentence of sentences(String(text ?? "").replace(/^\uFEFF/, ""))) {
    for (const { kind, pattern } of LEAKS) {
      for (const m of sentence.matchAll(pattern)) {
        const match = m[0].trim()
        if (kind === "phone" && match.replace(/\D/g, "").length < 8) continue
        if (kind === "phone" && /\d{4}-\d{2}-\d{2}/.test(match)) continue
        if (kind === "email" && ROLE_INBOX.test(match)) continue
        if (kind === "place" && NOT_PLACES.test(match.split(/\s+/).pop() ?? "")) continue
        if (!leaks.some((l) => l.match === match || (l.kind === kind && l.sentence === sentence.trim()))) leaks.push({ kind, match, sentence: sentence.trim() })
      }
    }
  }
  return leaks
}

/** Removes the sentence holding `sentence`, keeping the rest of the layout. */
export function removeSentence(text: string, sentence: string) {
  return text.replace(sentence, "").replace(/[ \t]{2,}/g, " ").replace(/ +\n/g, "\n").replace(/(\r?\n){3,}/g, "$1$1").trim()
}

/**
 * Takes one leaked detail out of the text with as little damage as possible: a place
 * becomes "away", a number or address goes with its "call me on … or" wording, and a
 * health reason takes its sentence with it.
 */
export function redactLeak(text: string, leak: Leak) {
  if (leak.kind === "health") return removeSentence(text, leak.sentence)
  if (leak.kind === "place") return text.replace(leak.match, /^(?:I['’]?m|I am)\b/i.test(leak.match) ? "I'm away" : "away")
  const escaped = leak.match.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  const lead = "(?:(?:call|ring|reach|text|message|whatsapp|phone|email|write to)\\s+(?:me\\s+)?(?:on|at)?\\s*|(?:\\p{Lu}\\p{L}+\\s+)?(?:on|at)\\s+)?"
  // Only the sentence that held the detail is touched, so "Thanks for reaching out." survives.
  const sentence = text.includes(leak.sentence) ? leak.sentence : leak.match
  const next = sentence
    .replace(new RegExp(`${lead}${escaped}(?:\\s*,?\\s*(?:or|and)\\s+)?`, "iu"), "")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\s+([.,!?])/g, "$1")
    .replace(/,\s*\./g, ".")
    .trim()
  // Nothing useful left in that sentence ("For anything urgent, ."): drop it.
  const empty = (next.match(/\p{L}/gu) ?? []).length < 2 || /^[^.!?\n]{0,30}?(?:urgent|contact|reach)[^.!?\n]{0,10}[,:]?\s*[.!?]?$/i.test(next)
  return empty ? removeSentence(text, sentence) : text.replace(sentence, next).trim()
}

/** The text outside senders will receive, or null when they get nothing. */
export function outsideText(reply: AutoReply, platform: AutoReplyPlatform) {
  if (reply.audience === "organization") return null
  if (platform === "gmail") return reply.message
  return reply.externalMessage?.trim() ? reply.externalMessage : null
}

export function checkAutoReply(reply: AutoReply, platform: AutoReplyPlatform, now: string, order: "dmy" | "mdy" = "dmy"): AutoReplyFinding[] {
  const out: AutoReplyFinding[] = []
  const { from, to } = replyWindow(reply, platform)
  if (!from) return [{ kind: "no-start" }]
  if (to && to < from) out.push({ kind: "end-before-start" })
  else if (to && now && to < now) out.push({ kind: "already-over", end: to })

  const found = findReturnDate(`${reply.message}\n${reply.externalMessage ?? ""}`, from.slice(0, 10), order, to ? lastAwayDay(to) : undefined)
  const endFor = (back: string) => (platform === "gmail" ? addDays(back, -1) : `${back}T00:00`)
  if (found && found.back <= from.slice(0, 10)) out.push({ kind: "stale-date", back: found.back, phrase: found.phrase })
  else if (!to) out.push({ kind: "no-end", suggestedEnd: found ? endFor(found.back) : undefined })
  else if (found && !out.some((f) => f.kind === "end-before-start")) {
    const last = lastAwayDay(to)
    const expected = addDays(found.back, -1)
    const slack = found.until ? 1 : 0 // "out until Friday" can mean back on Friday or after it
    if (last === found.back && !found.until) out.push({ kind: "ends-on-return", back: found.back, suggestedEnd: endFor(found.back) })
    else if (daysBetween(last, expected) > slack)
      out.push({ kind: "ends-early", back: found.back, gapFrom: addDays(last, 1), gapTo: expected, suggestedEnd: endFor(found.back) })
    else if (daysBetween(expected, last) > slack) out.push({ kind: "ends-late", back: found.back, days: daysBetween(expected, last), suggestedEnd: endFor(found.back) })
  }

  if (reply.audience === "everyone") out.push({ kind: "everyone" })
  const outside = outsideText(reply, platform)
  if (outside) for (const leak of findLeaks(outside)) out.push({ kind: "leak", leak })
  if (platform === "outlook" && reply.audience !== "organization" && !outside) out.push({ kind: "no-outside-reply" })
  return out
}
