// What a page loses on paper, found in the live DOM, and print-only fixes that undo themselves.
// Browser only: call from events or effects.

export type PrintIssueKind = "dark" | "collapsed" | "wide" | "clipped" | "links"

export interface PrintIssue {
  kind: PrintIssueKind
  /** How many things are affected (sections, tables, links). */
  count: number
  /** The first affected element, to show the user. */
  first: HTMLElement
  /** For "wide": the largest share of a table cut off the page, 0 to 1. */
  cut?: number
  /** Internal: elements to mark and how. */
  marks: { element: HTMLElement; zoom?: number; url?: string }[]
}

/** Default printable width in CSS px: A4 (210 mm) minus 1 cm margins each side. */
export const A4_CONTENT_WIDTH = 718

let canvas: CanvasRenderingContext2D | null | undefined
const colors = new Map<string, { luminance: number; alpha: number }>()

/** Relative luminance (0 to 1) and alpha of any CSS color, oklch and color-mix included, by painting one pixel. */
export function readColor(color: string) {
  const cached = colors.get(color)
  if (cached) return cached
  canvas ??= Object.assign(document.createElement("canvas"), { width: 1, height: 1 }).getContext("2d", { willReadFrequently: true })
  if (!canvas) return { luminance: 0, alpha: 0 }
  canvas.clearRect(0, 0, 1, 1)
  canvas.fillStyle = color
  canvas.fillRect(0, 0, 1, 1)
  const [r, g, b, a] = canvas.getImageData(0, 0, 1, 1).data
  const linear = (value: number) => ((value /= 255) <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4)
  const result = { luminance: 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b), alpha: a / 255 }
  colors.set(color, result)
  return result
}

const visible = (element: Element) => (element.checkVisibility ? element.checkVisibility() : (element as HTMLElement).offsetParent !== null)
const normalize = (text: string) => text.toLowerCase().replace(/^(https?:\/\/)?(www\.)?/, "").replace(/\/$/, "")

/** The element that paints the background behind `element`, and whether it is dark. */
function backdrop(element: Element) {
  for (let node: Element | null = element; node; node = node.parentElement) {
    const style = getComputedStyle(node)
    if (style.backgroundImage !== "none") return { node, dark: true, exact: style.printColorAdjust === "exact" }
    if (readColor(style.backgroundColor).alpha > 0.5)
      return { node, dark: readColor(style.backgroundColor).luminance < 0.2, exact: style.printColorAdjust === "exact" }
  }
}

