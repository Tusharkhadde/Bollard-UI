"use client"

// Bollard UI — revision-banner · MIT licence · https://bollard-ui.vercel.app/components/revision-banner

import * as React from "react"
import { ArchiveRestore, History, LoaderCircle, Lock, TriangleAlert } from "lucide-react"

import { cn } from "@/lib/utils"
import { diffWords } from "@/registry/default/text-diff/text-diff"

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

export interface RevisionInfo {
  /** "Version 12", "v12", "Draft 3". */
  label: string
  /** Who saved it. */
  author?: string
  /** When it was saved. */
  savedAt: Date | number | string
}

const countWords = (text: string) => text.match(/[\p{L}\p{N}]+/gu)?.length ?? 0

/** Words a restore brings back (`added`) and takes out of the latest version (`removed`). */
export function restoreImpact(latestText: string, revisionText: string) {
  let added = 0
  let removed = 0
  for (const part of diffWords(latestText, revisionText)) {
    if (part.type === "insert") added += countWords(part.value)
    if (part.type === "delete") removed += countWords(part.value)
  }
  return { added, removed }
}

const fill = (template: string, values: Record<string, string | number>) =>
  template.replace(/\{(\w+)\}/g, (match, key: string) => String(values[key] ?? match))
const defaultFormatDate = (date: Date) =>
  new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }).format(date)

export interface RevisionBannerProps extends Omit<React.ComponentProps<"div">, "onError"> {
  /** The old revision on screen. */
  revision: RevisionInfo
  /** The current, latest revision. */
  latest: RevisionInfo
  /** How many revisions newer than this one exist. */
  behind?: number
  /** Plain text of both revisions, to count the words a restore would change. */
  revisionText?: string
  /** Text describing the latest version. */
  latestText?: string
  /** Open the latest revision. */
  onGoToLatest: () => void
  /** Make this revision the latest. Return a promise to show progress; a rejection shows `errorText`. */
  onRestore: () => void | Promise<void>
  /** The old revision's content. Edits inside it are blocked. */
  children: React.ReactNode
  /** Formats revision dates. */
  formatDate?: (date: Date) => string
  /** Templates: `{label}`, `{author}`, `{date}`, `{behind}`, `{latest}`, `{added}`, `{removed}` are filled in. */
  message?: string
  /** Says how many versions behind this one is. */
  behindText?: string
  /** Shown when someone tries to edit the old version. */
  editBlockedText?: string
  /** Restore confirmation question. */
  confirmText?: string
  /** Says how many words the restore changes. */
  impactText?: string
  /** Says the latest version is kept in history. */
  keptText?: string
  /** Label of the go-to-latest button. */
  goToLatestLabel?: string
  /** Label of the restore button. */
  restoreLabel?: string
  /** Label of the confirm-restore button. */
  confirmRestoreLabel?: string
  /** Label of the Cancel button. */
  cancelLabel?: string
  /** Shown when onRestore rejects. */
  errorText?: string
}

/**
 * Makes an old revision impossible to mistake for the current document. The
 * content sits in a striped, locked frame; typing, pasting or dropping into it
 * is blocked and answered with an explanation instead of silently doing
 * nothing. "Restore this version" asks once, naming the latest version it
 * replaces and how many words come back or go, and that the latest is kept.
 */
