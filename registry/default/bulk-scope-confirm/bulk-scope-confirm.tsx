"use client"

import * as React from "react"
import { LoaderCircle, RotateCw, TriangleAlert } from "lucide-react"

import { cn } from "@/lib/utils"

export type BulkScope = "page" | "all"

export interface ScopeDetails {
  /** How many items this scope affects. */
  count: number
  /** Labels of the first affected items; the first five are listed. */
  sample: string[]
  /** Counts by category, phrased to follow a number: "you don't own", "shared with clients". */
  breakdown?: { label: string; count: number; risky?: boolean }[]
}

/** "Archive 1,251 items, including 12 you don't own and 3 shared with clients" */
export function describeScope(action: string, details: ScopeDetails, noun: [string, string], locale?: string) {
  const number = new Intl.NumberFormat(locale)
  const risky = (details.breakdown ?? []).filter((item) => item.risky && item.count > 0)
  const list = new Intl.ListFormat(locale, { type: "conjunction" }).format(
    risky.map((item) => `${number.format(item.count)} ${item.label}`),
  )
  return `${action} ${number.format(details.count)} ${details.count === 1 ? noun[0] : noun[1]}${risky.length ? `, including ${list}` : ""}`
}

const variants = {
  default: "bg-primary text-primary-foreground hover:bg-primary/90",
  destructive: "bg-destructive text-white hover:bg-destructive/90 dark:bg-destructive/60 dark:hover:bg-destructive/70",
} as const
const button =
  "inline-flex h-9 items-center justify-center gap-2 rounded-md px-4 text-sm font-medium whitespace-nowrap shadow-xs outline-none transition-[color,background-color,box-shadow] focus-visible:ring-[3px] focus-visible:ring-ring/50"

export interface BulkScopeConfirmProps extends React.ComponentProps<"section"> {
  /** Verb for the action, e.g. "Archive". */
  action: string
  /** Only the items selected on the current page. */
  page: ScopeDetails
  /** Every item matching the current filter, across all pages. */
  all: ScopeDetails
  /** Singular and plural noun, e.g. ["file", "files"]. */
  noun?: [string, string]
  /** Controlled scope. */
  scope?: BulkScope
  /** Initial scope when uncontrolled. Defaults to the safer "page". */
  defaultScope?: BulkScope
  onScopeChange?: (scope: BulkScope) => void
  /** Called with the scope the user confirmed. Return a promise to show a pending state; a rejection is caught. */
  onConfirm: (scope: BulkScope) => void | Promise<void>
  onCancel?: () => void
  variant?: keyof typeof variants
  pageLabel?: string
  allLabel?: string
  pendingLabel?: React.ReactNode
  cancelLabel?: React.ReactNode
  acknowledgeLabel?: React.ReactNode
  /** Warning shown when the "all" count changes while this is open. */
  driftMessage?: (from: string, to: string) => React.ReactNode
  locale?: string
}

/**
 * Says exactly what a bulk action will touch before it runs: the count, the
 * risky subsets (items you don't own, shared ones), a sample, and a scope
 * toggle that defaults to just this page. If more items start matching while
 * it's open, Confirm locks until you acknowledge the new count.
 */
