"use client"

// Bollard UI — archive-or-delete · MIT licence · https://bollard-ui.vercel.app/components/archive-or-delete

import * as React from "react"
import { Archive, Check, LoaderCircle, Minus, Trash2, X } from "lucide-react"

import { cn } from "@/lib/utils"

export type RemovalChoice = "archive" | "delete"

/** What happens to one thing under one choice: kept as is, changed (read-only, hidden…), or gone. */
export interface Fate {
  kind: "kept" | "changed" | "lost"
  text: string
}

export interface RemovalItem {
  /** The thing affected, e.g. "2,431 messages". */
  label: string
  archive: Fate
  delete: Fate
}

/** Splits items into the ones whose fate differs between the two choices (the real decision) and the rest. */
export function compareChoices(items: RemovalItem[]) {
  const differs = (i: RemovalItem) => i.archive.kind !== i.delete.kind || i.archive.text !== i.delete.text
  return {
    different: items.filter(differs),
    same: items.filter((i) => !differs(i)),
  }
}

const fateStyle = {
  kept: { icon: Check, tone: "text-emerald-700 dark:text-emerald-400" },
  changed: { icon: Minus, tone: "text-amber-700 dark:text-amber-400" },
  lost: { icon: X, tone: "text-red-700 dark:text-red-400" },
} as const

const button =
  "inline-flex h-9 items-center justify-center gap-2 rounded-md px-4 text-sm font-medium whitespace-nowrap shadow-xs outline-none transition-[color,background-color,box-shadow] focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-busy:cursor-progress"
const outline = "border bg-background hover:bg-accent dark:border-input dark:bg-input/30 dark:hover:bg-input/50"

export interface ArchiveOrDeleteProps extends Omit<React.ComponentProps<"form">, "onSubmit" | "title" | "defaultValue"> {
  /** Name of the thing being removed, e.g. "#launch-2025". */
  name: string
  /** Everything affected, each with its fate under both choices. */
  items: RemovalItem[]
  /** Runs with the chosen option. Return a promise to show a pending state; a rejection is caught. */
  onConfirm: (choice: RemovalChoice) => void | Promise<void>
  /** Called when the user cancels. */
  onCancel?: () => void
  /** Controlled choice. Defaults to "archive", the reversible one. */
  value?: RemovalChoice
  /** Initially selected choice when uncontrolled. Defaults to archive. */
  defaultValue?: RemovalChoice
  /** Called when the selected choice changes. */
  onValueChange?: (choice: RemovalChoice) => void
  /** Focus the reversible choice on mount, so Enter archives rather than deletes. */
  autoFocus?: boolean
  /** Dialog title; receives the thing's name. */
  title?: (name: string) => React.ReactNode
  /** Label of the Archive option. */
  archiveLabel?: string
  /** One line on how to undo an archive, e.g. "Unarchive anytime from Settings". */
  archiveSummary?: string
  /** Label of the Delete option. */
  deleteLabel?: string
  /** One honest line on recovery, e.g. "Can't be undone" or "Recoverable for 30 days". */
  deleteSummary?: string
  /** Confirm button text when Archive is chosen. */
  confirmArchiveLabel?: (name: string) => string
  /** Confirm button text when Delete is chosen. */
  confirmDeleteLabel?: (name: string) => string
  /** Confirm button text while onConfirm is running. */
  pendingLabel?: string
  /** Cancel button text. */
  cancelLabel?: string
  /** Label above the items both choices treat the same way. */
  sameLabel?: string
}

/**
 * The removal dialog that makes "Archive" and "Delete" an informed choice
 * instead of a reflex. One list of affected things shows its fate under each
 * option, side by side, with the differences first and the shared outcomes
 * folded below. The reversible option starts selected and focused, so Enter
 * never deletes, and choosing Delete flashes what is lost and turns the
 * confirm button into an explicit "Delete forever".
 */
