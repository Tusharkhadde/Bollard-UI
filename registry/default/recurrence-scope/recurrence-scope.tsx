"use client"

// Bollard UI — recurrence-scope · MIT licence · https://bollard-ui.vercel.app/components/recurrence-scope

import * as React from "react"
import { LoaderCircle, Repeat, TriangleAlert } from "lucide-react"

import { cn } from "@/lib/utils"

export type RecurrenceScopeValue = "this" | "following" | "all"

export interface Occurrence {
  /** Stable id of this occurrence. */
  id: string
  /** Start as `YYYY-MM-DD` or `YYYY-MM-DDTHH:mm` (wall time). */
  start: string
  /** Fields that were edited on this occurrence alone, e.g. `["time"]`. */
  overrides?: string[]
}

/** The occurrences a scope touches, in order. */
export function affectedOccurrences(occurrences: Occurrence[], editingId: string, scope: RecurrenceScopeValue) {
  const index = occurrences.findIndex((o) => o.id === editingId)
  if (scope === "this") return occurrences.slice(index, index + 1)
  return scope === "following" ? occurrences.slice(Math.max(index, 0)) : occurrences
}

/**
 * Occurrences whose own edits the change would overwrite: any that override a
 * field being changed, or all of them when the repeat rule itself changes (that
 * regenerates the series). The occurrence being edited is never counted.
 */
export function overwrittenExceptions(affected: Occurrence[], editingId: string, changes: string[], ruleField = "repeat") {
  return affected
    .filter((o) => o.id !== editingId && o.overrides?.length)
    .map((o) => ({ occurrence: o, fields: changes.includes(ruleField) ? o.overrides ?? [] : (o.overrides ?? []).filter((f) => changes.includes(f)) }))
    .filter((hit) => hit.fields.length > 0)
}

/** Every user-visible string the props don't already cover, so the dialog can be translated. */
export const RECURRENCE_MESSAGES = {
  heading: (title: string) => `Edit recurring “${title}”`,
  nothing: "Nothing changes.",
  count: (n: number) => `${n} ${n === 1 ? "occurrence" : "occurrences"}`,
  changesOne: (date: string, open: boolean) => `Changes ${open ? "" : "only "}${date}`,
  changesRange: (from: string, to: string, count: string) => `Changes ${from} to ${to} (${count})`,
  andAfter: " and every one after",
  includingPast: (n: number) => `, including ${n} already past`,
  keeps: (dates: string, n: number) => `${dates} ${n === 1 ? "keeps its" : "keep their"} own changes.`,
  /** Joins a list of dates or fields: "1, 2 and 3". */
  list: (items: string[]) => (items.length < 2 ? items.join("") : `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`),
  was: (n: number) => (n === 1 ? "was" : "were"),
  occurrences: "Occurrences",
  changing: "Changes: ",
  kept: "Keeps its own changes: ",
  unchanged: "Unchanged: ",
  editedAlone: ", edited on its own",
  overwriteAnyway: "Overwrite them after all",
}
export type RecurrenceMessages = typeof RECURRENCE_MESSAGES

const toDate = (start: string) => new Date(`${start.slice(0, 10)}T00:00:00Z`)

export interface RecurrenceScopeProps extends Omit<React.ComponentProps<"div">, "defaultValue"> {
  /** Name of the event or task, e.g. "Team stand-up". */
  title: string
  /** The series' occurrences in order (a finite window is fine; see `continues`). */
  occurrences: Occurrence[]
  /** The occurrence the user opened. */
  editingId: string
  /** Fields being changed, e.g. `["time"]`. Include `"repeat"` when the rule itself changes. */
  changes: string[]
  /** Words for fields in the warning, e.g. `{ time: "time", title: "title" }`. */
  fieldLabels?: Record<string, string>
  /** The series carries on after the last listed occurrence (no end date). */
  continues?: boolean
  /** "Today" as `YYYY-MM-DD`, to call out past occurrences. Defaults to the local date once mounted. */
  today?: string
  /** Controlled scope. */
  value?: RecurrenceScopeValue
  /** Initial scope when uncontrolled. Defaults to the safest, "this". */
  defaultValue?: RecurrenceScopeValue
  /** Called when the scope changes. */
  onValueChange?: (scope: RecurrenceScopeValue) => void
  /** Save. `skip` lists occurrences whose own edits should be kept. May return a Promise. */
  onConfirm?: (scope: RecurrenceScopeValue, detail: { ids: string[]; skip: string[] }) => void | Promise<unknown>
  /** Close without saving. */
  onCancel?: () => void
  /** Locale for dates. */
  locale?: string
  /** Option labels. */
  scopeLabels?: Record<RecurrenceScopeValue, string>
  /** Templates: `{dates}` and `{fields}` are filled in. */
  overwriteText?: string
  /** Label of the button that keeps individually edited occurrences. */
  keepLabel?: string
  /** Label of the Cancel button. */
  cancelLabel?: string
  /** Save button: `{count}` is filled in. */
  saveLabel?: string
  /** Override the readback and other small strings (see `RECURRENCE_MESSAGES`). */
  messages?: Partial<RecurrenceMessages>
}

