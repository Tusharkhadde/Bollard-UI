"use client"

import * as React from "react"
import { CircleAlert, LoaderCircle, PenLine, SendHorizontal } from "lucide-react"

import { cn } from "@/lib/utils"

/** Text that was typed but never sent, with when it was last typed. */
export interface UnsentDraft {
  text: string
  at: number
}

/** Reads a left-behind draft, or null. */
export function readUnsent(key: string): UnsentDraft | null {
  try {
    const draft = JSON.parse(localStorage.getItem(key) ?? "null") as UnsentDraft | null
    return draft && typeof draft.text === "string" && draft.text.trim() ? draft : null
  } catch {
    return null
  }
}

export function saveUnsent(key: string, text: string, at = Date.now()) {
  try {
    localStorage.setItem(key, JSON.stringify({ text, at } satisfies UnsentDraft))
  } catch {}
}

export function clearUnsent(key: string) {
  try {
    localStorage.removeItem(key)
  } catch {}
}

/**
 * Keeps a composer's unsent text under `key` and, on return, hands back what
 * was left there so it can be marked instead of silently refilled. Clear the
 * composer (or call `clear`) once the message is really sent. Reset `value`
 * whenever `key` changes.
 */
export function useUnsentDraft(key: string, value: string) {
  const [draft, setDraft] = React.useState<UnsentDraft | null>(null)
  const typed = React.useRef(false)

  React.useEffect(() => {
    typed.current = false
    setDraft(readUnsent(key))
  }, [key])

  // An empty composer only clears storage after typing here, so a draft found on return survives until it's handled.
  React.useEffect(() => {
    if (value.trim()) {
      typed.current = true
      saveUnsent(key, value)
    } else if (typed.current) clearUnsent(key)
  }, [key, value])

  const clear = React.useCallback(() => {
    setDraft(null)
    clearUnsent(key)
  }, [key])
  return { draft, clear }
}

/** "a moment ago", "12 min ago", "2 h ago", "3 days ago". */
export function typedAgo(at: number, now: number) {
  const minutes = Math.round((now - at) / 60_000)
  if (minutes < 1) return "a moment ago"
  if (minutes < 60) return `${minutes} min ago`
  if (minutes < 1440) return `${Math.round(minutes / 60)} h ago`
  const days = Math.round(minutes / 1440)
  return `${days} ${days === 1 ? "day" : "days"} ago`
}

const fill = (template: string, values: Record<string, string>) =>
  template.replace(/\{(\w+)\}/g, (match, key: string) => values[key] ?? match)

const button =
  "inline-flex h-8 items-center justify-center gap-1.5 rounded-md px-3 text-sm font-medium whitespace-nowrap outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-60"

const KEYFRAMES = `@keyframes cui-unsent-marker-in{from{opacity:0;transform:translateY(8px) scale(.98)}to{opacity:1;transform:none}}`

export interface UnsentMarkerProps extends Omit<React.ComponentProps<"div">, "children"> {
  /** The unsent text. */
  text: string
  /** When it was last typed (ms). */
  at?: number
  /** `bubble` sits in the thread where the reply would be; `row` is a one-line preview for conversation lists. */
  variant?: "bubble" | "row"
  /** Who it was meant for, e.g. "Priya". */
  recipient?: string
  /** Sends it now. Return a promise to show a pending state; a rejection keeps the marker with an error. */
  onSend?: (text: string) => void | Promise<void>
  /** Moves it back into the composer. */
  onEdit?: (text: string) => void
  /** Throws it away (asks once). */
  onDiscard?: () => void
  notSentLabel?: string
  /** `{when}` is filled in. */
  typedText?: string
  /** `{recipient}` is filled in. */
  recipientText?: string
  /** Used when there's no `recipient`. */
  privateText?: string
  sendLabel?: string
  editLabel?: string
  discardLabel?: string
  confirmDiscardLabel?: string
  failedText?: string
}

/**
 * Stops people believing they replied when the text never left the box. A
 * left-behind draft returns as a dashed bubble in the thread, right where the
 * sent reply would be, so the one place people check for "did I answer?"
 * tells the truth: "Not sent · Priya hasn't received it". Send, Edit and a
 * two-tap Discard sit under it; a failed send says so. `row` puts the same
 * "Not sent:" preview in conversation lists.
 */
