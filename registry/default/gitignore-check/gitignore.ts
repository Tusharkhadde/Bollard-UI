// Bollard UI — gitignore-check · MIT licence · https://bollard-ui.vercel.app/components/gitignore-check

/**
 * A dependency-free .gitignore engine that follows git's rules (git-scm.com/docs/gitignore and dir.c):
 * BOM and CR are dropped, unescaped trailing spaces are trimmed (tabs are not), `#` is only a comment at the
 * start of a line, the last matching line wins, a slash at the start or middle anchors the pattern, a trailing
 * slash matches directories only, and a file can't be re-included when a parent directory is excluded.
 */

export interface GitignoreRule {
  /** 0-based source line. */
  line: number
  /** The line as written (CR removed). */
  source: string
  /** Pattern after trimming, without `!` and the trailing `/`. */
  pattern: string
  negated: boolean
  dirOnly: boolean
  /** Has a leading or middle slash, so it only matches from the .gitignore's folder. */
  anchored: boolean
  regex: RegExp | null
}

export type IgnoreVerdict =
  | { ignored: false; rule?: GitignoreRule }
  /** `viaDir`: an excluded parent folder decides it; `blocked`: the file's own `!` line that can't re-include it. */
  | { ignored: true; rule: GitignoreRule; viaDir?: string; blocked?: GitignoreRule }

export type GitignoreIssueKind =
  | "inline-comment" | "trailing-tab" | "trailing-space" | "leading-space" | "backslash" | "dot-slash"
  | "dir-blocks-negation" | "negation-overridden" | "anchored-misses" | "not-ignored" | "tracked"

export interface GitignoreIssue {
  kind: GitignoreIssueKind
  severity: "error" | "warning" | "info"
  /** 0-based .gitignore line, when the issue is about a line. */
  line?: number
  /** The file path or detail filled into the message. */
  detail?: string
  /** A rewrite of the whole .gitignore that fixes it. */
  fix?: string
}

export interface FileEntry {
  path: string
  tracked: boolean
}

export const toLines = (text: string) => text.replace(/^\uFEFF/, "").split(/\r\n|\r|\n/)
const eol = (text: string) => (/\r\n/.test(text) ? "\r\n" : "\n")
const bom = (text: string) => (text.startsWith("\uFEFF") ? "\uFEFF" : "")
/** Rebuilds the text keeping its BOM and line endings. */
const join = (original: string, lines: string[]) => bom(original) + lines.join(eol(original))

/** git's trim_trailing_spaces: drop unescaped trailing spaces only. */
export function trimTrailingSpaces(line: string) {
  let lastSpace = -1
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === " ") { if (lastSpace < 0) lastSpace = i }
    else if (ch === "\\") { i++; lastSpace = -1 }
    else lastSpace = -1
  }
  return lastSpace < 0 ? line : line.slice(0, lastSpace)
}

/** Turns a wildmatch (WM_PATHNAME) pattern into a RegExp, or null when git would never match it. */
export function patternToRegex(pattern: string): RegExp | null {
  let out = ""
  for (let i = 0; i < pattern.length; i++) {
    const ch = pattern[i]
    if (ch === "*") {
      const start = i
      while (pattern[i + 1] === "*") i++
      const double = i > start
      const before = start === 0 || pattern[start - 1] === "/"
      const after = i + 1 === pattern.length || pattern[i + 1] === "/"
      if (double && before && after) {
        if (i + 1 === pattern.length) out += ".*"
        else { out += "(?:.*/)?"; i++ }
      } else out += "[^/]*"
    } else if (ch === "?") out += "[^/]"
    else if (ch === "[") {
      // wildmatch brackets: `!`/`^` negates, a leading `]` is literal, `\x` escapes, `[:class:]` names a class.
      let j = i + 1
      const negate = pattern[j] === "!" || pattern[j] === "^"
      if (negate) j++
      let body = ""
      let closed = false
      let prev = ""
      for (let first = true; j < pattern.length; j++, first = false) {
        const c = pattern[j]
        if (c === "]" && !first) { closed = true; break }
        if (c === "-" && prev && pattern[j + 1] !== undefined && pattern[j + 1] !== "]") {
          // A reversed range (z-a) matches only its first character in git; JS would throw.
          const escaped = pattern[j + 1] === "\\" && j + 2 < pattern.length
          if ((escaped ? pattern[j + 2] : pattern[j + 1]) < prev) { j += escaped ? 2 : 1; prev = ""; continue }
        }
        if (c === "\\" && j + 1 < pattern.length) { const lit = pattern[++j]; body += /\w/.test(lit) ? lit : "\\" + lit; prev = lit; continue }
        prev = c
        if (c === "[" && pattern[j + 1] === ":") {
          const end = pattern.indexOf(":]", j + 2)
          if (end > 0) { prev = ""; body += ({ alpha: "a-zA-Z", digit: "0-9", alnum: "a-zA-Z0-9", upper: "A-Z", lower: "a-z", space: "\\s", blank: " \\t", xdigit: "0-9a-fA-F", punct: "!-/:-@\\[-`{-~" } as Record<string, string>)[pattern.slice(j + 2, end)] ?? ""; j = end + 1; continue }
        }
        body += /[\]\\^]/.test(c) ? "\\" + c : c
      }
      // git's wildmatch aborts on an unclosed bracket, so the line never matches anything.
      if (!closed) return null
      out += `[${negate ? "^/" : ""}${body}]`
      i = j
    } else if (ch === "\\") {
      if (i + 1 >= pattern.length) return null
      out += pattern[++i].replace(/[.*+?^${}()|[\]\\/]/g, "\\$&")
    } else out += ch.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&")
  }
  try { return new RegExp(`^${out}$`) } catch { return null }
}

