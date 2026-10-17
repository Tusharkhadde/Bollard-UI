"use client"

// Bollard UI — retract-window · MIT licence · https://bollard-ui.vercel.app/components/retract-window

import * as React from "react"
import { Eye, Info, LoaderCircle, MessageSquareX, Pencil, Smartphone, Trash2, Undo2 } from "lucide-react"

import { cn } from "@/lib/utils"
import { formatLeft, RETRACT_POLICIES, retractState, type RetractPlatform, type RetractPolicy, type RetractRecipient } from "./policies"

export * from "./policies"

const list = (items: string[]) => (items.length < 2 ? items.join("") : `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`)

/** Every visible string. Times arrive formatted. */
export const RETRACT_WINDOW_MESSAGES = {
  sent: (time: string) => `Sent ${time}`,
  readBy: (names: string[]) => `Read by ${list(names)}`,
  edit: "Edit",
  editsLeft: (n: number) => `${n} ${n === 1 ? "edit" : "edits"} left`,
  until: (time: string) => `until ${time}`,
  anyTime: "any time",
  left: (left: string) => `${left} left`,
  closed: (action: string, time: string) => `${action} closed at ${time}.`,
  noEditsLeft: "No edits left.",
  nowClosed: (action: string) => `${action} is no longer available.`,
  alreadyRead: (names: string[]) => `${list(names)} ${names.length === 1 ? "has" : "have"} already read it. Unsending won't unsee it.`,
  keeps: (names: string[]) => `${list(names)} will keep the original even if you unsend it.`,
  correction: "Send a correction",
  deleteForMe: "Delete for me",
  deleteForMeNote: (names: string[]) => `Only from your screen. ${names.length ? list(names) : "Everyone else"} still ${names.length === 1 ? "has" : "have"} it.`,
  unsending: "Removing…",
  unsent: (kept: string[]) => (kept.length ? `Unsent. ${list(kept)} may still see the original.` : "Unsent for everyone."),
  failed: "It couldn't be removed, so it's still in the chat. Send a correction instead.",
}
export type RetractWindowMessages = typeof RETRACT_WINDOW_MESSAGES

export interface RetractWindowProps extends Omit<React.ComponentProps<"div">, "children"> {
  /** The sent message, rendered as a bubble. */
  children?: React.ReactNode
  /** When the message was sent. */
  sentAt: Date | string | number
  /** A preset ("imessage", "whatsapp", "slack") or your own rules. */
  policy?: RetractPlatform | RetractPolicy
  /** Who it went to, whether they've read it and whether their app can remove it. */
  recipients?: RetractRecipient[]
  /** Edits already made (iMessage allows five). */
  editsUsed?: number
  /** Pass for a deterministic start; the countdown then runs from it. Otherwise the clock is read after mount. */
  now?: Date
  /** IANA zone for displayed times. */
  timeZone?: string
  /** Locale for displayed times. */
  locale?: string
  /** Opens the editor. Without it there's no Edit row. */
  onEdit?: () => void
  /** Removes it for everyone. Return a promise for a pending state; a rejection means it stayed. */
  onUnsend?: () => void | Promise<void>
  /** Removes it only from this device. */
  onDeleteForMe?: () => void
  /** Offered once the windows have closed or an unsend fails. */
  onSendCorrection?: () => void
  /** Override any visible string. */
  messages?: Partial<RetractWindowMessages>
}

function useClock(start?: number) {
  const [now, setNow] = React.useState<number>()
  React.useEffect(() => {
    const origin = [start ?? Date.now(), Date.now()]
    const tick = () => setNow(origin[0] + (Date.now() - origin[1]))
    tick()
    const timer = setInterval(tick, 1000)
    return () => clearInterval(timer)
  }, [start])
  return now ?? start
}

/**
 * The after-send panel that is honest about what can still be taken back. It shows how
 * long Edit and Unsend stay open on this platform (iMessage: 2 minutes to unsend, 15 to
 * edit; WhatsApp: 15 minutes to edit, two days to delete for everyone) with a draining
 * bar that turns amber near the end, and says plainly who has already read it and whose
 * app will keep the original anyway. It keeps "Delete for me" apart and labelled as
 * leaving everyone else's copy, reports who still has it after an unsend, and offers a
 * correction once the windows close. Countdowns are never read aloud; only a window
 * closing is.
 */
