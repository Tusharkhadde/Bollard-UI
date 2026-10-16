"use client"

// Bollard UI — commit-secret-guard · MIT licence · https://bollard-ui.vercel.app/components/commit-secret-guard

import * as React from "react"
import { CircleAlert, CircleCheck, ExternalLink, EyeOff, FileKey, Loader2, RotateCcwKey, ShieldAlert, TriangleAlert, Undo2 } from "lucide-react"

import { cn } from "@/lib/utils"
import { DEFAULT_FIXTURE_PATTERNS, envReference, moveToEnvPatch, scanDiffForSecrets, type SecretFinding } from "./scan-diff"

export { DEFAULT_FIXTURE_PATTERNS, envReference, globToRegExp, maskSecret, moveToEnvPatch, parseUnifiedDiff, scanDiffForSecrets, shannonEntropy, type DiffFile, type FindingKind, type SecretFinding } from "./scan-diff"

export type SecretResolution = "removed" | "moved" | "allowed"
/** What the caller should apply for a resolution. */
export type SecretFix =
  | { kind: "replace-line"; file: string; line: number; text: string; envName: string; /** Last line replaced, for a multi-line private key. */ endLine?: number }
  | { kind: "remove-line"; file: string; line: number; /** Last line removed, for a multi-line private key. */ endLine?: number }
  | { kind: "command"; command: string }
  | { kind: "allow"; id: string }

/** Every visible string. `{count}`, `{lines}`, `{file}`, `{line}`, `{name}`, `{ref}`, `{label}`, `{patterns}` are filled in. */
export const COMMIT_SECRET_MESSAGES = {
  title: "Secrets in this change",
  stagePre: "Before commit",
  stagePushed: "Already pushed",
  clean: "No secrets in {lines} added lines.",
  found: "{count} to fix in the added lines. The commit waits until each one is handled.",
  allDone: "All handled. Nothing secret goes into this commit.",
  rotate: "This is already on the remote. Rotate it now: deleting it in a new commit leaves it in the history and in every clone.",
  rotateLink: "Rotate key",
  fixture: "In a test fixture, but it's a live key format.",
  moveToEnv: "Move to env",
  remove: "Remove line",
  unstage: "Unstage and ignore",
  falsePositive: "Not a secret",
  undo: "Undo",
  movedNote: "Line {line} reads {ref}. Put the value in .env as {name} (keep .env git-ignored).",
  removedNote: "Line {line} is dropped from the commit.",
  removedBlockNote: "Lines {line}–{end} are dropped from the commit.",
  rotateFile: "This file is already on the remote. Rotate every key in it: deleting it in a new commit leaves it in the history and in every clone.",
  unstagedNote: "Run: {command}",
  allowedNote: "Marked as not a secret. It won't be flagged again.",
  ignoredSummary: "{count} ignored: test fixtures ({patterns}) or lines marked allowed.",
  commit: "Commit",
  committing: "Committing…",
  heldHint: "Fix or dismiss each finding to commit.",
  listLabel: "Findings",
}
export type CommitSecretMessages = typeof COMMIT_SECRET_MESSAGES

const fill = (template: string, values: Record<string, string | number>) => template.replace(/\{(\w+)\}/g, (match, key: string) => String(values[key] ?? match))
const fixButton = "inline-flex min-h-7 items-center gap-1 rounded-md border px-2 text-xs font-medium outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50"
const button = "inline-flex h-9 items-center justify-center gap-2 rounded-md px-4 text-sm font-medium outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50"

