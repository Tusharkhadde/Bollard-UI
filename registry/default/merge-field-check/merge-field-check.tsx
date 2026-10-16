"use client"

// Bollard UI — merge-field-check · MIT licence · https://bollard-ui.vercel.app/components/merge-field-check

import * as React from "react"
import { Braces, ChevronLeft, ChevronRight, CircleAlert, CircleCheck, SkipForward, TriangleAlert } from "lucide-react"

import { cn } from "@/lib/utils"
import { checkMergeFields, isBlank, parseTemplate, rewriteTags, type MergeRecipient, type TemplatePart } from "./merge-fields"

export { checkMergeFields, parseTemplate, rewriteTags, suggestField, isBlank } from "./merge-fields"
export type { MergeIssue, MergeRecipient, TemplatePart } from "./merge-fields"

export interface MergeFieldCheckProps extends Omit<React.ComponentProps<"div">, "defaultValue"> {
  /** The template (controlled), using `{{field}}` and `{{field | default: "there"}}`. */
  value?: string
  /** Starting template when uncontrolled. */
  defaultValue?: string
  /** Called with the template after every edit or one-tap fix. */
  onValueChange?: (value: string) => void
  /** The real audience, one row per recipient. */
  recipients: MergeRecipient[]
  /** Fields that exist. Defaults to every key found on the recipients. */
  fields?: string[]
  /** Suggested fallback per field. Name-like fields default to "there". */
  fallbacks?: Record<string, string>
  /** How a recipient is named in the stepper. Defaults to email, phone or name. */
  getRecipientLabel?: (recipient: MergeRecipient, index: number) => string
  /** Visible label. */
  label?: string
  /** Label above the per-recipient preview. */
  previewLabel?: string
  /** Button text to step to the next recipient with a gap. */
  nextProblemLabel?: string
  /** Shown when nothing needs fixing. `{count}` is the audience size. */
  cleanText?: string
}

const fixClass =
  "inline-flex h-6 items-center gap-1 rounded-md border px-2 text-xs font-medium whitespace-nowrap transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
const tone = {
  error: { text: "text-red-700 dark:text-red-400", fix: "border-red-500/40 text-red-800 hover:bg-red-500/10 dark:text-red-200" },
  warning: { text: "text-amber-700 dark:text-amber-400", fix: "border-amber-500/40 text-amber-900 hover:bg-amber-500/10 dark:text-amber-200" },
}
const iconButton =
  "grid size-8 place-items-center rounded-md border bg-background shadow-xs transition-colors outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 dark:bg-input/30"
const plural = (n: number, word: string) => `${n.toLocaleString()} ${word}${n === 1 ? "" : "s"}`

/**
 * Catches broken personalisation before a bulk email or SMS goes out: renders
 * the template for each real recipient, flags unknown fields ({{frist_name}}
 * → first_name), unclosed braces, and fields some recipients have no value
 * for (spaces count as empty), each with a one-tap fix. "Next problem" steps
 * straight to the recipients who would get "Hi ,".
 */
