"use client"

// Bollard UI — gitignore-check · MIT licence · https://bollard-ui.vercel.app/components/gitignore-check

import * as React from "react"
import { CircleAlert, CircleCheck, Copy, EyeOff, FileWarning, Info, TriangleAlert, WandSparkles } from "lucide-react"

import { cn } from "@/lib/utils"
import { checkGitignore, checkIgnore, parseFileList, parseGitignore, sensitiveKind, toLines, untrackCommand, type GitignoreIssue } from "@/registry/default/gitignore-check/gitignore"

export { checkGitignore, checkIgnore, parseFileList, parseGitignore, patternToRegex, sensitiveKind, trimTrailingSpaces, untrackCommand, type FileEntry, type GitignoreIssue, type GitignoreIssueKind, type GitignoreRule, type IgnoreVerdict } from "@/registry/default/gitignore-check/gitignore"

export const GITIGNORE_CHECK_MESSAGES = {
  label: ".gitignore",
  placeholder: "node_modules/\n.env",
  clean: "No problems found.",
  problems: "{errors} to fix · {warnings} to review",
  line: "Line {line}",
  selectLine: "Select line {line}",
  fixAll: "Fix {count}",
  fix: "Fix",
  "inline-comment": "# only starts a comment at the beginning of a line, so Git looks for a file literally named \"{detail} # …\" and ignores nothing.",
  "fix-inline-comment": "Remove the comment",
  "trailing-tab": "Ends in a tab or non-breaking space. Git only trims plain spaces, so this pattern never matches.",
  "trailing-space": "Trailing spaces. Git trims these, so it still works.",
  "fix-trailing-space": "Trim",
  "leading-space": "Starts with a space, so it only matches names that start with a space.",
  "fix-leading-space": "Remove the space",
  backslash: "Backslash escapes the next character in .gitignore; folders are separated with /.",
  "fix-backslash": "Use /",
  "dot-slash": "Git doesn't understand ./ here, so this matches nothing. Use / to mean the repo root.",
  "fix-dot-slash": "Use /",
  "dir-blocks-negation": "This ! can't re-include the file: {detail} excludes its whole folder, and Git never looks inside an excluded folder.",
  "fix-dir-blocks-negation": "Ignore the folder's contents instead",
  "negation-overridden": "{detail} comes later and ignores this file again. The last matching line wins.",
  "fix-negation-overridden": "Move below it",
  "anchored-misses": "The leading / only matches at the repo root, so {detail} isn't ignored.",
  "fix-anchored-misses": "Match at any depth",
  "not-ignored": "Not ignored, so it would be committed: {detail}.",
  "fix-not-ignored": "Add to .gitignore",
  tracked: "Already committed. .gitignore doesn't untrack files, so Git keeps tracking these:",
  trackedSecret: "Committed secrets stay in history: rotate them after untracking.",
  copyCommand: "Copy git rm --cached",
  copied: "Copied",
  copiedStatus: "Command copied. Run it, then commit.",
  copyFailed: "Couldn't reach the clipboard. Select the command and copy it.",
  filesLabel: "Test your files",
  filesHint: "Paste paths, git ls-files or git status --porcelain output.",
  filesPlaceholder: ".env\nsrc/index.ts",
  trackedLabel: "These paths are already committed",
  results: "{ignored} of {total} ignored",
  ignoredBy: "Ignored · line {line}: {rule}",
  ignoredDir: "Ignored with its folder {dir}/ · line {line}: {rule}",
  blocked: "Still ignored · line {neg} can't re-include it",
  includedBy: "Kept · line {line}: {rule}",
  kept: "Not ignored",
  stillTracked: "Ignored, but still tracked",
  more: "+{count} more",
}
export type GitignoreCheckMessages = typeof GITIGNORE_CHECK_MESSAGES

const fill = (text: string, values: Record<string, string | number>) => text.replace(/\{(\w+)\}/g, (match, key: string) => String(values[key] ?? match))
const tones = { error: "text-red-700 dark:text-red-400", warning: "text-amber-700 dark:text-amber-400", info: "text-muted-foreground" }
const icons = { error: CircleAlert, warning: TriangleAlert, info: Info }
const fixClass = (error: boolean) =>
  cn(
    "inline-flex min-h-6 max-w-full items-center gap-1 rounded-md border px-2 text-left font-medium [overflow-wrap:anywhere] transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-50",
    error ? "border-red-500/40 text-red-800 hover:bg-red-500/10 dark:text-red-200" : "border-amber-500/40 text-amber-900 hover:bg-amber-500/10 dark:text-amber-200",
  )
