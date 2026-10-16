/**
 * A small JSON checker that, unlike JSON.parse, reports the same exact position in every browser
 * and recognises the classic hand-editing mistakes so each can be fixed in one step.
 */

export type JsonMistake = "trailing-comma" | "quotes" | "unquoted-key" | "comment" | "python" | "missing-comma" | "unclosed"

export interface JsonIssue {
  message: string
  /** UTF-16 offset of the problem. */
  index: number
  /** 1-based. */
  line: number
  /** 1-based. */
  column: number
  /** Set when the mistake is one `fixJson` can repair. */
  mistake?: JsonMistake
}

type Token = { type: "str" | "comment" | "punct" | "word" | "ws" | "bad"; start: number; end: number; quote?: string; closed?: boolean }

const OPEN_QUOTES: Record<string, string> = { '"': '"', "'": "'", "“": "”“", "”": "”“", "„": "”“", "‘": "’‘", "’": "’‘", "‚": "’‘" }
const NUMBER = /^-?(0|[1-9]\d*)(\.\d+)?([eE][+-]?\d+)?$/
const PYTHON: Record<string, string> = { True: "true", False: "false", None: "null" }

/** Splits text into JSON-ish tokens, tolerating comments, single and smart quotes, and bare words. */
function lex(text: string): Token[] {
  const tokens: Token[] = []
  let i = 0
  while (i < text.length) {
    const start = i
    const ch = text[i]
    if (/[ \t\n\r]/.test(ch)) {
      while (i < text.length && /[ \t\n\r]/.test(text[i])) i++
      tokens.push({ type: "ws", start, end: i })
    } else if (text.startsWith("//", i) || text.startsWith("/*", i)) {
      const end = ch === "/" && text[i + 1] === "/" ? text.indexOf("\n", i) : text.indexOf("*/", i + 2) + 2
      i = end <= 1 || end === -1 ? text.length : end
      tokens.push({ type: "comment", start, end: i })
    } else if (OPEN_QUOTES[ch]) {
      const closers = OPEN_QUOTES[ch]
      i++
      while (i < text.length && !closers.includes(text[i]) && text[i] !== "\n") i += text[i] === "\\" ? 2 : 1
      const closed = i < text.length && closers.includes(text[i])
      if (closed) i++
      tokens.push({ type: "str", start, end: Math.min(i, text.length), quote: ch, closed })
    } else if ("{}[]:,".includes(ch)) {
      tokens.push({ type: "punct", start, end: ++i })
    } else if (/[^\s{}[\]:,"'“”„‘’‚/]/.test(ch)) {
      while (i < text.length && /[^\s{}[\]:,"'“”„‘’‚/]/.test(text[i])) i++
      tokens.push({ type: "word", start, end: i })
    } else {
      tokens.push({ type: "bad", start, end: ++i })
    }
  }
  return tokens
}

/** 1-based line and column of a UTF-16 offset. */
export function lineColumn(text: string, index: number) {
  const before = text.slice(0, index)
  const line = before.split("\n").length
  return { line, column: index - before.lastIndexOf("\n") }
}

class Stop {
  constructor(public message: string, public index: number, public mistake?: JsonMistake) {}
}

/** Returns the first problem in `text`, or null when it is valid JSON (or empty). */
export function checkJson(text: string): JsonIssue | null {
  if (!text.trim()) return null
  const tokens = lex(text).filter((t) => t.type !== "ws")
  const raw = (t: Token) => text.slice(t.start, t.end)
  const opened: Token[] = []
  let p = 0

  const unexpected = (t: Token | undefined, expected: string): never => {
    if (!t) {
      const open = opened[opened.length - 1]
      if (open) throw new Stop(`The ${raw(open)} on line ${lineColumn(text, open.start).line} is never closed.`, text.length, "unclosed")
      throw new Stop("The JSON ends too early.", text.length)
    }
    if (t.type === "comment") throw new Stop("JSON doesn’t allow comments.", t.start, "comment")
    if (t.type === "str" && t.quote !== '"') throw new Stop(`Use straight double quotes (") for strings, not ${t.quote}.`, t.start, "quotes")
    if (t.type === "word" && PYTHON[raw(t)]) throw new Stop(`${raw(t)} isn’t JSON; write ${PYTHON[raw(t)]}.`, t.start, "python")
    throw new Stop(`Expected ${expected} here.`, t.start)
  }

  const value = (): void => {
    const t = tokens[p]
    if (t?.type === "punct" && (raw(t) === "{" || raw(t) === "[")) return container(t)
    if (t?.type === "str" && t.quote === '"') {
      if (!t.closed) throw new Stop("This string is never closed.", t.start)
      try {
        JSON.parse(raw(t))
      } catch {
        throw new Stop("This string has an invalid escape or a raw tab or control character.", t.start)
      }
      p++
      return
    }
    if (t?.type === "word" && (NUMBER.test(raw(t)) || ["true", "false", "null"].includes(raw(t)))) {
      p++
      return
    }
    unexpected(t, "a value")
  }

  const container = (open: Token) => {
    const isObject = raw(open) === "{"
    const close = isObject ? "}" : "]"
    opened.push(open)
    p++
    let afterComma: Token | null = null
    for (;;) {
      const t = tokens[p]
      if (t?.type === "punct" && raw(t) === close) {
        if (afterComma) throw new Stop(`Remove the comma before ${close}.`, afterComma.start, "trailing-comma")
        break
      }
      if (isObject) {
        const next = tokens[p + 1]
        if (t?.type === "word" && next?.type === "punct" && raw(next) === ":") throw new Stop("Property names need double quotes.", t.start, "unquoted-key")
        if (t?.type !== "str" || t.quote !== '"') unexpected(t, `a "property name" or ${close}`)
        value()
        const colon = tokens[p]
        if (colon?.type !== "punct" || raw(colon) !== ":") unexpected(colon, ": after the property name")
        p++
      }
      value()
      const sep = tokens[p]
      if (sep?.type === "punct" && raw(sep) === ",") {
        afterComma = sep
        p++
      } else if (sep?.type === "punct" && raw(sep) === close) {
        break
      } else if (sep && (sep.type === "str" || sep.type === "word" || raw(sep) === "{" || raw(sep) === "[")) {
        throw new Stop(`Missing comma before ${raw(sep).slice(0, 12)}.`, tokens[p - 1].end, "missing-comma")
      } else {
        unexpected(sep, `, or ${close}`)
      }
      if (afterComma && tokens[p] !== undefined && !(tokens[p].type === "punct" && raw(tokens[p]) === close)) afterComma = null
    }
    opened.pop()
    p++
  }

  try {
    value()
    const extra = tokens[p]
    if (extra?.type === "punct" && "}]".includes(raw(extra))) throw new Stop(`There’s an extra ${raw(extra)} with nothing to close.`, extra.start)
    if (extra) unexpected(extra, "the end of the JSON")
    JSON.parse(text) // Belt and braces: anything this checker missed still surfaces.
    return null
  } catch (error) {
    const stop = error instanceof Stop ? error : new Stop(error instanceof Error ? error.message : String(error), 0)
    return { message: stop.message, index: stop.index, ...lineColumn(text, stop.index), mistake: stop.mistake }
  }
}

/** Repairs every occurrence of one classic mistake, leaving string contents untouched. */
export function fixJson(text: string, mistake: JsonMistake): string {
  const tokens = lex(text)
  const raw = (t: Token) => text.slice(t.start, t.end)
  const sig = tokens.filter((t) => t.type !== "ws" && t.type !== "comment")
  const nextSig = (t: Token) => sig[sig.indexOf(t) + 1]

  if (mistake === "unclosed") {
    const stack: string[] = []
    for (const t of sig) {
      if (t.type !== "punct") continue
      const c = raw(t)
      if (c === "{" || c === "[") stack.push(c === "{" ? "}" : "]")
      else if (c === "}" || c === "]") stack.pop()
    }
    const sep = text.includes("\n") ? "\n" : ""
    return text.trimEnd() + stack.reverse().map((c) => sep + c).join("")
  }

  if (mistake === "comment") {
    let out = text
    for (const t of tokens.filter((x) => x.type === "comment").reverse()) {
      const lineStart = text.lastIndexOf("\n", t.start - 1) + 1
      const ownLine = !text.slice(lineStart, t.start).trim() && (t.end === text.length || text[t.end] === "\n")
      // A comment on its own line takes the line with it; a trailing one takes the spaces before it.
      const from = ownLine ? lineStart : t.start - (text.slice(lineStart, t.start).match(/[ \t]*$/)?.[0].length ?? 0)
      out = out.slice(0, from) + out.slice(ownLine && t.end < text.length ? t.end + 1 : t.end)
    }
    return out
  }

  return tokens.map((t) => {
    const s = raw(t)
    switch (mistake) {
      case "quotes": {
        if (t.type !== "str" || t.quote === '"') return s
        const body = s.slice(1, t.closed ? -1 : undefined).replace(/\\'/g, "'").replace(/(^|[^\\])"/g, '$1\\"')
        return `"${body}"`
      }
      case "unquoted-key":
        return t.type === "word" && raw(nextSig(t) ?? t) === ":" ? `"${s}"` : s
      case "python":
        return t.type === "word" && PYTHON[s] ? PYTHON[s] : s
      case "trailing-comma": {
        const next = t.type === "punct" && s === "," ? nextSig(t) : undefined
        return next && (raw(next) === "}" || raw(next) === "]") ? "" : s
      }
      case "missing-comma": {
        const next = nextSig(t)
        const endsValue = t.type === "str" || t.type === "word" || s === "}" || s === "]"
        const startsValue = next && (next.type === "str" || next.type === "word" || raw(next) === "{" || raw(next) === "[")
        const isKey = t.type === "str" && raw(nextSig(t) ?? t) === ":"
        return endsValue && startsValue && !isKey ? s + "," : s
      }
      default:
        return s
    }
  }).join("")
}
