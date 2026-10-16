"use client"

import * as React from "react"
import { Check, Minus, TriangleAlert } from "lucide-react"

import { cn } from "@/lib/utils"
import { checkGlob, globstarHint, matchFiles, splitPatterns, type GlobIssue } from "@/registry/default/glob-input/glob"

export * from "@/registry/default/glob-input/glob"

/** Default messages. `{count}`, `{total}`, `{pattern}`, `{deeper}`, `{example}` are filled in. */
export const GLOB_MESSAGES = {
  summary: "{count} of {total} files match",
  "inner-globstar": "** only spans folders as a whole segment, so here it acts like *.",
  "dot-slash": "Paths are matched without a leading ./, so this matches nothing.",
  backslash: "Use / between folders. \\ escapes the next character.",
  "only-negations": "Only ! patterns, so nothing is included to exclude from.",
  case: "Matches nothing, but {count} files differ only in case.",
  none: "Matches none of the {total} files.",
  all: "Matches every file, {example} included.",
  shallow: "{pattern} stops at the first /, so it skips {count} files in subfolders.",
  use: "Use {fix}",
  excluded: "excluded by {pattern}",
  wouldAdd: "with **",
  list: "Files and whether they match",
}

export interface GlobInputProps extends Omit<React.ComponentProps<"input">, "value" | "defaultValue" | "onChange"> {
  /** The relative, "/"-separated paths the pattern runs against. */
  files: string[]
  /** Visible label. */
  label?: string
  /** Controlled pattern text. Several patterns are separated by spaces. */
  value?: string
  /** Initial pattern when uncontrolled. */
  defaultValue?: string
  /** Called with the text and the files it matches. */
  onValueChange?: (value: string, matches: string[]) => void
  /** Match letter case exactly, as Linux and git do. */
  caseSensitive?: boolean
  /** Override any of the default messages. */
  messages?: Partial<typeof GLOB_MESSAGES>
}

const fieldClass =
  "h-9 w-full min-w-0 rounded-md border bg-transparent px-3 font-mono text-base shadow-xs transition-[color,box-shadow] outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm dark:bg-input/30 data-warning:border-amber-500 dark:data-warning:border-amber-400"
const fixClass =
  "inline-flex h-6 items-center gap-1 rounded-md border border-amber-500/40 px-2 font-mono font-medium text-amber-900 transition-colors hover:bg-amber-500/10 dark:text-amber-200 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
const fill = (template: string, values: Record<string, string | number>) =>
  template.replace(/\{(\w+)\}/g, (match, key: string) => String(values[key] ?? match))

/**
 * A glob field (**, *, ?, [a-z], {a,b}, !negation) that runs the pattern live against a real file
 * list, so what it catches is never a guess. It flags patterns that match nothing or everything,
 * the `*` vs `**` mix-up (src/*.ts silently skipping src/utils/), `**` glued to a name (**.ts), a
 * leading ./, backslashes and case-only misses, with one-tap fixes, and flashes files as they flip.
 */
