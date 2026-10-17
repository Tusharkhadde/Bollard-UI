"use client"

// Bollard UI — force-push-confirm · MIT licence · https://bollard-ui.vercel.app/components/force-push-confirm

import * as React from "react"
import { Check, Copy, GitBranch, Loader2, Lock, TriangleAlert } from "lucide-react"

import { cn } from "@/lib/utils"
import { commitAge, isFullSha, leaseCommand, reviewForcePush, typedBranchMatches, type ForcePushInput } from "./force-push"

export { commitAge, isFullSha, leaseCommand, matchBranch, reviewForcePush, typedBranchMatches, type ForcePushInput, type ForcePushReview, type PushIdentity, type RemoteCommit } from "./force-push"

/** Every visible string. `{branch}`, `{remote}`, `{count}`, `{people}`, `{sha}`, `{typed}`, `{hidden}` are filled in. */
export const FORCE_PUSH_MESSAGES = {
  title: "Force push to {remote}/{branch}",
  protectedChip: "Protected",
  none: "Nothing on {remote}/{branch} will be lost. Your rewritten commits replace the old ones.",
  own: "Removes {count} of your own commits from {remote}/{branch}. They aren't in what you're pushing.",
  others: "Removes {count} commits from {remote}/{branch}, including work by {people}. They lose it too.",
  protectedNote: "{branch} is a protected branch. Force pushes are normally blocked here; if this goes through, it's because you can bypass the rule.",
  listLabel: "Commits that will be lost",
  notYours: "Not yours",
  coAuthored: "with {people}",
  unreachable: "Once overwritten these commits are only in other people's clones and the server's reflog until garbage collection.",
  lease: "Only if {remote}/{branch} is still at {sha}",
  leaseNoSha: "Only if {remote}/{branch} hasn't moved since your last fetch",
  leaseHint: "--force-with-lease: the push fails instead of overwriting anything pushed after you looked.",
  leaseHintNoSha: "--force-if-includes (Git 2.30+): the push also fails if a background fetch pulled in commits you haven't seen.",
  showAll: "Show {hidden} more",
  noLease: "Without the lease, anything pushed after you looked is lost too.",
  copy: "Copy command",
  copied: "Copied",
  copiedStatus: "Command copied.",
  typeLabel: "Type {branch} to confirm",
  typeOther: "That's {typed}. You're pushing to {branch}.",
  moved: "{remote}/{branch} moved to {sha} since you looked. Check the list again.",
  matched: "Branch name matches. Force push is unlocked.",
  cancel: "Cancel",
  confirm: "Force push",
  confirmLease: "Force push with lease",
  pending: "Pushing…",
}

export type ForcePushMessages = typeof FORCE_PUSH_MESSAGES

const fill = (template: string, values: Record<string, string | number>) =>
  template.replace(/\{(\w+)\}/g, (match, key: string) => String(values[key] ?? match))

export interface ForcePushConfirmProps extends ForcePushInput, Omit<React.ComponentProps<"div">, "onChange"> {
  /** Other branch names; typing one of them is called out instead of silently not matching. */
  otherBranches?: string[]
  /** Start with the lease on. */
  defaultLease?: boolean
  /** Called with the command to run. May return a Promise; the button shows a pending state and ignores repeat clicks. */
  onConfirm?: (push: { command: string; lease: boolean }) => void | Promise<void>
  /** Shows a Cancel button. */
  onCancel?: () => void
  /** How many lost commits to list before a "Show more" button; other people's commits are always listed first. */
  maxCommits?: number
  /** Locale for "3 hours ago" and the people list. */
  locale?: string
  /** Any visible string. */
  messages?: Partial<ForcePushMessages>
}

/**
 * Prevents a force push from silently deleting work on the remote. It lists the commits that would be lost with author,
 * message and age, marks other people's (including co-authors) and protected branches, builds a --force-with-lease
 * command pinned to the tip you were shown, and asks for the branch name only when someone else's work is at stake.
 */
