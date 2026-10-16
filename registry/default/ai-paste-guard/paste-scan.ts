/** How a passage was hidden from the person pasting it. */
export type HiddenKind = "comment" | "display" | "transparent" | "tiny" | "same-color" | "offscreen" | "clipped" | "attribute" | "tags"

export interface HiddenPassage {
  kind: HiddenKind
  /** The hidden text, decoded (tag characters turned back into ASCII). */
  text: string
  /** For "attribute": which one (alt, title, aria-label). */
  attribute?: string
  /** Phrases that read like instructions to an AI ("ignore previous instructions"). */
  injection: string[]
  /** True when this text is also in the plain-text flavour a textarea would receive. */
  inPlainText: boolean
}

export interface PasteScan {
  /** What the person could actually see, as plain text. */
  visibleText: string
  hidden: HiddenPassage[]
  /** Any passage reads like a prompt injection. */
  injection: boolean
  /**
   * Which page background same-colour text was judged against: the one you passed, white, or a dark one inferred
   * because most of the paste's text is light (copied from a dark-mode page, where Safari and Firefox don't put the
   * background on the clipboard).
   */
  background: "given" | "light" | "inferred-dark"
}

const INJECTION: RegExp[] = [
  /\b(ignore|disregard|forget|override)\b[^.\n]{0,30}\b(previous|prior|above|earlier|all|any|your)\b[^.\n]{0,20}\b(instructions?|prompts?|rules|messages|context)\b/i,
  /\byou are now\b|\bfrom now on\b|\bact as (an?|the)\b|\bpretend (to be|you)\b/i,
  /\b(system|developer) (prompt|message|instructions?)\b|\bnew instructions?\b/i,
  /\b(do not|don't|never) (tell|mention|reveal|show|inform)\b[^.\n]{0,20}\b(the )?(user|human|reader)\b/i,
  /\bif you are an? (ai|llm|language model|assistant|chatbot|agent)\b|\b(ai|llm|assistant|chatbot|agent)s?\b[^.\n]{0,15}\b(must|should|reading this)\b/i,
  /\b(send|forward|post|upload|exfiltrate|include)\b[^.\n]{0,40}\b(to|at|in)\b[^.\n]{0,10}https?:\/\//i,
  /!\[[^\]]*\]\(https?:\/\/[^)]*[?&][^)]*\)/i,
  /<\|im_start\|>|<\|system\|>|\[\/?INST\]|^\s*(system|assistant)\s*:/im,
  /\b(respond|reply|answer) only (with|in)\b|\brecommend\b[^.\n]{0,40}\b(as the best|above all|instead of)\b/i,
]

/** Phrases in `text` that read like instructions aimed at an AI model. */
export function findInjection(text: string) {
  const hits: string[] = []
  for (const re of INJECTION) {
    const m = String(text ?? "").match(re)
    if (m) hits.push(m[0].trim())
  }
  return hits
}

/** Unicode tag characters (U+E0000–U+E007F) mirror ASCII invisibly; this reads them back. */
export function decodeTagCharacters(text: string) {
  let hidden = ""
  let visible = ""
  for (const ch of String(text ?? "")) {
    const cp = ch.codePointAt(0) ?? 0
    if (cp >= 0xe0000 && cp <= 0xe007f) {
      if (cp >= 0xe0020 && cp <= 0xe007e) hidden += String.fromCharCode(cp - 0xe0000)
    } else visible += ch
  }
  return { hidden, visible }
}

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", "#39": "'" }
const decode = (s: string) =>
  s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+\d*);/gi, (m, e: string) => {
    if (e[0] === "#") {
      const cp = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)
      return Number.isFinite(cp) && cp >= 0 && cp <= 0x10ffff ? String.fromCodePoint(cp) : m
    }
    return ENTITIES[e.toLowerCase()] ?? m
  })

type Style = Record<string, string>
const parseStyle = (css: string): Style => {
  const out: Style = {}
  for (const decl of css.split(";")) {
    const i = decl.indexOf(":")
    if (i > 0) out[decl.slice(0, i).trim().toLowerCase()] = decl.slice(i + 1).replace(/!important/i, "").trim().toLowerCase()
  }
  return out
}

