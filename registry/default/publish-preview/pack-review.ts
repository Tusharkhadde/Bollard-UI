// Bollard UI — publish-preview · MIT licence · https://bollard-ui.vercel.app/components/publish-preview

// Pure review of `npm pack --dry-run --json` output against package.json. Safe on the server.

export interface PackFile {
  path: string
  size: number
}

export interface PackResult {
  name: string
  version: string
  size: number
  unpackedSize: number
  files: PackFile[]
}

export interface PackageJson {
  name?: string
  version?: string
  private?: boolean
  files?: string[]
  main?: string
  module?: string
  types?: string
  typings?: string
  browser?: string | Record<string, unknown>
  bin?: string | Record<string, string>
  exports?: unknown
  scripts?: Record<string, string>
}

export type PackIssueKind = "private" | "published" | "missing-entry" | "sensitive" | "source-map" | "tests" | "dev-files" | "big-file" | "no-allowlist"

export interface PackIssue {
  kind: PackIssueKind
  severity: "blocker" | "warning" | "info"
  /** Tarball paths the issue is about. */
  paths: string[]
  /** Proposed next version for "published". */
  nextVersion?: string
  /** For "missing-entry": why the build output isn't there. */
  cause?: "gitignore" | "files" | "not-built"
  /** For cause "gitignore": the folders .gitignore drops. */
  gitignored?: string[]
  /** Patterns to exclude, or the allowlist to add. */
  patterns?: string[]
}

export interface PackReviewOptions {
  /** Versions already on the registry: `npm view <name> versions --json`. */
  published?: string[]
  /** Whether the package has a root .npmignore. */
  hasNpmignore?: boolean
  /** The root .gitignore text, to explain build output that's missing because npm fell back to it. */
  gitignore?: string
  /** Files at or above this size are flagged. Default 1 MB. */
  bigFileBytes?: number
}

const SENSITIVE = /(^|\/)(\.env(\.[\w.-]+)?|id_(rsa|dsa|ecdsa|ed25519)(\.pub)?|\.git-credentials|credentials[^/]*\.json|service[-_]?account[^/]*\.json|[^/]+\.(pem|key|p12|pfx|jks|keystore|kdbx|ppk|sqlite3?|db))$/i
const ENV_EXAMPLE = /\.env\.(example|sample|template|dist|defaults)$/i
const TESTS = /(^|\/)(__tests__|__mocks__|tests?|spec|fixtures|e2e|coverage|\.nyc_output)\/|\.(test|spec)\.[cm]?[jt]sx?$|\.snap$/i
const DEV = /(^|\/)(\.github|\.vscode|\.idea|\.husky|\.changeset|\.turbo|\.cache)\/|(^|\/)(\.eslintrc[^/]*|\.prettierrc[^/]*|eslint\.config\.[cm]?js|vitest\.config\.[cm]?[jt]s|jest\.config\.[cm]?[jt]s|tsconfig(\.[\w-]+)?\.json|\.editorconfig|[^/]+\.log)$/i

/** "src/__tests__/a.ts" → "src/__tests__/", "lib/a.test.js" → "**\/*.test.*". */
const testPattern = (p: string) => {
  const m = p.match(TESTS)
  if (m?.[2]) return p.slice(0, (m.index ?? 0) + (m[1] ? 1 : 0)) + m[2] + "/"
  return /\.snap$/.test(p) ? "**/*.snap" : /\.spec\./.test(p) ? "**/*.spec.*" : "**/*.test.*"
}
const norm = (p: string) => p.replace(/^\.\//, "").replace(/^package\//, "")

/** The JSON value starting at `from` (an array or object), found by bracket matching outside strings. */
function balanced(text: string, from: number) {
  let depth = 0
  let str = false
  for (let i = from; i < text.length; i++) {
    const ch = text[i]
    if (str) {
      if (ch === "\\") i++
      else if (ch === '"') str = false
    } else if (ch === '"') str = true
    else if (ch === "[" || ch === "{") depth++
    else if (ch === "]" || ch === "}") {
      if (--depth === 0) return text.slice(from, i + 1)
    }
  }
  return ""
}

const looksLikePack = (v: unknown) => {
  const list = Array.isArray(v) ? v : [v]
  return list.length > 0 && list.every((e) => e && typeof e === "object" && Array.isArray((e as { files?: unknown }).files))
}

const toResult = (entry: Record<string, unknown>): PackResult => {
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : 0)
  return {
    name: String(entry.name ?? ""),
    version: String(entry.version ?? ""),
    size: num(entry.size),
    unpackedSize: num(entry.unpackedSize),
    files: (entry.files as unknown[]).flatMap((f) => (f && typeof f === "object" && typeof (f as PackFile).path === "string" ? [{ path: norm((f as PackFile).path), size: num((f as PackFile).size) }] : [])),
  }
}

