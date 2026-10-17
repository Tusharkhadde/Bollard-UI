// Bollard UI — dependency-license-check · MIT licence · https://bollard-ui.vercel.app/components/dependency-license-check

/** How a license constrains the code that uses it, from least to most restrictive. */
export type LicenseCategory = "permissive" | "weak" | "unknown" | "strong" | "network" | "source-available" | "missing"

const RANK: Record<LicenseCategory, number> = { permissive: 0, weak: 1, unknown: 2, strong: 3, network: 4, "source-available": 4, missing: 5 }

const RULES: [RegExp, LicenseCategory][] = [
  [/^(none|noassertion|unlicensed|all rights reserved)$/, "missing"],
  [/^agpl/, "network"],
  [/^(sspl|busl|bsl-1\.1|elastic-|rsal|commons-clause|polyform|cc-by-nc|confluent|fsl-)/, "source-available"],
  [/^(lgpl|mpl|epl|cddl|cpl|ms-rl|ms-pl|eupl-1\.0)/, "weak"],
  [/^(gpl|eupl|osl|cc-by-sa|sleepycat|rpl|qpl)/, "strong"],
  [/^(mit|isc|bsd|0bsd|apache|unlicense$|cc0|zlib|python|psf|blueoak|bsl-1\.0|wtfpl|artistic-2|x11|cc-by-[34]|postgresql|upl|ncsa|unicode|w3c|afl|hpnd|curl|libpng|ftl)/, "permissive"],
]

const ALIASES: Record<string, string> = {
  "apache 2.0": "apache-2.0", "apache 2": "apache-2.0", "apache2": "apache-2.0", "apache-2": "apache-2.0", "apache license 2.0": "apache-2.0",
  gplv2: "gpl-2.0", gplv3: "gpl-3.0", gpl2: "gpl-2.0", gpl3: "gpl-3.0", "gpl v3": "gpl-3.0", "gpl v2": "gpl-2.0",
  agplv3: "agpl-3.0", lgplv3: "lgpl-3.0", lgplv2: "lgpl-2.1", "mpl 2.0": "mpl-2.0", "the unlicense": "unlicense", "public domain": "unlicense",
}

/** npm's "SEE LICENSE IN <file>", LicenseRef- ids and words for paid terms: a license exists, but not a standard one. */
export const CUSTOM_LICENSE = /^(see licen[cs]e in\b|licenseref-|custom$|proprietary$|commercial$)/i

const LINK_EXCEPTIONS = /classpath|linking|gcc|autoconf|bison|libtool|llvm|font|openjdk|universal-foss/

const normal = (id: string) => {
  const lower = id.trim().toLowerCase().replace(/\s+/g, " ")
  return ALIASES[lower] ?? lower
}

/** The category of one license id (MIT, GPL-3.0-or-later, Apache 2.0, UNLICENSED…). */
export function categorize(id: string): LicenseCategory {
  const value = normal(id)
  if (!value) return "missing"
  return RULES.find(([pattern]) => pattern.test(value))?.[1] ?? "unknown"
}

/**
 * A package.json `license` as found in the wild: an SPDX string, or the deprecated
 * `{ type, url }` object and `licenses: [{ type }]` array that old packages still ship.
 */
export type LicenseField = string | { type?: string } | (string | { type?: string })[] | null | undefined

/** Flattens any `LicenseField` to one expression; an array is a choice (OR). */
export function licenseText(license: LicenseField): string {
  const one = (l: unknown) => (typeof l === "string" ? l.trim() : l && typeof l === "object" && typeof (l as { type?: unknown }).type === "string" ? (l as { type: string }).type.trim() : "")
  if (Array.isArray(license)) {
    const parts = license.map(one).filter(Boolean)
    return parts.length > 1 ? parts.map((p) => `(${p})`).join(" OR ") : (parts[0] ?? "")
  }
  return one(license)
}

export interface LicenseReading {
  category: LicenseCategory
  /** The license you would actually use it under: the most permissive side of an OR. */
  chosen: string
}

/**
 * Reads an SPDX expression ("MIT OR GPL-3.0", "(LGPL-2.1 AND BSD-3-Clause)", "GPL-2.0 WITH
 * Classpath-exception-2.0"). OR takes the friendliest choice, AND the strictest part. An old
 * npm `licenses` array counts as a choice. Malformed text is read as one id; it never throws.
 */