/** Scans `root` for what printing would lose. Elements inside `ignore` (the guard's own UI) are skipped. */
export function scanForPrint(root: HTMLElement, { pageWidth = A4_CONTENT_WIDTH, ignore = '[data-slot="print-guard"]' } = {}) {
  const issues: PrintIssue[] = []
  const add = (kind: PrintIssueKind, marks: PrintIssue["marks"], count = marks.length, cut?: number) =>
    marks.length && issues.push({ kind, count, first: marks[0].element, marks, cut })
  const all = [...root.querySelectorAll<HTMLElement>("*")].filter((element) => !element.closest(ignore))

  // Light text whose dark background the browser drops by default ("Background graphics" off).
  const sections = new Set<Element>()
  const ink: PrintIssue["marks"] = []
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  const seen = new Set<Element>()
  for (let text = walker.nextNode(); text; text = walker.nextNode()) {
    const element = text.parentElement
    if (!element || seen.has(element) || !text.textContent?.trim() || element.closest(ignore) || !visible(element)) continue
    seen.add(element)
    const behind = backdrop(element)
    if (!behind?.dark || behind.exact || readColor(getComputedStyle(element).color).luminance < 0.5) continue
    sections.add(behind.node)
    ink.push({ element })
  }
  add("dark", ink, sections.size)

  // Closed <details> and aria-expanded="false" panels print exactly as they look: closed.
  const collapsed = all.flatMap((element): HTMLElement[] => {
    if (element instanceof HTMLDetailsElement) return element.open ? [] : [element]
    if (element.getAttribute("aria-expanded") !== "false") return []
    const panel = document.getElementById(element.getAttribute("aria-controls") ?? "")
    return panel && root.contains(panel) && !visible(panel) ? [panel] : []
  })
  add("collapsed", collapsed.map((element) => ({ element })))

  // Tables, code and scroll boxes wider than the room they get on paper. Tables are measured at their narrowest.
  // That room is the element's box on screen, scaled up when the screen is narrower than the paper.
  const wide: PrintIssue["marks"] = []
  const viewport = document.documentElement.clientWidth
  let cut = 0
  for (const element of all) {
    if (!visible(element) || wide.some((mark) => mark.element.contains(element))) continue
    const style = getComputedStyle(element)
    const scrolls = /auto|scroll|hidden/.test(style.overflowX) && element.scrollWidth > element.clientWidth + 1
    if (!scrolls && element.tagName !== "TABLE" && element.tagName !== "PRE") continue
    let width = element.scrollWidth
    if (element.tagName === "TABLE") {
      const previous = element.style.width
      element.style.width = "min-content"
      width = element.offsetWidth
      element.style.width = previous
    }
    const box = scrolls ? element.clientWidth : (element.parentElement?.clientWidth ?? pageWidth)
    const room = Math.min(pageWidth, viewport < pageWidth ? (box * pageWidth) / viewport : box)
    if (width <= room + 1) continue
    cut = Math.max(cut, 1 - room / width)
    wide.push({ element, zoom: Math.max(0.5, room / width) })
  }
  add("wide", wide, wide.length, cut)

  // Fixed-height scroll boxes print only the part currently in view.
  const clipped = all.filter((element) => {
    // Tiny boxes are visually-hidden text (sr-only), not content someone reads.
    if (element === document.body || !visible(element) || element.clientHeight < 24 || element.clientWidth < 24) return false
    return /auto|scroll|hidden/.test(getComputedStyle(element).overflowY) && element.scrollHeight > element.clientHeight + 8
  })
  add("clipped", clipped.map((element) => ({ element })))

  // Links whose text isn't their address: on paper nobody can follow them.
  const links = all.flatMap((element) => {
    if (!(element instanceof HTMLAnchorElement) || !/^(https?|mailto|tel):/.test(element.protocol) || !visible(element)) return []
    const url = element.protocol === "mailto:" || element.protocol === "tel:" ? element.href.replace(/^\w+:/, "") : element.href
    return normalize(element.textContent ?? "").includes(normalize(url)) ? [] : [{ element: element as HTMLElement, url }]
  })
  add("links", links)
  return issues
}

const token: Record<PrintIssueKind, string> = { dark: "ink", collapsed: "reveal", wide: "fit", clipped: "unclip", links: "url" }

/** Marks the issues for the print stylesheet (and opens closed <details>). Returns a function that undoes it all. */
export function applyPrintFixes(issues: PrintIssue[]) {
  const undo: (() => void)[] = []
  for (const issue of issues) {
    for (const { element, zoom, url } of issue.marks) {
      if (element instanceof HTMLDetailsElement) {
        element.open = true
        undo.push(() => (element.open = false))
        continue
      }
      const before = element.dataset.cuiPrint
      element.dataset.cuiPrint = `${before ?? ""} ${token[issue.kind]}`.trim()
      if (zoom) element.style.setProperty("--cui-print-zoom", String(zoom))
      if (url) element.dataset.cuiPrintUrl = url
      undo.push(() => {
        if (before === undefined) delete element.dataset.cuiPrint
        else element.dataset.cuiPrint = before
        element.style.removeProperty("--cui-print-zoom")
        delete element.dataset.cuiPrintUrl
      })
    }
  }
  return () => undo.reverse().forEach((step) => step())
}

/** Print-only rules for the marks above. Nothing changes on screen. */
export const printFixCss = `@media print {
  [data-cui-print~="ink"] { color: #000 !important; text-shadow: none !important; }
  [data-cui-print~="reveal"] { display: block !important; }
  [data-cui-print~="fit"] { zoom: var(--cui-print-zoom, 1); overflow: visible !important; max-width: none !important; }
  [data-cui-print~="unclip"] { overflow: visible !important; max-height: none !important; height: auto !important; }
  a[data-cui-print~="url"]::after { content: " (" attr(data-cui-print-url) ")"; font-size: 0.85em; overflow-wrap: anywhere; }
  [data-slot="print-guard"] { display: none !important; }
}`