export function MergeFieldCheck({
  value,
  defaultValue = "",
  onValueChange,
  recipients,
  fields,
  fallbacks = {},
  getRecipientLabel = (r, i) => r.email ?? r.phone ?? r.name ?? `Recipient ${i + 1}`,
  label = "Message",
  previewLabel = "Preview as",
  nextProblemLabel = "Next problem",
  cleanText = "Every field fills in for all {count}.",
  className,
  ...props
}: MergeFieldCheckProps) {
  const [inner, setInner] = React.useState(defaultValue)
  const [index, setIndex] = React.useState(0)
  const textareaRef = React.useRef<HTMLTextAreaElement>(null)
  const id = React.useId()
  const template = value ?? inner
  const known = fields ?? Array.from(new Set(recipients.flatMap((r) => Object.keys(r))))
  const issues = React.useMemo(() => checkMergeFields(template, recipients, known), [template, recipients, known.join()])
  const parts = React.useMemo(() => parseTemplate(template), [template])
  const problemRows = Array.from(new Set(issues.flatMap((i) => (i.kind === "missing" ? i.indexes : [])))).sort((a, b) => a - b)
  const current = Math.min(index, Math.max(0, recipients.length - 1))
  const recipient = recipients[current] ?? {}

  const update = (next: string, caret?: number) => {
    setInner(next)
    onValueChange?.(next)
    if (caret !== undefined)
      requestAnimationFrame(() => {
        textareaRef.current?.focus()
        textareaRef.current?.setSelectionRange(caret, caret)
      })
  }
  const fallbackFor = (field: string) => fallbacks[field] ?? (/name/i.test(field) ? "there" : "")
  const addFallback = (field: string) => {
    const fallback = fallbackFor(field)
    const next = rewriteTags(template, field, { fallback })
    // An empty default needs words: put the caret between its quotes.
    const tag = parseTemplate(next).find((p): p is Extract<TemplatePart, { type: "tag" }> => p.type === "tag" && p.field === field && p.fallback === "")
    update(next, fallback === "" && tag ? tag.end - 3 : undefined)
  }
  const nextProblem = problemRows.find((i) => i > current) ?? problemRows[0]

  return (
    <div data-slot="merge-field-check" className={cn("grid w-full max-w-lg gap-3", className)} {...props}>
      <style>{`@keyframes cui-merge-field-check-flash{from{background-color:color-mix(in oklab,currentColor 28%,transparent)}}`}</style>
      <div className="grid gap-1.5">
        <label htmlFor={id} className="w-fit text-sm font-medium">
          {label}
        </label>
        <textarea
          ref={textareaRef}
          id={id}
          value={template}
          rows={4}
          spellCheck={false}
          aria-invalid={issues.some((i) => i.kind !== "missing") || undefined}
          aria-describedby={`${id}-issues`}
          onChange={(event) => update(event.target.value)}
          className="min-h-20 w-full resize-y rounded-md border bg-transparent px-3 py-2 font-mono text-sm shadow-xs transition-[color,box-shadow] outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-destructive dark:bg-input/30"
        />
        <ul id={`${id}-issues`} aria-live="polite" className="grid gap-1.5 text-xs">
          {issues.map((issue) => {
            const t = issue.kind === "missing" ? tone.warning : tone.error
            const Icon = issue.kind === "missing" ? TriangleAlert : CircleAlert
            return (
              <li key={issue.kind + ("field" in issue ? issue.field : issue.start)} className={cn("flex gap-1.5", t.text)}>
                <span className="flex h-6 shrink-0 items-center">
                  <Icon aria-hidden className="size-3.5" />
                </span>
                <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                  {issue.kind === "unclosed" && (
                    <>
                      <span className="py-1">
                        Broken braces: <code className="font-mono break-all">{issue.raw}</code>
                      </span>
                      <button type="button" className={cn(fixClass, t.fix)} onClick={() => update(template.slice(0, issue.start) + issue.fix + template.slice(issue.end))}>
                        {issue.fix ? <>Use <code className="font-mono">{issue.fix}</code></> : "Remove"}
                      </button>
                    </>
                  )}
                  {issue.kind === "unknown" && (
                    <>
                      <span className="py-1">
                        No field called <code className="font-mono">{issue.field}</code>, so everyone gets it {issue.suggestion ? "raw." : "blank or raw."}
                      </span>
                      {issue.suggestion && (
                        <button type="button" className={cn(fixClass, t.fix)} onClick={() => update(rewriteTags(template, issue.field, { rename: issue.suggestion }))}>
                          Use <code className="font-mono">{issue.suggestion}</code>
                        </button>
                      )}
                    </>
                  )}
                  {issue.kind === "missing" && (
                    <>
                      <span className="py-1">
                        <span className="font-medium">{plural(issue.count, "recipient")}</span> {issue.count === 1 ? "has" : "have"} no{" "}
                        <code className="font-mono">{issue.field}</code>
                      </span>
                      <button type="button" className={cn(fixClass, t.fix)} onClick={() => addFallback(issue.field)}>
                        {fallbackFor(issue.field) ? `Fall back to “${fallbackFor(issue.field)}”` : "Add a fallback"}
                      </button>
                      <button type="button" className={cn(fixClass, "border-transparent underline-offset-2 hover:underline", t.text)} onClick={() => setIndex(issue.indexes[0])}>
                        Show one
                      </button>
                    </>
                  )}
                </span>
              </li>
            )
          })}
          {issues.length === 0 && (
            <li className="flex items-center gap-1.5 py-1 text-emerald-700 dark:text-emerald-400">
              <CircleCheck aria-hidden className="size-3.5" /> {cleanText.replace("{count}", plural(recipients.length, "recipient"))}
            </li>
          )}
        </ul>
      </div>

      <section aria-label={previewLabel} className="overflow-hidden rounded-lg border bg-background">
        <div className="flex flex-wrap items-center gap-2 border-b bg-muted/50 px-3 py-1.5">
          <p className="min-w-0 flex-1 basis-44 truncate text-xs text-muted-foreground" aria-live="polite">
            {previewLabel} <span className="font-medium text-foreground">{getRecipientLabel(recipient, current)}</span>
            <span className="tabular-nums"> · {current + 1}/{recipients.length.toLocaleString()}</span>
          </p>
          {problemRows.length > 0 && (
            <button type="button" onClick={() => setIndex(nextProblem)} className={cn(fixClass, tone.warning.fix, "ml-auto h-8 px-2.5")}>
              <SkipForward aria-hidden className="size-3.5" /> {nextProblemLabel}
            </button>
          )}
          <button type="button" aria-label="Previous recipient" disabled={current === 0} onClick={() => setIndex(current - 1)} className={iconButton}>
            <ChevronLeft aria-hidden className="size-4" />
          </button>
          <button type="button" aria-label="Next recipient" disabled={current >= recipients.length - 1} onClick={() => setIndex(current + 1)} className={iconButton}>
            <ChevronRight aria-hidden className="size-4" />
          </button>
        </div>
        <p className="px-3 py-2.5 text-sm leading-relaxed break-words whitespace-pre-wrap">
          {parts.map((part, i) => {
            if (part.type === "text") return <span key={i}>{part.value}</span>
            if (part.type === "broken")
              return (
                <mark key={i} className="rounded-sm bg-red-500/15 px-0.5 font-mono text-red-800 dark:text-red-300">
                  {part.raw}
                </mark>
              )
            if (!known.includes(part.field))
              return (
                <mark key={i} className="rounded-sm bg-red-500/15 px-0.5 font-mono text-red-800 dark:text-red-300">
                  {`{{${part.field}}}`}
                </mark>
              )
            const raw = recipient[part.field]
            const missing = isBlank(raw)
            const shown = missing ? part.fallback : raw?.trim()
            const flash = "motion-safe:animate-[cui-merge-field-check-flash_400ms_ease-out]"
            return shown ? (
              <mark
                key={`${i}-${current}`}
                title={missing ? `Fallback for empty ${part.field}` : part.field}
                className={cn("rounded-sm px-0.5 text-inherit", missing ? "bg-amber-500/15 text-amber-900 dark:text-amber-200" : "bg-emerald-500/10 text-emerald-900 dark:text-emerald-200", flash)}
              >
                {shown}
              </mark>
            ) : (
              <mark
                key={`${i}-${current}`}
                className={cn("inline-block h-[1.15em] w-[2.5ch] translate-y-[0.2em] rounded-sm border border-dashed border-red-500/70 bg-red-500/10 text-red-700 dark:text-red-300", flash)}
              >
                <span className="sr-only">(empty {part.field})</span>
              </mark>
            )
          })}
        </p>
        {problemRows.length > 0 && (
          <p className="flex items-center gap-1.5 border-t px-3 py-1.5 text-xs text-muted-foreground">
            <Braces aria-hidden className="size-3.5 shrink-0" />
            {plural(problemRows.length, "recipient")} would get a gap
          </p>
        )}
      </section>
    </div>
  )
}
