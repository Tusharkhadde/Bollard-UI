"use client"

import * as React from "react"
import { Contact, Eye, FileText, Globe, LoaderCircle, Pencil, Repeat, Send, ShieldAlert, Undo2, UserPlus, Users, X } from "lucide-react"

import { cn } from "@/lib/utils"
import {
  analyzeExposure,
  DEFAULT_SENSITIVE_TERMS,
  stripSensitiveLines,
  type DirectoryPerson,
  type ExposureFinding,
  type GuardedEvent,
} from "./exposure"

export * from "./exposure"

const list = (items: string[]) => (items.length < 2 ? items.join("") : `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`)
const quote = (items: string[]) => list(items.map((t) => `“${t}”`))

/** Every visible string. */
export const CALENDAR_EXTERNAL_GUEST_GUARD_MESSAGES = {
  heading: (count: number, org: string) => `${count} ${count === 1 ? "guest is" : "guests are"} outside ${org}`,
  allInternal: (org: string) => `Every guest is at ${org}.`,
  personal: "personal",
  remove: (email: string) => `Remove ${email}`,
  exposureTitle: "What they'll get",
  always: "Always: the title, time, place and video link.",
  personalMatch: (email: string, name: string, work: string) => `${email} looks like ${name}'s personal address. Their work address is ${work}.`,
  useWork: (email: string) => `Use ${email}`,
  description: (terms: string[]) => `The agenda mentions ${quote(terms)}.`,
  stripLines: (count: number) => (count === 1 ? "Remove that line" : `Remove those ${count} lines`),
  fileAnyone: (name: string) => `“${name}” opens for anyone with the link, so they can read it and pass it on.`,
  fileGuests: (name: string) => `“${name}” is shared with every guest, so they can open it.`,
  fileName: (name: string, terms: string[]) => `They can't open “${name}”, but they see its name, which mentions ${quote(terms)}.`,
  limitFile: (org: string) => `Limit to ${org}`,
  removeFile: "Remove file",
  guestList: (others: number, internal: number) => `They see the other ${others} ${others === 1 ? "guest's address" : "guests' addresses"}${internal ? `, ${internal} of them your colleagues` : ""}.`,
  hideList: "Hide guest list",
  canInvite: "They can invite more people from their side.",
  stopInvite: "Turn off Invite others",
  canModify: "They can change the time, the guests and the agenda.",
  stopModify: "Turn off Modify event",
  recurring: "This is a series: they get every future meeting and every agenda change.",
  undo: "Undo",
  undone: "Change undone.",
  done: (left: number) => (left ? `Done. ${left} left to check.` : "Done. Nothing left to check."),
  send: "Send invite",
  sendExternal: (count: number) => `Send, ${count} outside`,
  confirm: (count: number) => `Send with ${count} open ${count === 1 ? "issue" : "issues"}`,
  armedHint: "Check the list, then press send again. Escape to go back.",
  back: "Back",
  sending: "Sending…",
  sent: "Invite sent.",
  failed: "The invite didn't go out. Nothing was sent, so you can try again.",
}
export type CalendarExternalGuestGuardMessages = typeof CALENDAR_EXTERNAL_GUEST_GUARD_MESSAGES

export interface CalendarExternalGuestGuardProps extends Omit<React.ComponentProps<"section">, "defaultValue" | "onSubmit"> {
  /** Controlled event. */
  value?: GuardedEvent
  /** Initial event when uncontrolled. */
  defaultValue?: GuardedEvent
  /** Called with the event after every fix (and after Undo). */
  onValueChange?: (event: GuardedEvent) => void
  /** Your organisation's email domains. Subdomains count as yours. */
  domains: string[]
  /** Shown in copy, e.g. "Acme". Defaults to the first domain. */
  organization?: string
  /** Colleagues, used to spot a personal address standing in for a work one. */
  directory?: DirectoryPerson[]
  /** Words that mark the agenda or a file name as internal. */
  sensitiveTerms?: string[]
  /** Sends the invite. Return a promise for a pending state; a rejection keeps everything as it was. */
  onSend: (event: GuardedEvent) => void | Promise<void>
  /** Override any visible string. */
  messages?: Partial<CalendarExternalGuestGuardMessages>
}

