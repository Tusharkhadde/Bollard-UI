"use client"

// Bollard UI — abbr-hint · MIT licence · https://bollard-ui.vercel.app/components/abbr-hint

import * as React from "react"
import { FloatingArrow, FloatingPortal, arrow, autoUpdate, flip, offset, shift, useFloating } from "@floating-ui/react"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"

import { cn } from "@/lib/utils"

/** A glossary entry: just the expansion, or an expansion plus a plain-language definition. */
export type GlossaryEntry = string | { expansion: string; definition?: string }
export type Glossary = Record<string, GlossaryEntry>
export type GlossaryPart = string | { term: string; key: string; first: boolean }

const GlossaryContext = React.createContext<Glossary>({})

/** Shares one glossary with every AbbrHint and GlossaryText inside it. */
export function AbbrGlossary({ glossary, children }: { glossary: Glossary; children: React.ReactNode }) {
  return <GlossaryContext.Provider value={glossary}>{children}</GlossaryContext.Provider>
}

/** The glossary key for a term as written: exact first, then a plural ("SLAs", "API's") of a known term. */
export function glossaryKey(term: string, glossary: Glossary) {
  if (term in glossary) return term
  const singular = term.replace(/'?s$/, "")
  return singular !== term && singular in glossary ? singular : null
}

const entryOf = (entry: GlossaryEntry) => (typeof entry === "string" ? { expansion: entry } : entry)
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")

/**
 * Splits text into plain strings and glossary terms, matched case-sensitively on whole words
 * (so "TAT" never matches inside "TATTOO", and "kWh" stays apart from "KWH"). `first` marks
 * each term's first appearance, the one WCAG G97 says to spell out.
 */
export function segmentGlossary(text: string, glossary: Glossary): GlossaryPart[] {
  const keys = Object.keys(glossary).sort((a, b) => b.length - a.length)
  if (!keys.length) return [text]
  const pattern = new RegExp(`(?<![\\p{L}\\p{N}])(${keys.map((k) => `${escape(k)}(?:'?s)?`).join("|")})(?![\\p{L}\\p{N}])`, "gu")
  const seen = new Set<string>()
  const parts: GlossaryPart[] = []
  let last = 0
  for (const match of text.matchAll(pattern)) {
    const key = glossaryKey(match[0], glossary)
    if (!key) continue
    if (match.index > last) parts.push(text.slice(last, match.index))
    parts.push({ term: match[0], key, first: !seen.has(key) })
    seen.add(key)
    last = match.index + match[0].length
  }
  if (last < text.length) parts.push(text.slice(last))
  return parts
}

/** All-caps abbreviations in the text that the glossary doesn't explain, for authoring checks. */
export function findUndefinedAbbreviations(text: string, glossary: Glossary) {
  const found = text.match(/(?<![\p{L}\p{N}])\p{Lu}[\p{Lu}\p{N}&]+(?![\p{L}\p{N}])/gu) ?? []
  return [...new Set(found)].filter((term) => !glossaryKey(term, glossary))
}

export interface AbbrHintProps extends Omit<React.ComponentProps<"span">, "children"> {
  /** The abbreviation as it appears in the text, e.g. "TAT". */
  children: string
  /** Glossary key when it differs from the text shown. */
  term?: string
  /** What the abbreviation stands for. Taken from the glossary when omitted. */
  expansion?: string
  /** Plain-language meaning shown under the expansion. */
  definition?: string
  /** Spell it out in the text as well ("turnaround time (TAT)"), for its first use on a page. */
  expand?: boolean
  /** Glossary to look the term up in. Defaults to the nearest AbbrGlossary. */
  glossary?: Glossary
  /** Preferred side for the hint; it flips and slides to stay on screen. */
  side?: "top" | "bottom"
}

/**
 * Explains jargon where people actually read it. The dotted term is a real button, so a tap
 * or keyboard focus opens the expansion, not just a mouse hover the way `<abbr title>` does
 * (title is unreachable on touch and keyboard). The hint is portalled and positioned with
 * floating-ui, so it is never clipped by a scrolling card or table cell and flips or slides to
 * stay on screen. Hover content stays put while you move onto it, Escape dismisses it, screen
 * readers get the expansion as a description without opening anything, and `expand` spells the
 * term out inline on first use.
 */
export function AbbrHint({
  children,
  term,
  expansion,
  definition,
  expand = false,
  glossary,
  side = "bottom",
  className,
  ...props
}: AbbrHintProps) {
  const shared = React.useContext(GlossaryContext)
  const source = glossary ?? shared
  const key = glossaryKey(term ?? children, source)
  const entry = key ? entryOf(source[key]) : undefined
  const full = expansion ?? entry?.expansion
  const meaning = definition ?? entry?.definition

  const [pinned, setPinned] = React.useState(false)
  const [focused, setFocused] = React.useState(false)
  const [hovered, setHovered] = React.useState(false)
  const rootRef = React.useRef<HTMLSpanElement>(null)
  const arrowRef = React.useRef<SVGSVGElement>(null)
  const fromPointer = React.useRef(false)
  const leaveTimer = React.useRef<ReturnType<typeof setTimeout>>(undefined)
  const descriptionId = React.useId()
  const reduceMotion = useReducedMotion()
  const open = Boolean(full) && (pinned || focused || hovered)

  const { refs, floatingStyles, context, placement } = useFloating({
    open,
    placement: side,
    middleware: [offset(8), flip({ padding: 8 }), shift({ padding: 8 }), arrow({ element: arrowRef })],
    whileElementsMounted: autoUpdate,
  })
  const above = placement.startsWith("top")

  React.useEffect(() => {
    if (!pinned) return
    const close = (event: PointerEvent) => {
      const target = event.target as Node
      if (!rootRef.current?.contains(target) && !refs.floating.current?.contains(target)) setPinned(false)
    }
    document.addEventListener("pointerdown", close)
    return () => document.removeEventListener("pointerdown", close)
  }, [pinned, refs.floating])

  React.useEffect(() => () => clearTimeout(leaveTimer.current), [])

  if (!full) return <span className={className}>{children}</span>

  const enter = (event: React.PointerEvent) => {
    if (event.pointerType !== "mouse") return
    clearTimeout(leaveTimer.current)
    setHovered(true)
  }
  const leave = () => {
    leaveTimer.current = setTimeout(() => setHovered(false), 120)
  }

  const hint = (
    <span
      ref={rootRef}
      data-slot="abbr-hint"
      data-state={open ? "open" : "closed"}
      className={cn("inline-block", className)}
      onPointerEnter={enter}
      onPointerLeave={leave}
      {...props}
    >
      <button
        ref={refs.setReference}
        type="button"
        aria-expanded={open}
        aria-describedby={descriptionId}
        onPointerDown={() => (fromPointer.current = true)}
        onFocus={() => {
          if (!fromPointer.current) setFocused(true)
          fromPointer.current = false
        }}
        onBlur={() => {
          setFocused(false)
          setPinned(false)
        }}
        onClick={() => {
          setFocused(false)
          setPinned((p) => !(p || focused))
        }}
        onKeyDown={(event) => {
          if (event.key !== "Escape" || !open) return
          event.stopPropagation()
          setPinned(false)
          setFocused(false)
          setHovered(false)
        }}
        className="cursor-help rounded-sm p-0 font-[inherit] text-inherit underline decoration-current/50 decoration-dotted decoration-[1.5px] underline-offset-[3px] transition-colors outline-none hover:decoration-current focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-expanded:bg-accent aria-expanded:decoration-current"
      >
        <abbr className="no-underline">{children}</abbr>
      </button>
      {/* Always in the DOM, so screen readers hear the expansion without opening anything. */}
      <span id={descriptionId} className="sr-only">
        {full}
        {meaning ? `. ${meaning}` : ""}
      </span>
      <FloatingPortal>
        <AnimatePresence>
          {open && (
            <div ref={refs.setFloating} style={floatingStyles} className="z-50" onPointerEnter={enter} onPointerLeave={leave}>
              <motion.span
                aria-hidden
                initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: above ? 4 : -4, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: above ? 2 : -2, scale: 0.98 }}
                transition={reduceMotion ? { duration: 0.1 } : { type: "spring", stiffness: 520, damping: 32, mass: 0.6 }}
                style={{ transformOrigin: above ? "50% 100%" : "50% 0%" }}
                className="block w-max max-w-64 rounded-md border bg-popover px-2.5 py-1.5 text-left text-xs leading-snug font-normal whitespace-normal text-popover-foreground not-italic shadow-md"
              >
                <FloatingArrow
                  ref={arrowRef}
                  context={context}
                  width={10}
                  height={5}
                  className="fill-popover"
                  stroke="var(--color-border)"
                  strokeWidth={1}
                />
                <span className="font-semibold">{children}</span>
                <span className="text-muted-foreground">: </span>
                <span>{full}</span>
                {meaning && <span className="mt-0.5 block text-muted-foreground">{meaning}</span>}
              </motion.span>
            </div>
          )}
        </AnimatePresence>
      </FloatingPortal>
    </span>
  )

  return expand ? (
    <>
      {full} <span className="whitespace-nowrap">({hint})</span>
    </>
  ) : (
    hint
  )
}

export interface GlossaryTextProps extends Omit<React.ComponentProps<"span">, "children"> {
  /** Plain text; every glossary term in it becomes a hint. */
  children: string
  /** Glossary to use. Defaults to the nearest AbbrGlossary. */
  glossary?: Glossary
  /** "expand" spells each term out on its first appearance and hints the rest; "hint" only hints. */
  firstUse?: "expand" | "hint"
}

/** Runs a glossary over a sentence: first use spelled out, later uses tappable. */
export function GlossaryText({ children, glossary, firstUse = "expand", className, ...props }: GlossaryTextProps) {
  const shared = React.useContext(GlossaryContext)
  const source = glossary ?? shared
  const parts = React.useMemo(() => segmentGlossary(children, source), [children, source])
  return (
    <span data-slot="glossary-text" className={className} {...props}>
      {parts.map((part, i) =>
        typeof part === "string" ? (
          <React.Fragment key={i}>{part}</React.Fragment>
        ) : (
          <AbbrHint key={i} term={part.key} glossary={source} expand={firstUse === "expand" && part.first}>
            {part.term}
          </AbbrHint>
        ),
      )}
    </span>
  )
}