const area = "w-full min-w-0 resize-y rounded-md border bg-transparent px-3 py-2 font-mono text-base leading-5 shadow-xs transition-[color,box-shadow] outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-destructive md:text-xs dark:bg-input/30"
const SHOWN = 40

function useSettled(text: string, delay = 900) {
  const [settled, setSettled] = React.useState(text)
  React.useEffect(() => {
    const timer = setTimeout(() => setSettled(text), delay)
    return () => clearTimeout(timer)
  }, [text, delay])
  return settled
}

export interface GitignoreCheckProps extends Omit<React.ComponentProps<"textarea">, "value" | "defaultValue" | "onChange"> {
  /** Controlled .gitignore text. */
  value?: string
  /** Initial .gitignore text when uncontrolled. */
  defaultValue?: string
  /** Called with the new text on every edit or fix. */
  onValueChange?: (value: string) => void
  /** Controlled file list (one path per line; `git status --porcelain` lines also work). */
  files?: string
  /** Initial file list when uncontrolled. */
  defaultFiles?: string
  /** Called when the file list is edited. */
  onFilesChange?: (files: string) => void
  /** Paths you know are committed, e.g. from `git ls-files`. */
  trackedFiles?: string[]
  /** Start with "These paths are already committed" ticked. */
  defaultPathsTracked?: boolean
  /** Visible label; shorthand for `messages.label`. */
  label?: string
  /** Every visible string. `{line}`, `{detail}`, `{rule}`, `{count}` and friends are filled in. */
  messages?: Partial<GitignoreCheckMessages>
}

/**
 * A .gitignore editor that shows what Git will really ignore. It catches inline `#` comments, trailing tabs,
 * leading spaces, backslashes and `./`, `!` lines that can't re-include a file inside an excluded folder or are
 * overridden by a later line, `/` anchors that miss nested folders, `.env`, keys and node_modules left out, and
 * files already committed that .gitignore won't untrack (with the `git rm --cached` command).
 */
