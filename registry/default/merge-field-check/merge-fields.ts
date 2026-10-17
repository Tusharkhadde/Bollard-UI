// Bollard UI — merge-field-check · MIT licence · https://bollard-ui.vercel.app/components/merge-field-check

/** A recipient row: field name → value. */
export type MergeRecipient = Record<string, string | null | undefined>

export type TemplatePart =
  | { type: "text"; value: string }
  | { type: "tag"; field: string; fallback?: string; start: number; end: number }
  | { type: "broken"; raw: string; start: number; end: number; fix: string }

export type MergeIssue =
  | { kind: "unclosed"; raw: string; start: number; end: number; fix: string }
  | { kind: "unknown"; field: string; suggestion?: string }
  | { kind: "missing"; field: string; count: number; indexes: number[] }

/** `{{ first_name }}` or `{{ first_name | default: "there" }}`. */
const TAG = /^\{\{\s*([A-Za-z_][\w.]*)\s*(?:\|\s*default\s*:\s*(["'])(.*?)\2\s*)?\}\}$/

/** Splits a template into text, merge tags and broken braces (`{{first_name,` or `{first_name}}`), each broken one with its repaired text. */
export function parseTemplate(template: string): TemplatePart[] {
  const parts: TemplatePart[] = []
  const pushText = (value: string) => value && parts.push({ type: "text", value })
  let last = 0
  // A whole {{…}}, then the broken shapes: "{{name" / "{{name}", "{name}}", "name}}".
  for (const m of template.matchAll(/\{\{[^{}]*\}\}|\{\{\s*[\w.]*\s*\}?|\{\s*[A-Za-z_][\w.]*\s*\}\}|[A-Za-z_][\w.]*\s*\}\}/g)) {
    const raw = m[0]
    const start = m.index
    const end = start + raw.length
    const tag = raw.match(TAG)
    pushText(template.slice(last, start))
    if (tag) parts.push({ type: "tag", field: tag[1], fallback: tag[3], start, end })
    else {
      const name = raw.replace(/default\s*:.*$|[{}|]/g, "").trim().replace(/\s+/g, "_")
      parts.push({ type: "broken", raw, start, end, fix: name ? `{{${name}}}` : "" })
    }
    last = end
  }
  pushText(template.slice(last))
  return parts
}

/** Edit distance where a swapped neighbour pair (frist → first) is one edit. */
function distance(a: string, b: string) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)))
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1)
    }
  }
  return d[a.length][b.length]
}

/** The known field an unknown one was probably meant to be: `frist_name`, `FirstName` and `first name` all find `first_name`. */
export function suggestField(field: string, fields: string[]) {
  const norm = (s: string) => s.toLowerCase().replace(/[\s_.-]+/g, "")
  let best: string | undefined
  let score = Infinity
  for (const known of fields) {
    const d = distance(norm(field), norm(known))
    if (d < score) [best, score] = [known, d]
  }
  return best && score <= Math.max(1, Math.floor(norm(field).length / 4)) ? best : undefined
}

/** A value made only of spaces counts as missing: "Hi  ," is still broken. */
export const isBlank = (value: string | null | undefined) => !value?.trim()

/** Every problem in the template for this audience: broken braces first, then unknown fields, then fields some recipients have no value for (ignoring tags that already have a fallback). */
export function checkMergeFields(template: string, recipients: MergeRecipient[], fields?: string[]): MergeIssue[] {
  const known = fields ?? Array.from(new Set(recipients.flatMap((r) => Object.keys(r))))
  const parts = parseTemplate(template)
  const issues: MergeIssue[] = []
  for (const part of parts) if (part.type === "broken") issues.push({ kind: "unclosed", raw: part.raw, start: part.start, end: part.end, fix: part.fix })
  const tags = parts.filter((p) => p.type === "tag")
  for (const field of new Set(tags.map((t) => t.field))) {
    if (!known.includes(field)) {
      issues.push({ kind: "unknown", field, suggestion: suggestField(field, known) })
      continue
    }
    if (tags.every((t) => t.field !== field || t.fallback !== undefined)) continue
    const indexes = recipients.flatMap((r, i) => (isBlank(r[field]) ? [i] : []))
    if (indexes.length) issues.push({ kind: "missing", field, count: indexes.length, indexes })
  }
  return issues
}

/** Rewrites every tag of `field`: rename it, or give its fallback-less tags a `default`. */
export function rewriteTags(template: string, field: string, change: { rename?: string; fallback?: string }) {
  let out = ""
  let last = 0
  for (const part of parseTemplate(template)) {
    if (part.type !== "tag" || part.field !== field || (!change.rename && part.fallback !== undefined)) continue
    const name = change.rename ?? field
    const fallback = part.fallback ?? change.fallback
    out += template.slice(last, part.start) + (fallback === undefined ? `{{${name}}}` : `{{${name} | default: "${fallback}"}}`)
    last = part.end
  }
  return out + template.slice(last)
}
