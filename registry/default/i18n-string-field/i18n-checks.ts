/** Pure checks behind I18nStringField. Safe to run on the server or in CI. */

export interface PluralBlock {
  /** The counted argument, e.g. "count". */
  arg: string
  ordinal: boolean
  /** Branch keys in order, e.g. ["one", "other"] or ["=0", "other"]. */
  keys: string[]
  /** Text inside each branch. */
  bodies: string[]
  /** Offset of the block's opening brace. */
  start: number
  /** Offset just past the block's closing brace. */
  end: number
}

export interface TranslationIssue {
  kind: "placeholder" | "plural" | "length" | "untranslated"
  message: string
  /** One-tap fix: the whole corrected translation. */
  fix?: { label: string; value: string }
}

/** Every placeholder occurrence, normalised: {count}, {{name}}, %s, %1$s, <b>, </b>, <br/>. */
export function findPlaceholders(text: string): string[] {
  const out: string[] = []
  const rest = text.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, name: string) => {
    out.push(`{{${name}}}`)
    return " "
  })
  for (const m of rest.matchAll(/\{\s*(\w+)\s*(?=[,}])|%(?:\d+\$)?(?:\.\d+)?[sdif@]|<(\/?)([a-z][\w-]*|\d+)[^>]*?(\/?)>/gi)) {
    if (m[1]) out.push(`{${m[1]}}`)
    else if (m[0].startsWith("%")) out.push(m[0])
    else out.push(`<${m[2]}${m[3].toLowerCase()}${m[4]}>`)
  }
  return out
}

