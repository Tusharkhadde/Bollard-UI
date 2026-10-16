// Bollard UI — markdown-check · MIT licence · https://bollard-ui.vercel.app/components/markdown-check

/** Every kind of Markdown slip `checkMarkdown` reports. */
export type MarkdownMistake =
  | "unclosed-code"
  | "unclosed-bold"
  | "bold-space"
  | "link-space"
  | "empty-link"
  | "link-no-text"
  | "link-url-space"
  | "missing-ref"
  | "heading-space"
  | "stripped-html"

/** How the problem span will look once rendered: shown as raw text, gone, or an invisible link. */
export type MarkdownLook = "literal" | "removed" | "invisible"

export interface MarkdownIssue {
  mistake: MarkdownMistake
  message: string
  /** Offset of the problem span in the source. */
  index: number
  length: number
  /** 1-based line and column. */
  line: number
  column: number
  look: MarkdownLook
  /** Edits that fix it, last in the text first. Absent when only the writer can fix it. */
  fix?: { from: number; to: number; insert: string }[]
}

/** Tags GitHub-style sanitizers keep. Anything else is stripped from the rendered output. */
export const DEFAULT_ALLOWED_TAGS = [
  "a", "b", "br", "code", "del", "details", "em", "i", "img", "kbd", "p", "pre", "s",
  "strong", "sub", "summary", "sup", "u",
]

/** Tags whose content disappears along with them. */
const CONTENT_TAGS = ["script", "style", "iframe", "object", "embed", "template", "textarea", "form", "svg"]

/** Blanks out a range so later rules don't look inside it, keeping every offset intact. */
const blank = (text: string, from: number, to: number) => text.slice(0, from) + " ".repeat(to - from) + text.slice(to)

/**
 * Finds what will render differently from how it reads: unclosed `**` or backticks, a space
 * after `**`, `[text] (url)`, links with no address or text, spaces in addresses, undefined
 * `[text][ref]`s, `#Title` with no space and raw HTML the sanitizer will strip. Fenced code is
 * ignored and inline code is masked, so code samples never trigger a warning.
 */