export function UnsentMarker({
  text,
  at,
  variant = "bubble",
  recipient,
  onSend,
  onEdit,
  onDiscard,
  notSentLabel = "Not sent",
  typedText = "Typed {when}.",
  recipientText = "{recipient} hasn't received it.",
  privateText = "Only you can see it.",
  sendLabel = "Send",
  editLabel = "Edit",
  discardLabel = "Discard",
  confirmDiscardLabel = "Discard draft?",
  failedText = "Couldn't send. Check your connection and try again.",
  className,
  ...props
}: UnsentMarkerProps) {
  const [now, setNow] = React.useState<number>()
  const [phase, setPhase] = React.useState<"idle" | "sending" | "failed">("idle")
  const [confirm, setConfirm] = React.useState(false)

  React.useEffect(() => {
    setNow(Date.now())
    const id = setInterval(() => setNow(Date.now()), 60_000)
    return () => clearInterval(id)
  }, [])

  React.useEffect(() => {
    if (!confirm) return
    const timer = setTimeout(() => setConfirm(false), 3000)
    return () => clearTimeout(timer)
  }, [confirm])

  if (variant === "row") {
    return (
      <div data-slot="unsent-marker" data-variant="row" className={cn("flex min-w-0 items-center gap-1 text-xs", className)} {...props}>
        <PenLine aria-hidden className="size-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
        <span className="shrink-0 font-medium text-amber-800 dark:text-amber-300">{notSentLabel}:</span>
        <span className="min-w-0 truncate text-muted-foreground">{text}</span>
      </div>
    )
  }

  const when = at === undefined || now === undefined ? "" : typedAgo(at, now)
  const hint = [when && fill(typedText, { when }), recipient ? fill(recipientText, { recipient }) : privateText].filter(Boolean).join(" ")

  const send = async () => {
    if (!onSend || phase === "sending") return
    setPhase("sending")
    try {
      await onSend(text)
      setPhase("idle")
    } catch {
      setPhase("failed")
    }
  }

  return (
    <div
      data-slot="unsent-marker"
      data-variant="bubble"
      data-state={phase}
      role="group"
      aria-label={`${notSentLabel}: ${text}`}
      className={cn("ml-auto grid max-w-[85%] justify-items-end gap-1.5 motion-safe:animate-[cui-unsent-marker-in_250ms_ease-out]", className)}
      {...props}
    >
      <style>{KEYFRAMES}</style>
      <p
        className={cn(
          "rounded-2xl rounded-br-md border-2 border-dashed px-3 py-2 text-sm leading-relaxed break-words whitespace-pre-wrap transition-colors duration-200",
          phase === "sending" ? "border-primary/40 text-foreground" : "border-amber-500/60 bg-amber-500/5 text-foreground/80",
        )}
      >
        {text}
      </p>
      <p className="flex flex-wrap items-center justify-end gap-x-2 gap-y-1 text-right text-xs">
        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 font-medium text-amber-900 dark:bg-amber-500/15 dark:text-amber-200">
          <CircleAlert aria-hidden className="size-3.5" />
          {notSentLabel}
        </span>
        <span className="text-muted-foreground">{hint}</span>
      </p>
      {phase === "failed" && (
        <p role="alert" className="text-right text-xs text-destructive">
          {failedText}
        </p>
      )}
      <div className="flex flex-wrap justify-end gap-2">
        {onDiscard && (
          <button
            type="button"
            onClick={() => (confirm ? onDiscard() : setConfirm(true))}
            className={cn(button, "px-2", confirm ? "text-destructive hover:bg-destructive/10" : "text-muted-foreground hover:bg-accent hover:text-foreground")}
          >
            {confirm ? confirmDiscardLabel : discardLabel}
          </button>
        )}
        {onEdit && (
          <button type="button" onClick={() => onEdit(text)} className={cn(button, "border bg-background shadow-xs hover:bg-accent dark:bg-input/30")}>
            {editLabel}
          </button>
        )}
        {onSend && (
          <button type="button" onClick={send} disabled={phase === "sending"} className={cn(button, "bg-primary text-primary-foreground shadow-xs hover:bg-primary/90")}>
            {phase === "sending" ? <LoaderCircle aria-hidden className="size-4 animate-spin" /> : <SendHorizontal aria-hidden className="size-4" />}
            {sendLabel}
          </button>
        )}
      </div>
    </div>
  )
}