export function BulkScopeConfirm({
  action,
  page,
  all,
  noun = ["item", "items"],
  scope: scopeProp,
  defaultScope = "page",
  onScopeChange,
  onConfirm,
  onCancel,
  variant = "default",
  pageLabel = "Selected on this page",
  allLabel = "All matching",
  pendingLabel = "Working…",
  cancelLabel = "Cancel",
  acknowledgeLabel = "Use new count",
  driftMessage = (from, to) => `The match changed from ${from} to ${to} while this was open.`,
  locale,
  className,
  ...props
}: BulkScopeConfirmProps) {
  const [uncontrolledScope, setUncontrolledScope] = React.useState(defaultScope)
  const scope = scopeProp ?? uncontrolledScope
  const [acknowledged, setAcknowledged] = React.useState(all.count)
  const [pending, setPending] = React.useState(false)
  const id = React.useId()

  const number = new Intl.NumberFormat(locale)
  const details = scope === "page" ? page : all
  const drifted = scope === "all" && all.count !== acknowledged
  const locked = drifted || pending
  const shown = details.sample.slice(0, 5)
  const remaining = details.count - shown.length

  const setScope = (next: BulkScope) => {
    if (scopeProp === undefined) setUncontrolledScope(next)
    onScopeChange?.(next)
  }

  const confirm = async () => {
    if (locked) return
    setPending(true)
    try {
      await onConfirm(scope)
    } catch {
      // The caller reports the error; the panel stays usable.
    } finally {
      setPending(false)
    }
  }

  return (
    <section
      data-slot="bulk-scope-confirm"
      aria-label={`${action} ${noun[1]}`}
      className={cn(
        "w-full max-w-md space-y-4 rounded-xl border bg-card p-4 sm:p-5 text-sm text-card-foreground",
        className,
      )}
      {...props}
    >
      <fieldset>
        <legend className="sr-only">Which {noun[1]}</legend>
        <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1">
          {(
            [
              ["page", pageLabel, page.count],
              ["all", allLabel, all.count],
            ] as const
          ).map(([value, label, count]) => (
            <label
              key={value}
              className="flex min-h-8 cursor-pointer items-center justify-center rounded-md px-2 py-1 text-center text-xs text-muted-foreground transition-colors has-checked:bg-background has-checked:font-medium has-checked:text-foreground has-checked:shadow-sm has-focus-visible:ring-[3px] has-focus-visible:ring-ring/50 dark:has-checked:bg-input/50"
            >
              <input
                type="radio"
                name={id}
                value={value}
                checked={scope === value}
                onChange={() => setScope(value)}
                className="sr-only"
              />
              <span>
                {label} <span className="tabular-nums">({number.format(count)})</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <p aria-live="polite" className="text-base font-medium text-balance">
        {describeScope(action, details, noun, locale)}.
      </p>

      {!!details.breakdown?.length && (
        <ul className="space-y-1.5" aria-label="Breakdown">
          {details.breakdown.map((item) => {
            const share = details.count ? (item.count / details.count) * 100 : 0
            const flagged = item.risky && item.count > 0
            return (
              <li key={item.label} className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1">
                <span className={cn(flagged && "font-medium text-amber-800 dark:text-amber-300")}>
                  {number.format(item.count)} {item.label}
                </span>
                <span className="text-xs tabular-nums text-muted-foreground">
                  {share > 0 && share < 1 ? "<1" : Math.round(share)}%
                </span>
                <span aria-hidden className="col-span-2 h-1 overflow-hidden rounded-full bg-muted">
                  <span
                    className={cn("block h-full rounded-full", item.risky ? "bg-amber-500" : "bg-foreground/30")}
                    style={{ width: `${Math.max(item.count ? 2 : 0, share)}%` }}
                  />
                </span>
              </li>
            )
          })}
        </ul>
      )}

      <div className="rounded-lg border bg-muted/30 px-3 py-2">
        <ul
          className="space-y-0.5 text-muted-foreground"
          aria-label={`First ${shown.length} ${shown.length === 1 ? noun[0] : noun[1]}`}
        >
          {shown.map((label, index) => (
            <li key={`${index}-${label}`} className="truncate">
              {label}
            </li>
          ))}
        </ul>
        {remaining > 0 && <p className="mt-1 text-xs font-medium">and {number.format(remaining)} more</p>}
      </div>

      {/* Always mounted, so the warning is announced when it appears. */}
      <div aria-live="polite" id={`${id}-drift`}>
        {drifted && (
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 p-2.5 text-amber-950 dark:border-amber-500/40 dark:bg-amber-950/40 dark:text-amber-50">
            <p className="flex min-w-0 flex-1 basis-56 items-start gap-2">
              <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
              <span>{driftMessage(number.format(acknowledged), number.format(all.count))}</span>
            </p>
            <button
              type="button"
              onClick={() => setAcknowledged(all.count)}
              className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md border border-amber-400 bg-background/60 px-3 text-xs font-medium outline-none hover:bg-background focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:border-amber-500/50 dark:bg-transparent dark:hover:bg-amber-950"
            >
              <RotateCw aria-hidden className="size-3.5" /> {acknowledgeLabel}
            </button>
          </div>
        )}
      </div>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        {onCancel && (
          <button
            type="button"
            disabled={pending}
            onClick={onCancel}
            className={cn(
              button,
              "border bg-background hover:bg-accent disabled:opacity-50 dark:border-input dark:bg-input/30 dark:hover:bg-input/50",
            )}
          >
            {cancelLabel}
          </button>
        )}
        <button
          type="button"
          aria-disabled={locked || undefined}
          aria-busy={pending || undefined}
          aria-describedby={drifted ? `${id}-drift` : undefined}
          onClick={() => void confirm()}
          className={cn(
            button,
            "tabular-nums aria-busy:cursor-progress",
            variants[variant],
            drifted && "cursor-not-allowed opacity-50",
          )}
        >
          {pending && <LoaderCircle aria-hidden className="size-4 animate-spin" />}
          {pending
            ? pendingLabel
            : `${action} ${number.format(details.count)} ${details.count === 1 ? noun[0] : noun[1]}`}
        </button>
      </div>
    </section>
  )
}
