"use client"

import * as React from "react"
import { CircleCheck, TriangleAlert } from "lucide-react"

import { cn } from "@/lib/utils"
import { checkYaml, fixYaml, type YamlIssue, type YamlMistake } from "./yaml-rules"

export { checkYaml, fixYaml, readsAs } from "./yaml-rules"
export type { YamlEdit, YamlIssue, YamlMistake } from "./yaml-rules"

const DEFAULT_FIX_LABELS: Record<YamlMistake, string> = {
  tab: "Use spaces",
  indent: "Line it up",
  dedent: "Line it up",
  boolean: "Quote it",
  version: "Quote it",
  octal: "Quote it",
  sexagesimal: "Quote it",
  duplicate: "",
}
const QUOTABLE: YamlMistake[] = ["boolean", "version", "octal", "sexagesimal"]

export interface YamlFieldProps
  extends Omit<React.ComponentProps<"textarea">, "value" | "defaultValue" | "onChange"> {
  /** Visible label. */
  label?: string
  /** Helper text shown while the field is empty. */
  hint?: string
  /** Controlled value. */
  value?: string
  /** Initial value when uncontrolled. */
  defaultValue?: string
  /** Called with the text on every change, including fixes. */
  onValueChange?: (value: string) => void
  /** Pause in ms before problems show while typing. Leaving the field shows them at once. */
  delay?: number
  /** How many problems are listed at once. */
  maxShown?: number
  /** Heading of the list; `{count}` is filled in. */
  summary?: string
  /** Label of the button that quotes every value read as the wrong type; `{count}` is filled in. */
  quoteAllLabel?: string
  /** Shown when nothing was found. */
  validMessage?: string
  /** Labels of the one-tap fixes, per mistake. */
  fixLabels?: Partial<Record<YamlMistake, string>>
  /** Label of the button that jumps to the first copy of a duplicate key; `{line}` is filled in. */
  firstLabel?: string
  /** Shown when more problems exist than `maxShown`; `{count}` is filled in. */
  moreLabel?: string
}

const fixClass =
  "inline-flex h-6 items-center gap-1 rounded-md border border-amber-500/40 px-2 font-medium text-amber-900 transition-colors hover:bg-amber-500/10 dark:text-amber-200 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
const linkClass =
  "h-6 rounded-md px-1.5 font-medium underline-offset-2 hover:underline outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
const keyframes = `@keyframes cui-yaml-field-reads{0%{transform:translateX(-4px);opacity:0}100%{transform:none;opacity:1}}`

/**
 * A YAML textarea that catches the config mistakes that load without an error and break later:
 * the Norway problem (NO, yes, on, off become booleans), versions like 1.10 read as 1.1, 0755
 * read as octal, 22:22 read as base-60, duplicate keys where the last one silently wins, tabs and
 * indentation that doesn't line up. Each problem shows its line and column, what the parser will
 * really read, and a one-tap fix. No dependencies.
 */
