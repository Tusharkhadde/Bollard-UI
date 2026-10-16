"use client"

import * as React from "react"
import { History, LoaderCircle, RotateCcw, Undo2 } from "lucide-react"

import { cn } from "@/lib/utils"

/** One saved value of the field. */
export interface FieldVersion {
  value: string
  /** Who saved it, e.g. "Priya". */
  by: string
  at: Date | number | string
}

const DAY = 86_400_000
const startOfDay = (time: number) => new Date(time).setHours(0, 0, 0, 0)

/**
 * "just now", "12 min ago", "today", "yesterday", "on Monday", "on 3 Oct". Days, not hours, past the first hour.
 * Pass a `locale` to get the same steps from `Intl` in that language ("vor 12 Minuten", "gestern", "Montag").
 */
export function describeWhen(at: Date | number | string, now: number, locale?: string) {
  const time = new Date(at).getTime()
  const minutes = Math.round((now - time) / 60_000)
  const days = Math.round((startOfDay(now) - startOfDay(time)) / DAY)
  const date = new Date(time)
  if (locale) {
    const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" })
    if (minutes < 1) return rtf.format(0, "second")
    if (minutes < 60) return rtf.format(-minutes, "minute")
    if (days <= 1) return rtf.format(-Math.max(days, 0), "day")
    return date.toLocaleDateString(locale, days < 7 ? { weekday: "long" } : { day: "numeric", month: "short" })
  }
  if (minutes < 1) return "just now"
  if (minutes < 60) return `${minutes} min ago`
  if (days <= 0) return "today"
  if (days === 1) return "yesterday"
  if (days < 7) return `on ${date.toLocaleDateString(undefined, { weekday: "long" })}`
  return `on ${date.toLocaleDateString(undefined, { day: "numeric", month: "short" })}`
}

/** True when someone other than `you` changed the field within `recentFor` ms: the change people misread or overwrite. */
export function isRecentChange(history: FieldVersion[], you: string | undefined, now: number, recentFor: number) {
  const [latest, previous] = history
  return Boolean(latest && previous && latest.by !== you && now - new Date(latest.at).getTime() < recentFor)
}

const fill = (template: string, values: Record<string, string>) =>
  template.replace(/\{(\w+)\}/g, (match, key: string) => values[key] ?? match)

const action =
  "inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-md px-3 text-sm font-medium whitespace-nowrap outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-60"

export interface FieldHistoryProps extends Omit<React.ComponentProps<"div">, "children"> {
  /** The field's label. */
  label: string
  /** The id of the field's input, so the label is a real `<label>`. */
  htmlFor?: string
  /** The field itself (an input, select...). */
  children: React.ReactNode
  /** Saved values, newest first. The first one is what's saved now. */
  history: FieldVersion[]
  /** What the field holds right now, if it may differ from the saved value (an unsaved edit). */
  value?: string
  /** Puts one value back. Return a promise to show a pending state; a rejection keeps things as they were. */
  onRevert: (value: string) => void | Promise<void>
  /** Formats a value for display, e.g. `(v) => "₹" + v`. */
  format?: (value: string) => string
  /** The current user's name as it appears in `by`, so your own edits don't get flagged. */
  you?: string
  /** A change by someone else is flagged on the trigger for this long, in ms. */
  recentFor?: number
  /** Open the history panel on first render. */
  defaultOpen?: boolean
  /** How many older values the list shows. */
  limit?: number
  /** Templates: `{previous}`, `{by}` and `{when}` are filled in. */
  wasText?: string
  /** Trigger text while a recent change is flagged. `{when}` is filled in. */
  changedText?: string
  historyLabel?: string
  revertLabel?: string
  restoreLabel?: string
  /** Screen reader name of each Restore button. `{value}` is filled in. Defaults to `restoreLabel` plus the value. */
  restoreAriaLabel?: string
  /** Shown above revert when the field holds an unsaved edit. `{value}` is filled in. */
  replacesText?: string
  /** Shown after a revert. `{value}` is filled in. */
  revertedText?: string
  undoLabel?: string
  emptyText?: string
  /** Language for "when" ("vor 2 Tagen"). Unset keeps the built-in English wording. */
  locale?: string
  /** Full control over "when", e.g. your app's own relative-time helper. Wins over `locale`. */
  formatWhen?: (at: Date | number | string, now: number) => string
}

/**
 * Stops people overwriting or misreading a field someone just changed. A
 * small trigger beside the label turns amber when someone else changed it
 * recently ("Changed yesterday") and opens one plain sentence ("Was ₹500 until
 * Priya changed it yesterday") with a one-tap revert of that field alone.
 * Reverts say what they replace, including your own unsaved edit, and can be
 * undone right away.
 */
