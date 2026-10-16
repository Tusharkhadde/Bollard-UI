// Pure parsing of `git status --porcelain` and of destructive git commands, and the list of what each would lose.

export type GitOp = "reset-hard" | "clean" | "checkout" | "stash-drop" | "stash-clear"

export interface StatusEntry {
  path: string
  /** Index (staged) status, "." when unchanged. "?" untracked, "!" ignored. */
  x: string
  /** Work tree (unstaged) status, "." when unchanged. */
  y: string
  conflict?: boolean
  /** A submodule (porcelain v2 only). reset --hard and checkout leave its files alone without --recurse-submodules. */
  submodule?: boolean
}

export interface GitStatus {
  branch: string
  upstream: string
  ahead: number
  behind: number
  entries: StatusEntry[]
}

export interface ParsedGitCommand {
  op: GitOp
  /** reset --hard target, or the checkout/restore source; "" means HEAD / the index. */
  target: string
  paths: string[]
  /** clean: -d, -x, -X, -f, -n, -i. checkout/restore: staged (also restores the index). */
  flags: { d?: boolean; x?: boolean; X?: boolean; f?: boolean; n?: boolean; i?: boolean; staged?: boolean; worktree?: boolean; recurse?: boolean; force?: boolean }
  /** clean: `-e`/`--exclude` patterns, which keep matching files. */
  exclude?: string[]
  stashRef: string
}

export interface Commit {
  sha: string
  subject: string
}

export interface StashEntry {
  /** e.g. "stash@{0}". Defaults to its position in the list. */
  ref?: string
  /** Full commit id, printed by `git stash list --format=%H`; lets the user recover a dropped stash. */
  sha?: string
  message: string
  /** Files in the stash with their +/- lines (`git stash show --numstat`). */
  files?: { path: string; added: number | null; removed: number | null }[]
}

export type LostReason = "modified" | "staged" | "new" | "conflict" | "untracked" | "ignored"

export interface LostFile {
  path: string
  reason: LostReason
  added: number | null
  removed: number | null
  /** Ignored files that are hard to get back (.env, keys, local databases), sorted first. */
  precious?: boolean
  /** Ignored files a build or install recreates (node_modules/, dist/…). */
  rebuildable?: boolean
}

export interface LossReport {
  command: ParsedGitCommand | null
  files: LostFile[]
  commits: Commit[]
  /** How many of `commits` exist only on this machine. */
  unpushed: number
  /** The shas of those commits: from the `unpushed` input when given, else the newest `ahead` ones (exact for linear history). */
  unpushedShas: string[]
  /** HEAD isn't on a branch, so commits it moves past are only kept by the reflog. */
  detached: boolean
  stashes: StashEntry[]
  /** Things people expect to lose but won't, e.g. untracked files under reset --hard. */
  kept: { untracked: number; ignored: number; staged: number; dirs: number; excluded: number; submodules: number }
  /** clean without -f, -n dry run, or restore --staged: nothing is deleted. */
  harmless: "" | "needs-force" | "dry-run" | "unstage-only"
  missingStash: boolean
}

const clean = (text: unknown) => (typeof text === "string" ? text.replace(/^\uFEFF/, "").slice(0, 2_000_000) : "")

/** Undo git's C-style quoting: "caf\303\251 \"x\".txt" → café "x".txt */
export function unquotePath(raw: string) {
  if (!raw.startsWith('"') || !raw.endsWith('"') || raw.length < 2) return raw
  const bytes: number[] = []
  const body = raw.slice(1, -1)
  const map: Record<string, number> = { n: 10, t: 9, r: 13, b: 8, f: 12, v: 11, a: 7, '"': 34, "\\": 92 }
  for (let i = 0; i < body.length; i++) {
    const ch = body[i]
    if (ch === "\\" && i + 1 < body.length) {
      const oct = body.slice(i + 1, i + 4)
      if (/^[0-7]{3}$/.test(oct)) {
        bytes.push(parseInt(oct, 8))
        i += 3
      } else {
        bytes.push(map[body[i + 1]] ?? body.charCodeAt(i + 1))
        i += 1
      }
    } else bytes.push(...new TextEncoder().encode(ch))
  }
  return new TextDecoder().decode(new Uint8Array(bytes))
}

