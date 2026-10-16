"use client"

// Bollard UI — reset-hard-readback · MIT licence · https://bollard-ui.vercel.app/components/reset-hard-readback

import * as React from "react"
import { Archive, CircleCheck, FileWarning, GitCommitHorizontal, History, Info, Loader2, TriangleAlert } from "lucide-react"

import { cn } from "@/lib/utils"
import { stashFirstCommand, whatWillBeLost, type Commit, type LostFile, type StashEntry } from "./git-loss"

export { parseGitCommand, parseLog, parseNumstat, parsePorcelain, stashFirstCommand, unquotePath, whatWillBeLost, type Commit, type GitOp, type GitStatus, type LossReport, type LostFile, type LostReason, type ParsedGitCommand, type StashEntry, type StatusEntry } from "./git-loss"

/** Every visible string. `{count}`, `{files}`, `{commits}`, `{unpushed}`, `{lines}`, `{hidden}`, `{sha}`, `{ref}` are filled in. */
export const RESET_HARD_MESSAGES = {
  summaryFiles: "Deletes uncommitted work in {files}.",
  linesSuffix: " ({lines} lines)",
  summaryCommits: "Moves the branch back past {commits}.",
  summaryUnpushed: "Not pushed anywhere yet: {unpushed}.",
  summaryStash: "Deletes {stashes} for good.",
  nothing: "Nothing will be lost. There are no changes this command would touch.",
  unknown: "This isn't reset --hard, clean, checkout/restore of paths, checkout -f or stash drop, so there's nothing to read back.",
  "needs-force": "Git will refuse this without -f (unless clean.requireForce is off). This is what -f would delete:",
  "dry-run": "-n only lists files, so nothing is deleted. This is what it would delete without -n:",
  "unstage-only": "--staged only unstages. Your changes stay in the files, so nothing is lost.",
  missingStash: "There's no {ref}. Check git stash list; the numbers shift every time a stash is dropped.",
  filesHeading: "Uncommitted changes, gone for good",
  untrackedHeading: "Files git doesn't track",
  ignoredHeading: "Ignored files (-x)",
  commitsHeading: "Commits the branch moves past",
  stashHeading: "Stash entries",
  modified: "edited",
  staged: "staged",
  new: "new, staged",
  conflict: "conflict",
  untracked: "untracked",
  ignored: "ignored",
  binary: "binary",
  precious: "hard to get back",
  rebuildable: "{count} you can rebuild: {list}",
  notPushed: "not pushed",
  commitsRecover: "Commits stay in the reflog for a while: git reset --hard HEAD@{1} undoes the move. Uncommitted changes have no such copy.",
  detached: "You're not on a branch (detached HEAD), so no branch keeps these commits. Run git branch keep-work first if you want them.",
  stashRecover: "Copy this id first; git stash apply {sha} brings it back until garbage collection.",
  keptUntracked: "Untracked files stay ({count}): only git clean deletes those.",
  keptIgnored: "Ignored files stay ({count}): add -x to clean them too.",
  keptStaged: "Staged changes stay ({count}): only the unstaged edits are thrown away.",
  keptDirs: "Untracked folders stay ({count}): add -d to delete folders.",
  keptExcluded: "Files matching -e stay ({count}).",
  keptSubmodules: "Submodule work stays ({count}): git only touches it with --recurse-submodules.",
  showMore: "Show {hidden} more",
  stashFirst: "Stash first",
  stashing: "Stashing…",
  stashed: "Saved to the stash. Your uncommitted changes are safe.",
  cancel: "Cancel",
  run: "Run",
  discard: "Discard and run",
  running: "Running…",
  listLabel: "What will be lost",
}
export type ResetHardMessages = typeof RESET_HARD_MESSAGES

