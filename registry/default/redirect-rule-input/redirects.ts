/**
 * Redirect rule logic for RedirectRuleInput. Pure functions, safe on the server.
 *
 * Reads three formats and models how each platform matches:
 * - Vercel `vercel.json` "redirects" (first match wins; case-sensitive; no status means 308; the query string is passed on;
 *   `trailingSlash` adds its own 308 first). vercel.com/docs/project-configuration/vercel-json#redirects
 * - Netlify `_redirects` (first match wins; default 301; trailing slashes are ignored when matching; the query
 *   string is passed on only for 200/301/302; the docs say 307 is unsupported).
 *   docs.netlify.com/manage/routing/redirects/redirect-options
 * - nginx `rewrite` / `return` (server-level directives in order, then location selection: exact, longest prefix,
 *   regexes in order; `rewrite` keeps the query unless the replacement ends in "?"; `return` keeps it only if you
 *   add `$is_args$args`). nginx.org/en/docs/http/ngx_http_rewrite_module.html
 * Browsers resend a POST as GET after 301/302/303 and keep the method after 307/308 (Fetch standard, RFC 9110).
 */

export type RedirectFormat = "vercel" | "netlify" | "nginx"
export type RedirectMethod = "GET" | "POST"
type Span = [number, number]

export interface RedirectRule {
  /** Position in the file, 0-based. Issues and fixes point at rules by this index. */
  index: number
  /** 1-based line the rule starts on. */
  line: number
  source: string
  destination: string
  /** HTTP status sent. 0 means an internal nginx rewrite (no redirect). */
  status: number
  /** False when the status comes from the platform default. */
  explicitStatus: boolean
  /** Set when the rule only applies under a condition (has/missing, Country=, nginx if). */
  conditional?: string
}

interface Rule extends RedirectRule {
  regex: RegExp | null
  names: string[]
  refs: string[]
  scheme?: string
  host?: string
  query?: [string, string][]
  directive?: "rewrite" | "return"
  flag?: string
  server: number
  location: number
  condition?: string
  move?: { group: string; block: Span }
  spans: { source?: Span; destination?: Span; status?: Span; flag?: Span }
  object?: Record<string, unknown>
}

interface Location {
  mod: string
  path: string
  regex: RegExp | null
  items: number[]
}

interface Server {
  schemes: string[]
  names: string[]
  isDefault: boolean
  items: number[]
  locations: Location[]
}

export interface ParsedRedirects {
  format: RedirectFormat
  /** The text after BOM and CRLF clean-up; fixes return this shape. */
  text: string
  rules: RedirectRule[]
  /** Problems reading the text: `kind` is "json", "shape", "line" or "regex". */
  errors: { kind: "json" | "shape" | "line" | "regex"; line?: number; detail: string }[]
  /** Vercel `trailingSlash`, when the pasted vercel.json sets it. */
  trailingSlash?: boolean
  /** Hostnames the config itself names (nginx server_name, absolute Netlify sources). */
  hosts: string[]
}

interface Parsed extends ParsedRedirects {
  rules: Rule[]
  servers: Server[]
  root?: { value: unknown; list: Record<string, unknown>[]; fragment: boolean; indent: string }
}

const REDIRECT = new Set([301, 302, 303, 307, 308])
const TOKEN = /cuiq\d+z|4821\d+7/g
const escapeRe = (text: string) => text.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&")
const normalize = (text: string) => String(text ?? "").replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n")
const isLocal = (host: string) => /^(localhost|127\.\d+\.\d+\.\d+|\[::1\])(:|$)/i.test(host)
const stripSlash = (path: string) => (path.length > 1 && path.endsWith("/") ? path.replace(/\/+$/, "") || "/" : path)

function lineFinder(text: string) {
  const starts = [0]
  for (let i = 0; i < text.length; i++) if (text[i] === "\n") starts.push(i + 1)
  return (offset: number) => {
    let lo = 0
    let hi = starts.length - 1
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1
      if (starts[mid] <= offset) lo = mid
      else hi = mid - 1
    }
    return lo + 1
  }
}

function closeParen(text: string, open: number) {
  let depth = 0
  for (let i = open; i < text.length; i++) {
    if (text[i] === "\\") i++
    else if (text[i] === "(") depth++
    else if (text[i] === ")" && --depth === 0) return i
  }
  return text.length - 1
}

function regex(source: string, flags = "") {
  try {
    return new RegExp(source, flags)
  } catch {
    return null
  }
}

