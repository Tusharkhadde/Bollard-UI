"use client"

// Bollard UI — impact-preview · MIT licence · https://bollard-ui.vercel.app/components/impact-preview

import * as React from "react"
import { ChevronRight, LoaderCircle, RotateCw, ShieldCheck, Trash2, Unlink } from "lucide-react"

import { cn } from "@/lib/utils"

/** What happens to a dependent when the parent is deleted. */
export type ImpactOutcome = "deleted" | "detached" | "kept"

export interface ImpactGroup {
  /** Singular noun, e.g. "invoice". */
  noun: string
  /** Plural noun. Defaults to `noun` + "s". */
  pluralNoun?: string
  count: number
  outcome: ImpactOutcome
  /** A few example names, shown when the group is expanded. */
  sample?: string[]
  /** Extra context, e.g. "Paid invoices stay in your accounting export." */
  note?: string
}

const outcomes = {
  deleted: { label: "Deleted", icon: Trash2, tone: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300" },
  detached: {
    label: "Detached",
    icon: Unlink,
    tone: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  },
  kept: {
    label: "Kept",
    icon: ShieldCheck,
    tone: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  },
} as const

const order: ImpactOutcome[] = ["deleted", "detached", "kept"]
const button =
  "inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium whitespace-nowrap shadow-xs outline-none transition-[color,background-color,box-shadow] focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50"
const outline = "border bg-background hover:bg-accent dark:border-input dark:bg-input/30 dark:hover:bg-input/50"

/** "12 invoices", "1 webhook". */
export const countNoun = (g: ImpactGroup) => `${g.count} ${g.count === 1 ? g.noun : (g.pluralNoun ?? `${g.noun}s`)}`

const listify = (items: string[]) =>
  items.length < 2 ? items.join("") : `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`

/** Drops empty groups, sorts deleted → detached → kept, and writes the one-line summary. */
export function summarizeImpact(groups: ImpactGroup[]) {
  const visible = groups.filter((g) => g.count > 0).sort((a, b) => order.indexOf(a.outcome) - order.indexOf(b.outcome))
  const deleted = visible.filter((g) => g.outcome === "deleted")
  const detached = visible.filter((g) => g.outcome === "detached")
  const summary = [
    deleted.length > 0 && `This also deletes ${listify(deleted.map(countNoun))}.`,
    detached.length > 0 && `${listify(detached.map(countNoun))} will be detached.`,
  ]
    .filter(Boolean)
    .join(" ")
  return {
    groups: visible,
    summary: summary || "Nothing else is affected.",
    deletedCount: deleted.reduce((n, g) => n + g.count, 0),
  }
}

export interface ImpactPreviewProps extends Omit<React.ComponentProps<"section">, "title"> {
  /** Name of the thing being deleted, e.g. "Acme". */
  name: string
  /** Fetches the dependents. Receives an AbortSignal that fires on unmount or retry. */
  load: (signal: AbortSignal) => Promise<ImpactGroup[]>
  /** Runs when the user confirms. Return a promise to show a pending state; a rejection is caught. */
  onConfirm: () => void | Promise<void>
  /** Called when the user cancels. */
  onCancel?: () => void
  /** Heading, given the parent's name. */
  title?: (name: string) => React.ReactNode
  /** Confirm label, given the parent's name and how many dependents get deleted with it. */
  confirmLabel?: (name: string, deletedCount: number) => React.ReactNode
  /** Confirm button content while onConfirm is pending. */
  pendingLabel?: React.ReactNode
  /** Cancel button content. */
  cancelLabel?: React.ReactNode
  /** Retry button content after a load error. */
  retryLabel?: React.ReactNode
  /** Shown while dependents load. */
  loadingMessage?: (name: string) => React.ReactNode
  /** Shown when the lookup fails. Deleting stays blocked until a retry succeeds. */
  errorMessage?: (name: string) => React.ReactNode
}

/**
 * The delete confirmation that answers "what else goes with it?" before you
 * press the button. Dependents load asynchronously, are grouped by type with
 * counts and an expandable sample, and each group says whether it is deleted,
 * detached or kept. Confirm stays locked until the list has loaded, and a
 * failed lookup blocks deletion instead of quietly allowing it.
 */
export function ImpactPreview({
  name,
  load,
  onConfirm,
  onCancel,
  title = (n) => `Delete “${n}”?`,
  confirmLabel = (n, count) =>
    count > 0 ? `Delete ${n} and ${count} ${count === 1 ? "item" : "items"}` : `Delete ${n}`,
  pendingLabel = "Deleting…",
  cancelLabel = "Cancel",
  retryLabel = "Retry",
  loadingMessage = (n) => `Checking what depends on ${n}…`,
  errorMessage = (n) => `Couldn’t check what depends on ${n}. Deleting is paused until we can.`,
  className,
  ...props
}: ImpactPreviewProps) {
  const [result, setResult] = React.useState<ReturnType<typeof summarizeImpact> | null>(null)
  const [failed, setFailed] = React.useState(false)
  const [attempt, setAttempt] = React.useState(0)
  const [open, setOpen] = React.useState<number | null>(null)
  const [pending, setPending] = React.useState(false)
  const baseId = React.useId()
  // An inline `load` arrow shouldn't refetch on every render; only `name` and Retry do.
  const loadRef = React.useRef(load)
  React.useEffect(() => {
    loadRef.current = load
  })

  React.useEffect(() => {
    const controller = new AbortController()
    setResult(null)
    setFailed(false)
    setOpen(null)
    loadRef
      .current(controller.signal)
      .then((groups) => !controller.signal.aborted && setResult(summarizeImpact(groups)))
      .catch(() => !controller.signal.aborted && setFailed(true))
    return () => controller.abort()
  }, [name, attempt])

  const loading = !result && !failed
  const locked = !result || pending

  const confirm = async () => {
    if (locked) return
    setPending(true)
    try {
      await onConfirm()
    } catch {
      // The caller reports the error; the dialog stays usable.
    } finally {
      setPending(false)
    }
  }

  return (
    <section
      data-slot="impact-preview"
      aria-labelledby={`${baseId}-title`}
      aria-busy={loading}
      className={cn("w-full max-w-md space-y-4 rounded-xl border bg-card p-4 sm:p-5 text-card-foreground", className)}
      {...props}
    >
      <div className="space-y-1">
        <h3 id={`${baseId}-title`} className="font-medium">
          {title(name)}
        </h3>
        <p aria-live="polite" className="text-sm text-muted-foreground">
          {failed ? null : result ? result.summary : loadingMessage(name)}
        </p>
      </div>

      {failed ? (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-3 rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/60 dark:text-red-300"
        >
          <span className="min-w-0 flex-1 basis-48">{errorMessage(name)}</span>
          <button
            type="button"
            onClick={() => setAttempt((n) => n + 1)}
            className={cn(button, outline, "h-8 px-3 text-foreground")}
          >
            <RotateCw aria-hidden className="size-3.5" /> {retryLabel}
          </button>
        </div>
      ) : !result ? (
        <div aria-hidden className="space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-10 animate-pulse rounded-md bg-muted" />
          ))}
        </div>
      ) : (
        result.groups.length > 0 && (
          <ul className="divide-y rounded-md border">
            {result.groups.map((group, index) => {
              const { label, icon: Icon, tone } = outcomes[group.outcome]
              const expandable = !!group.sample?.length || !!group.note
              const panelId = `${baseId}-${index}`
              const isOpen = open === index
              const rest = group.count - (group.sample?.length ?? 0)
              return (
                <li key={`${group.noun}-${group.outcome}`}>
                  <button
                    type="button"
                    disabled={!expandable}
                    aria-expanded={expandable ? isOpen : undefined}
                    aria-controls={expandable ? panelId : undefined}
                    onClick={() => setOpen(isOpen ? null : index)}
                    className="flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm outline-none hover:bg-accent/50 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:ring-inset disabled:hover:bg-transparent"
                  >
                    <ChevronRight
                      aria-hidden
                      className={cn(
                        "size-4 shrink-0 text-muted-foreground transition-transform",
                        isOpen && "rotate-90",
                        !expandable && "invisible",
                      )}
                    />
                    <span className="flex-1 font-medium tabular-nums">{countNoun(group)}</span>
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
                        tone,
                      )}
                    >
                      <Icon aria-hidden className="size-3" /> {label}
                    </span>
                  </button>
                  {expandable && isOpen && (
                    <div id={panelId} className="space-y-1.5 pr-3 pb-3 pl-10 text-sm text-muted-foreground">
                      {!!group.sample?.length && (
                        <ul className="list-disc space-y-0.5 pl-4">
                          {group.sample.map((item) => (
                            <li key={item} className="truncate">
                              {item}
                            </li>
                          ))}
                          {rest > 0 && <li className="list-none">+ {rest} more</li>}
                        </ul>
                      )}
                      {group.note && <p className="text-xs">{group.note}</p>}
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )
      )}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        {onCancel && (
          <button type="button" disabled={pending} onClick={onCancel} className={cn(button, outline, "h-9 px-4")}>
            {cancelLabel}
          </button>
        )}
        <button
          type="button"
          aria-disabled={locked || undefined}
          aria-busy={pending || undefined}
          onClick={() => void confirm()}
          className={cn(
            button,
            "h-9 bg-destructive px-4 text-white hover:bg-destructive/90 dark:bg-destructive/60 dark:hover:bg-destructive/70 aria-busy:cursor-progress",
            !result && "cursor-not-allowed opacity-50 hover:bg-destructive dark:hover:bg-destructive/60",
          )}
        >
          {pending && <LoaderCircle aria-hidden className="size-4 animate-spin" />}
          {pending ? pendingLabel : confirmLabel(name, result?.deletedCount ?? 0)}
        </button>
      </div>
    </section>
  )
}
