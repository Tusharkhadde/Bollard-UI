"use client"

// Bollard UI — markdown-check · MIT licence · https://bollard-ui.vercel.app/components/markdown-check

import * as React from "react"
import { CircleCheck, TriangleAlert } from "lucide-react"

import { cn } from "@/lib/utils"
import { checkMarkdown, DEFAULT_ALLOWED_TAGS, fixMarkdown, type MarkdownIssue, type MarkdownMistake } from "./markdown-rules"

export { checkMarkdown, fixMarkdown, DEFAULT_ALLOWED_TAGS } from "./markdown-rules"
export type { MarkdownIssue, MarkdownLook, MarkdownMistake } from "./markdown-rules"

const DEFAULT_FIX_LABELS: Record<MarkdownMistake, string> = {
  "unclosed-code": "Close the `",
  "unclosed-bold": "Close the **",
  "bold-space": "Remove the space",
  "link-space": "Join ] and (",
  "empty-link": "",
  "link-no-text": "",
  "link-url-space": "Encode the space",
  "missing-ref": "",
  "heading-space": "Add the space",
  "stripped-html": "Remove it",
}

export interface MarkdownCheckProps
  extends Omit<React.ComponentProps<"textarea">, "value" | "defaultValue" | "onChange"> {
  /** Visible label. */
  label?: string
  /** Helper text shown while there is nothing to warn about. */
  hint?: string
  /** Controlled value. */
  value?: string
  /** Initial value when uncontrolled. */
  defaultValue?: string
  /** Called with the text on every change, including one-tap fixes. */
  onValueChange?: (value: string) => void
  /** HTML tags the renderer keeps. Others are flagged as stripped. */
  allowedTags?: string[]
  /** Pause in ms before problems show while typing. Leaving the field shows them at once. */
  delay?: number
  /** How many problem spots are previewed at once. */
  maxShown?: number
  /** Heading of the preview list; `{count}` is filled in. */
  summary?: string
  /** Shown when nothing will render wrong. */
  validMessage?: string
  /** Labels of the one-tap fixes, per mistake. */
  fixLabels?: Partial<Record<MarkdownMistake, string>>
  /** Text of the button that selects the spot in the textarea. */
  showLabel?: string
  /** Shown when more spots exist than `maxShown`; `{count}` is filled in. */
  moreLabel?: string
}

const fixClass =
  "inline-flex h-6 items-center gap-1 rounded-md border border-amber-500/40 px-2 font-medium text-amber-900 transition-colors hover:bg-amber-500/10 dark:text-amber-200 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
const keyframes = `@keyframes cui-markdown-check-mark{0%{background-color:rgb(245 158 11/.7)}100%{}}`

/** Renders the simple inline Markdown around a problem spot: **bold**, `code` and [links](url). */
function Inline({ text }: { text: string }) {
  return text.split(/(\*\*[^*\s](?:[^*]*[^*\s])?\*\*|`[^`]+`|\[[^\]]+\]\([^)\s]+\))/).map((part, i) =>
    i % 2 === 0 ? part
      : part.startsWith("**") ? <strong key={i}>{part.slice(2, -2)}</strong>
      : part.startsWith("`") ? <code key={i} className="rounded bg-muted px-1 font-mono text-[0.9em]">{part.slice(1, -1)}</code>
      : <span key={i} className="text-primary underline underline-offset-2">{part.slice(1, part.indexOf("]"))}</span>,
  )
}