/** Parses a colour into [r, g, b, a]; undefined for names and functions it doesn't know. */
function rgba(value?: string): [number, number, number, number] | undefined {
  if (!value) return undefined
  const v = value.trim()
  if (NAMED[v]) return NAMED[v]
  const hex = v.match(/^#([0-9a-f]{3,8})$/)
  if (hex) {
    const h = hex[1].length <= 4 ? [...hex[1]].map((c) => c + c).join("") : hex[1]
    const n = (i: number) => parseInt(h.slice(i, i + 2), 16)
    return [n(0), n(2), n(4), h.length === 8 ? n(6) / 255 : 1]
  }
  const fn = v.match(/^rgba?\(([^)]+)\)$/)
  if (fn) {
    const parts = fn[1].split(/[\s,/]+/).filter(Boolean)
    const channel = (p: string) => (p.endsWith("%") ? (parseFloat(p) / 100) * 255 : parseFloat(p))
    const alpha = (p?: string) => (p === undefined ? 1 : p.endsWith("%") ? parseFloat(p) / 100 : parseFloat(p))
    const [r, g, b] = parts.slice(0, 3).map(channel)
    const a = alpha(parts[3])
    if ([r, g, b, a].every(Number.isFinite)) return [r, g, b, a]
  }
  const hsl = v.match(/^hsla?\(([^)]+)\)$/)
  if (hsl) {
    const [h, sat, light, alpha] = hsl[1].split(/[\s,/]+/).filter(Boolean)
    const hue = parseFloat(h), s = parseFloat(sat) / 100, l = parseFloat(light) / 100
    const a = alpha === undefined ? 1 : alpha.endsWith("%") ? parseFloat(alpha) / 100 : parseFloat(alpha)
    const f = (n: number) => {
      const k = (n + hue / 30) % 12
      return 255 * (l - s * Math.min(l, 1 - l) * Math.max(-1, Math.min(k - 3, 9 - k, 1)))
    }
    if ([hue, s, l, a].every(Number.isFinite)) return [f(0), f(8), f(4), a]
  }
  return undefined
}

const NAMED: Record<string, [number, number, number, number]> = {
  transparent: [0, 0, 0, 0], white: [255, 255, 255, 1], black: [0, 0, 0, 1], snow: [255, 250, 250, 1], whitesmoke: [245, 245, 245, 1],
  ivory: [255, 255, 240, 1], ghostwhite: [248, 248, 255, 1], floralwhite: [255, 250, 240, 1], azure: [240, 255, 255, 1], mintcream: [245, 255, 250, 1],
}

/** The colour inside a `background` shorthand ("rgb(13, 17, 23) none repeat scroll 0% 0%"). */
const backgroundColor = (style: Style) =>
  rgba(style["background-color"]) ?? rgba(style.background?.match(/#[0-9a-f]{3,8}\b|(?:rgba?|hsla?)\([^)]*\)|\b[a-z]+\b/)?.[0])

/** WCAG relative luminance, 0 (black) to 1 (white). */
const luminance = ([r, g, b]: [number, number, number, number]) => {
  const c = (v: number) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)
  return 0.2126 * c(r) + 0.7152 * c(g) + 0.0722 * c(b)
}

// Below 1.25:1 contrast text is effectively invisible (#f0f0f0 on white, #222 on #121212); body text sits far above it.
const near = (a: [number, number, number, number], b: [number, number, number, number]) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05) < 1.25
}
const px = (v?: string) => {
  const m = v?.match(/^(-?[\d.]+)(px|pt|em|rem|%)?$/)
  if (!m) return undefined
  const n = parseFloat(m[1])
  return m[2] === "pt" ? n * 1.333 : m[2] === "em" || m[2] === "rem" ? n * 16 : m[2] === "%" ? (n / 100) * 16 : n
}

