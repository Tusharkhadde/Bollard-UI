"use client"

// Bollard UI — code-input · MIT licence · https://bollard-ui.vercel.app/components/code-input

import * as React from "react"
import { Braces, Check, CircleAlert, ShieldAlert, TriangleAlert, WandSparkles } from "lucide-react"

import { cn } from "@/lib/utils"

interface Rule {
  name: string
  /** Replacement, or a function when context decides (e.g. `—force` should become `--force`). */
  fix: string | ((text: string, index: number) => string)
  danger?: boolean
}

/** A dash before a long flag (`—force`, `–dry-run`) was `--`; before `-rf` or between words it was `-`. */
const flagDash = (text: string, index: number) =>
  /^$|\s/.test(text[index - 1] ?? "") && /^[a-z][a-z\d]*(-[a-z\d]+)+|^[a-z][a-z\d]{3,}/i.test(text.slice(index + 1)) ? "--" : "-"

const RULES: Record<string, Rule> = {
  "“": { name: "curly double quote", fix: '"' },
  "”": { name: "curly double quote", fix: '"' },
  "„": { name: "low double quote", fix: '"' },
  "‘": { name: "curly single quote", fix: "'" },
  "’": { name: "curly single quote", fix: "'" },
  "‚": { name: "low single quote", fix: "'" },
  "–": { name: "en dash", fix: flagDash },
  "—": { name: "em dash", fix: flagDash },
  "−": { name: "minus sign", fix: "-" },
  "…": { name: "ellipsis character", fix: "..." },
  "\u00a0": { name: "non-breaking space", fix: " " },
  "\u200b": { name: "zero-width space", fix: "" },
  "\u2060": { name: "word joiner", fix: "" },
  "\ufeff": { name: "byte order mark", fix: "" },
  "\u00ad": { name: "soft hyphen", fix: "" },
  "\u200c": { name: "zero-width non-joiner", fix: "" },
  "\u200d": { name: "zero-width joiner", fix: "" },
  "\u180e": { name: "Mongolian vowel separator", fix: "" },
  "\u3164": { name: "Hangul filler", fix: "" },
  "\u2028": { name: "line separator", fix: "\n" },
  "\u2029": { name: "paragraph separator", fix: "\n" },
}
for (const c of "\u202a\u202b\u202c\u202d\u202e\u2066\u2067\u2068\u2069") RULES[c] = { name: "hidden text-direction control", fix: "", danger: true }
/** Unicode tag characters (U+E0000–E007F) are invisible ASCII look-alikes used to smuggle instructions into prompts and code. */
const TAG: Rule = { name: "hidden tag character", fix: "", danger: true }
const ruleFor = (char: string) => RULES[char] ?? ((char.codePointAt(0) ?? 0) >= 0xe0000 && (char.codePointAt(0) ?? 0) <= 0xe007f ? TAG : undefined)

export interface CodeIssue {
  index: number
  line: number
  column: number
  char: string
  name: string
  replacement: string
  danger: boolean
}

/** Finds every character a phone, word processor or chat app swapped in for plain ASCII. */
export function findCodeIssues(text: string): CodeIssue[] {
  const issues: CodeIssue[] = []
  let line = 1
  let lineStart = 0
  for (let i = 0; i < text.length; i += text.codePointAt(i)! > 0xffff ? 2 : 1) {
    const char = String.fromCodePoint(text.codePointAt(i)!)
    if (char === "\n") {
      line++
      lineStart = i + 1
      continue
    }
    const rule = ruleFor(char)
    if (!rule) continue
    const replacement = typeof rule.fix === "string" ? rule.fix : rule.fix(text, i)
    issues.push({ index: i, line, column: i - lineStart + 1, char, name: rule.name, replacement, danger: !!rule.danger })
  }
  return issues
}

/** Replaces every issue with its plain ASCII replacement. */
export function fixCodeIssues(text: string, issues = findCodeIssues(text)) {
  let out = ""
  let last = 0
  for (const issue of issues) {
    out += text.slice(last, issue.index) + issue.replacement
    last = issue.index + issue.char.length
  }
  return out + text.slice(last)
}

