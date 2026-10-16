/**
 * Pure nomination rules for Indian bank deposits, lockers and demat/mutual fund holdings. Sources:
 * - Banking Laws (Amendment) Act, 2025 and Banking Companies (Nomination) Rules, 2025 (in force 1 Nov 2025):
 *   deposits up to 4 nominees, simultaneous (percentages totalling 100%) or successive (order of priority), only one
 *   of the two; lockers and safe custody successive only; for more than 4 the first 4 are recognised; a minor
 *   nominee can have an adult appointed to receive on their behalf (optional, rule 2(6)).
 * - SEBI circular SEBI/HO/OIAE/OIAE_IAD-3/P/CIR/2026/12676 (29 May 2026, from 1 Sep 2026), replacing the 10-nominee
 *   limit of the 10 Jan 2025 circular: demat accounts and MF folios up to 3 nominees; name and relationship mandatory;
 *   shares optional, equal when not given, odd lot to the first nominee; a minor nominee's date of birth is mandatory,
 *   guardian details optional.
 */

export type HoldingKind = "deposit" | "locker" | "demat"
export type NominationMode = "simultaneous" | "successive"

export interface Nominee {
  /** Stable key for the row. */
  id: string
  name: string
  relation?: string
  /** Percentage share, for simultaneous nomination. */
  share?: number | null
  minor?: boolean
  /** Adult who receives for a minor (bank) or the minor's guardian (demat). */
  guardian?: string
  /** Date of birth, "YYYY-MM-DD"; mandatory for a minor on demat and MF. */
  dob?: string
}

export interface Nomination {
  mode: NominationMode
  nominees: Nominee[]
}

export interface HoldingRules {
  max: number
  modes: NominationMode[]
  /** Blank shares mean an equal split (demat/MF) instead of an incomplete form (bank deposits). */
  blankMeansEqual: boolean
  /** Relationship is a mandatory field (SEBI). */
  relationRequired?: boolean
  /** A minor nominee's date of birth is mandatory (SEBI). */
  minorDobRequired?: boolean
  /** Nudge to name an adult to receive for a minor nominee. Optional in law, so a warning, never a block. */
  askMinorGuardian?: boolean
  /** Extras past `max` are ignored ("first four recognised", banks) rather than not accepted at all (SEBI). */
  extrasIgnored?: boolean
}

export const NOMINATION_RULES: Record<HoldingKind, HoldingRules> = {
  deposit: { max: 4, modes: ["simultaneous", "successive"], blankMeansEqual: false, askMinorGuardian: true, extrasIgnored: true },
  locker: { max: 4, modes: ["successive"], blankMeansEqual: false, askMinorGuardian: true, extrasIgnored: true },
  demat: { max: 3, modes: ["simultaneous"], blankMeansEqual: true, relationRequired: true, minorDobRequired: true },
}

export type NominationIssue =
  | { kind: "none" }
  | { kind: "tooMany"; max: number; dropped: string[] }
  | { kind: "mode"; allowed: NominationMode }
  | { kind: "noName"; id: string }
  | { kind: "duplicate"; id: string; name: string }
  | { kind: "total"; total: number }
  | { kind: "blankShare"; ids: string[] }
  | { kind: "someBlank"; ids: string[] }
  | { kind: "zeroShare"; id: string; name: string }
  | { kind: "badShare"; id: string; name: string }
  | { kind: "noRelation"; id: string; name: string }
  | { kind: "minorNoGuardian"; id: string; name: string }
  | { kind: "minorNoDob"; id: string; name: string }