/** ICU `{arg, plural|selectordinal, …}` blocks, with their branches. */
export function pluralBlocks(text: string): PluralBlock[] {
  const blocks: PluralBlock[] = []
  for (const m of text.matchAll(/\{\s*(\w+)\s*,\s*(plural|selectordinal)\s*,/g)) {
    const block: PluralBlock = { arg: m[1], ordinal: m[2] === "selectordinal", keys: [], bodies: [], start: m.index, end: -1 }
    let i = m.index + m[0].length
    while (i < text.length) {
      const key = /^\s*(offset:\s*\d+\s*)?(=\d+|\w+)?\s*/.exec(text.slice(i))!
      i += key[0].length
      if (text[i] === "}" || i >= text.length) break
      if (text[i] !== "{") return blocks
      let depth = 1
      const start = ++i
      while (i < text.length && depth > 0) {
        if (text[i] === "{") depth++
        else if (text[i] === "}") depth--
        i++
      }
      block.keys.push(key[2] ?? "")
      block.bodies.push(text.slice(start, i - 1))
    }
    block.end = i + 1
    blocks.push(block)
  }
  return blocks
}

/** Plural categories a locale actually uses for whole numbers 0–1000 (French "many" only applies to millions). */
export function requiredPluralForms(locale: string, ordinal = false): string[] {
  const rules = new Intl.PluralRules(locale, { type: ordinal ? "ordinal" : "cardinal" })
  const used = new Set<string>(["other"])
  for (let n = 0; n <= 1000; n++) used.add(rules.select(n))
  return rules.resolvedOptions().pluralCategories.filter((c) => used.has(c))
}

/** Characters the string renders at: longest plural branch, tags removed, placeholders at a fixed width. */
export function renderedLength(text: string, placeholderLength = 4): number {
  let flat = text
  for (const block of pluralBlocks(text).reverse()) {
    const longest = block.bodies.reduce((a, b) => (b.length > a.length ? b : a), "")
    flat = flat.slice(0, block.start) + longest.replace(/#/g, "{n}") + flat.slice(block.end)
  }
  const width = "0".repeat(placeholderLength)
  flat = flat
    .replace(/\{\{\s*[\w.]+\s*\}\}|\{\s*\w+[^{}]*\}|%(?:\d+\$)?(?:\.\d+)?[sdif@]/g, width)
    .replace(/<[^>]+>/g, "")
  return [...flat].length
}

const count = (list: string[]) => list.reduce((m, t) => m.set(t, (m.get(t) ?? 0) + 1), new Map<string, number>())
const lang = (locale: string) => locale.toLowerCase().split(/[-_]/)[0]

/** Every problem with `translation` against `source`, most serious first. */
export function lintTranslation(
  source: string,
  translation: string,
  { locale, sourceLocale = "en", maxLength, placeholderLength = 4 }: { locale: string; sourceLocale?: string; maxLength?: number; placeholderLength?: number },
): { issues: TranslationIssue[]; length: number } {
  const issues: TranslationIssue[] = []
  const length = renderedLength(translation, placeholderLength)
  if (!translation.trim()) return { issues, length }

  // Placeholders: compare as sets so plural branches that repeat {name} don't count twice.
  const want = new Set(findPlaceholders(source))
  const have = new Set(findPlaceholders(translation))
  const missing = [...want].filter((t) => !have.has(t))
  const extra = [...have].filter((t) => !want.has(t))
  if (missing.length === 1 && extra.length === 1 && missing[0][0] === extra[0][0]) {
    const [from, to] = [extra[0], missing[0]]
    const inner = (t: string) => t.replace(/^\{+|\}+$/g, "")
    issues.push({
      kind: "placeholder",
      message: `${from} isn't in the source. It should stay ${to}.`,
      fix: { label: `Rename to ${to}`, value: translation.replace(new RegExp(`\\{(\\{?)\\s*${inner(from)}\\s*(?=[,}])`, "g"), `{$1${inner(to)}`) },
    })
  } else {
    for (const t of missing)
      issues.push({ kind: "placeholder", message: `Missing ${t}.`, fix: { label: `Add ${t}`, value: t.startsWith("</") ? translation.trimEnd() + t : `${translation.trimEnd()} ${t}` } })
    for (const t of extra) issues.push({ kind: "placeholder", message: `${t} isn't in the source.` })
  }
  // Tags opened but not closed (or the other way round) break the markup even when the set matches.
  const tags = count(findPlaceholders(translation).filter((t) => t.startsWith("<") && !t.endsWith("/>")))
  for (const [tag, n] of tags) {
    if (tag.startsWith("</")) continue
    const close = `</${tag.slice(1)}`
    const shortBy = n - (tags.get(close) ?? 0)
    if (shortBy > 0 && want.has(close) && have.has(close)) issues.push({ kind: "placeholder", message: `${tag} is opened ${n}× but closed ${n - shortBy}×.` })
  }

  // Plurals: the source's plural blocks must survive, with every form the target language needs.
  const srcBlocks = pluralBlocks(source)
  const blocks = pluralBlocks(translation)
  for (const src of srcBlocks) {
    const block = blocks.find((b) => b.arg === src.arg && b.ordinal === src.ordinal)
    if (!block) {
      issues.push({ kind: "plural", message: `The plural for {${src.arg}} is gone. Keep the keyword "${src.ordinal ? "selectordinal" : "plural"}" untranslated.` })
      continue
    }
    const need = requiredPluralForms(locale, block.ordinal).filter((c) => !block.keys.includes(c))
    if (!need.length) continue
    const other = block.bodies[block.keys.indexOf("other")] ?? block.bodies[block.bodies.length - 1] ?? ""
    const added = need.map((c) => ` ${c} {${other}}`).join("")
    const at = block.end - 1
    issues.push({
      kind: "plural",
      message: `${new Intl.DisplayNames([sourceLocale], { type: "language" }).of(locale) ?? locale} also needs “${need.join("”, “")}” for {${block.arg}}.`,
      fix: { label: `Add ${need.length === 1 ? "form" : "forms"}`, value: translation.slice(0, at).trimEnd() + added + translation.slice(at) },
    })
  }

  if (maxLength !== undefined && length > maxLength)
    issues.push({ kind: "length", message: `${length - maxLength} ${length - maxLength === 1 ? "character" : "characters"} over the ${maxLength}-character space.` })

  const strip = (s: string) =>
    s
      .replace(/\{\s*\w+\s*,\s*\w+\s*,|(?:=\d+|zero|one|two|few|many|other)\s*\{/g, " ")
      .replace(/\{\{?[^{}]*\}?\}|%(?:\d+\$)?(?:\.\d+)?[sdif@]|<[^>]+>|[{}#]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase()
  if (lang(locale) !== lang(sourceLocale) && /\p{L}{3}/u.test(strip(source)) && strip(source) === strip(translation))
    issues.push({ kind: "untranslated", message: "This is still the source text." })

  return { issues, length }
}