/** Guesses the format: JSON is Vercel, anything with rewrite/return/location statements is nginx, else Netlify. */
export function detectRedirectFormat(text: string): RedirectFormat {
  const clean = normalize(text).trim()
  if (/^[[{]/.test(clean)) return "vercel"
  if (/(^|[\s{;])(rewrite|return|location|server|server_name|listen)\s[^\n]*[;{]/m.test(clean)) return "nginx"
  return "netlify"
}

/* ---------------- Vercel ---------------- */

function compileVercel(source: string) {
  let out = ""
  const names: string[] = []
  const refs: string[] = []
  let i = 0
  const push = (name: string, pattern: string, mod: string, ref: string) => {
    const inner = pattern.replace(/\((?!\?)/g, "(?:")
    const body = mod === "*" || mod === "+" ? `(?:${inner})(?:/(?:${inner}))*` : inner
    if (out.endsWith("/") && (mod === "*" || mod === "?")) out = `${out.slice(0, -1)}(?:/(${body}))?`
    else out += mod === "*" || mod === "?" ? `(${body})?` : `(${body})`
    names.push(name)
    refs.push(ref)
  }
  while (i < source.length) {
    const char = source[i]
    if (char === "\\") {
      out += escapeRe(source[i + 1] ?? "")
      i += 2
    } else if (char === ":" && /[A-Za-z_]/.test(source[i + 1] ?? "")) {
      const name = /^[A-Za-z_]\w*/.exec(source.slice(i + 1))?.[0] ?? ""
      i += name.length + 1
      let pattern = "[^/]+"
      if (source[i] === "(") {
        const end = closeParen(source, i)
        pattern = source.slice(i + 1, end)
        i = end + 1
      }
      const mod = /[*+?]/.test(source[i] ?? "") ? source[i++] : ""
      push(name, pattern, mod, `:${name}${mod === "?" ? "" : mod}`)
    } else if (char === "(") {
      const end = closeParen(source, i)
      const pattern = source.slice(i + 1, end)
      i = end + 1
      const mod = /[*+?]/.test(source[i] ?? "") ? source[i++] : ""
      push(String(names.length), pattern, mod, "")
    } else {
      out += escapeRe(char)
      i++
    }
  }
  return { regex: regex(`^${out}$`), names, refs }
}

function parseVercel(text: string, parsed: Parsed) {
  let value: unknown
  let fragment = false
  const relaxed = text.replace(/,(\s*[}\]])/g, "$1")
  try {
    value = JSON.parse(relaxed)
  } catch (error) {
    try {
      value = JSON.parse(`[${relaxed.trim().replace(/,$/, "")}]`)
      fragment = true
    } catch {
      parsed.errors.push({ kind: "json", detail: error instanceof Error ? error.message : String(error) })
      return
    }
  }
  const record = value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : undefined
  const list = Array.isArray(value) ? value : Array.isArray(record?.redirects) ? (record.redirects as unknown[]) : null
  if (!list) {
    parsed.errors.push({ kind: "shape", detail: "redirects" })
    return
  }
  if (typeof record?.trailingSlash === "boolean") parsed.trailingSlash = record.trailingSlash
  const indent = /\n([ \t]+)\S/.exec(text)?.[1] ?? "  "
  parsed.root = { value, list: list as Record<string, unknown>[], fragment, indent }
  const lineOf = lineFinder(text)
  const keys = [...text.matchAll(/"source"\s*:/g)].map((match) => lineOf(match.index ?? 0))
  list.forEach((item, index) => {
    const object = item && typeof item === "object" ? (item as Record<string, unknown>) : {}
    const source = typeof object.source === "string" ? object.source : ""
    const destination = typeof object.destination === "string" ? object.destination : ""
    const line = keys[index] ?? 1
    if (!source || !destination) parsed.errors.push({ kind: "shape", line, detail: String(index + 1) })
    const code = typeof object.statusCode === "number" ? object.statusCode : object.permanent === false ? 307 : 308
    const absolute = /^(https?):\/\/([^/]+)(\/.*)?$/i.exec(source)
    const compiled = compileVercel(absolute ? absolute[3] || "/" : source || "\u0000")
    const conditions = ["has", "missing"].filter((key) => Array.isArray(object[key]) && (object[key] as unknown[]).length)
    parsed.rules.push({
      index,
      line,
      source,
      destination,
      status: code,
      explicitStatus: object.statusCode !== undefined || object.permanent !== undefined,
      conditional: conditions.length ? conditions.join(" + ") : undefined,
      ...compiled,
      scheme: absolute?.[1].toLowerCase(),
      host: absolute?.[2].toLowerCase(),
      server: 0,
      location: -1,
      move: { group: "list", block: [index, index] },
      spans: {},
      object,
    })
  })
}

/* ---------------- Netlify ---------------- */

function compileNetlify(path: string) {
  const names: string[] = []
  const refs: string[] = []
  let source = stripSlash(path)
  let tail = ""
  if (source.endsWith("/*")) {
    source = source.slice(0, -2)
    tail = "(?:/(.*))?"
  } else if (source === "*" || source === "/*") {
    source = ""
    tail = "(?:/(.*))?"
  }
  const body = source.replace(/:([A-Za-z_]\w*)|\*|[^:*]+/g, (match, name?: string) => {
    if (name) {
      names.push(name)
      refs.push(`:${name}`)
      return "([^/]+)"
    }
    if (match === "*") {
      names.push("splat")
      refs.push(":splat")
      return "(.*)"
    }
    return escapeRe(match)
  })
  if (tail) {
    names.push("splat")
    refs.push(":splat")
  }
  return { regex: regex(`^${body}${tail}$`), names, refs }
}

function parseNetlify(text: string, parsed: Parsed) {
  let offset = 0
  text.split("\n").forEach((raw, lineIndex) => {
    const start = offset
    offset += raw.length + 1
    const trimmed = raw.trim()
    if (!trimmed || trimmed.startsWith("#")) return
    const tokens = [...raw.matchAll(/\S+/g)].map((match) => ({ text: match[0], span: [start + (match.index ?? 0), start + (match.index ?? 0) + match[0].length] as Span }))
    const [from, ...rest] = tokens
    let cursor = 0
    const query: [string, string][] = []
    while (rest[cursor] && /^[^/:]+=/.test(rest[cursor].text) && !/^https?:/i.test(rest[cursor].text)) {
      const [key, ...value] = rest[cursor].text.split("=")
      query.push([key, value.join("=")])
      cursor++
    }
    const to = rest[cursor]
    if (!to || /^\d{3}!?$/.test(to.text) || (!/^(\/|https?:\/\/)/i.test(from.text) && !/^[\w.-]/.test(from.text))) {
      parsed.errors.push({ kind: "line", line: lineIndex + 1, detail: trimmed.slice(0, 80) })
      return
    }
    const statusToken = rest[cursor + 1] && /^\d{3}!?$/.test(rest[cursor + 1].text) ? rest[cursor + 1] : undefined
    const conditions = rest.slice(cursor + (statusToken ? 2 : 1)).map((token) => token.text)
    const absolute = /^(https?):\/\/([^/]+)(\/.*)?$/i.exec(from.text)
    const compiled = compileNetlify(absolute ? absolute[3] || "/" : from.text)
    const index = parsed.rules.length
    if (absolute) parsed.hosts.push(absolute[2].toLowerCase())
    parsed.rules.push({
      index,
      line: lineIndex + 1,
      source: from.text,
      destination: to.text,
      status: statusToken ? Number.parseInt(statusToken.text, 10) : 301,
      explicitStatus: !!statusToken,
      conditional: conditions.length ? conditions.join(" ") : undefined,
      ...compiled,
      scheme: absolute?.[1].toLowerCase(),
      host: absolute?.[2].toLowerCase(),
      query: query.length ? query : undefined,
      server: 0,
      location: -1,
      move: { group: "lines", block: [start, Math.min(offset, text.length + 1)] },
      spans: { source: from.span, destination: to.span, status: statusToken ? [statusToken.span[0], statusToken.span[0] + 3] : undefined },
    })
  })
}

/* ---------------- nginx ---------------- */

interface Token {
  text: string
  start: number
  end: number
  inner: Span
  kind: "word" | ";" | "{" | "}"
}

interface Statement {
  name: string
  args: Token[]
  start: number
  end: number
  children?: Statement[]
}

function tokenize(text: string) {
  const out: Token[] = []
  let i = 0
  while (i < text.length) {
    const char = text[i]
    if (/\s/.test(char)) i++
    else if (char === "#") while (i < text.length && text[i] !== "\n") i++
    else if (char === ";" || char === "{" || char === "}") {
      out.push({ text: char, start: i, end: i + 1, inner: [i, i + 1], kind: char })
      i++
    } else if (char === '"' || char === "'") {
      const start = i++
      while (i < text.length && text[i] !== char) i += text[i] === "\\" ? 2 : 1
      i = Math.min(i + 1, text.length)
      out.push({ text: text.slice(start + 1, i - 1), start, end: i, inner: [start + 1, i - 1], kind: "word" })
    } else {
      const start = i
      while (i < text.length && !/[\s;}]/.test(text[i]) && !(text[i] === "{" && /[\s]|^$/.test(text[i + 1] ?? ""))) i++
      out.push({ text: text.slice(start, i), start, end: i, inner: [start, i], kind: "word" })
    }
  }
  return out
}

function statements(tokens: Token[], at: { i: number }): Statement[] {
  const out: Statement[] = []
  let words: Token[] = []
  while (at.i < tokens.length) {
    const token = tokens[at.i++]
    if (token.kind === "word") words.push(token)
    else if (token.kind === ";" && words.length) {
      out.push({ name: words[0].text, args: words.slice(1), start: words[0].start, end: token.end })
      words = []
    } else if (token.kind === "{") {
      const head = words[0] ?? token
      const children = statements(tokens, at)
      out.push({ name: words[0]?.text ?? "", args: words.slice(1), start: head.start, end: tokens[at.i - 1]?.end ?? token.end, children })
      words = []
    } else if (token.kind === "}") break
  }
  if (words.length) out.push({ name: words[0].text, args: words.slice(1), start: words[0].start, end: words[words.length - 1].end })
  return out
}

/** Whole lines a statement occupies, when nothing else shares them; used to move rules. */
function wholeLines(text: string, start: number, end: number): Span | undefined {
  const lineStart = text.lastIndexOf("\n", start - 1) + 1
  const newline = text.indexOf("\n", end)
  const lineEnd = newline === -1 ? text.length : newline + 1
  if (text.slice(lineStart, start).trim() || text.slice(end, lineEnd).replace(/#.*/, "").trim()) return undefined
  return [lineStart, lineEnd]
}

function parseNginx(text: string, parsed: Parsed) {
  const lineOf = lineFinder(text)
  const tree = statements(tokenize(text), { i: 0 })
  const addRule = (statement: Statement, server: number, location: number, condition?: string) => {
    const [first, second, third] = statement.args
    const index = parsed.rules.length
    const block = !condition ? wholeLines(text, statement.start, statement.end) : undefined
    const base = { index, line: lineOf(statement.start), server, location, condition, conditional: condition ? `if (${condition})` : undefined }
    if (statement.name === "rewrite") {
      if (!first || !second) return parsed.errors.push({ kind: "line", line: base.line, detail: text.slice(statement.start, statement.end) })
      const flag = third?.text
      const absolute = /^(https?:\/\/|\$scheme)/.test(second.text)
      const status = flag === "permanent" ? 301 : flag === "redirect" || absolute ? 302 : 0
      const compiled = regex(first.text)
      if (!compiled) parsed.errors.push({ kind: "regex", line: base.line, detail: first.text })
      parsed.rules.push({
        ...base,
        source: first.text,
        destination: second.text,
        status,
        explicitStatus: !!flag,
        regex: compiled,
        names: [],
        refs: Array.from({ length: 9 }, (_, n) => `$${n + 1}`),
        directive: "rewrite",
        flag,
        move: block && location === -1 ? { group: `server-${server}`, block } : undefined,
        spans: { source: first.inner, destination: second.inner, flag: third?.inner },
      })
    } else {
      const coded = first && /^\d{3}$/.test(first.text)
      const code = coded ? Number.parseInt(first.text, 10) : first ? 302 : 444
      const url = coded ? second : first
      parsed.rules.push({
        ...base,
        source: "",
        destination: REDIRECT.has(code) ? (url?.text ?? "") : "",
        status: code,
        explicitStatus: !!coded,
        regex: null,
        names: [],
        refs: Array.from({ length: 9 }, (_, n) => `$${n + 1}`),
        directive: "return",
        move: block && location === -1 ? { group: `server-${server}`, block } : undefined,
        spans: { destination: url?.inner, status: coded ? first.inner : undefined },
      })
    }
  }
  const walkItems = (list: Statement[], server: number, location: number, items: number[], condition?: string) => {
    for (const statement of list) {
      if (statement.name === "rewrite" || statement.name === "return") {
        items.push(parsed.rules.length)
        addRule(statement, server, location, condition)
      } else if (statement.name === "if" && statement.children) {
        const text = statement.args.map((arg) => arg.text).join(" ").replace(/^\(\s*/, "").replace(/\s*\)$/, "")
        walkItems(statement.children, server, location, items, text)
      } else if (statement.name === "location" && statement.children) {
        const args = statement.args.map((arg) => arg.text)
        const mod = args.length > 1 ? args[0] : ""
        const path = args[args.length - 1] ?? ""
        const regexMod = mod === "~" || mod === "~*"
        const entry: Location = { mod, path, regex: regexMod ? regex(path, mod === "~*" ? "i" : "") : null, items: [] }
        const host = parsed.servers[server]
        host.locations.push(entry)
        const before = parsed.rules.length
        walkItems(statement.children, server, host.locations.length - 1, entry.items)
        const block = regexMod ? wholeLines(text, statement.start, statement.end) : undefined
        for (let rule = before; rule < parsed.rules.length; rule++) {
          const target = parsed.rules[rule]
          target.source ||= `location ${args.join(" ")}`
          target.spans.source ??= regexMod ? statement.args[statement.args.length - 1].inner : undefined
          if (block && target.location === host.locations.length - 1) target.move = { group: `regex-${server}`, block }
        }
      }
    }
  }
  const addServer = (body: Statement[], block = true) => {
    const server: Server = { schemes: [], names: [], isDefault: false, items: [], locations: [] }
    for (const statement of body) {
      if (statement.name === "listen") {
        const args = statement.args.map((arg) => arg.text)
        server.schemes.push(args.some((arg) => arg === "ssl" || /(^|:)443$/.test(arg)) ? "https" : "http")
        if (args.includes("default_server")) server.isDefault = true
      }
      if (statement.name === "server_name") server.names.push(...statement.args.map((arg) => arg.text.toLowerCase()))
    }
    // A server block without listen gets nginx's default, port 80 (plain http).
    if (block && !server.schemes.length) server.schemes.push("http")
    parsed.hosts.push(...server.names.filter((name) => /^[a-z0-9.-]+$/.test(name) && name.includes(".") && !name.startsWith(".")))
    parsed.servers.push(server)
    walkItems(body, parsed.servers.length - 1, -1, server.items)
  }
  const servers: Statement[][] = []
  const loose: Statement[] = []
  const collect = (list: Statement[]) => {
    for (const statement of list) {
      if (statement.name === "server" && statement.children) servers.push(statement.children)
      else if (statement.name === "http" && statement.children) collect(statement.children)
      else loose.push(statement)
    }
  }
  collect(tree)
  if (loose.some((statement) => ["rewrite", "return", "location", "if"].includes(statement.name))) addServer(loose, false)
  servers.forEach((body) => addServer(body))
}

/** Reads redirect rules from pasted text. Pass `format` to skip detection. Never throws. */
export function parseRedirects(text: string, format?: RedirectFormat): ParsedRedirects {
  return parse(text, format)
}

function parse(input: string, format?: RedirectFormat): Parsed {
  const text = normalize(input).slice(0, 200_000)
  const parsed: Parsed = { format: format ?? detectRedirectFormat(text), text, rules: [], errors: [], hosts: [], servers: [] }
  if (!text.trim()) return parsed
  if (parsed.format === "vercel") parseVercel(text, parsed)
  else if (parsed.format === "netlify") parseNetlify(text, parsed)
  else parseNginx(text, parsed)
  return parsed
}

/* ---------------- Matching one request ---------------- */

interface Step {
  status: number
  location?: URL
  rule?: number
  note?: "trailing-slash" | "https" | "rewrite" | "cycle"
}

function fillParams(destination: string, values: Record<string, string>) {
  return destination.replace(/(\/?):([A-Za-z_]\w*)([*+?])?/g, (match, slash: string, name: string) => {
    if (!(name in values)) return match
    return values[name] ? slash + values[name] : ""
  })
}

function toUrl(target: string, base: URL) {
  try {
    return new URL(target || "/", base)
  } catch {
    return undefined
  }
}

function mergeQuery(target: URL | undefined, search: string) {
  if (!target || !search) return target
  const merged = new URL(target.href)
  merged.search = [target.search.slice(1), search.slice(1)].filter(Boolean).join("&")
  return merged
}

function captureValues(rule: Rule, match: RegExpExecArray) {
  const values: Record<string, string> = {}
  rule.names.forEach((name, n) => (values[name] = match[n + 1] ?? ""))
  return values
}

function hostMatches(rule: Rule, url: URL) {
  return (!rule.host || rule.host === url.host.toLowerCase()) && (!rule.scheme || `${rule.scheme}:` === url.protocol)
}

function vercelStep(parsed: Parsed, url: URL, only?: number): Step | null {
  const path = url.pathname
  if (url.protocol === "http:" && !isLocal(url.host)) return { status: 308, location: new URL(url.href.replace(/^http:/, "https:")), note: "https" }
  if (parsed.trailingSlash === false && path !== "/" && path.endsWith("/")) return { status: 308, location: new URL(stripSlash(path) + url.search, url), note: "trailing-slash" }
  if (parsed.trailingSlash === true && !path.endsWith("/") && !/\.[^/]+$/.test(path)) return { status: 308, location: new URL(`${path}/${url.search}`, url), note: "trailing-slash" }
  for (const rule of parsed.rules) {
    if ((rule.conditional && only !== rule.index) || !hostMatches(rule, url)) continue
    const match = rule.regex?.exec(path)
    if (!match) continue
    return { status: rule.status, rule: rule.index, location: mergeQuery(toUrl(fillParams(rule.destination, captureValues(rule, match)), url), url.search) }
  }
  return null
}

function netlifyStep(parsed: Parsed, url: URL, only?: number): Step | null {
  const path = stripSlash(url.pathname)
  const params = [...url.searchParams.entries()]
  for (const rule of parsed.rules) {
    if ((rule.conditional && only !== rule.index) || !hostMatches(rule, url)) continue
    const match = rule.regex?.exec(path)
    if (!match) continue
    const values = captureValues(rule, match)
    if (rule.query) {
      if (params.length !== rule.query.length) continue
      const ok = rule.query.every(([key, value]) => {
        const found = params.find(([name]) => name === key)
        if (!found) return false
        if (value.startsWith(":")) values[value.slice(1)] = found[1]
        return value.startsWith(":") || value === found[1]
      })
      if (!ok) continue
    }
    const target = toUrl(fillParams(rule.destination, values), url)
    const keep = [200, 301, 302].includes(rule.status) && !rule.query
    if (rule.status === 200) return { status: 200, rule: rule.index, location: keep ? mergeQuery(target, url.search) : target, note: "rewrite" }
    if (!REDIRECT.has(rule.status)) return { status: rule.status, rule: rule.index }
    return { status: rule.status, rule: rule.index, location: keep ? mergeQuery(target, url.search) : target }
  }
  return null
}

function pickServer(parsed: Parsed, url: URL) {
  const scheme = url.protocol.slice(0, -1)
  const host = url.hostname.toLowerCase()
  const fits = parsed.servers.filter((server) => !server.schemes.length || server.schemes.includes(scheme))
  const named = (server: Server) => server.names.some((name) => name === host || (name.startsWith("*.") && host.endsWith(name.slice(1))) || (name.startsWith(".") && (host === name.slice(1) || host.endsWith(name))))
  // No server listens on this scheme: the request never reaches these rules.
  return fits.find(named) ?? fits.find((server) => server.isDefault) ?? fits[0]
}

function testCondition(condition: string, vars: Record<string, string>) {
  const match = /^\$(\w+)\s*(!=|=|!~\*|!~|~\*|~)\s*(.+)$/.exec(condition)
  if (!match) {
    const bare = /^\$(\w+)$/.exec(condition)
    return bare && bare[1] in vars ? !!vars[bare[1]] && vars[bare[1]] !== "0" : undefined
  }
  const [, name, op, raw] = match
  if (!(name in vars)) return undefined
  const value = vars[name]
  const operand = raw.replace(/^["']|["']$/g, "")
  if (op === "=" || op === "!=") return (value === operand) === (op === "=")
  const pattern = regex(operand, op.endsWith("*") ? "i" : "")
  return pattern ? pattern.test(value) === !op.startsWith("!") : undefined
}

function nginxStep(parsed: Parsed, url: URL, method: RedirectMethod, only?: number): Step | null {
  const server = pickServer(parsed, url)
  if (!server) return null
  let uri = safeDecode(url.pathname)
  let args = url.search.slice(1)
  let caps: string[] = []
  const vars = () => ({
    scheme: url.protocol.slice(0, -1), host: url.hostname, http_host: url.host, server_name: server.names[0] ?? url.hostname,
    request_uri: url.pathname + url.search, uri, document_uri: uri, args, query_string: args, is_args: args ? "?" : "", request_method: method,
  })
  const expand = (text: string) => {
    const known: Record<string, string> = vars()
    return text.replace(/\$(\d|\{\w+\}|[A-Za-z_]\w*)/g, (match, name: string) => {
      const key = name.replace(/[{}]/g, "")
      return /^\d$/.test(key) ? (caps[Number(key)] ?? "") : (known[key] ?? match)
    })
  }
  const run = (items: number[]): Step | "restart" | "stop" | null => {
    for (const index of items) {
      const rule = parsed.rules[index]
      if (rule.condition && only !== index && !testCondition(rule.condition, vars())) continue
      if (rule.directive === "return") {
        if (!REDIRECT.has(rule.status)) return { status: rule.status, rule: index }
        return { status: rule.status, rule: index, location: toUrl(expand(rule.destination), url) }
      }
      const match = rule.regex?.exec(uri)
      if (!match) continue
      caps = [...match]
      let target = expand(rule.destination)
      if (target.endsWith("?")) target = target.slice(0, -1)
      else if (args) target += (target.includes("?") ? "&" : "?") + args
      if (rule.status) return { status: rule.status, rule: index, location: toUrl(target, url) }
      const next = toUrl(target, url)
      uri = next ? safeDecode(next.pathname) : uri
      args = next ? next.search.slice(1) : args
      if (rule.flag === "last") return "restart"
      if (rule.flag === "break") return "stop"
    }
    return null
  }
  const first = run(server.items)
  if (first === "stop" || first === null || first === "restart") {
    if (first === "stop") return null
  } else return first
  for (let cycle = 0; cycle < 10; cycle++) {
    const found = selectLocation(server, uri)
    if (!found) return null
    caps = found.caps
    const result = run(found.location.items)
    if (result === "restart") continue
    return result === "stop" ? null : result
  }
  return { status: 500, note: "cycle" }
}

function selectLocation(server: Server, uri: string) {
  let best: Location | undefined
  for (const location of server.locations) {
    if (location.mod === "=" && location.path === uri) return { location, caps: [] as string[] }
    if ((location.mod === "" || location.mod === "^~") && uri.startsWith(location.path) && location.path.length > (best?.path.length ?? -1)) best = location
  }
  if (best?.mod !== "^~") {
    for (const location of server.locations) {
      const match = location.regex?.exec(uri)
      if (match) return { location, caps: [...match] }
    }
  }
  return best ? { location: best, caps: [] as string[] } : null
}

function safeDecode(path: string) {
  try {
    return decodeURIComponent(path)
  } catch {
    return path
  }
}

function step(parsed: Parsed, url: URL, method: RedirectMethod, only?: number) {
  if (parsed.format === "vercel") return vercelStep(parsed, url, only)
  if (parsed.format === "netlify") return netlifyStep(parsed, url, only)
  return nginxStep(parsed, url, method, only)
}

/* ---------------- Tracing ---------------- */

export interface TraceHop {
  from: string
  to: string
  status: number
  /** Rule index that sent it; undefined for the platform's own hops (trailing slash, HTTPS). */
  rule?: number
  note?: "trailing-slash" | "https"
  method: RedirectMethod
  /** The browser switches to GET for the next request (301/302/303 after a POST). */
  becomesGet?: boolean
}

export interface TraceResult {
  start: string
  hops: TraceHop[]
  /** served: nothing more redirects · rewrite: served from another path (Netlify 200) · status: a rule answered with a non-redirect code · loop · too-many · external · invalid · cycle (nginx rewrite cycle, 500) */
  outcome: "served" | "rewrite" | "status" | "loop" | "too-many" | "external" | "invalid" | "cycle"
  end: string
  /** Status of the final answer when a rule set it (404, 403, 200 rewrite, 500). */
  endStatus?: number
  endRule?: number
  /** Index in `hops` where the loop starts again. */
  loopsTo?: number
  method: RedirectMethod
}

export interface TraceOptions {
  method?: RedirectMethod
  /** Your site, for paths without a host. Default https://example.com. */
  origin?: string
  /** Other hostnames that are the same site (www, apex, old domains). */
  hosts?: string[]
}

function originOf(options: TraceOptions) {
  try {
    return new URL(options.origin || "https://example.com")
  } catch {
    return new URL("https://example.com")
  }
}

/** Turns "/old", "example.com/old" or a full URL into a URL on your site. */
export function resolveTraceUrl(input: string, origin?: string) {
  const base = originOf({ origin })
  const text = String(input ?? "").trim()
  if (!text) return undefined
  try {
    if (/^[a-z][a-z0-9+.-]*:\/\//i.test(text)) return new URL(text)
    if (text.startsWith("/")) return new URL(text, base)
    return new URL(`${base.protocol}//${text}`)
  } catch {
    return undefined
  }
}

const display = (url: URL, origin: URL) => (url.origin === origin.origin ? url.pathname + url.search : url.href)

function trace(parsed: Parsed, start: URL, options: TraceOptions, only?: number): TraceResult {
  const origin = originOf(options)
  const site = new Set([origin.host, ...(options.hosts ?? []), ...parsed.hosts].map((host) => host.toLowerCase()))
  let method: RedirectMethod = options.method ?? "GET"
  const result: TraceResult = { start: display(start, origin), hops: [], outcome: "served", end: display(start, origin), method }
  const seen = new Map<string, number>([[`${method} ${start.href}`, 0]])
  let current = start
  for (let count = 0; count < 21; count++) {
    const next = step(parsed, current, method, count === 0 ? only : undefined)
    if (!next) return { ...result, end: display(current, origin), method }
    if (next.note === "cycle") return { ...result, outcome: "cycle", end: display(current, origin), endStatus: 500, method }
    if (!next.location || next.note === "rewrite") {
      return { ...result, outcome: next.note === "rewrite" ? "rewrite" : "status", end: next.location ? display(next.location, origin) : display(current, origin), endStatus: next.status, endRule: next.rule, method }
    }
    const becomesGet = method === "POST" && [301, 302, 303].includes(next.status)
    result.hops.push({ from: display(current, origin), to: display(next.location, origin), status: next.status, rule: next.rule, note: next.note === "trailing-slash" || next.note === "https" ? next.note : undefined, method, becomesGet: becomesGet || undefined })
    if (becomesGet) method = "GET"
    current = next.location
    if (!site.has(current.host.toLowerCase())) return { ...result, outcome: "external", end: display(current, origin), method }
    const key = `${method} ${current.href}`
    if (seen.has(key)) return { ...result, outcome: "loop", loopsTo: seen.get(key), end: display(current, origin), method }
    seen.set(key, result.hops.length)
  }
  return { ...result, outcome: "too-many", end: display(current, origin), method }
}

/** Follows a URL through the rules hop by hop, the way a browser would, with GET or POST. */
export function traceRedirects(parsed: ParsedRedirects, input: string, options: TraceOptions = {}): TraceResult {
  const start = resolveTraceUrl(input, options.origin)
  if (!start) return { start: String(input ?? ""), hops: [], outcome: "invalid", end: String(input ?? ""), method: options.method ?? "GET" }
  return trace(parsed as Parsed, start, options)
}

/* ---------------- Samples: one URL each rule handles ---------------- */

function sampleRegex(pattern: string, tokens: boolean, counter: { n: number }): string {
  let out = ""
  let i = 0
  let last = ""
  const atom = (text: string) => {
    out += text
    last = text
  }
  while (i < pattern.length) {
    const char = pattern[i]
    if ((char === "^" && i === 0) || (char === "$" && i === pattern.length - 1)) i++
    else if (char === "|") break
    else if (char === "\\") {
      const next = pattern[i + 1] ?? ""
      atom({ d: "1", w: "a", s: "-", D: "a", W: "-", S: "a" }[next] ?? next)
      i += 2
    } else if (char === ".") {
      atom("a")
      i++
    } else if (char === "[") {
      let end = i + 1
      while (end < pattern.length && (pattern[end] !== "]" || end === i + 1)) end += pattern[end] === "\\" ? 2 : 1
      const body = pattern.slice(i + 1, end)
      const pick = body.startsWith("^") ? ["a", "x", "1", "-"].find((c) => !body.includes(c)) ?? "q" : body.replace(/^\\/, "")[0] ?? "a"
      atom(pick)
      i = end + 1
    } else if (char === "(") {
      const end = closeParen(pattern, i)
      let body = pattern.slice(i + 1, end)
      i = end + 1
      if (/^\?[=!]|^\?<[=!]/.test(body)) {
        last = ""
        continue
      }
      const capture = !body.startsWith("?") || /^\?P?<\w+>/.test(body)
      body = body.replace(/^\?(:|P?<\w+>)/, "")
      if (capture && tokens) atom(/\\d|\[0-9\]/.test(body) && !/[a-z]\]?/i.test(body.replace(/\\d|0-9/g, "")) ? `4821${counter.n++}7` : `cuiq${counter.n++}z`)
      else atom(sampleRegex(body, tokens, counter))
    } else if (char === "*" || char === "+" || char === "?") {
      i += pattern[i + 1] === "?" ? 2 : 1
    } else if (char === "{") {
      const end = pattern.indexOf("}", i)
      const min = Number.parseInt(pattern.slice(i + 1, end), 10)
      if (Number.isFinite(min) && min > 1) out += last.repeat(min - 1)
      i = end === -1 ? pattern.length : end + 1
    } else {
      atom(char)
      i++
    }
  }
  return out
}

interface Sample {
  url: URL
  tokens: [string, string][]
}

function sampleFor(parsed: Parsed, rule: Rule, origin: URL): Sample | null {
  let base = origin
  if (rule.host) base = new URL(`${rule.scheme ?? "https"}://${rule.host}`)
  if (parsed.format === "nginx") {
    const server = parsed.servers[rule.server]
    const name = server?.names.find((host) => /^[a-z0-9.-]+\.[a-z]+$/.test(host))
    const scheme = server?.schemes.length && !server.schemes.includes("https") ? "http" : "https"
    base = new URL(`${scheme}://${name ?? origin.host}`)
  }
  const counter = { n: 0 }
  const build = (path: string) => {
    if (!path.startsWith("/")) path = `/${path}`
    const url = toUrl(path, base)
    if (!url) return null
    const found = [...url.pathname.matchAll(TOKEN)].map((match) => match[0])
    return { url, found }
  }
  if (parsed.format === "nginx") {
    const location = rule.location >= 0 ? parsed.servers[rule.server].locations[rule.location] : undefined
    for (const tokens of [true, false]) {
      counter.n = 1
      let path = "/"
      if (rule.directive === "rewrite" && rule.regex) path = sampleRegex(rule.source, tokens, counter)
      else if (location?.regex) path = sampleRegex(location.path, tokens, counter)
      else if (location) path = location.path
      const built = build(path)
      if (!built) continue
      const uri = safeDecode(built.url.pathname)
      if (rule.directive === "rewrite" && !rule.regex?.test(uri)) continue
      if (location?.regex && rule.directive === "return" && !location.regex.test(uri)) continue
      return { url: built.url, tokens: built.found.map((token, n) => [token, `$${n + 1}`]) }
    }
    return null
  }
  if (!rule.regex) return null
  const pathPart = rule.host ? (/^https?:\/\/[^/]+(\/.*)?$/i.exec(rule.source)?.[1] ?? "/") : rule.source
  for (const digits of [false, true]) {
    let n = 0
    const tokens: [string, string][] = []
    const make = (ref: string) => {
      const token = digits ? `4821${n++}7` : `cuiq${n++}z`
      tokens.push([token, ref])
      return token
    }
    let path: string
    if (parsed.format === "netlify") {
      path = pathPart.replace(/:([A-Za-z_]\w*)|\*/g, (match, name?: string) => make(name ? `:${name}` : ":splat"))
    } else {
      let ref = 0
      path = pathPart.replace(/\\(.)|:([A-Za-z_]\w*)(\((?:[^()\\]|\\.|\([^()]*\))*\))?([*+?])?|\((?:[^()\\]|\\.|\([^()]*\))*\)([*+?])?/g, (match, escaped?: string, name?: string, _pattern?: string, mod?: string) => {
        if (escaped) return escaped
        const value = rule.refs[ref++] ?? ""
        return make(name ? value || `:${name}${mod === "?" ? "" : (mod ?? "")}` : value)
      })
    }
    const built = build(path)
    if (!built) continue
    const target = parsed.format === "netlify" ? stripSlash(built.url.pathname) : built.url.pathname
    if (rule.regex.test(target)) {
      const url = rule.query ? new URL(`${built.url.href}?${rule.query.map(([key, value]) => `${key}=${value.startsWith(":") ? make(value) : value}`).join("&")}`) : built.url
      return { url, tokens }
    }
  }
  return null
}

const withRefs = (text: string, tokens: [string, string][]) => tokens.reduce((out, [token, ref]) => out.split(token).join(ref || "…"), text)

/* ---------------- Checks ---------------- */

export type RedirectIssueKind =
  | "json" | "shape" | "line" | "regex" | "loop" | "slash-loop" | "chain" | "shadowed" | "insecure" | "permanent-temporary"
  | "default-permanent" | "method-change" | "method-netlify" | "netlify-status" | "netlify-query-status" | "query-dropped"
  | "rewrite-drops-args" | "slash-unreachable" | "slash-one-way" | "vercel-conflict" | "query-exact" | "truncated" | "too-many"
  | "source-slash" | "destination-slash" | "unknown-param" | "open-redirect" | "source-query" | "source-hash"

/** What a one-tap fix changes on one rule. Apply it with `applyRedirectFix`. */
export interface RedirectFix {
  rule: number
  destination?: string
  source?: string
  status?: number
  /** nginx rewrite flag, e.g. "redirect" for a temporary 302. */
  flag?: string
  /** Vercel: remove `permanent` when `statusCode` is set too. */
  dropPermanent?: boolean
  /** Move the rule so it sits just above this one. */
  moveBefore?: number
  /** Vercel: query conditions to add to `has` (used when a query was written into `source`). */
  has?: { type: "query"; key: string; value?: string }[]
}

export interface RedirectIssue {
  kind: RedirectIssueKind
  severity: "error" | "warning" | "info"
  rule?: number
  line?: number
  /** Filled into the message (a status, a rule's line, a path). */
  detail?: string
  /** The URLs a chain or loop goes through, first to last. */
  path?: string[]
  fix?: RedirectFix
  /** A URL that shows the problem in the tracer. */
  example?: string
}

export interface CheckOptions extends TraceOptions {
  /** Paths that look like temporary moves (sales, maintenance, launches). */
  temporaryPattern?: RegExp
  /** Paths that likely receive POSTs (APIs, forms, webhooks). */
  postPattern?: RegExp
}

export const TEMPORARY_PATTERN = /(^|[/._-])(sales?|promos?|promotion|offers?|deals?|black-?friday|cyber-?monday|holidays?|christmas|xmas|campaigns?|maintenance|outage|downtime|temp|temporary|tmp|beta|preview|coming-?soon|launch|events?|webinars?|seasonal|summer|winter|giveaway|contest|survey)(?=$|[/._?#\s-])/i
export const POST_PATTERN = /(^|[/^])(api|graphql|webhooks?|hooks|submit|checkout|forms?|subscribe|uploads?|payments?|token|rpc)(?=$|[/._?($\\])/i

function temporaryFix(parsed: Parsed, rule: Rule): RedirectFix | undefined {
  if (parsed.format === "vercel") return { rule: rule.index, status: rule.status === 301 ? 302 : 307 }
  if (parsed.format === "netlify") return { rule: rule.index, status: 302 }
  if (rule.directive === "rewrite") return rule.flag === "permanent" ? { rule: rule.index, flag: "redirect" } : undefined
  return { rule: rule.index, status: rule.status === 308 ? 307 : 302 }
}

/** Where the destination's host comes from the request (a placeholder, capture or request variable), anyone can build an off-site link. */
function isOpenRedirect(parsed: Parsed, rule: Rule) {
  const dest = rule.destination
  if (parsed.format === "nginx") {
    const risky = /\$(\d|arg_|cookie_|http_(?!host\b)|args\b|query_string\b|request_uri\b|uri\b|document_uri\b|request_body\b)/
    if (/^\$(?!scheme\b)/.test(dest) && risky.test(/^\$\S*/.exec(dest)?.[0] ?? "")) return true
    // $request_uri, $uri and $document_uri always start with "/", so they end the host.
    const host = /^(?:https?:|\$scheme:)?\/\/([^/?#]*)/.exec(dest)?.[1]?.split(/\$(?:request_uri|uri|document_uri)\b/)[0]
    return !!host && risky.test(host)
  }
  const host = /^(?:https?:)?\/\/([^/?#]*)/i.exec(dest)?.[1]
  return !!host && /:[A-Za-z_]/.test(host)
}

/** Placeholders the destination uses that the source never captures. */
function unknownParams(parsed: Parsed, rule: Rule) {
  const dest = rule.destination.replace(/^[a-z][a-z0-9+.-]*:\/\//i, "")
  if (parsed.format === "nginx") {
    const pattern = rule.directive === "rewrite" ? rule.source : parsed.servers[rule.server]?.locations[rule.location]?.regex ? parsed.servers[rule.server].locations[rule.location].path : undefined
    if (pattern === undefined) return []
    let groups = 0
    try {
      groups = (new RegExp(`${pattern}|`).exec("")?.length ?? 1) - 1
    } catch {
      return []
    }
    return [...new Set([...dest.matchAll(/\$(\d)/g)].map((m) => m[1]))].filter((n) => Number(n) > groups).map((n) => `$${n}`)
  }
  const known = new Set(rule.names)
  if (parsed.format === "netlify") rule.query?.forEach(([, value]) => value.startsWith(":") && known.add(value.slice(1)))
  if (parsed.format === "vercel") {
    for (const item of Array.isArray(rule.object?.has) ? (rule.object.has as Record<string, unknown>[]) : []) {
      if (typeof item?.value === "string") for (const m of item.value.matchAll(/\(\?<(\w+)>/g)) known.add(m[1])
      else if (typeof item?.key === "string") known.add(item.key)
    }
  }
  return [...new Set([...dest.matchAll(/:([A-Za-z_]\w*)/g)].map((m) => m[1]))].filter((name) => !known.has(name)).map((name) => `:${name}`)
}

/** A source that can never match: no leading slash, or a ?query / #fragment written into the path. */
function neverMatches(parsed: Parsed, rule: Rule): Omit<RedirectIssue, "rule" | "line"> | undefined {
  const source = rule.source
  if (parsed.format === "nginx") {
    const literal = rule.directive === "rewrite" ? /\\\?|\[\?\]/.test(source) : /^location\s+(=|\^~)?\s*\S*\?/.test(source)
    return literal ? { kind: "source-query", severity: "error" } : undefined
  }
  if (!rule.host && !source.startsWith("/")) return { kind: "source-slash", severity: "error", fix: { rule: rule.index, source: `/${source}` } }
  // Hide placeholders and groups so their modifiers (`:slug?`, `(a)?`) don't count as a query.
  const path = (rule.host ? (/^https?:\/\/[^/]+(.*)$/i.exec(source)?.[1] ?? "") : source).replace(/\\./g, "x").replace(/:[A-Za-z_]\w*(\((?:[^()\\]|\\.|\([^()]*\))*\))?[*+?]?/g, "p").replace(/\((?:[^()\\]|\\.|\([^()]*\))*\)[*+?]?/g, "g")
  const hash = path.indexOf("#")
  if (hash >= 0) return { kind: "source-hash", severity: "error", detail: source.slice(source.indexOf("#")), fix: { rule: rule.index, source: source.slice(0, source.indexOf("#")) || "/" } }
  if (!path.includes("?")) return undefined
  const at = source.indexOf("?", source.length - path.length + path.indexOf("?"))
  const [base, query] = [source.slice(0, at), source.slice(at + 1)]
  const pairs = query.split("&").filter(Boolean).map((pair) => pair.split("=")) as [string, string?][]
  if (!base || !pairs.length) return { kind: "source-query", severity: "error" }
  if (parsed.format === "netlify") return { kind: "source-query", severity: "error", fix: { rule: rule.index, source: `${base} ${pairs.map(([key, value]) => `${key}=${value ?? ""}`).join(" ")}` } }
  const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  return { kind: "source-query", severity: "error", fix: { rule: rule.index, source: base, has: pairs.map(([key, value]) => ({ type: "query" as const, key, ...(value ? { value: escape(value) } : {}) })) } }
}

/** Finds every problem in the parsed rules. Checks the first 300 rules in depth. */
export function checkRedirects(input: ParsedRedirects, options: CheckOptions = {}): RedirectIssue[] {
  const parsed = input as Parsed
  const origin = originOf(options)
  const temporary = options.temporaryPattern ?? TEMPORARY_PATTERN
  const posty = options.postPattern ?? POST_PATTERN
  const issues: RedirectIssue[] = parsed.errors.map((error) => ({ kind: error.kind, severity: error.kind === "regex" ? "warning" : "error", line: error.line, detail: error.detail }))
  const loops = new Set<string>()
  const rules = parsed.rules.slice(0, 300)
  if (parsed.rules.length > rules.length) issues.push({ kind: "truncated", severity: "info", detail: String(rules.length) })
  for (const rule of rules) {
    const add = (issue: Omit<RedirectIssue, "rule" | "line">) => issues.push({ ...issue, rule: rule.index, line: rule.line })
    const redirect = REDIRECT.has(rule.status)
    const dest = rule.destination
    if (!redirect && !(parsed.format === "netlify" && rule.status === 200)) continue
    const text = `${rule.source} ${dest}`
    if (redirect && isOpenRedirect(parsed, rule)) add({ kind: "open-redirect", severity: "error" })
    const unknown = unknownParams(parsed, rule)
    if (unknown.length) add({ kind: "unknown-param", severity: "error", detail: unknown.join(", ") })
    if (parsed.format !== "nginx" && dest && !/^(\/|[a-z][a-z0-9+.-]*:)/i.test(dest)) add({ kind: "destination-slash", severity: "error", fix: { rule: rule.index, destination: `/${dest}` } })
    const never = neverMatches(parsed, rule)
    if (never) {
      add(never)
      continue
    }
    if (redirect && /^http:\/\//i.test(dest) && !isLocal(dest.slice(7))) add({ kind: "insecure", severity: "error", fix: { rule: rule.index, destination: dest.replace(/^http:/i, "https:") } })
    if (parsed.format === "vercel" && rule.object?.statusCode !== undefined && rule.object?.permanent !== undefined) add({ kind: "vercel-conflict", severity: "error", fix: { rule: rule.index, dropPermanent: true } })
    const unsupported = parsed.format === "netlify" && (rule.status === 307 || rule.status === 308)
    if (unsupported) add({ kind: "netlify-status", severity: rule.status === 307 ? "error" : "warning", detail: String(rule.status), fix: { rule: rule.index, status: rule.status === 307 ? 302 : 301 } })
    if (redirect && (rule.status === 301 || rule.status === 308) && temporary.test(text)) {
      add({ kind: parsed.format === "vercel" && !rule.explicitStatus ? "default-permanent" : "permanent-temporary", severity: "warning", detail: String(rule.status), fix: temporaryFix(parsed, rule) })
    }
    if (redirect && (rule.status === 301 || rule.status === 302) && posty.test(rule.source)) {
      const keep = rule.status === 301 ? 308 : 307
      if (parsed.format === "netlify") add({ kind: "method-netlify", severity: "warning", detail: String(rule.status) })
      else add({ kind: "method-change", severity: "warning", detail: `${rule.status}→${keep}`, fix: rule.directive === "rewrite" ? undefined : { rule: rule.index, status: keep } })
    }
    if (parsed.format === "nginx" && redirect) {
      if (rule.directive === "return" && !/\$(request_uri|args|query_string|is_args|arg_\w+)/.test(dest)) {
        add({ kind: "query-dropped", severity: "warning", fix: dest.includes("?") ? undefined : { rule: rule.index, destination: `${dest}$is_args$args` } })
      }
      if (rule.directive === "rewrite" && dest.endsWith("?") && dest.length > 1) add({ kind: "rewrite-drops-args", severity: "info", fix: { rule: rule.index, destination: dest.slice(0, -1) } })
    }
    if (parsed.format === "netlify" && rule.status === 303) add({ kind: "netlify-query-status", severity: "warning", detail: "303" })
    if (parsed.format === "netlify" && rule.query) add({ kind: "query-exact", severity: "info", detail: rule.query.map(([key]) => key).join(", ") })
    // Trailing slashes.
    const literalEnd = (source: string) => source.length > 1 && /\/$/.test(source) && !/[*)]\/?$|:\w+[*+?]?\/?$/.test(source.slice(0, -1) + "x")
    let slashLoop = false
    if (parsed.format === "netlify" && redirect && !rule.host && dest.startsWith("/") && stripSlash(rule.source.split("?")[0]) === stripSlash(dest.split("?")[0])) {
      slashLoop = true
      add({ kind: "slash-loop", severity: "error" })
    }
    if (parsed.format === "vercel" && parsed.trailingSlash !== undefined && !rule.host) {
      const plain = !/[:()*]/.test(rule.source) && rule.source !== "/"
      if (plain && parsed.trailingSlash === false && rule.source.endsWith("/")) add({ kind: "slash-unreachable", severity: "warning", detail: "false", fix: { rule: rule.index, source: stripSlash(rule.source) } })
      if (plain && parsed.trailingSlash === true && !rule.source.endsWith("/") && !/\.[^/]+$/.test(rule.source)) add({ kind: "slash-unreachable", severity: "warning", detail: "true", fix: { rule: rule.index, source: `${rule.source}/` } })
    }
    if (parsed.format === "vercel" && parsed.trailingSlash === undefined && !rule.host && !/[:()*]/.test(rule.source) && literalEnd(rule.source)) {
      add({ kind: "slash-one-way", severity: "info", detail: rule.source })
    }
    if (parsed.format === "nginx" && rule.directive === "rewrite" && /[^?]\/\$$/.test(rule.source) && !/^\^\/\$$/.test(rule.source)) {
      const shown = rule.source.replace(/^\^/, "").replace(/\$$/, "")
      add({ kind: "slash-one-way", severity: "info", detail: shown, fix: { rule: rule.index, source: rule.source.replace(/\/\$$/, "/?$") } })
    }
    // Order, chains and loops: follow one URL this rule should handle.
    const sample = sampleFor(parsed, rule, origin)
    if (!sample) continue
    const first = step(parsed, sample.url, "GET", rule.index)
    const shownUrl = (url: string) => withRefs(url, sample.tokens)
    const example = display(sample.url, origin).replace(TOKEN, "example")
    if (first?.rule !== undefined && first.rule !== rule.index) {
      const other = parsed.rules[first.rule]
      const movable = rule.move && other.move && rule.move.group === other.move.group && other.index < rule.index
      add({ kind: "shadowed", severity: "warning", detail: String(other.line), example, fix: movable ? { rule: rule.index, moveBefore: other.index } : undefined })
      continue
    }
    if (first?.rule !== rule.index || !redirect) continue
    const result = trace(parsed, sample.url, { ...options, method: "GET" }, rule.index)
    const path = [result.start, ...result.hops.map((hop) => hop.to)].map(shownUrl)
    if (result.outcome === "too-many") {
      add({ kind: "too-many", severity: "error", path: path.slice(0, 4).concat("…"), example })
      continue
    }
    if (result.outcome === "loop") {
      const members = result.hops.slice(result.loopsTo ?? 0).map((hop) => hop.rule ?? -1)
      const key = [...new Set(members)].sort((a, b) => a - b).join(",")
      if (slashLoop || loops.has(key)) continue
      loops.add(key)
      add({ kind: "loop", severity: "error", path, example, detail: String(result.hops.length - (result.loopsTo ?? 0)) })
      continue
    }
    const counted = result.hops.filter((hop) => hop.note !== "https")
    if (counted.length < 2) continue
    const last = resolveTraceUrl(result.hops[result.hops.length - 1].to, options.origin)
    let collapsed: string | undefined
    if (last && !/\$(?!\d)/.test(dest)) {
      const relative = !/^(https?:|\$scheme)/i.test(dest) && last.origin === sample.url.origin
      const raw = relative ? last.pathname + last.search : last.href
      const mapped = withRefs(raw, sample.tokens)
      if (!mapped.includes("…") && !TOKEN.test(mapped)) collapsed = mapped
      TOKEN.lastIndex = 0
    }
    add({ kind: "chain", severity: "warning", path, example, detail: String(counted.length), fix: collapsed && collapsed !== dest ? { rule: rule.index, destination: collapsed } : undefined })
  }
  const order = { error: 0, warning: 1, info: 2 }
  return issues.sort((a, b) => (a.line ?? 0) - (b.line ?? 0) || order[a.severity] - order[b.severity])
}

/* ---------------- Fixes ---------------- */

function setVercelStatus(object: Record<string, unknown>, status: number) {
  if ((status === 307 || status === 308) && object.statusCode === undefined) object.permanent = status === 308
  else {
    delete object.permanent
    object.statusCode = status
  }
}

/** Applies one fix and returns the new text (BOM and CRLF are cleaned up). Unknown fixes return the text unchanged. */
export function applyRedirectFix(text: string, fix: RedirectFix, format?: RedirectFormat): string {
  const parsed = parse(text, format)
  const rule = parsed.rules[fix.rule]
  if (!rule) return parsed.text
  if (parsed.format === "vercel" && parsed.root && rule.object) {
    const object = rule.object
    if (fix.destination !== undefined) object.destination = fix.destination
    if (fix.source !== undefined) object.source = fix.source
    if (fix.status !== undefined) setVercelStatus(object, fix.status)
    if (fix.dropPermanent) delete object.permanent
    if (fix.has) object.has = [...(Array.isArray(object.has) ? object.has : []), ...fix.has]
    const list = parsed.root.list
    if (fix.moveBefore !== undefined && list[fix.moveBefore]) {
      list.splice(fix.rule, 1)
      list.splice(fix.moveBefore, 0, object)
    }
    const { indent } = parsed.root
    // Keep one-rule-per-line lists compact so the diff stays small.
    const compact = /\{[ \t]*"source"[^\n]*\}/.test(parsed.text)
    const line = (entry: Record<string, unknown>) => `{ ${Object.entries(entry).map(([key, field]) => `${JSON.stringify(key)}: ${JSON.stringify(field)}`).join(", ")} }`
    const marks = list.map((_, n) => `\u0000cui-${n}`)
    const value = !compact ? parsed.root.value : parsed.root.value === list ? marks : { ...(parsed.root.value as object), redirects: marks }
    const shell = parsed.root.fragment ? (compact ? marks.map((mark) => JSON.stringify(mark)).join(",\n") : list.map((entry) => JSON.stringify(entry, null, indent)).join(",\n")) : JSON.stringify(value, null, indent)
    const out = shell.replace(/"\\u0000cui-(\d+)"/g, (_, n: string) => line(list[Number(n)]))
    return parsed.text.endsWith("\n") ? `${out}\n` : out
  }
  const edits: [number, number, string][] = []
  const { spans } = rule
  if (fix.destination !== undefined && spans.destination) edits.push([...spans.destination, fix.destination])
  if (fix.source !== undefined && spans.source) edits.push([...spans.source, fix.source])
  if (fix.flag !== undefined && spans.flag) edits.push([...spans.flag, fix.flag])
  if (fix.status !== undefined) {
    if (spans.status) edits.push([...spans.status, String(fix.status)])
    else if (parsed.format === "netlify" && spans.destination) edits.push([spans.destination[1], spans.destination[1], ` ${fix.status}`])
    else if (spans.destination) edits.push([spans.destination[0], spans.destination[0], `${fix.status} `])
  }
  const target = fix.moveBefore !== undefined ? parsed.rules[fix.moveBefore] : undefined
  if (target?.move && rule.move && target.move.group === rule.move.group && target.move.block[0] < rule.move.block[0]) {
    let block = parsed.text.slice(...rule.move.block)
    if (!block.endsWith("\n")) block += "\n"
    const removeFrom = rule.move.block[0] > 0 && rule.move.block[1] >= parsed.text.length && !parsed.text.endsWith("\n") ? rule.move.block[0] - 1 : rule.move.block[0]
    edits.push([removeFrom, rule.move.block[1], ""], [target.move.block[0], target.move.block[0], block])
  }
  return edits.sort((a, b) => b[0] - a[0] || b[1] - a[1]).reduce((out, [start, end, value]) => out.slice(0, start) + value + out.slice(end), parsed.text)
}
