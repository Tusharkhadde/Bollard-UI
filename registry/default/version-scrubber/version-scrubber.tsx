"use client"

import * as React from "react"
import { Hash, History, LoaderCircle, RotateCcw } from "lucide-react"

import { cn } from "@/lib/utils"
import { diffWords, summarizeDiff } from "@/registry/default/text-diff/text-diff"

export interface Version {
  id: string
  text: string
  savedAt: Date | number | string
  author?: string
  /** A name like "Sent to legal". Defaults to v1, v2… */
  label?: string
}

const fill = (template: string, values: Record<string, string | number>) =>
  template.replace(/\{(\w+)\}/g, (m, k: string) => String(values[k] ?? m))
const words = (n: number) => `${n} ${n === 1 ? "word" : "words"}`
const button =
  "inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-md px-3 text-sm font-medium whitespace-nowrap transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50"
const thumb =
  "[&::-webkit-slider-thumb]:size-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-background [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:shadow-sm [&::-webkit-slider-thumb]:transition-shadow focus-visible:[&::-webkit-slider-thumb]:ring-[3px] focus-visible:[&::-webkit-slider-thumb]:ring-ring/50 [&::-moz-range-thumb]:size-3 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-background [&::-moz-range-thumb]:bg-primary"

export interface VersionScrubberProps extends Omit<React.ComponentProps<"div">, "children"> {
  /** Saved versions, oldest first. */
  versions: Version[]
  /** The version that is live now. Defaults to the newest. */
  currentId?: string
  /** Controlled selected version. */
  selectedId?: string
  /** Initially selected version when uncontrolled. Defaults to the current one. */
  defaultSelectedId?: string
  /** Called when the user scrubs to another version. */
  onSelectedIdChange?: (id: string) => void
  /** Make this version current. Return a promise to show progress; a rejection shows `errorText`. */
  onRestore: (version: Version) => void | Promise<void>
  /** Formats save times. Runs after mount, so server and client agree. */
  formatTime?: (date: Date) => string
  /** Restore confirmation. `{name}`, `{when}`, `{removed}`, `{added}` are filled in. */
  confirmText?: string
  /** Added to the confirmation when numbers differ; `{numbers}` is "14 → 30". */
  numbersText?: string
  /** Reassurance that restoring is not destructive. */
  keptText?: string
  /** Other visible text and button labels. */
  heading?: string
  /** Badge for the current version. */
  currentLabel?: string
  /** Label of the back-to-current button. */
  backLabel?: string
  /** Label of the Restore button. */
  restoreLabel?: string
  /** Label of the confirm-restore button. */
  confirmLabel?: string
  /** Label of the Cancel button. */
  cancelLabel?: string
  /** Shown when the selected version is current. */
  isCurrentText?: string
  /** Shown when the selected version matches the current one. */
  identicalText?: string
  /** Shown when onRestore rejects. */
  errorText?: string
}

const defaultFormat = (date: Date) =>
  new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(date)

/**
 * Scrub through saved versions without losing your place: the preview shows
 * what restoring would change compared with the current text, the current
 * version is pinned on the timeline, and Restore needs a second, deliberate
 * step that says how many words come back and go away, and which numbers change.
 */
