"use client"

import * as React from "react"
import { ArrowRight, BookOpen, Languages } from "lucide-react"

import { cn } from "@/lib/utils"
import { analyzeReadability, applySwap, findWord, matchCase, PLAIN_WORDS, type ReadabilityReport } from "./readability"

export { analyzeReadability, applySwap, countSyllables, findWord, fleschKincaid, PLAIN_WORDS, readabilitySupport, splitSentences } from "./readability"
export type { Difficulty, ReadabilityReport, ReadabilitySupport, Sentence } from "./readability"

/** Plain-English band for a grade. Override to translate. */
export const READING_BANDS: [maxGrade: number, label: string][] = [
  [6, "Easy for most readers"],
  [9, "Plain English"],
  [12, "Fairly hard"],
  [Infinity, "Hard: college level"],
]

const MARK = {
  hard: "bg-amber-300/45 dark:bg-amber-400/25",
  "very-hard": "bg-red-300/45 dark:bg-red-500/30",
  swap: "bg-violet-300/50 dark:bg-violet-400/30",
}
const chipClass =
  "inline-flex h-7 items-center gap-1 rounded-md border px-2 text-xs transition-colors hover:bg-accent outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"

/** Splits the text at every sentence and swap boundary so the backdrop can tint each piece. */
function segments(text: string, report: ReadabilityReport) {
  const cuts = new Set([0, text.length])
  report.sentences.forEach((s) => s.difficulty && (cuts.add(s.start), cuts.add(s.end)))
  report.swaps.forEach((s) => (cuts.add(s.start), cuts.add(s.end)))
  const points = [...cuts].sort((a, b) => a - b)
  return points.slice(0, -1).map((from, i) => {
    const to = points[i + 1]
    const swap = report.swaps.some((s) => s.start <= from && s.end >= to)
    const sentence = report.sentences.find((s) => s.difficulty && s.start <= from && s.end >= to)
    return { text: text.slice(from, to), tone: swap ? MARK.swap : sentence ? MARK[sentence.difficulty!] : "" }
  })
}

export interface ReadingLevelProps extends Omit<React.ComponentProps<"textarea">, "value" | "defaultValue" | "onChange"> {
  /** Visible label. */
  label?: string
  value?: string
  defaultValue?: string
  onValueChange?: (value: string) => void
  /** US school grade to aim for. 8 suits most public writing. */
  targetGrade?: number
  /** Wordy word → plain swap. */
  swaps?: Record<string, string>
  /** How many of the hardest sentences to list. */
  maxSentences?: number
  bands?: typeof READING_BANDS
  /** `{grade}` is filled in. */
  gradeText?: string
  /** `{target}` is filled in. */
  targetText?: string
  hardTitle?: string
  /** `{words}` is filled in. */
  longText?: string
  denseText?: string
  swapsTitle?: string
  /** Accessible label of a swap. `{word}` and `{plain}` are filled in. */
  swapLabel?: string
  aboveTargetText?: string
  onTargetText?: string
  /** Shown instead of a grade when the text isn't English (Hindi, Marathi, French...), where the formula means nothing. */
  unsupportedText?: string
  /** Second line of the unsupported state. */
  unsupportedHint?: string
}

/**
 * A text field that keeps writing readable for its audience: a live Flesch-Kincaid grade against a target, the
 * hardest sentences tinted in place (only when long and dense, so plain long sentences aren't nagged) with the
 * reason and a jump to each, and one-tap swaps for wordy words (utilize → use).
 */