export interface CommitSecretGuardProps extends Omit<React.ComponentProps<"div">, "onChange" | "defaultValue"> {
  /** Unified diff to check (`git diff --cached`, or a PR's .diff). Only added lines are scanned. */
  diff: string
  /** True when these commits are already on a remote (a PR diff, a pre-push hook): every finding then says to rotate. */
  pushed?: boolean
  /** Globs for test fixtures. Generic and entropy hits there are ignored; live provider keys are still flagged. */
  fixturePatterns?: string[]
  /** Controlled resolutions by finding id. */
  value?: Record<string, SecretResolution>
  /** Initial resolutions when uncontrolled, e.g. ids your allowlist already holds as "allowed". */
  defaultValue?: Record<string, SecretResolution>
  /** Called with all resolutions whenever one changes. */
  onValueChange?: (value: Record<string, SecretResolution>) => void
  /** Called with what to apply when a finding is resolved: a replacement line, a removed line, a git command or an allowlist id. */
  onResolve?: (finding: SecretFinding, resolution: SecretResolution, fix: SecretFix) => void
  /** Shows the commit button; enabled once every finding is handled. May return a Promise for a pending state. */
  onCommit?: () => void | Promise<void>
  /** Any visible string. */
  messages?: Partial<CommitSecretMessages>
}

/**
 * Prevents committing a credential. It scans only the lines a diff adds for provider keys, private keys, passwords in
 * URLs, hard-coded secrets and high-entropy strings, flags .env and key files, ignores test fixtures by pattern (except
 * live key formats), and offers per-finding fixes: move to an env variable, remove the line, or mark a false positive.
 * When the change is already pushed it says to rotate the key, because a later commit can't take it out of history.
 */
