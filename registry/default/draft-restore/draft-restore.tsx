"use client"

import * as React from "react"
import { ChevronDown, History } from "lucide-react"

import { cn } from "@/lib/utils"

export type FormValues = Record<string, string>

/** What is stored: your values plus the server values they were based on, so restore can tell who changed what. */
export interface StoredDraft {
  v: 1
  savedAt: number
  base: FormValues
  values: FormValues
}

export interface DraftChange {
  key: string
  /** What the server has now. */
  current: string
  /** What your draft has. */
  draft: string
  /** The server also changed this field after your draft started; restoring would overwrite someone's newer edit. */
  conflict: boolean
}

/** Reads a draft, dropping it if it is corrupt or older than `ttl` ms. */
export function readDraft(key: string, ttl: number, now = Date.now()): StoredDraft | null {
  try {
    const draft = JSON.parse(localStorage.getItem(key) ?? "null") as StoredDraft | null
    if (draft?.v === 1 && now - draft.savedAt < ttl) return draft
  } catch {}
  clearDraft(key)
  return null
}

/** Removes a draft, e.g. once the server confirms a submit. */
export function clearDraft(key: string) {
  try {
    localStorage.removeItem(key)
  } catch {}
}

/** Fields your draft changed, each marked as a conflict when the server changed it too, to something else. */
export function draftChanges(draft: StoredDraft, server: FormValues): DraftChange[] {
  return Object.keys(draft.values)
    .filter((key) => draft.values[key] !== (draft.base[key] ?? "") && draft.values[key] !== (server[key] ?? ""))
    .map((key) => ({ key, current: server[key] ?? "", draft: draft.values[key], conflict: (server[key] ?? "") !== (draft.base[key] ?? "") }))
}

const pick = (values: FormValues, exclude: string[]) => Object.fromEntries(Object.entries(values).filter(([key]) => !exclude.includes(key)))
const same = (a: FormValues, b: FormValues) => Object.keys({ ...a, ...b }).every((key) => (a[key] ?? "") === (b[key] ?? ""))

/** "just now", "5 minutes ago", "2 hours ago", "3 days ago". */
export function timeAgo(ms: number) {
  const units: [number, string][] = [[86_400_000, "day"], [3_600_000, "hour"], [60_000, "minute"]]
  for (const [size, unit] of units) {
    const n = Math.floor(ms / size)
    if (n >= 1) return `${n} ${unit}${n === 1 ? "" : "s"} ago`
  }
  return "just now"
}

const NONE: string[] = []

const action =
  "inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-md px-3 text-sm font-medium whitespace-nowrap outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50"

export interface DraftRestoreProps extends Omit<React.ComponentProps<"div">, "children"> {
  /** localStorage key, unique per record, e.g. `draft:invoice:1042`. */
  storageKey: string
  /** The form's current values. Saved (debounced) whenever they differ from `serverValues`. */
  values: FormValues
  /** The record as the server has it now. */
  serverValues: FormValues
  /** Receives the server values with your draft merged in. Conflicting fields keep the server value unless ticked. */
  onRestore: (values: FormValues) => void
  /** Called after the draft is thrown away. */
  onDiscard?: () => void
  /** Readable field names for the preview. */
  labels?: Record<string, string>
  /** Fields never written to storage (passwords, card numbers, one-time codes). */
  exclude?: string[]
  /** Debounce before saving, in ms. */
  delay?: number
  /** Drafts older than this (ms) are deleted instead of offered. Defaults to 7 days. */
  ttl?: number
  /** Templates: `{when}` ("5 minutes ago") and `{count}` are filled in. */
  message?: string
  /** Message when the server changed fields since the draft. */
  conflictMessage?: string
  /** Text saying when the draft expires. */
  expiresText?: string
  /** Text for the preview toggle. */
  previewLabel?: string
  /** Restore button text. */
  restoreLabel?: string
  /** Discard button text. */
  discardLabel?: string
  /** Label for keeping the draft's value over the server's. */
  useMineLabel?: string
  /** Shown under a conflicting field. */
  conflictHint?: string
  /** Show the field preview expanded from the start. */
  defaultExpanded?: boolean
}

/**
 * Keeps an unsent form in localStorage and, when the form opens again, offers
 * to restore it with a preview of every field that differs. It stores the
 * server values the draft started from, so a field someone changed on the
 * server since then is flagged and kept as theirs unless you tick it: a stale
 * draft never silently overwrites newer data.
 */