export function ArchiveOrDelete({
  name,
  items,
  onConfirm,
  onCancel,
  value,
  defaultValue = "archive",
  onValueChange,
  autoFocus = true,
  title = (n) => `Remove ${n}?`,
  archiveLabel = "Archive",
  archiveSummary = "Reversible. Unarchive anytime.",
  deleteLabel = "Delete",
  deleteSummary = "Permanent. This can't be undone.",
  confirmArchiveLabel = (n) => `Archive ${n}`,
  confirmDeleteLabel = (n) => `Delete ${n} forever`,
  pendingLabel = "Working…",
  cancelLabel = "Cancel",
  sameLabel = "Same either way",
  className,
  ...props
}: ArchiveOrDeleteProps) {
  const [inner, setInner] = React.useState(defaultValue)
  const [pending, setPending] = React.useState(false)
  const choice = value ?? inner
  const archiveRef = React.useRef<HTMLInputElement>(null)
  const deleteListRef = React.useRef<HTMLUListElement>(null)
  const baseId = React.useId()
  const { different, same } = compareChoices(items)

  React.useEffect(() => {
    if (autoFocus) archiveRef.current?.focus({ preventScroll: true })
  }, [autoFocus])

  const choose = (next: RemovalChoice) => {
    if (value === undefined) setInner(next)
    onValueChange?.(next)
    const list = deleteListRef.current
    if (next !== "delete" || !list || matchMedia("(prefers-reduced-motion: reduce)").matches) return
    list.querySelectorAll("[data-lost]").forEach((row, i) =>
      row.animate([{ backgroundColor: "rgb(239 68 68 / 0.25)" }, { backgroundColor: "transparent" }], {
        duration: 400,
        delay: i * 40,
        easing: "ease-out",
      }),
    )
  }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (pending) return
    setPending(true)
    try {
      await onConfirm(choice)
    } catch {
      // The caller reports the error; the dialog stays open to retry.
    } finally {
      setPending(false)
    }
  }

  const options = [
    { id: "archive", label: archiveLabel, summary: archiveSummary, icon: Archive, ref: archiveRef },
    { id: "delete", label: deleteLabel, summary: deleteSummary, icon: Trash2, ref: undefined },
  ] as const

  return (
    <form
      data-slot="archive-or-delete"
      aria-labelledby={`${baseId}-title`}
      onSubmit={submit}
      className={cn("@container w-full max-w-lg space-y-4 rounded-xl border bg-card p-4 text-card-foreground sm:p-5", className)}
      {...props}
    >
      <h3 id={`${baseId}-title`} className="font-medium">
        {title(name)}
      </h3>
      <div role="radiogroup" aria-labelledby={`${baseId}-title`} className="grid gap-3 @md:grid-cols-2">
        {options.map((option) => {
          const selected = choice === option.id
          const danger = option.id === "delete"
          const Icon = option.icon
          return (
            <label
              key={option.id}
              className={cn(
                "relative flex cursor-pointer flex-col gap-3 rounded-lg border p-3 transition-[border-color,box-shadow,background-color] duration-200 ease-out has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-ring/50",
                selected && !danger && "border-foreground/40 bg-accent/40",
                selected && danger && "border-red-500/60 bg-red-500/5 dark:border-red-400/50",
              )}
            >
              <input
                ref={option.ref}
                type="radio"
                name={`${baseId}-choice`}
                value={option.id}
                checked={selected}
                onChange={() => choose(option.id)}
                aria-describedby={`${baseId}-${option.id}-summary`}
                className="sr-only"
              />
              <span className="flex items-start gap-2">
                <Icon aria-hidden className={cn("mt-0.5 size-4 shrink-0", danger ? "text-red-600 dark:text-red-400" : "text-muted-foreground")} />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium">{option.label}</span>
                  <span id={`${baseId}-${option.id}-summary`} className="block text-xs text-muted-foreground">
                    {option.summary}
                  </span>
                </span>
                <span
                  aria-hidden
                  className={cn(
                    "mt-0.5 grid size-4 shrink-0 place-items-center rounded-full border transition-colors",
                    selected && (danger ? "border-red-600 bg-red-600 dark:border-red-500 dark:bg-red-500" : "border-primary bg-primary"),
                  )}
                >
                  {selected && <span className="size-1.5 rounded-full bg-background" />}
                </span>
              </span>
              <ul ref={danger ? deleteListRef : undefined} className="space-y-1 text-xs">
                {different.map((item) => {
                  const fate = item[option.id]
                  const { icon: FateIcon, tone } = fateStyle[fate.kind]
                  return (
                    <li key={item.label} data-lost={fate.kind === "lost" || undefined} className="-mx-1 flex gap-1.5 rounded px-1 py-0.5">
                      <FateIcon aria-hidden className={cn("mt-px size-3.5 shrink-0", tone)} />
                      <span className="min-w-0">
                        <span className="font-medium">{item.label}</span>
                        <span className="sr-only">: </span> <span className={tone}>{fate.text}</span>
                      </span>
                    </li>
                  )
                })}
              </ul>
            </label>
          )
        })}
      </div>

      {same.length > 0 && (
        <p className="text-xs text-muted-foreground">
          <span className="font-medium text-foreground">{sameLabel}:</span>{" "}
          {same.map((item) => `${item.label} (${item.archive.text.toLowerCase()})`).join(", ")}
        </p>
      )}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        {onCancel && (
          <button type="button" disabled={pending} onClick={onCancel} className={cn(button, outline)}>
            {cancelLabel}
          </button>
        )}
        <button
          type="submit"
          aria-busy={pending || undefined}
          className={cn(
            button,
            choice === "delete"
              ? "bg-destructive text-white hover:bg-destructive/90 dark:bg-destructive/60 dark:hover:bg-destructive/70"
              : "bg-primary text-primary-foreground hover:bg-primary/90",
          )}
        >
          {pending ? <LoaderCircle aria-hidden className="size-4 animate-spin" /> : choice === "delete" ? <Trash2 aria-hidden className="size-4" /> : <Archive aria-hidden className="size-4" />}
          {pending ? pendingLabel : choice === "delete" ? confirmDeleteLabel(name) : confirmArchiveLabel(name)}
        </button>
      </div>
    </form>
  )
}
