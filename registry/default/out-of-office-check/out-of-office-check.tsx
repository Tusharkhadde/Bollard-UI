"use client"

// Bollard UI — out-of-office-check · MIT licence · https://bollard-ui.vercel.app/components/out-of-office-check

import * as React from "react"
import { CalendarClock, CalendarRange, CircleAlert, Globe, HeartPulse, LoaderCircle, Mail, MapPin, Phone, Undo2 } from "lucide-react"

import { cn } from "@/lib/utils"
import {
  checkAutoReply,
  lastAwayDay,
  redactLeak,
  replyWindow,
  wallNow,
  type AutoReply,
  type AutoReplyAudience,
  type AutoReplyFinding,
  type AutoReplyPlatform,
  type Leak,
  type LeakKind,
} from "./ooo"

export * from "./ooo"

/** Every visible string. Dates and times arrive formatted. */
export const OUT_OF_OFFICE_CHECK_MESSAGES = {
  start: "First day away",
  end: "Last day away",
  endOutlook: "Replies stop",
  noEnd: "No end",
  audience: "Who gets a reply",
  audiences: {
    gmail: { organization: (org: string) => `Only people at ${org}`, contacts: "Only people in my Contacts", everyone: "Everyone who writes" },
    outlook: { organization: (org: string) => `Only people at ${org}`, contacts: "Also my outside contacts", everyone: "Also anyone outside" },
  },
  message: "Reply",
  messageInside: (org: string) => `Reply to people at ${org}`,
  messageOutside: "Reply to people outside",
  window: (from: string, to: string | null) => (to ? `Replies go out from ${from} to ${to}.` : `Replies go out from ${from} and keep going until you turn them off.`),
  who: {
    gmail: {
      organization: (org: string) => `Only people at ${org} get it.`,
      contacts: "Only people in your Contacts get it, colleagues included.",
      everyone: "Everyone who writes gets it, newsletters and strangers included.",
    },
    outlook: {
      organization: (org: string) => `Colleagues at ${org} get it. Outside senders get nothing.`,
      contacts: "Colleagues get the inside reply. Your contacts outside get the outside one.",
      everyone: "Colleagues get the inside reply. Every outside sender gets the outside one.",
    },
  },
  once: "Each sender gets it once, and again if they write after 4 days.",
  findings: {
    "no-start": "Pick your first day away.",
    "end-before-start": "The last day is before the first day.",
    "already-over": (end: string) => `This ended ${end}, so nobody will get it.`,
    "no-end": "No end date, so it keeps replying after you're back.",
    "ends-on-return": (back: string) => `Your reply says you're back ${back}, but it still goes out all that day.`,
    "ends-early": (back: string, from: string, to: string) => `Your reply says you're back ${back}, but it stops early. People who write ${from === to ? `on ${from}` : `${from} – ${to}`} get no reply.`,
    "ends-late": (back: string, days: number) => `Your reply says you're back ${back}, but it keeps saying you're away for ${days} more ${days === 1 ? "day" : "days"}.`,
    "stale-date": (back: string, phrase: string) => `The reply says “${phrase}” (${back}), which is before it starts. Left over from last time?`,
    everyone: "Every outside sender gets it: newsletters, spam and strangers. It also tells them your address is live.",
    "no-outside-reply": "Outside senders get nothing: the outside reply is empty.",
  },
  leak: { phone: "a phone number", email: "a person's address", place: "where you are", health: "a health reason" } as Record<LeakKind, string>,
  leakText: (what: string, match: string) => `Outside senders see ${what}: “${match}”.`,
  gmailOneReply: "Gmail sends the same reply to everyone.",
  fixEnd: (date: string) => `End ${date}`,
  swap: "Swap the dates",
  showPhrase: "Show me",
  contactsOnly: "Only my contacts",
  redact: { phone: "Remove the number", email: "Remove the address", place: "Just say “away”", health: "Remove that sentence" } as Record<LeakKind, string>,
  safeOutside: "Use a short outside reply",
  safeReply: (until: string | null, contact: string | null) =>
    `Thank you for your email. I'm away${until ? ` until ${until}` : ""} with limited access to email.${contact ? ` For anything urgent, please write to ${contact}.` : ""}`,
  undo: "Undo",
  undone: "Change undone.",
  done: (left: number) => (left ? `Fixed. ${left} left to check.` : "Fixed. Nothing left to check."),
  summary: (count: number) => (count ? `${count} ${count === 1 ? "thing" : "things"} to check in your auto-reply.` : "Auto-reply looks right."),
  save: "Save auto-reply",
  saving: "Saving…",
  saved: "Saved.",
  failed: "It didn't save, so your old auto-reply is still on. Try again.",
}
export type OutOfOfficeCheckMessages = typeof OUT_OF_OFFICE_CHECK_MESSAGES