export function readLicense(license: LicenseField): LicenseReading {
  const text = licenseText(license)
  if (!text) return { category: "missing", chosen: "" }
  if (CUSTOM_LICENSE.test(text)) return { category: "unknown", chosen: text }

  const tokens = text.match(/\(|\)|[^\s()]+/g) ?? []
  let pos = 0
  const worse = (a: LicenseReading, b: LicenseReading) => (RANK[b.category] > RANK[a.category] ? b : a)
  const better = (a: LicenseReading, b: LicenseReading) => (RANK[b.category] < RANK[a.category] ? b : a)
  const isOp = (token: string | undefined, op: string) => token?.toUpperCase() === op

  const atom = (): LicenseReading => {
    const token = tokens[pos++]
    if (token === undefined) throw new Error("end")
    if (token === "(") {
      const inner = either()
      if (tokens[pos++] !== ")") throw new Error("paren")
      return inner
    }
    if (token === ")" || isOp(token, "AND") || isOp(token, "OR") || isOp(token, "WITH")) throw new Error("operator")
    const id = token.replace(/\+$/, "")
    let category = categorize(id)
    if (isOp(tokens[pos], "WITH")) {
      pos++
      const exception = (tokens[pos++] ?? "").toLowerCase()
      if (category === "strong" && LINK_EXCEPTIONS.test(exception)) category = "weak"
    }
    return { category, chosen: token }
  }
  const both = (): LicenseReading => {
    let result = atom()
    while (isOp(tokens[pos], "AND")) {
      pos++
      const next = atom()
      result = { ...worse(result, next), chosen: `${result.chosen} AND ${next.chosen}` }
    }
    return result
  }
  const either = (): LicenseReading => {
    let result = both()
    while (isOp(tokens[pos], "OR") || tokens[pos] === "/") {
      pos++
      result = better(result, both())
    }
    return result
  }

  try {
    const result = either()
    if (pos !== tokens.length) throw new Error("trailing")
    return result
  } catch {
    return { category: categorize(text), chosen: text }
  }
}

/** A dependency being added, as your package manager or registry reports it. */
export interface DependencyInfo {
  name: string
  version: string
  /** SPDX expression from package.json (or an old `licenses` array). Missing means none was declared. */
  license?: LicenseField
  /** Only used in development and never shipped (devDependencies, build tools). */
  dev?: boolean
  /** The version you are on now or the last version before this one, to catch a relicense. */
  previousVersion?: string
  /** The license of `previousVersion`. */
  previousLicense?: LicenseField
}

/** Your project's rules. */
export interface LicensePolicy {
  /** "proprietary" for closed-source code, or your project's own SPDX license (MIT, GPL-3.0…). */
  project?: string
  /** How your code reaches people: shipped to them (apps, libraries, browser bundles), run only as a hosted service, or internal use. */
  distribution?: "distributed" | "saas" | "internal"
  /** License ids your team has already approved. */
  allow?: string[]
  /** License ids your team never allows. */
  deny?: string[]
}

export type LicenseLevel = "ok" | "note" | "warn" | "block"
export type LicenseReason =
  | "ok" | "chosen" | "devOnly" | "allowed" | "denied" | "missing" | "unknown" | "weak"
  | "gpl" | "gplSaas" | "agpl" | "copyleftInternal" | "copyleftInOpenSource" | "sourceAvailable" | "sourceAvailableSaas"
  | "custom" | "incompatible"

export interface LicenseReview {
  level: LicenseLevel
  reason: LicenseReason
  category: LicenseCategory
  chosen: string
  /** Set when the license became more restrictive (or vanished) since `previousVersion`. */
  change?: { from: string; fromCategory: LicenseCategory; fromVersion?: string }
}

const LEVELS: LicenseLevel[] = ["ok", "note", "warn", "block"]
/** "AGPL-3.0", "AGPL-3.0-only", "agpl-3.0-or-later" and "AGPL-3.0+" are one entry on a list. */
const base = (id: string) => normal(id).replace(/\+$|-only$|-or-later$/, "")
/** The ids in the side of the expression you would use ("MIT AND BSD-3-Clause" → both). */
const idsOf = (chosen: string) => chosen.split(/\s+AND\s+/i).map((id) => id.replace(/[()]/g, "").trim()).filter(Boolean)
const onList = (list: string[] | undefined, id: string) => (list ?? []).some((entry) => base(entry) === base(id))
/** Denied when any license you'd be bound by is denied; allowed only when every one of them is. */
const denied = (list: string[] | undefined, chosen: string) => !!chosen && idsOf(chosen).some((id) => onList(list, id))
const allowed = (list: string[] | undefined, chosen: string) => !!chosen && idsOf(chosen).every((id) => onList(list, id))

type Gpl = { family: "gpl" | "lgpl" | "agpl"; version: number; later: boolean }
const gplOf = (id: string): Gpl | null => {
  const m = normal(id).match(/^(a|l)?gpl-?(\d(?:\.\d)?)(?:\.0)?(-or-later|\+)?/)
  return m ? { family: m[1] === "a" ? "agpl" : m[1] === "l" ? "lgpl" : "gpl", version: Number(m[2]), later: !!m[3] } : null
}
/** Free licenses the FSF lists as GPL-incompatible (www.gnu.org/licenses/license-list.html). */
const GPL_INCOMPATIBLE = /^(epl-|cddl|mpl-1|ms-pl|ms-rl|cpl-|osl-|afl-|apache-1|php-|bsd-4|cecill-[bc]|ipl-|sissl|qpl|zpl-1|openssl$)/
/** Also incompatible with GPLv2-only (patent and attribution terms GPLv2 lacks). */
const GPL2_INCOMPATIBLE = /^(apache-2|ecl-2|ftl$|xfree86-1\.1)/

