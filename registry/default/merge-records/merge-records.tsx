"use client"

import * as React from "react"
import { ChevronDown, GitMerge, KeyRound, LoaderCircle, TriangleAlert } from "lucide-react"

import { cn } from "@/lib/utils"

export interface MergeRecordItem {
  /** The record's ID, e.g. "C-1042". */
  id: string
  /** Last time the record was edited. Decides the default winner per field. */
  updatedAt: Date | number | string
  /** Field values by field key. Empty strings count as empty. */
  values: Record<string, string | undefined>
  /** Things that point at this record (deals, tickets, integrations), e.g. ["3 deals", "Stripe customer"]. */
  links?: string[]
}

export interface MergeField {
  key: string
  label: string
}

/** Field key → ID of the record whose value wins. */
export type MergePicks = Record<string, string>

const time = (value: MergeRecordItem["updatedAt"]) => new Date(value).getTime()
const filled = (value?: string) => (value ?? "").trim() !== ""
const norm = (value?: string) => (value ?? "").trim().toLowerCase().replace(/\s+/g, " ")

/** For every field, the most recently updated record that has a non-empty value. */
export function defaultPicks(records: MergeRecordItem[], fields: MergeField[]): MergePicks {
  const newestFirst = [...records].sort((a, b) => time(b.updatedAt) - time(a.updatedAt))
  return Object.fromEntries(fields.map((f) => [f.key, (newestFirst.find((r) => filled(r.values[f.key])) ?? newestFirst[0]).id]))
}

/** The kept values, which fields really conflict, and every distinct value the merge throws away. */
export function mergePlan(records: MergeRecordItem[], fields: MergeField[], picks: MergePicks) {
  const values: Record<string, string> = {}
  const conflicts: string[] = []
  const discarded: { field: MergeField; value: string; from: string[] }[] = []
  for (const field of fields) {
    const kept = records.find((r) => r.id === picks[field.key])?.values[field.key] ?? ""
    values[field.key] = kept
    const others = new Map<string, { value: string; from: string[] }>()
    for (const r of records) {
      const v = r.values[field.key]
      if (!filled(v) || norm(v) === norm(kept)) continue
      const entry = others.get(norm(v)) ?? { value: v!.trim(), from: [] }
      entry.from.push(r.id)
      others.set(norm(v), entry)
    }
    const distinct = new Set(records.map((r) => norm(r.values[field.key])).filter(Boolean))
    if (distinct.size > 1) conflicts.push(field.key)
    for (const o of others.values()) discarded.push({ field, ...o })
  }
  return { values, conflicts, discarded }
}

const button =
  "inline-flex h-9 items-center justify-center gap-2 rounded-md [&_svg]:shrink-0 px-4 text-sm font-medium whitespace-nowrap shadow-xs outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-busy:cursor-progress"
const choice =
  "flex cursor-pointer items-start gap-2 rounded-md border px-2.5 py-1.5 text-sm transition-colors has-[:checked]:border-foreground/50 has-[:checked]:bg-accent/60 has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-ring/50"

export interface MergeRecordsProps extends Omit<React.ComponentProps<"form">, "onSubmit" | "defaultValue"> {
  /** The two or three duplicates. Order sets the A/B/C letters. */
  records: MergeRecordItem[]
  /** Fields to compare, in display order. */
  fields: MergeField[]
  /** Controlled picks. Defaults to the most recent non-empty value per field. */
  value?: MergePicks
  /** Initial picks when uncontrolled. */
  defaultValue?: MergePicks
  /** Called with the picks on every change. */
  onValueChange?: (picks: MergePicks) => void
  /** Record whose ID and links survive. Defaults to the one with the most links. */
  defaultSurvivor?: string
  /** Runs with the result. Return a promise to show a pending state; a rejection is caught. */
  onMerge: (result: { survivorId: string; removedIds: string[]; values: Record<string, string>; discarded: string[] }) => void | Promise<void>
  /** Called when the user cancels. */
  onCancel?: () => void
  /** Formats a record's updated date. */
  formatDate?: (date: Date) => string
  /** Label for a field whose values really differ. */
  conflictLabel?: string
  /** Label for the count of fields that agree. */
  agreeLabel?: (count: number) => string
  /** Label for the survivor choice. */
  survivorLabel?: string
  /** Label for the count of values discarded. */
  discardLabel?: (count: number) => string
  /** Shown when nothing will be discarded. */
  nothingLostText?: string
  /** One honest line on reversibility. */
  irreversibleText?: string
  /** Merge button text from the count and survivor ID. */
  mergeLabel?: (count: number, survivorId: string) => string
  /** Merge button text while merging. */
  pendingLabel?: string
  /** Cancel button text. */
  cancelLabel?: string
}