/**
 * Every package in `npm pack --dry-run --json` output, one per workspace with `--workspaces`. Tolerates a BOM and
 * prepack/build output before or after the JSON, even lines like `[build] done` or `{"ok":1}`.
 */
export function parsePackJsonAll(input: unknown): PackResult[] {
  let data: unknown = input
  if (typeof input === "string") {
    const text = input.replace(/^\uFEFF/, "").slice(0, 20_000_000)
    data = undefined
    const starts = [...text.matchAll(/^[ \t]*([[{])/gm)].slice(0, 200)
    for (const m of starts) {
      const chunk = balanced(text, m.index! + m[0].length - 1)
      if (!chunk) continue
      try {
        const parsed = JSON.parse(chunk)
        if (looksLikePack(parsed)) {
          data = parsed
          break
        }
      } catch {
        // Script noise that only looked like JSON; try the next candidate.
      }
    }
  }
  if (!looksLikePack(data)) return []
  return (Array.isArray(data) ? data : [data]).map((e) => toResult(e as Record<string, unknown>))
}

/** Reads the --json output. With several workspaces, `name` picks one; otherwise the first is used. */
export function parsePackJson(input: unknown, name?: string): PackResult | null {
  const all = parsePackJsonAll(input)
  return (name && all.find((p) => p.name === name)) || all[0] || null
}

type Semver = { major: number; minor: number; patch: number; pre: string[] }
export function parseSemver(v: unknown): Semver | null {
  const m = String(v ?? "").trim().replace(/^v/, "").match(/^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/)
  return m ? { major: +m[1], minor: +m[2], patch: +m[3], pre: m[4] ? m[4].split(".") : [] } : null
}
const fmt = (s: Semver) => `${s.major}.${s.minor}.${s.patch}${s.pre.length ? "-" + s.pre.join(".") : ""}`

/** The first unused version after `version`: the next patch, or the next pre-release number (beta.1 → beta.2). */
export function nextFreeVersion(version: string, published: string[]) {
  const s = parseSemver(version)
  if (!s) return ""
  const used = new Set(published.map((p) => String(p).trim()))
  for (let i = 0; i < 1000; i++) {
    const last = s.pre.length - 1
    if (s.pre.length && /^\d+$/.test(s.pre[last])) s.pre[last] = String(+s.pre[last] + 1)
    else if (s.pre.length) s.pre.push("1")
    else s.patch++
    if (!used.has(fmt(s))) return fmt(s)
  }
  return ""
}

/** Every path package.json promises consumers: main, module, types, browser, bin and exports targets. */
export function entryPoints(pkg: PackageJson) {
  const out = new Set<string>()
  const add = (v: unknown) => typeof v === "string" && v && !v.startsWith("#") && out.add(norm(v))
  ;[pkg.main, pkg.module, pkg.types, pkg.typings, typeof pkg.browser === "string" ? pkg.browser : undefined].forEach(add)
  if (typeof pkg.bin === "string") add(pkg.bin)
  else if (pkg.bin && typeof pkg.bin === "object") Object.values(pkg.bin).forEach(add)
  const walk = (node: unknown, depth: number) => {
    if (depth > 8) return
    if (typeof node === "string") add(node)
    else if (Array.isArray(node)) node.forEach((n) => walk(n, depth + 1))
    else if (node && typeof node === "object") Object.values(node).forEach((n) => walk(n, depth + 1))
  }
  walk(pkg.exports, 0)
  return [...out]
}

const covered = (entry: string, files: Set<string>, list: PackFile[]) => {
  if (!entry.includes("*")) return files.has(entry) || [".js", ".json", "/index.js"].some((ext) => files.has(entry + ext))
  const [prefix] = entry.split("*")
  return list.some((f) => f.path.startsWith(prefix))
}
const topDir = (p: string) => (p.includes("/") ? p.split("/")[0] : p)
const gitignores = (gitignore: string, dir: string) =>
  gitignore.replace(/^\uFEFF/, "").split(/\r?\n/).map((l) => l.trim()).some((l) => l && !l.startsWith("#") && !l.startsWith("!") && l.replace(/^(\*\*\/|\/)/, "").replace(/\/\*{0,2}$/, "") === dir)

/** Everything worth catching before `npm publish`, blockers first. */
export function reviewPack(pack: PackResult | null, pkgInput: PackageJson | string | null | undefined, options: PackReviewOptions = {}): PackIssue[] {
  if (!pack) return []
  let pkg: PackageJson = {}
  try {
    pkg = (typeof pkgInput === "string" ? JSON.parse(pkgInput.replace(/^\uFEFF/, "")) : pkgInput) ?? {}
  } catch {
    pkg = {}
  }
  const issues: PackIssue[] = []
  const paths = new Set(pack.files.map((f) => f.path))
  const version = pack.version || String(pkg.version ?? "")
  const published = Array.isArray(options.published) ? options.published.map(String) : []
  const allowlist = Array.isArray(pkg.files) && pkg.files.length > 0

  if (pkg.private === true) issues.push({ kind: "private", severity: "blocker", paths: [] })
  if (version && published.includes(version)) issues.push({ kind: "published", severity: "blocker", paths: [], nextVersion: nextFreeVersion(version, published) })

  const missing = entryPoints(pkg).filter((e) => !covered(e, paths, pack.files))
  if (missing.length) {
    const dirs = [...new Set(missing.map(topDir))]
    const gitignored = !allowlist && !options.hasNpmignore && options.gitignore ? dirs.filter((d) => gitignores(options.gitignore!, d)) : []
    const cause = allowlist ? (dirs.some((d) => !pkg.files!.some((f) => norm(f).replace(/\/.*$/, "") === d)) ? "files" : "not-built") : gitignored.length ? "gitignore" : "not-built"
    issues.push({ kind: "missing-entry", severity: "blocker", paths: missing, cause, gitignored, patterns: dirs })
  }

  const sensitive = pack.files.filter((f) => SENSITIVE.test(f.path) && !ENV_EXAMPLE.test(f.path)).map((f) => f.path)
  if (sensitive.length) issues.push({ kind: "sensitive", severity: "blocker", paths: sensitive, patterns: sensitive })
  const maps = pack.files.filter((f) => f.path.endsWith(".map")).map((f) => f.path)
  if (maps.length) issues.push({ kind: "source-map", severity: "warning", paths: maps, patterns: ["**/*.map"] })
  const tests = pack.files.filter((f) => TESTS.test(f.path)).map((f) => f.path)
  if (tests.length) issues.push({ kind: "tests", severity: "warning", paths: tests, patterns: [...new Set(tests.map(testPattern))] })
  const dev = pack.files.filter((f) => DEV.test(f.path) && !TESTS.test(f.path)).map((f) => f.path)
  if (dev.length) issues.push({ kind: "dev-files", severity: "warning", paths: dev, patterns: [...new Set(dev.map((p) => (p.match(DEV)?.[2] ? p.slice(0, p.indexOf(p.match(DEV)![2] + "/")) + p.match(DEV)![2] + "/" : p)))] })
  const limit = options.bigFileBytes ?? 1_000_000
  const big = pack.files.filter((f) => f.size >= limit && !maps.includes(f.path)).sort((a, b) => b.size - a.size).map((f) => f.path)
  if (big.length) issues.push({ kind: "big-file", severity: "warning", paths: big, patterns: big })

  // A missing build already proposes the allowlist; don't propose it twice.
  if (!allowlist && !options.hasNpmignore && !issues.some((i) => i.kind === "missing-entry" && i.cause === "gitignore")) {
    const entryDirs = [...new Set(entryPoints(pkg).filter((e) => e.includes("/")).map(topDir))]
    issues.push({ kind: "no-allowlist", severity: "info", paths: [], patterns: entryDirs })
  }
  return issues
}

/** Where an exclusion goes: a negated `files` entry when there's an allowlist (a root .npmignore can't override it), else .npmignore. */
export function exclusionSnippet(patterns: string[], pkg: PackageJson | null | undefined) {
  const allowlist = Array.isArray(pkg?.files) && pkg!.files.length > 0
  return allowlist ? { where: "files" as const, text: patterns.map((p) => `"!${p}"`).join(", ") } : { where: ".npmignore" as const, text: patterns.join("\n") }
}

export function formatBytes(n: number, locale?: string) {
  if (!Number.isFinite(n) || n < 0) return "0 B"
  const units = ["B", "kB", "MB", "GB"]
  let i = 0
  let v = n
  while (v >= 1000 && i < units.length - 1) (v /= 1000), i++
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: v < 10 && i > 0 ? 1 : 0 }).format(v)} ${units[i]}`
}