/** JSON.parse error with a line and column, read from V8 or Firefox messages. */
export function jsonError(text: string): { message: string; line?: number; column?: number } | null {
  if (!text.trim()) return null
  try {
    JSON.parse(text)
    return null
  } catch (error) {
    const raw = error instanceof Error ? error.message : String(error)
    const message = raw.replace(/^JSON\.parse: /, "").replace(/\s*(in JSON )?at (position|line) \d+.*$/, "")
    const lc = raw.match(/line (\d+) column (\d+)/)
    if (lc) return { message, line: Number(lc[1]), column: Number(lc[2]) }
    const pos = raw.match(/position (\d+)/)
    if (!pos) return { message }
    const before = text.slice(0, Number(pos[1])).split("\n")
    return { message, line: before.length, column: before[before.length - 1].length + 1 }
  }
}

const show = (char: string) => (char.trim() && !ruleFor(char)?.danger && char !== "\u00ad" && !/[\u200c\u200d\u180e\u3164]/.test(char) ? char : "␣")

/** Every sentence the field shows. Override any of them to reword or translate. */
export const CODE_INPUT_MESSAGES = {
  found: (count: number, names: string) => `${count} character${count === 1 ? "" : "s"} won't work in code: ${names}.`,
  danger: "Hidden characters can make code display differently from how it runs.",
  fix: (count: number) => `Fix ${count} character${count === 1 ? "" : "s"}`,
  invalidJson: (line?: number, column?: number) => `Invalid JSON${line ? ` at line ${line}, column ${column}` : ""}`,
  likelyCause: ". The characters above are the likely cause.",
  validJson: "Valid JSON",
  removed: "removed",
}

export interface CodeInputProps
  extends Omit<React.ComponentProps<"textarea">, "value" | "defaultValue" | "onChange"> {
  /** Visible label. */
  label?: string
  /** Helper text shown under the field while there is nothing to warn about. */
  hint?: string
  /** Controlled contents. */
  value?: string
  /** Initial contents when uncontrolled. */
  defaultValue?: string
  /** Called on every edit, including the one-tap fix. */
  onValueChange?: (value: string) => void
  /** Validate the contents as JSON and point at the line and column of the error. */
  json?: boolean
  /** Text shown when the JSON parses. Same as `messages.validJson`. */
  validJsonMessage?: string
  /** Reword or translate any message. */
  messages?: Partial<typeof CODE_INPUT_MESSAGES>
}

const fieldClass =
  "min-h-9 w-full min-w-0 resize-y rounded-md border bg-transparent px-3 py-2 font-mono text-base leading-relaxed shadow-xs transition-[color,box-shadow] outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 md:text-[13px] dark:bg-input/30 data-warning:border-amber-500 dark:data-warning:border-amber-400 data-danger:border-red-500 dark:data-danger:border-red-400"
const fixClass =
  "inline-flex h-6 items-center gap-1 rounded-md border border-amber-500/40 px-2 font-medium text-amber-900 transition-colors hover:bg-amber-500/10 dark:text-amber-200 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"

/** One source line with each bad character highlighted. */
function MarkedLine({ number, content, issues, removed }: { number: number; content: string; issues: CodeIssue[]; removed: string }) {
  let cursor = 0
  return (
    <div className="flex gap-3 px-2 py-1 whitespace-pre">
      <span className="w-5 shrink-0 text-right text-muted-foreground select-none">{number}</span>
      <span>
        {issues.map((issue) => {
          const start = cursor
          cursor = issue.column - 1 + issue.char.length
          return (
            <React.Fragment key={issue.index}>
              {content.slice(start, issue.column - 1)}
              <mark
                title={`${issue.name} at ${issue.line}:${issue.column} → ${issue.replacement ? JSON.stringify(issue.replacement) : removed}`}
                className="rounded-sm bg-red-200 px-px text-red-900 dark:bg-red-900/70 dark:text-red-100"
              >
                {show(issue.char)}
              </mark>
            </React.Fragment>
          )
        })}
        {content.slice(cursor)}
      </span>
    </div>
  )
}

