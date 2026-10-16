export interface LinkItem {
  /** The link's accessible name: its text, aria-label or image alt. */
  text: string
  href: string
  /** Sentence text before the link, used to suggest a rewrite. */
  before?: string
  /** Sentence text after the link. */
  after?: string
  /** Markdown offsets of the whole link, and of the sentence it sits in. */
  start?: number
  end?: number
  sentenceStart?: number
  sentenceEnd?: number
  /** Reference-style link label (`[text][ref]`); rewrites keep the reference. */
  ref?: string
  /** A linked image (`[![alt](img)](url)`): the alt text is the link text, so it is fixed in the image, not rewritten. */
  image?: boolean
  element?: HTMLElement
}

export type LinkIssue = "empty" | "generic" | "url" | "same-text"

export interface LinkCheck {
  issue?: LinkIssue
  /** Better link text, when one can be worked out. */
  suggestion?: string
  /** Markdown edit that applies the suggestion (rewrites the sentence around "click here"). */
  edit?: { from: number; to: number; insert: string }
  /** Where the other links with this text go (same-text). */
  others?: string[]
}

/** Link text that means nothing out of context (WCAG F84). Lowercase, without punctuation. */
export const GENERIC_LINK_TEXT = [
  "click here", "click", "here", "tap here", "this", "this link", "link", "read more", "learn more", "more",
  "more info", "more information", "details", "see more", "find out more", "continue", "continue reading",
  "go", "download", "info", "website", "this page", "page", "here's how",
]

