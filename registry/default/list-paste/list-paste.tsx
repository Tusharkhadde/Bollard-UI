"use client"

import * as React from "react"
import { CircleCheck, CircleX, CopyX, Undo2 } from "lucide-react"

import { cn } from "@/lib/utils"

export type ListEntryStatus = "valid" | "duplicate" | "invalid"

export interface ListEntry {
  /** The item as it will be imported (unwrapped from `Name <…>`, quotes and invisible characters). */
  value: string
  /** The text as pasted, used for display. */
  raw: string
  /** 1-based line number in the textarea. */
  line: number
  status: ListEntryStatus
  /** Why it's invalid, or which line it repeats. */
  reason?: string
}

/** Return `true` when valid, or a short reason ("not an email") when not. */
export type ListValidator = (value: string) => true | string

/** A pragmatic email check: one @, a dotted domain, no spaces. */
export const emailValidator: ListValidator = (value) =>
  /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/.test(value) ? true : "not an email address"

/**
 * Splits a pasted list on new lines, commas, semicolons and tabs, but not inside
 * quotes or angle brackets, so `"Shah, Priya" <priya@acme.in>` stays one item.
 */
export function splitList(text: string): { raw: string; line: number }[] {
  const out: { raw: string; line: number }[] = []
  let current = ""
  let line = 1
  let start = 1
  let quoted = false
  let angled = false
  const flush = () => {
    if (current.trim()) out.push({ raw: current.trim(), line: start })
    current = ""
    start = line
  }
  for (const char of text) {
    if (char === '"') quoted = !quoted
    if (char === "<") angled = true
    if (char === ">") angled = false
    if (char === "\n") {
      quoted = angled = false
      line++
      flush()
    } else if (/[,;\t]/.test(char) && !quoted && !angled) flush()
    else current += char
  }
  flush()
  return out
}