export interface OutOfOfficeCheckProps extends Omit<React.ComponentProps<"div">, "defaultValue" | "onSubmit"> {
  /** Controlled auto-reply settings. */
  value?: AutoReply
  /** Initial auto-reply settings when uncontrolled. */
  defaultValue?: AutoReply
  /** Called with the settings on every change. */
  onValueChange?: (reply: AutoReply) => void
  /** Gmail: dates, one reply. Outlook: dates and times, an inside and an outside reply. */
  platform?: AutoReplyPlatform
  /** The mail account's time zone. Every date and time is read in it. */
  timeZone?: string
  /** Pass for deterministic rendering; otherwise the clock is read after mount. */
  now?: Date
  /** Your organisation, used in labels ("Only people at Acme"). */
  organization?: string
  /** A team inbox for the short outside reply, e.g. "support@acme.com". */
  fallbackContact?: string
  /** How to read 27/10 in the reply text. */
  dateOrder?: "dmy" | "mdy"
  /** BCP 47 locale for dates. */
  locale?: string
  /** Saves the auto-reply. Return a promise for a pending state; a rejection keeps the form as it is. */
  onSave?: (reply: AutoReply) => void | Promise<void>
  /** Override any visible string. */
  messages?: Partial<OutOfOfficeCheckMessages>
}

const input =
  "h-9 w-full min-w-0 rounded-md border bg-transparent px-3 text-base shadow-xs transition-[color,box-shadow] outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 md:text-sm dark:bg-input/30 aria-invalid:border-destructive"
const area = cn(input, "h-auto min-h-20 resize-y py-2")
const fixClass =
  "inline-flex h-7 items-center rounded-md border border-amber-500/40 px-2 text-xs font-medium text-amber-900 transition-colors hover:bg-amber-500/10 dark:text-amber-200 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
const ICONS: Record<LeakKind, typeof Phone> = { phone: Phone, email: Mail, place: MapPin, health: HeartPulse }
const ERRORS = new Set<AutoReplyFinding["kind"]>(["no-start", "end-before-start"])

/**
 * An out-of-office editor that checks the auto-reply the way the mail server will run it.
 * It reads back exactly when replies go out (Gmail's end date runs to 11:59 PM) and who
 * gets which text, and it compares the dates with the return date written in the
 * message: replying all day on the day you're back, stopping days early, no end date at
 * all, or a date left over from last time. It also catches outside replies that hand
 * strangers a phone number, a colleague's direct address, where you are or a health
 * reason, and replies to every outside sender, each with a one-tap fix and Undo.
 */