export function checkMarkdown(source: string, allowedTags: string[] = DEFAULT_ALLOWED_TAGS): MarkdownIssue[] {
  const issues: Omit<MarkdownIssue, "line" | "column">[] = []
  const refs = new Set([...source.matchAll(/^ {0,3}\[([^\]]+)\]:\s*\S/gm)].map((m) => m[1].toLowerCase()))
  const lineEnd = (at: number) => (source.indexOf("\n", at) + 1 || source.length + 1) - 1

  // Mask fenced code blocks, then split what's left into paragraphs (runs of non-blank lines).
  let text = source.replace(/^ {0,3}(`{3,}|~{3,})[^\n]*\n[\s\S]*?(?:^ {0,3}\1[^\n]*$|(?![\s\S]))/gm, (m) => m.replace(/[^\n]/g, " "))
  for (const para of text.matchAll(/(?:^[^\n]*\S[^\n]*(?:\n|$))+/gm)) {
    const start = para.index
    // Backtick runs pair with the next run of the same length (CommonMark code spans).
    const runs = [...para[0].matchAll(/(?<!\\)`+/g)]
    for (let i = 0; i < runs.length; i++) {
      const j = runs.findIndex((r, k) => k > i && r[0].length === runs[i][0].length)
      const from = start + runs[i].index
      if (j < 0) {
        // Close it after the word it opens: inline code is almost always one token.
        const word = source.slice(from).match(/^`+[^\s`]*/)![0].length
        const end = word > runs[i][0].length ? Math.min(lineEnd(from), from + word) : lineEnd(from)
        issues.push({ mistake: "unclosed-code", message: "This backtick is never closed, so the code shows as plain text.", index: from, length: runs[i][0].length, look: "literal", fix: [{ from: end, to: end, insert: runs[i][0] }] })
        continue
      }
      text = blank(text, from, start + runs[j].index + runs[j][0].length)
      runs.splice(i + 1, j - i)
    }
  }

  // `**` pairs on its own line: an unclosed one would otherwise swallow the paragraph.
  let lineAt = 0
  for (const line of text.split("\n")) {
    let open: number | null = null
    for (const m of line.matchAll(/(?<![\\*])\*\*(?!\*)/g)) {
      const at = lineAt + m.index
      const canOpen = /\S/.test(line[m.index + 2] ?? "")
      const canClose = m.index > 0 && /\S/.test(line[m.index - 1])
      if (open !== null && canClose) open = null
      else if (canOpen) open = at
      else if (open === null && !canClose && /^\*\*[ \t]+\S[^*]*\S\*\*/.test(line.slice(m.index))) {
        const spaces = line.slice(m.index + 2).match(/^[ \t]+/)![0].length
        issues.push({ mistake: "bold-space", message: "A space right after ** stops it turning bold.", index: at, length: 2 + spaces, look: "literal", fix: [{ from: at + 2, to: at + 2 + spaces, insert: "" }] })
      }
    }
    if (open !== null) {
      const end = lineAt + line.trimEnd().length
      issues.push({ mistake: "unclosed-bold", message: "This ** is never closed, so it shows as two asterisks.", index: open, length: 2, look: "literal", fix: [{ from: end, to: end, insert: "**" }] })
    }
    lineAt += line.length + 1
  }

  const lines = text.split("\n")
  let offset = 0
  lines.forEach((line, n) => {
    const heading = line.match(/^ {0,3}(#{1,6})(?=[A-Za-z])/)
    if (heading && !lines[n - 1]?.trim()) {
      const at = offset + heading[0].length
      issues.push({ mistake: "heading-space", message: "Without a space after #, this stays a plain paragraph.", index: offset + heading[0].length - heading[1].length, length: heading[1].length + 1, look: "literal", fix: [{ from: at, to: at, insert: " " }] })
    }
    offset += line.length + 1
  })

  for (const m of text.matchAll(/(?<!!)\[([^\]\n]+)\]([ \t]+)\(([^)\n]*)\)/g)) {
    const gap = m.index + m[1].length + 2
    issues.push({ mistake: "link-space", message: "The space between ] and ( breaks the link; it shows as brackets.", index: m.index, length: m[0].length, look: "literal", fix: [{ from: gap, to: gap + m[2].length, insert: "" }] })
  }
  for (const m of text.matchAll(/(!?)\[([^\]\n]*)\]\(([^)\n]*)\)/g)) {
    const url = m[3].trim()
    const urlAt = m.index + m[0].length - 1 - m[3].length
    if (!url) issues.push({ mistake: "empty-link", message: "This link has no address, so it goes nowhere.", index: m.index, length: m[0].length, look: "literal" })
    else if (!m[1] && !m[2].trim()) issues.push({ mistake: "link-no-text", message: "This link has no text, so readers can't see or click it.", index: m.index, length: m[0].length, look: "invisible" })
    else if (/\s/.test(url) && !/^<.*>$|\s+["'(]/.test(url)) {
      const lead = m[3].length - m[3].trimStart().length
      issues.push({ mistake: "link-url-space", message: "A space in the address breaks this link.", index: m.index, length: m[0].length, look: "literal", fix: [{ from: urlAt + lead, to: urlAt + lead + url.length, insert: url.replace(/\s+/g, "%20") }] })
    }
  }
  for (const m of text.matchAll(/(?<![\]!])\[([^\]\n]+)\]\[([^\]\n]*)\]/g)) {
    if (!refs.has((m[2] || m[1]).toLowerCase()))
      issues.push({ mistake: "missing-ref", message: `There's no [${m[2] || m[1]}]: definition, so this shows as raw brackets.`, index: m.index, length: m[0].length, look: "literal" })
  }
  const closers = new Set<number>()
  for (const m of text.matchAll(/<(\/?)([a-zA-Z][\w-]*)\b[^<>\n]*>/g)) {
    if (/^<[a-z][\w+.-]*:/i.test(m[0]) || closers.has(m.index)) continue // an autolink like <https://…>, or handled
    const tag = m[2].toLowerCase()
    const handler = m[0].match(/\s(on\w+)\s*=\s*("[^"]*"|'[^']*'|[^\s>]*)/i)
    if (handler && allowedTags.includes(tag)) {
      const at = m.index + handler.index!
      issues.push({ mistake: "stripped-html", message: `The ${handler[1]} attribute is removed when this renders.`, index: at, length: handler[0].length, look: "removed", fix: [{ from: at, to: at + handler[0].length, insert: "" }] })
    }
    if (allowedTags.includes(tag)) continue
    // Find the matching closing tag, so the fix removes both and keeps the text between them.
    const close = m[1] ? null : new RegExp(`</${tag}\\s*>`, "i").exec(text.slice(m.index + m[0].length))
    const closeAt = close ? m.index + m[0].length + close.index : -1
    if (close) closers.add(closeAt)
    const dropsContent = CONTENT_TAGS.includes(tag)
    const end = close ? closeAt + close[0].length : m.index + m[0].length
    const edits = dropsContent || !close
      ? [{ from: m.index, to: end, insert: "" }]
      : [{ from: closeAt, to: end, insert: "" }, { from: m.index, to: m.index + m[0].length, insert: "" }]
    issues.push({ mistake: "stripped-html", message: dropsContent ? `<${tag}> is stripped with everything inside it.` : `<${tag}> isn't allowed here; the tag is stripped when this renders.`, index: m.index, length: (dropsContent ? end : m.index + m[0].length) - m.index, look: "removed", fix: edits })
  }

  return issues
    .sort((a, b) => a.index - b.index)
    .map((issue) => {
      const before = source.slice(0, issue.index).split("\n")
      return { ...issue, line: before.length, column: before[before.length - 1].length + 1 }
    })
}

/** Applies one issue's fix (edits are listed last-first, so offsets stay valid). Unchanged when it has none. */
export function fixMarkdown(source: string, issue: MarkdownIssue) {
  return (issue.fix ?? []).reduce((text, edit) => text.slice(0, edit.from) + edit.insert + text.slice(edit.to), source)
}
