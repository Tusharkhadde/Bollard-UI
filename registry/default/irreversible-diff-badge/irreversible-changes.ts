// Bollard UI — irreversible-diff-badge · MIT licence · https://bollard-ui.vercel.app/components/irreversible-diff-badge

/** A form field that can't (or can only rarely) be changed back once saved. */
export interface IrreversibleField {
  key: string
  label: string
  /** "permanent": can never be undone. "limited": can be changed again only under a rule (once a month, by support). */
  severity?: "permanent" | "limited"
  /** What happens once saved, in plain words: "Links to your old profile stop working." */
  consequence?: string
  /** Formats a value for the readback. Defaults to String(value), or "empty". */
  format?: (value: unknown) => string
  /** Treats two values as the same (e.g. ignoring case). Defaults to a strict, then JSON, comparison. */
  isEqual?: (a: unknown, b: unknown) => boolean
}

export interface IrreversibleChange {
  field: IrreversibleField
  from: unknown
  to: unknown
}

const same = (a: unknown, b: unknown) => {
  if (Object.is(a, b)) return true
  try {
    return JSON.stringify(a) === JSON.stringify(b)
  } catch {
    return false
  }
}

/** A stable string for a value, so object changes are compared by content. */
export const stable = (v: unknown) => {
  try {
    return typeof v === "string" ? v : JSON.stringify(v) ?? String(v)
  } catch {
    return String(v)
  }
}

/** The fields that changed and can't be undone. A field edited back to its saved value doesn't count. */
export function irreversibleChanges(fields: IrreversibleField[], saved: Record<string, unknown> = {}, current: Record<string, unknown> = {}): IrreversibleChange[] {
  const equal = (f: IrreversibleField) => {
    try {
      return (f.isEqual ?? same)(saved?.[f.key], current?.[f.key])
    } catch {
      return same(saved?.[f.key], current?.[f.key])
    }
  }
  return (Array.isArray(fields) ? fields : [])
    .filter((f) => f && typeof f.key === "string" && !equal(f))
    .map((field) => ({ field, from: saved?.[field.key], to: current?.[field.key] }))
}