export function OutOfOfficeCheck({
  value,
  defaultValue,
  onValueChange,
  platform = "gmail",
  timeZone = "UTC",
  now: nowProp,
  organization = "your organisation",
  fallbackContact,
  dateOrder = "dmy",
  locale = "en-IN",
  onSave,
  messages,
  className,
  ...props
}: OutOfOfficeCheckProps) {
  const t = { ...OUT_OF_OFFICE_CHECK_MESSAGES, ...messages }
  const [inner, setInner] = React.useState<AutoReply>(defaultValue ?? { start: "", end: "", message: "", audience: "organization" })
  const reply = value ?? inner
  const [clock, setClock] = React.useState<Date>()
  const [history, setHistory] = React.useState<AutoReply[]>([])
  const [status, setStatus] = React.useState("")
  const [save, setSave] = React.useState<"idle" | "saving" | "saved" | "failed">("idle")
  const refocus = React.useRef(false)
  const rootRef = React.useRef<HTMLDivElement>(null)
  const saveRef = React.useRef<HTMLButtonElement>(null)
  const messageRef = React.useRef<HTMLTextAreaElement>(null)
  const id = React.useId()

  React.useEffect(() => {
    if (!nowProp) setClock(new Date())
  }, [nowProp])
  const now = nowProp ?? clock
  const wall = now ? wallNow(now, timeZone) : ""
  const findings = React.useMemo(() => checkAutoReply(reply, platform, wall, dateOrder), [reply, platform, wall, dateOrder])
  const { from, to } = replyWindow(reply, platform)
  const blocked = findings.some((f) => ERRORS.has(f.kind))

  const fmtDay = (date: string) => {
    const d = new Date(`${date.slice(0, 10)}T00:00:00Z`)
    return Number.isNaN(d.getTime()) ? date : new Intl.DateTimeFormat(locale, { timeZone: "UTC", weekday: "short", day: "numeric", month: "short" }).format(d)
  }
  const fmtTime = (w: string) => `${fmtDay(w)}, ${new Intl.DateTimeFormat(locale, { timeZone: "UTC", hour: "numeric", minute: "2-digit" }).format(new Date(`${w}:00Z`))}`
  const fmtEnd = (end: string) => (platform === "gmail" ? fmtDay(end) : fmtTime(end))

  // One calm summary after typing pauses, never per keystroke.
  const summary = t.summary(findings.length)
  const [spoken, setSpoken] = React.useState("")
  React.useEffect(() => {
    const timer = setTimeout(() => setSpoken(status || summary), 1200)
    return () => clearTimeout(timer)
  }, [summary, status])
  React.useEffect(() => {
    if (!refocus.current) return
    refocus.current = false
    ;(rootRef.current?.querySelector<HTMLButtonElement>("[data-fix]") ?? saveRef.current)?.focus()
  }, [reply])

  const update = (next: AutoReply, fixed = false) => {
    if (value === undefined) setInner(next)
    onValueChange?.(next)
    setSave("idle")
    if (!fixed) return setStatus("")
    setHistory((h) => [...h, reply].slice(-20))
    refocus.current = true
    setStatus(t.done(checkAutoReply(next, platform, wall, dateOrder).length))
  }
  const fix = (change: Partial<AutoReply>) => update({ ...reply, ...change }, true)
  const undo = () => {
    const previous = history[history.length - 1]
    if (!previous) return
    setHistory((h) => h.slice(0, -1))
    if (value === undefined) setInner(previous)
    onValueChange?.(previous)
    refocus.current = history.length === 1
    setStatus(t.undone)
  }
  const removeLeak = (leak: Leak) =>
    platform === "gmail" ? fix({ message: redactLeak(reply.message, leak) }) : fix({ externalMessage: redactLeak(reply.externalMessage ?? "", leak) })
  const firstLeak = findings.findIndex((f) => f.kind === "leak")
  const lastDay = to ? lastAwayDay(to) : null
  const safe = t.safeReply(lastDay ? fmtDay(lastDay) : null, fallbackContact ?? null)
  const showPhrase = (phrase: string) => {
    const el = messageRef.current
    if (!el) return
    const at = el.value.indexOf(phrase)
    el.focus()
    if (at >= 0) el.setSelectionRange(at, at + phrase.length)
  }

  const button = (label: string, onClick: () => void) => (
    <button type="button" data-fix="" className={fixClass} onClick={onClick}>
      {label}
    </button>
  )
  const describe = (f: AutoReplyFinding, index: number): [React.ReactNode, React.ReactNode?] => {
    const F = t.findings
    switch (f.kind) {
      case "no-start": return [F["no-start"]]
      case "end-before-start": return [F["end-before-start"], button(t.swap, () => fix({ start: reply.end ?? "", end: reply.start }))]
      case "already-over": return [F["already-over"](fmtEnd(f.end))]
      case "no-end": return [F["no-end"], f.suggestedEnd && button(t.fixEnd(fmtEnd(f.suggestedEnd)), () => fix({ end: f.suggestedEnd }))]
      case "ends-on-return": return [F["ends-on-return"](fmtDay(f.back)), button(t.fixEnd(fmtEnd(f.suggestedEnd)), () => fix({ end: f.suggestedEnd }))]
      case "ends-early": return [F["ends-early"](fmtDay(f.back), fmtDay(f.gapFrom), fmtDay(f.gapTo)), button(t.fixEnd(fmtEnd(f.suggestedEnd)), () => fix({ end: f.suggestedEnd }))]
      case "ends-late": return [F["ends-late"](fmtDay(f.back), f.days), button(t.fixEnd(fmtEnd(f.suggestedEnd)), () => fix({ end: f.suggestedEnd }))]
      case "stale-date": return [F["stale-date"](fmtDay(f.back), f.phrase), button(t.showPhrase, () => showPhrase(f.phrase))]
      case "everyone": return [F.everyone, button(t.contactsOnly, () => fix({ audience: "contacts" }))]
      case "no-outside-reply": return [F["no-outside-reply"], button(t.safeOutside, () => fix({ externalMessage: safe }))]
      case "leak":
        return [
          <>
            {t.leakText(t.leak[f.leak.kind], f.leak.match)}
            {platform === "gmail" && index === firstLeak && <> {t.gmailOneReply}</>}
          </>,
          <>
            {button(t.redact[f.leak.kind], () => removeLeak(f.leak))}
            {platform === "outlook" && button(t.safeOutside, () => fix({ externalMessage: safe }))}
          </>,
        ]
    }
  }

  const doSave = async () => {
    if (!onSave || blocked || save === "saving") return
    setSave("saving")
    try {
      await onSave(reply)
      setSave("saved")
    } catch {
      setSave("failed")
    }
  }

  const dateType = platform === "gmail" ? "date" : "datetime-local"
  const audiences = t.audiences[platform]

  return (
    <div ref={rootRef} data-slot="out-of-office-check" data-state={findings.length ? "warning" : "ok"} className={cn("grid w-full min-w-0 max-w-md grid-cols-1 gap-3 text-sm", className)} {...props}>
      <div className="grid grid-cols-1 gap-3 min-[400px]:grid-cols-2">
        <label className="grid min-w-0 gap-1.5 font-medium">
          {t.start}
          <input type={dateType} value={reply.start} aria-invalid={findings.some((f) => f.kind === "no-start" || f.kind === "end-before-start") || undefined} onChange={(e) => update({ ...reply, start: e.target.value })} className={input} />
        </label>
        <label className="grid min-w-0 gap-1.5 font-medium">
          {platform === "gmail" ? t.end : t.endOutlook}
          <input type={dateType} value={reply.end ?? ""} aria-invalid={findings.some((f) => f.kind === "end-before-start") || undefined} onChange={(e) => update({ ...reply, end: e.target.value })} className={input} />
        </label>
      </div>

      <fieldset className="grid gap-1.5">
        <legend className="mb-1.5 font-medium">{t.audience}</legend>
        {(["organization", "contacts", "everyone"] as AutoReplyAudience[]).map((a) => (
          <label key={a} className="flex items-center gap-2">
            <input type="radio" name={`${id}-aud`} checked={reply.audience === a} onChange={() => update({ ...reply, audience: a })} className="size-4 accent-(--primary)" />
            {a === "organization" ? audiences.organization(organization) : audiences[a]}
          </label>
        ))}
      </fieldset>

      <label className="grid gap-1.5 font-medium">
        {platform === "gmail" ? t.message : t.messageInside(organization)}
        <textarea ref={messageRef} value={reply.message} onChange={(e) => update({ ...reply, message: e.target.value })} className={area} />
      </label>
      {platform === "outlook" && reply.audience !== "organization" && (
        <label className="grid gap-1.5 font-medium">
          {t.messageOutside}
          <textarea value={reply.externalMessage ?? ""} onChange={(e) => update({ ...reply, externalMessage: e.target.value })} className={area} />
        </label>
      )}

      <div className="grid gap-2 rounded-lg border bg-muted/30 p-3">
        <p className="flex gap-2">
          <CalendarRange aria-hidden className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          <span>
            {from ? t.window(fmtTime(from), to ? fmtTime(to) : null) : t.findings["no-start"]}{" "}
            <span className="text-muted-foreground">({timeZone})</span>
          </span>
        </p>
        <p className="flex gap-2 text-muted-foreground">
          <Globe aria-hidden className="mt-0.5 size-4 shrink-0" />
          <span>
            {reply.audience === "organization" ? t.who[platform].organization(organization) : t.who[platform][reply.audience]}
            {platform === "gmail" && <> {t.once}</>}
          </span>
        </p>
        {findings.length > 0 && (
          <ul id={`${id}-findings`} className="grid gap-2.5 border-t pt-2.5">
            {findings.map((f, i) => {
              const [text, fixes] = describe(f, i)
              const error = ERRORS.has(f.kind) || f.kind === "already-over"
              const Icon = f.kind === "leak" ? ICONS[f.leak.kind] : error ? CircleAlert : CalendarClock
              return (
                <li key={`${f.kind}-${i}`} className={cn("flex gap-2", error ? "text-red-700 dark:text-red-400" : "text-amber-800 dark:text-amber-300")}>
                  <Icon aria-hidden className="mt-0.5 size-4 shrink-0" />
                  <div className="grid min-w-0 gap-1.5 break-words">
                    <span>{text}</span>
                    {fixes && <span className="flex flex-wrap gap-1.5">{fixes}</span>}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {save === "failed" && <p role="alert" className="text-xs text-red-700 dark:text-red-400">{t.failed}</p>}
      <div className="flex flex-wrap items-center justify-end gap-2">
        {history.length > 0 && (
          <button type="button" onClick={undo} className="mr-auto inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-sm font-medium outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50">
            <Undo2 aria-hidden className="size-4" />
            {t.undo}
          </button>
        )}
        {save === "saved" && <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400">{t.saved}</span>}
        {onSave && (
          <button
            ref={saveRef}
            type="button"
            onClick={() => void doSave()}
            aria-disabled={blocked || undefined}
            aria-describedby={blocked ? `${id}-findings` : undefined}
            aria-busy={save === "saving" || undefined}
            className="inline-flex h-9 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow-xs outline-none hover:bg-primary/90 focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-disabled:cursor-not-allowed aria-disabled:opacity-50"
          >
            {save === "saving" && <LoaderCircle aria-hidden className="size-4 animate-spin" />}
            {save === "saving" ? t.saving : t.save}
          </button>
        )}
      </div>
      <p role="status" className="sr-only">{save === "saved" ? t.saved : spoken}</p>
    </div>
  )
}
