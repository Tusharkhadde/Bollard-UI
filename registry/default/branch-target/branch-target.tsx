"use client"

import * as React from "react"
import { ChevronDown, GitBranch, GitMerge, LoaderCircle, Rocket, TriangleAlert } from "lucide-react"

import { cn } from "@/lib/utils"

export interface BranchInfo {
  name: string
  /** Commits on this branch that the head branch doesn't have yet. */
  behind?: number
  /** Commits the head branch would bring into this branch. */
  ahead?: number
  /** A long-lived branch or environment (main, release/*, production). */
  protected?: boolean
}

/** Which branches may go into `target`. Both sides accept `*` wildcards; the first rule matching the target applies. */
export interface TargetRule {
  target: string
  from: string[]
}

export type TargetIssueKind = "same" | "wrong-base" | "foreign" | "behind"

export interface TargetIssue {
  kind: TargetIssueKind
  /** wrong-base: a branch the rules allow, to switch to in one tap. */
  suggestion?: string
  /** behind: commits behind. foreign: commits that aren't the head's own. */
  count?: number
  /** wrong-base: the patterns the target accepts, e.g. "develop, release/*". */
  allowed?: string
}

/** A common git-flow: only release, hotfix and develop reach main; features go through develop. */
export const DEFAULT_TARGET_RULES: TargetRule[] = [
  { target: "main", from: ["develop", "release/*", "hotfix/*"] },
  { target: "master", from: ["develop", "release/*", "hotfix/*"] },
  { target: "release/*", from: ["develop", "hotfix/*", "fix/*", "bugfix/*"] },
]

const glob = (pattern: string) => new RegExp(`^${pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*")}$`)
const matches = (name: string, patterns: string[]) => patterns.some((pattern) => glob(pattern).test(name))

/** True when the rules let `head` go into `target`. Targets without a rule accept anything. */
export function isAllowedTarget(head: string, target: string, rules: TargetRule[] = DEFAULT_TARGET_RULES) {
  const rule = rules.find((r) => glob(r.target).test(target))
  return !rule || matches(head, rule.from)
}

/**
 * Checks a merge or deploy target: the head itself, a base the rules don't
 * allow (feature → main), commits the PR drags in that aren't the head's own
 * (cut from the wrong branch), and a head that is behind the target.
 */
export function checkTarget(options: {
  head: string
  target: BranchInfo
  branches: BranchInfo[]
  rules?: TargetRule[]
  forkedFrom?: string
  headCommits?: number
}): TargetIssue[] {
  const { head, target, branches, rules = DEFAULT_TARGET_RULES, forkedFrom, headCommits } = options
  if (target.name === head) return [{ kind: "same" }]
  const issues: TargetIssue[] = []
  const rule = rules.find((r) => glob(r.target).test(target.name))
  if (rule && !matches(head, rule.from)) {
    const allowed = branches.filter((b) => b.name !== head && isAllowedTarget(head, b.name, rules) && (b.protected || b.name === forkedFrom))
    const suggestion = allowed.find((b) => b.name === forkedFrom)?.name ?? allowed[0]?.name
    issues.push({ kind: "wrong-base", suggestion, allowed: rule.from.join(", ") })
  }
  if (headCommits !== undefined && (target.ahead ?? 0) > headCommits) issues.push({ kind: "foreign", count: (target.ahead ?? 0) - headCommits })
  if ((target.behind ?? 0) > 0) issues.push({ kind: "behind", count: target.behind })
  return issues
}

const DEFAULT_MESSAGES: Record<TargetIssueKind, string> = {
  same: "A branch can't {verb} into itself. Pick another target.",
  "wrong-base": "Only {allowed} go into {target}.",
  foreign: "This also brings {commits} that aren't yours, from {forkedFrom}.",
  behind: "{head} is {commits} behind {target}, so it was tested against old code.",
}
const DEPLOY_MESSAGES: Partial<Record<TargetIssueKind, string>> = {
  behind: "{target} has {commits} that {head} doesn't. Deploying would drop that work.",
}
const commits = (count: number) => `${count} commit${count === 1 ? "" : "s"}`