const LINK = new RegExp(
  [
    String.raw`\[!\[(?<alt>[^\]\n]*)\]\([^)\n]*\)\]\(\s*<?(?<imageHref>[^)\s>]*)>?(?:\s+"[^"]*")?\s*\)`,
    String.raw`(?<bang>!?)\[(?<text>[^\]\n]*)\]\(\s*<?(?<href>[^)\s>]*)>?(?:\s+"[^"]*")?\s*\)`,
    String.raw`(?<refBang>!?)\[(?<refText>[^\]\n]+)\]\[(?<ref>[^\]\n]*)\]`,
    String.raw`<(?<angle>https?:\/\/[^>\s]+)>`,
    String.raw`(?<bare>https?:\/\/[^\s<>()[\]]*[^\s<>()[\].,;:!?'"])`,
  ].join("|"),
  "g",
)
const DEFINITION = /^ {0,3}\[([^\]\n]+)\]:[ \t]*<?([^\s>]+)>?.*$/gm
const blank = (text: string) => text.replace(/[^\n]/g, " ")
/** Blanks code (fenced blocks and inline spans) and link definitions, keeping offsets, so nothing inside them reads as a link. */
const maskCode = (markdown: string) =>
  markdown
    .replace(/^ {0,3}(`{3,}|~{3,})[^\n]*\n[\s\S]*?(?:^ {0,3}\1[^\n]*$|(?![\s\S]))/gm, blank)
    .replace(/(`+)(?!`)[\s\S]*?(?<!`)\1(?!`)/g, blank)
    .replace(DEFINITION, blank)
/** The Markdown for a link with new text, in the same style it was written; null when it can't be rewritten in place. */
const markup = (link: LinkItem, text: string) => (link.image ? null : link.ref !== undefined ? `[${text}][${link.ref}]` : `[${text}](${link.href})`)
const normal = (text: string) => text.toLowerCase().replace(/[\s\u00a0]+/g, " ").replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "")
const capital = (text: string) => text.charAt(0).toUpperCase() + text.slice(1)

/** Strips tracking parameters, a trailing slash and host case so the same page compares equal. */
export function normalizeHref(href: string) {
  try {
    const url = new URL(href, "https://relative.invalid")
    ;[...url.searchParams.keys()].filter((k) => /^(utm_|fbclid|gclid)/.test(k)).forEach((k) => url.searchParams.delete(k))
    const host = url.host === "relative.invalid" ? "" : url.host.replace(/^www\./, "")
    return `${host}${url.pathname.replace(/\/$/, "")}${url.search}${url.hash}` || "/"
  } catch {
    return href
  }
}

/** Is this link text just a URL (beyond a short bare domain like devtushar.tech)? */
export function isUrlText(text: string, href = "") {
  const t = text.trim()
  if (!/^(https?:\/\/|www\.)\S+$/i.test(t) && normalizeHref(t) !== normalizeHref(href)) return false
  const bare = t.replace(/^https?:\/\//i, "").replace(/^www\./i, "").replace(/\/$/, "")
  return bare.includes("/") || bare.includes("?") || bare.length > 24
}

/** Readable words from a URL: /reports/annual-report-2026.pdf → "Annual report 2026 (PDF)". */
export function describeHref(href: string) {
  const contact = href.match(/^(?:mailto|tel):([^?]+)/i)?.[1]
  if (contact) return decodeURIComponent(contact)
  try {
    const url = new URL(href, "https://relative.invalid")
    const host = url.host === "relative.invalid" ? "" : url.host.replace(/^www\./, "")
    const segment = decodeURIComponent(url.pathname.split("/").filter(Boolean).pop() ?? "")
    const ext = segment.match(/\.(pdf|docx?|xlsx?|csv|zip)$/i)?.[1]
    const words = segment
      .replace(/\.[a-z0-9]+$/i, "")
      .split(/[-_+]+/)
      .filter((w) => !(w.length >= 6 && /\d/.test(w) && /[a-z]/i.test(w)) && !/^[0-9a-f]{8,}$/i.test(w))
      .join(" ")
      .trim()
    // One-letter or numeric slugs ("/b", "/2041") say nothing; the site's name is better, or nothing at all.
    if (words.replace(/\s/g, "").length < 3 || /^\d+$/.test(words)) return host
    return `${capital(words)}${ext ? ` (${ext.toUpperCase()})` : ""}`
  } catch {
    return ""
  }
}

/** Finds Markdown links ([text](url), <url> and bare URLs, which GFM turns into links) with their sentence around them. */
export function linksFromMarkdown(markdown: string): LinkItem[] {
  const out: LinkItem[] = []
  const definitions = new Map([...markdown.matchAll(DEFINITION)].map((d) => [d[1].trim().toLowerCase(), d[2]]))
  for (const m of maskCode(markdown).matchAll(LINK)) {
    const g = m.groups ?? {}
    if (g.bang || g.refBang) continue
    const ref = g.refText === undefined ? undefined : g.ref
    const refHref = ref === undefined ? undefined : definitions.get((ref || g.refText).trim().toLowerCase())
    if (ref !== undefined && refHref === undefined) continue
    const start = m.index
    const end = start + m[0].length
    const sentenceStart = Math.max(0, ...[". ", "! ", "? ", "\n"].map((s) => {
      const at = markdown.lastIndexOf(s, start - 1)
      return at < 0 ? 0 : at + s.length
    }))
    const stop = markdown.slice(end).search(/[.!?](\s|$)|\n/)
    const sentenceEnd = stop < 0 ? markdown.length : end + stop
    const text = g.alt ?? g.text ?? g.refText ?? g.angle ?? g.bare
    const href = g.imageHref ?? g.href ?? refHref ?? g.angle ?? g.bare
    out.push({ text, href, start, end, sentenceStart, sentenceEnd, before: markdown.slice(sentenceStart, start), after: markdown.slice(end, sentenceEnd), ref, image: g.alt !== undefined || undefined })
  }
  return out
}

const hidden = (el: Element) =>
  !!el.closest("[hidden],[aria-hidden=true]") || (el instanceof HTMLElement && !!el.checkVisibility && !el.checkVisibility({ visibilityProperty: true }))

/** Text a screen reader reads for an element's content: skips hidden parts, uses image alt and SVG titles. */
function contentName(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? ""
  if (!(node instanceof Element) || node.matches("[hidden],[aria-hidden=true]") || (node instanceof HTMLElement && node.checkVisibility && !node.checkVisibility())) return ""
  const label = node.getAttribute("aria-label")
  if (label && node !== node.closest("a")) return ` ${label} `
  if (node instanceof HTMLImageElement) return ` ${node.alt} `
  if (node.localName === "svg") return ` ${node.querySelector("title")?.textContent ?? ""} `
  const inline = node instanceof HTMLElement && /^(inline|contents)/.test(getComputedStyle(node).display)
  const inner = [...node.childNodes].map(contentName).join("")
  return inline ? inner : ` ${inner} `
}

/** The link's accessible name, close to what browsers compute: aria-labelledby, aria-label, content, then title. */
export function accessibleLinkName(a: HTMLElement) {
  const ids = a.getAttribute("aria-labelledby")?.split(/\s+/).filter(Boolean) ?? []
  const labelled = ids.map((id) => a.ownerDocument.getElementById(id)?.textContent ?? "").join(" ")
  const name = labelled.trim() || a.getAttribute("aria-label")?.trim() || contentName(a).trim() || a.getAttribute("title") || ""
  return name.replace(/\s+/g, " ").trim()
}

/** Reads the links inside an element as a screen reader names them, skipping hidden ones and this checker itself. */
export function linksFromElement(root: HTMLElement): LinkItem[] {
  return [...root.querySelectorAll<HTMLAnchorElement>("a[href]")]
    .filter((a) => !hidden(a) && !a.closest("[data-slot=link-text-check]"))
    .map((a) => {
      const text = accessibleLinkName(a)
      const block = a.closest("p,li,td,dd,blockquote") ?? a.parentElement
      const full = block?.textContent ?? ""
      const at = full.indexOf(a.textContent ?? "")
      const before = at < 0 ? "" : full.slice(0, at).split(/[.!?]\s/).pop()
      const after = at < 0 ? "" : full.slice(at + (a.textContent ?? "").length).split(/[.!?](\s|$)/)[0]
      return { text, href: a.getAttribute("href") ?? "", before, after, element: a }
    })
}

/** Lifts the words that explain a vague link into the link: "To download the report, [click here](…)" → "[Download the report](…)". */
function rewrite(link: LinkItem): Pick<LinkCheck, "suggestion" | "edit"> {
  const lead = link.before?.match(/^\s*(?:to|if you(?:'d| would)? (?:like|want) to|you can|please|for)\s+(?:the\s+)?(.+?)[\s,:;–-]*(?:please\s*)?$/i)
  const tail = link.after?.match(/^\s*to\s+(.+?)\s*$/i)
  const words = lead?.[1] ?? tail?.[1]
  if (!words || words.split(" ").length > 12) {
    const fromUrl = describeHref(link.href)
    const insert = fromUrl ? markup(link, fromUrl) : null
    return fromUrl ? { suggestion: fromUrl, edit: link.start === undefined || !insert ? undefined : { from: link.start, to: link.end!, insert } } : {}
  }
  const suggestion = capital(words)
  const insert = markup(link, suggestion)
  if (link.start === undefined || !insert) return { suggestion }
  const before = link.before!
  const indent = before.length - before.trimStart().length
  const fromSentence = !!lead || /^\s*(please\s*)?$/i.test(before)
  const from = fromSentence ? link.sentenceStart! + indent : link.start
  return { suggestion, edit: { from, to: lead ? link.end! : link.sentenceEnd!, insert } }
}

/** Checks each link's text against WCAG 2.4.4: vague text, URLs as text, empty links, and one text for two destinations. */
export function checkLinks(links: LinkItem[], genericText: string[] = GENERIC_LINK_TEXT): LinkCheck[] {
  const generic = new Set(genericText.map(normal))
  const targets = new Map<string, Set<string>>()
  links.forEach((l) => targets.set(normal(l.text), (targets.get(normal(l.text)) ?? new Set()).add(normalizeHref(l.href))))
  return links.map((link): LinkCheck => {
    const text = normal(link.text)
    const edit = (suggestion: string) => {
      const insert = suggestion && link.start !== undefined ? markup(link, suggestion) : null
      return insert ? { from: link.start!, to: link.end!, insert } : undefined
    }
    if (!text) {
      const suggestion = describeHref(link.href) || undefined
      return { issue: "empty", suggestion, edit: suggestion ? edit(suggestion) : undefined }
    }
    if (generic.has(text)) return { issue: "generic", ...rewrite(link) }
    if (isUrlText(link.text, link.href)) {
      const suggestion = describeHref(link.href)
      return { issue: "url", suggestion: suggestion || undefined, edit: edit(suggestion) }
    }
    const places = targets.get(text)!
    if (places.size > 1) return { issue: "same-text", others: [...places].filter((p) => p !== normalizeHref(link.href)) }
    return {}
  })
}
