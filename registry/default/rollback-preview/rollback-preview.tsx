"use client"

import * as React from "react"
import { Database, History, LoaderCircle, TriangleAlert, Undo2 } from "lucide-react"

import { cn } from "@/lib/utils"

export interface RollbackVersion {
  /** The id people type and say out loud, e.g. "v40". */
  id: string
  /** When it was deployed or published. */
  deployedAt: Date | number | string
  /** Optional one-line summary, e.g. "Pricing page v2". */
  label?: string
}

export interface RollbackWritten {
  /** What was written, e.g. "orders". */
  label: string
  /** How many since the target went out. */
  count: number
  /** What happens to them after the rollback, e.g. "kept, but v40 can't read the gift_note field". */
  note?: string
}

/** "4 min", "3 h", "2 days": how long ago, without the "ago". */
export function formatAge(from: Date | number | string, now: number) {
  const minutes = Math.max(0, Math.round((now - new Date(from).getTime()) / 60_000))
  if (minutes < 60) return `${Math.max(1, minutes)} min`
  if (minutes < 48 * 60) return `${Math.round(minutes / 60)} h`
  return `${Math.round(minutes / 1440)} days`
}

/** Normalises typed version names so "V40 " matches "v40", but "v4" or "v400" never do. */
export const normalizeVersion = (value: string) => value.trim().toLowerCase().replace(/^version\s*/, "")

const fill = (template: string, values: Record<string, string | number>) =>
  template.replace(/\{(\w+)\}/g, (match, key: string) => String(values[key] ?? match))

const section = "space-y-1.5 border-t px-4 py-3"
const heading = "flex items-center gap-2 text-xs font-medium tracking-wide text-muted-foreground uppercase"

export interface RollbackPreviewProps extends Omit<React.ComponentProps<"div">, "children"> {
  /** What is live now. */
  current: RollbackVersion
  /** The version you are rolling back to. */
  target: RollbackVersion
  /** Versions between target and current that also get undone, newest first. */
  skipped?: RollbackVersion[]
  /** Changes the rollback takes away, e.g. "Gift notes at checkout". */
  reverts: string[]
  /** Things the rollback does NOT undo, e.g. irreversible migrations, sent webhooks, env vars. */
  stays?: string[]
  /** Data written after the target went out, which the old version will have to live with. */
  written?: RollbackWritten[]
  /** Runs the rollback. Return a promise to show a pending state; a rejection re-enables the button. */
  onConfirm: () => void | Promise<void>
  /** Heading of the preview. */
  title?: string
  /** `{age}` and `{count}` (skipped versions) are filled in. */
  targetMeta?: string
  /** Says which newer versions the rollback skips. */
  skippedText?: string
  /** Heading of the list of changes that revert. */
  revertsLabel?: string
  /** Heading of the list of things that won't undo. */
  staysLabel?: string
  /** Says what data was written since the target went out. */
  writtenLabel?: string
  /** `{target}` is filled in. */
  confirmLabel?: string
  /** Label of the type-the-name input. */
  inputLabel?: string
  /** Shown when the typed id is another version, `{typed}` and `{target}` filled in. */
  wrongVersionText?: string
  /** Confirm label while onConfirm runs. */
  pendingLabel?: string
}

/**
 * Stops the "roll back" that undoes more, or less, than you thought. Before
 * anything runs it lays out what reverts, what stays (migrations that won't
 * undo, data written since), how old the target is and which newer versions
 * get skipped. You confirm by typing the target's name, and typing a
 * different version's name says so instead of silently not matching.
 */
