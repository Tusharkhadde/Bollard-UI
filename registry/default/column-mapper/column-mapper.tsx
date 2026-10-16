"use client"

import * as React from "react"
import { ArrowLeftRight, CalendarDays, CircleAlert, CircleCheck } from "lucide-react"

import { cn } from "@/lib/utils"
import {
  checkMapping, columnLetter as letter, detectDateOrder, readDate, resolveMapping, COMMON_FIRST_NAMES,
  type ColumnTarget, type DateOrder, type MapperColumn, type MapperField, type MappingIssue, type ValueKind,
} from "./column-sniff"

export {
  checkMapping, columnLetter, detectDateOrder, readDate, resolveMapping, sniffColumn, sniffValue, COMMON_FIRST_NAMES,
  type ColumnTarget, type DateOrder, type MapperColumn, type MapperField, type MappingIssue, type ValueKind,
} from "./column-sniff"

const DEFAULT_MESSAGES = {
  columns: "Columns",
  skip: "Don't import",
  empty: "Empty column",
  swap: "Looks swapped with column {other}: this one holds {kind}.",
  swapFix: "Swap them",
  kind: "These look like {kind}, not {field}.",
  kindFix: "Map to {field}",
  keep: "Keep as is",
  duplicate: "{field} is already coming from column {other}.",
  duplicateFix: "Don't import this one",
  missing: "{field} isn't mapped yet.",
  missingFix: "Use column {letter}",
  dateAmbiguous: "Every date fits both orders, like {example}. Which is it?",
  dateMixed: "Some dates only work as DD/MM ({dmy}), others only as MM/DD ({mdy}). Fix the file first.",
  dateWrong: "{example} can only be {detected}.",
  dateFix: "Use {detected}",
  dateRead: "Read as {order}: {example} is {readback}",
  dateSwitch: "Switch",
  dmy: "DD/MM",
  mdy: "MM/DD",
  requiredMark: " *",
  months: "Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec",
  ok: "Mapping looks right.",
  toCheck: "{count} to check before importing.",
  continue: "Continue",
  continueBlocked: "Fix {count} first",
  kinds: { email: "email addresses", phone: "phone numbers", date: "dates", number: "numbers", "first-name": "first names", "last-name": "last names", text: "text" } as Record<ValueKind, string>,
}
export type ColumnMapperMessages = typeof DEFAULT_MESSAGES

const fill = (t: string, v: Record<string, string | number>) => t.replace(/\{(\w+)\}/g, (_, k) => String(v[k] ?? ""))
const keyOf = (i: MappingIssue) => JSON.stringify(i)
const columnOf = (i: MappingIssue) => (i.type === "swap" || i.type === "duplicate" ? i.columns[0] : i.type === "missing" ? i.suggest ?? -1 : i.column)

const select = "h-9 w-full min-w-0 rounded-md border bg-background px-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30 data-warning:border-amber-500 dark:data-warning:border-amber-400"
const fix = "inline-flex h-6 items-center gap-1 rounded-md border border-amber-500/40 px-2 font-medium text-amber-900 transition-colors hover:bg-amber-500/10 dark:text-amber-200 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
const quiet = "inline-flex h-6 items-center rounded-md px-1.5 font-medium underline-offset-2 hover:underline outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"

export interface ColumnMapperProps extends Omit<React.ComponentProps<"div">, "defaultValue" | "children"> {
  /** The spreadsheet's columns, each with its heading and a sample of values. */
  columns: MapperColumn[]
  /** The fields you import into. `kind` drives the swap and date checks. */
  fields: MapperField[]
  /** Controlled mapping, one entry per column. */
  value?: ColumnTarget[]
  /** Initial mapping when uncontrolled (e.g. your auto-match or last saved mapping). */
  defaultValue?: ColumnTarget[]
  /** Called with the mapping on every change. */
  onValueChange?: (value: ColumnTarget[]) => void
  /** Shows a Continue button; receives the mapping with every date order filled in. */
  onContinue?: (value: ColumnTarget[]) => void
  /** First names used to spot swapped first/last name columns. */
  firstNames?: string[]
  /** Every visible string, for copy changes and translation. */
  messages?: Partial<ColumnMapperMessages>
}

/**
 * Checks a column mapping against the values themselves before an import goes
 * wrong: emails sitting in the phone column, first and last names swapped,
 * DD/MM read as MM/DD (with a readback of what a date will become), the same
 * field picked twice and required fields left unmapped, each with a one-tap fix.
 */
