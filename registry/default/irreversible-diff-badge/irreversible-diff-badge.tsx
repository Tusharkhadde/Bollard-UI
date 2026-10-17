"use client"

// Bollard UI — irreversible-diff-badge · MIT licence · https://bollard-ui.vercel.app/components/irreversible-diff-badge

import * as React from "react"
import { ArrowRight, LoaderCircle, Lock, Undo2 } from "lucide-react"

import { cn } from "@/lib/utils"
import { irreversibleChanges, stable, type IrreversibleChange, type IrreversibleField } from "./irreversible-changes"

export { irreversibleChanges, type IrreversibleChange, type IrreversibleField } from "./irreversible-changes"

const DEFAULT_MESSAGES = {
  permanent: "Permanent",
  limited: "Hard to undo",
  changed: "Can't undo",
  titleOne: "1 change can't be undone after saving",
  titleMany: "{count} changes can't be undone after saving",
  empty: "empty",
  readback: "{from} to {to}",
  revert: "Revert",
  revertLabel: "Revert {field} to {from}",
  confirm: "I understand these can't be undone",
  confirmAgain: "The list changed. Confirm again to save.",
  reverted: "Reverted. Nothing permanent will change.",
  save: "Save changes",
  saving: "Saving…",
  saveError: "Couldn't save. Nothing was changed.",
}
export type IrreversibleMessages = typeof DEFAULT_MESSAGES
const fill = (t: string, v: Record<string, string | number>) => t.replace(/\{(\w+)\}/g, (_, k) => String(v[k] ?? ""))

export interface IrreversibleBadgeProps extends React.ComponentProps<"span"> {
  /** Whether the field has been changed from its saved value. Unchanged shows a quiet lock; changed turns amber. */
  changed?: boolean
  /** Same meaning as on IrreversibleField. */
  severity?: "permanent" | "limited"
  /** Visible strings. */
  messages?: Partial<Pick<IrreversibleMessages, "permanent" | "limited" | "changed">>
}

/** A chip for a field's label that warns, before anyone types, that the value is hard or impossible to change back. */
export function IrreversibleBadge({ changed, severity = "permanent", messages, className, ...props }: IrreversibleBadgeProps) {
  const t = { ...DEFAULT_MESSAGES, ...messages }
  return (
    <span
      data-slot="irreversible-badge"
      data-changed={changed ? "" : undefined}
      className={cn(
        "inline-flex h-5 shrink-0 items-center gap-1 rounded-full border px-1.5 text-[11px] font-medium text-muted-foreground transition-colors",
        "data-changed:border-amber-500/50 data-changed:bg-amber-500/10 data-changed:text-amber-800 dark:data-changed:text-amber-300",
        className,
      )}
      {...props}
    >
      <Lock aria-hidden className="size-3" />
      {severity === "limited" ? t.limited : changed ? t.changed : t.permanent}
    </span>
  )
}

export interface IrreversibleDiffSummaryProps extends Omit<React.ComponentProps<"div">, "children"> {
  /** The fields that can't be undone. Other fields are ignored. */
  fields: IrreversibleField[]
  /** The values as last saved. */
  saved: Record<string, unknown>
  /** The values in the form right now. */
  current: Record<string, unknown>
  /** Puts one field back to its saved value. Shows a Revert button per row. */
  onRevert?: (key: string, savedValue: unknown) => void
  /** Controlled: whether the user has confirmed the current list. */
  confirmed?: boolean
  /** Called when the box is ticked, and with false whenever the list changes underneath it. */
  onConfirmedChange?: (confirmed: boolean) => void
  /** Shows a Save button that stays locked until the list is confirmed. May return a promise. */
  onSave?: (changes: IrreversibleChange[]) => void | Promise<void>
  /** Every visible string. */
  messages?: Partial<IrreversibleMessages>
}

/**
 * Lists, right before save, only the changed fields that can't be undone, as a
 * "from → to" readback with what happens next and a one-tap Revert. The
 * confirmation resets whenever that list changes, so a tick given for the
 * username never covers a region change made after it.
 */