export function GlobInput({
  files,
  label = "Files to include",
  value,
  defaultValue = "",
  onValueChange,
  caseSensitive = true,
  messages,
  placeholder = "src/**/*.ts",
  id,
  className,
  ref,
  ...props
}: GlobInputProps) {
  const [inner, setInner] = React.useState(defaultValue)
  const listRef = React.useRef<HTMLUListElement>(null)
  const previous = React.useRef<Map<string, boolean>>(null)
  const autoId = React.useId()
  const inputId = id ?? autoId
  const t = { ...GLOB_MESSAGES, ...messages }
  const text = value ?? inner
  const options = { caseSensitive }
  const results = matchFiles(splitPatterns(text), files, options)
  const count = results.filter((r) => r.match).length
  const issue = checkGlob(text, files, options)
  const hint = issue ? null : globstarHint(text, files, options)
  const added = new Set(hint?.added)

  const commit = (next: string) => {
    if (value === undefined) setInner(next)
    onValueChange?.(next, matchFiles(splitPatterns(next), files, options).filter((r) => r.match).map((r) => r.file))
  }

  // Flash the rows whose match flipped, so the effect of each keystroke is visible.
  React.useEffect(() => {
    const now = new Map(results.map((r) => [r.file, r.match]))
    const before = previous.current
    previous.current = now
    if (!before || !listRef.current || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return
    listRef.current.querySelectorAll<HTMLElement>("[data-file]").forEach((row) => {
      const file = row.dataset.file as string
      if (before.has(file) && before.get(file) !== now.get(file))
        row.animate([{ backgroundColor: now.get(file) ? "rgb(16 185 129 / .35)" : "rgb(148 163 184 / .35)" }, { backgroundColor: "transparent" }], { duration: 350, easing: "ease-out" })
    })
  })

  const issueText = (i: GlobIssue) =>
    fill(t[i.kind], { count: "count" in i ? i.count : 0, total: files.length, example: "example" in i && i.example ? i.example : "" })
  const warning = issue
    ? { text: issueText(issue), fix: "fix" in issue ? issue.fix : undefined, id: issue.kind }
    : hint
      ? { text: fill(t.shallow, { pattern: hint.pattern, count: hint.added.length }), fix: hint.fix, id: "shallow" }
      : null

  return (
    <div data-slot="glob-input" className={cn("grid w-full min-w-0 max-w-sm grid-cols-1 content-start gap-1.5", className)}>
      <label htmlFor={inputId} className="w-fit text-sm font-medium">
        {label}
      </label>
      <input
        ref={ref}
        id={inputId}
        type="text"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        placeholder={placeholder}
        value={text}
        onChange={(event) => commit(event.target.value)}
        aria-describedby={`${inputId}-status`}
        data-warning={warning ? "" : undefined}
        className={fieldClass}
        {...props}
      />
      <div id={`${inputId}-status`} aria-live="polite" className="grid min-h-6 grid-cols-1 gap-1 text-xs">
        {warning && (
          <p data-warning-id={warning.id} className="flex gap-1.5 text-amber-700 dark:text-amber-400">
            <span className="flex h-6 shrink-0 items-center"><TriangleAlert aria-hidden className="size-3.5" /></span>
            <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
              <span className="py-1 [overflow-wrap:anywhere]">{warning.text}</span>
              {warning.fix && (
                <button type="button" onClick={() => commit(warning.fix as string)} className={cn(fixClass, "min-w-0 max-w-full")}>
                  <span className="truncate">{fill(t.use, { fix: warning.fix })}</span>
                </button>
              )}
            </span>
          </p>
        )}
        {text.trim() && <p className="py-1 text-muted-foreground">{fill(t.summary, { count, total: files.length })}</p>}
      </div>
      <ul ref={listRef} aria-label={t.list} className="max-h-60 overflow-auto rounded-md border py-1 font-mono text-xs">
        {results.map(({ file, match, excludedBy }) => (
          <li
            key={file}
            data-file={file}
            data-match={match || undefined}
            className="flex items-center gap-2 px-2.5 py-1 text-muted-foreground data-match:text-foreground"
          >
            {match ? (
              <Check aria-label="matches" className="size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
            ) : (
              <Minus aria-label="no match" className="size-3.5 shrink-0 opacity-50" />
            )}
            <span className={cn("min-w-0 truncate", excludedBy && "line-through decoration-muted-foreground/60")}>{file}</span>
            {excludedBy && <span className="ml-auto shrink-0 font-sans">{fill(t.excluded, { pattern: excludedBy })}</span>}
            {added.has(file) && (
              <span className="ml-auto shrink-0 rounded-sm border border-dashed border-amber-500/50 px-1 font-sans text-amber-700 dark:text-amber-400">{t.wouldAdd}</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
