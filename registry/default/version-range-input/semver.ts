/** A small, dependency-free implementation of npm's semver range rules (node-semver, default options). */

export interface SemVer {
  major: number
  minor: number
  patch: number
  /** Prerelease identifiers: "1.0.0-beta.2" → ["beta", 2]. */
  pre: (string | number)[]
}

type Op = ">=" | ">" | "<" | "<=" | "="
export interface Comparator {
  op: Op
  version: SemVer
}
/** All comparators must pass (AND). A range is a list of these joined by || (OR). */
export type ComparatorSet = Comparator[]

const NR = "0|[1-9]\\d*"
const PART = "[0-9A-Za-z-]+"
const VERSION = new RegExp(`^v?(${NR})\\.(${NR})\\.(${NR})(?:-(${PART}(?:\\.${PART})*))?(?:\\+${PART}(?:\\.${PART})*)?$`)
const PARTIAL = new RegExp(
  `^v?(${NR}|[xX*])(?:\\.(${NR}|[xX*])(?:\\.(${NR}|[xX*])(?:-(${PART}(?:\\.${PART})*))?(?:\\+${PART}(?:\\.${PART})*)?)?)?$`,
)

const toPre = (text?: string) => (text ? text.split(".").map((id) => (/^\d+$/.test(id) ? Number(id) : id)) : [])

/** Parses a full version such as "1.2.3" or "2.0.0-rc.1", or returns null. */
export function parseVersion(text: string): SemVer | null {
  const m = VERSION.exec(text.trim())
  return m ? { major: +m[1], minor: +m[2], patch: +m[3], pre: toPre(m[4]) } : null
}

export const formatVersion = (v: SemVer) => `${v.major}.${v.minor}.${v.patch}${v.pre.length ? `-${v.pre.join(".")}` : ""}`

function comparePre(a: SemVer["pre"], b: SemVer["pre"]) {
  if (!a.length || !b.length) return a.length ? -1 : b.length ? 1 : 0
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const [x, y] = [a[i], b[i]]
    if (x === undefined || y === undefined) return x === undefined ? -1 : 1
    if (x === y) continue
    if (typeof x === "number" && typeof y === "number") return x < y ? -1 : 1
    if (typeof x === "number" || typeof y === "number") return typeof x === "number" ? -1 : 1
    return x < y ? -1 : 1
  }
  return 0
}

/** Semver precedence: negative when a < b. */
export function compareVersions(a: SemVer, b: SemVer) {
  return a.major - b.major || a.minor - b.minor || a.patch - b.patch || comparePre(a.pre, b.pre)
}

const v = (major: number, minor: number, patch: number, pre: SemVer["pre"] = []): SemVer => ({ major, minor, patch, pre })
/** "<2.0.0-0": below every 2.0.0 prerelease, as npm writes upper bounds. */
const below = (major: number, minor: number, patch: number): Comparator => ({
  op: "<",
  version: v(major, minor, patch, [0]),
})
const ANY: ComparatorSet = [{ op: ">=", version: v(0, 0, 0) }]
const NOTHING: ComparatorSet = [{ op: "<", version: v(0, 0, 0, [0]) }]

function partial(text: string) {
  const m = PARTIAL.exec(text)
  if (!m) return null
  const num = (s?: string) => (s === undefined || /^[xX*]$/.test(s) ? null : Number(s))
  const [major, minor, patch] = [num(m[1]), num(m[2]), num(m[3])]
  // "1.x.3" is not valid: once a part is wild, the rest must be too.
  if ((major === null && (minor !== null || patch !== null)) || (minor === null && patch !== null)) return null
  return { major, minor, patch, pre: toPre(m[4]) }
}