const action =
  "inline-flex h-9 items-center justify-center gap-1.5 rounded-md px-4 text-sm font-medium whitespace-nowrap outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-60"

/**
 * The "This one / This and following / All" choice for a recurring event,
 * with a readback of exactly which dates change and how many, past ones
 * called out. It warns, by date and field, when saving would overwrite
 * occurrences that were edited on their own, and offers to keep them.
 */
export function RecurrenceScope({
  title,
  occurrences,
  editingId,
  changes,
  fieldLabels = {},
  continues = false,
  today: todayProp,
  value,
  defaultValue = "this",
  onValueChange,
  onConfirm,
  onCancel,
  locale = "en-IN",
  scopeLabels = { this: "This one", following: "This and following", all: "All in the series" },
  overwriteText = "{dates} {verb} edited on their own. Saving overwrites their {fields}.",
  keepLabel = "Keep their own changes",
  cancelLabel = "Cancel",
  saveLabel = "Save {count}",
  messages,
  className,
  ...props
}: RecurrenceScopeProps) {
  const [inner, setInner] = React.useState(defaultValue)
  const [keep, setKeep] = React.useState(false)
  const [pending, setPending] = React.useState(false)
  const [localToday, setLocalToday] = React.useState<string>()
  const name = React.useId()
  const scope = value ?? inner
  const say = { ...RECURRENCE_MESSAGES, ...messages }
  const list = say.list

  React.useEffect(() => {
    if (todayProp) return
    const now = new Date()
    setLocalToday(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`)
  }, [todayProp])

  const today = todayProp ?? localToday
  const short = (o: Occurrence) => new Intl.DateTimeFormat(locale, { timeZone: "UTC", day: "numeric", month: "short" }).format(toDate(o.start))
  const long = (o: Occurrence) => new Intl.DateTimeFormat(locale, { timeZone: "UTC", weekday: "short", day: "numeric", month: "short" }).format(toDate(o.start))
  const isPast = (o: Occurrence) => !!today && o.start.slice(0, 10) < today
  const plural = say.count

  const affected = affectedOccurrences(occurrences, editingId, scope)
  const hits = overwrittenExceptions(affected, editingId, changes)
  const skip = keep ? hits.map((h) => h.occurrence.id) : []
  const changing = affected.filter((o) => !skip.includes(o.id))
  const affectedIds = new Set(changing.map((o) => o.id))
  const past = changing.filter(isPast).length
  const open = continues && scope !== "this"

  const select = (next: RecurrenceScopeValue) => {
    if (value === undefined) setInner(next)
    onValueChange?.(next)
  }
  const counts: Record<RecurrenceScopeValue, number> = Object.fromEntries(
    (["this", "following", "all"] as const).map((s) => [s, affectedOccurrences(occurrences, editingId, s).length])
  ) as Record<RecurrenceScopeValue, number>

  const first = changing[0]
  const last = changing[changing.length - 1]
  const readback = !first
    ? say.nothing
    : [
        changing.length === 1 ? say.changesOne(long(first), open) : say.changesRange(long(first), long(last), plural(changing.length)),
        open ? say.andAfter : "",
        past ? say.includingPast(past) : "",
        ". ",
        skip.length ? say.keeps(list(hits.map((h) => short(h.occurrence))), skip.length) : "",
      ].join("").trim()
  const fields = list([...new Set(hits.flatMap((h) => h.fields))].map((f) => fieldLabels[f] ?? f))
  const warning = hits.length && !keep
    ? overwriteText.replace("{dates}", list(hits.map((h) => short(h.occurrence)))).replace("{verb}", say.was(hits.length)).replace("{fields}", fields)
    : ""

  const confirm = async () => {
    if (!onConfirm) return
    setPending(true)
    try {
      await onConfirm(scope, { ids: changing.map((o) => o.id), skip })
    } catch {
      // The caller reports the failure; we only stop the spinner.
    } finally {
      setPending(false)
    }
  }

  return (
    <div data-slot="recurrence-scope" className={cn("grid w-full max-w-md gap-3 rounded-lg border bg-card p-4 text-card-foreground shadow-xs", className)} {...props}>
      <div className="flex items-center gap-2">
        <Repeat aria-hidden className="size-4 text-muted-foreground" />
        <p id={`${name}-title`} className="text-sm font-medium">
          {say.heading(title)}
        </p>
      </div>
      <div role="radiogroup" aria-labelledby={`${name}-title`} className="grid gap-1.5">
        {(["this", "following", "all"] as const).map((option) => (
          <label
            key={option}
            className={cn(
              "flex h-9 cursor-pointer items-center gap-2 rounded-md border px-3 text-sm transition-colors has-focus-visible:ring-[3px] has-focus-visible:ring-ring/50",
              scope === option ? "border-primary/60 bg-accent" : "hover:bg-accent/50"
            )}
          >
            <input type="radio" name={name} value={option} checked={scope === option} onChange={() => select(option)} className="size-4 accent-primary outline-none" />
            <span className="flex-1">{scopeLabels[option]}</span>
            <span className="text-xs text-muted-foreground tabular-nums">
              {counts[option]}
              {continues && option !== "this" ? "+" : ""}
            </span>
          </label>
        ))}
      </div>

      <div className="grid gap-2 rounded-md bg-muted/60 p-3">
        <p aria-live="polite" className="text-sm">
          {readback}
        </p>
        <ul aria-label={say.occurrences} className="flex flex-wrap gap-1">
          {occurrences.map((o) => {
            const on = affectedIds.has(o.id)
            const kept = skip.includes(o.id)
            return (
              <li
                key={o.id}
                data-affected={on ? "" : undefined}
                className={cn(
                  "rounded-md border px-1.5 py-0.5 text-xs tabular-nums transition-colors duration-200 ease-out motion-reduce:transition-none",
                  on ? "border-primary bg-primary text-primary-foreground" : "border-transparent bg-background text-muted-foreground",
                  kept && "border-dashed border-amber-500 bg-transparent text-amber-800 dark:text-amber-300",
                  isPast(o) && !on && "line-through decoration-muted-foreground/40",
                  o.id === editingId && "ring-2 ring-ring/60 ring-offset-1 ring-offset-muted"
                )}
              >
                <span className="sr-only">{on ? say.changing : kept ? say.kept : say.unchanged}</span>
                {short(o)}
                {o.overrides?.length ? <><span aria-hidden>*</span><span className="sr-only">{say.editedAlone}</span></> : null}
              </li>
            )
          })}
          {continues && <li className="px-1 py-0.5 text-xs text-muted-foreground">…</li>}
        </ul>
      </div>

      <div aria-live="polite" className="empty:hidden">
        {warning && (
          <p className="flex gap-1.5 text-xs text-amber-700 dark:text-amber-400">
            <span className="flex h-6 shrink-0 items-center">
              <TriangleAlert aria-hidden className="size-3.5" />
            </span>
            <span className="flex min-w-0 flex-wrap items-center gap-x-2">
              <span className="py-1">{warning}</span>
              <button
                type="button"
                onClick={() => setKeep(true)}
                className="inline-flex h-6 items-center gap-1 rounded-md border border-amber-500/40 px-2 font-medium text-amber-900 transition-colors hover:bg-amber-500/10 dark:text-amber-200 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                {keepLabel}
              </button>
            </span>
          </p>
        )}
        {keep && hits.length > 0 && (
          <button type="button" onClick={() => setKeep(false)} className="text-xs text-muted-foreground underline underline-offset-2 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50">
            {say.overwriteAnyway}
          </button>
        )}
      </div>

      <div className="flex justify-end gap-2">
        {onCancel && (
          <button type="button" onClick={onCancel} className={cn(action, "border bg-background shadow-xs hover:bg-accent")}>
            {cancelLabel}
          </button>
        )}
        <button type="button" onClick={confirm} disabled={pending || !changing.length} className={cn(action, "bg-primary text-primary-foreground hover:bg-primary/90")}>
          {pending && <LoaderCircle aria-hidden className="size-4 animate-spin" />}
          {saveLabel.replace("{count}", plural(changing.length))}
        </button>
      </div>
    </div>
  )
}