/** Can code under `id` be combined with a project under the GNU license `project`? */
function gplCompatible(project: Gpl, id: string) {
  const value = normal(id)
  if (GPL_INCOMPATIBLE.test(value)) return false
  const v2only = project.version < 3 && !project.later
  if (v2only && GPL2_INCOMPATIBLE.test(value)) return false
  const dep = gplOf(value)
  if (!dep) return true
  if (v2only && dep.version >= 3) return false
  if (project.version >= 3 && dep.family === "gpl" && dep.version < 3 && !dep.later) return false
  if (dep.family === "agpl" && project.version < 3 && !project.later) return false
  return true
}

/** Whether a dependency fits the policy, and why. Pure, so it can run in CI or on a server. */
export function reviewDependency(dep: DependencyInfo, policy: LicensePolicy = {}): LicenseReview {
  const { category, chosen } = readLicense(dep?.license)
  const project = (policy.project ?? "proprietary").trim()
  const closed = /^(proprietary|closed|unlicensed|private|commercial)$/i.test(project) || readLicense(project).category === "missing"
  const projectCopyleft = !closed && RANK[readLicense(project).category] >= RANK.strong && readLicense(project).category !== "source-available"
  const projectGpl = projectCopyleft ? gplOf(project) : null
  const distribution = policy.distribution ?? "distributed"
  const verdict = (level: LicenseLevel, reason: LicenseReason): LicenseReview => ({ level, reason, category, chosen })

  let review: LicenseReview
  if (denied(policy.deny, chosen)) review = verdict("block", "denied")
  else if (allowed(policy.allow, chosen)) review = verdict("ok", "allowed")
  else if (category === "missing") review = verdict(dep?.dev ? "warn" : "block", "missing")
  else if (category === "unknown") review = verdict("warn", CUSTOM_LICENSE.test(chosen) ? "custom" : "unknown")
  else if (dep?.dev && category !== "permissive") review = verdict("ok", "devOnly")
  else if (category === "source-available") review = verdict(distribution === "saas" ? "block" : "warn", distribution === "saas" ? "sourceAvailableSaas" : "sourceAvailable")
  else if (category === "network" || category === "strong") {
    if (projectCopyleft) review = verdict("ok", "ok")
    else if (!closed) review = verdict("warn", "copyleftInOpenSource")
    else if (distribution === "internal") review = verdict("note", "copyleftInternal")
    else if (category === "network") review = verdict("block", "agpl")
    else review = verdict(distribution === "saas" ? "warn" : "block", distribution === "saas" ? "gplSaas" : "gpl")
  } else if (category === "weak") review = verdict(closed ? "note" : "ok", closed ? "weak" : "ok")
  else review = /\s(OR|\/)\s/i.test(licenseText(dep?.license)) ? verdict("note", "chosen") : verdict("ok", "ok")

  // In a GNU-licensed project, copyleft alone is fine but some licenses can't be combined with it.
  if (projectGpl && !dep?.dev && (review.level === "ok" || review.level === "note") && review.reason !== "allowed" && !compatibleChoice(projectGpl, licenseText(dep?.license)))
    review = verdict(distribution === "distributed" ? "block" : "warn", "incompatible")

  if (dep?.previousLicense !== undefined) {
    const before = readLicense(dep.previousLicense)
    if (RANK[category] > RANK[before.category]) {
      review.change = { from: before.chosen || licenseText(dep.previousLicense), fromCategory: before.category, fromVersion: dep.previousVersion }
      if (LEVELS.indexOf(review.level) < LEVELS.indexOf("warn")) review.level = "warn"
    }
  }
  return review
}

/** SPDX precedence (WITH > AND > OR): true when some way of using `expression` is fully compatible. Unparseable text counts as compatible, leaving it to the other checks. */
function compatibleChoice(project: Gpl, expression: string) {
  const tokens = expression.match(/\(|\)|[^\s()]+/g) ?? []
  let pos = 0
  const op = (word: string) => tokens[pos]?.toUpperCase() === word
  const atom = (): boolean => {
    const token = tokens[pos++]
    if (token === "(") {
      const inner = either()
      pos++
      return inner
    }
    if (op("WITH")) pos += 2
    return !token || gplCompatible(project, token.replace(/\+$/, "-or-later"))
  }
  const both = (): boolean => {
    let ok = atom()
    while (op("AND")) {
      pos++
      ok = atom() && ok
    }
    return ok
  }
  const either = (): boolean => {
    let ok = both()
    while (op("OR") || tokens[pos] === "/") {
      pos++
      ok = both() || ok
    }
    return ok
  }
  try {
    return either()
  } catch {
    return true
  }
}