/** Why a style hides its text, given the background it sits on; undefined when it doesn't. */
function hiddenBy(style: Style, background: [number, number, number, number]): HiddenKind | undefined {
  if (style.display === "none" || style.visibility === "hidden" || style.visibility === "collapse") return "display"
  if (style.opacity !== undefined && parseFloat(style.opacity) <= 0.05) return "transparent"
  const color = rgba(style.color)
  // Gradient headings paint their text through the background (color: transparent + background-clip: text).
  const clipText = /\btext\b/.test(`${style["background-clip"] ?? ""} ${style["-webkit-background-clip"] ?? ""}`)
  if (color && color[3] <= 0.05 && !clipText) return "transparent"
  const size = px(style["font-size"])
  if (size !== undefined && size <= 1) return "tiny"
  if (color && near(color, background)) return "same-color"
  const left = px(style.left), top = px(style.top), indent = px(style["text-indent"])
  if ((style.position === "absolute" || style.position === "fixed") && ((left ?? 0) <= -500 || (top ?? 0) <= -500)) return "offscreen"
  if ((indent ?? 0) <= -500) return "offscreen"
  if (/rect\(\s*0/.test(style.clip ?? "") || /inset\(\s*50%/.test(style["clip-path"] ?? "") || /scale\(\s*0(\s|,|\))/.test(style.transform ?? "")) return "clipped"
  if ((px(style.width) === 0 || px(style.height) === 0 || px(style["max-height"]) === 0) && style.overflow === "hidden") return "clipped"
  return undefined
}

/** Reads simple `.class`, `#id` and tag rules out of <style> blocks, as Word and some CMSs emit. */
function readRules(html: string) {
  const rules: { selector: string; style: Style }[] = []
  for (const block of html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)) {
    const css = block[1].replace(/\/\*[\s\S]*?\*\//g, "").replace(/<!--|-->/g, "")
    for (const rule of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      const style = parseStyle(rule[2])
      for (const selector of rule[1].split(",")) rules.push({ selector: selector.trim().toLowerCase(), style })
    }
  }
  return rules
}

const VOID = new Set(["br", "img", "hr", "input", "meta", "link", "wbr", "source", "col", "area", "base", "embed", "track"])
const BLOCK = new Set(["p", "div", "li", "tr", "h1", "h2", "h3", "h4", "h5", "h6", "blockquote", "pre", "section", "article", "header", "footer", "table", "ul", "ol"])
const SKIP = new Set(["script", "style", "template", "noscript", "head", "title", "xml"])
// Comments the clipboard itself adds (Windows CF_HTML markers, Word conditional comments) and the markers frameworks
// leave in server-rendered pages (WordPress blocks, React/Vue/Angular/Svelte/Nuxt hydration) are not content.
const NOISE_COMMENT = /^\s*(StartFragment|EndFragment|\[if [^\]]*\]>[\s\S]*<!\[endif\]|\[endif\]|\[if [^\]]*\]|\/?wp:[\s\S]*|\/?\$[!?]?|\[|\]|v-if|v-show|ng-container|bindings=[\s\S]*|ngIf:[\s\S]*|[a-z0-9]{0,12}|\/?(?:ko|htmlmin:ignore|esi)[\s\S]*)\s*$/i

const WHITE: [number, number, number, number] = [255, 255, 255, 1]
const DARK: [number, number, number, number] = [18, 18, 18, 1]
type Color = [number, number, number, number]

/** Words of prose in a passage; fragments of a word or two are too short to steer a model. */
const words = (text: string) => text.split(/\s+/).filter((w) => /\p{L}{2,}/u.test(w)).length