/** Strips zero-width characters, non-breaking spaces, wrapping quotes, `mailto:` and `Name <…>`. */
export function cleanItem(raw: string) {
  const text = raw.replace(/[\u200B-\u200D\uFEFF]/g, "").replace(/\u00A0/g, " ").trim()
  const inner = /<([^<>]+)>\s*$/.exec(text)?.[1] ?? text
  return inner.replace(/^mailto:/i, "").replace(/^["'`]+|["'`]+$/g, "").trim()
}

/** Splits, cleans, validates and de-duplicates a pasted list. The first copy of a repeat counts as valid. */
export function parseList(
  text: string,
  validate: ListValidator,
  key: (value: string) => string = (value) => value.toLowerCase(),
): ListEntry[] {
  const seen = new Map<string, number>()
  return splitList(text).map(({ raw, line }, index) => {
    const value = cleanItem(raw)
    const verdict = validate(value)
    if (verdict !== true) {
      const header = index === 0 && /^(e-?mail|emails|email address|name|id|sku|code)s?$/i.test(value)
      return { value, raw, line, status: "invalid", reason: header ? "header row" : verdict }
    }
    const first = seen.get(key(value))
    if (first !== undefined) return { value, raw, line, status: "duplicate", reason: `repeats line ${first}` }
    seen.set(key(value), line)
    return { value, raw, line, status: "valid" }
  })
}

export interface ListPasteProps extends Omit<React.ComponentProps<"textarea">, "value" | "defaultValue" | "onChange"> {
  /** Visible label. */
  label?: string
  /** Controlled text. */
  value?: string
  /** Initial text when uncontrolled. */
  defaultValue?: string
  /** Called with the text on every change, including one-tap clean-ups. */
  onValueChange?: (value: string) => void
  /** Checks one item. Defaults to an email check. */
  validate?: ListValidator
  /** Maps an item to the key used to spot duplicates. Defaults to lowercase. */
  compareKey?: (value: string) => string
  /** Receives the valid, de-duplicated items. Omit to hide the import button. */
  onImport?: (items: string[]) => void
  /** Most problem lines listed before "and N more". */
  maxProblems?: number
  /** Import button label; `{count}` is filled in. */
  importLabel?: string
  /** Count labels; `{count}` is filled in and `(s)` is dropped for one. */
  validLabel?: string
  /** Label of the duplicate count. */
  duplicatesLabel?: string
  /** Label of the invalid count. */
  invalidLabel?: string
  /** Label of the one-tap clean-up buttons. */
  removeLabel?: string
  /** Label of the button that restores the text before a clean-up. */
  undoLabel?: string
}

const plural = (template: string, count: number) => template.replace("{count}", String(count)).replace(/\((\w+)\)/, count === 1 ? "" : "$1")

/**
 * A paste box for lists of emails, IDs or SKUs before an import or invite. It splits on
 * new lines, commas, semicolons and tabs (keeping `"Shah, Priya" <…>` whole), unwraps names
 * and invisible characters, counts valid, duplicate and invalid items, and says which line
 * is wrong and why. One tap removes the bad ones, and Undo brings them back.
 */
export function ListPaste({
  label = "Paste a list",
  value,
  defaultValue = "",
  onValueChange,
  validate = emailValidator,
  compareKey,
  onImport,
  maxProblems = 4,
  importLabel = "Import {count}",
  validLabel = "{count} valid",
  duplicatesLabel = "{count} duplicate(s)",
  invalidLabel = "{count} invalid",
  removeLabel = "Remove",
  undoLabel = "Undo",
  id,
  className,
  ...props
}: ListPasteProps) {
  const [inner, setInner] = React.useState(defaultValue)
  const [undo, setUndo] = React.useState<string>()
  const autoId = React.useId()
  const inputId = id ?? autoId
  const text = value ?? inner
  const entries = React.useMemo(() => parseList(text, validate, compareKey), [text, validate, compareKey])
  const count = (status: ListEntryStatus) => entries.filter((entry) => entry.status === status).length
  const [valid, duplicates, invalid] = [count("valid"), count("duplicate"), count("invalid")]
  const problems = entries.filter((entry) => entry.status !== "valid")

  const update = (next: string) => {
    if (value === undefined) setInner(next)
    onValueChange?.(next)
  }
  const remove = (status: ListEntryStatus) => {
    setUndo(text)
    update(entries.filter((entry) => entry.status !== status).map((entry) => entry.raw).join("\n"))
  }

  const chip = "inline-flex h-6 items-center gap-1 rounded-md px-2 font-medium"
  const removeClass =
    "inline-flex h-6 items-center rounded-md border px-2 font-medium transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"

  return (
    <div data-slot="list-paste" className={cn("grid w-full max-w-sm gap-1.5", className)}>
      <label htmlFor={inputId} className="w-fit text-sm font-medium">
        {label}
      </label>
      <textarea
        id={inputId}
        value={text}
        onChange={(event) => {
          setUndo(undefined)
          update(event.target.value)
        }}
        spellCheck={false}
        aria-describedby={`${inputId}-summary`}
        className="min-h-28 w-full min-w-0 resize-y rounded-md border bg-transparent px-3 py-2 font-mono text-base shadow-xs transition-[color,box-shadow] outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 md:text-sm dark:bg-input/30"
        {...props}
      />
      <div id={`${inputId}-summary`} aria-live="polite" className="grid gap-1.5 text-xs">
        {entries.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span data-count="valid" className={cn(chip, "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400")}>
              <CircleCheck aria-hidden className="size-3.5" />
              {plural(validLabel, valid)}
            </span>
            {duplicates > 0 && (
              <span className="inline-flex items-center gap-1">
                <span data-count="duplicate" className={cn(chip, "bg-amber-500/10 text-amber-700 dark:text-amber-400")}>
                  <CopyX aria-hidden className="size-3.5" />
                  {plural(duplicatesLabel, duplicates)}
                </span>
                <button type="button" onClick={() => remove("duplicate")} aria-label={`${removeLabel} ${plural(duplicatesLabel, duplicates)}`} className={cn(removeClass, "border-amber-500/40 text-amber-900 hover:bg-amber-500/10 dark:text-amber-200")}>
                  {removeLabel}
                </button>
              </span>
            )}
            {invalid > 0 && (
              <span className="inline-flex items-center gap-1">
                <span data-count="invalid" className={cn(chip, "bg-red-500/10 text-red-700 dark:text-red-400")}>
                  <CircleX aria-hidden className="size-3.5" />
                  {plural(invalidLabel, invalid)}
                </span>
                <button type="button" onClick={() => remove("invalid")} aria-label={`${removeLabel} ${plural(invalidLabel, invalid)}`} className={cn(removeClass, "border-red-500/40 text-red-800 hover:bg-red-500/10 dark:text-red-200")}>
                  {removeLabel}
                </button>
              </span>
            )}
            {undo !== undefined && (
              <button type="button" onClick={() => { update(undo); setUndo(undefined) }} className={cn(removeClass, "gap-1 hover:bg-accent")}>
                <Undo2 aria-hidden className="size-3.5" />
                {undoLabel}
              </button>
            )}
          </div>
        )}
        {problems.length > 0 && (
          <ul className="grid gap-0.5 text-muted-foreground">
            {problems.slice(0, maxProblems).map((entry) => (
              <li key={`${entry.line}-${entry.raw}`} className="flex min-w-0 gap-1.5">
                <span className="shrink-0 tabular-nums">Line {entry.line}</span>
                <span className={cn("truncate font-mono", entry.status === "invalid" ? "text-red-700 dark:text-red-400" : "text-amber-700 dark:text-amber-400")}>{entry.raw}</span>
                <span className="shrink-0">· {entry.reason}</span>
              </li>
            ))}
            {problems.length > maxProblems && <li>and {problems.length - maxProblems} more</li>}
          </ul>
        )}
        {onImport && (
          <button
            type="button"
            disabled={valid === 0}
            onClick={() => onImport(entries.filter((entry) => entry.status === "valid").map((entry) => entry.value))}
            className="mt-1.5 inline-flex h-9 w-fit items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow-xs transition-colors hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-50 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            {plural(importLabel, valid)}
          </button>
        )}
      </div>
    </div>
  )
}