const fill = (template: string, values: Record<string, string | number>) => template.replace(/\{(\w+)\}/g, (match, key: string) => String(values[key] ?? match))
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`
const button = "inline-flex h-9 items-center justify-center gap-2 rounded-md px-4 text-sm font-medium outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50"

export interface ResetHardReadbackProps extends Omit<React.ComponentProps<"div">, "onChange"> {
  /** The command about to run, e.g. `git reset --hard origin/main`, `git clean -fdx`, `git checkout -- .`, `git stash drop`. */
  command: string
  /** Output of `git status --porcelain=v2 --branch --ignored` (v1 and -z work too). Add --ignored for clean -x. */
  status: string
  /** Output of `git diff HEAD --numstat` for the +/- line counts. */
  numstat?: string
  /** For reset --hard to another commit: `git log --oneline <target>..HEAD` (or parsed commits), newest first. */
  commits?: string | Commit[]
  /** The exact unpushed commits: `git rev-list @{u}..HEAD` output or a list of shas. Without it the newest `ahead` commits are marked, which is only exact for linear history. */
  unpushed?: string | string[]
  /** For stash drop/clear: the stash list, newest first. */
  stashes?: StashEntry[]
  /** Shows "Stash first". Receives the stash command that keeps everything at risk; may return a Promise. */
  onStash?: (command: string) => void | Promise<void>
  /** Runs the command. May return a Promise; the button shows a pending state and ignores repeat clicks. */
  onConfirm?: (command: string) => void | Promise<void>
  /** Shows a Cancel button. */
  onCancel?: () => void
  /** Rows to list per section before "Show more". */
  maxRows?: number
  /** Any visible string. */
  messages?: Partial<ResetHardMessages>
}

/**
 * Prevents `git reset --hard`, `git clean -fdx`, `git checkout -- .` and `git stash drop` from silently destroying work.
 * It reads porcelain status and lists exactly what goes: edited files with +/- lines, staged new files, untracked and
 * ignored files (with .env and keys first and node_modules folded away), commits the branch moves past with the
 * unpushed ones marked, and stash entries with the id to recover them. It also says what stays, and offers to stash first.
 */
export function ResetHardReadback({ command, status, numstat, commits, unpushed, stashes, onStash, onConfirm, onCancel, maxRows = 6, messages, className, ...props }: ResetHardReadbackProps) {
  const t = { ...RESET_HARD_MESSAGES, ...messages }
  const report = React.useMemo(() => whatWillBeLost({ command, status, numstat, commits, stashes, unpushed }), [command, status, numstat, commits, stashes, unpushed])
  const [pending, setPending] = React.useState<"" | "stash" | "run">("")
  const [stashed, setStashed] = React.useState(false)
  const [open, setOpen] = React.useState<string[]>([])
  const [announce, setAnnounce] = React.useState("")
  const busy = React.useRef(false)
  const version = React.useRef(0)
  const confirmRef = React.useRef<HTMLButtonElement>(null)
  const id = React.useId()

  // New status means the repo changed: an earlier "stashed" no longer describes it.
  React.useEffect(() => {
    version.current++
    setStashed(false)
  }, [command, status])

  const cmd = report.command
  const tracked = report.files.filter((f) => f.reason !== "untracked" && f.reason !== "ignored")
  const untracked = report.files.filter((f) => f.reason === "untracked")
  const ignored = report.files.filter((f) => f.reason === "ignored" && !f.rebuildable)
  const rebuildable = report.files.filter((f) => f.rebuildable)
  const lines = tracked.reduce((sum, f) => sum + (f.added ?? 0) + (f.removed ?? 0), 0)
  const atRisk = !report.harmless && (report.files.length > 0 || report.commits.length > 0 || report.stashes.length > 0)
  const stashCmd = stashFirstCommand(cmd)
  const canStash = !!onStash && !!stashCmd && atRisk && report.files.length > 0 && !stashed
  const stillAtRisk = report.commits.length > 0 || report.stashes.length > 0
  const destructive = atRisk && (!stashed || stillAtRisk)

  const summary = [
    report.files.length > 0 && !stashed && fill(t.summaryFiles, { files: plural(report.files.length, "file", "files") + (lines > 0 ? fill(t.linesSuffix, { lines }) : "") }),
    report.commits.length > 0 && fill(t.summaryCommits, { commits: plural(report.commits.length, "commit", "commits") }),
    report.unpushed > 0 && fill(t.summaryUnpushed, { unpushed: report.unpushed === report.commits.length ? "all of them" : report.unpushed }),
    report.stashes.length > 0 && fill(t.summaryStash, { stashes: plural(report.stashes.length, "stash entry", "stash entries") }),
  ].filter(Boolean).join(" ")

  const act = async (kind: "stash" | "run") => {
    const fn = kind === "stash" ? onStash : onConfirm
    if (!fn || busy.current) return
    busy.current = true
    setPending(kind)
    const started = version.current
    try {
      await fn(kind === "stash" ? stashCmd : String(command).trim())
      // Ignore a late answer if the repo changed while we waited.
      if (kind === "stash" && started === version.current) {
        setStashed(true)
        setAnnounce(t.stashed)
        requestAnimationFrame(() => confirmRef.current?.focus())
      }
    } catch {
      // The caller reports git failures; the buttons become usable again.
    } finally {
      busy.current = false
      setPending("")
    }
  }

  const section = (key: string, heading: string, rows: React.ReactNode[], icon: React.ReactNode) => {
    if (!rows.length) return null
    const shown = open.includes(key) || rows.length <= maxRows + 1 ? rows : rows.slice(0, maxRows)
    return (
      <section aria-labelledby={`${id}-${key}`} className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-1">
        <h4 id={`${id}-${key}`} className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">{icon}{heading}</h4>
        <ul className="divide-y rounded-md border text-xs">{shown}</ul>
        {shown.length < rows.length && (
          <button type="button" onClick={() => setOpen((o) => [...o, key])} className="justify-self-start rounded-md px-1.5 py-0.5 text-xs font-medium outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50">
            {fill(t.showMore, { hidden: rows.length - shown.length })}
          </button>
        )}
      </section>
    )
  }
  const fileRow = (f: LostFile) => (
    <li key={f.reason + f.path} data-reason={f.reason} className={cn("flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5 px-2.5 py-1.5", f.precious && "bg-amber-500/5")}>
      <span className="min-w-0 flex-1 basis-48 font-mono [overflow-wrap:anywhere]">{f.path}</span>
      {f.precious && <span className="rounded border border-amber-500/40 px-1 text-[11px] font-medium text-amber-800 dark:text-amber-300">{t.precious}</span>}
      {f.reason !== "untracked" && f.reason !== "ignored" && <span className="text-muted-foreground">{t[f.reason]}</span>}
      {f.added !== null || f.removed !== null ? (
        <span className="font-mono tabular-nums">
          <span className="text-emerald-700 dark:text-emerald-400">+{f.added ?? 0}</span> <span className="text-red-700 dark:text-red-400">−{f.removed ?? 0}</span>
        </span>
      ) : null}
    </li>
  )

  const kept = [
    report.kept.untracked > 0 && cmd?.op !== "clean" && fill(t.keptUntracked, { count: report.kept.untracked }),
    report.kept.ignored > 0 && cmd?.op === "clean" && fill(t.keptIgnored, { count: report.kept.ignored }),
    report.kept.staged > 0 && !report.harmless && fill(t.keptStaged, { count: report.kept.staged }),
    report.kept.dirs > 0 && fill(t.keptDirs, { count: report.kept.dirs }),
    report.kept.excluded > 0 && fill(t.keptExcluded, { count: report.kept.excluded }),
    report.kept.submodules > 0 && fill(t.keptSubmodules, { count: report.kept.submodules }),
  ].filter(Boolean) as string[]
  const tone = !cmd || report.harmless ? "border-border bg-muted/40 text-muted-foreground" : !destructive ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-800 dark:text-emerald-300" : "border-red-500/30 bg-red-500/5 text-red-800 dark:text-red-300"
  const headline = !cmd ? t.unknown : report.missingStash ? fill(t.missingStash, { ref: cmd.stashRef }) : report.harmless ? t[report.harmless] : stashed ? [t.stashed, summary].filter(Boolean).join(" ") : atRisk ? summary : t.nothing
  const HeadIcon = !cmd || report.harmless ? Info : !destructive ? CircleCheck : TriangleAlert

  return (
    <div data-slot="reset-hard-readback" data-state={stashed ? "stashed" : atRisk ? "at-risk" : "safe"} className={cn("w-full max-w-lg min-w-0 overflow-hidden rounded-xl border bg-background text-sm", className)} {...props}>
      <div className="flex items-center gap-2 border-b px-4 py-3">
        <History aria-hidden className="size-4 shrink-0 text-muted-foreground" />
        <h3 id={`${id}-title`} className="min-w-0 flex-1 font-mono text-sm font-medium [overflow-wrap:anywhere]">{String(command ?? "").trim()}</h3>
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-3 px-4 py-3" aria-label={t.listLabel} role="group">
        <p className={cn("flex gap-2 rounded-md border p-3 font-medium", tone)}>
          <HeadIcon aria-hidden className="mt-0.5 size-4 shrink-0" />
          <span className="min-w-0">
            {headline}
          </span>
        </p>

        {section("files", t.filesHeading, tracked.map(fileRow), <FileWarning aria-hidden className="size-3.5" />)}
        {section("untracked", t.untrackedHeading, untracked.map(fileRow), <FileWarning aria-hidden className="size-3.5" />)}
        {section("ignored", t.ignoredHeading, [
          ...ignored.map(fileRow),
          ...(rebuildable.length ? [<li key="rebuild" className="px-2.5 py-1.5 text-muted-foreground [overflow-wrap:anywhere]">{fill(t.rebuildable, { count: rebuildable.length, list: rebuildable.map((f) => f.path).join(", ") })}</li>] : []),
        ], <FileWarning aria-hidden className="size-3.5" />)}
        {section("commits", t.commitsHeading, report.commits.map((c, i) => (
          <li key={c.sha + i} className="flex min-w-0 items-baseline gap-2 px-2.5 py-1.5">
            <code className="shrink-0 font-mono text-muted-foreground">{c.sha.slice(0, 7)}</code>
            <span className="min-w-0 flex-1 truncate" title={c.subject}>{c.subject}</span>
            {report.unpushedShas.includes(c.sha) && <span className="shrink-0 rounded border border-red-500/30 px-1 text-[11px] font-medium text-red-700 dark:text-red-300">{t.notPushed}</span>}
          </li>
        )), <GitCommitHorizontal aria-hidden className="size-3.5" />)}
        {report.commits.length > 0 && <p className="-mt-1.5 text-xs text-muted-foreground">{report.detached && <strong className="font-medium text-red-700 dark:text-red-300">{t.detached} </strong>}{t.commitsRecover}</p>}
        {section("stash", t.stashHeading, report.stashes.map((s) => {
          const added = s.files?.reduce((n, f) => n + (f.added ?? 0), 0) ?? 0
          const removed = s.files?.reduce((n, f) => n + (f.removed ?? 0), 0) ?? 0
          return (
            <li key={s.ref} className="grid gap-0.5 px-2.5 py-1.5">
              <div className="flex min-w-0 items-baseline gap-2">
                <code className="shrink-0 font-mono text-muted-foreground">{s.ref}</code>
                <span className="min-w-0 flex-1 [overflow-wrap:anywhere]">{s.message}</span>
                {s.files && <span className="shrink-0 font-mono tabular-nums">{plural(s.files.length, "file", "files")} <span className="text-emerald-700 dark:text-emerald-400">+{added}</span> <span className="text-red-700 dark:text-red-400">−{removed}</span></span>}
              </div>
              {s.sha && <span className="text-muted-foreground [overflow-wrap:anywhere]">{fill(t.stashRecover, { sha: s.sha })}</span>}
            </li>
          )
        }), <Archive aria-hidden className="size-3.5" />)}

        {kept.length > 0 && (
          <ul className="grid gap-1 text-xs text-muted-foreground">
            {kept.map((k) => <li key={k} className="flex gap-1.5"><CircleCheck aria-hidden className="mt-0.5 size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />{k}</li>)}
          </ul>
        )}
      </div>

      <span role="status" className="sr-only">{announce}</span>
      <div className="flex flex-wrap justify-end gap-2 border-t px-4 py-3">
        {onCancel && <button type="button" onClick={onCancel} className={cn(button, "border bg-background hover:bg-accent")}>{t.cancel}</button>}
        {canStash && (
          <button type="button" onClick={() => act("stash")} disabled={!!pending} aria-busy={pending === "stash" || undefined} title={stashCmd} className={cn(button, "border bg-background hover:bg-accent")}>
            {pending === "stash" ? <Loader2 aria-hidden className="size-4 animate-spin" /> : <Archive aria-hidden className="size-4" />}
            {pending === "stash" ? t.stashing : t.stashFirst}
          </button>
        )}
        {onConfirm && cmd && (
          <button ref={confirmRef} type="button" onClick={() => act("run")} disabled={!!pending} aria-busy={pending === "run" || undefined} aria-describedby={`${id}-title`} className={cn(button, destructive ? "bg-destructive text-white hover:bg-destructive/90" : "bg-primary text-primary-foreground hover:bg-primary/90")}>
            {pending === "run" && <Loader2 aria-hidden className="size-4 animate-spin" />}
            {pending === "run" ? t.running : destructive ? t.discard : t.run}
          </button>
        )}
      </div>
    </div>
  )
}