export function VersionScrubber({
  versions,
  currentId = versions[versions.length - 1]?.id,
  selectedId,
  defaultSelectedId,
  onSelectedIdChange,
  onRestore,
  formatTime = defaultFormat,
  confirmText = "Restoring {name} from {when} removes {removed} and brings back {added}.",
  numbersText = "Numbers change: {numbers}.",
  keptText = "The current text stays in the history.",
  heading = "Version history",
  currentLabel = "Current",
  backLabel = "Back to current",
  restoreLabel = "Restore this version…",
  confirmLabel = "Restore {name}",
  cancelLabel = "Cancel",
  isCurrentText = "This is the current version.",
  identicalText = "Same text as the current version.",
  errorText = "Couldn't restore. Nothing was changed.",
  className,
  ...props
}: VersionScrubberProps) {
  const [inner, setInner] = React.useState(defaultSelectedId ?? currentId)
  const [confirming, setConfirming] = React.useState(false)
  const [status, setStatus] = React.useState<"idle" | "pending" | "error">("idle")
  const [mounted, setMounted] = React.useState(false)
  const cancelRef = React.useRef<HTMLButtonElement>(null)
  const id = React.useId()

  React.useEffect(() => setMounted(true), [])
  React.useEffect(() => {
    if (confirming) cancelRef.current?.focus()
  }, [confirming])

  const select = (next: string) => {
    if (selectedId === undefined) setInner(next)
    onSelectedIdChange?.(next)
    setConfirming(false)
    setStatus("idle")
  }

  // A restore (or anyone else) changed which version is current: jump to it.
  const lastCurrent = React.useRef(currentId)
  React.useEffect(() => {
    if (lastCurrent.current !== currentId && currentId) select(currentId)
    lastCurrent.current = currentId
  }) // eslint-disable-line react-hooks/exhaustive-deps

  const index = Math.max(0, versions.findIndex((v) => v.id === (selectedId ?? inner)))
  const currentIndex = Math.max(0, versions.findIndex((v) => v.id === currentId))
  const selected = versions[index]
  const current = versions[currentIndex]
  const isCurrent = index === currentIndex
  const parts = React.useMemo(() => diffWords(current?.text ?? "", selected?.text ?? ""), [current, selected])
  const summary = React.useMemo(() => summarizeDiff(parts), [parts])
  const identical = summary.added + summary.removed === 0 && !summary.invisible
  if (!selected || !current) return null

  const nameOf = (v: Version, i: number) => v.label ?? `v${i + 1}`
  const when = (v: Version) => (mounted ? formatTime(new Date(v.savedAt)) : "")
  const values = { numbers: summary.numbers.map((n) => `${n.from} → ${n.to}`).join(", "), name: nameOf(selected, index), when: when(selected), removed: words(summary.removed), added: words(summary.added) }
  const position = (i: number) => `calc(${versions.length > 1 ? i / (versions.length - 1) : 0} * (100% - 1rem) + 0.5rem)`

  const restore = async () => {
    setStatus("pending")
    try {
      await onRestore(selected)
      setConfirming(false)
      setStatus("idle")
    } catch {
      setStatus("error")
    }
  }

  return (
    <div data-slot="version-scrubber" className={cn("w-full max-w-xl rounded-lg border bg-card text-sm text-card-foreground", className)} {...props}>
      <style>{"@keyframes cui-version-scrubber-in{from{opacity:.35}}@keyframes cui-version-scrubber-mark{from{box-shadow:0 0 0 3px rgb(245 158 11/.45)}}"}</style>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b px-4 py-2.5">
        <History aria-hidden className="size-4 text-muted-foreground" />
        <h3 id={`${id}-heading`} className="flex-1 font-medium">{heading}</h3>
        <span className="text-xs text-muted-foreground tabular-nums">{index + 1} / {versions.length}</span>
      </div>

      <div className="px-4 pt-3">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <p aria-live="polite" className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="font-medium">{nameOf(selected, index)}</span>
            <span className="text-muted-foreground">{[selected.author, when(selected)].filter(Boolean).join(" · ")}</span>
            {isCurrent && (
              <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-400">{currentLabel}</span>
            )}
          </p>
          {!isCurrent && (
            <button type="button" onClick={() => select(current.id)} className={cn(button, "-my-1 -mr-2 ml-auto h-7 px-2 text-xs hover:bg-accent")}>
              {backLabel}
            </button>
          )}
        </div>
        <div className="relative mt-3 pb-5">
          <input
            type="range"
            min={0}
            max={versions.length - 1}
            value={index}
            onChange={(e) => select(versions[Number(e.target.value)].id)}
            aria-labelledby={`${id}-heading`}
            aria-valuetext={`${nameOf(selected, index)}${isCurrent ? `, ${currentLabel}` : ""}, ${index + 1} of ${versions.length}${selected.author ? `, by ${selected.author}` : ""}`}
            className={cn(
              "relative z-10 block h-4 w-full cursor-pointer appearance-none bg-transparent outline-none [&::-moz-range-track]:h-1 [&::-moz-range-track]:rounded-full [&::-moz-range-track]:bg-muted [&::-webkit-slider-runnable-track]:h-1 [&::-webkit-slider-runnable-track]:rounded-full [&::-webkit-slider-runnable-track]:bg-muted [&::-webkit-slider-thumb]:-mt-1.5",
              thumb,
            )}
          />
          {versions.map((v, i) => (
            <button
              key={v.id}
              type="button"
              tabIndex={-1}
              aria-hidden
              onClick={() => select(v.id)}
              style={{ left: position(i) }}
              className={cn(
                "absolute top-5 size-2 -translate-x-1/2 rounded-full transition-colors",
                i === currentIndex ? "size-2.5 bg-emerald-500 ring-2 ring-emerald-500/25" : i === index ? "bg-primary" : "bg-muted-foreground/40 hover:bg-muted-foreground",
              )}
            />
          ))}
          <span
            aria-hidden
            style={{ left: position(currentIndex) }}
            className={cn("absolute top-8 text-[10px] font-medium text-emerald-700 dark:text-emerald-400", currentIndex === versions.length - 1 ? "-translate-x-full" : currentIndex === 0 ? "" : "-translate-x-1/2")}
          >
            {currentLabel}
          </span>
        </div>
      </div>

      <div className="mx-4 mt-3 rounded-md border bg-background">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b px-3 py-1.5 text-xs font-medium">
          {isCurrent || identical ? (
            <span className="text-muted-foreground">{isCurrent ? isCurrentText : identicalText}</span>
          ) : (
            <>
              <span className="text-emerald-700 dark:text-emerald-400">+{summary.added} back</span>
              <span className="text-red-700 dark:text-red-400">−{summary.removed} removed</span>
              {summary.numbers.length > 0 && (
                <span className="inline-flex items-center gap-1 rounded-md bg-amber-100 px-2 py-0.5 text-amber-900 dark:bg-amber-500/15 dark:text-amber-200">
                  <Hash aria-hidden className="size-3" />
                  <span className="font-mono">{summary.numbers.map((n) => `${n.from} → ${n.to}`).join(", ")}</span>
                </span>
              )}
            </>
          )}
        </div>
        <p
          key={selected.id}
          className="max-h-56 overflow-auto px-3 py-2.5 leading-relaxed break-words whitespace-pre-wrap motion-safe:animate-[cui-version-scrubber-in_200ms_ease-out]"
        >
          {parts.map((part, i) =>
            part.type === "equal" ? (
              <span key={i}>{part.value}</span>
            ) : part.type === "insert" ? (
              <ins key={i} className="rounded-sm bg-emerald-500/15 text-emerald-800 no-underline motion-safe:animate-[cui-version-scrubber-mark_400ms_ease-out] dark:text-emerald-300">
                <span className="sr-only">comes back: </span>{part.value}
              </ins>
            ) : (
              <del key={i} className="rounded-sm bg-red-500/15 text-red-800 decoration-red-500/60 motion-safe:animate-[cui-version-scrubber-mark_400ms_ease-out] dark:text-red-300">
                <span className="sr-only">removed: </span>{part.value}
              </del>
            ),
          )}
        </p>
      </div>

      <div className="p-4" onKeyDown={(e) => e.key === "Escape" && confirming && status !== "pending" && setConfirming(false)}>
        {confirming ? (
          <div role="group" aria-label={fill(confirmText, values)} className="grid gap-3 rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-amber-950 dark:text-amber-50">
            <p>
              <span className="font-medium">
                {fill(confirmText, values)}
                {summary.numbers.length > 0 && ` ${fill(numbersText, values)}`}
              </span>{" "}
              <span className="text-amber-900/75 dark:text-amber-100/75">{keptText}</span>
            </p>
            {status === "error" && <p role="alert" className="text-red-700 dark:text-red-400">{errorText}</p>}
            <div className="flex flex-wrap justify-end gap-2">
              <button ref={cancelRef} type="button" disabled={status === "pending"} onClick={() => setConfirming(false)} className={cn(button, "border border-amber-700/25 hover:bg-amber-500/15 dark:border-amber-300/25")}>
                {cancelLabel}
              </button>
              <button type="button" disabled={status === "pending"} onClick={restore} className={cn(button, "bg-amber-700 text-white hover:bg-amber-800 dark:bg-amber-400 dark:text-amber-950 dark:hover:bg-amber-300")}>
                {status === "pending" ? <LoaderCircle aria-hidden className="size-4 animate-spin" /> : <RotateCcw aria-hidden className="size-4" />}
                {fill(confirmLabel, values)}
              </button>
            </div>
          </div>
        ) : (
          <button type="button" disabled={isCurrent || identical} onClick={() => setConfirming(true)} className={cn(button, "h-9 px-4 w-full border bg-background shadow-xs hover:bg-accent dark:border-input dark:bg-input/30 dark:hover:bg-input/50")}>
            <RotateCcw aria-hidden className="size-4" />
            {restoreLabel}
          </button>
        )}
      </div>
    </div>
  )
}