/**
 * A field for commands, JSON, API keys and env vars that phones and word processors can't sabotage.
 * Autocorrect, capitalization, spellcheck and Grammarly are off, and any curly quote, dash, ellipsis
 * or invisible character that slipped in is pointed out by line and column with a one-tap fix.
 */
export function CodeInput({
  label = "Command",
  hint,
  value,
  defaultValue = "",
  onValueChange,
  json = false,
  validJsonMessage,
  messages,
  rows = 3,
  id,
  className,
  ...props
}: CodeInputProps) {
  const t = { ...CODE_INPUT_MESSAGES, ...messages, ...(validJsonMessage ? { validJson: validJsonMessage } : {}) }
  const [inner, setInner] = React.useState(defaultValue)
  const autoId = React.useId()
  const inputId = id ?? autoId
  const text = value ?? inner
  const issues = React.useMemo(() => findCodeIssues(text), [text])
  const parseError = React.useMemo(() => (json ? jsonError(text) : null), [json, text])

  const update = (next: string) => {
    if (value === undefined) setInner(next)
    onValueChange?.(next)
  }

  const lines = text.split("\n")
  const problemLines = [...new Set(issues.map((issue) => issue.line))]
  const danger = issues.some((issue) => issue.danger)
  const names = [...new Set(issues.map((issue) => issue.name))].join(", ")
  const tone = danger ? "text-red-700 dark:text-red-400" : "text-amber-700 dark:text-amber-400"

  return (
    <div data-slot="code-input" className={cn("grid w-full max-w-sm gap-1.5", className)}>
      <label htmlFor={inputId} className="flex w-fit items-center gap-1.5 text-sm font-medium">
        {json && <Braces aria-hidden className="size-4 text-muted-foreground" />}
        {label}
      </label>
      <textarea
        id={inputId}
        rows={rows}
        value={text}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        translate="no"
        data-gramm="false"
        data-enable-grammarly="false"
        aria-invalid={!!parseError || issues.length > 0 || undefined}
        aria-describedby={`${inputId}-hint`}
        data-warning={issues.length || parseError ? "" : undefined}
        data-danger={danger ? "" : undefined}
        onChange={(event) => update(event.target.value)}
        className={fieldClass}
        {...props}
      />
      <div id={`${inputId}-hint`} aria-live="polite" className="grid min-h-6 gap-1.5 text-xs">
        {issues.length > 0 && (
          <>
            <p className={cn("flex gap-1.5", tone)}>
              <span className="flex h-6 shrink-0 items-center">
                {danger ? <ShieldAlert aria-hidden className="size-3.5" /> : <TriangleAlert aria-hidden className="size-3.5" />}
              </span>
              <span className="flex min-w-0 flex-wrap items-center gap-x-2">
                <span className="py-1">
                  {t.found(issues.length, names)}
                  {danger && ` ${t.danger}`}
                </span>
                <button type="button" onClick={() => update(fixCodeIssues(text, issues))} className={fixClass}>
                  <WandSparkles aria-hidden className="size-3.5" />
                  {t.fix(issues.length)}
                </button>
              </span>
            </p>
            <div className="max-h-28 overflow-auto rounded-md border bg-muted/40 py-0.5 font-mono text-[12px] text-foreground">
              {problemLines.map((line) => (
                <MarkedLine key={line} number={line} content={lines[line - 1]} issues={issues.filter((issue) => issue.line === line)} removed={t.removed} />
              ))}
            </div>
          </>
        )}
        {parseError && (
          <p className="flex gap-1.5 py-1 text-amber-700 dark:text-amber-400">
            <CircleAlert aria-hidden className="mt-px size-3.5 shrink-0" />
            <span>
              {t.invalidJson(parseError.line, parseError.column)}
              {issues.length > 0 ? t.likelyCause : `: ${parseError.message}`}
            </span>
          </p>
        )}
        {json && !parseError && text.trim() && (
          <p className="flex items-center gap-1.5 py-1 text-emerald-700 dark:text-emerald-400">
            <Check aria-hidden className="size-3.5" />
            {t.validJson}
          </p>
        )}
        {!issues.length && !parseError && !(json && text.trim()) && hint && <p className="py-1 text-muted-foreground">{hint}</p>}
      </div>
    </div>
  )
}