export function RevisionBanner({
  revision,
  latest,
  behind,
  revisionText,
  latestText,
  onGoToLatest,
  onRestore,
  children,
  formatDate = defaultFormatDate,
  message = "You're viewing {label} from {date}{author}. This isn't the latest version.",
  behindText = "{behind} newer {versions} saved since",
  editBlockedText = "Old versions are read-only. Go to the latest to edit, or restore this one first.",
  confirmText = "Restore {label}? It replaces {latest}{latestAuthor}, saved {latestDate}.",
  impactText = "{removed} removed, {added} brought back.",
  keptText = "{latest} stays in history, so you can undo this.",
  goToLatestLabel = "Go to latest",
  restoreLabel = "Restore this version",
  confirmRestoreLabel = "Replace with {label}",
  cancelLabel = "Cancel",
  errorText = "Couldn't restore. Nothing was changed.",
  className,
  ...props
}: RevisionBannerProps) {
  const [confirming, setConfirming] = React.useState(false)
  const [pending, setPending] = React.useState(false)
  const [failed, setFailed] = React.useState(false)
  const [blocked, setBlocked] = React.useState(false)
  const cancelRef = React.useRef<HTMLButtonElement>(null)

  const frameRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    if (confirming) cancelRef.current?.focus()
  }, [confirming])

  // Native `beforeinput` covers typing, deleting, IME and autocorrect in inputs and contenteditable;
  // React's onBeforeInput only sees inserted text.
  React.useEffect(() => {
    const frame = frameRef.current
    if (!frame) return
    const onBeforeInput = (event: Event) => {
      event.preventDefault()
      setBlocked(true)
    }
    frame.addEventListener("beforeinput", onBeforeInput, true)
    return () => frame.removeEventListener("beforeinput", onBeforeInput, true)
  }, [])

  const values = {
    label: revision.label,
    date: formatDate(new Date(revision.savedAt)),
    author: revision.author ? ` by ${revision.author}` : "",
    behind: behind ?? "",
    versions: behind === 1 ? "version" : "versions",
    latest: latest.label,
    latestAuthor: latest.author ? ` by ${latest.author}` : "",
    latestDate: formatDate(new Date(latest.savedAt)),
  }
  const counts = revisionText !== undefined && latestText !== undefined ? restoreImpact(latestText, revisionText) : undefined
  const words = (count: number) => `${count} ${count === 1 ? "word" : "words"}`
  const impact = counts && { added: words(counts.added), removed: words(counts.removed) }
  const tone = confirming ? tones.danger : tones.warning

  const block = (event: React.SyntheticEvent) => {
    event.preventDefault()
    setBlocked(true)
  }
  const restore = async () => {
    setPending(true)
    setFailed(false)
    try {
      await onRestore()
      setConfirming(false)
    } catch {
      setFailed(true)
    } finally {
      setPending(false)
    }
  }

  return (
    <div data-slot="revision-banner" data-state={confirming ? "confirming" : "viewing"} className={cn("space-y-3", className)} {...props}>
      <div role="region" aria-label={`Old version: ${revision.label}`} className={cn("rounded-lg border transition-colors", tone.surface)}>
        <div className={bar}>
          <div className="flex min-w-0 flex-1 basis-64 items-start gap-3">
            {confirming ? (
              <TriangleAlert aria-hidden className={cn("mt-0.5 size-4 shrink-0", tone.icon)} />
            ) : (
              <History aria-hidden className={cn("mt-0.5 size-4 shrink-0", tone.icon)} />
            )}
            <div className="min-w-0 flex-1" aria-live="polite">
              <p className="font-medium" suppressHydrationWarning>
                {fill(confirming ? confirmText : message, values)}
              </p>
              <p className={cn("mt-0.5 text-xs", tone.muted)}>
                {confirming
                  ? [impact && fill(impactText, impact), fill(keptText, values)].filter(Boolean).join(" ")
                  : behind
                    ? fill(behindText, values)
                    : null}
              </p>
              {failed && (
                <p role="alert" className="mt-0.5 text-xs font-medium text-red-700 dark:text-red-400">
                  {errorText}
                </p>
              )}
            </div>
          </div>
          {confirming ? (
            <div className="ml-auto flex flex-wrap justify-end gap-2" onKeyDown={(event) => event.key === "Escape" && !pending && setConfirming(false)}>
              <button ref={cancelRef} type="button" disabled={pending} onClick={() => setConfirming(false)} className={cn(action, tone.outline)}>
                {cancelLabel}
              </button>
              <button type="button" disabled={pending} onClick={restore} className={cn(action, tone.solid)}>
                {pending ? <LoaderCircle aria-hidden className="size-4 animate-spin" /> : <ArchiveRestore aria-hidden className="size-4" />}
                {fill(confirmRestoreLabel, values)}
              </button>
            </div>
          ) : (
            <div className="ml-auto flex flex-wrap justify-end gap-2">
              <button type="button" onClick={() => setConfirming(true)} className={cn(action, tone.outline)}>
                {restoreLabel}
              </button>
              <button type="button" onClick={onGoToLatest} className={cn(action, tone.solid)}>
                {goToLatestLabel}
              </button>
            </div>
          )}
        </div>
      </div>

      <div
        aria-readonly="true"
        aria-label={`${revision.label}, read-only`}
        role="group"
        ref={frameRef}
        onPasteCapture={block}
        onCutCapture={block}
        onDropCapture={block}
        className="relative rounded-lg border border-dashed border-amber-500/50 bg-[repeating-linear-gradient(135deg,transparent_0_12px,rgb(245_158_11/0.06)_12px_24px)] p-4 pt-8"
      >
        <span className="absolute top-2 left-3 inline-flex items-center gap-1.5 text-xs font-medium text-amber-800 dark:text-amber-300">
          <Lock aria-hidden className="size-3.5" />
          {revision.label} · read-only
        </span>
        {children}
        <p aria-live="polite" className="flex items-start gap-1.5 text-xs text-amber-800 empty:hidden dark:text-amber-300">
          {blocked && (
            <>
              <TriangleAlert aria-hidden className="mt-3 size-3.5 shrink-0" />
              <span className="mt-3">{editBlockedText}</span>
            </>
          )}
        </p>
      </div>
    </div>
  )
}