export function parseGitignore(text: string): GitignoreRule[] {
  const rules: GitignoreRule[] = []
  toLines(typeof text === "string" ? text : "").forEach((source, line) => {
    let pattern = trimTrailingSpaces(source)
    if (!pattern || pattern.startsWith("#")) return
    const negated = pattern.startsWith("!")
    if (negated) pattern = pattern.slice(1)
    if (pattern.startsWith("\\#") || pattern.startsWith("\\!")) pattern = pattern.slice(1)
    const dirOnly = pattern.endsWith("/") && !pattern.endsWith("\\/")
    if (dirOnly) pattern = pattern.replace(/\/+$/, "")
    if (!pattern) return
    const anchored = pattern.includes("/")
    if (pattern.startsWith("/")) pattern = pattern.slice(1)
    rules.push({ line, source, pattern, negated, dirOnly, anchored, regex: patternToRegex(pattern) })
  })
  return rules
}

const normalizePath = (path: string) => path.replace(/[\r\n]+/g, "").replace(/\\/g, "/").replace(/^\.\//, "").replace(/^\/+/, "").replace(/\/{2,}/g, "/")

function ruleMatches(rule: GitignoreRule, path: string, isDir: boolean) {
  if (!rule.regex || (rule.dirOnly && !isDir)) return false
  return rule.regex.test(rule.anchored ? path : path.slice(path.lastIndexOf("/") + 1))
}

/** The last rule matching this exact path, ignoring parents. */
function lastMatch(rules: GitignoreRule[], path: string, isDir: boolean) {
  for (let i = rules.length - 1; i >= 0; i--) if (ruleMatches(rules[i], path, isDir)) return rules[i]
  return undefined
}

/** Directory verdicts repeat across files, so they're cached per parsed rule list. */
const dirCache = new WeakMap<GitignoreRule[], Map<string, GitignoreRule | null>>()
function dirMatch(rules: GitignoreRule[], dir: string) {
  let cache = dirCache.get(rules)
  if (!cache) dirCache.set(rules, (cache = new Map()))
  if (!cache.has(dir)) cache.set(dir, lastMatch(rules, dir, true) ?? null)
  return cache.get(dir) ?? undefined
}

/** Whether git ignores the path, and which line decides it. A path ending in "/" is a directory. */
export function checkIgnore(rules: GitignoreRule[], rawPath: string): IgnoreVerdict {
  const isDir = rawPath.trim().endsWith("/")
  const path = normalizePath(rawPath).replace(/\/$/, "")
  if (!path) return { ignored: false }
  const parts = path.split("/")
  for (let depth = 1; depth < parts.length; depth++) {
    const dir = parts.slice(0, depth).join("/")
    const rule = dirMatch(rules, dir)
    if (rule && !rule.negated) {
      const own = lastMatch(rules, path, isDir)
      return { ignored: true, rule, viaDir: dir, blocked: own?.negated ? own : undefined }
    }
  }
  const rule = lastMatch(rules, path, isDir)
  return rule && !rule.negated ? { ignored: true, rule } : { ignored: false, rule }
}

/** Reads a pasted file list: plain paths, `git ls-files` output or `git status --porcelain` lines. */
export function parseFileList(text: string, trackedByDefault = false, tracked: string[] = []): FileEntry[] {
  const known = new Set(tracked.map(normalizePath))
  const seen = new Set<string>()
  const entries: FileEntry[] = []
  for (const raw of toLines(typeof text === "string" ? text : "")) {
    if (!raw.trim() || raw.trim().startsWith("#")) continue
    const status = /^([ MADRCU?!T]{2}) (.+)$/.exec(raw)
    let path = status ? status[2] : raw
    if (status && /->/.test(path)) path = path.split("->").pop() ?? path
    path = path.trim().replace(/^"(.*)"$/, "$1")
    const key = normalizePath(path).replace(/\/$/, "")
    if (!key || seen.has(key) || key.length > 4096) continue
    seen.add(key)
    const isTracked = status ? !["??", "!!"].includes(status[1]) : trackedByDefault || known.has(key)
    entries.push({ path: path.trim().endsWith("/") ? `${key}/` : key, tracked: isTracked })
    if (entries.length >= 2000) break
  }
  return entries
}

const SENSITIVE: [RegExp, string][] = [
  [/(^|\/)\.env(\.(?!example$|sample$|template$|dist$)[^/]+)?$/i, ".env"],
  [/\.(pem|key|p12|pfx|jks|keystore)$/i, "key"],
  [/(^|\/)id_(rsa|dsa|ecdsa|ed25519)$/, "key"],
  [/(^|\/)(credentials(\.json)?|service-account[^/]*\.json|\.npmrc|\.netrc|\.pypirc|\.git-credentials)$/i, "key"],
  [/\.tfstate(\.backup)?$/i, "key"],
  [/(^|\/)node_modules\//, "node_modules"],
]
export const sensitiveKind = (path: string) => SENSITIVE.find(([re]) => re.test(normalizePath(path)))?.[1]

/** Lines to append so each kind is ignored, keeping example env files committable. */
const ADDITIONS: Record<string, string[]> = { ".env": [".env", ".env.*", "!.env.example"], key: ["*.pem", "*.key", "id_rsa", "id_ed25519"], node_modules: ["node_modules/"] }
/** The line that ignores this exposed key-like file: its extension (*.pem, *.tfstate), or its name (credentials.json, .npmrc). */
function keyLines(path: string) {
  const name = normalizePath(path).split("/").pop() ?? path
  if (/\.tfstate(\.backup)?$/i.test(name)) return ["*.tfstate", "*.tfstate.*"]
  const ext = /\.(pem|key|p12|pfx|jks|keystore)$/i.exec(name)
  if (ext) return [`*.${ext[1]}`]
  if (/^service-account[^/]*\.json$/i.test(name)) return ["service-account*.json"]
  return [name.replace(/([*?[\]\\!#])/g, "\\$1")]
}
/** Paths probed when no file list is given (node_modules only when the list shows a Node project). */
const PROBES: [string, string][] = [[".env", ".env"], [".env.local", ".env"], ["deploy.pem", "key"], ["id_rsa", "key"]]

function append(text: string, lines: string[]) {
  const rows = toLines(text)
  while (rows.length && !rows[rows.length - 1].trim()) rows.pop()
  return join(text, [...rows, ...lines, ""])
}
function replaceLine(text: string, line: number, next: string | null) {
  const rows = toLines(text)
  if (next === null) rows.splice(line, 1)
  else rows[line] = next
  return join(text, rows)
}
const quotePath = (path: string) => (/^[\w./@+-]+$/.test(path) ? path : `'${path.replace(/'/g, `'\\''`)}'`)

/** One `git rm --cached` command that untracks the paths but keeps them on disk. */
export const untrackCommand = (paths: string[]) => `git rm -r --cached -- ${paths.map((p) => quotePath(p.replace(/\/$/, ""))).join(" ")}`

/** Everything wrong with the .gitignore text and, given files, with what it actually does to them. */
export function checkGitignore(text: string, files: FileEntry[] = []): GitignoreIssue[] {
  const source = typeof text === "string" ? text : ""
  const issues: GitignoreIssue[] = []
  const rows = toLines(source)
  rows.forEach((row, line) => {
    if (!row.trim() || row.trimStart().startsWith("#")) return
    if (/[\t\u00a0]+$/.test(row)) issues.push({ kind: "trailing-tab", severity: "error", line, fix: replaceLine(source, line, row.replace(/[\s\u00a0]+$/, "")) })
    else if (/[^\\] +$/.test(row)) issues.push({ kind: "trailing-space", severity: "info", line, fix: replaceLine(source, line, trimTrailingSpaces(row)) })
    if (/^\s+\S/.test(row)) issues.push({ kind: "leading-space", severity: "error", line, fix: replaceLine(source, line, row.trimStart()) })
    const comment = /\s+#.*$/.exec(row)
    if (comment && !row.startsWith("#") && !/\\#/.test(row)) issues.push({ kind: "inline-comment", severity: "error", line, detail: row.slice(0, comment.index).trim(), fix: replaceLine(source, line, row.slice(0, comment.index)) })
    if (/\\(?![#! *?[\\])/.test(row) && /\w\\\w/.test(row)) issues.push({ kind: "backslash", severity: "error", line, fix: replaceLine(source, line, row.replace(/\\/g, "/")) })
    if (/^!?\.\//.test(row.trim())) issues.push({ kind: "dot-slash", severity: "error", line, fix: replaceLine(source, line, row.replace("./", "/")) })
  })

  const rules = parseGitignore(source)
  rules.forEach((rule, index) => {
    if (!rule.negated) return
    // A negation can't reach inside a directory an earlier (or later) rule excludes.
    const parts = rule.pattern.split("/")
    for (let depth = 1; depth < parts.length; depth++) {
      const dir = parts.slice(0, depth).join("/")
      if (/[*?[]/.test(dir)) break
      const blocker = lastMatch(rules, dir, true)
      if (blocker && !blocker.negated) {
        // `logs/` → `logs/*` style: ignore the folder's contents instead, so `!` can re-include a file in it.
        const contents = `${blocker.anchored ? "/" : "**/"}${blocker.pattern}/*`
        issues.push({ kind: "dir-blocks-negation", severity: "error", line: rule.line, detail: blocker.source.trim(), fix: depth === parts.length - 1 ? replaceLine(source, blocker.line, contents) : undefined })
        return
      }
    }
    // A literal negation followed by a rule that ignores it again: the later line wins.
    if (/[*?[\\]/.test(rule.pattern)) return
    const later = rules.slice(index + 1).find((other) => !other.negated && ruleMatches(other, rule.pattern, false))
    if (later) {
      const moved = toLines(source)
      const [row] = moved.splice(rule.line, 1)
      moved.splice(later.line, 0, row)
      issues.push({ kind: "negation-overridden", severity: "error", line: rule.line, detail: later.source.trim(), fix: join(source, moved) })
    }
  })

  // Anchored rules that miss the same name deeper in the tree.
  const anchoredMisses = new Map<number, string>()
  for (const file of files) {
    const verdict = checkIgnore(rules, file.path)
    if (verdict.ignored) continue
    const parts = normalizePath(file.path).split("/")
    for (const rule of rules) {
      if (rule.negated || !rule.anchored || rule.pattern.includes("/") || !rule.regex || anchoredMisses.has(rule.line)) continue
      const hit = parts.findIndex((part, i) => i > 0 && rule.regex!.test(part) && (!rule.dirOnly || i < parts.length - 1))
      if (hit > 0) anchoredMisses.set(rule.line, file.path)
    }
  }
  for (const [line, path] of anchoredMisses) issues.push({ kind: "anchored-misses", severity: "warning", line, detail: path, fix: replaceLine(source, line, rows[line].replace(/^(\s*!?)\//, "$1")) })

  // Sensitive files that would be committed, from the list or from probes.
  const exposed = new Map<string, string[]>()
  const probes: [string, string][] = files.length ? files.map((file) => [file.path, sensitiveKind(file.path) ?? ""]) : PROBES
  for (const [path, kind] of probes) {
    if (!kind || checkIgnore(rules, path).ignored) continue
    exposed.set(kind, [...(exposed.get(kind) ?? []), path])
  }
  for (const [kind, paths] of exposed) {
    // From a real file list it's a leak; from probes it's a likely one.
    // Almost no template ignores *.pem, so a key probe alone is a hint, not a count; a missing .env still warns.
    const severity = !files.length ? (kind === "key" ? "info" : "warning") : kind === "node_modules" ? "warning" : "error"
    issues.push({ kind: "not-ignored", severity, detail: paths.slice(0, 3).join(", ") + (paths.length > 3 ? ` +${paths.length - 3}` : ""), fix: append(source, [...new Set(kind === "key" ? (files.length ? paths.flatMap(keyLines) : ADDITIONS.key) : ADDITIONS[kind])].filter((add) => !rows.some((row) => row.trim() === add))) })
  }

  // Tracked files a rule now matches: .gitignore never untracks them.
  const stuck = files.filter((file) => file.tracked && checkIgnore(rules, file.path).ignored)
  if (stuck.length) issues.push({ kind: "tracked", severity: stuck.some((file) => sensitiveKind(file.path) && sensitiveKind(file.path) !== "node_modules") ? "error" : "warning", detail: stuck.map((file) => file.path).join("\n") })
  return issues
}