export function CommitSecretGuard({ diff, pushed = false, fixturePatterns = DEFAULT_FIXTURE_PATTERNS, value, defaultValue = {}, onValueChange, onResolve, onCommit, messages, className, ...props }: CommitSecretGuardProps) {
  const t = { ...COMMIT_SECRET_MESSAGES, ...messages }
  const findings = React.useMemo(() => scanDiffForSecrets(diff, fixturePatterns), [diff, fixturePatterns])
  const addedLines = React.useMemo(() => (typeof diff === "string" ? diff.split("\n").filter((l) => l.startsWith("+") && !l.startsWith("+++ ")).length : 0), [diff])
  const [inner, setInner] = React.useState(defaultValue)
  const resolved = value ?? inner
  const [pending, setPending] = React.useState(false)
  const [announce, setAnnounce] = React.useState("")
  const busy = React.useRef(false)
  const list = React.useRef<HTMLUListElement>(null)
  const commitRef = React.useRef<HTMLButtonElement>(null)
  const refocus = React.useRef<string | null>(null)
  const id = React.useId()

  const ignored = findings.filter((f) => f.allowed || (f.fixture && f.kind !== "provider" && f.kind !== "file"))
  const active = findings.filter((f) => !ignored.includes(f))
  const open = active.filter((f) => !resolved[f.id])
  const summary = !active.length ? fill(t.clean, { lines: addedLines }) : open.length ? fill(t.found, { count: open.length }) : t.allDone

  // One announcement after the diff settles, never one per keystroke.
  React.useEffect(() => {
    const timer = setTimeout(() => setAnnounce(summary), 700)
    return () => clearTimeout(timer)
  }, [summary])
  // The tapped row changes shape, so focus moves to the next open fix, or to Commit when none is left.
  React.useEffect(() => {
    if (refocus.current === null) return
    const row = [...(list.current?.querySelectorAll<HTMLElement>("li[data-row]") ?? [])].find((li) => li.dataset.row === refocus.current)
    const target = row?.querySelector<HTMLButtonElement>("button[data-fix]")
    ;(target ?? (commitRef.current && !commitRef.current.disabled ? commitRef.current : list.current))?.focus()
    refocus.current = null
  }, [resolved])

  const set = (next: Record<string, SecretResolution>) => {
    if (value === undefined) setInner(next)
    onValueChange?.(next)
  }
  // Single-quoted so paths with spaces or $ survive the shell; .gitignore gets a leading / so only this path is ignored.
  const sq = (text: string) => `'${text.replace(/'/g, "'\\''")}'`
  const fileCommand = (f: SecretFinding) => `git rm --cached -- ${sq(f.file)} && echo ${sq("/" + f.file)} >> .gitignore`
  const resolve = (f: SecretFinding, resolution: SecretResolution) => {
    const at = active.indexOf(f)
    const next = [...active.slice(at + 1), ...active.slice(0, at)].find((a) => !resolved[a.id])
    refocus.current = next?.id ?? ""
    set({ ...resolved, [f.id]: resolution })
    const fix: SecretFix =
      resolution === "allowed" ? { kind: "allow", id: f.id }
      : f.kind === "file" ? { kind: "command", command: fileCommand(f) }
      : resolution === "moved" ? { kind: "replace-line", file: f.file, line: f.line, text: moveToEnvPatch(f, f.source), envName: f.envName, ...(f.endLine > f.line && { endLine: f.endLine }) }
      : { kind: "remove-line", file: f.file, line: f.line, ...(f.endLine > f.line && { endLine: f.endLine }) }
    onResolve?.(f, resolution, fix)
  }
  const undo = (f: SecretFinding) => {
    const next = { ...resolved }
    delete next[f.id]
    refocus.current = f.id
    set(next)
  }
  const commit = async () => {
    if (!onCommit || open.length || busy.current) return
    busy.current = true
    setPending(true)
    try {
      await onCommit()
    } catch {
      // The caller reports commit failures; the button becomes usable again.
    } finally {
      busy.current = false
      setPending(false)
    }
  }

  return (
    <div data-slot="commit-secret-guard" data-state={open.length ? "blocked" : "clear"} className={cn("w-full max-w-lg min-w-0 overflow-hidden rounded-xl border bg-background text-sm", className)} {...props}>
      <div className="flex items-center gap-2 border-b px-4 py-3">
        <ShieldAlert aria-hidden className="size-4 shrink-0 text-muted-foreground" />
        <h3 className="min-w-0 flex-1 font-medium">{t.title}</h3>
        <span className={cn("rounded-md border px-1.5 py-0.5 text-xs font-medium", pushed ? "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300" : "text-muted-foreground")}>{pushed ? t.stagePushed : t.stagePre}</span>
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-3 px-4 py-3">
        <p id={`${id}-summary`} className={cn("flex gap-2 rounded-md border p-3 font-medium", open.length ? "border-red-500/30 bg-red-500/5 text-red-800 dark:text-red-300" : "border-emerald-500/30 bg-emerald-500/5 text-emerald-800 dark:text-emerald-300")}>
          {open.length ? <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0" /> : <CircleCheck aria-hidden className="mt-0.5 size-4 shrink-0" />}
          <span className="min-w-0">{summary}</span>
        </p>

        {active.length > 0 && (
          <ul ref={list} tabIndex={-1} aria-label={t.listLabel} className="divide-y rounded-md border outline-none">
            {active.map((f) => {
              const done = resolved[f.id]
              const where = f.line ? `${f.file}:${f.line}${f.endLine > f.line ? `–${f.endLine}` : ""}` : f.file
              const ref = envReference(f.file, f.envName)
              return (
                <li key={f.id} data-row={f.id} data-resolution={done ?? "open"} className={cn("grid gap-1.5 px-3 py-2.5", !done && f.severity === "high" && "bg-red-500/5")}>
                  <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5">
                    <span className="flex min-w-0 items-start gap-1.5">
                      <span className="flex h-5 shrink-0 items-center">
                        {done ? <CircleCheck aria-hidden className="size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" /> : f.kind === "file" ? <FileKey aria-hidden className="size-3.5 shrink-0 text-red-600 dark:text-red-400" /> : <TriangleAlert aria-hidden className={cn("size-3.5 shrink-0 self-center", f.severity === "high" ? "text-red-600 dark:text-red-400" : "text-amber-600 dark:text-amber-400")} />}
                      </span>
                      <span className={cn("font-medium", done && "text-muted-foreground line-through decoration-1")}>{f.label}</span>
                    </span>
                    <span className="min-w-0 font-mono text-xs text-muted-foreground [overflow-wrap:anywhere]">{where}</span>
                  </div>
                  {f.preview && !done && <code className="block rounded bg-muted px-2 py-1 font-mono text-xs [overflow-wrap:anywhere] whitespace-pre-wrap">{f.preview.trim()}</code>}
                  {f.fixture && !done && <p className="text-xs text-amber-800 dark:text-amber-300">{t.fixture}</p>}
                  {pushed && done !== "allowed" && (
                    <p className="flex flex-wrap items-start gap-x-2 gap-y-1 text-xs text-red-700 dark:text-red-400">
                      <RotateCcwKey aria-hidden className="mt-0.5 size-3.5 shrink-0" />
                      <span className="min-w-0 flex-1">{f.kind === "file" ? t.rotateFile : t.rotate}</span>
                      {f.rotateUrl && <a href={f.rotateUrl} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1 rounded-sm font-medium underline outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50">{t.rotateLink}<ExternalLink aria-hidden className="size-3" /></a>}
                    </p>
                  )}
                  {done ? (
                    <div className="flex flex-wrap items-start gap-2 text-xs text-muted-foreground">
                      <span className="min-w-0 flex-1 [overflow-wrap:anywhere]">
                        {done === "allowed" ? t.allowedNote : f.kind === "file" ? fill(t.unstagedNote, { command: fileCommand(f) }) : done === "moved" ? fill(t.movedNote, { line: f.line, ref, name: f.envName }) : fill(f.endLine > f.line ? t.removedBlockNote : t.removedNote, { line: f.line, end: f.endLine })}
                      </span>
                      <button type="button" data-fix="" onClick={() => undo(f)} className={cn(fixButton, "hover:bg-accent")}>
                        <Undo2 aria-hidden className="size-3.5" />
                        {t.undo}
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {/* A multi-line key block can't become one env lookup in place; remove it instead. */}
                      {f.kind !== "file" && f.endLine === f.line && <button type="button" data-fix="" onClick={() => resolve(f, "moved")} className={cn(fixButton, "border-red-500/40 text-red-800 hover:bg-red-500/10 dark:text-red-200")}>{t.moveToEnv}</button>}
                      <button type="button" data-fix="" onClick={() => resolve(f, "removed")} className={cn(fixButton, "hover:bg-accent")}>{f.kind === "file" ? t.unstage : t.remove}</button>
                      <button type="button" data-fix="" onClick={() => resolve(f, "allowed")} className={cn(fixButton, "border-transparent text-muted-foreground hover:bg-accent hover:text-foreground")}>
                        <EyeOff aria-hidden className="size-3.5" />
                        {t.falsePositive}
                      </button>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}
        {ignored.length > 0 && <p className="text-xs text-muted-foreground [overflow-wrap:anywhere]">{fill(t.ignoredSummary, { count: ignored.length, patterns: fixturePatterns.slice(0, 3).join(", ") + (fixturePatterns.length > 3 ? "…" : "") })}</p>}
      </div>

      <span role="status" className="sr-only">{announce}</span>
      {onCommit && (
        <div className="flex flex-wrap items-center justify-end gap-2 border-t px-4 py-3">
          {open.length > 0 && <span id={`${id}-held`} className="mr-auto text-xs text-muted-foreground">{t.heldHint}</span>}
          <button ref={commitRef} type="button" onClick={commit} disabled={open.length > 0 || pending} aria-busy={pending || undefined} aria-describedby={open.length ? `${id}-held` : `${id}-summary`} className={cn(button, "bg-primary text-primary-foreground hover:bg-primary/90")}>
            {pending && <Loader2 aria-hidden className="size-4 animate-spin" />}
            {pending ? t.committing : t.commit}
          </button>
        </div>
      )}
    </div>
  )
}
