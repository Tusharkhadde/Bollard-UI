"use client"

import * as React from "react"
import { Braces, CircleCheck, TriangleAlert } from "lucide-react"

import { cn } from "@/lib/utils"
import { checkJson, fixJson, type JsonIssue, type JsonMistake } from "./json-check"

export { checkJson, fixJson, lineColumn } from "./json-check"
export type { JsonIssue, JsonMistake } from "./json-check"

const DEFAULT_FIX_LABELS: Record<JsonMistake, string> = {
  "trailing-comma": "Remove trailing commas",
  quotes: "Use double quotes",
  "unquoted-key": "Quote the keys",
  comment: "Remove comments",
  python: "Use true / false / null",
  "missing-comma": "Add the comma",
  unclosed: "Close it",
}

export interface JsonFieldProps
  extends Omit<React.ComponentProps<"textarea">, "value" | "defaultValue" | "onChange"> {
  /** Visible label. */
  label?: string
  /** Helper text shown while the field is empty. */
  hint?: string
  /** Controlled value. */
  value?: string
  /** Initial value when uncontrolled. */
  defaultValue?: string
  /** Called with the text on every change, including fixes and formatting. */
  onValueChange?: (value: string) => void
  /** Pause in ms before a problem is shown while typing. Leaving the field shows it at once. */
  delay?: number
  /** Indent used by the Format button. */
  indent?: number
  /** Format button text. */
  formatLabel?: string
  /** Shown under valid JSON. */
  validMessage?: string
  /** Labels of the one-tap fixes, per mistake. */
  fixLabels?: Partial<Record<JsonMistake, string>>
  /** Text of the button that selects the problem in the textarea. */
  showLabel?: string
  /** Formats the position shown before each problem. */
  formatPosition?: (line: number, column: number) => string
}

const fixClass =
  "inline-flex h-6 items-center gap-1 rounded-md border border-amber-500/40 px-2 font-medium text-amber-900 transition-colors hover:bg-amber-500/10 dark:text-amber-200 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
const keyframes = `@keyframes cui-json-field-caret{0%{transform:translateY(-4px);opacity:0}100%{transform:none;opacity:1}}`

/** A one-line code frame: the offending line (trimmed to fit) with a caret under the exact column. */
function CodeFrame({ text, issue }: { text: string; issue: JsonIssue }) {
  const source = (text.split("\n")[issue.line - 1] ?? "").replace(/\t/g, " ")
  const from = Math.max(0, issue.column - 1 - 22)
  const snippet = (from > 0 ? "…" : "") + source.slice(from, from + 40) + (source.length > from + 40 ? "…" : "")
  const caret = issue.column - 1 - from + (from > 0 ? 1 : 0)
  const gutter = String(issue.line)
  return (
    <pre aria-hidden className="overflow-hidden rounded-md border bg-muted/40 px-2 py-1.5 font-mono text-xs leading-5 text-foreground">
      <span className="text-muted-foreground">{gutter} │ </span>
      {snippet}
      {"\n"}
      <span className="text-muted-foreground">{" ".repeat(gutter.length)} │ </span>
      {" ".repeat(caret)}
      <span key={issue.index} className="inline-block font-bold text-amber-600 motion-safe:animate-[cui-json-field-caret_250ms_ease-out] dark:text-amber-400">^</span>
    </pre>
  )
}

/**
 * A JSON textarea that catches broken config before it is saved. It validates as you type,
 * points at the exact line and column with a caret (the same in every browser, unlike
 * JSON.parse messages), and repairs the classic hand-editing mistakes in one tap: trailing
 * commas, single or smart quotes, unquoted keys, comments, Python's True/None, a missing comma
 * or an unclosed brace. Fixes are token-aware, so text inside strings is never touched.
 */
