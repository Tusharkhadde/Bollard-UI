"use client"

import * as React from "react"
import { ArrowRight, Download, LoaderCircle, RotateCcw, TriangleAlert, Undo2 } from "lucide-react"

import { cn } from "@/lib/utils"

export interface ResetSetting {
  key: string
  label: string
  /** Section it lives in, e.g. "Editor". */
  group?: string
  value: unknown
  defaultValue: unknown
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)

/** The settings the user actually changed, plus how many already sit at their default. */
export function customizedSettings(settings: ResetSetting[]) {
  const changed = settings.filter((s) => !same(s.value, s.defaultValue))
  return { changed, atDefault: settings.length - changed.length }
}

/** Default display: On/Off for booleans, JSON for objects, plain text otherwise. */
export function formatSettingValue(value: unknown) {
  if (typeof value === "boolean") return value ? "On" : "Off"
  if (value === null || value === undefined || value === "") return "None"
  return typeof value === "object" ? JSON.stringify(value) : String(value)
}

const button =
  "inline-flex h-9 items-center justify-center gap-2 rounded-md [&_svg]:shrink-0 px-4 text-sm font-medium whitespace-nowrap shadow-xs outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 aria-busy:cursor-progress"
const outline = "border bg-background hover:bg-accent dark:border-input dark:bg-input/30 dark:hover:bg-input/50"
const fixClass =
  "inline-flex h-6 shrink-0 items-center gap-1 rounded-md border border-amber-500/40 px-2 font-medium text-amber-900 transition-colors hover:bg-amber-500/10 dark:text-amber-200 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"

export interface ResetPreviewProps extends Omit<React.ComponentProps<"div">, "children" | "title" | "onReset"> {
  /** Settings the user changed, with current and default values. */
  settings: ResetSetting[]
  /** Resets the listed keys. Return a promise to show a pending state; a rejection is caught. */
  onReset: (keys: string[]) => void | Promise<void>
  /** Puts back the values that were reset. Shown as Undo for `undoFor` ms after a reset. */
  onUndo?: (previous: Record<string, unknown>) => void
  /** Overrides the built-in download of the customizations as JSON. */
  onExport?: (customizations: Record<string, unknown>) => void
  /** How long Undo stays available, in ms. */
  undoFor?: number
  /** File name for the built-in export. */
  exportFileName?: string
  /** Formats a value for display. */
  format?: (value: unknown, setting: ResetSetting) => string
  /** Heading for the number of changed settings. */
  title?: (count: number) => string
  /** Says how many settings are already at their default. */
  atDefaultText?: (count: number) => string
  /** Accessible label prefix of each keep checkbox. */
  keepLabel?: string
  /** Shown until the user exports. Gets the Undo window in seconds, or null without Undo. */
  noExportText?: (undoSeconds: number | null) => string
  /** Label of the export button. */
  exportLabel?: string
  /** Shown once a copy has been exported. */
  exportedText?: string
  /** Reset button label, given how many reset and how many are kept. */
  resetLabel?: (resetting: number, keeping: number) => string
  /** Reset button label while onReset runs. */
  pendingLabel?: string
  /** Shown when nothing differs from the defaults. */
  nothingText?: string
  /** Shown after reset, with the count. */
  doneText?: (count: number) => string
  /** Label of the Undo button. */
  undoLabel?: string
}

/**
 * "Reset to defaults" that shows what it will throw away. Only settings the
 * user changed are listed, each as current → default, so they can keep some.
 * Until they export, a warning offers a one-tap backup; after the reset, a
 * draining Undo puts the old values back.
 */