const clean = (s: unknown) => (typeof s === "string" ? s.replace(/^\uFEFF/, "").trim().replace(/\s+/g, " ") : "")
const key = (s: string) => clean(s).toLowerCase().replace(/[.,'’]/g, "").replace(/\b(mr|mrs|ms|miss|shri|sri|smt|dr|kumari)\b/g, "").replace(/\s+/g, " ").trim()
const share = (n: unknown) => (typeof n === "number" && Number.isFinite(n) ? n : null)
const round2 = (n: number) => Math.round(n * 100) / 100

/** Checks a nomination against the holding's rules. Bad rows and garbage values never throw. */
export function checkNomination(value: Partial<Nomination> | null | undefined, holding: HoldingKind = "deposit", rules: HoldingRules = NOMINATION_RULES[holding]): NominationIssue[] {
  const nominees = Array.isArray(value?.nominees) ? value.nominees.filter((n): n is Nominee => !!n && typeof n === "object") : []
  const mode: NominationMode = rules.modes.includes(value?.mode as NominationMode) ? (value!.mode as NominationMode) : rules.modes[0]
  const issues: NominationIssue[] = []
  if (!nominees.length) return [{ kind: "none" }]
  // Only a holding with a single allowed mode (lockers) can be "wrong"; an unknown mode elsewhere falls back silently.
  if (value?.mode && rules.modes.length === 1 && !rules.modes.includes(value.mode)) issues.push({ kind: "mode", allowed: rules.modes[0] })
  if (nominees.length > rules.max) issues.push({ kind: "tooMany", max: rules.max, dropped: nominees.slice(rules.max).map((n) => clean(n.name) || "—") })

  const counted = nominees.slice(0, rules.max)
  const seen = new Map<string, string>()
  for (const n of counted) {
    const k = key(n.name)
    if (!k) issues.push({ kind: "noName", id: n.id })
    else if (seen.has(k)) issues.push({ kind: "duplicate", id: n.id, name: clean(n.name) })
    else seen.set(k, n.id)
    if (rules.relationRequired && k && !clean(n.relation)) issues.push({ kind: "noRelation", id: n.id, name: clean(n.name) })
    if (n.minor && (rules.askMinorGuardian ?? holding !== "demat") && !clean(n.guardian)) issues.push({ kind: "minorNoGuardian", id: n.id, name: clean(n.name) })
    if (n.minor && (rules.minorDobRequired ?? holding === "demat") && !clean(n.dob)) issues.push({ kind: "minorNoDob", id: n.id, name: clean(n.name) })
  }

  const given = counted.filter((n) => share(n.share) !== null)
  if (mode === "simultaneous" && counted.length === 1 && given.length === 1 && share(given[0].share) !== 100)
    issues.push({ kind: "total", total: round2(share(given[0].share) ?? 0) })
  if (mode === "simultaneous" && counted.length > 1) {
    const blank = counted.filter((n) => share(n.share) === null).map((n) => n.id)
    if (blank.length === counted.length) {
      if (!rules.blankMeansEqual) issues.push({ kind: "blankShare", ids: blank })
    } else if (blank.length) {
      issues.push(rules.blankMeansEqual ? { kind: "someBlank", ids: blank } : { kind: "blankShare", ids: blank })
    } else {
      const total = round2(counted.reduce((sum, n) => sum + (share(n.share) ?? 0), 0))
      if (total !== 100) issues.push({ kind: "total", total })
    }
    for (const n of counted) {
      const v = share(n.share)
      if (v === 0) issues.push({ kind: "zeroShare", id: n.id, name: clean(n.name) })
      else if (v !== null && (v < 0 || v > 100)) issues.push({ kind: "badShare", id: n.id, name: clean(n.name) })
    }
  }
  return issues
}

/** Whole-number percentages that add to exactly 100, the remainder going to the first nominees (largest remainder). */
export function equalShares(count: number): number[] {
  if (!Number.isInteger(count) || count < 1) return []
  const base = Math.floor(100 / count)
  return Array.from({ length: count }, (_, i) => base + (i < 100 - base * count ? 1 : 0))
}

/** Who gets what, in order, as the nomination stands. */
export function whoGetsWhat(value: Partial<Nomination> | null | undefined, holding: HoldingKind = "deposit", rules: HoldingRules = NOMINATION_RULES[holding]):
  { mode: NominationMode; rows: { id: string; name: string; share: number | null }[]; equal: boolean } {
  const nominees = (Array.isArray(value?.nominees) ? value.nominees : []).filter((n) => n && clean(n.name)).slice(0, rules.max)
  const mode: NominationMode = rules.modes.includes(value?.mode as NominationMode) ? (value!.mode as NominationMode) : rules.modes[0]
  const allBlank = nominees.every((n) => share(n.share) === null)
  const equal = mode === "simultaneous" && allBlank && rules.blankMeansEqual && nominees.length > 1
  const even = equal ? round2(100 / nominees.length) : null
  return {
    mode, equal,
    rows: nominees.map((n) => ({ id: n.id, name: clean(n.name), share: mode === "successive" ? null : nominees.length === 1 ? 100 : equal ? even : share(n.share) })),
  }
}
