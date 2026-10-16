"use client"

import * as React from "react"
import { Languages, TriangleAlert, X } from "lucide-react"

import { cn } from "@/lib/utils"
import { findPlaceholders, lintTranslation, type TranslationIssue } from "./i18n-checks"

export { findPlaceholders, lintTranslation, pluralBlocks, renderedLength, requiredPluralForms } from "./i18n-checks"
export type { TranslationIssue } from "./i18n-checks"

export interface I18nStringFieldProps
  extends Omit<React.ComponentProps<"textarea">, "value" | "defaultValue" | "onChange" | "maxLength"> {
  /** The source string, e.g. the English original. */
  source: string
  /** Target locale (BCP 47), used for plural rules and the label. */
  locale: string
  /** Locale of the source string. */
  sourceLocale?: string
  /** UI budget in rendered characters (tags don't count, placeholders count as `placeholderLength`). */
  maxLength?: number
  /** Width a placeholder is assumed to render at. */
  placeholderLength?: number
  /** Controlled translation. */
  value?: string
  /** Initial translation when uncontrolled. */
  defaultValue?: string
  onValueChange?: (value: string) => void
  /** Visible label. `{language}` is filled in. */
  label?: string
  sourceLabel?: string
  /** Accessible label of the button that accepts a translation identical to the source. */
  keepSameLabel?: string
}

const fix =
  "inline-flex h-6 items-center gap-1 rounded-md border border-amber-500/40 px-2 font-medium text-amber-900 transition-colors hover:bg-amber-500/10 dark:text-amber-200 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"

/**
 * A translation field that catches what reviewers miss because they read for
 * meaning: a dropped or renamed placeholder ({name} → {nom}), an unclosed <b>,
 * plural forms the target language needs (Polish has one, few, many, other),
 * copy that overflows its button, and source text pasted back untranslated.
 * Each placeholder chip on the source lights up once the translation carries
 * it, and most problems have a one-tap fix.
 */
export function I18nStringField({
  source,
  locale,
  sourceLocale = "en",
  maxLength,
  placeholderLength = 4,
  value,
  defaultValue = "",
  onValueChange,
  label = "Translation · {language}",
  sourceLabel = "Source",
  keepSameLabel = "It's meant to match the source",
  id,
  className,
  rows = 3,
  ...props
}: I18nStringFieldProps) {
  const [inner, setInner] = React.useState(defaultValue)
  const [sameOk, setSameOk] = React.useState(false)
  const autoId = React.useId()
  const fieldId = id ?? autoId
  const text = value ?? inner

  const update = (next: string) => {
    if (value === undefined) setInner(next)
    onValueChange?.(next)
  }
  const result = React.useMemo(
    () => lintTranslation(source, text, { locale, sourceLocale, maxLength, placeholderLength }),
    [source, text, locale, sourceLocale, maxLength, placeholderLength],
  )
  const issues = result.issues.filter((issue) => !(issue.kind === "untranslated" && sameOk))
  const language = new Intl.DisplayNames([sourceLocale], { type: "language" }).of(locale) ?? locale
  const tokens = [...new Set(findPlaceholders(source))]
  const present = new Set(findPlaceholders(text))
  const over = maxLength !== undefined && result.length > maxLength

  return (
    <div data-slot="i18n-string-field" className={cn("grid w-full max-w-md gap-1.5", className)}>
      <div className="rounded-md border bg-muted/50 px-3 py-2 text-sm">
        <p className="mb-1 text-xs font-medium text-muted-foreground">{sourceLabel}</p>
        <p className="leading-6 break-words whitespace-pre-wrap">{source}</p>
        {tokens.length > 0 && (
          <p className="mt-1.5 flex flex-wrap gap-1" aria-label="Placeholders the translation must keep">
            {tokens.map((token) => (
              <code
                key={token}
                data-present={present.has(token) || undefined}
                aria-label={`${token}: ${present.has(token) ? "present" : "missing"}`}
                className="rounded border border-amber-500/40 bg-amber-500/10 px-1 py-px font-mono text-xs text-amber-900 transition-colors duration-300 data-present:border-emerald-500/40 data-present:bg-emerald-500/10 data-present:text-emerald-800 dark:text-amber-200 dark:data-present:text-emerald-300"
              >
                {token}
              </code>
            ))}
          </p>
        )}
      </div>
      <label htmlFor={fieldId} className="mt-1.5 flex w-fit items-center gap-1.5 text-sm font-medium">
        <Languages aria-hidden className="size-4 text-muted-foreground" />
        {label.replace("{language}", `${language} (${locale})`)}
      </label>
      <textarea
        id={fieldId}
        lang={locale}
        rows={rows}
        value={text}
        spellCheck
        onChange={(event) => {
          setSameOk(false)
          update(event.target.value)
        }}
        aria-describedby={`${fieldId}-issues`}
        data-warning={issues.length ? "" : undefined}
        className="w-full min-w-0 resize-y rounded-md border bg-transparent px-3 py-2 text-base shadow-xs transition-[color,box-shadow] outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 md:text-sm dark:bg-input/30 data-warning:border-amber-500 dark:data-warning:border-amber-400"
        {...props}
      />
      <div className="flex items-start gap-3">
        <ul id={`${fieldId}-issues`} aria-live="polite" className="grid min-h-6 min-w-0 flex-1 gap-0.5 text-xs">
          {issues.map((issue) => (
            <li key={issue.kind + issue.message} className="flex gap-1.5 text-amber-700 dark:text-amber-400">
              <span className="flex h-6 shrink-0 items-center">
                <TriangleAlert aria-hidden className="size-3.5" />
              </span>
              <span className="flex min-w-0 flex-wrap items-center gap-x-2">
                <span className="py-1">{issue.message}</span>
                <IssueFix issue={issue} onApply={update} onKeepSame={() => setSameOk(true)} keepSameLabel={keepSameLabel} />
              </span>
            </li>
          ))}
        </ul>
        {maxLength !== undefined && (
          <div className="grid w-16 shrink-0 gap-1 pt-1.5 text-right text-xs tabular-nums" aria-label={`${result.length} of ${maxLength} characters`}>
            <span className={cn("text-muted-foreground", over && "font-medium text-amber-700 dark:text-amber-400")}>
              {result.length}/{maxLength}
            </span>
            <span className="h-1 overflow-hidden rounded-full bg-muted">
              <span
                className={cn("block h-full rounded-full bg-emerald-500 transition-[width,background-color] duration-300 ease-out", over && "bg-amber-500")}
                style={{ width: `${Math.min(100, (result.length / maxLength) * 100)}%` }}
              />
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

function IssueFix({ issue, onApply, onKeepSame, keepSameLabel }: { issue: TranslationIssue; onApply: (v: string) => void; onKeepSame: () => void; keepSameLabel: string }) {
  if (issue.kind === "untranslated")
    return (
      <button type="button" onClick={onKeepSame} aria-label={keepSameLabel} title={keepSameLabel} className="grid size-6 place-items-center rounded-md transition-colors hover:bg-amber-500/10 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50">
        <X aria-hidden className="size-3.5" />
      </button>
    )
  if (!issue.fix) return null
  const next = issue.fix.value
  return (
    <button type="button" onClick={() => onApply(next)} className={fix}>
      {issue.fix.label}
    </button>
  )
}
