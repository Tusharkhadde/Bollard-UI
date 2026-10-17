"use client"

// Bollard UI — repeat-rows · MIT licence · https://bollard-ui.vercel.app/components/repeat-rows

import * as React from "react"
import { Eraser, Plus, TriangleAlert, Undo2, X } from "lucide-react"

import { cn } from "@/lib/utils"

export interface RepeatField {
  /** Key in each row object. */
  name: string
  /** Column label. */
  label: string
  placeholder?: string
  type?: "text" | "email" | "number" | "tel"
  /** Width classes for this column, e.g. "w-20 flex-none". Defaults to an equal share. */
  className?: string
}

export type RepeatRow = Record<string, string>

/** True when every field in the row is blank. */
export const isEmptyRow = (row: RepeatRow, fields: RepeatField[]) => fields.every((f) => !(row[f.name] ?? "").trim())

/** The rows worth submitting: blank rows dropped. */
export const cleanRows = (rows: RepeatRow[], fields: RepeatField[]) => rows.filter((row) => !isEmptyRow(row, fields))

/** Maps each later duplicate's index to the first row it repeats, comparing `keys` case- and space-insensitively. */
export function findDuplicates(rows: RepeatRow[], keys: string[]) {
  const seen = new Map<string, number>()
  const dupes = new Map<number, number>()
  rows.forEach((row, i) => {
    const parts = keys.map((k) => (row[k] ?? "").trim().toLowerCase().replace(/\s+/g, " "))
    if (parts.every((p) => !p)) return
    const key = parts.join("\u0000")
    if (seen.has(key)) dupes.set(i, seen.get(key) as number)
    else seen.set(key, i)
  })
  return dupes
}

export interface RepeatRowsProps extends Omit<React.ComponentProps<"fieldset">, "defaultValue" | "onChange"> {
  /** Legend for the group. */
  label: string
  /** The columns in each row. */
  fields: RepeatField[]
  /** Controlled rows. */
  value?: RepeatRow[]
  /** Initial rows when uncontrolled. */
  defaultValue?: RepeatRow[]
  /** Called with every row, blanks included. Use `cleanRows` before saving. */
  onValueChange?: (rows: RepeatRow[]) => void
  /** Fewest rows; remove is disabled at this count. */
  min?: number
  /** Most rows; add is disabled at this count. */
  max?: number
  /** Fields that make two rows the same thing, e.g. `["email"]`. */
  uniqueBy?: string[]
  /** What one row is, e.g. "Guest". */
  itemLabel?: string
  /** How long Undo stays after a remove, in ms. */
  undoMs?: number
  /** Label of the add-row button. */
  addLabel?: string
  /** Label of the Undo button after a remove. */
  undoLabel?: string
  /** Templates: `{item}`, `{n}`, `{max}` and `{count}` are filled in. */
  duplicateText?: string
  /** Label of the one-tap remove on a duplicate row. */
  removeDuplicateLabel?: string
  /** Shown when blank rows would be submitted. */
  emptyText?: string
  /** Label of the button that removes blank rows. */
  cleanLabel?: string
  /** Shown when the maximum number of rows is reached. */
  maxText?: string
}

const fieldClass =
  "h-9 w-full min-w-0 rounded-md border bg-transparent px-3 text-base shadow-xs transition-[color,box-shadow] outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 md:text-sm dark:bg-input/30 data-warning:border-amber-500 dark:data-warning:border-amber-400"
const fixClass =
  "inline-flex h-6 items-center gap-1 rounded-md border border-amber-500/40 px-2 font-medium text-amber-900 transition-colors hover:bg-amber-500/10 dark:text-amber-200 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
const ghost = "grid size-9 shrink-0 place-items-center rounded-md text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-40"
const fill = (t: string, v: Record<string, string | number>) => t.replace(/\{(\w+)\}/g, (m, k: string) => String(v[k] ?? m))

/**
 * A repeatable group of fields (line items, guests) that keeps rows honest:
 * min and max with a stated limit, Undo in place after a remove, duplicate rows
 * flagged with a one-tap remove, blank rows called out before submit, Enter
 * that adds a row instead of submitting the form, and focus that always lands
 * somewhere sensible.
 */