/** Desugars one token (^1.2.3, ~1.2, >=1, 1.x, 1.2.3) into primitive comparators. */
function desugar(token: string): ComparatorSet | null {
  const m = /^(\^|~>?|>=|<=|>|<|=)?\s*(.*)$/.exec(token)
  if (!m) return null
  const op = m[1] ?? ""
  const p = partial(m[2])
  if (!p) return null
  const { major: M, minor: m2, patch: pa, pre } = p
  if (M === null) return op === ">" || op === "<" ? NOTHING : ANY
  if (op === "^") {
    const lower: Comparator = {
      op: ">=",
      version: v(M, m2 ?? 0, pa ?? 0, pre),
    }
    if (M > 0 || m2 === null) return [lower, below(M + 1, 0, 0)]
    if (m2 > 0 || pa === null) return [lower, below(0, m2 + 1, 0)]
    return [lower, below(0, 0, pa + 1)]
  }
  if (op.startsWith("~")) {
    const lower: Comparator = {
      op: ">=",
      version: v(M, m2 ?? 0, pa ?? 0, pre),
    }
    return [lower, m2 === null ? below(M + 1, 0, 0) : below(M, m2 + 1, 0)]
  }
  if (m2 !== null && pa !== null) return [{ op: (op || "=") as Op, version: v(M, m2, pa, pre) }]
  // A partial version stands for every version it covers: "1.2" is >=1.2.0 <1.3.0-0.
  const start = v(M, m2 ?? 0, 0)
  const next = m2 === null ? v(M + 1, 0, 0) : v(M, m2 + 1, 0)
  if (op === ">") return [{ op: ">=", version: next }]
  if (op === ">=") return [{ op: ">=", version: start }]
  if (op === "<") return [{ op: "<", version: { ...start, pre: [0] } }]
  if (op === "<=") return [{ op: "<", version: { ...next, pre: [0] } }]
  return [
    { op: ">=", version: start },
    { op: "<", version: { ...next, pre: [0] } },
  ]
}

/** Parses an npm range ("^1.2.3 || >=2 <3", "1.2 - 2", "~0.4") into OR'd comparator sets, or null if invalid. */
export function parseRange(range: string): ComparatorSet[] | null {
  const sets: ComparatorSet[] = []
  for (const alternative of range.split("||")) {
    const text = alternative.trim().replace(/(\^|~>?|>=|<=|>|<|=)\s+/g, "$1")
    const hyphen = /^(\S+)\s+-\s+(\S+)$/.exec(text)
    if (hyphen) {
      const [from, to] = [partial(hyphen[1]), partial(hyphen[2])]
      if (!from || !to) return null
      const lower = from.major === null ? ANY : desugar(`>=${hyphen[1]}`)
      const upper = to.major === null ? [] : desugar(`<=${hyphen[2]}`)
      if (!lower || !upper) return null
      sets.push([...lower, ...upper])
      continue
    }
    const set: ComparatorSet = []
    for (const token of text ? text.split(/\s+/) : ["*"]) {
      const parsed = desugar(token)
      if (!parsed) return null
      set.push(...parsed)
    }
    sets.push(set)
  }
  return sets
}

function passes(version: SemVer, { op, version: bound }: Comparator) {
  const c = compareVersions(version, bound)
  return op === "=" ? c === 0 : op === ">" ? c > 0 : op === ">=" ? c >= 0 : op === "<" ? c < 0 : c <= 0
}

/** True when the version satisfies the range. Prereleases only match a set that names the same x.y.z with a prerelease. */
export function satisfies(version: SemVer, sets: ComparatorSet[]) {
  return sets.some((set) => {
    if (!set.every((comparator) => passes(version, comparator))) return false
    if (!version.pre.length) return true
    return set.some(
      ({ version: b }) => b.pre.length > 0 && b.major === version.major && b.minor === version.minor && b.patch === version.patch,
    )
  })
}

export interface Bounds {
  lower?: { version: SemVer; inclusive: boolean }
  upper?: { version: SemVer; inclusive: boolean }
  empty: boolean
}