export function IrreversibleDiffSummary({
  fields, saved, current, onRevert, confirmed, onConfirmedChange, onSave, messages, className, ...props
}: IrreversibleDiffSummaryProps) {
  const t = { ...DEFAULT_MESSAGES, ...messages }
  const changes = irreversibleChanges(fields, saved, current)
  // One entry per change; objects are compared by content, not "[object Object]".
  const entries = changes.map((c) => `${c.field.key}=${stable(c.to)}`)
  const signature = entries.join("\n")
  const [inner, setInner] = React.useState(false)
  const [ackFor, setAckFor] = React.useState(entries)
  const [pending, setPending] = React.useState(false)
  const [error, setError] = React.useState<string>()
  const [justReverted, setJustReverted] = React.useState(false)
  const rootRef = React.useRef<HTMLDivElement>(null)
  const id = React.useId()
  // Reverting part of a confirmed list keeps the tick; any new or different change needs a fresh one.
  const covered = entries.every((e) => ackFor.includes(e))
  const isConfirmed = (confirmed ?? inner) && covered
  const stale = (confirmed ?? inner) && !covered

  const setConfirmed = (next: boolean) => {
    setInner(next)
    setAckFor(entries)
    onConfirmedChange?.(next)
  }
  // A changed list needs a fresh confirmation.
  React.useEffect(() => {
    if (!covered && (confirmed ?? inner)) onConfirmedChange?.(false)
    if (changes.length) setJustReverted(false)
  }, [signature]) // eslint-disable-line react-hooks/exhaustive-deps

  const title = changes.length === 1 ? t.titleOne : fill(t.titleMany, { count: changes.length })
  const [announced, setAnnounced] = React.useState("")
  React.useEffect(() => {
    const timer = setTimeout(() => setAnnounced(changes.length ? title : ""), 700)
    return () => clearTimeout(timer)
  }, [title, changes.length])

  const show = (f: IrreversibleField, v: unknown) => {
    try {
      const s = f.format ? f.format(v) : v === undefined || v === null || v === "" ? "" : String(v)
      return s || t.empty
    } catch {
      return t.empty
    }
  }

  const revert = (c: IrreversibleChange, index: number) => {
    onRevert?.(c.field.key, c.from)
    if (changes.length === 1) setJustReverted(true)
    // Focus the next row's Revert (or the previous one), else the "reverted" note.
    requestAnimationFrame(() => {
      const buttons = rootRef.current?.querySelectorAll<HTMLElement>("[data-revert]") ?? []
      const target = buttons[index] ?? buttons[index - 1] ?? rootRef.current?.querySelector<HTMLElement>("[data-reverted]")
      target?.focus()
    })
  }

  const save = async () => {
    if (!onSave || (changes.length && !isConfirmed)) return
    setPending(true)
    setError(undefined)
    try {
      await onSave(changes)
    } catch {
      setError(t.saveError)
    } finally {
      setPending(false)
    }
  }

  return (
    <div
      ref={rootRef}
      data-slot="irreversible-diff-badge"
      role="group"
      aria-labelledby={changes.length ? `${id}-title` : undefined}
      className={cn("grid w-full max-w-md gap-3 text-sm", className)}
      {...props}
      aria-describedby={cn(props["aria-describedby"], changes.length && `${id}-list`) || undefined}
    >
      <span className="sr-only" aria-live="polite">{announced}</span>
      {changes.length > 0 ? (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/5">
          <p id={`${id}-title`} className="flex items-center gap-2 px-3 pt-2.5 font-medium text-amber-950 dark:text-amber-50">
            <Lock aria-hidden className="size-4 shrink-0 text-amber-600 dark:text-amber-400" />
            {title}
          </p>
          <ul id={`${id}-list`} className="grid gap-2 px-3 py-2.5">
            {changes.map((c, i) => (
              <li key={c.field.key} className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="font-medium">{c.field.label}</span>
                    {c.field.severity === "limited" && <IrreversibleBadge severity="limited" messages={t} />}
                  </p>
                  <p className="flex flex-wrap items-center gap-x-1.5 text-xs [overflow-wrap:anywhere]">
                    <span className="sr-only">{fill(t.readback, { from: show(c.field, c.from), to: show(c.field, c.to) })}</span>
                    <del aria-hidden className="text-muted-foreground">{show(c.field, c.from)}</del>
                    <ArrowRight aria-hidden className="size-3 shrink-0 text-muted-foreground" />
                    <ins aria-hidden className="font-medium no-underline">{show(c.field, c.to)}</ins>
                  </p>
                  {c.field.consequence && <p className="mt-0.5 text-xs text-muted-foreground">{c.field.consequence}</p>}
                </div>
                {onRevert && (
                  <button
                    type="button"
                    data-revert
                    onClick={() => revert(c, i)}
                    aria-label={fill(t.revertLabel, { field: c.field.label, from: show(c.field, c.from) })}
                    className="inline-flex h-8 shrink-0 items-center gap-1 rounded-md border bg-background px-2.5 text-xs font-medium shadow-xs transition-colors outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30"
                  >
                    <Undo2 aria-hidden className="size-3.5" />
                    {t.revert}
                  </button>
                )}
              </li>
            ))}
          </ul>
          <label className="flex items-start gap-2 border-t border-amber-500/30 px-3 py-2.5 text-sm">
            <input
              type="checkbox"
              checked={isConfirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
              aria-describedby={stale ? `${id}-stale` : undefined}
              className="mt-0.5 size-4 shrink-0 accent-amber-600 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
            />
            <span>
              {t.confirm}
              {stale && <span id={`${id}-stale`} className="block text-xs text-amber-700 dark:text-amber-400">{t.confirmAgain}</span>}
            </span>
          </label>
        </div>
      ) : justReverted ? (
        <p data-reverted tabIndex={-1} className="text-xs text-muted-foreground outline-none">{t.reverted}</p>
      ) : null}

      {onSave && (
        <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-2">
          {error && <p role="alert" className="mr-auto text-xs text-destructive">{error}</p>}
          <button
            type="button"
            onClick={save}
            disabled={pending || (changes.length > 0 && !isConfirmed)}
            className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow-xs transition-colors outline-none hover:bg-primary/90 focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50"
          >
            {pending && <LoaderCircle aria-hidden className="size-4 animate-spin" />}
            {pending ? t.saving : t.save}
          </button>
        </div>
      )}
    </div>
  )
}
