"use client"

import * as React from "react"
import { CircleCheck, Heading, TriangleAlert } from "lucide-react"

import { cn } from "@/lib/utils"

export interface OutlineHeading {
  level: number
  text: string
  /** Bold text standing alone that reads as a heading but isn't one. */
  fake?: boolean
  /** Markdown line index (markdown mode). */
  line?: number
  /** `true` when written with a === / --- underline (markdown mode). */
  setext?: boolean
  /** `true` when written as an HTML tag on its own line, like `<h2>Costs</h2>` (markdown mode). */
  html?: boolean
  /** The blockquote markers before it, like `> ` for `> ## Note` (markdown mode). Kept when the heading is rewritten. */
  quote?: string
  /** The element itself (DOM mode). */
  element?: HTMLElement
}

export type OutlineIssue = "empty" | "extra-h1" | "skipped" | "fake" | "long"

export interface OutlineCheck {
  issue?: OutlineIssue
  /** Level the one-tap fix moves the heading to. */
  fixLevel?: number
  /** Levels jumped over on the way down. */
  skipped?: number[]
}

const FENCE = /^ {0,3}(`{3,}|~{3,})(.*)$/
const HTML_HEADING = /^ {0,3}<h([1-6])(?:\s[^>]*)?>(.*?)<\/h\1>\s*$/i
const ATX = /^ {0,3}(#{1,6})(?:[ \t]+(.*?))?(?:[ \t]+#+)?[ \t]*$/
const UNDERLINE = /^ {0,3}(=+|-+)[ \t]*$/
const BLOCK = /^\s*([-*+>]|\d+[.)])\s|^\s*$/
const BOLD_LINE = /^\s*(\*\*|__)([^*_\n]{1,80}?)\1\s*$/
const QUOTE = /^(?: {0,3}>[ \t]?)+/

/** Splits a line into its blockquote markers and the content inside them. */
const unquote = (line: string) => {
  const quote = line.match(QUOTE)?.[0] ?? ""
  return { quote, body: line.slice(quote.length) }
}

/**
 * Reads ATX (## Title) and setext (Title + ===) headings, also inside blockquotes (> ## Note), skipping code
 * fences, plus bold-only lines that pose as headings.
 */
export function headingsFromMarkdown(markdown: string): OutlineHeading[] {
  const parts = markdown.split(/\r?\n/).map(unquote)
  const lines = parts.map((p) => p.body)
  const out: OutlineHeading[] = []
  let fence = ""
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i]
    const quote = parts[i].quote ? { quote: parts[i].quote } : {}
    const marker = raw.match(FENCE)
    if (fence) {
      // A fence closes only with the same character, at least as long, and nothing after it.
      if (marker && marker[1][0] === fence[0] && marker[1].length >= fence.length && !marker[2].trim()) fence = ""
      continue
    }
    if (marker) {
      fence = marker[1]
      continue
    }
    const atx = raw.match(ATX)
    const tag = raw.match(HTML_HEADING)
    if (atx) out.push({ level: atx[1].length, text: (atx[2] ?? "").trim(), line: i, ...quote })
    else if (tag) out.push({ level: Number(tag[1]), text: tag[2].replace(/<[^>]+>/g, "").trim(), line: i, html: true, ...quote })
    // An underline only counts inside the same quote as its text.
    else if (!BLOCK.test(raw) && UNDERLINE.test(lines[i + 1] ?? "") && parts[i + 1].quote.replace(/\s/g, "") === parts[i].quote.replace(/\s/g, "")) {
      out.push({ level: lines[i + 1].trim()[0] === "=" ? 1 : 2, text: raw.trim(), line: i, setext: true, ...quote })
      i++
    } else {
      const bold = raw.match(BOLD_LINE)
      if (bold && !/[.:,;!?]$/.test(bold[2].trim()) && !lines[i - 1]?.trim() && !lines[i + 1]?.trim()) out.push({ level: 0, text: bold[2].trim(), line: i, fake: true, ...quote })
    }
  }
  return out
}

/** Reads the headings (and bold-only paragraphs) a screen reader would find inside an element, ignoring hidden ones. */
export function headingsFromElement(root: HTMLElement): OutlineHeading[] {
  const out: OutlineHeading[] = []
  root.querySelectorAll<HTMLElement>("h1,h2,h3,h4,h5,h6,[role=heading],p").forEach((el) => {
    // Skip what assistive tech skips (hidden, aria-hidden, display:none, visibility:hidden), and this outline itself.
    if (el.closest("[hidden],[aria-hidden=true],[data-slot=heading-outline]")) return
    if (el.checkVisibility && !el.checkVisibility({ visibilityProperty: true })) return
    if (/^(none|presentation)$/.test(el.getAttribute("role") ?? "")) return
    const text = (el.getAttribute("aria-label") ?? el.textContent ?? "").replace(/\s+/g, " ").trim()
    if (el.tagName === "P") {
      const only = el.children.length === 1 ? el.children[0] : null
      if (only && /^(B|STRONG)$/.test(only.tagName) && text && only.textContent?.trim() === text && !/[.:,;!?]$/.test(text) && text.length <= 80) out.push({ level: 0, text, fake: true, element: el })
      return
    }
    const level = el.getAttribute("role") === "heading" ? Number(el.getAttribute("aria-level")) || 2 : Number(el.tagName[1])
    out.push({ level, text, element: el })
  })
  return out
}

/** Checks heading order the way WebAIM and W3C describe it: going down one level at a time, one H1, no empty or bold-text headings. */
export function checkOutline(headings: OutlineHeading[], { startLevel = 1, maxLength = 90 } = {}) {
  const hasH1 = headings.some((h) => h.level === 1 && !h.fake)
  // Navigation H2s before the page's H1 are normal, so the baseline is H1 even before one appears.
  let prev = Math.max(1, startLevel - 1)
  let seenH1 = startLevel > 1
  // The level the previous heading has once fixed, so a bold "heading" isn't told to repeat a mistake.
  let section = prev
  const check = (h: OutlineHeading): OutlineCheck => {
    // Bold "headings" usually start a sibling section of the heading above, so match its level (never a second H1).
    if (h.fake) return { issue: "fake", fixLevel: Math.max(startLevel, 2, Math.min(6, section)) }
    const before = prev
    prev = h.level
    if (!h.text) return { issue: "empty" }
    if (h.level === 1) {
      if (seenH1) return { issue: "extra-h1", fixLevel: 2 }
      seenH1 = true
    }
    if (h.level > before + 1) return { issue: "skipped", fixLevel: before + 1, skipped: Array.from({ length: h.level - before - 1 }, (_, k) => before + 1 + k) }
    if (h.text.length > maxLength) return { issue: "long" }
    return {}
  }
  const checks = headings.map((h) => {
    const result = check(h)
    if (!h.fake) section = result.fixLevel ?? h.level
    return result
  })
  return { checks, missingH1: startLevel === 1 && headings.length > 0 && !hasH1 }
}

/** Rewrites one heading's line in Markdown: a new level, or `null` to remove it. */
export function relevelMarkdown(markdown: string, heading: OutlineHeading, level: number | null) {
  if (heading.line === undefined) return markdown
  const eol = markdown.includes("\r\n") ? "\r\n" : "\n"
  const lines = markdown.split(/\r?\n/)
  const html = heading.html && level ? lines[heading.line].replace(/<(\/?)h[1-6]/gi, `<$1h${level}`) : null
  const quote = heading.quote ?? unquote(lines[heading.line]).quote
  lines.splice(heading.line, heading.setext ? 2 : 1, ...(level ? [html ?? `${quote}${"#".repeat(level)} ${heading.text}`] : []))
  return lines.join(eol)
}

export const HEADING_OUTLINE_MESSAGES = {
  empty: "Empty. Screen readers announce just “heading”.",
  "extra-h1": "A second H1. Keep one H1 for the page's topic.",
  skipped: (from: number, to: number) => `Jumps from H${from} to H${to}, so it sounds like a section is missing.`,
  fake: "Bold text posing as a heading. It's missing from the outline.",
  long: "Very long for a heading. Is this emphasis, not a section?",
  missingH1: "No H1. Screen reader users jump to it to learn what the page is about.",
}

const fixClass =
  "inline-flex h-6 items-center rounded-md border border-amber-500/40 px-2 font-medium text-amber-900 transition-colors hover:bg-amber-500/10 dark:text-amber-200 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"

export interface HeadingOutlineProps extends Omit<React.ComponentProps<"nav">, "children"> {
  /** Markdown to outline. With `onMarkdownChange`, problems get one-tap fixes. */
  markdown?: string
  /** Called with the fixed Markdown when a fix is tapped. */
  onMarkdownChange?: (markdown: string) => void
  /** Live mode: outline the headings inside this element, updating as it changes. Rows jump to the heading. */
  target?: React.RefObject<HTMLElement | null>
  /** Called when a row is chosen (markdown mode), e.g. to move the editor's cursor there. */
  onJump?: (heading: OutlineHeading) => void
  /** Level the content starts at. Use 2 when the page template already renders the H1. */
  startLevel?: number
  /** Headings longer than this are flagged. */
  maxLength?: number
  /** Accessible name of the outline. */
  label?: string
  /** Heading shown above the outline. */
  title?: string
  /** `{count}` is filled in. */
  summaryText?: string
  /** Shown when no issues are found. */
  allGoodText?: string
  /** Shown when there are no headings. */
  emptyText?: string
  /** Row text for an empty heading. */
  emptyHeadingText?: string
  /** `{level}` is filled in. */
  skippedRowText?: string
  /** `{level}` is filled in. */
  fixLabel?: string
  /** Label for the button that removes an empty heading. */
  removeLabel?: string
  /** Override any issue message. */
  messages?: Partial<typeof HEADING_OUTLINE_MESSAGES>
}

/**
 * A live outline of a document's headings that catches the structure mistakes screen reader users trip on:
 * skipped levels (shown as dashed ghost rows), more than one H1, a missing H1, empty headings, bold text posing
 * as a heading and headings that are really paragraphs. In Markdown mode each one has a one-tap fix.
 */
export function HeadingOutline({
  markdown,
  onMarkdownChange,
  target,
  onJump,
  startLevel = 1,
  maxLength = 90,
  label = "Heading outline",
  title = "Outline",
  summaryText = "{count} to fix",
  allGoodText = "Structure looks right",
  emptyText = "No headings yet.",
  emptyHeadingText = "Empty heading",
  skippedRowText = "H{level} skipped",
  fixLabel = "Make it H{level}",
  removeLabel = "Remove it",
  messages,
  className,
  ...props
}: HeadingOutlineProps) {
  const [live, setLive] = React.useState<OutlineHeading[]>([])
  React.useEffect(() => {
    const root = target?.current
    if (!root) return
    // Only re-render when the outline really changed, so outlining a region that contains this outline can't loop.
    const signature = (list: OutlineHeading[]) => list.map((h) => `${h.level}${h.fake ? "b" : ""}:${h.text}`).join("\n")
    const read = () => {
      const next = headingsFromElement(root)
      setLive((current) => (signature(current) === signature(next) && current.every((h, i) => h.element === next[i].element) ? current : next))
    }
    read()
    const observer = new MutationObserver(read)
    observer.observe(root, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ["role", "aria-level", "aria-label", "hidden", "aria-hidden", "class", "style"] })
    return () => observer.disconnect()
  }, [target])

  const headings = React.useMemo(() => (target ? live : headingsFromMarkdown(markdown ?? "")), [target, live, markdown])
  const { checks, missingH1 } = checkOutline(headings, { startLevel, maxLength })
  const t = { ...HEADING_OUTLINE_MESSAGES, ...messages }
  const problems = checks.filter((c) => c.issue).length + (missingH1 ? 1 : 0)
  const canFix = !target && !!onMarkdownChange && markdown !== undefined
  const list = React.useRef<HTMLOListElement>(null)
  // A tapped fix disappears with its warning, so focus moves to the next fix (or the outline) instead of the page.
  const refocus = React.useRef<number | null>(null)
  React.useEffect(() => {
    if (refocus.current === null) return
    const buttons = list.current?.querySelectorAll<HTMLButtonElement>("button[data-fix]") ?? []
    ;(buttons[Math.min(refocus.current, buttons.length - 1)] ?? list.current?.querySelector<HTMLButtonElement>("button"))?.focus()
    refocus.current = null
  }, [markdown])
  const indent = (level: number) => ({ paddingInlineStart: `${Math.max(0, level - startLevel) * 0.75}rem` })

  const jump = (heading: OutlineHeading) => {
    const el = heading.element
    if (!el) return onJump?.(heading)
    if (!el.hasAttribute("tabindex") && el.tabIndex < 0) el.setAttribute("tabindex", "-1")
    el.scrollIntoView({ block: "center", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" })
    el.focus({ preventScroll: true })
  }

  return (
    <nav aria-label={label} data-slot="heading-outline" data-state={problems ? "issues" : "ok"} className={cn("w-full max-w-md rounded-lg border p-3 text-sm", className)} {...props}>
      <style>{`@keyframes cui-heading-outline-pop { from { transform: scale(.8); opacity: .4 } }`}</style>
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 font-medium">
          <Heading aria-hidden className="size-4 text-muted-foreground" />
          {title}
        </p>
        {headings.length > 0 && (
          <p aria-live="polite" className={cn("flex items-center gap-1.5 text-xs", problems ? "text-amber-700 dark:text-amber-400" : "text-emerald-700 dark:text-emerald-400")}>
            {problems ? <TriangleAlert aria-hidden className="size-3.5" /> : <CircleCheck aria-hidden className="size-3.5" />}
            {problems ? summaryText.replace("{count}", String(problems)) : allGoodText}
          </p>
        )}
      </div>
      {missingH1 && <p className="mb-2 flex gap-1.5 text-xs text-amber-700 dark:text-amber-400"><TriangleAlert aria-hidden className="mt-0.5 size-3.5 shrink-0" />{t.missingH1}</p>}
      {headings.length === 0 && <p className="text-muted-foreground">{emptyText}</p>}
      <ol ref={list} className="grid gap-0.5">
        {headings.map((h, i) => {
          const check = checks[i]
          const level = check.issue === "fake" ? check.fixLevel! : h.level
          const tone = check.issue === "empty" || check.issue === "extra-h1" ? "text-red-700 dark:text-red-400" : "text-amber-700 dark:text-amber-400"
          const message = check.issue === "skipped" ? t.skipped(check.fixLevel! - 1, h.level) : check.issue && t[check.issue]
          const jumpable = !!h.element || !!onJump
          const row = (
            <>
              <span key={`${h.level}${check.issue}`} className={cn("inline-flex h-5 min-w-7 shrink-0 items-center justify-center rounded px-1 font-mono text-[11px] font-medium motion-safe:animate-[cui-heading-outline-pop_250ms_ease-out]", h.fake ? "border border-dashed border-amber-500/60 text-amber-800 dark:text-amber-300" : check.issue ? "bg-amber-500/15 text-amber-800 dark:text-amber-300" : "bg-muted text-muted-foreground")}>
                {h.fake ? "B" : `H${h.level}`}
              </span>
              <span className={cn("min-w-0 truncate", !h.text && "italic text-muted-foreground", h.fake && "font-semibold")}>{h.text || emptyHeadingText}</span>
            </>
          )
          return (
            <li key={`${i}-${h.line ?? ""}`} data-issue={check.issue} className="grid gap-0.5">
              {check.skipped?.map((s) => (
                <span key={s} aria-hidden style={indent(s)} className="flex items-center gap-2 py-0.5 text-xs text-muted-foreground">
                  <span className="inline-flex h-5 min-w-7 items-center justify-center rounded border border-dashed font-mono text-[11px]">H{s}</span>
                  {skippedRowText.replace("{level}", String(s))}
                </span>
              ))}
              <div style={indent(level)} className="grid gap-1 py-0.5">
                {jumpable ? (
                  <button type="button" onClick={() => jump(h)} className="-mx-1 flex min-w-0 items-center gap-2 rounded px-1 text-left outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50">{row}</button>
                ) : (
                  <span className="flex min-w-0 items-center gap-2">{row}</span>
                )}
                {message && (
                  <p className={cn("flex flex-wrap items-center gap-x-2 gap-y-1 text-xs", tone)}>
                    <span>{message}</span>
                    {canFix && (check.fixLevel || check.issue === "empty") && (
                      <button
                        type="button"
                        data-fix=""
                        className={fixClass}
                        onClick={(event) => {
                          refocus.current = [...(list.current?.querySelectorAll("button[data-fix]") ?? [])].indexOf(event.currentTarget)
                          onMarkdownChange!(relevelMarkdown(markdown!, h, check.fixLevel ?? null))
                        }}
                      >
                        {check.fixLevel ? fixLabel.replace("{level}", String(check.fixLevel)) : removeLabel}
                      </button>
                    )}
                  </p>
                )}
              </div>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
