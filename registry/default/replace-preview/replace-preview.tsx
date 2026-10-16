"use client"

import * as React from "react"
import { ALargeSmall, CaseSensitive, Replace, TriangleAlert, Undo2, WholeWord } from "lucide-react"

import { cn } from "@/lib/utils"

export interface ReplaceMatch {
  /** Offset of the match in the text. */
  index: number
  /** The matched characters, as written. */
  text: string
  /** The whole word the match sits in, e.g. "category" for "cat". */
  word: string
  /** True when the match is only part of a longer word. */
  partial: boolean
}

const wordChar = /[\p{L}\p{N}_]/u
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")

/** Every match of `query` in `text`, each marked when it sits inside a longer word. */
export function findMatches(text: string, query: string, { matchCase = false, wholeWord = false } = {}): ReplaceMatch[] {
  if (!query) return []
  const matches: ReplaceMatch[] = []
  for (const m of text.matchAll(new RegExp(escape(query), matchCase ? "gu" : "giu"))) {
    let start = m.index
    let end = start + m[0].length
    const partial = (start > 0 && wordChar.test(text[start - 1])) || (end < text.length && wordChar.test(text[end]))
    if (wholeWord && partial) continue
    while (start > 0 && wordChar.test(text[start - 1])) start--
    while (end < text.length && wordChar.test(text[end])) end++
    matches.push({ index: m.index, text: m[0], word: text.slice(start, end), partial })
  }
  return matches
}

/** Gives `replacement` the casing of `match`: CAT → DOG, Cat → Dog, cat → dog. */
export function preserveCase(match: string, replacement: string) {
  if (!/\p{L}/u.test(match)) return replacement
  if (match === match.toUpperCase() && match.length > 1) return replacement.toUpperCase()
  if (match === match.toLowerCase()) return replacement.toLowerCase()
  if (match[0] === match[0].toUpperCase() && match.slice(1) === match.slice(1).toLowerCase())
    return replacement.charAt(0).toUpperCase() + replacement.slice(1)
  return replacement
}

/** Replaces the given matches, back to front so earlier offsets stay valid. */
export function applyReplacements(text: string, matches: ReplaceMatch[], replacement: string, keepCase = true) {
  return [...matches]
    .sort((a, b) => b.index - a.index)
    .reduce((out, m) => out.slice(0, m.index) + (keepCase ? preserveCase(m.text, replacement) : replacement) + out.slice(m.index + m.text.length), text)
}

/** Up to `radius` characters either side of a match, on its own line. */
function context(text: string, m: ReplaceMatch, radius = 22) {
  const lineStart = text.lastIndexOf("\n", m.index - 1) + 1
  const lineEnd = text.indexOf("\n", m.index) === -1 ? text.length : text.indexOf("\n", m.index)
  const from = Math.max(lineStart, m.index - radius)
  const to = Math.min(lineEnd, m.index + m.text.length + radius)
  return {
    before: (from > lineStart ? "…" : "") + text.slice(from, m.index),
    after: text.slice(m.index + m.text.length, to) + (to < lineEnd ? "…" : ""),
  }
}

export interface ReplacePreviewProps extends Omit<React.ComponentProps<"div">, "defaultValue" | "onChange"> {
  /** Controlled text being edited. */
  value?: string
  /** Initial text when uncontrolled. */
  defaultValue?: string
  /** Called with the new text after Replace or Undo. */
  onValueChange?: (value: string) => void
  /** Initial search term. */
  defaultFind?: string
  /** Initial replacement. */
  defaultReplace?: string
  /** Start with whole-word matching on. */
  defaultWholeWord?: boolean
  findLabel?: string
  replaceLabel?: string
  /** Templates: `{count}` and `{words}` are filled in. */
  partialMessage?: string
  wholeWordFixLabel?: string
  noMatchesText?: string
  /** `{count}` and `{total}` are filled in. */
  applyLabel?: string
  /** `{count}` is filled in. */
  doneText?: string
  undoLabel?: string
}

