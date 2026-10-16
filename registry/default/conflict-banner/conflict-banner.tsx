"use client"

import * as React from "react"
import { ChevronDown, TriangleAlert, UserPen } from "lucide-react"

import { cn } from "@/lib/utils"
import { diffWords, type DiffPart } from "@/registry/default/text-diff/text-diff"

/** Banner layout shared by every Bollard UI banner: one height, padding, icon size and action style. */
const bar = "flex min-h-11 flex-wrap items-center gap-x-3 gap-y-1.5 px-3 py-1.5 text-sm"
const action =
  "inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-md px-3 text-sm font-medium whitespace-nowrap outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-60"
/** Banner tones, identical across Bollard UI banners. */
const tones = {
  warning: {
    surface: "border-amber-500/30 bg-background bg-linear-to-r from-amber-500/10 to-amber-500/10 text-amber-950 dark:text-amber-50",
    icon: "text-amber-600 dark:text-amber-400",
    muted: "text-amber-900/75 dark:text-amber-100/75",
    solid: "bg-amber-700 text-white hover:bg-amber-800 dark:bg-amber-400 dark:text-amber-950 dark:hover:bg-amber-300",
    outline: "border border-amber-700/25 hover:bg-amber-500/15 dark:border-amber-300/25",
  },
  danger: {
    surface: "border-red-500/30 bg-background bg-linear-to-r from-red-500/10 to-red-500/10 text-red-950 dark:text-red-50",
    icon: "text-red-600 dark:text-red-400",
    muted: "text-red-900/75 dark:text-red-100/75",
    solid: "bg-red-700 text-white hover:bg-red-800 dark:bg-red-400 dark:text-red-950 dark:hover:bg-red-300",
    outline: "border border-red-700/25 hover:bg-red-500/15 dark:border-red-300/25",
  },
} as const

/** "just now", "4 minutes ago", "2 hours ago", "yesterday", "13 Oct", localized with Intl.RelativeTimeFormat. */
export function formatAgo(from: number, now: number, locale?: string, justNow = "just now") {
  const seconds = Math.max(0, Math.round((now - from) / 1000))
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" })
  if (seconds < 45) return justNow
  if (seconds < 3600) return rtf.format(-Math.max(1, Math.round(seconds / 60)), "minute")
  if (seconds < 86_400) return rtf.format(-Math.round(seconds / 3600), "hour")
  if (seconds < 7 * 86_400) return rtf.format(-Math.round(seconds / 86_400), "day")
  return new Intl.DateTimeFormat(locale, { day: "numeric", month: "short" }).format(from)
}

const countWords = (text: string) => text.match(/[\p{L}\p{N}]+/gu)?.length ?? 0

/** Words only in yours (`added`) and only in theirs (`lost` if you keep yours). */
export function conflictCounts(parts: DiffPart[]) {
  let added = 0
  let lost = 0
  for (const part of parts) {
    if (part.type === "insert") added += countWords(part.value)
    if (part.type === "delete") lost += countWords(part.value)
  }
  return { added, lost }
}

const fill = (template: string, values: Record<string, string | number>) =>
  template.replace(/\{(\w+)\}/g, (match, key: string) => String(values[key] ?? match))

export interface ConflictBannerProps extends Omit<React.ComponentProps<"div">, "children"> {
  /** The text you were editing. */
  yourVersion: string
  /** The text now saved on the server by someone else. */
  theirVersion: string
  /** Who saved the other version, e.g. "Priya". */
  editor: string
  /** When they saved it. */
  editedAt: Date | number | string
  /** Overwrite their version with yours. */
  onKeepMine: () => void
  /** Drop your edits and load theirs. */
  onUseTheirs: () => void
  /** Templates: `{editor}`, `{when}` and `{count}` ("3 words") are filled in. */
  message?: string
  /** Shown when both versions are the same. */
  identicalText?: string
  /** Overwrite confirmation text ({count} words are filled in). */
  confirmText?: string
  /** Text for the compare toggle. */
  compareLabel?: string
  /** Text for the use-theirs button. */
  useTheirsLabel?: string
  /** Text for the keep-mine button. */
  keepMineLabel?: string
  /** Text for the confirm-overwrite button. */
  overwriteLabel?: string
  /** Text for the cancel button. */
  cancelLabel?: string
  /** Text for the dismiss button. */
  dismissLabel?: string
  /** Locale for "4 min ago". Defaults to the browser's. */
  locale?: string
  /** Shown instead of a time for edits under a minute old. */
  justNowLabel?: string
  /** Accessible name of the banner. `{editor}` is filled in. */
  regionLabel?: string
}

/**
 * Stops one person silently overwriting another's edit. It names who changed
 * the record and when, shows a word diff on demand, and won't let you "Keep
 * mine" blindly: until you've compared, it asks once and says exactly how
 * many of their words would be replaced. A newer edit from them resets that.
 */