const fixClass =
  "inline-flex h-7 items-center gap-1 rounded-md border border-amber-500/40 px-2 text-xs font-medium text-amber-900 transition-colors hover:bg-amber-500/10 dark:text-amber-200 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
const btn =
  "inline-flex h-9 items-center justify-center gap-2 rounded-md px-4 text-sm font-medium whitespace-nowrap shadow-xs transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50"
const HIGH = new Set<ExposureFinding["kind"]>(["personal", "description", "file-open", "file-name", "can-modify"])

function Highlight({ text, terms }: { text: string; terms: string[] }) {
  if (!terms.length) return <>{text}</>
  const pattern = new RegExp(`(${terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/'/g, "['\u2018\u2019\u02BC]")).join("|")})`, "giu")
  return (
    <>
      {text.split(pattern).map((part, i) =>
        i % 2 ? <mark key={i} className="rounded-sm bg-amber-200/70 px-0.5 text-inherit dark:bg-amber-400/30">{part}</mark> : part,
      )}
    </>
  )
}

/**
 * An invite review that stops an internal meeting going to outside guests with more
 * than you meant to share. It names who is outside your domains (and a colleague's
 * personal Gmail standing in for their work address), then lists what those guests
 * will really get, following Google Calendar's rules: the agenda and every file name
 * are visible to all guests, "anyone with the link" files open for them, and the
 * guest list and invite and edit rights apply to them too. Each item has a one-tap
 * fix with Undo; sending with serious items still open takes a second, deliberate press.
 */