export interface BranchTargetProps extends Omit<React.ComponentProps<"div">, "defaultValue"> {
  /** The branch being merged or deployed. */
  head: string
  /** Possible targets with their ahead/behind counts. */
  branches: BranchInfo[]
  /** Selected target (controlled). */
  value?: string
  /** Selected target when uncontrolled. */
  defaultValue?: string
  /** Called with the newly chosen target branch. */
  onValueChange?: (target: string) => void
  /** Allowed head → target pairs. Defaults to git-flow. */
  rules?: TargetRule[]
  /** The branch the head was cut from, if known. Enables the "commits that aren't yours" check. */
  forkedFrom?: string
  /** Commits that are the head's own work. */
  headCommits?: number
  /** Picks the copy: "merge" for pull requests, "deploy" for environments. */
  mode?: "merge" | "deploy"
  /** Brings the head up to date with the target. May return a promise; shows a pending state. */
  onUpdate?: (target: string) => void | Promise<void>
  /** Visible label for the target picker. */
  label?: string
  /** Readback under the picker. `{head}`, `{target}`, `{count}` and `{commits}` are filled in. */
  summaryText?: string
  /** Warning text per issue. `{head}`, `{target}`, `{count}`, `{commits}` ("3 commits"), `{allowed}`, `{forkedFrom}`, `{verb}` are filled in. */
  messages?: Partial<Record<TargetIssueKind, string>>
  /** Label of the one-tap fix. `{suggestion}` is filled in. */
  switchLabel?: string
  /** `{head}` and `{target}` are filled in. */
  updateLabel?: string
  /** Update button text while onUpdate runs. */
  updatingLabel?: string
  /** Badge text for protected branches. */
  protectedLabel?: string
  /** How far the head is behind a target, in the picker. `{head}`, `{count}` and `{commits}` are filled in. */
  behindLabel?: string
  /** Called whenever the issues for the selected target change, so a form can block its submit on `blocking`. */
  onIssuesChange?: (issues: TargetIssue[], state: { blocking: boolean; target: string }) => void
}

const fill = (text: string, values: Record<string, string | number>) =>
  text.replace(/\{(\w+)\}/g, (match, key: string) => String(values[key] ?? match))
const fixClass = (danger: boolean) =>
  cn(
    "inline-flex h-6 items-center gap-1 rounded-md border px-2 font-medium transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-60",
    danger ? "border-red-500/40 text-red-800 hover:bg-red-500/10 dark:text-red-200" : "border-amber-500/40 text-amber-900 hover:bg-amber-500/10 dark:text-amber-200",
  )

/**
 * A merge or deploy target picker that catches the classic slips: a feature
 * branch opened against main instead of develop, a branch cut from the wrong
 * base that drags unreleased commits along, and a head that is behind its
 * target. Each warning comes with a one-tap fix (switch target, update branch).
 */