export function ColumnMapper({
  columns, fields: rawFields, value, defaultValue, onValueChange, onContinue, firstNames = COMMON_FIRST_NAMES, messages, className, ...props
}: ColumnMapperProps) {
  const t = { ...DEFAULT_MESSAGES, ...messages, kinds: { ...DEFAULT_MESSAGES.kinds, ...messages?.kinds } }
  const cols = Array.isArray(columns) ? columns : []
  const fields = (Array.isArray(rawFields) ? rawFields : []).filter((f) => f && typeof f.key === "string")
  const [inner, setInner] = React.useState<ColumnTarget[]>(Array.isArray(defaultValue) ? defaultValue : [])
  const source = Array.isArray(value) ? value : inner
  const mapping = cols.map((_, c) => (source[c] && typeof source[c] === "object" ? source[c] : { field: null }))
  const [kept, setKept] = React.useState<string[]>([])
  const issues = checkMapping(cols, fields, mapping, firstNames).filter((i) => !kept.includes(keyOf(i)))
  const refs = React.useRef<(HTMLElement | null)[]>([])
  const focusLater = (c: number, sel = "select") => requestAnimationFrame(() => refs.current[c]?.querySelector<HTMLElement>(sel)?.focus())
  const id = React.useId()
  const label = (key: string) => fields.find((f) => f.key === key)?.label ?? key
  const months = t.months.split(" ")

  const update = (next: ColumnTarget[]) => {
    if (value === undefined) setInner(next)
    onValueChange?.(next)
  }
  const set = (patch: Record<number, Partial<ColumnTarget>>, focus?: number, sel?: string) => {
    update(mapping.map((m, c) => (c in patch ? { ...m, ...patch[c] } : m)))
    if (focus !== undefined) focusLater(focus, sel)
  }
  const keep = (i: MappingIssue) => {
    setKept([...kept, keyOf(i)])
    focusLater(columnOf(i))
  }

  const summary = issues.length ? fill(t.toCheck, { count: issues.length }) : t.ok
  const [announced, setAnnounced] = React.useState(summary)
  React.useEffect(() => {
    const timer = setTimeout(() => setAnnounced(summary), 600)
    return () => clearTimeout(timer)
  }, [summary])

  const readback = (example: string, order: DateOrder) => {
    const r = readDate(example, order)
    return r ? `${r.day} ${months[r.month - 1] ?? "?"} ${r.year}` : example
  }

  const warn = (body: React.ReactNode, key: string) => (
    <p key={key} className="flex gap-1.5 text-xs text-amber-700 dark:text-amber-400">
      <span className="flex h-6 shrink-0 items-center"><CircleAlert aria-hidden className="size-3.5" /></span>
      <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">{body}</span>
    </p>
  )

  const rowIssue = (i: MappingIssue, c: number) => {
    const k = keyOf(i)
    if (i.type === "swap") {
      const [a, b] = i.columns
      const other = c === a ? b : a
      return warn(<>
        <span className="py-1">{fill(t.swap, { other: letter(other), kind: t.kinds[c === a ? i.looksLike[0] : i.looksLike[1]] })}</span>
        <button type="button" className={fix} onClick={() => set({ [a]: { field: i.fields[1] }, [b]: { field: i.fields[0] } }, c)}>
          <ArrowLeftRight aria-hidden className="size-3.5" />{t.swapFix}
        </button>
        <button type="button" className={quiet} onClick={() => keep(i)}>{t.keep}</button>
      </>, k)
    }
    if (i.type === "kind") return warn(<>
      <span className="py-1">{fill(t.kind, { kind: t.kinds[i.looksLike], field: label(i.field) })}</span>
      {i.suggest && <button type="button" className={fix} onClick={() => set({ [c]: { field: i.suggest } }, c)}>{fill(t.kindFix, { field: label(i.suggest) })}</button>}
      <button type="button" className={quiet} onClick={() => keep(i)}>{t.keep}</button>
    </>, k)
    if (i.type === "duplicate") return c === i.keep ? null : warn(<>
      <span className="py-1">{fill(t.duplicate, { field: label(i.field), other: letter(i.keep) })}</span>
      <button type="button" className={fix} onClick={() => set({ [c]: { field: null } }, c)}>{t.duplicateFix}</button>
    </>, k)
    if (i.type === "date-mixed") return warn(<>
      <span className="py-1">{fill(t.dateMixed, { dmy: i.dmyExample, mdy: i.mdyExample })}</span>
      <button type="button" className={quiet} onClick={() => set({ [c]: { field: null } }, c)}>{t.skip}</button>
    </>, k)
    if (i.type === "date-wrong") return warn(<>
      <span className="py-1">{fill(t.dateWrong, { example: i.example, detected: t[i.detected] })}</span>
      <button type="button" className={fix} onClick={() => set({ [c]: { dateOrder: i.detected } }, c, "[data-date-switch]")}>{fill(t.dateFix, { detected: t[i.detected] })}</button>
    </>, k)
    if (i.type === "date-ambiguous") return warn(<>
      <span className="py-1">{fill(t.dateAmbiguous, { example: i.example })}</span>
      {(["dmy", "mdy"] as const).map((o) => (
        <button key={o} type="button" className={fix} onClick={() => set({ [c]: { dateOrder: o } }, c, "[data-date-switch]")}>{t[o]}</button>
      ))}
    </>, k)
    return null
  }

  const blocking = issues.length
  return (
    <div
      data-slot="column-mapper"
      role="group"
      className={cn("@container grid w-full max-w-md gap-3 text-sm", className)}
      {...props}
      aria-describedby={cn(props["aria-describedby"], `${id}-summary`) || undefined}
    >
      {issues.filter((i) => i.type === "missing").map((i) => i.type === "missing" && warn(<>
        <span className="py-1">{fill(t.missing, { field: label(i.field) })}</span>
        {i.suggest !== undefined && (
          <button type="button" className={fix} onClick={() => set({ [i.suggest as number]: { field: i.field } }, i.suggest)}>
            {fill(t.missingFix, { letter: letter(i.suggest) })} ({cols[i.suggest]?.heading || letter(i.suggest)})
          </button>
        )}
      </>, keyOf(i)))}

      <ul aria-label={t.columns} className="divide-y rounded-lg border">
        {cols.map((col, c) => {
          const m = mapping[c]
          const field = fields.find((f) => f.key === m.field)
          const mine = issues.filter((i) => i.type !== "missing" && (i.type === "swap" || i.type === "duplicate" ? i.columns.includes(c) : i.column === c))
          const shown = mine.map((i) => rowIssue(i, c)).filter(Boolean)
          const dates = field?.kind === "date" && !mine.some((i) => i.type.startsWith("date")) ? detectDateOrder(col?.values ?? []) : null
          const order = m.dateOrder ?? (dates && dates.order !== "mixed" && dates.order !== "ambiguous" ? dates.order : undefined)
          const values = (col?.values ?? []).map((v) => String(v ?? "").trim()).filter(Boolean)
          return (
            <li key={c} ref={(el) => { refs.current[c] = el }} className="grid gap-x-3 gap-y-1.5 px-3 py-2.5 @[22rem]:grid-cols-[minmax(0,1fr)_10rem]">
              <div className="min-w-0">
                <label htmlFor={`${id}-${c}`} className="flex min-w-0 items-baseline gap-1.5 font-medium">
                  <span className="text-xs font-normal text-muted-foreground tabular-nums">{letter(c)}</span>
                  <span className="truncate">{col?.heading || letter(c)}</span>
                </label>
                <span className="block truncate text-xs text-muted-foreground">{values.slice(0, 3).join(" · ") || t.empty}</span>
              </div>
              <select
                id={`${id}-${c}`}
                value={m.field ?? ""}
                onChange={(e) => set({ [c]: { field: e.target.value || null } })}
                aria-describedby={shown.length || order ? `${id}-${c}-note` : undefined}
                data-warning={shown.length ? "" : undefined}
                className={select}
              >
                <option value="">{t.skip}</option>
                {fields.map((f) => <option key={f.key} value={f.key}>{f.label}{f.required ? t.requiredMark : ""}</option>)}
              </select>
              {(shown.length > 0 || (order && dates)) && (
                <div id={`${id}-${c}-note`} className="grid gap-1 @[22rem]:col-span-2">
                  {shown}
                  {order && dates && dates.order !== "mixed" && (
                    <p className="flex flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground">
                      <CalendarDays aria-hidden className="size-3.5 shrink-0" />
                      <span className="py-1">{fill(t.dateRead, { order: t[order], example: dates.example, readback: readback(dates.example, order) })}</span>
                      <button type="button" data-date-switch className={quiet} onClick={() => set({ [c]: { dateOrder: order === "dmy" ? "mdy" : "dmy" } }, c, "[data-date-switch], select")}>{t.dateSwitch}</button>
                    </p>
                  )}
                </div>
              )}
            </li>
          )
        })}
      </ul>

      <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-2">
        <p id={`${id}-summary`} className={cn("mr-auto flex items-center gap-1.5 text-xs", blocking ? "text-amber-700 dark:text-amber-400" : "text-muted-foreground")}>
          {blocking ? <CircleAlert aria-hidden className="size-3.5 shrink-0" /> : <CircleCheck aria-hidden className="size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />}
          {summary}
        </p>
        <span className="sr-only" aria-live="polite">{announced}</span>
        {onContinue && (
          <button
            type="button"
            aria-describedby={`${id}-summary`}
            onClick={() => (blocking ? focusLater(Math.max(0, columnOf(issues[0]))) : onContinue(resolveMapping(cols, mapping)))}
            className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow-xs transition-colors outline-none hover:bg-primary/90 focus-visible:ring-[3px] focus-visible:ring-ring/50 data-blocked:opacity-60"
            data-blocked={blocking ? "" : undefined}
          >
            {blocking ? fill(t.continueBlocked, { count: blocking }) : t.continue}
          </button>
        )}
      </div>
    </div>
  )
}