export function ReadingLevel({
  label = "Text",
  value,
  defaultValue = "",
  onValueChange,
  targetGrade = 8,
  swaps = PLAIN_WORDS,
  maxSentences = 3,
  bands = READING_BANDS,
  gradeText = "Grade {grade}",
  targetText = "aim for {target} or lower",
  hardTitle = "Hardest sentences",
  longText = "{words} words. Try splitting it.",
  denseText = "Lots of long words.",
  swapsTitle = "Plainer words",
  swapLabel = "Replace “{word}” with “{plain}”",
  aboveTargetText = "Harder than your target.",
  onTargetText = "Within your target.",
  unsupportedText = "Readability grade is English-only",
  unsupportedHint = "This text looks like another language, so no grade is shown. Short sentences and common words still help.",
  id,
  className,
  ref,
  ...props
}: ReadingLevelProps) {
  const [inner, setInner] = React.useState(defaultValue)
  const text = value ?? inner
  const field = React.useRef<HTMLTextAreaElement>(null)
  const autoId = React.useId()
  const fieldId = id ?? autoId
  React.useImperativeHandle(ref, () => field.current as HTMLTextAreaElement)

  const report = React.useMemo(() => analyzeReadability(text, { targetGrade, swaps }), [text, targetGrade, swaps])
  const hardest = report.sentences.filter((s) => s.difficulty).sort((a, b) => b.grade - a.grade).slice(0, maxSentences)
  const swapList = [...new Map(report.swaps.map((s) => [s.word.toLowerCase().replace(/\s+/g, " "), s])).values()]
  const grade = Math.round(report.grade)
  const unsupported = report.support !== "ok"
  const above = !unsupported && report.words > 0 && grade > targetGrade
  const band = bands.find(([max]) => grade <= max)?.[1]

  React.useLayoutEffect(() => {
    const el = field.current
    if (!el) return
    el.style.height = "auto"
    el.style.height = `${el.scrollHeight}px`
  }, [text])

  const set = (next: string) => {
    if (value === undefined) setInner(next)
    onValueChange?.(next)
  }
  const chips = React.useRef<HTMLDivElement>(null)
  // The tapped chip disappears with its word, so focus moves to the next chip instead of the page.
  const refocus = React.useRef<number | null>(null)
  const focusChip = (index: number) => {
    const buttons = chips.current?.querySelectorAll("button") ?? []
    ;(buttons[Math.min(index, buttons.length - 1)] ?? field.current)?.focus()
  }
  React.useEffect(() => {
    if (refocus.current === null) return
    focusChip(refocus.current)
    refocus.current = null
  }, [text])
  const swap = (word: string, plain: string, index: number) => {
    const el = field.current
    // With a keyboard and mouse, edit through the browser so Ctrl+Z undoes the swap. Touch skips this so the
    // on-screen keyboard doesn't flash open.
    if (el && !matchMedia("(pointer: coarse)").matches) {
      el.focus()
      const hits = findWord(el.value, word).reverse()
      const done = hits.every((m) => (el.setSelectionRange(m.start, m.end), document.execCommand("insertText", false, matchCase(m.match, plain))))
      if (done) return void requestAnimationFrame(() => focusChip(index))
    }
    refocus.current = index
    set(applySwap(el?.value ?? text, word, plain))
  }
  const select = (start: number, end: number) => {
    const el = field.current
    if (!el) return
    el.focus()
    el.setSelectionRange(start, end)
  }

  return (
    <div data-slot="reading-level" data-state={unsupported ? "unsupported" : above ? "above" : "ok"} className={cn("grid w-full max-w-md gap-1.5 text-sm", className)}>
      <label htmlFor={fieldId} className="font-medium">{label}</label>
      <div className="relative rounded-md border shadow-xs transition-[color,box-shadow] focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50 dark:bg-input/30">
        <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden whitespace-pre-wrap break-words px-3 py-2 text-base text-transparent md:text-sm">
          {segments(text, report).map((part, i) => (part.tone ? <mark key={i} className={cn("rounded-sm text-transparent", part.tone)}>{part.text}</mark> : part.text))}
          {"\u200b"}
        </div>
        <textarea
          ref={field}
          id={fieldId}
          value={text}
          rows={4}
          onChange={(event) => set(event.target.value)}
          aria-describedby={`${fieldId}-grade`}
          className="relative block min-h-24 w-full resize-none overflow-hidden break-words bg-transparent px-3 py-2 text-base outline-none placeholder:text-muted-foreground md:text-sm"
          {...props}
        />
      </div>

      <div id={`${fieldId}-grade`} className="grid gap-1.5 pt-0.5">
        {unsupported ? (
          <div className="grid gap-0.5">
            <p className="flex items-center gap-1.5 font-medium text-muted-foreground">
              <Languages aria-hidden className="size-4" />
              {unsupportedText}
            </p>
            <p className="text-xs text-muted-foreground">{unsupportedHint}</p>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
              <p className={cn("flex items-center gap-1.5 font-medium", above ? "text-amber-700 dark:text-amber-400" : "text-emerald-700 dark:text-emerald-400")}>
                <BookOpen aria-hidden className="size-4" />
                {report.words ? gradeText.replace("{grade}", String(grade)) : "–"}
                {report.words > 0 && band && <span className="font-normal text-muted-foreground">· {band}</span>}
              </p>
              <p className="text-xs text-muted-foreground">{targetText.replace("{target}", String(targetGrade))}</p>
            </div>
            <div className="relative h-1.5 rounded-full bg-muted" aria-hidden>
              <div className={cn("h-full rounded-full motion-safe:transition-[width] motion-safe:duration-300 motion-safe:ease-out", above ? "bg-amber-500" : "bg-emerald-500")} style={{ width: `${Math.min(100, (report.grade / 18) * 100)}%` }} />
              <div className="absolute -top-1 h-3.5 w-0.5 rounded-full bg-foreground/70" style={{ left: `${(targetGrade / 18) * 100}%` }} />
            </div>
          </>
        )}
        <p aria-live="polite" className="sr-only">{unsupported ? unsupportedText : report.words ? (above ? aboveTargetText : onTargetText) : ""}</p>
      </div>

      {hardest.length > 0 && (
        <div className="grid gap-1.5 pt-1">
          <p className="text-xs font-medium text-muted-foreground">{hardTitle}</p>
          <ul className="grid gap-1">
            {hardest.map((s) => (
              <li key={s.start}>
                <button type="button" onClick={() => select(s.start, s.end)} className="flex w-full min-w-0 gap-2 rounded-md p-1.5 text-left outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50">
                  <span className={cn("mt-1 size-2.5 shrink-0 rounded-full", s.difficulty === "very-hard" ? "bg-red-500" : "bg-amber-500")} aria-hidden />
                  <span className="grid min-w-0 gap-0.5">
                    <span className="line-clamp-2 text-sm">{text.slice(s.start, s.end)}</span>
                    <span className="text-xs text-muted-foreground">
                      {gradeText.replace("{grade}", String(Math.round(s.grade)))} · {[s.long && longText.replace("{words}", String(s.words)), s.dense && denseText].filter(Boolean).join(" ") || longText.replace("{words}", String(s.words))}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {swapList.length > 0 && (
        <div className="grid gap-1.5 pt-1">
          <p className="text-xs font-medium text-muted-foreground">{swapsTitle}</p>
          <div ref={chips} className="flex flex-wrap gap-1.5">
            {swapList.map((s, index) => (
              <button key={s.word.toLowerCase()} type="button" onClick={() => swap(s.word, s.plain, index)} aria-label={swapLabel.replace("{word}", s.word.toLowerCase()).replace("{plain}", s.plain)} className={chipClass}>
                <span className="text-muted-foreground">{s.word.toLowerCase()}</span>
                <ArrowRight aria-hidden className="size-3 text-muted-foreground" />
                <span className="font-medium">{s.plain}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
