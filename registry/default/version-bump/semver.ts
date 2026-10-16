// Bollard UI — version-bump · MIT licence · https://bollard-ui.vercel.app/components/version-bump

// Semantic Versioning 2.0.0 helpers behind VersionBump. Pure functions, safe on the server.

export interface Version {
  major: number
  minor: number
  patch: number
  /** Dot-separated pre-release identifiers ("beta", "3"), empty for a release. */
  pre: string[]
}

export type Bump = "major" | "minor" | "patch" | "prerelease"
export type ChangeKind = "breaking" | "feature" | "fix" | "other"

export interface Change {
  title: string
  kind: ChangeKind
}

const SEMVER = /^v?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-z-][0-9a-z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-z-][0-9a-z-]*))*))?(?:\+[0-9a-z-]+(?:\.[0-9a-z-]+)*)?$/i

/** Parses "1.4.2", "v2.0.0-rc.1" or "1.0.0+build.5" (build metadata is ignored, as the spec says). */
export function parseVersion(text: string): Version | null {
  const m = text.trim().match(SEMVER)
  if (!m) return null
  return { major: +m[1], minor: +m[2], patch: +m[3], pre: m[4] ? m[4].split(".") : [] }
}

export const formatVersion = (v: Version) => `${v.major}.${v.minor}.${v.patch}${v.pre.length ? "-" + v.pre.join(".") : ""}`

const numeric = (id: string) => /^\d+$/.test(id)

/** Spec §11 precedence: numbers numerically, then a release above its pre-releases, identifiers left to right. */
export function compareVersions(a: Version, b: Version): number {
  for (const key of ["major", "minor", "patch"] as const) if (a[key] !== b[key]) return a[key] - b[key]
  if (!a.pre.length || !b.pre.length) return b.pre.length - a.pre.length
  for (let i = 0; i < Math.max(a.pre.length, b.pre.length); i++) {
    const x = a.pre[i]
    const y = b.pre[i]
    if (x === undefined || y === undefined) return x === undefined ? -1 : 1
    if (x === y) continue
    if (numeric(x) && numeric(y)) return +x - +y
    if (numeric(x) !== numeric(y)) return numeric(x) ? -1 : 1 // numbers sort before words
    return x < y ? -1 : 1 // ASCII order: "RC" < "beta" < "rc"
  }
  return 0
}

/** Reads a Conventional Commits subject: "feat!: …" or "BREAKING CHANGE" is breaking, feat a feature, fix/perf/revert a fix. */
export function classifyChange(title: string): ChangeKind {
  const m = title.match(/^(\w+)(?:\([^)]*\))?(!)?:/)
  if (m?.[2] || /BREAKING[ -]CHANGE/.test(title)) return "breaking"
  if (m?.[1] === "feat") return "feature"
  if (m && ["fix", "perf", "revert"].includes(m[1])) return "fix"
  return "other"
}

/**
 * The smallest bump the changes need. In 0.x the minor is the breaking slot (npm, Cargo and others treat
 * ^0.4.2 as <0.5.0), and in 0.0.x every release is breaking. A pre-release of the next major already has room
 * for breaking changes.
 */
export function requiredBump(current: Version, changes: Change[]): Exclude<Bump, "prerelease"> | null {
  const has = (kind: ChangeKind) => changes.some((c) => c.kind === kind)
  if (!has("breaking") && !has("feature") && !has("fix")) return null
  if (current.major === 0 && current.minor === 0) return "patch"
  if (has("breaking")) return current.major === 0 ? "minor" : "major"
  return has("feature") ? "minor" : "patch"
}

/** What each bump can carry: the rank compared against requiredBump's. */
export const BUMP_RANK = { patch: 1, minor: 2, major: 3 } as const

/** How breaking a step from release `from` to `next` is for someone on ^from. 0.x shifts every slot up one. */
function step(from: Version, next: Version) {
  if (next.major !== from.major) return BUMP_RANK.major
  if (next.minor !== from.minor) return from.major === 0 ? BUMP_RANK.major : BUMP_RANK.minor
  if (next.patch !== from.patch) return from.major === 0 && from.minor === 0 ? BUMP_RANK.major : BUMP_RANK.patch
  return 0
}

/** The level a release line sits on: 2.0.0 is a major line, 1.5.0 a minor one, 1.4.3 a patch. */
function lineRank(v: Version) {
  if (v.major === 0) return v.patch === 0 ? BUMP_RANK.major : v.minor === 0 ? BUMP_RANK.major : BUMP_RANK.patch
  return v.minor === 0 && v.patch === 0 ? BUMP_RANK.major : v.patch === 0 ? BUMP_RANK.minor : BUMP_RANK.patch
}

/**
 * What going from `current` to `next` can carry (1 patch, 2 minor, 3 major). From a pre-release, staying on its
 * line carries what the line was opened for: 2.0.0-rc.1 → 2.0.0 may still hold breaking changes.
 */
export function stepRank(current: Version, next: Version) {
  const base = { ...current, pre: [] }
  const onLine = next.major === base.major && next.minor === base.minor && next.patch === base.patch
  if (!current.pre.length) return step(current, next) || BUMP_RANK.patch
  return onLine ? lineRank(base) : Math.max(lineRank(base), step(base, next))
}

/** True when ^current would install `next` automatically. */
export const caretAccepts = (current: Version, next: Version) =>
  !next.pre.length && compareVersions(next, current) > 0 && (step({ ...current, pre: [] }, next) || BUMP_RANK.patch) < BUMP_RANK.major

/**
 * The next version, following npm's `semver.inc`: bumping a pre-release that already sits on that level
 * just drops the tag (2.0.0-rc.1 → major → 2.0.0). A pre-release bump stays on the current line and counts
 * up when that line can carry the changes, and otherwise opens `<preid>.0` on the line they need.
 */
export function bumpVersion(current: Version, bump: Bump, preid = "beta", needed: Exclude<Bump, "prerelease"> = "patch"): Version {
  const { major, minor, patch, pre } = current
  const isPre = pre.length > 0
  switch (bump) {
    case "major":
      return isPre && minor === 0 && patch === 0 ? { ...current, pre: [] } : { major: major + 1, minor: 0, patch: 0, pre: [] }
    case "minor":
      return isPre && patch === 0 ? { ...current, pre: [] } : { major, minor: minor + 1, patch: 0, pre: [] }
    case "patch":
      return isPre ? { ...current, pre: [] } : { major, minor, patch: patch + 1, pre: [] }
    case "prerelease": {
      const id = preid || pre[0] || "beta"
      const stays = isPre && lineRank({ ...current, pre: [] }) >= BUMP_RANK[needed]
      if (stays && pre[0] === id) {
        const last = pre.length - 1
        return { ...current, pre: numeric(pre[last]) ? [...pre.slice(0, last), String(+pre[last] + 1)] : [...pre, "0"] }
      }
      const base = stays ? { ...current, pre: [] } : bumpVersion(current, needed)
      return { ...base, pre: [id, "0"] }
    }
  }
}