export function FieldHistory({
  label,
  htmlFor,
  children,
  history,
  value,
  onRevert,
  format = (v) => v,
  you,
  recentFor = 3 * DAY,
  defaultOpen = false,
  limit = 4,
  wasText = "Was {previous} until {by} changed it {when}.",
  changedText = "Changed {when}",
  historyLabel = "History",
  revertLabel = "Revert to {value}",
  restoreLabel = "Restore",
  restoreAriaLabel = `${restoreLabel} {value}`,
  replacesText = "Replaces your unsaved {value}.",
  revertedText = "Reverted to {value}.",
  undoLabel = "Undo",
  emptyText = "empty",
  locale,
  formatWhen,
  className,
  ...props
}: FieldHistoryProps) {
  const [open, setOpen] = React.useState(defaultOpen)
  const [now, setNow] = React.useState<number>()
  const [pending, setPending] = React.useState<string>()
  const [undo, setUndo] = React.useState<{ to: string; from: string }>()
  const panelId = React.useId()
  const reduce = React.useRef(false)
  const triggerRef = React.useRef<HTMLButtonElement>(null)

  React.useEffect(() => {
    reduce.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    setNow(Date.now())
    const id = setInterval(() => setNow(Date.now()), 60_000)
    return () => clearInterval(id)
  }, [])

  const [latest, previous] = history
  const shown = (v: string) => (v === "" ? emptyText : format(v))
  const current = value ?? latest?.value ?? ""
  const unsaved = latest !== undefined && current !== latest.value
  const recent = now !== undefined && isRecentChange(history, you, now, recentFor)
  const when = (at: FieldVersion["at"]) => (now === undefined ? "" : formatWhen ? formatWhen(at, now) : describeWhen(at, now, locale))

  // A recent change is the thing people miss, so the flag wiggles once when it appears.
  React.useEffect(() => {
    if (recent && !reduce.current) triggerRef.current?.animate({ rotate: ["0deg", "-4deg", "4deg", "0deg"] }, { duration: 300, easing: "ease-out" })
  }, [recent, latest?.at])

  // Undo only makes sense while the field still holds the value we reverted to.
  React.useEffect(() => {
    if (undo && latest?.value !== undo.to) setUndo(undefined)
  }, [undo, latest?.value])

  const revert = async (to: string, offerUndo = true) => {
    const from = current
    setPending(to)
    try {
      await onRevert(to)
      setUndo(offerUndo ? { to, from } : undefined)
    } catch {
      // The caller shows the error; nothing changed here.
    } finally {
      setPending(undefined)
    }
  }

  const older = history.slice(1, limit + 1)

  return (
    <div data-slot="field-history" data-state={recent ? "changed" : "idle"} className={cn("grid gap-2", className)} {...props}>
      <div className="flex min-h-6 items-center justify-between gap-2">
        <label htmlFor={htmlFor} className="text-sm leading-none font-medium">
          {label}
        </label>
        {history.length > 1 && (
          <button
            ref={triggerRef}
            type="button"
            aria-expanded={open}
            aria-controls={panelId}
            aria-label={`${label}: ${recent ? fill(changedText, { when: when(latest.at) }) : historyLabel}`}
            onClick={() => {
              setOpen((o) => !o)
              setUndo(undefined)
            }}
            className={cn(
              "inline-flex h-6 items-center gap-1 rounded-md px-1.5 text-xs font-medium outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50",
              recent
                ? "border border-amber-500/40 bg-amber-500/10 text-amber-900 hover:bg-amber-500/20 dark:text-amber-200"
                : "text-muted-foreground hover:bg-accent hover:text-foreground",
            )}
          >
            <History aria-hidden className="size-3.5" />
            {recent ? fill(changedText, { when: when(latest.at) }) : <span className="sr-only sm:not-sr-only">{historyLabel}</span>}
          </button>
        )}
      </div>
      {children}
      <div
        id={panelId}
        hidden={!open}
        onKeyDown={(event) => {
          if (event.key !== "Escape") return
          setOpen(false)
          triggerRef.current?.focus()
        }}
        className="grid gap-2 rounded-md border bg-muted/40 p-3 text-sm motion-safe:animate-[cui-field-history-open_200ms_ease-out]"
      >
        <style>{`@keyframes cui-field-history-open{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:none}}`}</style>
        {latest && previous && (
          <div className="grid gap-2" aria-live="polite">
            {undo ? (
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium">{fill(revertedText, { value: shown(undo.to) })}</p>
                <button
                  type="button"
                  disabled={pending !== undefined}
                  onClick={() => revert(undo.from, false)}
                  className={cn(action, "border bg-background hover:bg-accent dark:bg-input/30")}
                >
                  <Undo2 aria-hidden className="size-4" />
                  {undoLabel}
                </button>
              </div>
            ) : (
              <>
                <p className="leading-snug">
                  {fill(wasText, { by: latest.by, when: when(latest.at) })
                    .split("{previous}")
                    .flatMap((text, i) => (i ? [<strong key={i} className="font-semibold">{shown(previous.value)}</strong>, text] : [text]))}
                </p>
                {unsaved && <p className="text-xs text-amber-800 dark:text-amber-300">{fill(replacesText, { value: shown(current) })}</p>}
                <button
                  type="button"
                  disabled={pending !== undefined || current === previous.value}
                  onClick={() => revert(previous.value)}
                  className={cn(action, "w-fit bg-primary text-primary-foreground shadow-xs hover:bg-primary/90")}
                >
                  {pending === previous.value ? <LoaderCircle aria-hidden className="size-4 animate-spin" /> : <RotateCcw aria-hidden className="size-4" />}
                  {fill(revertLabel, { value: shown(previous.value) })}
                </button>
              </>
            )}
          </div>
        )}
        <ol aria-label={`${label} ${historyLabel}`} className="grid gap-1 border-t pt-2 text-xs">
          {[latest, ...older].map((version, index) => (
            <li key={index} className="flex min-h-7 items-center gap-2">
              <span className={cn("min-w-0 truncate font-medium", index === 0 ? "text-foreground" : "text-muted-foreground")}>
                {shown(version.value)}
              </span>
              <span className="min-w-0 flex-1 truncate text-muted-foreground">
                {version.by} · {when(version.at)}
              </span>
              {index > 1 && version.value !== current && (
                <button
                  type="button"
                  disabled={pending !== undefined}
                  onClick={() => revert(version.value)}
                  aria-label={fill(restoreAriaLabel, { value: shown(version.value) })}
                  className="h-7 shrink-0 rounded-md px-2 font-medium outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-60"
                >
                  {restoreLabel}
                </button>
              )}
            </li>
          ))}
        </ol>
      </div>
    </div>
  )
}