export function RollbackPreview({
  current,
  target,
  skipped = [],
  reverts,
  stays = [],
  written = [],
  onConfirm,
  title = "Roll back {current} → {target}",
  targetMeta = "{target} went out {age} ago",
  skippedText = "Also undoes {skipped}",
  revertsLabel = "Reverts",
  staysLabel = "Won't undo",
  writtenLabel = "Written since {target}",
  confirmLabel = "Roll back to {target}",
  inputLabel = "Type {target} to confirm",
  wrongVersionText = "{typed} isn't the target. You're rolling back to {target}.",
  pendingLabel = "Rolling back…",
  className,
  ...props
}: RollbackPreviewProps) {
  const [typed, setTyped] = React.useState("")
  const [pending, setPending] = React.useState(false)
  const [now, setNow] = React.useState<number>()
  const staysRef = React.useRef<HTMLDivElement>(null)
  const inputId = React.useId()
  const hintId = React.useId()

  React.useEffect(() => {
    setNow(Date.now())
    const id = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(id)
  }, [])

  const matched = normalizeVersion(typed) === normalizeVersion(target.id)
  const other = [current, ...skipped].find((v) => typed.trim() && normalizeVersion(typed) === normalizeVersion(v.id))
  const values = {
    current: current.id,
    target: target.id,
    typed: other?.id ?? typed,
    age: now === undefined ? "…" : formatAge(target.deployedAt, now),
    skipped: skipped.map((v) => v.id).join(", "),
  }

  // The moment the name matches, flash what won't undo: the last thing worth reading before the click.
  React.useEffect(() => {
    if (!matched || !staysRef.current) return
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return
    staysRef.current.animate(
      [{ backgroundColor: "rgb(245 158 11 / 0.25)" }, { backgroundColor: "rgb(245 158 11 / 0)" }],
      { duration: 400, easing: "ease-out" },
    )
  }, [matched])

  const confirm = async () => {
    if (!matched || pending) return
    setPending(true)
    try {
      await onConfirm()
    } catch {
      // The caller reports the failure; the button just becomes usable again.
    } finally {
      setPending(false)
    }
  }

  return (
    <div
      data-slot="rollback-preview"
      data-state={pending ? "pending" : matched ? "ready" : "locked"}
      className={cn("w-full overflow-hidden rounded-xl border bg-background text-sm", className)}
      {...props}
    >
      <div className="flex gap-3 px-4 py-3">
        <History aria-hidden className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
        <div className="min-w-0 space-y-0.5">
          <p className="font-medium">{fill(title, values)}</p>
          <p className="text-xs text-muted-foreground">
            {fill(targetMeta, values)}
            {target.label && ` · ${target.label}`}
          </p>
          {skipped.length > 0 && (
            <p className="text-xs font-medium text-amber-700 dark:text-amber-400">{fill(skippedText, values)}</p>
          )}
        </div>
      </div>

      <div className={section}>
        <p className={heading}>
          <Undo2 aria-hidden className="size-3.5" /> {revertsLabel} ({reverts.length})
        </p>
        <ul className="space-y-1">
          {reverts.map((item) => (
            <li key={item} className="flex gap-2">
              <span aria-hidden className="text-red-600 dark:text-red-400">−</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </div>

      {stays.length > 0 && (
        <div ref={staysRef} className={cn(section, "bg-amber-500/5")}>
          <p className={cn(heading, "text-amber-800 dark:text-amber-300")}>
            <TriangleAlert aria-hidden className="size-3.5" /> {staysLabel} ({stays.length})
          </p>
          <ul className="space-y-1 text-amber-950 dark:text-amber-50">
            {stays.map((item) => (
              <li key={item} className="flex gap-2">
                <span aria-hidden className="text-amber-600 dark:text-amber-400">!</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {written.length > 0 && (
        <div className={section}>
          <p className={heading}>
            <Database aria-hidden className="size-3.5" /> {fill(writtenLabel, values)}
          </p>
          <ul className="space-y-1">
            {written.map((item) => (
              <li key={item.label}>
                <span className="font-medium tabular-nums">{item.count.toLocaleString()}</span> {item.label}
                {item.note && <span className="text-muted-foreground"> · {item.note}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="border-t bg-muted/40 px-4 py-3">
        <label htmlFor={inputId} className="text-xs font-medium">
          {fill(inputLabel, values).split(target.id).flatMap((part, i) => (i ? [<code key={i} className="rounded bg-muted px-1 font-mono">{target.id}</code>, part] : [part]))}
        </label>
        <div className="mt-1.5 flex flex-wrap gap-2">
          <input
            id={inputId}
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
            onKeyDown={(event) => event.key === "Enter" && void confirm()}
            autoComplete="off"
            spellCheck={false}
            aria-describedby={hintId}
            aria-invalid={other ? true : undefined}
            className="h-9 min-w-0 flex-1 basis-32 rounded-md border bg-background px-3 font-mono text-base shadow-xs transition-[color,box-shadow] outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-amber-500 md:text-sm dark:bg-input/30"
          />
          <button
            type="button"
            onClick={() => void confirm()}
            disabled={!matched || pending}
            aria-busy={pending || undefined}
            className="inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-md bg-destructive px-4 text-sm font-medium whitespace-nowrap text-white shadow-xs transition-colors outline-none hover:bg-destructive/90 focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 dark:bg-destructive/60"
          >
            {pending && <LoaderCircle aria-hidden className="size-4 animate-spin" />}
            {fill(pending ? pendingLabel : confirmLabel, values)}
          </button>
        </div>
        <p id={hintId} aria-live="polite" className="mt-1.5 flex gap-1.5 text-xs text-amber-700 empty:hidden dark:text-amber-400">
          {other && (
            <>
              <TriangleAlert aria-hidden className="mt-px size-3.5 shrink-0" />
              {fill(wrongVersionText, values)}
            </>
          )}
        </p>
      </div>
    </div>
  )
}
