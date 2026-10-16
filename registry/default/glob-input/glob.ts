// Bollard UI — glob-input · MIT licence · https://bollard-ui.vercel.app/components/glob-input

/** Expands the first top-level {a,b} group, recursively: "src/{app,lib}/*.{ts,tsx}" → four patterns. */
export function expandBraces(pattern: string, limit = 200): string[] {
  let depth = 0
  let start = -1
  for (let i = 0; i < pattern.length; i++) {
    const char = pattern[i]
    if (char === "\\") i++
    else if (char === "{" && depth++ === 0) start = i
    else if (char === "}" && depth > 0 && --depth === 0) {
      const body = pattern.slice(start + 1, i)
      const options: string[] = []
      let level = 0
      let from = 0
      for (let j = 0; j < body.length; j++) {
        if (body[j] === "{") level++
        else if (body[j] === "}") level--
        else if (body[j] === "," && level === 0) {
          options.push(body.slice(from, j))
          from = j + 1
        }
      }
      options.push(body.slice(from))
      if (options.length < 2) continue
      const head = pattern.slice(0, start)
      const tail = pattern.slice(i + 1)
      return options.flatMap((option) => expandBraces(head + option + tail, limit)).slice(0, limit)
    }
  }
  return [pattern]
}

const escape = (char: string) => char.replace(/[.+^$()|{}\\[\]]/g, "\\$&")

function segmentSource(segment: string) {
  let out = ""
  for (let i = 0; i < segment.length; i++) {
    const char = segment[i]
    if (char === "\\" && i + 1 < segment.length) out += escape(segment[++i])
    else if (char === "*") {
      while (segment[i + 1] === "*") i++ // "**" inside a segment is just "*"
      out += "[^/]*"
    } else if (char === "?") out += "[^/]"
    else if (char === "[" && segment.indexOf("]", i + 2) > i) {
      const end = segment.indexOf("]", i + 2)
      const body = segment.slice(i + 1, end).replace(/^[!^]/, "^").replace(/\\/g, "\\\\")
      out += `[${body}]`
      i = end
    } else out += escape(char)
  }
  return out
}

/**
 * Compiles one glob (no braces) to a RegExp over a "/"-separated relative path: `*` and `?` stay
 * inside one folder, `**` as a whole segment spans any number of folders (zero included), `[a-z]`
 * and `[!a]` are classes, a leading "/" anchors to the root. Like .gitignore, `*` also matches dotfiles.
 */
export function globToRegExp(glob: string, { caseSensitive = true } = {}) {
  const segments = glob.replace(/^\/+/, "").split("/")
  let source = ""
  segments.forEach((segment, i) => {
    const last = i === segments.length - 1
    if (segment === "**") source += last ? ".*" : "(?:[^/]+/)*"
    else source += segmentSource(segment) + (last ? "" : "/")
  })
  return new RegExp(`^${source}$`, caseSensitive ? "" : "i")
}

/** Splits the field into patterns (space separated) and expands braces in each. */
export function splitPatterns(text: string) {
  return text.trim().split(/\s+/).filter(Boolean)
}

/**
 * Evaluates patterns against files the way most tools (tsconfig, fast-glob, ESLint) do: a file is
 * in when it matches any positive pattern and no "!" pattern. Returns, per file, whether it is in and
 * which negation removed it.
 */
export function matchFiles(patterns: string[], files: string[], { caseSensitive = true } = {}) {
  const compile = (p: string) => expandBraces(p).map((g) => globToRegExp(g, { caseSensitive }))
  const include = patterns.filter((p) => !p.startsWith("!")).map((p) => compile(p))
  const exclude = patterns.filter((p) => p.startsWith("!")).map((p) => ({ pattern: p, res: compile(p.slice(1)) }))
  return files.map((file) => {
    const included = include.some((res) => res.some((re) => re.test(file)))
    const excludedBy = included ? exclude.find((e) => e.res.some((re) => re.test(file)))?.pattern : undefined
    return { file, match: included && !excludedBy, excludedBy }
  })
}

/** "src/*.ts" → "src/**\/*.ts"; "src/*\/index.ts" → "src/**\/index.ts": what `**` would have meant, or null. */
export function deeperPattern(pattern: string) {
  if (pattern.startsWith("!") || !pattern.includes("*") || pattern.includes("**")) return null
  const segments = pattern.split("/")
  const star = segments.slice(0, -1).lastIndexOf("*")
  if (star >= 0) return segments.map((s, i) => (i === star ? "**" : s)).join("/")
  return [...segments.slice(0, -1), "**", segments[segments.length - 1]].join("/")
}

export type GlobIssue =
  | { kind: "inner-globstar"; fix: string }
  | { kind: "dot-slash"; fix: string }
  | { kind: "backslash"; fix: string }
  | { kind: "only-negations"; fix: string }
  | { kind: "case"; count: number; fix?: string }
  | { kind: "none"; count: number }
  | { kind: "all"; count: number; example?: string }

/** The first thing wrong with a pattern list, given the files it runs against. */
export function checkGlob(text: string, files: string[], { caseSensitive = true } = {}): GlobIssue | null {
  const patterns = splitPatterns(text)
  if (!patterns.length) return null
  const replace = (fn: (p: string) => string) => patterns.map(fn).join(" ")
  if (patterns.some((p) => /[^/!]\*\*|\*\*[^/]/.test(p)))
    return { kind: "inner-globstar", fix: replace((p) => p.replace(/(^!?|\/)\*\*([^/*]+)/g, "$1**/*$2").replace(/([^/!*]+)\*\*(\/|$)/g, "$1*/**$2")) }
  if (patterns.some((p) => /^!?\.\//.test(p))) return { kind: "dot-slash", fix: replace((p) => p.replace(/^(!?)\.\//, "$1")) }
  if (patterns.some((p) => /\\(?![*?[\]{}!\\])/.test(p))) return { kind: "backslash", fix: replace((p) => p.replace(/\\/g, "/")) }
  if (patterns.every((p) => p.startsWith("!"))) return { kind: "only-negations", fix: `** ${text.trim()}` }

  const count = matchFiles(patterns, files, { caseSensitive }).filter((r) => r.match).length
  if (count === 0 && files.length) {
    const loose = matchFiles(patterns, files, { caseSensitive: false }).filter((r) => r.match).length
    if (caseSensitive && loose) {
      const lower = text.trim().toLowerCase()
      const fixCount = matchFiles(splitPatterns(lower), files).filter((r) => r.match).length
      return { kind: "case", count: loose, fix: fixCount ? lower : undefined }
    }
    return { kind: "none", count: files.length }
  }
  if (count === files.length && files.length > 1) {
    const example = [...files].sort((a, b) => b.split("/").length - a.split("/").length)[0]
    return { kind: "all", count, example }
  }
  return null
}

/** For `*` patterns: what switching to `**` would add (files in subfolders `*` can't reach). */
export function globstarHint(text: string, files: string[], { caseSensitive = true } = {}) {
  const patterns = splitPatterns(text)
  const now = new Set(matchFiles(patterns, files, { caseSensitive }).filter((r) => r.match).map((r) => r.file))
  for (const pattern of patterns) {
    const deeper = deeperPattern(pattern)
    if (!deeper) continue
    const next = patterns.map((p) => (p === pattern ? deeper : p))
    const added = matchFiles(next, files, { caseSensitive }).filter((r) => r.match && !now.has(r.file)).map((r) => r.file)
    if (added.length) return { pattern, deeper, fix: next.join(" "), added }
  }
  return null
}