export function ForcePushConfirm({
  branch,
  remote = "origin",
  remoteSha,
  lost,
  me,
  protectedBranches,
  otherBranches = [],
  defaultLease = true,
  onConfirm,
  onCancel,
  maxCommits = 8,
  locale,
  messages,
  className,
  ...props
}: ForcePushConfirmProps) {
  const t = { ...FORCE_PUSH_MESSAGES, ...messages }
  const review = reviewForcePush({ branch, lost, me, protectedBranches })
  const [lease, setLease] = React.useState(defaultLease)
  const [typed, setTyped] = React.useState("")
  const [pending, setPending] = React.useState(false)
  const [copied, setCopied] = React.useState(false)
  const [now, setNow] = React.useState<number>()
  const [movedTo, setMovedTo] = React.useState("")
  const [status, setStatus] = React.useState("")
  const [expanded, setExpanded] = React.useState(false)
  const busy = React.useRef(false)
  const seenSha = React.useRef(remoteSha)
  const id = React.useId()

  React.useEffect(() => setNow(Date.now()), [])

  // The remote moved while the dialog was open: what was typed was a yes to a different list.
  React.useEffect(() => {
    if (remoteSha === seenSha.current) return
    seenSha.current = remoteSha
    setTyped("")
    setMovedTo(remoteSha ?? "")
  }, [remoteSha])

  const matched = typedBranchMatches(typed, branch, remote)
  const movedText = movedTo ? fill(t.moved, { branch, remote, sha: movedTo.slice(0, 7) }) : ""
  React.useEffect(() => {
    const timer = setTimeout(() => setStatus(matched ? t.matched : movedText), 500)
    return () => clearTimeout(timer)
  }, [matched, movedText, t.matched])

  const short = (sha?: string) => (sha ?? "").slice(0, 7)
  const people = typeof Intl.ListFormat === "function" ? new Intl.ListFormat(locale, { type: "conjunction" }).format(review.people) : review.people.join(", ")
  const values = { branch, remote, count: review.lost.length, people, sha: short(movedTo || remoteSha), typed: typed.trim() }
  const command = leaseCommand({ branch, remote, remoteSha, lease })
  const otherTyped = !matched && otherBranches.find((b) => typed.trim() && typedBranchMatches(typed, b, remote) && b !== branch)
  const locked = review.requireTyping && !matched
  const danger = review.level === "others" || review.isProtected
  const pinned = lease && isFullSha(remoteSha)
  // Other people's commits first, so a long list never hides the ones that matter.
  const ordered = [...review.others.map((o) => o.commit), ...review.lost.filter((c) => !review.others.some((o) => o.commit === c))]
  const limit = Math.max(1, maxCommits)
  const shown = expanded || ordered.length <= limit + 1 ? ordered : ordered.slice(0, limit)

  const confirm = async () => {
    if (locked || busy.current || !onConfirm) return
    busy.current = true
    setPending(true)
    try {
      await onConfirm({ command, lease })
    } catch {
      // The caller reports push failures; the button becomes usable again.
    } finally {
      busy.current = false
      setPending(false)
    }
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(command)
      setCopied(true)
      setStatus(t.copiedStatus)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // Clipboard blocked: the command stays visible to select by hand.
    }
  }

  const tone = danger ? "border-red-500/30 bg-red-500/5 text-red-800 dark:text-red-300" : review.level === "own" ? "border-amber-500/30 bg-amber-500/5 text-amber-800 dark:text-amber-300" : "border-emerald-500/30 bg-emerald-500/5 text-emerald-800 dark:text-emerald-300"
  const button = "inline-flex h-9 items-center justify-center gap-2 rounded-md px-4 text-sm font-medium outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50"

  return (
    <div data-slot="force-push-confirm" data-state={pending ? "pending" : locked ? "locked" : "ready"} data-level={review.level} className={cn("w-full max-w-lg overflow-hidden rounded-xl border bg-background text-sm", className)} {...props}>
      <div className="flex flex-wrap items-center gap-2 border-b px-4 py-3">
        <GitBranch aria-hidden className="size-4 shrink-0 text-muted-foreground" />
        <h3 id={`${id}-title`} className="min-w-0 flex-1 font-medium [overflow-wrap:anywhere]">{fill(t.title, values)}</h3>
        {review.isProtected && (
          <span className="inline-flex items-center gap-1 rounded-md border border-red-500/30 bg-red-500/10 px-1.5 py-0.5 text-xs font-medium text-red-700 dark:text-red-300">
            <Lock aria-hidden className="size-3" />
            {t.protectedChip}
          </span>
        )}
      </div>

      <div className="space-y-3 px-4 py-3">
        <p className={cn("flex gap-2 rounded-md border p-3 font-medium", tone)}>
          <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
          <span className="min-w-0">{fill(t[review.level], values)}</span>
        </p>
        {review.isProtected && <p className="text-xs text-muted-foreground">{fill(t.protectedNote, values)}</p>}
        {movedTo && <p className="flex gap-1.5 text-xs font-medium text-amber-800 dark:text-amber-300"><TriangleAlert aria-hidden className="mt-0.5 size-3.5 shrink-0" />{fill(t.moved, values)}</p>}

        {review.lost.length > 0 && (
          <ul aria-label={t.listLabel} className="divide-y rounded-md border">
            {shown.map((c) => {
              const theirs = review.others.find((o) => o.commit === c)
              const coauthors = theirs?.people.filter((p) => p !== c.author.name) ?? []
              return (
                <li key={c.sha} className={cn("grid gap-0.5 px-3 py-2", theirs && "bg-red-500/5")}>
                  <div className="flex min-w-0 items-baseline gap-2">
                    <code className="shrink-0 font-mono text-xs text-muted-foreground">{short(c.sha)}</code>
                    <span className="min-w-0 flex-1 truncate" title={String(c.message ?? "")}>{String(c.message ?? "").split(/\r?\n/)[0]}</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                    <span className={cn(theirs && "font-medium text-red-700 dark:text-red-300")}>{c.author.name}</span>
                    {coauthors.length > 0 && <span>{fill(t.coAuthored, { people: coauthors.join(", ") })}</span>}
                    {now !== undefined && commitAge(c.date, now, locale) && <span>{commitAge(c.date, now, locale)}</span>}
                    {theirs && <span className="rounded border border-red-500/30 px-1 text-[11px] font-medium text-red-700 dark:text-red-300">{t.notYours}</span>}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
        {shown.length < ordered.length && (
          <button type="button" onClick={() => setExpanded(true)} className="-mt-1.5 rounded-md px-1.5 py-0.5 text-xs font-medium outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50">
            {fill(t.showAll, { hidden: ordered.length - shown.length })}
          </button>
        )}
        {review.lost.length > 0 && <p className="text-xs text-muted-foreground">{t.unreachable}</p>}

        <div className="space-y-1.5">
          <label className="flex items-start gap-2">
            <input type="checkbox" checked={lease} onChange={(e) => setLease(e.target.checked)} aria-describedby={`${id}-lease`} className="mt-0.5 size-4 shrink-0 accent-primary" />
            <span className="min-w-0 break-words">{fill(isFullSha(remoteSha) ? t.lease : t.leaseNoSha, values)}</span>
          </label>
          <p id={`${id}-lease`} className={cn("pl-6 text-xs", lease ? "text-muted-foreground" : "font-medium text-amber-800 dark:text-amber-300")}>{!lease ? t.noLease : pinned ? t.leaseHint : `${t.leaseHint} ${t.leaseHintNoSha}`}</p>
          <div className="flex items-start gap-2 rounded-md bg-muted px-3 py-2">
            <code className="min-w-0 flex-1 font-mono text-xs [overflow-wrap:anywhere]">{command}</code>
            <button type="button" onClick={copy} aria-label={copied ? t.copied : t.copy} className="inline-flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground outline-none hover:bg-background hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50">
              {copied ? <Check aria-hidden className="size-3.5" /> : <Copy aria-hidden className="size-3.5" />}
            </button>
          </div>
        </div>

        {review.requireTyping && (
          <div className="grid gap-1.5">
            <label htmlFor={`${id}-type`} className="text-sm font-medium break-words">{fill(t.typeLabel, values)}</label>
            <input
              id={`${id}-type`}
              value={typed}
              onChange={(e) => {
                setTyped(e.target.value)
                setMovedTo("")
              }}
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
              aria-invalid={otherTyped ? true : undefined}
              aria-describedby={otherTyped ? `${id}-other` : undefined}
              placeholder={branch}
              className="h-9 w-full min-w-0 rounded-md border bg-transparent px-3 font-mono text-base shadow-xs outline-none transition-[color,box-shadow] placeholder:text-muted-foreground/60 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-destructive md:text-sm dark:bg-input/30"
            />
            {otherTyped && <p id={`${id}-other`} className="flex gap-1.5 text-xs text-destructive"><TriangleAlert aria-hidden className="mt-0.5 size-3.5 shrink-0" />{fill(t.typeOther, { ...values, typed: otherTyped })}</p>}
          </div>
        )}
      </div>

      <span role="status" className="sr-only">{status}</span>
      <div className="flex flex-wrap justify-end gap-2 border-t px-4 py-3">
        {onCancel && <button type="button" onClick={onCancel} className={cn(button, "border bg-background hover:bg-accent")}>{t.cancel}</button>}
        <button type="button" onClick={confirm} disabled={locked || pending || !onConfirm} aria-describedby={`${id}-title`} className={cn(button, danger ? "bg-destructive text-white hover:bg-destructive/90" : "bg-primary text-primary-foreground hover:bg-primary/90")}>
          {pending && <Loader2 aria-hidden className="size-4 animate-spin" />}
          {pending ? t.pending : lease ? t.confirmLease : t.confirm}
        </button>
      </div>
    </div>
  )
}