/** Collapses a comparator set to its tightest lower and upper bound. */
export function boundsOf(set: ComparatorSet): Bounds {
  let lower: Bounds["lower"]
  let upper: Bounds["upper"]
  for (const { op, version } of set) {
    if (op !== "<" && op !== "<=") {
      const c = lower ? compareVersions(version, lower.version) : 1
      if (c > 0 || (c === 0 && op === ">")) lower = { version, inclusive: op !== ">" }
    }
    if (op !== ">" && op !== ">=") {
      const c = upper ? compareVersions(version, upper.version) : -1
      if (c < 0 || (c === 0 && op === "<")) upper = { version, inclusive: op !== "<" }
    }
  }
  // With no lower bound, everything from 0.0.0-0 up counts, so "<0.0.0-0" is empty.
  const floor = lower ?? { version: v(0, 0, 0, [0]), inclusive: true }
  const c = upper ? compareVersions(floor.version, upper.version) : -1
  return {
    lower,
    upper,
    empty: c > 0 || (c === 0 && !(floor.inclusive && upper?.inclusive)),
  }
}

/** Shows an upper bound the way people think of it: "<2.0.0-0" reads as "2.0.0". */
const shown = (version: SemVer) =>
  formatVersion(version.pre.length === 1 && version.pre[0] === 0 ? { ...version, pre: [] } : version)

/** Plain-English reading of a parsed range: "1.2.3 up to but not including 2.0.0, or 3.0.0 or newer". */
export function describeRange(sets: ComparatorSet[]): string {
  const phrases = sets.map((set) => {
    const { lower, upper, empty } = boundsOf(set)
    if (empty) return "nothing"
    const from = lower && shown(lower.version)
    const to = upper && shown(upper.version)
    if (lower && upper) {
      const next = lower.version.pre.length ? null : { ...lower.version, patch: lower.version.patch + 1, pre: [0] }
      // ">=0.0.3 <0.0.4-0" admits only 0.0.3 among releases.
      const onlyOne = lower.inclusive && !upper.inclusive && next && compareVersions(next, upper.version) === 0
      if (from === to || onlyOne) return `exactly ${from}`
      if (lower.inclusive) return upper.inclusive ? `${from} through ${to}` : `${from} up to but not including ${to}`
      return upper.inclusive ? `anything above ${from} up to and including ${to}` : `anything above ${from} and below ${to}`
    }
    if (lower) return lower.inclusive ? (from === "0.0.0" ? "any version" : `${from} or newer`) : `anything newer than ${from}`
    return upper?.inclusive ? `${to} or older` : `anything below ${to}`
  })
  return [...new Set(phrases)].join(", or ")
}

/** Slips that parse but don't mean what was intended, or that stop parsing, each with an optional fix. */
export function findRangeSlips(range: string) {
  const slips: {
    kind: "and" | "hyphen" | "zero-minor" | "zero-patch"
    token: string
    fix?: string
  }[] = []
  if (/,|&&/.test(range))
    slips.push({
      kind: "and",
      token: range,
      fix: range.replace(/\s*(,|&&)\s*/g, " ").trim(),
    })
  for (const token of range.split(/\s+|\|\|/)) {
    // "1.2.3-2.0.0" is a prerelease of 1.2.3, not a range: npm needs spaces around the hyphen.
    const hyphen = /^v?(\d+\.\d+\.\d+)-(\d+\.\d+(?:\.\d+)?)$/.exec(token)
    if (hyphen)
      slips.push({
        kind: "hyphen",
        token,
        fix: range.replace(token, `${hyphen[1]} - ${hyphen[2]}`),
      })
    const zero = /^\^v?0\.(\d+|[xX*])(?:\.(\d+))?/.exec(token)
    if (zero && /^\d+$/.test(zero[1]) && Number(zero[1]) > 0) slips.push({ kind: "zero-minor", token })
    else if (zero && zero[1] === "0" && zero[2] !== undefined) slips.push({ kind: "zero-patch", token })
  }
  return slips
}