export function JsonField({
  label = "JSON",
  hint,
  value,
  defaultValue = "",
  onValueChange,
  delay = 600,
  indent = 2,
  formatLabel = "Format",
  validMessage = "Valid JSON",
  fixLabels,
  showLabel = "Show me",
  formatPosition = (line, column) => `Line ${line}, column ${column}:`,
  id,
  className,
  rows = 8,
  onBlur,
  ref,
  ...props
}: JsonFieldProps) {
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

  const issue = React.useMemo(() => checkJson(text), [text])
  const shown = settled === text ? issue : null
  const labels = { ...DEFAULT_FIX_LABELS, ...fixLabels }

  const update = (next: string, settle = false) => {
    if (value === undefined) setInner(next)
    if (settle) setSettled(next)
    onValueChange?.(next)
  }

  const select = (at: number) => {
    const area = areaRef.current
    if (!area) return
    area.focus()
    area.setSelectionRange(at, Math.min(at + 1, text.length))
    // Scroll the line into view: setSelectionRange alone doesn't in every browser.
    const lineHeight = parseFloat(getComputedStyle(area).lineHeight) || 20
    area.scrollTop = Math.max(0, (text.slice(0, at).split("\n").length - 3) * lineHeight)
  }

  return (
    <div data-slot="json-field" className={cn("grid w-full max-w-md gap-1.5", className)}>
      <style>{keyframes}</style>
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={fieldId} className="text-sm font-medium">
          {label}
        </label>
        <button
          type="button"
          disabled={!text.trim() || !!issue}
          onClick={() => update(JSON.stringify(JSON.parse(text), null, indent), true)}
          className="inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:pointer-events-none disabled:opacity-50 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          <Braces aria-hidden className="size-3.5" />
          {formatLabel}
        </button>
      </div>
      <textarea
        ref={areaRef}
        id={fieldId}
        rows={rows}
        wrap="off"
        value={text}
        spellCheck={false}
        autoCapitalize="none"
        autoCorrect="off"
        onChange={(event) => update(event.target.value)}
        onBlur={(event) => {
          setSettled(text)
          onBlur?.(event)
        }}
        aria-invalid={shown ? true : undefined}
        aria-describedby={`${fieldId}-status`}
        data-warning={shown ? "" : undefined}
        className="w-full min-w-0 resize-y rounded-md border bg-transparent px-3 py-2 font-mono text-sm leading-5 shadow-xs transition-[color,box-shadow] outline-none [tab-size:2] placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30 data-warning:border-amber-500 dark:data-warning:border-amber-400"
        {...props}
      />
      <div id={`${fieldId}-status`} aria-live="polite" className="min-h-6 text-xs">
        {shown ? (
          <div className="grid gap-1.5">
            <div className="flex gap-1.5 text-amber-700 dark:text-amber-400">
              <span className="flex h-6 shrink-0 items-center">
                <TriangleAlert aria-hidden className="size-3.5" />
              </span>
              <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                <span className="py-1">
                  <span className="font-medium">{formatPosition(shown.line, shown.column)}</span>{" "}
                  {shown.message}
                </span>
                {shown.mistake ? (
                  <button type="button" onClick={() => update(fixJson(text, shown.mistake!), true)} className={fixClass}>
                    {labels[shown.mistake]}
                  </button>
                ) : null}
                <button type="button" onClick={() => select(shown.index)} className="h-6 rounded-md px-1.5 font-medium underline-offset-2 hover:underline outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50">
                  {showLabel}
                </button>
              </span>
            </div>
            <CodeFrame text={text} issue={shown} />
          </div>
        ) : text.trim() && !issue ? (
          <p className="flex items-center gap-1.5 py-1 text-emerald-700 dark:text-emerald-400">
            <CircleCheck aria-hidden className="size-3.5" />
            {validMessage}
          </p>
        ) : hint && !text.trim() ? (
          <p className="py-1 text-muted-foreground">{hint}</p>
        ) : null}
      </div>
    </div>
  )
}