export function RetractWindow({
  children,
  sentAt,
  policy: policyProp = "imessage",
  recipients = [],
  editsUsed = 0,
  now: nowProp,
  timeZone,
  locale = "en-IN",
  onEdit,
  onUnsend,
  onDeleteForMe,
  onSendCorrection,
  messages,
  className,
  ...props
}: RetractWindowProps) {
  const t = { ...RETRACT_WINDOW_MESSAGES, ...messages }
  const policy = typeof policyProp === "string" ? RETRACT_POLICIES[policyProp] ?? RETRACT_POLICIES.imessage : policyProp
  const now = useClock(nowProp?.getTime())
  const [state, setState] = React.useState<"open" | "unsending" | "unsent" | "failed">("open")
  const [status, setStatus] = React.useState("")
  const wasOpen = React.useRef({ edit: false, unsend: false })
  const cardRef = React.useRef<HTMLDivElement>(null)
  const doneRef = React.useRef<HTMLParagraphElement>(null)
  const focusInside = React.useRef(false)
  const id = React.useId()

  const w = now === undefined ? null : retractState(sentAt, now, policy, editsUsed)
  const editOpen = !!w && w.edit.left > 0
  const unsendOpen = !!w && w.unsend.left > 0
  const fmt = (ms: number) => {
    if (!Number.isFinite(ms)) return ""
    try {
      return new Intl.DateTimeFormat(locale, { timeZone, hour: "numeric", minute: "2-digit" }).format(ms)
    } catch {
      return new Date(ms).toLocaleTimeString()
    }
  }
  const sent = sentAt instanceof Date ? sentAt.getTime() : typeof sentAt === "number" ? sentAt : Date.parse(sentAt)
  const readers = recipients.filter((r) => r.read).map((r) => r.name)
  const keepers = recipients.filter((r) => r.canRetract === false).map((r) => r.name)

  React.useEffect(() => {
    if (!w) return
    const lost = [wasOpen.current.unsend && !unsendOpen && policy.unsendLabel, wasOpen.current.edit && !editOpen && t.edit].filter(Boolean)
    if (lost.length && state === "open") {
      setStatus(t.nowClosed(lost.join(", ")))
      keepFocus()
    }
    wasOpen.current = { edit: editOpen, unsend: unsendOpen }
  }, [editOpen, unsendOpen]) // eslint-disable-line react-hooks/exhaustive-deps

  // When the focused button disappears (a window closed), keep focus in the panel instead of dropping it on <body>.
  const keepFocus = (target?: HTMLElement | null) => {
    requestAnimationFrame(() => {
      const active = document.activeElement
      if (!focusInside.current || (active && active !== document.body)) return
      ;(target ?? cardRef.current?.querySelector<HTMLElement>("button") ?? cardRef.current)?.focus()
    })
  }

  const unsend = async () => {
    if (!onUnsend || state === "unsending") return
    setState("unsending")
    try {
      await onUnsend()
      setState("unsent")
      setStatus(t.unsent(keepers))
      requestAnimationFrame(() => doneRef.current?.focus())
    } catch {
      setState("failed")
      setStatus(t.failed)
      keepFocus()
    }
  }

  const row = (key: "edit" | "unsend", label: string, Icon: typeof Pencil, span: number, left: number, closesAt: number, onClick: () => void, extra?: string) => {
    const unlimited = left === Infinity
    const fraction = unlimited || !(span > 0) ? 1 : Math.min(1, left / span)
    const urgent = !unlimited && (left <= 20_000 || fraction <= 0.15)
    return (
      <div key={key} className="grid gap-1.5" data-urgent={urgent || undefined}>
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
          <button
            type="button"
            onClick={onClick}
            disabled={state === "unsending"}
            aria-describedby={`${id}-${key}`}
            className={cn(
              "inline-flex h-8 items-center gap-1.5 rounded-md border px-3 text-sm font-medium shadow-xs transition-colors outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-50 dark:bg-input/30",
              urgent && "border-amber-500 text-amber-900 dark:text-amber-200",
            )}
          >
            {key === "unsend" && state === "unsending" ? <LoaderCircle aria-hidden className="size-4 animate-spin" /> : <Icon aria-hidden className="size-4" />}
            {key === "unsend" && state === "unsending" ? t.unsending : label}
          </button>
          <span className={cn("text-xs tabular-nums", urgent ? "font-medium text-amber-700 dark:text-amber-400" : "text-muted-foreground")}>
            <span id={`${id}-${key}`}>{unlimited ? t.anyTime : t.until(fmt(closesAt))}{extra ? ` · ${extra}` : ""}</span>
            {!unlimited && <span aria-hidden> · {t.left(formatLeft(left))}</span>}
          </span>
        </div>
        {!unlimited && (
          <div aria-hidden className="h-1 overflow-hidden rounded-full bg-muted">
            <div
              className={cn("h-full rounded-full motion-safe:transition-[width] motion-safe:duration-1000 motion-safe:ease-linear", urgent ? "bg-amber-500" : "bg-primary/60")}
              style={{ width: `${fraction * 100}%` }}
            />
          </div>
        )}
      </div>
    )
  }

  const closedNotes: string[] = []
  if (w && onEdit && !editOpen) closedNotes.push(w.edit.editsLeft === 0 ? t.noEditsLeft : t.closed(t.edit, fmt(w.edit.closesAt)))
  if (w && onUnsend && !unsendOpen && state !== "unsent") closedNotes.push(t.closed(policy.unsendLabel, fmt(w.unsend.closesAt)))
  const done = state === "unsent"

  return (
    <div
      onFocus={() => (focusInside.current = true)}
      onBlur={(e) => e.relatedTarget && (focusInside.current = e.currentTarget.contains(e.relatedTarget as Node))}
      data-slot="retract-window" data-state={done ? "unsent" : unsendOpen || editOpen ? "open" : "closed"} className={cn("grid w-full min-w-0 max-w-sm grid-cols-1 gap-2 text-sm", className)} {...props}>
      {children !== undefined && (
        <div className={cn("ml-auto max-w-[85%] rounded-2xl rounded-br-md px-3 py-2 break-words", done ? "border border-dashed text-muted-foreground line-through" : "bg-primary text-primary-foreground")}>
          {children}
        </div>
      )}
      <p className="text-right text-xs text-muted-foreground">
        {Number.isFinite(sent) ? t.sent(fmt(sent)) : ""}
        {readers.length > 0 && ` · ${t.readBy(readers)}`}
      </p>

      {!done && (
        <div ref={cardRef} tabIndex={-1} className="grid gap-3 rounded-lg border bg-card p-3 text-card-foreground outline-none">
          {w && onEdit && editOpen && row("edit", t.edit, Pencil, policy.editFor, w.edit.left, w.edit.closesAt, onEdit, w.edit.editsLeft !== Infinity ? t.editsLeft(w.edit.editsLeft) : undefined)}
          {w && onUnsend && unsendOpen && state !== "failed" && row("unsend", policy.unsendLabel, Undo2, policy.unsendFor, w.unsend.left, w.unsend.closesAt, () => void unsend())}

          {unsendOpen && state !== "failed" && (readers.length > 0 || keepers.length > 0 || policy.caveats.length > 0) && (
            <ul className="grid gap-1.5 text-xs text-muted-foreground">
              {readers.length > 0 && (
                <li className="flex gap-1.5 text-amber-700 dark:text-amber-400"><Eye aria-hidden className="mt-px size-3.5 shrink-0" />{t.alreadyRead(readers)}</li>
              )}
              {keepers.length > 0 && (
                <li className="flex gap-1.5 text-amber-700 dark:text-amber-400"><Smartphone aria-hidden className="mt-px size-3.5 shrink-0" />{t.keeps(keepers)}</li>
              )}
              {policy.caveats.map((c) => (
                <li key={c} className="flex gap-1.5"><Info aria-hidden className="mt-px size-3.5 shrink-0" />{c}</li>
              ))}
            </ul>
          )}

          {closedNotes.length > 0 && <p className="text-xs text-muted-foreground">{closedNotes.join(" ")}</p>}
          {state === "failed" && <p role="alert" className="text-xs text-red-700 dark:text-red-400">{t.failed}</p>}
          {onSendCorrection && (state === "failed" || (w && !editOpen && !unsendOpen)) && (
            <button type="button" onClick={onSendCorrection} className="inline-flex h-8 w-fit items-center gap-1.5 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground shadow-xs outline-none hover:bg-primary/90 focus-visible:ring-[3px] focus-visible:ring-ring/50">
              <MessageSquareX aria-hidden className="size-4" />
              {t.correction}
            </button>
          )}

          {onDeleteForMe && (
            <div className="grid gap-1 border-t pt-2.5">
              <button type="button" onClick={onDeleteForMe} aria-describedby={`${id}-me`} className="inline-flex h-8 w-fit items-center gap-1.5 rounded-md px-2 text-sm font-medium text-muted-foreground outline-none hover:bg-accent hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50">
                <Trash2 aria-hidden className="size-4" />
                {t.deleteForMe}
              </button>
              <p id={`${id}-me`} className="px-2 text-xs text-muted-foreground">{t.deleteForMeNote(recipients.map((r) => r.name))}</p>
            </div>
          )}
        </div>
      )}
      {done && <p ref={doneRef} tabIndex={-1} className="text-right outline-none text-xs font-medium text-emerald-700 dark:text-emerald-400">{t.unsent(keepers)}</p>}
      <p role="status" className="sr-only">{status}</p>
    </div>
  )
}