export function YamlField({
  label = "YAML",
  hint,
  value,
  defaultValue = "",
  onValueChange,
  delay = 600,
  maxShown = 4,
  summary = "{count} to check",
  quoteAllLabel = "Quote all {count}",
  validMessage = "No YAML traps found",
  fixLabels,
  firstLabel = "Go to line {line}",
  moreLabel = "+{count} more",
  id,
  className,
  rows = 8,
  onBlur,
  ref,
  ...props
}: YamlFieldProps) {
  const [inner, setInner] = React.useState(defaultValue)
  const [settled, setSettled] = React.useState(defaultValue)
  const areaRef = React.useRef<HTMLTextAreaElement>(null)
  const autoId = React.useId()
  const fieldId = id ?? autoId
  const text = value ?? inner

  React.useImperativeHandle(ref, () => areaRef.current as HTMLTextAreaElement)

  React.useEffect(() => {
    const timer = setTimeout(() => setSettled(text), delay)
    return () => clearTimeout(timer)
  }, [text, delay])

  const issues = React.useMemo(() => checkYaml(text), [text])
  const shown = settled === text ? issues : []
  const quotable = shown.filter((issue) => QUOTABLE.includes(issue.mistake))
  const labels = { ...DEFAULT_FIX_LABELS, ...fixLabels }
  const plural = (n: number) => (n === 1 ? "1 value" : `${n} values`)

  const update = (next: string, settle = true) => {
    if (value === undefined) setInner(next)
    if (settle) setSettled(next)
    onValueChange?.(next)
  }

  const select = (from: number, to: number) => {
    const area = areaRef.current
    if (!area) return
    area.focus()
    area.setSelectionRange(from, to)
    const lineHeight = parseFloat(getComputedStyle(area).lineHeight) || 20
    area.scrollTop = Math.max(0, (text.slice(0, from).split("\n").length - 3) * lineHeight)
  }
  const selectLine = (line: number) => {
    const start = text.split("\n").slice(0, line - 1).join("\n").length + (line > 1 ? 1 : 0)
    select(start, (text.indexOf("\n", start) + 1 || text.length + 1) - 1)
  }

  return (
    <div data-slot="yaml-field" className={cn("grid w-full max-w-md gap-1.5", className)}>
      <style>{keyframes}</style>
      <label htmlFor={fieldId} className="w-fit text-sm font-medium">
        {label}
      </label>
      <textarea
        ref={areaRef}
        id={fieldId}
        rows={rows}
        wrap="off"
        value={text}
        spellCheck={false}
        autoCapitalize="none"
        autoCorrect="off"
        onChange={(event) => update(event.target.value, false)}
        onBlur={(event) => {
          setSettled(text)
          onBlur?.(event)
        }}
        aria-describedby={`${fieldId}-status`}
        data-warning={shown.length ? "" : undefined}
        className="w-full min-w-0 resize-y rounded-md border bg-transparent px-3 py-2 font-mono text-sm leading-5 shadow-xs transition-[color,box-shadow] outline-none [tab-size:2] placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30 data-warning:border-amber-500 dark:data-warning:border-amber-400"
        {...props}
      />
      <div id={`${fieldId}-status`} aria-live="polite" className="text-xs">
        {shown.length ? (
          <div className="grid gap-1.5">
            <div className="flex min-h-6 flex-wrap items-center justify-between gap-2 text-amber-700 dark:text-amber-400">
              <span className="flex items-center gap-1.5 font-medium">
                <TriangleAlert aria-hidden className="size-3.5" />
                {summary.replace("{count}", shown.length === 1 ? "1 spot" : `${shown.length} spots`)}
              </span>
              {quotable.length > 1 ? (
                <button type="button" onClick={() => update(fixYaml(text, quotable))} className={fixClass}>
                  {quoteAllLabel.replace("{count}", plural(quotable.length))}
                </button>
              ) : null}
            </div>
            <ul className="divide-y overflow-hidden rounded-md border bg-muted/30">
              {shown.slice(0, maxShown).map((issue: YamlIssue) => (
                <li key={`${issue.mistake}-${issue.index}`} className="flex gap-2 px-2.5 py-1.5">
                  <button
                    type="button"
                    onClick={() => select(issue.index, issue.index + issue.length)}
                    aria-label={`Line ${issue.line}, column ${issue.column}`}
                    className="h-6 shrink-0 rounded-sm font-mono text-[11px] text-muted-foreground tabular-nums hover:text-foreground outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                  >
                    {issue.line}:{issue.column}
                  </button>
                  <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-amber-800 dark:text-amber-300">
                    <span className="py-1">{issue.message}</span>
                    {issue.reads ? (
                      <code key={issue.reads} className="rounded border border-amber-500/30 bg-background px-1.5 py-0.5 font-mono text-[11px] text-foreground motion-safe:animate-[cui-yaml-field-reads_250ms_ease-out]">
                        {text.slice(issue.index, issue.index + issue.length)} → {issue.reads}
                      </code>
                    ) : null}
                    {issue.fix && labels[issue.mistake] ? (
                      <button type="button" onClick={() => update(fixYaml(text, [issue]))} className={fixClass}>
                        {labels[issue.mistake]}
                      </button>
                    ) : null}
                    {issue.firstLine ? (
                      <button type="button" onClick={() => selectLine(issue.firstLine!)} className={linkClass}>
                        {firstLabel.replace("{line}", String(issue.firstLine))}
                      </button>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
            {shown.length > maxShown ? (
              <p className="text-muted-foreground">{moreLabel.replace("{count}", String(shown.length - maxShown))}</p>
            ) : null}
          </div>
        ) : text.trim() && settled === text ? (
          <p className="mt-1.5 flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400">
            <CircleCheck aria-hidden className="size-3.5" />
            {validMessage}
          </p>
        ) : hint && !text.trim() ? (
          <p className="mt-1.5 text-muted-foreground">{hint}</p>
        ) : null}
      </div>
    </div>
  )
}