export function CalendarExternalGuestGuard({
  value,
  defaultValue,
  onValueChange,
  domains,
  organization,
  directory = [],
  sensitiveTerms = DEFAULT_SENSITIVE_TERMS,
  onSend,
  messages,
  className,
  ...props
}: CalendarExternalGuestGuardProps) {
  const t = { ...CALENDAR_EXTERNAL_GUEST_GUARD_MESSAGES, ...messages }
  const [inner, setInner] = React.useState<GuardedEvent>(defaultValue ?? { title: "", guests: [] })
  const event = value ?? inner
  const [history, setHistory] = React.useState<GuardedEvent[]>([])
  const [rev, setRev] = React.useState(0)
  const [armedRev, setArmedRev] = React.useState<number>()
  const [state, setState] = React.useState<"idle" | "sending" | "sent" | "failed">("idle")
  const [status, setStatus] = React.useState("")
  const armedAt = React.useRef(0)
  const refocus = React.useRef(false)
  const rootRef = React.useRef<HTMLElement>(null)
  const sendRef = React.useRef<HTMLButtonElement>(null)
  const id = React.useId()
  const org = organization ?? domains[0] ?? ""

  const exposure = React.useMemo(() => analyzeExposure(event, domains, directory, sensitiveTerms), [event, domains, directory, sensitiveTerms])
  const serious = exposure.findings.filter((f) => HIGH.has(f.kind)).length
  const armed = armedRev === rev && serious > 0

  React.useEffect(() => {
    if (!refocus.current) return
    refocus.current = false
    const next = rootRef.current?.querySelector<HTMLButtonElement>("[data-fix]")
    ;(next ?? sendRef.current)?.focus()
  }, [rev])

  React.useEffect(() => {
    if (!status) return
    const timer = setTimeout(() => setStatus(""), 4000)
    return () => clearTimeout(timer)
  }, [status])

  const commit = (next: GuardedEvent, previous: GuardedEvent | null) => {
    if (value === undefined) setInner(next)
    onValueChange?.(next)
    setHistory((h) => (previous ? [...h, previous].slice(-20) : h.slice(0, -1)))
    setRev((r) => r + 1)
    setState("idle")
    refocus.current = true
  }
  const apply = (change: Partial<GuardedEvent>) => {
    const next = { ...event, ...change }
    commit(next, event)
    const left = analyzeExposure(next, domains, directory, sensitiveTerms).findings.length
    setStatus(t.done(left))
  }
  const undo = () => {
    const previous = history[history.length - 1]
    if (!previous) return
    commit(previous, null)
    setStatus(t.undone)
  }
  const setAccess = (fileId: string, access: "organization" | null) =>
    apply({
      attachments: access
        ? event.attachments?.map((f) => (f.id === fileId ? { ...f, access } : f))
        : event.attachments?.filter((f) => f.id !== fileId),
    })

  const send = async () => {
    if (state === "sending") return
    if (serious && !armed) {
      armedAt.current = performance.now()
      setArmedRev(rev)
      setStatus(t.armedHint)
      return
    }
    if (armed && performance.now() - armedAt.current < 400) return // a double click can't confirm
    setState("sending")
    try {
      await onSend(event)
      setState("sent")
      setArmedRev(undefined)
    } catch {
      setState("failed")
    }
  }

  const row = (key: string, Icon: typeof Eye, text: React.ReactNode, high: boolean, fixes?: React.ReactNode) => (
    <li key={key} className={cn("flex gap-2", high ? "text-amber-800 dark:text-amber-300" : "text-muted-foreground")}>
      <Icon aria-hidden className="mt-0.5 size-4 shrink-0" />
      <div className="grid min-w-0 flex-1 grid-cols-1 gap-1.5">
        <div className="break-words">{text}</div>
        {fixes && <div className="flex flex-wrap gap-1.5">{fixes}</div>}
      </div>
    </li>
  )
  const fix = (label: string, onClick: () => void) => (
    <button type="button" data-fix="" className={fixClass} onClick={onClick}>
      {label}
    </button>
  )

  const renderFinding = (f: ExposureFinding) => {
    switch (f.kind) {
      case "personal":
        return row(`p-${f.guest.email}`, Contact, t.personalMatch(f.guest.email, f.work.name, f.work.email), true,
          fix(t.useWork(f.work.email), () => apply({ guests: event.guests.map((g) => (g.email === f.guest.email ? { email: f.work.email, name: f.work.name } : g)) })))
      case "description":
        return row("desc", FileText, (
          <>
            {t.description(f.terms)}
            {f.lines.length > 0 && (
              <ul className="mt-1 grid grid-cols-1 gap-0.5 border-l-2 border-amber-500/40 pl-2 text-xs text-foreground/80">
                {f.lines.slice(0, 3).map((line, i) => (
                  <li key={i} className="truncate"><Highlight text={line.trim()} terms={f.terms} /></li>
                ))}
              </ul>
            )}
          </>
        ), true, f.lines.length > 0 && fix(t.stripLines(f.lines.length), () => apply({ description: stripSensitiveLines(event.description ?? "", sensitiveTerms) })))
      case "file-open":
        return row(`fo-${f.file.id}`, Eye, f.file.access === "anyone" ? t.fileAnyone(f.file.name) : t.fileGuests(f.file.name), true, (
          <>
            {fix(t.limitFile(org), () => setAccess(f.file.id, "organization"))}
            {fix(t.removeFile, () => setAccess(f.file.id, null))}
          </>
        ))
      case "file-name":
        return row(`fn-${f.file.id}`, FileText, t.fileName(f.file.name, f.terms), true, fix(t.removeFile, () => setAccess(f.file.id, null)))
      case "can-modify":
        return row("mod", Pencil, t.canModify, true, fix(t.stopModify, () => apply({ guestsCanModify: false })))
      case "guest-list":
        return row("list", Users, t.guestList(f.others, f.internal), false, fix(t.hideList, () => apply({ guestsCanSeeList: false })))
      case "can-invite":
        return row("inv", UserPlus, t.canInvite, false, fix(t.stopInvite, () => apply({ guestsCanInvite: false })))
    }
  }

  return (
    <section
      ref={rootRef}
      data-slot="calendar-external-guest-guard"
      data-state={armed ? "confirming" : state}
      aria-labelledby={`${id}-title`}
      onKeyDown={(e) => e.key === "Escape" && armed && (setArmedRev(undefined), sendRef.current?.focus())}
      className={cn("grid w-full min-w-0 max-w-md grid-cols-1 gap-3 rounded-xl border bg-card p-4 text-sm text-card-foreground", className)}
      {...props}
    >
      <h3 id={`${id}-title`} className="flex items-center gap-2 font-medium">
        {exposure.external.length ? <Globe aria-hidden className="size-4 shrink-0 text-amber-600 dark:text-amber-400" /> : <Users aria-hidden className="size-4 shrink-0 text-muted-foreground" />}
        {exposure.external.length ? t.heading(exposure.external.length, org) : t.allInternal(org)}
      </h3>

      {exposure.external.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {exposure.external.map(({ guest, personal }) => (
            <li key={guest.email} className="inline-flex h-7 max-w-full min-w-0 items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/10 pr-0.5 pl-2.5 text-xs">
              <span className="truncate" title={guest.email}>{guest.email}</span>
              {personal && <span className="shrink-0 rounded-full bg-amber-500/20 px-1.5 text-[11px] text-amber-900 dark:text-amber-200">{t.personal}</span>}
              <button
                type="button"
                aria-label={t.remove(guest.email)}
                onClick={() => apply({ guests: event.guests.filter((g) => g.email !== guest.email) })}
                className="grid size-6 shrink-0 place-items-center rounded-full text-muted-foreground outline-none hover:bg-amber-500/20 hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                <X aria-hidden className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {exposure.external.length > 0 && (
        <div className="grid min-w-0 grid-cols-1 gap-2 rounded-lg border bg-muted/30 p-3">
          <p className="flex items-center gap-1.5 text-xs font-medium tracking-wide text-muted-foreground uppercase">
            <ShieldAlert aria-hidden className="size-3.5" />
            {t.exposureTitle}
          </p>
          <ul className="grid grid-cols-1 gap-2.5">
            {exposure.findings.map(renderFinding)}
            {event.recurring && row("rec", Repeat, t.recurring, false)}
            {row("always", Eye, t.always, false)}
          </ul>
        </div>
      )}

      {state === "failed" && <p role="alert" className="text-xs text-red-700 dark:text-red-400">{t.failed}</p>}
      {state === "sent" && <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400">{t.sent}</p>}

      <div className="flex flex-wrap items-center justify-end gap-2">
        {history.length > 0 && !armed && (
          <button type="button" onClick={undo} className={cn(btn, "mr-auto h-8 px-3 shadow-none hover:bg-accent")}>
            <Undo2 aria-hidden className="size-4" />
            {t.undo}
          </button>
        )}
        {armed && (
          <button type="button" onClick={() => (setArmedRev(undefined), sendRef.current?.focus())} className={cn(btn, "border bg-background hover:bg-accent dark:bg-input/30")}>
            {t.back}
          </button>
        )}
        <button
          ref={sendRef}
          type="button"
          onClick={() => void send()}
          aria-busy={state === "sending" || undefined}
          aria-describedby={armed ? `${id}-armed` : undefined}
          className={cn(
            btn,
            "min-w-0",
            armed
              ? "bg-amber-700 text-white hover:bg-amber-800 dark:bg-amber-400 dark:text-amber-950 dark:hover:bg-amber-300"
              : "bg-primary text-primary-foreground hover:bg-primary/90",
          )}
        >
          {state === "sending" ? <LoaderCircle aria-hidden className="size-4 animate-spin" /> : <Send aria-hidden className="size-4" />}
          {state === "sending" ? t.sending : armed ? t.confirm(serious) : exposure.external.length ? t.sendExternal(exposure.external.length) : t.send}
        </button>
      </div>
      <p id={`${id}-armed`} className="sr-only">{armed ? t.armedHint : ""}</p>
      <p role="status" className="sr-only">{status || (state === "sent" ? t.sent : "")}</p>
    </section>
  )
}