export function DraftRestore({
  storageKey,
  values,
  serverValues,
  onRestore,
  onDiscard,
  labels = {},
  exclude = NONE,
  delay = 800,
  ttl = 7 * 86_400_000,
  message = "Restore your draft from {when}?",
  conflictMessage = "Your draft from {when} clashes with {count} on the server.",
  expiresText = "Expires in {days}",
  previewLabel = "What differs",
  restoreLabel = "Restore",
  discardLabel = "Discard",
  useMineLabel = "Use my draft",
  conflictHint = "Changed on the server after your draft. Kept unless you tick it.",
  defaultExpanded = false,
  className,
  ...props
}: DraftRestoreProps) {
  const [offer, setOffer] = React.useState<StoredDraft | null>()
  const [now, setNow] = React.useState(0)
  const [open, setOpen] = React.useState(defaultExpanded)
  const [mine, setMine] = React.useState<string[]>([])
  const listId = React.useId()
  const latest = React.useRef({ values, serverValues })
  latest.current = { values, serverValues }

  // Once, on open: offer a stored draft unless it is expired or adds nothing the server lacks.
  React.useEffect(() => {
    const draft = readDraft(storageKey, ttl)
    const useful = draft && draftChanges(draft, latest.current.serverValues).length > 0
    if (draft && !useful) clearDraft(storageKey)
    setNow(Date.now())
    setOffer(useful ? draft : null)
  }, [storageKey, ttl])

  // Autosave, paused while a stored draft is waiting for a decision so it can't be overwritten.
  React.useEffect(() => {
    if (offer !== null) return
    const timer = setTimeout(() => {
      const kept = pick(values, exclude)
      const base = pick(serverValues, exclude)
      if (same(kept, base)) return clearDraft(storageKey)
      const previous = readDraft(storageKey, ttl)
      const draft: StoredDraft = { v: 1, savedAt: Date.now(), base: previous?.base ?? base, values: kept }
      try {
        localStorage.setItem(storageKey, JSON.stringify(draft))
      } catch {}
    }, delay)
    return () => clearTimeout(timer)
  }, [offer, values, serverValues, storageKey, delay, ttl, exclude])

  if (!offer) return null
  const changes = draftChanges(offer, serverValues)
  const conflicts = changes.filter((change) => change.conflict).length
  const days = Math.max(1, Math.ceil((offer.savedAt + ttl - now) / 86_400_000))
  const fill = (template: string) =>
    template.replace("{when}", timeAgo(now - offer.savedAt)).replace("{count}", `${conflicts} newer edit${conflicts === 1 ? "" : "s"}`).replace("{days}", `${days} day${days === 1 ? "" : "s"}`)

  const restore = () => {
    const merged = { ...serverValues }
    for (const change of changes) if (!change.conflict || mine.includes(change.key)) merged[change.key] = change.draft
    setOffer(null)
    onRestore(merged)
  }
  const discard = () => {
    clearDraft(storageKey)
    setOffer(null)
    onDiscard?.()
  }

  return (
    <div
      data-slot="draft-restore"
      data-state={conflicts ? "conflict" : "draft"}
      role="region"
      aria-label="Unsaved draft"
      className={cn(
        "overflow-hidden rounded-lg border text-sm",
        conflicts ? "border-amber-500/30 bg-background bg-linear-to-r from-amber-500/10 to-amber-500/10 text-amber-950 dark:text-amber-50" : "bg-background",
        className,
      )}
      {...props}
    >
      <div className="flex min-h-11 flex-wrap items-center gap-x-3 gap-y-1.5 px-3 py-1.5">
        <div className="flex min-w-0 flex-1 basis-56 items-start gap-3">
          <History aria-hidden className={cn("mt-0.5 size-4 shrink-0", conflicts ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground")} />
          <div className="min-w-0" aria-live="polite">
            <p className="font-medium">{fill(conflicts ? conflictMessage : message)}</p>
            <p className={cn("text-xs", conflicts ? "text-amber-900/75 dark:text-amber-100/75" : "text-muted-foreground")}>{fill(expiresText)}</p>
          </div>
        </div>
        <div className="ml-auto flex flex-wrap justify-end gap-2">
          <button type="button" aria-expanded={open} aria-controls={listId} onClick={() => setOpen(!open)} className={cn(action, "px-2", conflicts ? "hover:bg-amber-500/15" : "hover:bg-accent")}>
            {previewLabel}
            <ChevronDown aria-hidden className={cn("size-4 transition-transform", open && "rotate-180")} />
          </button>
          <button type="button" onClick={discard} className={cn(action, conflicts ? "border border-amber-700/25 hover:bg-amber-500/15 dark:border-amber-300/25" : "border hover:bg-accent")}>
            {discardLabel}
          </button>
          <button type="button" onClick={restore} className={cn(action, conflicts ? "bg-amber-700 text-white hover:bg-amber-800 dark:bg-amber-400 dark:text-amber-950 dark:hover:bg-amber-300" : "bg-primary text-primary-foreground hover:bg-primary/90")}>
            {restoreLabel}
          </button>
        </div>
      </div>
      <ul id={listId} hidden={!open} className="divide-y border-t border-inherit bg-background text-foreground">
        {changes.map((change) => (
          <li key={change.key} className="grid gap-1 px-3 py-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-muted-foreground">{labels[change.key] ?? change.key}</span>
              {change.conflict && (
                <label className="flex items-center gap-1.5 text-xs text-amber-700 dark:text-amber-400">
                  <input
                    type="checkbox"
                    checked={mine.includes(change.key)}
                    onChange={(event) => setMine((keys) => (event.target.checked ? [...keys, change.key] : keys.filter((key) => key !== change.key)))}
                    className="size-3.5 accent-amber-600"
                  />
                  {useMineLabel}
                </label>
              )}
            </div>
            <p className="min-w-0 break-words">
              {change.current && (
                <>
                  <del className="text-red-800 decoration-red-500/60 dark:text-red-300">
                    <span className="sr-only">{change.conflict ? "Newer on server: " : "Saved: "}</span>
                    {change.current}
                  </del>{" "}
                </>
              )}
              <ins className="text-emerald-800 no-underline dark:text-emerald-300">
                <span className="sr-only">Your draft: </span>
                {change.draft || "(empty)"}
              </ins>
            </p>
            {change.conflict && <p className="text-xs text-amber-700 dark:text-amber-400">{conflictHint}</p>}
          </li>
        ))}
      </ul>
    </div>
  )
}