function walk(source: string, plainText: string, page: Color, explicitPage: boolean) {
  const rules = readRules(source)
  const hidden: HiddenPassage[] = []
  const flat = plainText.replace(/\s+/g, " ")
  const tally = { light: 0, dark: 0 }
  const add = (kind: HiddenKind, raw: string, attribute?: string) => {
    const { hidden: tags, visible } = decodeTagCharacters(decode(raw))
    const text = visible.replace(/\s+/g, " ").trim()
    if (tags.trim()) add("tags", tags)
    if (kind === "tags") {
      hidden.push({ kind, text: raw.trim(), injection: findInjection(raw), inPlainText: /[\u{E0000}-\u{E007F}]/u.test(plainText) })
      return
    }
    const injection = findInjection(text)
    // Screen-reader-only text ("opens in a new tab", "Skip to content") is clipped or off-screen on purpose.
    const minWords = kind === "clipped" || kind === "offscreen" ? 6 : 3
    if (kind === "attribute" ? !injection.length : !injection.length && words(text) < minWords) return
    hidden.push({ kind, text, attribute, injection, inPlainText: !!text && flat.includes(text.slice(0, 40)) })
  }

  type Frame = { tag: string; hidden?: HiddenKind; background: Color; explicit: boolean; color?: Color; text: string }
  const stack: Frame[] = [{ tag: "#root", background: page, explicit: explicitPage, text: "" }]
  let visible = ""
  const re = /<!--([\s\S]*?)(?:-->|$)|<(\/?)([a-zA-Z][\w:-]*)((?:[^>"']|"[^"]*"|'[^']*')*)>|([^<]+|<)/g
  let skipUntil = ""
  for (const m of source.matchAll(re)) {
    const top = stack[stack.length - 1]
    if (skipUntil) {
      if (m[2] === "/" && m[3]?.toLowerCase() === skipUntil) skipUntil = ""
      continue
    }
    if (m[1] !== undefined) {
      if (!NOISE_COMMENT.test(m[1])) add("comment", m[1])
      continue
    }
    if (m[5] !== undefined) {
      // Tally light and dark text sitting on a background nobody declared, to tell a dark-mode copy from white-on-white.
      // Text with no colour of its own is the source's default ink, which is dark on a page that declares nothing.
      if (!top.explicit && (!top.color || top.color[3] > 0.5)) {
        const n = m[5].replace(/\s+/g, "").length
        const l = top.color ? luminance(top.color) : 0
        if (l > 0.5) tally.light += n
        else if (l < 0.2) tally.dark += n
      }
      if (top.hidden) top.text += m[5]
      else {
        const { hidden: tags, visible: shown } = decodeTagCharacters(decode(m[5]))
        if (tags.trim()) add("tags", tags)
        visible += shown
      }
      continue
    }
    const tag = m[3].toLowerCase()
    if (m[2] === "/") {
      const at = stack.map((f) => f.tag).lastIndexOf(tag)
      if (at <= 0) continue
      for (const frame of stack.splice(at).reverse()) {
        const parent = stack[stack.length - 1]
        if (frame.hidden && !parent.hidden) add(frame.hidden, frame.text)
        else if (frame.hidden) parent.text += frame.text
      }
      if (BLOCK.has(tag)) visible += "\n"
      continue
    }
    if (SKIP.has(tag)) {
      if (!/\/\s*$/.test(m[4])) skipUntil = tag
      continue
    }
    const attrs: Record<string, string> = {}
    for (const a of m[4].matchAll(/([^\s=/]+)(?:\s*=\s*("([^"]*)"|'([^']*)'|[^\s>]+))?/g)) attrs[a[1].toLowerCase()] = a[3] ?? a[4] ?? a[2] ?? ""
    for (const name of ["alt", "title", "aria-label"]) if (attrs[name]) add("attribute", attrs[name], name)
    if (tag === "br") (top.hidden ? (top.text += " ") : (visible += "\n"))
    if (VOID.has(tag) || /\/\s*$/.test(m[4])) continue
    const classes = (attrs.class ?? "").toLowerCase().split(/\s+/).filter(Boolean)
    const style: Style = {}
    for (const r of rules) if (r.selector === tag || classes.some((c) => r.selector === `.${c}` || r.selector === `${tag}.${c}`) || (attrs.id && r.selector === `#${attrs.id.toLowerCase()}`)) Object.assign(style, r.style)
    Object.assign(style, parseStyle(attrs.style ?? ""))
    const bg = backgroundColor(style)
    const own = !!bg && bg[3] > 0.5
    const background = own ? bg : top.background
    const why = top.hidden ?? ("hidden" in attrs ? "display" : hiddenBy(style, background))
    if (BLOCK.has(tag) && !why) visible += "\n"
    stack.push({ tag, hidden: why, background, explicit: own || top.explicit, color: rgba(style.color) ?? top.color, text: "" })
  }
  for (const frame of stack.splice(1).reverse()) if (frame.hidden && !stack[stack.length - 1]?.hidden) add(frame.hidden, frame.text)
  return { hidden, visible, tally }
}

/**
 * Finds what a rich-text paste carries that the person couldn't see: HTML comments, display:none, zero-size,
 * transparent and same-colour-as-background text, off-screen and clipped elements, instructions in alt/title/aria-label,
 * and Unicode tag-character payloads. `plain` is the text/plain flavour, used to say what a plain textarea would get.
 * Without `background`, a paste whose text is mostly (over two thirds) light on an undeclared background is read as copied from a
 * dark-mode page, so its light text isn't flagged; any light passage that reads like an injection still is.
 * Fragments under three words that don't read like instructions are ignored. Pure string work, so it also runs on the server.
 */
export function scanPaste(html: string, plain = "", options: { background?: string; maxLength?: number } = {}): PasteScan {
  const max = options.maxLength ?? 500_000
  const source = String(html ?? "").replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n").slice(0, max)
  const plainText = String(plain ?? "").replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n").slice(0, max)
  const given = rgba(options.background)
  let result = walk(source, plainText, given ?? WHITE, !!given)
  let background: PasteScan["background"] = given ? "given" : "light"
  if (!given && result.tally.light > 2 * result.tally.dark) {
    const onLight = result.hidden
    result = walk(source, plainText, DARK, false)
    background = "inferred-dark"
    // Making hidden text the majority must not flip it to "visible": keep any light-on-white passage that steers the AI.
    for (const h of onLight) if (h.kind === "same-color" && h.injection.length && !result.hidden.some((r) => r.text === h.text)) result.hidden.push(h)
  }
  const hidden = result.hidden

  // A plain-text paste with no HTML can still carry a tag-character payload.
  if (!source && plainText) {
    const { hidden: tags } = decodeTagCharacters(plainText)
    if (tags.trim()) hidden.push({ kind: "tags", text: tags.trim(), injection: findInjection(tags), inPlainText: true })
  }
  const base = source ? result.visible : plainText
  const visibleText = decodeTagCharacters(base).visible.replace(/[ \t\u00a0]+/g, " ").replace(/ *\n */g, "\n").replace(/\n{3,}/g, "\n\n").trim()
  return { visibleText, hidden, injection: hidden.some((h) => h.injection.length > 0), background }
}