const field =
  "h-9 w-full min-w-0 rounded-md border bg-transparent px-3 text-base shadow-xs transition-[color,box-shadow] outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 md:text-sm dark:bg-input/30"
const toggle =
  "inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-xs font-medium text-muted-foreground transition-colors outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-pressed:border-primary/40 aria-pressed:bg-primary/10 aria-pressed:text-foreground"
const fix =
  "inline-flex h-6 items-center gap-1 rounded-md border border-amber-500/40 px-2 font-medium text-amber-900 transition-colors hover:bg-amber-500/10 dark:text-amber-200 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
const fill = (t: string, v: Record<string, string | number>) => t.replace(/\{(\w+)\}/g, (m, k: string) => String(v[k] ?? m))

/**
 * Find & replace-all that shows every match in context before anything
 * changes, so "cat → dog" can't quietly turn "category" into "dogegory".
 * Matches inside longer words are flagged, named and skipped unless you tick
 * them back on, whole-word is one tap,
 * case is preserved (CAT → DOG), each match can be skipped, and the replace
 * can be undone.
 */
export function ReplacePreview({
  value,
  defaultValue = "",
  onValueChange,
  defaultFind = "",
  defaultReplace = "",
  defaultWholeWord = false,
  findLabel = "Find",
  replaceLabel = "Replace with",
  partialMessage = "{count} inside other words ({words}), skipped.",
  wholeWordFixLabel = "Whole words only",
  noMatchesText = "No matches.",
  applyLabel = "Replace {count} of {total}",
  doneText = "Replaced {count}.",
  undoLabel = "Undo",
  className,
  ...props
}: ReplacePreviewProps) {
  const [inner, setInner] = React.useState(defaultValue)
  const [find, setFind] = React.useState(defaultFind)
  const [replace, setReplace] = React.useState(defaultReplace)
  const [matchCase, setMatchCase] = React.useState(false)
  const [wholeWord, setWholeWord] = React.useState(defaultWholeWord)
  const [keepCase, setKeepCase] = React.useState(true)
  const [skipped, setSkipped] = React.useState<Set<number>>(() => new Set())
  const [undo, setUndo] = React.useState<{ before: string; after: string; count: number }>()
  const id = React.useId()
  const text = value ?? inner

  const matches = React.useMemo(() => findMatches(text, find, { matchCase, wholeWord }), [text, find, matchCase, wholeWord])
  // Matches inside longer words start skipped: replacing them is rarely what anyone meant.
  React.useEffect(() => setSkipped(new Set(matches.filter((m) => m.partial).map((m) => m.index))), [matches])

  const update = (next: string) => {
    if (value === undefined) setInner(next)
    onValueChange?.(next)
  }
  const chosen = matches.filter((m) => !skipped.has(m.index))
  const partials = matches.filter((m) => m.partial)
  const words = [...new Set(partials.map((m) => m.word))]
  const shownWords = words.slice(0, 3).join(", ") + (words.length > 3 ? ` +${words.length - 3}` : "")
  const pending = undo && undo.after === text

  const apply = () => {
    const after = applyReplacements(text, chosen, replace, keepCase)
    setUndo({ before: text, after, count: chosen.length })
    update(after)
  }
  const flip = (index: number) =>
    setSkipped((prev) => {
      const next = new Set(prev)
      if (!next.delete(index)) next.add(index)
      return next
    })

  return (
    <div data-slot="replace-preview" className={cn("grid w-full max-w-md gap-3", className)} {...props}>
      <style>{"@keyframes cui-replace-preview-in{from{opacity:0;transform:translateY(-3px)}}"}</style>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1.5 text-sm font-medium">
          {findLabel}
          <input value={find} onChange={(e) => setFind(e.target.value)} spellCheck={false} className={field} />
        </label>
        <label className="grid gap-1.5 text-sm font-medium">
          {replaceLabel}
          <input value={replace} onChange={(e) => setReplace(e.target.value)} spellCheck={false} className={field} />
        </label>
      </div>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Match options">
        <button type="button" aria-pressed={matchCase} onClick={() => setMatchCase(!matchCase)} className={toggle}>
          <CaseSensitive aria-hidden className="size-4" /> Match case
        </button>
        <button type="button" aria-pressed={wholeWord} onClick={() => setWholeWord(!wholeWord)} className={toggle}>
          <WholeWord aria-hidden className="size-4" /> Whole word
        </button>
        <button type="button" aria-pressed={keepCase} onClick={() => setKeepCase(!keepCase)} className={toggle}>
          <ALargeSmall aria-hidden className="size-4" /> Preserve case
        </button>
      </div>

      <div aria-live="polite" className="min-h-6 text-xs">
        {partials.length > 0 && (
          <p className="flex gap-1.5 text-amber-700 dark:text-amber-400">
            <span className="flex h-6 shrink-0 items-center">
              <TriangleAlert aria-hidden className="size-3.5" />
            </span>
            <span className="flex min-w-0 flex-wrap items-center gap-x-2">
              <span className="py-1">{fill(partialMessage, { count: partials.length, words: shownWords })}</span>
              <button type="button" onClick={() => setWholeWord(true)} className={fix}>
                {wholeWordFixLabel}
              </button>
            </span>
          </p>
        )}
      </div>

      {find && (
        <ul aria-label={`${matches.length} matches`} className="-mt-2 max-h-56 divide-y overflow-auto rounded-md border text-sm">
          {matches.length === 0 && <li className="px-3 py-2 text-muted-foreground">{noMatchesText}</li>}
          {matches.map((m) => {
            const { before, after } = context(text, m)
            const on = !skipped.has(m.index)
            return (
              <li key={m.index} data-partial={m.partial || undefined} className={cn("flex items-start gap-2.5 px-3 py-2 transition-colors", m.partial && "bg-amber-500/5", !on && "opacity-55")}>
                <input
                  type="checkbox"
                  checked={on}
                  onChange={() => flip(m.index)}
                  aria-label={`${on ? "Skip" : "Include"} "${m.word}" match`}
                  id={`${id}-${m.index}`}
                  className="mt-0.5 size-4 shrink-0 accent-primary outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                />
                <label htmlFor={`${id}-${m.index}`} className="min-w-0 flex-1 cursor-pointer leading-5 break-words">
                  <span className="text-muted-foreground">{before}</span>
                  <del className="rounded-sm bg-red-500/15 text-red-800 decoration-red-500/60 dark:text-red-300">{m.text}</del>
                  {on && (
                    <ins className="rounded-sm bg-emerald-500/15 text-emerald-800 no-underline dark:text-emerald-300">
                      {keepCase ? preserveCase(m.text, replace) : replace}
                    </ins>
                  )}
                  <span className="text-muted-foreground">{after}</span>
                  {m.partial && <span className="ml-1.5 text-xs font-medium text-amber-700 dark:text-amber-400">in “{m.word}”</span>}
                </label>
              </li>
            )
          })}
        </ul>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={chosen.length === 0}
          onClick={apply}
          className="inline-flex h-9 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow-xs transition-colors outline-none hover:bg-primary/90 focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50"
        >
          <Replace aria-hidden className="size-4" />
          {fill(applyLabel, { count: chosen.length, total: matches.length })}
        </button>
        <p aria-live="polite" className="min-w-0 text-sm">
          {pending && (
            <span className="inline-flex items-center gap-2 motion-safe:animate-[cui-replace-preview-in_200ms_ease-out]">
              <span className="text-emerald-700 dark:text-emerald-400">{fill(doneText, { count: undo.count })}</span>
              <button
                type="button"
                onClick={() => {
                  update(undo.before)
                  setUndo(undefined)
                }}
                className="inline-flex h-8 items-center gap-1.5 rounded-md border px-3 text-sm font-medium transition-colors outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                <Undo2 aria-hidden className="size-4" /> {undoLabel}
              </button>
            </span>
          )}
        </p>
      </div>
    </div>
  )
}
