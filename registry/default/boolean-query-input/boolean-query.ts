/** Pure tokenizer, parser and linter for boolean search strings (LinkedIn, ATS, job boards). No React. */

export type BooleanOperator = "AND" | "OR" | "NOT"
/** How the search engine groups AND and OR when there are no brackets. Most engines (LinkedIn, Bing) bind AND first. */
export type QueryPrecedence = "and-first" | "left-to-right"

export type QueryToken =
  | { type: "term"; text: string; start: number; end: number; quoted: boolean; closed: boolean }
  | { type: "op"; op: BooleanOperator; start: number; end: number }
  | { type: "open"; start: number; end: number }
  | { type: "close"; start: number; end: number }

export type QueryNode =
  | { kind: "term"; text: string; closed: boolean }
  | { kind: "group"; child: QueryNode | null }
  | { kind: "not"; child: QueryNode }
  | { kind: "and"; children: QueryNode[]; joins: ("AND" | "")[] }
  | { kind: "or"; children: QueryNode[] }

/** One piece of a readback. `implied` marks brackets and ANDs the engine adds that the user never typed. */
export interface QueryPart {
  text: string
  role: "term" | "op" | "paren"
  implied?: boolean
  broken?: boolean
}

export type QueryIssueKind =
  | "smart-quotes" | "unclosed-quote" | "brackets" | "stray-close" | "unclosed-open"
  | "empty-group" | "lowercase-op" | "dangling-op" | "precedence"

export interface QueryIssue {
  kind: QueryIssueKind
  /** Values for the message template. */
  detail: Record<string, string>
  /** The fixed query, when one tap can fix it. */
  fix?: string
  /** For "precedence": the query with the engine's own grouping written out. */
  keep?: string
}