export function ResetPreview({
  settings,
  onReset,
  onUndo,
  onExport,
  undoFor = 10_000,
  exportFileName = "settings-backup.json",
  format = formatSettingValue,
  title = (n) => `Reset ${n} customized ${n === 1 ? "setting" : "settings"}?`,
  atDefaultText = (n) => `${n} other ${n === 1 ? "setting is" : "settings are"} already at default and won't change.`,
  keepLabel = "Keep",
  noExportText = (s) => `No copy saved. ${s ? `Once Undo ends (${s} s) these` : "These"} can't be restored.`,
  exportLabel = "Export first",
  exportedText = "Copy saved.",
  resetLabel = (n, kept) => (kept ? `Reset ${n}, keep ${kept}` : `Reset ${n} to defaults`),
  pendingLabel = "Resetting…",
  nothingText = "Everything is already at its default.",
  doneText = (n) => `${n} ${n === 1 ? "setting" : "settings"} reset to defaults.`,
  undoLabel = "Undo",
  className,
  ...props
}: ResetPreviewProps) {
  const { changed, atDefault } = customizedSettings(settings)
  const [kept, setKept] = React.useState<Set<string>>(() => new Set())
  const [exported, setExported] = React.useState(false)
  const [pending, setPending] = React.useState(false)
  const [undo, setUndo] = React.useState<Record<string, unknown> | null>(null)
  const titleId = React.useId()
  const resetting = changed.filter((s) => !kept.has(s.key))
  const groups = [...new Set(changed.map((s) => s.group ?? ""))]

  React.useEffect(() => {
    if (!undo) return
    const id = setTimeout(() => setUndo(null), undoFor)
    return () => clearTimeout(id)
  }, [undo, undoFor])

  const toggle = (key: string) =>
    setKept((prev) => {
      const next = new Set(prev)
      if (!next.delete(key)) next.add(key)
      return next
    })

  const exportNow = () => {
    const data = Object.fromEntries(changed.map((s) => [s.key, s.value]))
    if (onExport) onExport(data)
    else {
      const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }))
      const a = Object.assign(document.createElement("a"), { href: url, download: exportFileName })
      a.click()
      URL.revokeObjectURL(url)
    }
    setExported(true)
  }

  const reset = async () => {
    if (pending || resetting.length === 0) return
    setPending(true)
    try {
      await onReset(resetting.map((s) => s.key))
      setUndo(Object.fromEntries(resetting.map((s) => [s.key, s.value])))
    } catch {
      // The caller reports the error; nothing was reset, so the list stays.
    } finally {
      setPending(false)
    }
  }

  if (undo && onUndo) {
    const count = Object.keys(undo).length
    return (
      <div data-slot="reset-preview" data-state="reset" role="status" className={cn("relative w-full max-w-lg overflow-hidden rounded-xl border bg-card p-4 text-sm text-card-foreground", className)} {...props}>
        <style>{`@keyframes cui-reset-preview-drain{from{transform:scaleX(1)}to{transform:scaleX(0)}}`}</style>
        <div className="flex items-center gap-3">
          <RotateCcw aria-hidden className="size-4 shrink-0 text-muted-foreground" />
          <p className="min-w-0 flex-1">{doneText(count)}</p>
          <button type="button" onClick={() => {
              onUndo(undo)
              setUndo(null)
            }} className={cn(button, outline, "h-8 px-3")}>
            <Undo2 aria-hidden className="size-4" />
            {undoLabel}
          </button>
        </div>
        <span
          aria-hidden
          style={{ animationDuration: `${undoFor}ms` }}
          className="absolute inset-x-0 bottom-0 h-0.5 origin-left bg-foreground/40 motion-safe:animate-[cui-reset-preview-drain_linear_forwards] motion-reduce:hidden"
        />
      </div>
    )
  }

  return (
    <div data-slot="reset-preview" role="group" aria-labelledby={titleId} className={cn("w-full max-w-lg space-y-4 rounded-xl border bg-card p-4 text-card-foreground sm:p-5", className)} {...props}>
      <div>
        <h3 id={titleId} className="font-medium">
          {changed.length ? title(changed.length) : nothingText}
        </h3>
        {changed.length > 0 && atDefault > 0 && <p className="mt-1 text-xs text-muted-foreground">{atDefaultText(atDefault)}</p>}
      </div>

      {groups.map((group) => (
        <section key={group} aria-label={group || undefined} className="space-y-1">
          {group && <h4 className="text-xs font-medium text-muted-foreground">{group}</h4>}
          <ul className="divide-y rounded-lg border">
            {changed
              .filter((s) => (s.group ?? "") === group)
              .map((s) => {
                const keep = kept.has(s.key)
                return (
                  <li key={s.key} className={cn("flex items-center gap-3 px-3 py-2 text-sm transition-colors duration-200", keep && "bg-muted/50")}>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{s.label}</p>
                      <p className="flex flex-wrap items-center gap-x-1.5 text-xs">
                        <span className={cn("break-all transition-colors duration-200", keep ? "text-foreground" : "text-red-700 line-through decoration-red-500/50 dark:text-red-400")}>{format(s.value, s)}</span>
                        <ArrowRight aria-label="resets to" className={cn("size-3 text-muted-foreground transition-opacity duration-200", keep && "opacity-30")} />
                        <span className={cn("break-all text-muted-foreground transition-opacity duration-200", keep && "opacity-50")}>{format(s.defaultValue, s)}</span>
                      </p>
                    </div>
                    <label className="flex shrink-0 cursor-pointer items-center gap-1.5 text-xs">
                      <input type="checkbox" checked={keep} onChange={() => toggle(s.key)} aria-label={`${keepLabel} ${s.label}`} className="size-3.5 accent-primary outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50" />
                      {keepLabel}
                    </label>
                  </li>
                )
              })}
          </ul>
        </section>
      ))}

      {changed.length > 0 && (
        <>
          <p aria-live="polite" className={cn("flex flex-wrap items-center gap-x-2 gap-y-1.5 text-xs", exported ? "text-muted-foreground" : "text-amber-900 dark:text-amber-100")}>
            {exported ? (
              exportedText
            ) : (
              <>
                <span className="flex min-w-0 flex-1 basis-48 gap-1.5">
                  <TriangleAlert aria-hidden className="mt-px size-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
                  {noExportText(onUndo ? Math.round(undoFor / 1000) : null)}
                </span>
                <button type="button" onClick={exportNow} className={fixClass}>
                  <Download aria-hidden className="size-3.5" />
                  {exportLabel}
                </button>
              </>
            )}
          </p>
          <div className="flex justify-end">
            <button type="button" onClick={reset} disabled={resetting.length === 0} aria-busy={pending || undefined} className={cn(button, "bg-destructive text-white hover:bg-destructive/90 dark:bg-destructive/60 dark:hover:bg-destructive/70")}>
              {pending ? <LoaderCircle aria-hidden className="size-4 animate-spin" /> : <RotateCcw aria-hidden className="size-4" />}
              {pending ? pendingLabel : resetLabel(resetting.length, kept.size)}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
