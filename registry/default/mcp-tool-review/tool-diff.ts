// Bollard UI — mcp-tool-review · MIT licence · https://bollard-ui.vercel.app/components/mcp-tool-review

/** An MCP tool definition as a server lists it (tools/list). */
export interface McpTool {
  name: string
  description?: string
  inputSchema?: { properties?: Record<string, { type?: string; description?: string } | undefined>; required?: string[] }
  annotations?: { readOnlyHint?: boolean; destructiveHint?: boolean; openWorldHint?: boolean }
}

export type ToolChange = "added" | "removed" | "changed" | "same"
export type FindingCode = "injection" | "secret-path" | "exfil-param" | "shadowing" | "name-clash" | "hidden-chars" | "hint-flip" | "grew"

export interface ToolFinding {
  code: FindingCode
  level: "danger" | "warn"
  message: string
  /** The words that triggered it, as written in the new definition. */
  excerpt?: string
}

export interface DiffPart {
  op: "same" | "add" | "del"
  text: string
}

export interface ParamChange {
  name: string
  op: "add" | "del" | "changed"
  type?: string
  description?: string
}

export interface ToolReview {
  name: string
  change: ToolChange
  /** Word-level diff of the description, approved → current. */
  diff: DiffPart[]
  params: ParamChange[]
  findings: ToolFinding[]
  risk: "danger" | "warn" | "ok"
  /** Short fingerprints of the approved and current definitions. */
  pinBefore?: string
  pinAfter?: string
}