/**
 * Merges duplicate records without silently losing data. Each field defaults
 * to the most recent non-empty value, real conflicts are marked (case and
 * spacing differences are not), and a live readback names every value that
 * will be discarded, which record keeps its ID, and which links move to it.
 */
export function MergeRecords({
  records,
  fields,
  value,
  defaultValue,
  onValueChange,
  defaultSurvivor,
  onMerge,
  onCancel,
  formatDate = (d) => d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }),
  conflictLabel = "Conflict",
  agreeLabel = (n) => `${n} ${n === 1 ? "field agrees" : "fields agree"}`,
  survivorLabel = "Keep the ID and links of",
  discardLabel = (n) => `Discarded on merge (${n})`,
  nothingLostText = "No values are lost.",
  irreversibleText = "Merging can't be undone.",
  mergeLabel = (n, id) => `Merge ${n} records into ${id}`,
  pendingLabel = "Merging…",
  cancelLabel = "Cancel",
  className,
  ...props
}: MergeRecordsProps) {
  const [inner, setInner] = React.useState(() => defaultValue ?? defaultPicks(records, fields))
  const [survivor, setSurvivor] = React.useState(
    () => defaultSurvivor ?? [...records].sort((a, b) => (b.links?.length ?? 0) - (a.links?.length ?? 0))[0].id,
  )
  const [showAgreed, setShowAgreed] = React.useState(false)
  const [pending, setPending] = React.useState(false)
  const discardRef = React.useRef<HTMLUListElement>(null)
  const baseId = React.useId()
  const picks = value ?? inner
  const plan = mergePlan(records, fields, picks)
  const letter = (id: string) => String.fromCharCode(65 + records.findIndex((r) => r.id === id))
  const removed = records.filter((r) => r.id !== survivor)
  const moved = removed.flatMap((r) => r.links ?? [])

  const pick = (key: string, id: string) => {
    const next = { ...picks, [key]: id }
    if (value === undefined) setInner(next)
    onValueChange?.(next)
    // Flash the readback line for the value this pick just threw away.
    requestAnimationFrame(() => {
      if (matchMedia("(prefers-reduced-motion: reduce)").matches) return
      discardRef.current?.querySelectorAll(`[data-field="${key}"]`).forEach((el) =>
        el.animate([{ backgroundColor: "rgb(239 68 68 / 0.22)" }, { backgroundColor: "transparent" }], { duration: 400, easing: "ease-out" }),
      )
    })
  }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (pending) return
    setPending(true)
    try {
      await onMerge({ survivorId: survivor, removedIds: removed.map((r) => r.id), values: plan.values, discarded: plan.discarded.map((d) => `${d.field.label}: ${d.value}`) })
    } catch {
      // The caller reports the error; the form stays open to retry.
    } finally {
      setPending(false)
    }
  }

  const renderField = (field: MergeField) => {
    const conflict = plan.conflicts.includes(field.key)
    const options = records.filter((r, i) => filled(r.values[field.key]) && records.findIndex((o) => norm(o.values[field.key]) === norm(r.values[field.key])) === i)
    return (
      <fieldset key={field.key} className={cn("min-w-0 space-y-1.5 border-l-2 pl-3", conflict ? "border-amber-500 dark:border-amber-400" : "border-transparent")}>
        <legend className="flex items-center gap-1.5 pb-1.5 text-xs font-medium text-muted-foreground">
          {field.label}
          {conflict && (
            <span className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-400">
              <TriangleAlert aria-hidden className="size-3.5" />
              {conflictLabel}
            </span>
          )}
        </legend>
        {options.length === 0 && <p className="text-sm text-muted-foreground">—</p>}
        {options.map((r) => {
          const same = records.filter((o) => norm(o.values[field.key]) === norm(r.values[field.key])).map((o) => o.id)
          const checked = same.includes(picks[field.key])
          return (
            <label key={r.id} className={choice}>
              <input type="radio" name={`${baseId}-${field.key}`} checked={checked} onChange={() => pick(field.key, r.id)} className="sr-only" />
              <span aria-hidden className={cn("mt-1 grid size-3.5 shrink-0 place-items-center rounded-full border", checked && "border-primary bg-primary")}>
                {checked && <span className="size-1.5 rounded-full bg-background" />}
              </span>
              <span className={cn("min-w-0 flex-1 break-words", !checked && conflict && "text-muted-foreground")}>{r.values[field.key]}</span>
              <span className="shrink-0 text-xs text-muted-foreground">{same.map(letter).join(" ")}</span>
            </label>
          )
        })}
      </fieldset>
    )
  }

  const agreed = fields.filter((f) => !plan.conflicts.includes(f.key))

  return (
    <form
      data-slot="merge-records"
      onSubmit={submit}
      className={cn("w-full max-w-lg space-y-4 rounded-xl border bg-card p-4 text-card-foreground sm:p-5", className)}
      {...props}
    >
      <div role="radiogroup" aria-labelledby={`${baseId}-survivor`} className="space-y-1.5">
        <p id={`${baseId}-survivor`} className="text-xs font-medium text-muted-foreground">{survivorLabel}</p>
        <div className="grid gap-1.5">
          {records.map((r) => (
            <label key={r.id} className={cn(choice, "items-center")}>
              <input type="radio" name={`${baseId}-survivor`} checked={survivor === r.id} onChange={() => setSurvivor(r.id)} className="sr-only" />
              <span aria-hidden className="grid size-5 shrink-0 place-items-center rounded bg-muted text-xs font-medium">{letter(r.id)}</span>
              <span className="font-medium">{r.id}</span>
              <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                {formatDate(new Date(r.updatedAt))} · {r.links?.length ?? 0} {r.links?.length === 1 ? "link" : "links"}
              </span>
              <KeyRound aria-label={survivor === r.id ? "keeps its ID" : undefined} aria-hidden={survivor !== r.id} className={cn("size-3.5 shrink-0 text-emerald-600 transition-opacity dark:text-emerald-400", survivor !== r.id && "opacity-0")} />
            </label>
          ))}
        </div>
      </div>

      <div className="space-y-3">{fields.filter((f) => plan.conflicts.includes(f.key)).map(renderField)}</div>

      {agreed.length > 0 && (
        <div>
          <button type="button" aria-expanded={showAgreed} onClick={() => setShowAgreed((v) => !v)} className="inline-flex items-center gap-1 rounded-md text-xs text-muted-foreground outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50">
            {agreeLabel(agreed.length)}: {agreed.map((f) => f.label).join(", ")}
            <ChevronDown aria-hidden className={cn("size-3.5 transition-transform", showAgreed && "rotate-180")} />
          </button>
          {showAgreed && <div className="mt-3 space-y-3">{agreed.map(renderField)}</div>}
        </div>
      )}

      <div aria-live="polite" className="space-y-2 rounded-lg border bg-muted/40 p-3 text-sm">
        <p className="flex items-start gap-2">
          <KeyRound aria-hidden className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
          <span>
            <span className="font-medium">{survivor}</span> survives. {removed.map((r) => r.id).join(" and ")} {removed.length === 1 ? "is" : "are"} deleted
            {moved.length > 0 ? ` and ${removed.length === 1 ? "its" : "their"} links move over: ${moved.join(", ")}.` : "."}
          </span>
        </p>
        {plan.discarded.length === 0 ? (
          <p className="text-muted-foreground">{nothingLostText}</p>
        ) : (
          <div>
            <p className="font-medium text-red-700 dark:text-red-400">{discardLabel(plan.discarded.length)}</p>
            <ul ref={discardRef} className="mt-1 space-y-0.5">
              {plan.discarded.map((d) => (
                <li key={d.field.key + d.value} data-field={d.field.key} className="-mx-1 flex gap-1.5 rounded px-1 text-xs">
                  <span className="shrink-0 text-muted-foreground">{d.field.label}</span>
                  <del className="min-w-0 break-words decoration-red-500/60">{d.value}</del>
                  <span className="ml-auto shrink-0 text-muted-foreground">{d.from.map(letter).join(" ")}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
        <p className="text-xs text-muted-foreground sm:mr-auto">{irreversibleText}</p>
        {onCancel && (
          <button type="button" disabled={pending} onClick={onCancel} className={cn(button, "border bg-background hover:bg-accent dark:border-input dark:bg-input/30")}>
            {cancelLabel}
          </button>
        )}
        <button type="submit" aria-busy={pending || undefined} className={cn(button, "bg-primary text-primary-foreground hover:bg-primary/90")}>
          {pending ? <LoaderCircle aria-hidden className="size-4 animate-spin" /> : <GitMerge aria-hidden className="size-4" />}
          {pending ? pendingLabel : mergeLabel(records.length, survivor)}
        </button>
      </div>
    </form>
  )
}