/** Reads `git status --porcelain` v1 or v2, with or without -z and --branch. Garbage lines are skipped. */
export function parsePorcelain(input: unknown): GitStatus {
  const text = clean(input)
  const status: GitStatus = { branch: "", upstream: "", ahead: 0, behind: 0, entries: [] }
  const z = text.includes("\0")
  const lines = z ? text.split("\0") : text.split(/\r?\n/)
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (!line) continue
    const path = (p: string) => (z ? p : unquotePath(p))
    if (line.startsWith("# branch.head ")) status.branch = line.slice(14)
    else if (line.startsWith("# branch.upstream ")) status.upstream = line.slice(18)
    else if (line.startsWith("# branch.ab ")) {
      const m = line.match(/\+(\d+) -(\d+)/)
      if (m) [status.ahead, status.behind] = [Number(m[1]), Number(m[2])]
    } else if (line.startsWith("## ")) {
      const m = line.slice(3).match(/^(.+?)(?:\.\.\.(\S+))?(?: \[(.*)\])?$/)
      status.branch = m?.[1].replace(/^No commits yet on /, "") ?? ""
      status.upstream = m?.[2] ?? ""
      status.ahead = Number(m?.[3]?.match(/ahead (\d+)/)?.[1] ?? 0)
      status.behind = Number(m?.[3]?.match(/behind (\d+)/)?.[1] ?? 0)
    } else if (/^[12u] /.test(line)) {
      const parts = line.split(" ")
      const xy = parts[1] ?? ".."
      const fields = line[0] === "1" ? 8 : line[0] === "2" ? 9 : 10
      let p = parts.slice(fields).join(" ")
      if (line[0] === "2") {
        if (z) i++ // original path is the next NUL field
        else p = p.split("\t")[0]
      }
      if (p) status.entries.push({ path: path(p), x: xy[0], y: xy[1] ?? ".", conflict: line[0] === "u" || undefined, submodule: parts[2]?.startsWith("S") || undefined })
    } else if (/^[?!] /.test(line)) status.entries.push({ path: path(line.slice(2)), x: line[0], y: line[0] })
    else if (/^[ MTADRCU?!]{2} /.test(line)) {
      const x = line[0] === " " ? "." : line[0]
      const y = line[1] === " " ? "." : line[1]
      let p = line.slice(3)
      if (x === "R" || x === "C") {
        if (z) i++
        else p = p.split(" -> ").pop() ?? p
      }
      const conflict = x === "U" || y === "U" || (x === "A" && y === "A") || (x === "D" && y === "D")
      status.entries.push({ path: path(p), x: x === "?" || x === "!" ? x : x, y, conflict: conflict || undefined })
    }
  }
  return status
}

/** Reads `git diff --numstat`. Binary files ("-\t-") come back as null counts. */
export function parseNumstat(input: unknown) {
  const map = new Map<string, { added: number | null; removed: number | null }>()
  for (const line of clean(input).split(/\r?\n/)) {
    const m = line.match(/^(\d+|-)\t(\d+|-)\t(.+)$/)
    if (!m) continue
    // Renames: "src/{a.ts => b.ts}" or "a.ts => b.ts"
    const p = m[3].replace(/\{[^}]* => ([^}]*)\}/, "$1").replace(/^.* => /, "").replace(/\/\//g, "/")
    map.set(unquotePath(p), { added: m[1] === "-" ? null : Number(m[1]), removed: m[2] === "-" ? null : Number(m[2]) })
  }
  return map
}

/** Reads `git log --oneline` (or `%H %s`). */
export function parseLog(input: unknown): Commit[] {
  return clean(input).split(/\r?\n/).flatMap((line) => {
    const m = line.trim().match(/^([0-9a-f]{4,64})\s+(.*)$/i)
    return m ? [{ sha: m[1], subject: m[2] }] : []
  })
}