/** One problem line, drawn the way the renderer will draw it, with the problem span marked. */
function Preview({ text, issue }: { text: string; issue: MarkdownIssue }) {
  const lineStart = issue.index - issue.column + 1
  const lineEnd = (text.indexOf("\n", issue.index) + 1 || text.length + 1) - 1
  const spanEnd = Math.min(issue.index + issue.length, Math.max(lineEnd, issue.index + 1))
  const from = Math.max(lineStart, issue.index - 24)
  const before = (from > lineStart ? "…" : "") + text.slice(from, issue.index)
  const after = text.slice(spanEnd, Math.min(lineEnd, spanEnd + 32)) + (lineEnd > spanEnd + 32 ? "…" : "")
  const heading = from === lineStart && /^#{1,6} /.test(before)
  const span = text.slice(issue.index, spanEnd)
  return (
    <p className={cn("min-w-0 truncate text-sm leading-6 text-foreground", heading && "font-semibold")}>
      <Inline text={heading ? before.replace(/^#+ /, "") : before} />
      <mark
        key={issue.index}
        className={cn(
          "rounded-sm px-0.5 text-inherit motion-safe:animate-[cui-markdown-check-mark_400ms_ease-out]",
          issue.look === "literal" && "bg-amber-300/50 dark:bg-amber-400/25",
          issue.look === "removed" && "bg-transparent text-muted-foreground line-through decoration-red-500/70",
          issue.look === "invisible" && "inline-block h-4 w-8 align-middle border border-dashed border-amber-500 bg-transparent",
        )}
      >
        {issue.look === "invisible" ? null : span}
      </mark>
      <Inline text={after} />
    </p>
  )
}

/**
 * A Markdown textarea that catches what will render differently from how it reads, before it's
 * posted: an unclosed ** or backtick, `** bold**`, `[text] (url)`, links with no address or text,
 * spaces in addresses, undefined `[text][ref]`, `#Title` with no space and raw HTML the sanitizer
 * strips. Each spot is previewed the way it will actually render, with a one-tap fix.
 */
export function MarkdownCheck({
  label = "Description",
  hint = "Markdown supported.",
  value,
  defaultValue = "",
  onValueChange,
  allowedTags = DEFAULT_ALLOWED_TAGS,
  delay = 600,
  maxShown = 3,
  summary = "{count} will render wrong",
  validMessage = "Renders as written",
  fixLabels,
  showLabel = "Show",
  moreLabel = "+{count} more",
  id,
  className,
  rows = 6,
  onBlur,
  ref,
  ...props
}: MarkdownCheckProps) {
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

  const issues = React.useMemo(() => checkMarkdown(settled, allowedTags), [settled, allowedTags])
  const shown = settled === text ? issues : []
  const labels = { ...DEFAULT_FIX_LABELS, ...fixLabels }

  const update = (next: string, settle = false) => {
    if (value === undefined) setInner(next)
    if (settle) setSettled(next)
    onValueChange?.(next)
  }

  const select = (issue: MarkdownIssue) => {
    const area = areaRef.current
    if (!area) return
    area.focus()
    area.setSelectionRange(issue.index, issue.index + issue.length)
    const lineHeight = parseFloat(getComputedStyle(area).lineHeight) || 20
    area.scrollTop = Math.max(0, (issue.line - 3) * lineHeight)
  }

  return (
    <div data-slot="markdown-check" className={cn("grid w-full max-w-md gap-1.5", className)}>
      <style>{keyframes}</style>
      <label htmlFor={fieldId} className="w-fit text-sm font-medium">
        {label}
      </label>
      <textarea
        ref={areaRef}
        id={fieldId}
        rows={rows}
        value={text}
        onChange={(event) => update(event.target.value)}
        onBlur={(event) => {
          setSettled(text)
          onBlur?.(event)
        }}
        aria-describedby={`${fieldId}-status`}
        data-warning={shown.length ? "" : undefined}
        className="w-full min-w-0 resize-y rounded-md border bg-transparent px-3 py-2 text-base leading-6 shadow-xs transition-[color,box-shadow] outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm dark:bg-input/30 data-warning:border-amber-500 dark:data-warning:border-amber-400"
        {...props}
      />
      <div id={`${fieldId}-status`} aria-live="polite" className="text-xs">
        {shown.length ? (
          <div className="grid gap-1.5">
            <p className="flex items-center gap-1.5 text-amber-700 dark:text-amber-400">
              <TriangleAlert aria-hidden className="size-3.5" />
              <span className="font-medium">
                {summary.replace("{count}", shown.length === 1 ? "1 spot" : `${shown.length} spots`)}
              </span>
            </p>
            <ul className="divide-y overflow-hidden rounded-md border bg-muted/30">
              {shown.slice(0, maxShown).map((issue) => (
                <li key={`${issue.mistake}-${issue.index}`} className="grid gap-1 px-2.5 py-2">
                  <div className="flex min-w-0 items-baseline gap-2">
                    <span className="shrink-0 font-mono text-[11px] text-muted-foreground tabular-nums">L{issue.line}</span>
                    <Preview text={settled} issue={issue} />
                  </div>
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-amber-800 dark:text-amber-300">
                    <span className="py-1">{issue.message}</span>
                    {issue.fix && labels[issue.mistake] ? (
                      <button type="button" onClick={() => update(fixMarkdown(text, issue), true)} className={fixClass}>
                        {labels[issue.mistake]}
                      </button>
                    ) : null}
                    <button type="button" onClick={() => select(issue)} className="h-6 rounded-md px-1.5 font-medium underline-offset-2 hover:underline outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50">
                      {showLabel}
                    </button>
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
        ) : hint ? (
          <p className="mt-1.5 text-muted-foreground">{hint}</p>
        ) : null}
      </div>
    </div>
  )
}