export function RepeatRows({
  label,
  fields,
  value,
  defaultValue,
  onValueChange,
  min = 1,
  max = Infinity,
  uniqueBy,
  itemLabel = "Item",
  undoMs = 5000,
  addLabel = "Add {item}",
  undoLabel = "Undo",
  duplicateText = "Same as {item} {n}.",
  removeDuplicateLabel = "Remove this one",
  emptyText = "{count} blank {rows} will be skipped.",
  cleanLabel = "Remove blank rows",
  maxText = "That's the limit of {max}.",
  className,
  ...props
}: RepeatRowsProps) {
  const blank = React.useCallback(() => Object.fromEntries(fields.map((f) => [f.name, ""])), [fields])
  const [inner, setInner] = React.useState<RepeatRow[]>(() => defaultValue ?? Array.from({ length: Math.max(min, 1) }, blank))
  const rows = value ?? inner
  const prefix = React.useId()
  const seq = React.useRef(0)
  const newKey = () => `${prefix}${++seq.current}`
  const keys = React.useRef<string[]>([])
  while (keys.current.length < rows.length) keys.current.push(newKey())
  keys.current.length = rows.length
  const [removed, setRemoved] = React.useState<{ key: string; row: RepeatRow; index: number }>()
  const [justAdded, setJustAdded] = React.useState<string>()
  const [announcement, setAnnouncement] = React.useState("")
  const root = React.useRef<HTMLFieldSetElement>(null)
  const focusNext = React.useRef<string>(undefined)
  const item = itemLabel.toLowerCase()

  const update = (next: RepeatRow[], nextKeys: string[], focusKey?: string) => {
    keys.current = nextKeys
    focusNext.current = focusKey
    if (value === undefined) setInner(next)
    onValueChange?.(next)
  }

  React.useEffect(() => {
    if (!focusNext.current) return
    const target = focusNext.current === "add" ? "[data-add]" : focusNext.current === "undo" ? "[data-undo]" : `[data-row="${focusNext.current}"] input`
    root.current?.querySelector<HTMLElement>(target)?.focus()
    focusNext.current = undefined
  })

  // Undo window: when it closes, focus moves on from the placeholder if it had it.
  React.useEffect(() => {
    if (!removed) return
    const timer = setTimeout(() => {
      const hadFocus = root.current?.querySelector("[data-undo]") === document.activeElement
      setRemoved(undefined)
      if (hadFocus) focusNext.current = keys.current[removed.index] ?? "add"
    }, undoMs)
    return () => clearTimeout(timer)
  }, [removed, undoMs])

  const add = () => {
    if (rows.length >= max) return
    const key = newKey()
    update([...rows, blank()], [...keys.current, key], key)
    setJustAdded(key)
    setAnnouncement(`${itemLabel} ${rows.length + 1} added.`)
  }
  const remove = (index: number) => {
    if (rows.length <= min) return
    const key = keys.current[index]
    setRemoved({ key, row: rows[index], index })
    update(rows.filter((_, i) => i !== index), keys.current.filter((_, i) => i !== index), "undo")
    setAnnouncement(`${itemLabel} ${index + 1} removed. ${undoLabel} is available.`)
  }
  const undo = () => {
    if (!removed || rows.length >= max) return
    const at = Math.min(removed.index, rows.length)
    update([...rows.slice(0, at), removed.row, ...rows.slice(at)], [...keys.current.slice(0, at), removed.key, ...keys.current.slice(at)], removed.key)
    setRemoved(undefined)
    setAnnouncement(`${itemLabel} ${at + 1} restored.`)
  }
  const edit = (index: number, name: string, text: string) => update(rows.map((r, i) => (i === index ? { ...r, [name]: text } : r)), keys.current)

  const dupes = uniqueBy?.length ? findDuplicates(rows, uniqueBy) : new Map<number, number>()
  // The row just added is about to be filled in, so it isn't nagged about. Not tied to focus, so
  // nothing shifts under the pointer when focus leaves a row.
  const blanks = rows.map((_, i) => i).filter((i) => isEmptyRow(rows[i], fields) && keys.current[i] !== justAdded && rows.length > 1)
  const removeBlanks = () => {
    // Keep just enough blank rows to stay at `min`.
    let spare = Math.max(min - (rows.length - blanks.length), 0)
    const keep = rows.map((_, i) => !blanks.includes(i) || spare-- > 0)
    update(rows.filter((_, i) => keep[i]), keys.current.filter((_, i) => keep[i]), "add")
  }

  const placeholder = removed && (
    <div key={`removed-${removed.key}`} className="relative flex h-9 items-center gap-2 overflow-hidden rounded-md border border-dashed px-3 text-sm text-muted-foreground">
      <style>{"@keyframes cui-repeat-rows-drain{from{transform:scaleX(1)}to{transform:scaleX(0)}}"}</style>
      <span className="min-w-0 flex-1 truncate">
        Removed {Object.values(removed.row).find((v) => v.trim()) ? `“${Object.values(removed.row).filter((v) => v.trim()).join(", ")}”` : `blank ${item}`}
      </span>
      <button data-undo type="button" onClick={undo} disabled={rows.length >= max} className="inline-flex h-7 items-center gap-1 rounded-md px-2 font-medium text-foreground outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50">
        <Undo2 aria-hidden className="size-4" />
        {undoLabel}
      </button>
      <span
        aria-hidden
        className="absolute inset-x-0 bottom-0 h-0.5 origin-left bg-foreground/30 motion-reduce:hidden"
        style={{ animation: `cui-repeat-rows-drain ${undoMs}ms linear forwards` }}
      />
    </div>
  )

  return (
    <fieldset ref={root} data-slot="repeat-rows" className={cn("grid w-full max-w-md min-w-0 gap-2", className)} {...props}>
      <legend className="mb-1.5 text-sm font-medium">{label}</legend>
      <div aria-hidden className="flex gap-2 pr-11 text-xs text-muted-foreground">
        {fields.map((f) => (
          <span key={f.name} className={cn("min-w-0 flex-1 truncate", f.className)}>
            {f.label}
          </span>
        ))}
      </div>
      {rows.map((row, index) => {
        const key = keys.current[index]
        const dupeOf = dupes.get(index)
        return (
          <React.Fragment key={key}>
            {removed?.index === index && placeholder}
            <div data-row={key} role="group" aria-label={`${itemLabel} ${index + 1} of ${rows.length}`}>
              <div className="flex items-center gap-2">
                {fields.map((f, fi) => (
                  <input
                    key={f.name}
                    type={f.type ?? "text"}
                    value={row[f.name] ?? ""}
                    placeholder={f.placeholder}
                    aria-label={`${f.label}, ${item} ${index + 1}`}
                    data-warning={dupeOf !== undefined ? "" : undefined}
                    onChange={(e) => edit(index, f.name, e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key !== "Enter") return
                      e.preventDefault() // Enter inside a row should never submit the whole form.
                      if (fi < fields.length - 1) return
                      if (index < rows.length - 1) root.current?.querySelector<HTMLElement>(`[data-row="${keys.current[index + 1]}"] input`)?.focus()
                      else if (!isEmptyRow(row, fields)) add()
                    }}
                    className={cn(fieldClass, "flex-1", f.className)}
                  />
                ))}
                <button type="button" onClick={() => remove(index)} disabled={rows.length <= min} aria-label={`Remove ${item} ${index + 1}`} title={rows.length <= min ? `At least ${min} needed` : undefined} className={ghost}>
                  <X aria-hidden className="size-4" />
                </button>
              </div>
              {dupeOf !== undefined && (
                <p className="mt-1.5 flex gap-1.5 text-xs text-amber-700 dark:text-amber-400" aria-live="polite">
                  <span className="flex h-6 shrink-0 items-center">
                    <TriangleAlert aria-hidden className="size-3.5" />
                  </span>
                  <span className="flex min-w-0 flex-wrap items-center gap-x-2">
                    <span className="py-1">{fill(duplicateText, { item, n: dupeOf + 1 })}</span>
                    <button type="button" onClick={() => remove(index)} className={fixClass}>
                      {removeDuplicateLabel}
                    </button>
                  </span>
                </p>
              )}
            </div>
          </React.Fragment>
        )
      })}
      {removed && removed.index >= rows.length && placeholder}

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <button
          data-add
          type="button"
          onClick={add}
          disabled={rows.length >= max}
          className="inline-flex h-8 items-center gap-1.5 rounded-md border bg-background px-3 text-sm font-medium shadow-xs outline-none transition-colors hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 dark:bg-input/30"
        >
          <Plus aria-hidden className="size-4" />
          {fill(addLabel, { item })}
        </button>
        <span className="text-xs text-muted-foreground tabular-nums">
          {rows.length >= max ? fill(maxText, { max }) : Number.isFinite(max) ? `${rows.length} of ${max}` : null}
        </span>
      </div>
      {blanks.length > 0 && (
        <p className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
          <Eraser aria-hidden className="size-3.5" />
          <span className="py-1">{fill(emptyText, { count: blanks.length, rows: blanks.length === 1 ? "row" : "rows" })}</span>
          <button type="button" onClick={removeBlanks} className="h-6 rounded-md px-1.5 font-medium text-foreground underline-offset-2 outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50">
            {cleanLabel}
          </button>
        </p>
      )}
      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>
    </fieldset>
  )
}