/** Shell words, honouring quotes, up to the first `&&`, `||`, `;` or `|`. */
function shellWords(text: string) {
  const out: string[] = []
  let cur = ""
  let quote = ""
  let has = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (quote) {
      if (ch === quote) quote = ""
      else if (ch === "\\" && quote === '"' && i + 1 < text.length) cur += text[++i]
      else cur += ch
    } else if (ch === "'" || ch === '"') (quote = ch), (has = true)
    else if (ch === "\\" && i + 1 < text.length) (cur += text[++i]), (has = true)
    else if (/[;&|]/.test(ch)) break
    else if (/\s/.test(ch)) {
      if (has || cur) out.push(cur)
      cur = ""
      has = false
    } else (cur += ch), (has = true)
  }
  if (has || cur) out.push(cur)
  return out
}

// Global options before the subcommand; the listed ones take a value.
const GLOBAL_WITH_VALUE = new Set(["-c", "-C", "--git-dir", "--work-tree", "--namespace", "--exec-path", "--config-env"])

/** Recognises reset --hard, clean, checkout/restore of paths, checkout -f / switch --discard-changes, stash drop and stash clear. Anything else is null. */
export function parseGitCommand(input: unknown): ParsedGitCommand | null {
  const all = shellWords(clean(input).replace(/^\$\s+/, "").trim()).slice(0, 200)
  if (all[0] !== "git") return null
  let at = 1
  while (at < all.length && all[at].startsWith("-")) at += GLOBAL_WITH_VALUE.has(all[at]) ? 2 : 1
  const [sub, ...rest] = all.slice(at)
  const dash = rest.indexOf("--")
  const before = dash < 0 ? rest : rest.slice(0, dash)
  const after = dash < 0 ? [] : rest.slice(dash + 1)
  // Short flags can be bundled: -SW, -fdx.
  const short = (letter: string) => before.some((w) => /^-[a-zA-Z]+$/.test(w) && w.includes(letter))
  const recurse = before.includes("--recurse-submodules") || undefined
  const base: ParsedGitCommand = { op: "reset-hard", target: "", paths: [], flags: {}, stashRef: "" }
  if (sub === "reset" && before.includes("--hard")) return { ...base, target: before.find((w) => !w.startsWith("-")) ?? "", flags: { recurse } }
  if (sub === "clean") {
    const flags: ParsedGitCommand["flags"] = {}
    const paths: string[] = [...after]
    const exclude: string[] = []
    for (let i = 0; i < before.length; i++) {
      const w = before[i]
      if (w === "-e" || w === "--exclude") exclude.push(before[++i] ?? "")
      else if (w.startsWith("--exclude=")) exclude.push(w.slice(10))
      else if (/^-e./.test(w)) exclude.push(w.slice(2))
      else if (w === "--force") flags.f = true
      else if (w === "--dry-run") flags.n = true
      else if (w === "--interactive") flags.i = true
      else if (/^-[a-zA-Z]+$/.test(w)) for (const c of w.slice(1)) flags[c as "d"] = true
      else if (!w.startsWith("-")) paths.push(w)
    }
    return { ...base, op: "clean", flags, paths, exclude: exclude.filter(Boolean) }
  }
  if (sub === "checkout" || sub === "restore" || sub === "switch") {
    const force = sub === "switch" ? before.includes("--discard-changes") || short("f") || before.includes("--force") : sub === "checkout" && (short("f") || before.includes("--force"))
    const source = before.find((w) => w.startsWith("--source="))?.slice(9) ?? before.find((w, i) => before[i - 1] === "-s" || before[i - 1] === "--source") ?? ""
    const paths = sub === "switch" ? [] : dash >= 0 ? after : sub === "restore" ? before.filter((w, i) => !w.startsWith("-") && before[i - 1] !== "-s" && before[i - 1] !== "--source") : before.filter((w) => w === "." || w.includes("/") || w.includes("."))
    if (!paths.length) {
      // `git checkout -f main` / `git switch --discard-changes main` throw away every tracked change, staged or not.
      if (force) return { ...base, op: "checkout", target: before.find((w) => !w.startsWith("-")) ?? "", paths: ["."], flags: { staged: true, worktree: true, force: true, recurse } }
      return null // A plain branch switch: git refuses if it would lose changes.
    }
    const target = sub === "checkout" ? before.find((w) => !w.startsWith("-") && !paths.includes(w)) ?? "" : source
    const staged = before.includes("--staged") || short("S")
    const worktree = sub === "checkout" || before.includes("--worktree") || short("W") || !staged
    return { ...base, op: "checkout", target, paths, flags: { staged: sub === "checkout" ? !!target : staged, worktree, recurse } }
  }
  const stashArg = before.slice(1).find((w) => !w.startsWith("-"))
  if (sub === "stash" && before[0] === "drop") return { ...base, op: "stash-drop", stashRef: stashArg ?? "stash@{0}" }
  if (sub === "stash" && before[0] === "clear") return { ...base, op: "stash-clear" }
  return null
}

