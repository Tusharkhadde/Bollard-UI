/** A commit that is on the remote branch but not in the history you are about to push. */
export interface RemoteCommit {
  /** Full or short SHA. */
  sha: string
  /** Full commit message; only the first line is shown. */
  message: string
  /** Commit author. */
  author: { name: string; email?: string }
  /** Author or commit date (ISO string, epoch ms or Date). */
  date?: string | number | Date
}

/** Who "you" are, so commits can be split into yours and other people's. */
export interface PushIdentity {
  /** Names you commit under. Compared case-insensitively. */
  names?: string[]
  /** Emails you commit under. GitHub noreply forms (12345+you@users.noreply.github.com) match their short form. */
  emails?: string[]
}

export interface ForcePushInput {
  /** Branch on the remote that will be overwritten, e.g. "feature/payments". */
  branch: string
  /** Remote name. */
  remote?: string
  /** SHA the remote branch points at right now (the tip being replaced). Pass the full SHA so the lease can be pinned to it. */
  remoteSha?: string
  /** Commits that will no longer be reachable from the branch, newest first (`git log HEAD..origin/<branch>`). */
  lost: RemoteCommit[]
  /** You. Without it every lost commit counts as someone else's, because nothing proves otherwise. */
  me?: PushIdentity
  /** Protected branch names or fnmatch patterns ("main", "release/*"). */
  protectedBranches?: string[]
}

export interface ForcePushReview {
  lost: RemoteCommit[]
  /** Lost commits authored by someone else, or yours with someone else as Co-authored-by. */
  others: { commit: RemoteCommit; people: string[] }[]
  /** Distinct other people whose work is lost. */
  people: string[]
  isProtected: boolean
  /** True when the user should type the branch name. */
  requireTyping: boolean
  level: "none" | "own" | "others"
}

const noreply = (email: string) => email.trim().toLowerCase().replace(/^\d+\+(?=[^@]+@users\.noreply\.github\.com$)/, "")

/** fnmatch-style match used by GitHub branch rules: `*` stays within one path segment, `**` crosses them. */
export function matchBranch(pattern: string, branch: string) {
  const source = pattern
    .trim()
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*\*/g, "\u0000")
    .replace(/\*/g, "[^/]*")
    .replace(/\?/g, "[^/]")
    .replace(/\u0000/g, ".*")
  try {
    return new RegExp(`^${source}$`).test(branch.trim())
  } catch {
    return false
  }
}

const coAuthors = (message: string) =>
  [...message.matchAll(/^co-authored-by:\s*(.+?)\s*(?:<([^>]*)>)?\s*$/gim)].map((m) => ({ name: m[1] ?? "", email: m[2] }))

/** Splits the commits a force push would drop into yours and other people's, and decides whether to ask for the branch name. */
export function reviewForcePush({ branch, lost, me, protectedBranches = [] }: ForcePushInput): ForcePushReview {
  const commits = (Array.isArray(lost) ? lost : []).filter(
    (c): c is RemoteCommit => !!c && typeof c.sha === "string" && typeof c.author?.name === "string",
  )
  const names = new Set((me?.names ?? []).map((n) => n.trim().toLowerCase()).filter(Boolean))
  const emails = new Set((me?.emails ?? []).map(noreply).filter(Boolean))
  const known = names.size + emails.size > 0
  const isMe = (p: { name: string; email?: string }) =>
    (p.email ? emails.has(noreply(p.email)) : false) || names.has(p.name.trim().toLowerCase())

  const others: ForcePushReview["others"] = []
  for (const commit of commits) {
    const people = [commit.author, ...coAuthors(String(commit.message ?? ""))]
      .filter((p) => !known || !isMe(p))
      .map((p) => p.name.trim() || p.email || "someone")
    if (people.length) others.push({ commit, people: [...new Set(people)] })
  }
  const people = [...new Set(others.flatMap((o) => o.people))]
  const isProtected = protectedBranches.some((p) => typeof p === "string" && matchBranch(p, String(branch ?? "")))
  const level = !commits.length ? "none" : others.length ? "others" : "own"
  return { lost: commits, others, people, isProtected, requireTyping: level === "others" || isProtected, level }
}

/** A full 40- or 64-character object name. Git can only check an abbreviated one it has locally. */
export const isFullSha = (sha?: string) => !!sha && /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/i.test(sha.trim())

/**
 * The command to run instead of a bare --force. With the full tip SHA you were shown, the lease is pinned to it
 * (`--force-with-lease=<branch>:<sha>`), so the push fails if anyone pushed after you looked, whatever a background
 * fetch did. An abbreviated SHA isn't pinned: git rejects one it hasn't fetched ("cannot parse expected object name").
 * Without a pin it uses `--force-with-lease --force-if-includes` (Git 2.30+), which refuses the push when the
 * remote-tracking tip isn't in your branch's reflog, so an IDE's auto-fetch can't silently refresh the lease. The
 * explicit refspec keeps --force from touching any other branch.
 */
export function leaseCommand({ branch, remote = "origin", remoteSha, lease = true }: { branch: string; remote?: string; remoteSha?: string; lease?: boolean }) {
  const quote = (s: string) => (/^[\w./:@-]+$/.test(s) ? s : `'${s.replace(/'/g, "'\\''")}'`)
  if (!lease) return `git push --force ${quote(remote)} ${quote(branch)}`
  const flag = isFullSha(remoteSha) ? `--force-with-lease=${quote(`${branch}:${remoteSha!.trim()}`)}` : "--force-with-lease --force-if-includes"
  return `git push ${flag} ${quote(remote)} ${quote(branch)}`
}

/** "3 hours ago" in the reader's locale; empty for missing or invalid dates. */
export function commitAge(date: RemoteCommit["date"], now: number, locale?: string) {
  if (date === undefined || date === null || !Number.isFinite(now)) return ""
  const time = new Date(date).getTime()
  if (!Number.isFinite(time)) return ""
  const seconds = Math.round((time - now) / 1000)
  const steps: [Intl.RelativeTimeFormatUnit, number][] = [["year", 31536000], ["month", 2592000], ["week", 604800], ["day", 86400], ["hour", 3600], ["minute", 60]]
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" })
  for (const [unit, size] of steps) if (Math.abs(seconds) >= size) return rtf.format(Math.round(seconds / size), unit)
  return rtf.format(0, "minute")
}

/** Accepts "feature/x", " feature/x ", "origin/feature/x" and "refs/heads/feature/x" for branch feature/x. */
export function typedBranchMatches(typed: string, branch: string, remote = "origin") {
  const t = typed.trim()
  return !!t && (t === branch || t === `${remote}/${branch}` || t === `refs/heads/${branch}`)
}