const INJECTION: RegExp[] = [
  /<\s*\/?\s*(?:important|system|instructions?|secret|hidden|admin)\s*>/i,
  /\b(?:ignore|disregard|override)\s+(?:all\s+|any\s+)?(?:previous|prior|above|other|earlier)\b[^.]{0,30}/i,
  /\bdo\s+not\s+(?:tell|mention|inform|reveal|show|notify|alert)\b[^.]{0,40}/i,
  /\b(?:before|after|when)\s+(?:using|calling|you use|you call)\s+(?:this|any|the)\b[^.]{0,30}/i,
  /\bwithout\s+(?:asking|telling|informing|confirmation|notifying)\b[^.]{0,30}/i,
  /\b(?:you\s+)?must\s+(?:always\s+|first\s+)?(?:read|send|include|pass|call|attach|forward|bcc|cc)\b[^.]{0,40}/i,
  /\b(?:secretly|silently|quietly|covertly)\b[^.]{0,30}/i,
  /\b(?:bcc|cc|forward)\b[^.]{0,30}@[\w-]+\.[\w.]+/i,
]
const SECRET_PATH = /~\/\.ssh\b[^\s,.)]*|\bid_(?:rsa|ed25519|ecdsa)\b|(?:^|[\s/~"'`])\.env\b|\bmcp\.json\b|~\/\.cursor\b[^\s,)]*|\.aws\/credentials|\bcredentials\.json\b|\/etc\/(?:passwd|shadow)|\bprivate[ _]key\b|\.git-credentials|\.npmrc\b/i
const EXFIL_NAME = /^(?:side_?note|notes?|context|meta(?:data)?|extra|debug|feedback|summary|reasoning|details|content|payload|data|comment|annotation)$/i
// Zero-width, bidi overrides and isolates (Trojan Source), soft hyphen, Mongolian vowel separator, Unicode tags.
const HIDDEN = /[\u00AD\u034F\u180E\u200B-\u200F\u202A-\u202E\u2060-\u2069\uFEFF]|[\u{E0000}-\u{E007F}]/u
const HIDDEN_ALL = /[\u00AD\u034F\u180E\u200B-\u200F\u202A-\u202E\u2060-\u2069\uFEFF]|[\u{E0000}-\u{E007F}]/gu

/** Makes invisible characters visible: "⟨U+200B⟩". */
export function revealHidden(text: string): string {
  return text.replace(HIDDEN_ALL, (c) => `⟨U+${c.codePointAt(0)!.toString(16).toUpperCase().padStart(4, "0")}⟩`)
}

const canonical = (v: unknown): string =>
  Array.isArray(v) ? `[${v.map(canonical).join(",")}]` : v && typeof v === "object" ? `{${Object.keys(v as object).sort().map((k) => `${JSON.stringify(k)}:${canonical((v as Record<string, unknown>)[k])}`).join(",")}}` : JSON.stringify(v) ?? "null"

/** An 8-hex FNV-1a fingerprint of a tool's full definition, key order ignored. Pin it at approval; any change shows. */
export function toolHash(tool: McpTool | null | undefined): string {
  let h = 0x811c9dc5
  for (const ch of canonical(tool ?? null)) {
    h ^= ch.codePointAt(0)!
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h.toString(16).padStart(8, "0")
}

/** Word-level diff (LCS). Falls back to delete-all / add-all for very long texts to stay fast. */
export function wordDiff(a: string, b: string): DiffPart[] {
  const x = a.split(/(\s+)/).filter(Boolean)
  const y = b.split(/(\s+)/).filter(Boolean)
  const parts: DiffPart[] = []
  const push = (op: DiffPart["op"], text: string) => {
    const last = parts[parts.length - 1]
    if (last?.op === op) last.text += text
    else if (text) parts.push({ op, text })
  }
  if (x.length * y.length > 250_000) {
    push("del", a)
    push("add", b)
    return parts
  }
  const dp = Array.from({ length: x.length + 1 }, () => new Uint16Array(y.length + 1))
  for (let i = x.length - 1; i >= 0; i--) for (let j = y.length - 1; j >= 0; j--) dp[i][j] = x[i] === y[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1])
  let i = 0
  let j = 0
  while (i < x.length && j < y.length) {
    if (x[i] === y[j]) {
      push("same", x[i++])
      j++
    } else if (dp[i + 1][j] >= dp[i][j + 1]) push("del", x[i++])
    else push("add", y[j++])
  }
  while (i < x.length) push("del", x[i++])
  while (j < y.length) push("add", y[j++])
  return parts
}

/** Every string inside a definition (titles, nested property and enum descriptions, defaults, examples). */
const strings = (v: unknown, out: string[] = [], depth = 0): string[] => {
  if (depth > 12) return out
  if (typeof v === "string") out.push(v)
  else if (Array.isArray(v)) for (const x of v) strings(x, out, depth + 1)
  else if (v && typeof v === "object") for (const [k, x] of Object.entries(v as Record<string, unknown>)) {
    out.push(k)
    strings(x, out, depth + 1)
  }
  return out
}

/** MCP defaults: readOnlyHint false; destructiveHint true and openWorldHint true unless said otherwise. */
const effective = (t?: McpTool) => {
  const a = t?.annotations ?? {}
  const readOnly = a.readOnlyHint === true
  return { readOnly, destructive: !readOnly && a.destructiveHint !== false, openWorld: a.openWorldHint !== false }
}

const props = (t?: McpTool) => {
  const p = t?.inputSchema?.properties
  return p && typeof p === "object" ? p : {}
}

/** Checks text a server added to a tool for instructions aimed at the model rather than the person. */
function scanAdded(added: string, others: { server: string; name: string }[], self: string): ToolFinding[] {
  const out: ToolFinding[] = []
  for (const re of INJECTION) {
    const m = added.match(re)
    if (m) {
      out.push({ code: "injection", level: "danger", message: "Gives the AI orders it should never take from a tool description.", excerpt: m[0].trim() })
      break
    }
  }
  const path = added.match(SECRET_PATH)
  if (path) out.push({ code: "secret-path", level: "danger", message: "Mentions a file that holds keys or passwords.", excerpt: path[0].trim() })
  for (const o of others) {
    if (o.name === self) continue
    if (new RegExp(`\\b${o.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(added)) {
      out.push({ code: "shadowing", level: "danger", message: `Tries to change how ${o.name} from ${o.server} behaves.`, excerpt: o.name })
      break
    }
  }
  if (HIDDEN.test(added)) out.push({ code: "hidden-chars", level: "danger", message: "Contains characters people can't see but the AI reads." })
  return out
}

/**
 * Compares the tools a server lists now with the ones you approved (an MCP "rug pull" swaps them after
 * approval) and says what changed: a word diff of each description, parameters added or removed, and the
 * tells of tool poisoning in the new text — orders aimed at the AI (<IMPORTANT>, "do not tell the user"),
 * key and config files (~/.ssh, mcp.json), new free-text parameters that could carry data out (sidenote),
 * instructions about another server's tools (shadowing), invisible characters, and read-only labels that
 * flipped. Never throws.
 */
export function reviewTools(approved: McpTool[] | null | undefined, current: McpTool[] | null | undefined, opts: { otherTools?: { server: string; name: string }[] } = {}): ToolReview[] {
  const valid = (list: McpTool[] | null | undefined) => (Array.isArray(list) ? list.filter((t): t is McpTool => !!t && typeof t.name === "string") : [])
  const before = new Map(valid(approved).map((t) => [t.name, t]))
  const after = new Map(valid(current).map((t) => [t.name, t]))
  const others = Array.isArray(opts.otherTools) ? opts.otherTools : []
  const names = [...new Set([...before.keys(), ...after.keys()])]
  return names.map((name) => {
    const a = before.get(name)
    const b = after.get(name)
    const pinBefore = a ? toolHash(a) : undefined
    const pinAfter = b ? toolHash(b) : undefined
    const change: ToolChange = !a ? "added" : !b ? "removed" : pinBefore === pinAfter ? "same" : "changed"
    const da = typeof a?.description === "string" ? a.description : ""
    const db = typeof b?.description === "string" ? b.description : ""
    const diff = change === "same" ? [{ op: "same" as const, text: db }] : wordDiff(da, db)
    const pa = props(a)
    const pb = props(b)
    const params: ParamChange[] = []
    for (const k of Object.keys(pb)) {
      if (!(k in pa)) params.push({ name: k, op: "add", type: pb[k]?.type, description: pb[k]?.description })
      else if (canonical(pa[k]) !== canonical(pb[k])) params.push({ name: k, op: "changed", type: pb[k]?.type, description: pb[k]?.description })
    }
    for (const k of Object.keys(pa)) if (!(k in pb)) params.push({ name: k, op: "del", type: pa[k]?.type })

    const findings: ToolFinding[] = []
    if (b) {
      // Text the server added anywhere in the definition, not just the top description: poison often sits in a
      // nested property description, an enum, a default or the title, where a description diff never looks.
      const before = new Set(strings(a ? { ...a, description: undefined } : null))
      const deep = strings({ ...b, description: undefined }).filter((x) => !before.has(x))
      const addedText = [diff.filter((d) => d.op === "add").map((d) => d.text).join(" "), ...params.filter((p) => p.op !== "del").map((p) => p.description ?? ""), ...deep].join("\n")
      findings.push(...scanAdded(addedText, others, name))
      for (const p of params) {
        if (p.op === "add" && (EXFIL_NAME.test(p.name) || /\b(?:content|contents|full text|everything|all (?:messages|files|data))\b/i.test(p.description ?? "")) && (p.type ?? "string") === "string")
          findings.push({ code: "exfil-param", level: "danger", message: `New free-text field "${p.name}": a way to send your data out with every call.`, excerpt: p.name })
      }
      if (others.some((o) => o.name === name)) findings.push({ code: "name-clash", level: "warn", message: `Another server also has a tool called ${name}. The AI may call this one instead.` })
      const ea = effective(a)
      const eb = effective(b)
      if (a && ea.readOnly && !eb.readOnly) findings.push({ code: "hint-flip", level: "warn", message: "Used to say it only reads. Now it doesn't." })
      else if (a && !ea.readOnly && !ea.destructive && eb.destructive) findings.push({ code: "hint-flip", level: "warn", message: "Now says it can delete or overwrite things." })
      if (a && !ea.openWorld && eb.openWorld) findings.push({ code: "hint-flip", level: "warn", message: "Used to stay on this machine. Now it may reach the internet." })
      // Changes nobody can see in the description or top-level parameters still change the pin; say where.
      if (a && change === "changed" && !diff.some((d) => d.op !== "same") && !params.length && deep.length && !findings.length)
        findings.push({ code: "grew", level: "warn", message: "The description is the same, but text elsewhere in the definition changed.", excerpt: deep[0].slice(0, 80) })
      if (a && db.length > da.length * 3 && db.length - da.length > 200) findings.push({ code: "grew", level: "warn", message: `The description grew from ${da.length} to ${db.length} characters.` })
    }
    const dedup = findings.filter((f, i) => findings.findIndex((g) => g.code === f.code && g.message === f.message) === i)
    const risk = dedup.some((f) => f.level === "danger") ? "danger" : dedup.length ? "warn" : "ok"
    return { name, change, diff, params, findings: dedup, risk, pinBefore, pinAfter }
  })
}

/** Splits text into runs, marking the phrases that read as tool poisoning, for highlighting inside a diff. */
export function markDanger(text: string, otherNames: string[] = []): { text: string; danger: boolean }[] {
  const ranges: [number, number][] = []
  const names = otherNames.filter(Boolean).map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
  const all = [...INJECTION, SECRET_PATH, ...(names.length ? [new RegExp(`\\b(?:${names.join("|")})\\b`)] : [])]
  for (const re of all) for (const m of text.matchAll(new RegExp(re.source, re.flags.includes("g") ? re.flags : re.flags + "g"))) ranges.push([m.index, m.index + m[0].length])
  ranges.sort((a, b) => a[0] - b[0])
  const out: { text: string; danger: boolean }[] = []
  let at = 0
  for (const [s, e] of ranges) {
    if (e <= at) continue
    const from = Math.max(s, at)
    if (from > at) out.push({ text: text.slice(at, from), danger: false })
    out.push({ text: text.slice(from, e), danger: true })
    at = e
  }
  if (at < text.length) out.push({ text: text.slice(at), danger: false })
  return out
}
