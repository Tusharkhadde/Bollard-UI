// Bollard UI — truncation-preview · MIT licence · https://bollard-ui.vercel.app/components/truncation-preview

/**
 * Where feeds cut text behind "…more". None of these products publish their fold, so every number is a
 * measured approximation (sources in each note) and can be overridden.
 */

export interface FoldRule {
  label: string
  /** Most characters (graphemes) shown before the cut. */
  maxChars?: number
  /** Most rendered lines; every line break starts a new one and a blank line costs a whole line. */
  maxLines?: number
  /** Characters that fit on one rendered line, used with `maxLines`. */
  lineChars?: number
  /** X counting: URLs weigh 23, emoji and CJK weigh 2. */
  weighted?: number
  /** Pixel budget and CSS font, for search results that cut by rendered width. */
  pixels?: { width: number; font: string }
  /** What the product shows at the cut. */
  more: string
  /** Where the number comes from. */
  note: string
}

export const SURFACES = {
  "linkedin-mobile": { label: "LinkedIn app", maxChars: 140, maxLines: 3, lineChars: 47, more: "…more", note: "≈140 characters or 3 lines in the app; blank lines count as lines" },
  "linkedin-desktop": { label: "LinkedIn web", maxChars: 210, maxLines: 3, lineChars: 75, more: "…more", note: "≈210 characters or 3 lines on desktop" },
  instagram: { label: "Instagram", maxChars: 125, maxLines: 2, lineChars: 63, more: "… more", note: "≈125 characters of a caption in the feed" },
  x: { label: "X", weighted: 280, more: "Show more", note: "Premium long posts show 280 weighted characters; standard accounts can't post past 280" },
  "push-ios": { label: "iOS push", maxChars: 150, maxLines: 4, lineChars: 40, more: "…", note: "≈4 lines, about 150 characters on the lock screen" },
  "push-android": { label: "Android push", maxChars: 40, maxLines: 1, lineChars: 40, more: "…", note: "One line, about 40 characters, while collapsed" },
  "google-title": { label: "Google title", pixels: { width: 600, font: "20px Arial" }, more: "...", note: "≈600 px of 20 px Arial on desktop" },
  "google-description": { label: "Google snippet", pixels: { width: 920, font: "14px Arial" }, more: "...", note: "≈920 px of 14 px Arial on desktop" },
  "google-description-mobile": { label: "Google snippet (mobile)", pixels: { width: 680, font: "14px Arial" }, more: "...", note: "≈680 px of 14 px Arial on mobile" },
} satisfies Record<string, FoldRule>

export type SurfaceId = keyof typeof SURFACES

let segmenter: Intl.Segmenter | null | undefined
function graphemes(text: string) {
  if (segmenter === undefined) segmenter = typeof Intl !== "undefined" && "Segmenter" in Intl ? new Intl.Segmenter(undefined, { granularity: "grapheme" }) : null
  return segmenter ? Array.from(segmenter.segment(text), (s) => s.segment) : Array.from(text)
}

export const URL_PATTERN = /https?:\/\/\S+|\bwww\.\S+/g

/** Code points X counts as 1 (twitter-text config v3); everything else, emoji included, counts as 2. */
const light = (cp: number) => cp <= 4351 || (cp >= 8192 && cp <= 8205) || (cp >= 8208 && cp <= 8223) || (cp >= 8242 && cp <= 8247)

/** Rough width when no canvas is available yet (server render): Arial averages about 0.5em per character. */
const estimate = (text: string, font: string) => text.length * 0.5 * parseFloat(font)

/**
 * Index in `text` where the visible part ends (text.length when nothing is hidden), snapped back to the
 * last space like the feeds do, plus whether blank lines used up the line budget first.
 */
export function findFold(text: string, rule: FoldRule, measure: (text: string, font: string) => number = estimate) {
  const body = text.replace(/\s+$/, "")
  let cut = body.length
  /** True when blank lines spent part of a line budget that then ran out before the character budget. */
  let blankLinesCost = false

  if (rule.pixels) {
    const { width, font } = rule.pixels
    const flat = body.replace(/\s/g, " ")
    if (measure(flat, font) > width) {
      const budget = width - measure(` ${rule.more}`, font)
      let used = 0
      for (const g of graphemes(flat)) {
        if (measure(flat.slice(0, used + g.length), font) > budget) break
        used += g.length
      }
      cut = used
    }
  } else if (rule.weighted) {
    let weight = 0
    let index = 0
    const urls = [...body.matchAll(URL_PATTERN)]
    while (index < body.length) {
      const url = urls.find((m) => m.index === index)
      const g = url ? url[0] : graphemes(body.slice(index, index + 8))[0]
      const cost = url ? 23 : /\p{Extended_Pictographic}/u.test(g) || !light(g.codePointAt(0) ?? 0) ? 2 : 1
      if (weight + cost > rule.weighted) break
      weight += cost
      index += g.length
    }
    cut = index
  } else {
    let chars = 0
    let lines = 0
    let index = 0
    let blanks = 0
    const maxChars = rule.maxChars ?? Infinity
    const lineChars = rule.lineChars ?? Infinity
    const maxLines = rule.maxLines ?? Infinity
    for (const para of body.split("\n")) {
      const len = graphemes(para).length
      const paraLines = Math.max(1, Math.ceil(len / lineChars))
      const room = Math.min(maxChars - chars, (maxLines - lines) * lineChars)
      if (lines + paraLines > maxLines || chars + len > maxChars) {
        blankLinesCost = blanks > 0 && (maxLines - lines) * lineChars < maxChars - chars
        cut = index + graphemes(para).slice(0, Math.max(0, room - rule.more.length)).join("").length
        break
      }
      chars += len
      lines += paraLines
      if (!para.trim()) blanks++
      index += para.length + 1
    }
  }

  if (cut < body.length && cut > 0 && /\S/.test(body[cut]) && /\S/.test(body[cut - 1])) {
    const space = body.lastIndexOf(" ", cut)
    if (space > cut * 0.6) cut = space
  }
  cut = body.slice(0, cut).replace(/\s+$/, "").length
  return { cut: Math.min(cut, body.length), hidden: cut < body.length, blankLinesCost }
}

/** Moves the sentence (or line) containing `index` to the start of the text, leaving the paragraphs around it intact. */
export function moveSentenceToStart(text: string, index: number) {
  const marks = [...text.matchAll(/[.!?](?=\s)|\n/g)].map((m) => m.index + (m[0] === "\n" ? 0 : 1))
  const start = marks.filter((m) => m <= index).pop() ?? 0
  const end = marks.find((m) => m > index) ?? text.length
  const sentence = text.slice(start, end).trim()
  const rest = (text.slice(0, start) + text.slice(end))
    .replace(/[ \t]+(?=\n|$)/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/^\s+/, "")
  return `${sentence}${/[.!?]$/.test(sentence) ? " " : "\n"}${rest}`.trimEnd()
}

/** Removes blank lines from the opening, where each one costs a whole line before the fold. */
export function tightenOpening(text: string, upTo: number) {
  return text.slice(0, upTo).replace(/\n{2,}/g, "\n") + text.slice(upTo)
}