const QUOTE = /["“”„]/
const SMART = /[“”„]/g

export function tokenizeQuery(query: string): QueryToken[] {
  const tokens: QueryToken[] = []
  let i = 0
  while (i < query.length) {
    const ch = query[i]
    if (/\s/.test(ch)) i++
    else if (ch === "(" || ch === ")") tokens.push(ch === "(" ? { type: "open", start: i, end: ++i } : { type: "close", start: i, end: ++i })
    else if (QUOTE.test(ch)) {
      let j = i + 1
      while (j < query.length && !QUOTE.test(query[j])) j++
      const closed = j < query.length
      const end = closed ? j + 1 : query.length
      tokens.push({ type: "term", text: query.slice(i, end), start: i, end, quoted: true, closed })
      i = end
    } else {
      let j = i
      while (j < query.length && !/[\s()"“”„]/.test(query[j])) j++
      const text = query.slice(i, j)
      if (text === "AND" || text === "OR" || text === "NOT") tokens.push({ type: "op", op: text, start: i, end: j })
      else tokens.push({ type: "term", text, start: i, end: j, quoted: false, closed: true })
      i = j
    }
  }
  return tokens
}

type Item = { t: "operand"; node: QueryNode } | { t: "op"; op: BooleanOperator | "" }

/** Groups tokens by bracket level (tolerating stray brackets), then parses each level with the chosen precedence. */
export function parseQuery(tokens: QueryToken[], mode: QueryPrecedence | "or-first"): QueryNode | null {
  let i = 0
  const level = (nested: boolean): QueryNode | null => {
    const raw: Item[] = []
    while (i < tokens.length) {
      const tok = tokens[i++]
      if (tok.type === "close") {
        if (nested) return build(raw, mode)
        continue // a stray ")" at the top level is ignored, as engines do
      }
      if (tok.type === "open") raw.push({ t: "operand", node: { kind: "group", child: level(true) } })
      else if (tok.type === "op") raw.push({ t: "op", op: tok.op })
      else raw.push({ t: "operand", node: { kind: "term", text: tok.text, closed: tok.closed } })
    }
    return build(raw, mode)
  }
  return level(false)
}

function build(raw: Item[], mode: QueryPrecedence | "or-first"): QueryNode | null {
  // Drop dangling AND/OR and add the implicit AND between neighbours ("java remote", "java NOT php").
  const items: Item[] = []
  for (const item of raw) {
    const prev = items[items.length - 1]
    if (item.t === "op" && item.op !== "NOT") {
      if (prev?.t === "operand") items.push(item)
      else if (prev?.t === "op" && prev.op !== "NOT") items[items.length - 1] = item
      continue
    }
    if (prev?.t === "operand") items.push({ t: "op", op: "" })
    items.push(item)
  }
  while (items.length && items[items.length - 1].t === "op") items.pop()
  if (!items.length) return null

  if (mode === "left-to-right") {
    let pos = 0
    const unit = (): QueryNode => {
      const item = items[pos++]
      return item.t === "op" ? { kind: "not", child: unit() } : item.node
    }
    let acc = unit()
    while (pos < items.length) {
      const op = (items[pos++] as { op: BooleanOperator | "" }).op
      acc = op === "OR" ? join("or", [acc, unit()]) : join("and", [acc, unit()], [op as "AND" | ""])
    }
    return acc
  }

  // Split on the loosest operator, then the tighter one inside each part.
  const [outer, inner] = mode === "and-first" ? (["OR", "AND"] as const) : (["AND", "OR"] as const)
  const split = (list: Item[], on: "AND" | "OR") => {
    const parts: Item[][] = [[]]
    const joins: ("AND" | "")[] = []
    for (const item of list) {
      const isJoin = item.t === "op" && (on === "OR" ? item.op === "OR" : item.op === "AND" || item.op === "")
      if (isJoin) {
        parts.push([])
        joins.push(item.op as "AND" | "")
      } else parts[parts.length - 1].push(item)
    }
    return { parts, joins }
  }
  const units = (list: Item[]): QueryNode => {
    // In or-first reading, a leading NOT takes the whole OR list after it: NOT (junior OR intern).
    if (mode === "or-first" && list[0]?.t === "op" && list.length > 2) return { kind: "not", child: units(list.slice(1)) }
    const { parts } = split(list, inner === "OR" ? "OR" : "AND")
    const nodes = parts.map(unaries)
    return inner === "OR" ? join("or", nodes) : join("and", nodes, split(list, "AND").joins)
  }
  const unaries = (list: Item[]): QueryNode => {
    const [first, ...rest] = list
    return first.t === "op" ? { kind: "not", child: unaries(rest) } : first.node
  }
  const { parts, joins } = split(items, outer)
  const nodes = parts.map(units)
  return outer === "OR" ? join("or", nodes) : join("and", nodes, joins)
}

function join(kind: "and" | "or", nodes: QueryNode[], joins: ("AND" | "")[] = []): QueryNode {
  if (nodes.length === 1) return nodes[0]
  if (kind === "or") return { kind, children: nodes.flatMap((n) => (n.kind === "or" ? n.children : [n])) }
  const children: QueryNode[] = []
  const all: ("AND" | "")[] = []
  nodes.forEach((n, idx) => {
    if (idx) all.push(joins[idx - 1] ?? "AND")
    if (n.kind === "and") {
      children.push(...n.children)
      all.push(...n.joins)
    } else children.push(n)
  })
  return { kind, children, joins: all }
}

/** The query as parts, with the brackets the engine implies added and marked. */
export function queryParts(node: QueryNode | null): QueryPart[] {
  if (!node) return []
  const wrap = (child: QueryNode, parent: QueryNode["kind"]): QueryPart[] => {
    const inner = queryParts(child)
    // A NOT inside an OR list is bracketed too, since "NOT a OR b" is the classic misread.
    const needs = ((child.kind === "and" || child.kind === "or") && child.kind !== parent) || (child.kind === "not" && parent === "or")
    return needs ? [{ text: "(", role: "paren", implied: true }, ...inner, { text: ")", role: "paren", implied: true }] : inner
  }
  switch (node.kind) {
    case "term":
      return [{ text: node.text, role: "term", broken: !node.closed }]
    case "group":
      return [{ text: "(", role: "paren" }, ...queryParts(node.child), { text: ")", role: "paren" }]
    case "not":
      return [{ text: "NOT", role: "op" }, ...wrap(node.child, "not")]
    case "or":
      return node.children.flatMap((c, idx) => [...(idx ? [{ text: "OR", role: "op" } as QueryPart] : []), ...wrap(c, "or")])
    case "and":
      return node.children.flatMap((c, idx) => [
        ...(idx ? [{ text: "AND", role: "op", implied: node.joins[idx - 1] === "" } as QueryPart] : []),
        ...wrap(c, "and"),
      ])
  }
}

/** Writes parts back as a query string. Implied ANDs stay implicit; implied brackets are written out. */
export function partsToQuery(parts: QueryPart[]): string {
  let out = ""
  parts.forEach((p, idx) => {
    if (p.role === "op" && p.implied) return
    const prev = parts[idx - 1]
    if (out && !(prev?.text === "(" && prev.role === "paren") && !(p.text === ")" && p.role === "paren")) out += " "
    out += p.text
  })
  return out
}

const replaceAt = (s: string, start: number, end: number, text: string) => (s.slice(0, start) + text + s.slice(end)).replace(/\s{2,}/g, " ").trim()

/** Every mistake in the query, most fundamental first. Fix one and the next one shows. */
export function lintQuery(query: string, precedence: QueryPrecedence = "and-first"): QueryIssue[] {
  const issues: QueryIssue[] = []
  const tokens = tokenizeQuery(query)
  if (/[“”„]/.test(query)) issues.push({ kind: "smart-quotes", detail: {}, fix: query.replace(SMART, '"') })

  const open = tokens.find((t) => t.type === "term" && !t.closed)
  if (open) {
    // Close the phrase where it most likely ends: before the next operator or bracket.
    const rest = query.slice(open.start + 1)
    const stop = rest.search(/\s+(AND|OR|NOT)\s|\s*\)/)
    const at = stop < 0 ? query.trimEnd().length : open.start + 1 + stop
    const phrase = query.slice(open.start + 1, at).trim()
    issues.push({ kind: "unclosed-quote", detail: { phrase }, fix: query.slice(0, at).trimEnd() + '"' + query.slice(at) })
  }

  const outside = tokens.filter((t) => t.type === "term" && !t.quoted).map((t) => (t as { text: string }).text).join(" ")
  if (/[[\]{}]/.test(outside)) {
    let inQuote = false
    const fix = [...query].map((c) => (QUOTE.test(c) ? ((inQuote = !inQuote), c) : inQuote ? c : c === "[" || c === "{" ? "(" : c === "]" || c === "}" ? ")" : c)).join("")
    issues.push({ kind: "brackets", detail: {}, fix })
  }

  let depth = 0
  const opens: QueryToken[] = []
  for (const tok of tokens) {
    if (tok.type === "open") opens.push(tok), depth++
    else if (tok.type === "close") {
      if (depth === 0) {
        issues.push({ kind: "stray-close", detail: {}, fix: replaceAt(query, tok.start, tok.end, "") })
        break
      }
      depth--, opens.pop()
    }
  }
  if (depth > 0) issues.push({ kind: "unclosed-open", detail: { count: String(depth) }, fix: query.trimEnd() + ")".repeat(depth) })

  tokens.forEach((tok, idx) => {
    const next = tokens[idx + 1]
    if (tok.type === "open" && next?.type === "close" && !issues.some((i) => i.kind === "empty-group"))
      issues.push({ kind: "empty-group", detail: {}, fix: replaceAt(query, tok.start, next.end, "") })
  })

  const lower = tokens.filter(
    (t, idx): t is Extract<QueryToken, { type: "term" }> =>
      t.type === "term" && !t.quoted && /^(and|or|not)$/i.test(t.text) && t.text !== t.text.toUpperCase() && idx > 0 && idx < tokens.length - 1
  )
  if (lower.length) {
    const fix = lower.reduceRight((s, t) => s.slice(0, t.start) + t.text.toUpperCase() + s.slice(t.end), query)
    issues.push({ kind: "lowercase-op", detail: { word: lower[0].text, op: lower[0].text.toUpperCase(), count: String(lower.length) }, fix })
  }

  const dangling = tokens.find((t, idx) => {
    if (t.type !== "op") return false
    const prev = tokens[idx - 1]
    const next = tokens[idx + 1]
    const noLeft = t.op !== "NOT" && (!prev || prev.type === "open" || prev.type === "op")
    const noRight = !next || next.type === "close" || (next.type === "op" && next.op !== "NOT")
    return noLeft || noRight
  })
  if (dangling?.type === "op") issues.push({ kind: "dangling-op", detail: { op: dangling.op }, fix: replaceAt(query, dangling.start, dangling.end, "") })

  // Grouping is only worth explaining once the query is structurally sound; lowercase words may be intended.
  if (issues.every((i) => i.kind === "lowercase-op")) {
    const engine = partsToQuery(queryParts(parseQuery(tokens, precedence)))
    const meant = partsToQuery(queryParts(parseQuery(tokens, "or-first")))
    if (engine !== meant) issues.push({ kind: "precedence", detail: { engine, meant }, fix: meant, keep: engine })
  }
  return issues
}
