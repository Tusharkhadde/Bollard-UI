// Bollard UI — autofill-check · MIT licence · https://bollard-ui.vercel.app/components/autofill-check

export type FieldKind = "name" | "email" | "tel" | "postal-code" | "address" | "other"

/** A field the browser filled, as the checks see it. */
export interface FilledField {
  /** The field's `name` (or `id`). */
  key: string
  label: string
  value: string
  kind: FieldKind
}

export interface FilledIssue {
  /** Why the value looks wrong for this field. */
  reason: "email-in-name" | "phone-in-name" | "not-email" | "not-phone" | "not-postcode" | "differs" | "duplicate"
  /** A value to put in instead (the one on the account), if there is one. */
  suggestion?: string
  /** Label of the other field, for "duplicate". */
  other?: string
}

/** Guesses what a field holds from its autocomplete token, type and name, the way browsers do. */
export function fieldKind(el: { autocomplete?: string; type?: string; name?: string; id?: string }): FieldKind {
  const hint = `${el.autocomplete ?? ""} ${el.name ?? ""} ${el.id ?? ""}`.toLowerCase()
  if (el.type === "email" || /e-?mail/.test(hint)) return "email"
  if (el.type === "tel" || /\btel|phone|mobile/.test(hint)) return "tel"
  if (/postal|zip|postcode|pin-?code/.test(hint)) return "postal-code"
  if (/address|street|line1|line2|city|locality|level\d/.test(hint)) return "address"
  if (/name/.test(hint)) return "name"
  return "other"
}

const tidy = (s: string) => s.toLowerCase().replace(/[\s,.-]+/g, " ").trim()

/**
 * Finds autofilled values that landed in the wrong field (an email in Name, a
 * number in Email), differ from what the account holds (an old address), or
 * were copied into two different kinds of field. One issue per field.
 */
export function checkFilled(fields: FilledField[], reference: Record<string, string> = {}): Map<string, FilledIssue> {
  const issues = new Map<string, FilledIssue>()
  for (const { key, value, kind } of fields) {
    const v = value.trim()
    if (!v) continue
    const ref = reference[key]
    if (kind === "name" && /@/.test(v)) issues.set(key, { reason: "email-in-name" })
    else if (kind === "name" && (v.match(/\d/g)?.length ?? 0) >= 6) issues.set(key, { reason: "phone-in-name" })
    else if (kind === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) issues.set(key, { reason: "not-email" })
    else if (kind === "tel" && /[a-z]{2,}|@/i.test(v)) issues.set(key, { reason: "not-phone" })
    else if (kind === "postal-code" && (v.length > 10 || /\s\S+\s/.test(v))) issues.set(key, { reason: "not-postcode" })
    else if (ref && tidy(ref) !== tidy(v)) issues.set(key, { reason: "differs", suggestion: ref })
  }
  // The same text in two different kinds of field: flag the later one, unless either already has an issue.
  for (let i = 0; i < fields.length; i++) {
    for (let j = i + 1; j < fields.length; j++) {
      const [a, b] = [fields[i], fields[j]]
      if (a.kind === b.kind || !a.value.trim() || tidy(a.value) !== tidy(b.value) || issues.has(a.key) || issues.has(b.key)) continue
      issues.set(b.key, { reason: "duplicate", other: a.label })
    }
  }
  return issues
}