export function ConflictBanner({
  yourVersion,
  theirVersion,
  editor,
  editedAt,
  onKeepMine,
  onUseTheirs,
  message = "{editor} edited this {when} while you were working.",
  identicalText = "{editor} edited this {when}. Their version matches yours.",
  confirmText = "Keeping yours replaces {count} {editor} wrote.",
  compareLabel = "Compare",
  useTheirsLabel = "Use theirs",
  keepMineLabel = "Keep mine",
  overwriteLabel = "Overwrite {editor}'s edit",
  cancelLabel = "Cancel",
  dismissLabel = "Got it",
  locale,
  justNowLabel = "just now",
  regionLabel = "Edit conflict with {editor}",
  className,
  ...props
}: ConflictBannerProps) {
  const [open, setOpen] = React.useState(false)
  const [comparedVersion, setComparedVersion] = React.useState<string>()
  const [confirming, setConfirming] = React.useState(false)
  const [now, setNow] = React.useState<number>()
  const diffId = React.useId()
  const cancelRef = React.useRef<HTMLButtonElement>(null)

  React.useEffect(() => {
    setNow(Date.now())
    const id = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(id)
  }, [])

  // A newer save from them means the previous comparison no longer counts.
  React.useEffect(() => setConfirming(false), [theirVersion])

  React.useEffect(() => {
    if (confirming) cancelRef.current?.focus()
  }, [confirming])

  const parts = React.useMemo(() => diffWords(theirVersion, yourVersion), [theirVersion, yourVersion])
  const { added, lost } = conflictCounts(parts)
  const identical = added === 0 && lost === 0
  const compared = comparedVersion === theirVersion
  const values = {
    editor,
    count: `${lost} ${lost === 1 ? "word" : "words"}`,
    when: now === undefined ? "" : formatAgo(new Date(editedAt).getTime(), now, locale, justNowLabel),
  }
  const tone = confirming ? tones.danger : tones.warning

  const toggle = () => {
    setOpen((value) => !value)
    setComparedVersion(theirVersion)
    setConfirming(false)
  }
  const keepMine = () => {
    if (compared || lost === 0) {
      setConfirming(false)
      onKeepMine()
    } else setConfirming(true)
  }

  return (
    <div
      data-slot="conflict-banner"
      data-state={identical ? "identical" : confirming ? "confirming" : "conflict"}
      role="region"
      aria-label={regionLabel.replace("{editor}", editor)}
      className={cn("overflow-hidden rounded-lg border transition-colors", tone.surface, className)}
      {...props}
    >
      <div className={bar}>
        <div className="flex min-w-0 flex-1 basis-64 items-center gap-3">
          {confirming ? (
            <TriangleAlert aria-hidden className={cn("size-4 shrink-0", tone.icon)} />
          ) : (
            <UserPen aria-hidden className={cn("size-4 shrink-0", tone.icon)} />
          )}
          <p className="min-w-0 flex-1 font-medium" aria-live="polite">
            {fill(identical ? identicalText : confirming ? confirmText : message, values).replace(/\s+/g, " ")}
          </p>
        </div>
        {identical ? (
          <button type="button" onClick={onUseTheirs} className={cn(action, tone.solid)}>
            {dismissLabel}
          </button>
        ) : confirming ? (
          <div
            className="ml-auto flex gap-2"
            role="group"
            aria-label={fill(confirmText, values)}
            onKeyDown={(event) => event.key === "Escape" && setConfirming(false)}
          >
            <button ref={cancelRef} type="button" onClick={() => setConfirming(false)} className={cn(action, tone.outline)}>
              {cancelLabel}
            </button>
            <button type="button" onClick={keepMine} className={cn(action, tone.solid)}>
              {fill(overwriteLabel, values)}
            </button>
          </div>
        ) : (
          <div className="ml-auto flex flex-wrap justify-end gap-2">
            <button
              type="button"
              aria-expanded={open}
              aria-controls={diffId}
              onClick={toggle}
              className={cn(action, "px-2 hover:bg-amber-500/15")}
            >
              {compareLabel}
              <ChevronDown aria-hidden className={cn("size-4 transition-transform", open && "rotate-180")} />
            </button>
            <button type="button" onClick={onUseTheirs} className={cn(action, tone.outline)}>
              {useTheirsLabel}
            </button>
            <button type="button" onClick={keepMine} className={cn(action, tone.solid)}>
              {keepMineLabel}
            </button>
          </div>
        )}
      </div>

      <div id={diffId} hidden={!open || identical} className="border-t border-inherit bg-background text-foreground">
        <div className="flex flex-wrap gap-x-4 gap-y-1 px-3 pt-2 text-xs text-muted-foreground">
          <span>
            <span className="font-medium text-emerald-700 dark:text-emerald-400">+{added}</span> only in yours
          </span>
          <span>
            <span className="font-medium text-red-700 dark:text-red-400">−{lost}</span> only in {editor}&apos;s, lost if you keep yours
          </span>
        </div>
        <p className="max-h-60 overflow-auto px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap">
          {parts.map((part, index) =>
            part.type === "equal" ? (
              <span key={index}>{part.value}</span>
            ) : part.type === "insert" ? (
              <ins key={index} className="rounded-sm bg-emerald-500/15 text-emerald-800 no-underline dark:text-emerald-300">
                <span className="sr-only">[only in yours: </span>
                {part.value}
                <span className="sr-only">]</span>
              </ins>
            ) : (
              <del key={index} className="rounded-sm bg-red-500/15 text-red-800 decoration-red-500/60 dark:text-red-300">
                <span className="sr-only">[only in {editor}&apos;s: </span>
                {part.value}
                <span className="sr-only">]</span>
              </del>
            ),
          )}
        </p>
      </div>
    </div>
  )
}