export function GitignoreCheck({
  value,
  defaultValue = "",
  onValueChange,
  files,
  defaultFiles = "",
  onFilesChange,
  trackedFiles,
  defaultPathsTracked = false,
  label,
  messages,
  rows = 7,
  id,
  className,
  ref,
  "aria-describedby": describedBy,
  ...props
}: GitignoreCheckProps) {
  const t = { ...GITIGNORE_CHECK_MESSAGES, ...messages, ...(label !== undefined && { label }) }
  const [inner, setInner] = React.useState(defaultValue)
  const [innerFiles, setInnerFiles] = React.useState(defaultFiles)
  const [pathsTracked, setPathsTracked] = React.useState(defaultPathsTracked)
  const [copied, setCopied] = React.useState(false)
  const [notice, setNotice] = React.useState("")
  const textarea = React.useRef<HTMLTextAreaElement>(null)
  const list = React.useRef<HTMLUListElement>(null)
  const refocus = React.useRef<number | null>(null)
  const autoId = React.useId()
  const inputId = id ?? autoId
  const text = typeof (value ?? inner) === "string" ? (value ?? inner) : ""
  const fileText = typeof (files ?? innerFiles) === "string" ? (files ?? innerFiles) : ""
  React.useImperativeHandle(ref, () => textarea.current as HTMLTextAreaElement)

  const entries = React.useMemo(() => parseFileList(fileText, pathsTracked, trackedFiles), [fileText, pathsTracked, trackedFiles])
  const rules = React.useMemo(() => parseGitignore(text), [text])
  const issues = React.useMemo(() => checkGitignore(text, entries), [text, entries])
  const rowsText = React.useMemo(() => toLines(text), [text])
  const counted = issues.filter((issue) => issue.severity !== "info")
  const errors = counted.filter((issue) => issue.severity === "error").length
  const fixable = counted.filter((issue) => issue.fix !== undefined)
  const verdicts = entries.map((entry) => ({ entry, verdict: checkIgnore(rules, entry.path) }))
  const summary = !text.trim() && !entries.length ? "" : counted.length ? fill(t.problems, { errors, warnings: counted.length - errors }) : t.clean
  const settled = useSettled(summary)

  const update = (next: string) => {
    if (value === undefined) setInner(next)
    onValueChange?.(next)
  }
  const updateFiles = (next: string) => {
    if (files === undefined) setInnerFiles(next)
    onFilesChange?.(next)
  }
  React.useEffect(() => {
    if (refocus.current === null) return
    const buttons = list.current?.querySelectorAll<HTMLButtonElement>("button[data-fix]") ?? []
    ;(buttons[Math.min(refocus.current, buttons.length - 1)] ?? textarea.current)?.focus()
    refocus.current = null
  }, [text])
  const fix = (issue: GitignoreIssue, button: HTMLElement) => {
    refocus.current = [...(list.current?.querySelectorAll("button[data-fix]") ?? [])].indexOf(button)
    update(issue.fix ?? text)
  }
  /** Applies fixes one at a time, re-checking in between, so line-based fixes never collide. */
  const fixAll = () => {
    let next = text
    for (let round = 0; round < 20; round++) {
      const first = checkGitignore(next, entries).find((issue) => issue.severity !== "info" && issue.fix !== undefined)
      if (!first?.fix || first.fix === next) break
      next = first.fix
    }
    refocus.current = 0
    update(next)
  }
  const reveal = (line: number) => {
    const el = textarea.current
    if (!el) return
    const start = rowsText.slice(0, line).reduce((sum, row) => sum + row.length + (text.includes("\r\n") ? 2 : 1), text.startsWith("\uFEFF") ? 1 : 0)
    el.focus()
    el.setSelectionRange(start, start + (rowsText[line]?.length ?? 0))
  }
  const copy = async (command: string) => {
    try {
      await navigator.clipboard.writeText(command)
      setCopied(true)
      setNotice(t.copiedStatus)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      setNotice(t.copyFailed)
    }
  }
  React.useEffect(() => setNotice(""), [text, fileText])

  const ruleText = (line: number) => rowsText[line]?.trim() ?? ""
  const describe = (issue: GitignoreIssue) => fill((t as Record<string, string>)[issue.kind] ?? "", { detail: issue.detail ?? "" })

  return (
    <div data-slot="gitignore-check" className={cn("grid w-full max-w-xl min-w-0 grid-cols-[minmax(0,1fr)] gap-1.5 text-sm", className)}>
      <label htmlFor={inputId} className="w-fit font-mono font-medium">
        {t.label}
      </label>
      <textarea
        ref={textarea}
        id={inputId}
        rows={rows}
        value={text}
        onChange={(event) => update(event.target.value)}
        spellCheck={false}
        autoCapitalize="none"
        autoCorrect="off"
        wrap="off"
        placeholder={t.placeholder}
        aria-invalid={errors > 0 || undefined}
        aria-describedby={[describedBy, `${inputId}-status`].filter(Boolean).join(" ")}
        className={area}
        {...props}
      />
      <span role="status" className="sr-only">
        {notice || settled}
      </span>
      <div id={`${inputId}-status`} className="mt-1.5 flex min-h-6 flex-wrap items-center justify-between gap-2 text-xs empty:hidden">
        {summary && (
          <span className={cn("flex items-center gap-1.5", counted.length ? "text-muted-foreground" : "text-emerald-700 dark:text-emerald-400")}>
            {counted.length ? <TriangleAlert aria-hidden className="size-3.5 text-amber-600 dark:text-amber-400" /> : <CircleCheck aria-hidden className="size-3.5" />}
            {summary}
          </span>
        )}
        {fixable.length > 1 && (
          <button type="button" onClick={fixAll} className={fixClass(false)}>
            <WandSparkles aria-hidden className="size-3.5" />
            {fill(t.fixAll, { count: fixable.length })}
          </button>
        )}
      </div>
      {issues.length > 0 && (
        <ul ref={list} className="grid gap-1.5 text-xs">
          {issues.map((issue, index) => {
            const Icon = icons[issue.severity]
            const stuck = issue.kind === "tracked" ? (issue.detail ?? "").split("\n") : []
            return (
              <li key={`${issue.kind}-${issue.line ?? index}`} className={cn("flex gap-1.5", tones[issue.severity])}>
                <span className="flex h-6 shrink-0 items-center">
                  <Icon aria-hidden className="size-3.5" />
                </span>
                <span className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="min-w-0 py-1 [overflow-wrap:anywhere]">
                    {issue.line !== undefined && (
                      <button type="button" onClick={() => reveal(issue.line!)} aria-label={fill(t.selectLine, { line: issue.line + 1 })} className="mr-1 rounded font-mono whitespace-nowrap text-muted-foreground tabular-nums underline-offset-2 outline-none hover:text-foreground hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50">
                        {fill(t.line, { line: issue.line + 1 })}
                      </button>
                    )}
                    {describe(issue)}
                    {issue.kind === "tracked" && issue.severity === "error" && <> {t.trackedSecret}</>}
                  </span>
                  {issue.fix !== undefined && (
                    <button type="button" data-fix="" onClick={(event) => fix(issue, event.currentTarget)} className={fixClass(issue.severity === "error")}>
                      {(t as Record<string, string>)[`fix-${issue.kind}`] ?? t.fix}
                    </button>
                  )}
                  {stuck.length > 0 && (
                    <span className="grid w-full min-w-0 gap-1.5">
                      <code className="block rounded-md bg-muted px-2 py-1.5 font-mono text-foreground [overflow-wrap:anywhere] select-all">{untrackCommand(stuck)}</code>
                      <button type="button" onClick={() => copy(untrackCommand(stuck))} className={cn(fixClass(issue.severity === "error"), "w-fit")}>
                        {copied ? <CircleCheck aria-hidden className="size-3.5" /> : <Copy aria-hidden className="size-3.5" />}
                        {copied ? t.copied : t.copyCommand}
                      </button>
                    </span>
                  )}
                </span>
              </li>
            )
          })}
        </ul>
      )}
      <div className="mt-2 grid gap-1.5 border-t pt-3">
        <label htmlFor={`${inputId}-files`} className="w-fit text-xs font-medium">
          {t.filesLabel}
        </label>
        <textarea id={`${inputId}-files`} rows={4} value={fileText} onChange={(event) => updateFiles(event.target.value)} spellCheck={false} autoCapitalize="none" autoCorrect="off" wrap="off" placeholder={t.filesPlaceholder} aria-describedby={`${inputId}-files-hint ${inputId}-results-count`} className={area} />
        <p id={`${inputId}-files-hint`} className="text-xs text-muted-foreground">
          {t.filesHint}
        </p>
        <label className="flex w-fit items-center gap-2 text-xs">
          <input type="checkbox" checked={pathsTracked} onChange={(event) => setPathsTracked(event.target.checked)} className="size-4 rounded border accent-primary outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50" />
          {t.trackedLabel}
        </label>
        <div id={`${inputId}-results`} className="grid gap-1 empty:hidden">
          {verdicts.length > 0 && <p id={`${inputId}-results-count`} className="text-xs font-medium text-muted-foreground">{fill(t.results, { ignored: verdicts.filter((row) => row.verdict.ignored).length, total: verdicts.length })}</p>}
          {verdicts.length > 0 && (
            <ul className="grid gap-1 text-xs">
              {verdicts.slice(0, SHOWN).map(({ entry, verdict }) => {
                const risky = !verdict.ignored && sensitiveKind(entry.path) !== undefined
                const stuck = verdict.ignored && entry.tracked
                const reason = verdict.ignored
                  ? verdict.blocked
                    ? fill(t.blocked, { neg: verdict.blocked.line + 1 })
                    : fill(verdict.viaDir ? t.ignoredDir : t.ignoredBy, { dir: verdict.viaDir ?? "", line: verdict.rule.line + 1, rule: ruleText(verdict.rule.line) })
                  : verdict.rule
                    ? fill(t.includedBy, { line: verdict.rule.line + 1, rule: ruleText(verdict.rule.line) })
                    : t.kept
                const Icon = risky ? FileWarning : verdict.ignored ? EyeOff : CircleCheck
                return (
                  <li key={entry.path} className={cn("grid grid-cols-[auto_minmax(0,1fr)] gap-x-1.5", risky ? "text-red-700 dark:text-red-400" : stuck ? "text-amber-700 dark:text-amber-400" : "text-muted-foreground")}>
                    <Icon aria-hidden className="mt-0.5 size-3.5" />
                    <span className="min-w-0 [overflow-wrap:anywhere]">
                      <span className={cn("font-mono", !verdict.ignored && !risky && "text-foreground")}>{entry.path}</span> · {stuck ? t.stillTracked : reason}
                    </span>
                  </li>
                )
              })}
            </ul>
          )}
          {verdicts.length > SHOWN && <p className="text-xs text-muted-foreground">{fill(t.more, { count: verdicts.length - SHOWN })}</p>}
        </div>
      </div>
    </div>
  )
}