export function BranchTarget({
  head,
  branches,
  value,
  defaultValue,
  onValueChange,
  rules = DEFAULT_TARGET_RULES,
  forkedFrom,
  headCommits,
  mode = "merge",
  onUpdate,
  label = mode === "merge" ? "Merge into" : "Deploy to",
  summaryText = mode === "merge" ? "Merges {commits} from {head} into {target}." : "Deploys {commits} from {head} to {target}.",
  messages,
  switchLabel = "Switch to {suggestion}",
  updateLabel = mode === "merge" ? "Update branch" : "Update {head}",
  updatingLabel = "Updating…",
  protectedLabel = "protected",
  behindLabel = mode === "merge" ? "{head} is {commits} behind" : "{commits} not in {head}",
  onIssuesChange,
  id,
  className,
  ...props
}: BranchTargetProps) {
  const [inner, setInner] = React.useState(defaultValue ?? branches[0]?.name ?? "")
  const [updating, setUpdating] = React.useState(false)
  const autoId = React.useId()
  const selectId = id ?? autoId
  const select = React.useRef<HTMLSelectElement>(null)
  const selected = value ?? inner
  const target = branches.find((b) => b.name === selected) ?? { name: selected }
  const issues = checkTarget({ head, target, branches, rules, forkedFrom, headCommits })
  const text = { ...DEFAULT_MESSAGES, ...(mode === "deploy" ? DEPLOY_MESSAGES : {}), ...messages }
  const values = { head, target: target.name, forkedFrom: forkedFrom ?? "another branch", verb: mode, count: 0 }
  const blocking = issues.some((issue) => issue.kind === "same" || issue.kind === "wrong-base")
  const details = (b: BranchInfo) =>
    [b.protected && protectedLabel, b.behind && fill(behindLabel, { head, count: b.behind, commits: commits(b.behind) })].filter(Boolean).join(" · ")
  const selectedDetails = details(target)

  // Report only real changes, so a parent can store the issues in state without looping.
  const reportIssues = React.useRef(onIssuesChange)
  reportIssues.current = onIssuesChange
  const issueKey = `${target.name}|${JSON.stringify(issues)}`
  React.useEffect(() => {
    reportIssues.current?.(issues, { blocking, target: target.name })
  }, [issueKey]) // eslint-disable-line react-hooks/exhaustive-deps

  const choose = (next: string) => {
    if (value === undefined) setInner(next)
    onValueChange?.(next)
  }
  const update = async () => {
    if (updating) return
    setUpdating(true)
    try {
      await onUpdate?.(target.name)
      select.current?.focus()
    } catch {
      // The caller surfaces the error; the warning simply stays.
    } finally {
      setUpdating(false)
    }
  }
  const Icon = mode === "merge" ? GitMerge : Rocket

  return (
    <div data-slot="branch-target" data-state={blocking ? "invalid" : issues.length ? "warning" : "ok"} className={cn("grid w-full max-w-md gap-1.5 text-sm", className)} {...props}>
      <label htmlFor={selectId} className="w-fit font-medium">
        {label}
      </label>
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <span className="inline-flex h-9 max-w-full min-w-0 items-center gap-1.5 rounded-md bg-muted px-3 font-mono text-xs">
          <GitBranch aria-hidden className="size-3.5 shrink-0 text-muted-foreground" />
          <span className="truncate">{head}</span>
        </span>
        <Icon aria-hidden className="size-4 shrink-0 text-muted-foreground" />
        {/* The native select sits invisibly over a readout that can wrap, so long names and counts are never cut off on phones. */}
        <div
          data-invalid={blocking || undefined}
          data-warning={!blocking && issues.length ? "" : undefined}
          className="relative flex min-h-9 min-w-0 flex-1 basis-40 items-center gap-2 rounded-md border px-3 py-1.5 shadow-xs transition-[color,box-shadow] has-[select:focus-visible]:border-ring has-[select:focus-visible]:ring-[3px] has-[select:focus-visible]:ring-ring/50 data-invalid:border-destructive data-warning:border-amber-500 dark:bg-input/30 dark:data-warning:border-amber-400"
        >
          <span aria-hidden className="grid min-w-0 flex-1 gap-0.5">
            <span className="font-mono text-xs break-all">{target.name}</span>
            {selectedDetails && <span className="text-xs text-muted-foreground">{selectedDetails}</span>}
          </span>
          <ChevronDown aria-hidden className="size-4 shrink-0 text-muted-foreground" />
          <select
            ref={select}
            id={selectId}
            value={selected}
            onChange={(event) => choose(event.target.value)}
            aria-invalid={blocking || undefined}
            aria-describedby={`${selectId}-hint`}
            className="absolute inset-0 size-full cursor-pointer appearance-none opacity-0 outline-none [&>option]:bg-popover [&>option]:text-popover-foreground"
          >
            {branches.map((b) => (
              <option key={b.name} value={b.name}>
                {[b.name, details(b)].filter(Boolean).join(" · ")}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div id={`${selectId}-hint`} aria-live="polite" className="mt-1.5 grid gap-1 text-xs">
        {!issues.some((issue) => issue.kind === "same") && (
          <p className="text-muted-foreground">{fill(summaryText, { ...values, count: target.ahead ?? 0, commits: commits(target.ahead ?? 0) })}</p>
        )}
        {issues.map((issue) => {
          const danger = issue.kind === "same" || issue.kind === "wrong-base"
          return (
            <p key={issue.kind} className={cn("flex gap-1.5", danger ? "text-red-700 dark:text-red-400" : "text-amber-700 dark:text-amber-400")}>
              <span className="flex h-6 shrink-0 items-center">
                <TriangleAlert aria-hidden className="size-3.5" />
              </span>
              <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                <span className="py-1">{fill(text[issue.kind], { ...values, count: issue.count ?? 0, commits: commits(issue.count ?? 0), allowed: issue.allowed ?? "" })}</span>
                {issue.kind === "wrong-base" && issue.suggestion && (
                  <button
                    type="button"
                    onClick={() => {
                      choose(issue.suggestion ?? "")
                      // The button goes away with the warning; keep keyboard and screen reader users on the picker.
                      select.current?.focus()
                    }}
                    className={fixClass(true)}
                  >
                    {fill(switchLabel, { suggestion: issue.suggestion })}
                  </button>
                )}
                {issue.kind === "behind" && onUpdate && (
                  <button type="button" onClick={update} aria-disabled={updating || undefined} className={cn(fixClass(false), "aria-disabled:opacity-60")}>
                    {updating && <LoaderCircle aria-hidden className="size-3 animate-spin" />}
                    {updating ? updatingLabel : fill(updateLabel, values)}
                  </button>
                )}
              </span>
            </p>
          )
        })}
      </div>
    </div>
  )
}
