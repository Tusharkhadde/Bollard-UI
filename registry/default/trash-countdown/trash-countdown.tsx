"use client"

// Bollard UI — trash-countdown · MIT licence · https://bollard-ui.vercel.app/components/trash-countdown

import * as React from "react"
import { FileText, LoaderCircle, RotateCcw, TriangleAlert, Trash2 } from "lucide-react"

import { cn } from "@/lib/utils"

const DAY = 86_400_000

export interface TrashItem {
  id: string
  name: string
  /** When it was moved to the trash. */
  deletedAt: Date | number | string
  /** Where restore puts it back, e.g. "Finance / 2026". */
  location?: string
  icon?: React.ReactNode
}

/** Time left before a trashed item is purged, as text and as a 0–1 fraction of the retention period. */
export function purgeCountdown(deletedAt: Date | number | string, now: number, retentionDays: number) {
  const left = new Date(deletedAt).getTime() + retentionDays * DAY - now
  const days = Math.floor(left / DAY)
  const hours = Math.ceil(left / 3_600_000)
  const text =
    left <= 0 ? "Deleting forever now" :
    days >= 1 ? `Deleted forever in ${days} ${days === 1 ? "day" : "days"}` :
    hours > 1 ? `Deleted forever in ${hours} hours` :
    `Deleted forever in ${Math.max(1, Math.ceil(left / 60_000))} min`
  return { left, text, fraction: Math.max(0, Math.min(1, left / (retentionDays * DAY))) }
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`
const button =
  "inline-flex items-center justify-center gap-1.5 rounded-md text-sm font-medium whitespace-nowrap outline-none transition-[color,background-color,box-shadow] focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50"
const outline = "border bg-background shadow-xs hover:bg-accent dark:border-input dark:bg-input/30 dark:hover:bg-input/50"
const destructive = "bg-destructive text-white shadow-xs hover:bg-destructive/90 dark:bg-destructive/60"

export interface TrashCountdownProps extends Omit<React.ComponentProps<"section">, "children"> {
  /** Trashed items with when they were trashed and where they restore to. */
  items: TrashItem[]
  /** Days an item stays in the trash before it's deleted forever. */
  retentionDays?: number
  /** Items with fewer days than this left are highlighted. */
  soonDays?: number
  /** Items trashed more recently than this (ms) are called out before emptying. */
  recentFor?: number
  /** Put an item back. Return a promise to show progress; a rejection keeps the row. */
  onRestore: (id: string) => void | Promise<void>
  /** Delete these items forever. */
  onEmpty: (ids: string[]) => void | Promise<void>
  /** Heading of the list. */
  title?: string
  /** Label of the empty-trash button. */
  emptyLabel?: string
  /** Label of each restore button. */
  restoreLabel?: string
  /** Shown when the trash is empty. */
  nothingText?: string
}

/**
 * A soft-delete trash that makes "forever" visible. Each item shows how long
 * it has left with a draining bar, soonest first, and items about to be purged
 * are highlighted. Restore is one tap and says where the item went. "Empty
 * trash" asks you to type the item count, calls out anything trashed in the
 * last day, and resets if new items arrive while you're typing, so the number
 * you confirmed is always the number that gets deleted.
 */
export function TrashCountdown({
  items, retentionDays = 30, soonDays = 3, recentFor = DAY, onRestore, onEmpty,
  title = "Trash", emptyLabel = "Empty trash", restoreLabel = "Restore", nothingText = "Trash is empty.",
  className, ...props
}: TrashCountdownProps) {
  const [now, setNow] = React.useState<number>()
  const [busy, setBusy] = React.useState<string>()
  const [said, setSaid] = React.useState("")
  const [confirming, setConfirming] = React.useState(false)
  const [snapshot, setSnapshot] = React.useState(0)
  const [typed, setTyped] = React.useState("")
  const rows = React.useRef(new Map<string, HTMLLIElement>())
  const inputRef = React.useRef<HTMLInputElement>(null)
  const id = React.useId()

  React.useEffect(() => {
    setNow(Date.now())
    const timer = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(timer)
  }, [])

  const count = items.length
  // Re-read the clock when the list changes, so a just-trashed item never shows more than the full period.
  React.useEffect(() => setNow(Date.now()), [items])
  // New items mean the typed number no longer describes what would be deleted.
  React.useEffect(() => {
    if (confirming && count !== snapshot) setTyped("")
  }, [count, snapshot, confirming])
  React.useEffect(() => {
    if (confirming) inputRef.current?.focus()
  }, [confirming])

  const sorted = now === undefined ? items : [...items].sort((a, b) => new Date(a.deletedAt).getTime() - new Date(b.deletedAt).getTime())
  const soon = now === undefined ? 0 : items.filter((i) => purgeCountdown(i.deletedAt, now, retentionDays).left < soonDays * DAY).length
  const recent = now === undefined ? 0 : items.filter((i) => now - new Date(i.deletedAt).getTime() < recentFor).length
  const grew = confirming && count > snapshot

  const restore = async (item: TrashItem) => {
    const row = rows.current.get(item.id)
    const still = matchMedia("(prefers-reduced-motion: reduce)").matches
    setBusy(item.id)
    const out = still || !row ? undefined : row.animate(
      [{ opacity: 1, height: `${row.offsetHeight}px` }, { opacity: 0, height: "0px", paddingBlock: "0px" }],
      { duration: 250, easing: "ease-out", fill: "forwards" },
    )
    try {
      // Collapse first, then hand over: the parent usually drops the row as soon as it's told.
      await out?.finished
      await onRestore(item.id)
      setSaid(`Restored “${item.name}”${item.location ? ` to ${item.location}` : ""}.`)
    } catch {
      out?.cancel()
    } finally {
      setBusy(undefined)
    }
  }

  const empty = async () => {
    setBusy("empty")
    try {
      await onEmpty(items.map((i) => i.id))
      setSaid(`${plural(count, "item", "items")} deleted forever.`)
      setConfirming(false)
    } catch {
      // Keep the confirmation open so it can be retried.
    } finally {
      setBusy(undefined)
    }
  }

  return (
    <section data-slot="trash-countdown" aria-labelledby={`${id}-title`} className={cn("w-full max-w-md overflow-hidden rounded-lg border bg-card text-card-foreground shadow-xs", className)} {...props}>
      <div className="flex items-center gap-2 border-b px-3 py-2">
        <Trash2 aria-hidden className="size-4 text-muted-foreground" />
        <h3 id={`${id}-title`} className="text-sm font-semibold">{title}</h3>
        <span className="text-xs text-muted-foreground">{plural(count, "item", "items")}</span>
        <button
          type="button"
          disabled={!count || confirming}
          aria-expanded={confirming}
          aria-controls={`${id}-confirm`}
          onClick={() => { setSnapshot(count); setTyped(""); setConfirming(true) }}
          className={cn(button, outline, "ml-auto h-8 px-3 text-red-700 dark:text-red-400")}
        >
          {emptyLabel}
        </button>
      </div>

      <div id={`${id}-confirm`} className={cn("grid transition-[grid-template-rows] duration-300 ease-out motion-reduce:transition-none", confirming ? "grid-rows-[1fr]" : "grid-rows-[0fr]")}>
        <div className="overflow-hidden" inert={!confirming}>
          <div className="grid gap-2 border-b bg-red-500/5 p-3 text-sm">
            <label htmlFor={`${id}-count`}>
              This deletes <strong>{plural(count, "item", "items")}</strong> forever. Type <strong className="font-mono">{count}</strong> to confirm.
            </label>
            {recent ? <p className="flex gap-1.5 text-xs text-muted-foreground"><TriangleAlert aria-hidden className="mt-px size-3.5 shrink-0" />{plural(recent, "was", "were")} trashed in the last day. Restore anything you meant to keep.</p> : null}
            <div className="flex gap-2">
              <input
                ref={inputRef}
                id={`${id}-count`}
                inputMode="numeric"
                autoComplete="off"
                value={typed}
                onChange={(e) => { setTyped(e.target.value.replace(/\D/g, "")); setSnapshot(count) }}
                onKeyDown={(e) => e.key === "Escape" && setConfirming(false)}
                aria-describedby={`${id}-grew`}
                className="h-9 w-20 min-w-0 rounded-md border bg-transparent px-3 font-mono text-base shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 md:text-sm dark:bg-input/30"
              />
              <button type="button" onClick={() => setConfirming(false)} className={cn(button, outline, "ml-auto h-9 px-4")}>Cancel</button>
              <button type="button" disabled={typed !== String(count) || grew || busy === "empty"} onClick={() => void empty()} className={cn(button, destructive, "h-9 px-4")}>
                {busy === "empty" ? <LoaderCircle aria-hidden className="size-4 animate-spin" /> : null}
                Delete forever
              </button>
            </div>
            <p id={`${id}-grew`} aria-live="polite" className="text-xs text-amber-700 empty:hidden dark:text-amber-400">
              {grew ? `${plural(count - snapshot, "item was", "items were")} added since you started. Type ${count} to include ${count - snapshot === 1 ? "it" : "them"}.` : ""}
            </p>
          </div>
        </div>
      </div>

      {soon ? (
        <p className="flex items-center gap-1.5 border-b border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs text-amber-800 dark:text-amber-300">
          <TriangleAlert aria-hidden className="size-3.5 shrink-0" />
          {plural(soon, "item is", "items are")} deleted forever within {plural(soonDays, "day", "days")}.
        </p>
      ) : null}

      {count ? (
        <ul className="max-h-80 divide-y overflow-auto">
          {sorted.map((item) => {
            const c = now === undefined ? undefined : purgeCountdown(item.deletedAt, now, retentionDays)
            const urgent = c ? c.left < soonDays * DAY : false
            return (
              <li key={item.id} ref={(el) => { if (el) rows.current.set(item.id, el); else rows.current.delete(item.id) }} data-soon={urgent || undefined} className={cn("relative flex items-center gap-3 overflow-hidden px-3 py-2", urgent && "bg-amber-500/8")}>
                <span aria-hidden className="text-muted-foreground [&_svg]:size-4">{item.icon ?? <FileText />}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{item.name}</p>
                  <p className={cn("truncate text-xs tabular-nums", urgent ? "font-medium text-amber-700 dark:text-amber-400" : "text-muted-foreground")}>
                    {c?.text ?? " "}{item.location ? <span className="text-muted-foreground font-normal"> · {item.location}</span> : null}
                  </p>
                </div>
                <button type="button" disabled={!!busy} onClick={() => void restore(item)} aria-label={`${restoreLabel} ${item.name}`} className={cn(button, outline, "h-8 px-3")}>
                  {busy === item.id ? <LoaderCircle aria-hidden className="size-4 animate-spin" /> : <RotateCcw aria-hidden className="size-4" />}
                  <span className="max-[400px]:sr-only">{restoreLabel}</span>
                </button>
                <span aria-hidden className={cn("absolute bottom-0 left-0 h-0.5 origin-left transition-transform duration-500 ease-out motion-reduce:transition-none", urgent ? "bg-amber-500" : "bg-foreground/15")} style={{ width: "100%", transform: `scaleX(${c?.fraction ?? 1})` }} />
              </li>
            )
          })}
        </ul>
      ) : (
        <p className="px-3 py-6 text-center text-sm text-muted-foreground">{nothingText}</p>
      )}
      <p aria-live="polite" className="px-3 text-xs text-emerald-700 empty:hidden dark:text-emerald-400 [&:not(:empty)]:py-2 [&:not(:empty)]:border-t">{said}</p>
    </section>
  )
}
