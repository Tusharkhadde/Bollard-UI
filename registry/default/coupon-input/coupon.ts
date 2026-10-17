// Bollard UI — coupon-input · MIT licence · https://bollard-ui.vercel.app/components/coupon-input

/** Why a code did or didn't apply. Return one of these from `onApply`. */
export type CouponResult =
  | {
      status: "applied"
      code: string
      /** Money taken off, in major units. */
      saving: number
      /** Plain description of the offer, e.g. "20% off". */
      description?: string
      /** What the offer would have saved without its cap, when a cap kicked in. */
      uncapped?: number
      /** Cart items the code skipped. The saving is on the rest. */
      excludedItems?: string[]
    }
  | { status: "min-cart"; code: string; minimum: number; cartTotal: number }
  | { status: "expired"; code: string; endedAt: Date | string }
  | { status: "not-started"; code: string; startsAt: Date | string }
  | { status: "excluded"; code: string; items: string[] }
  | { status: "used" | "limit-reached" | "not-found"; code: string }
  | { status: "not-eligible"; code: string; reason?: string }

/** Characters people read and type for each other. Order inside a group doesn't matter. */
export const CONFUSABLE_GROUPS = ["O0", "I1L", "S5", "B8", "Z2", "G6"]

const INVISIBLE = /[\u00AD\u200B-\u200F\u2060\uFEFF]/g
const DASHES = /[\u2010-\u2015\u2212]/g

export interface CleanedCoupon {
  code: string
  /** What was taken out or changed, for a short "we cleaned this" note. */
  spaces: number
  invisible: number
  dashes: number
}

/**
 * Normalises a typed or pasted code: drops spaces, line breaks and invisible characters,
 * turns typographic dashes into "-", folds full-width letters (NFKC) and upper-cases
 * unless the shop's codes are case-sensitive.
 */
export function cleanCoupon(raw: string, caseSensitive = false): CleanedCoupon {
  const folded = raw.normalize("NFKC")
  const invisible = (folded.match(INVISIBLE) ?? []).length
  const dashes = (folded.match(DASHES) ?? []).length
  const noInvisible = folded.replace(INVISIBLE, "").replace(DASHES, "-")
  const spaces = (noInvisible.match(/\s/g) ?? []).length
  const code = noInvisible.replace(/\s+/g, "")
  return { code: caseSensitive ? code : code.toUpperCase(), spaces, invisible, dashes }
}

const groupOf = (ch: string) => CONFUSABLE_GROUPS.find((g) => g.includes(ch.toUpperCase()))

/** Positions in the code holding a character that has a look-alike (O/0, I/1/L, S/5, B/8, Z/2, G/6). */
export function confusablePositions(code: string) {
  return [...code].flatMap((ch, i) => (groupOf(ch) ? [i] : []))
}

/**
 * Finds the known code the typed one differs from only by look-alike characters
 * (SAVE1O → SAVE10), ignoring case and dashes. Returns null when there is none or more than one.
 */
export function matchConfusable(code: string, known: string[]): string | null {
  const flat = (s: string) => s.toUpperCase().replace(/-/g, "")
  const typed = flat(code)
  const hits = known.filter((k) => {
    const target = flat(k)
    if (target === typed || target.length !== typed.length) return false
    return [...typed].every((ch, i) => ch === target[i] || (groupOf(ch) !== undefined && groupOf(ch) === groupOf(target[i])))
  })
  return hits.length === 1 ? hits[0] : null
}