const PRECIOUS = /(^|\/)(\.env(\.[\w-]+)?|[^/]*\.(pem|key|p12|pfx|keystore|jks|sqlite3?|db)|\.vscode\/|\.idea\/|[^/]*\.local(\.\w+)?|credentials[^/]*|id_(rsa|ed25519|ecdsa)[^/]*)$/i
const EXAMPLE_ENV = /\.env\.(example|sample|template|dist)$/i
const REBUILDABLE = /(^|\/)(node_modules|dist|build|out|\.next|\.nuxt|\.svelte-kit|\.turbo|\.cache|\.parcel-cache|coverage|target|__pycache__|\.pytest_cache|\.venv|venv|vendor)(\/|$)|\.(pyc|log|tsbuildinfo)$|(^|\/)\.DS_Store$/i
/** clean's -e patterns follow .gitignore rules; this covers names, globs and folder patterns. */
const excluded = (path: string, patterns: string[]) =>
  patterns.some((raw) => {
    const p = raw.replace(/^\.\//, "").replace(/\/$/, "")
    const re = new RegExp("^" + p.replace(/[.+^$()|[\]\\{}]/g, "\\$&").replace(/\*\*/g, "\u0000").replace(/\*/g, "[^/]*").replace(/\?/g, "[^/]").replace(/\u0000/g, ".*") + "(/.*)?$")
    const bare = path.replace(/\/$/, "")
    return p.includes("/") ? re.test(bare) : bare.split("/").some((_, i, parts) => re.test(parts.slice(i).join("/")))
  })
const isHead = (target: string) => !target || target === "HEAD" || target === "@"
const inPaths = (path: string, paths: string[]) =>
  !paths.length || paths.some((p) => {
    const norm = p.replace(/^\.\//, "").replace(/\/$/, "")
    return norm === "." || norm === "" || norm === ":/" || path === norm || path.startsWith(norm + "/")
  })

/** Exactly what `command` would destroy, given the repo's status (and diff counts, commits or stashes when relevant). */
export function whatWillBeLost(input: { command: unknown; status: unknown; numstat?: unknown; commits?: unknown; stashes?: StashEntry[]; unpushed?: unknown }): LossReport {
  const command = parseGitCommand(input.command)
  const status = parsePorcelain(input.status)
  const counts = parseNumstat(input.numstat)
  const detached = status.branch === "(detached)" || status.branch === "HEAD (no branch)"
  const report: LossReport = { command, files: [], commits: [], unpushed: 0, unpushedShas: [], detached, stashes: [], kept: { untracked: 0, ignored: 0, staged: 0, dirs: 0, excluded: 0, submodules: 0 }, harmless: "", missingStash: false }
  if (!command) return report
  const count = (path: string) => counts.get(path) ?? { added: null, removed: null }
  const tracked = status.entries.filter((e) => e.x !== "?" && e.x !== "!")
  const untracked = status.entries.filter((e) => e.x === "?")
  const ignored = status.entries.filter((e) => e.x === "!")

  const skipSubmodule = (e: StatusEntry) => {
    if (!e.submodule || command.flags.recurse) return false
    report.kept.submodules++
    return true
  }
  if (command.op === "reset-hard") {
    for (const e of tracked) {
      if (skipSubmodule(e)) continue
      // A deletion coming back isn't lost work.
      if ((e.x === "D" || e.x === ".") && (e.y === "D" || e.y === ".") && !e.conflict) continue
      const reason: LostReason = e.conflict ? "conflict" : e.x === "A" ? "new" : e.y !== "." ? "modified" : "staged"
      report.files.push({ path: e.path, reason, ...count(e.path) })
    }
    report.kept.untracked = untracked.length
    report.kept.ignored = ignored.length
    if (!isHead(command.target)) {
      const commits = Array.isArray(input.commits) ? (input.commits as Commit[]).filter((c) => c && typeof c.sha === "string") : parseLog(input.commits)
      report.commits = commits
      // Exact list from `git rev-list @{u}..HEAD` when given; otherwise the newest `ahead` ones, which holds for linear history.
      const exact = Array.isArray(input.unpushed) ? input.unpushed.map(String) : typeof input.unpushed === "string" ? parseLog(input.unpushed.replace(/^([0-9a-f]{4,64})\s*$/gim, "$1 -")).map((c) => c.sha) : null
      const same = (a: string, b: string) => a.length >= 4 && b.length >= 4 && (a.startsWith(b) || b.startsWith(a))
      report.unpushedShas = exact ? commits.filter((c) => exact.some((sha) => same(sha, c.sha))).map((c) => c.sha) : commits.slice(0, status.upstream && !detached ? status.ahead : commits.length).map((c) => c.sha)
      report.unpushed = report.unpushedShas.length
    }
  } else if (command.op === "clean") {
    const { f, n, i, d, x, X } = command.flags
    if (n) report.harmless = "dry-run"
    else if (!f && !i) report.harmless = "needs-force"
    const pick = (list: StatusEntry[], reason: LostReason) => {
      for (const e of list) {
        if (!inPaths(e.path, command.paths)) continue
        if (excluded(e.path, command.exclude ?? [])) {
          report.kept.excluded++
          continue
        }
        if (e.path.endsWith("/") && !d) {
          report.kept.dirs++
          continue
        }
        const precious = reason === "ignored" && PRECIOUS.test(e.path.replace(/\/$/, "/")) && !EXAMPLE_ENV.test(e.path)
        report.files.push({ path: e.path, reason, added: null, removed: null, precious: precious || undefined, rebuildable: (!precious && REBUILDABLE.test(e.path)) || undefined })
      }
    }
    if (!X) pick(untracked, "untracked")
    else report.kept.untracked = untracked.length
    if (x || X) pick(ignored, "ignored")
    else report.kept.ignored = ignored.length
    report.files.sort((a, b) => Number(!!b.precious) - Number(!!a.precious) || Number(!!a.rebuildable) - Number(!!b.rebuildable))
  } else if (command.op === "checkout") {
    const { staged, worktree } = command.flags
    if (!worktree) report.harmless = "unstage-only"
    for (const e of tracked) {
      if (!inPaths(e.path, command.paths) || skipSubmodule(e)) continue
      const unstaged = e.y !== "." && e.y !== "D"
      const stagedChange = e.x !== "." && e.x !== "D"
      // Git refuses to check out unmerged paths, so conflicts are never silently lost here.
      if (e.conflict) continue
      if (worktree && (unstaged || (staged && stagedChange))) report.files.push({ path: e.path, reason: unstaged ? "modified" : e.x === "A" ? "new" : "staged", ...count(e.path) })
      else if (stagedChange) report.kept.staged++
    }
    report.kept.untracked = untracked.filter((e) => inPaths(e.path, command.paths)).length
  } else {
    const list = (input.stashes ?? []).map((s, i) => ({ ...s, ref: s.ref ?? `stash@{${i}}` }))
    const ref = command.stashRef.replace(/^stash@\{(\d+)\}$/, "stash@{$1}").replace(/^(\d+)$/, "stash@{$1}")
    report.stashes = command.op === "stash-clear" ? list : list.filter((s) => s.ref === ref)
    report.missingStash = command.op === "stash-drop" && report.stashes.length === 0
  }
  return report
}

/** The stash command that keeps everything this command would delete. */
export function stashFirstCommand(command: ParsedGitCommand | null) {
  if (!command || command.op === "stash-drop" || command.op === "stash-clear") return ""
  const scope = command.op === "clean" ? (command.flags.x || command.flags.X ? " --all" : " --include-untracked") : ""
  const paths = command.op !== "reset-hard" && command.paths.length && !command.paths.every((p) => p === ".") ? ` -- ${command.paths.join(" ")}` : ""
  return `git stash push${scope} -m "before ${command.op === "reset-hard" ? "reset --hard" : command.op}"${paths}`
}
