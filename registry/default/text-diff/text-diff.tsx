import * as React from "react"
import { EyeOff, Hash } from "lucide-react"

import { cn } from "@/lib/utils"

export type DiffPart = { type: "equal" | "insert" | "delete"; value: string }

/** Whitespace, numbers (1,250.50 stays one token), words, then single symbols. */
function tokenize(text: string) {
  return text.match(/\s+|\p{N}+(?:[.,:]\p{N}+)*|[\p{L}\p{N}_'-]+|[^\s\p{L}\p{N}_]/gu) ?? []
}

const isBlank = (text: string) => /^\s+$/.test(text)

/** Myers' shortest edit script over tokens, or null when it would need more than `budget` steps of memory. */
function editScript(a: string[], b: string[], budget: number): DiffPart[] | null {
  const n = a.length
  const m = b.length
  const offset = n + m + 1
  const v = new Int32Array(2 * offset + 1)
  const trace: Int32Array[] = []
  let used = 0
  for (let d = 0; d <= n + m; d++) {
    // Only diagonals -d..d are live at this depth, so keep just that slice for the backtrack.
    trace.push(v.slice(offset - d, offset + d + 1))
    used += 2 * d + 1
    if (used > budget) return null
    for (let k = -d; k <= d; k += 2) {
      let x = k === -d || (k !== d && v[offset + k - 1] < v[offset + k + 1]) ? v[offset + k + 1] : v[offset + k - 1] + 1
      let y = x - k
      while (x < n && y < m && a[x] === b[y]) {
        x++
        y++
      }
      v[offset + k] = x
      if (x >= n && y >= m) return backtrack(a, b, trace, d, k)
    }
  }
  return null
}

function backtrack(a: string[], b: string[], trace: Int32Array[], depth: number, endK: number) {
  const ops: DiffPart[] = []
  let x = a.length
  let y = b.length
  let k = endK
  for (let d = depth; d > 0; d--) {
    const prev = trace[d] // the V before step d, sliced to diagonals -d..d
    const at = (diag: number) => prev[diag + d]
    const down = k === -d || (k !== d && at(k - 1) < at(k + 1))
    const prevK = down ? k + 1 : k - 1
    const prevX = at(prevK)
    const prevY = prevX - prevK
    while (x > prevX && y > prevY) ops.push({ type: "equal", value: a[--x] }), y--
    if (down) ops.push({ type: "insert", value: b[--y] })
    else ops.push({ type: "delete", value: a[--x] })
    k = prevK
  }
  while (x > 0 && y > 0) ops.push({ type: "equal", value: a[--x] }), y--
  return ops.reverse()
}

/**
 * Word-level diff (Myers' algorithm on word tokens), cheap when the texts are mostly the
 * same however long they are. If two texts differ almost everywhere and are long enough to
 * stall the page (over `maxCost`), the changed part is shown as one removal plus one
 * addition instead. A lone space between two changes is folded into them, so a rewritten
 * phrase reads as one removal and one addition instead of word-by-word confetti. Within a
 * change, removals come before additions.
 */
export function diffWords(before: string, after: string, { maxCost = 4_000_000 }: { maxCost?: number } = {}): DiffPart[] {
  const a = tokenize(before)
  const b = tokenize(after)
  let start = 0
  while (start < a.length && start < b.length && a[start] === b[start]) start++
  let endA = a.length
  let endB = b.length
  while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) {
    endA--
    endB--
  }
  const midA = a.slice(start, endA)
  const midB = b.slice(start, endB)
  const middle = editScript(midA, midB, maxCost) ?? [
    ...midA.map((value) => ({ type: "delete" as const, value })),
    ...midB.map((value) => ({ type: "insert" as const, value })),
  ]
  const equal = (value: string) => ({ type: "equal" as const, value })
  const ops: DiffPart[] = [...a.slice(0, start).map(equal), ...middle, ...a.slice(endA).map(equal)]

  const parts: DiffPart[] = []
  const push = (type: DiffPart["type"], value: string) => {
    if (!value) return
    const last = parts[parts.length - 1]
    if (last?.type === type) last.value += value
    else parts.push({ type, value })
  }
  const changed = (op?: DiffPart) => op !== undefined && op.type !== "equal"
  for (let k = 0; k < ops.length; ) {
    if (!changed(ops[k])) {
      push("equal", ops[k++].value)
      continue
    }
    let removed = ""
    let added = ""
    while (k < ops.length) {
      const op = ops[k]
      if (op.type === "delete") removed += op.value
      else if (op.type === "insert") added += op.value
      else if (isBlank(op.value) && changed(ops[k + 1])) {
        removed += op.value
        added += op.value
      } else break
      k++
    }
    push("delete", removed)
    push("insert", added)
  }
  return parts
}

/** Characters that change text without being seen: zero-width marks, NBSP, BOM. */
const INVISIBLE = /[\u00A0\u200B-\u200D\u2060\uFEFF]/
const MARKERS: Record<string, string> = { " ": "·", "\t": "⇥", "\n": "⏎\n", "\u00A0": "⍽", "\u200B": "∅", "\u200C": "∅", "\u200D": "∅", "\u2060": "∅", "\uFEFF": "∅" }
const NUMBER = /\p{N}+(?:[.,:]\p{N}+)*/gu

/** True when a change would be invisible on screen: only whitespace, or a zero-width or no-break character. */
export function isInvisibleChange(value: string) {
  return isBlank(value) || INVISIBLE.test(value)
}

export interface DiffSummary {
  /** Words added and removed. */
  added: number
  removed: number
  /** Numbers that changed, paired by position within each change: { from: "30", to: "60" }. */
  numbers: { from: string; to: string }[]
  /** Changes you couldn't see without markers. */
  invisible: number
}

const words = (text: string) => text.match(/\p{N}+(?:[.,:]\p{N}+)*|[\p{L}\p{N}_'-]+/gu)?.length ?? 0

/** Counts a diff and pulls out the changes that are easy to miss: numbers and invisible edits. */
export function summarizeDiff(parts: DiffPart[]): DiffSummary {
  const summary: DiffSummary = { added: 0, removed: 0, numbers: [], invisible: 0 }
  for (let k = 0; k < parts.length; k++) {
    const part = parts[k]
    if (part.type === "equal") continue
    // A change is a removal, an addition, or a removal followed by its replacement.
    const removed = part.type === "delete" ? part.value : ""
    const added = part.type === "insert" ? part.value : parts[k + 1]?.type === "insert" ? parts[++k].value : ""
    summary.added += words(added)
    summary.removed += words(removed)
    if (isInvisibleChange(removed) || isInvisibleChange(added)) summary.invisible++
    const from = removed.match(NUMBER) ?? []
    const to = added.match(NUMBER) ?? []
    for (let n = 0; n < Math.max(from.length, to.length); n++) {
      if (from[n] !== to[n]) summary.numbers.push({ from: from[n] ?? "—", to: to[n] ?? "—" })
    }
  }
  return summary
}

/** Draws whitespace and zero-width characters so a change made of them can be seen. */
function showInvisible(value: string) {
  return isInvisibleChange(value) ? Array.from(value, (ch) => MARKERS[ch] ?? ch).join("") : value
}

export interface TextDiffProps extends React.ComponentProps<"div"> {
  /** The original text. */
  before: string
  /** The changed text. */
  after: string
  /** `inline` interleaves changes; `split` shows before and after side by side. */
  view?: "inline" | "split"
  /** Show the word counts and the "numbers changed" / "invisible change" callouts. */
  showStats?: boolean
  /** Heading of the left column in split view. */
  beforeLabel?: string
  /** Heading of the right column in split view. */
  afterLabel?: string
  /** Templates: `{count}` is filled in. */
  addedText?: string
  removedText?: string
  /** Lead-in before the changed numbers ("30 → 14, 4417 → 4471"). */
  numbersText?: (count: number) => string
  invisibleText?: (count: number) => string
  /** Shown instead of the stats when the two texts are the same. */
  identicalText?: string
  /** Read before each change by screen readers. */
  srAddedLabel?: string
  srRemovedLabel?: string
}

const fill = (template: string, count: number) => template.replace("{count}", String(count))

const styles = {
  insert: "rounded-sm bg-emerald-500/15 text-emerald-800 no-underline dark:text-emerald-300",
  delete: "rounded-sm bg-red-500/15 text-red-800 line-through decoration-red-500/60 dark:text-red-300",
  invisible: "px-0.5 font-mono ring-1 ring-current/40",
}

/**
 * Shows exactly what changed between two texts, word by word, so nobody
 * approves an edit they didn't see. Changed numbers are called out
 * ("30 → 60") and invisible edits (a doubled space, a line break, a
 * zero-width character) are drawn with markers instead of vanishing.
 */
export function TextDiff({
  before,
  after,
  view = "inline",
  showStats = true,
  beforeLabel = "Before",
  afterLabel = "After",
  addedText = "+{count} added",
  removedText = "−{count} removed",
  numbersText = (count) => (count === 1 ? "Number changed:" : `${count} numbers changed:`),
  invisibleText = (count) => (count === 1 ? "1 invisible change" : `${count} invisible changes`),
  identicalText = "No changes",
  srAddedLabel = "added: ",
  srRemovedLabel = "removed: ",
  className,
  ...props
}: TextDiffProps) {
  const parts = React.useMemo(() => diffWords(before, after), [before, after])
  const summary = React.useMemo(() => summarizeDiff(parts), [parts])
  const identical = parts.every((part) => part.type === "equal")

  const render = (skip: DiffPart["type"] | null) =>
    parts.map((part, index) => {
      if (part.type === skip) return null
      if (part.type === "equal") return <span key={index}>{part.value}</span>
      const Tag = part.type === "insert" ? "ins" : "del"
      const hidden = isInvisibleChange(part.value)
      return (
        <Tag key={index} title={hidden ? "Invisible characters" : undefined} className={cn(styles[part.type], hidden && styles.invisible, !skip && parts[index - 1]?.type === "delete" && "ml-0.5")}>
          <span className="sr-only">{part.type === "insert" ? srAddedLabel : srRemovedLabel}</span>
          {showInvisible(part.value)}
        </Tag>
      )
    })

  const paragraph = "px-4 py-3 leading-relaxed break-words whitespace-pre-wrap"

  return (
    <div data-slot="text-diff" className={cn("rounded-lg border bg-card text-sm text-card-foreground", className)} {...props}>
      {showStats && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b px-4 py-2 text-xs font-medium">
          {identical ? (
            <span className="text-muted-foreground">{identicalText}</span>
          ) : (
            <>
              <span className="text-emerald-700 dark:text-emerald-400">{fill(addedText, summary.added)}</span>
              <span className="text-red-700 dark:text-red-400">{fill(removedText, summary.removed)}</span>
            </>
          )}
          {summary.numbers.length > 0 && (
            <span className="inline-flex flex-wrap items-center gap-1 rounded-md bg-amber-100 px-2 py-0.5 text-amber-900 dark:bg-amber-500/15 dark:text-amber-200">
              <Hash aria-hidden className="size-3" />
              {numbersText(summary.numbers.length)}{" "}
              <span className="font-mono">{summary.numbers.map((change) => `${change.from} → ${change.to}`).join(", ")}</span>
            </span>
          )}
          {summary.invisible > 0 && (
            <span className="inline-flex flex-wrap items-center gap-1 rounded-md bg-amber-100 px-2 py-0.5 text-amber-900 dark:bg-amber-500/15 dark:text-amber-200">
              <EyeOff aria-hidden className="size-3" />
              {invisibleText(summary.invisible)}
            </span>
          )}
        </div>
      )}
      {view === "inline" ? (
        <p className={paragraph}>{render(null)}</p>
      ) : (
        <div className="grid divide-y sm:grid-cols-2 sm:divide-x sm:divide-y-0">
          <p className={paragraph}>
            <span className="mb-1 block text-xs font-medium text-muted-foreground">{beforeLabel}</span>
            {render("insert")}
          </p>
          <p className={paragraph}>
            <span className="mb-1 block text-xs font-medium text-muted-foreground">{afterLabel}</span>
            {render("delete")}
          </p>
        </div>
      )}
    </div>
  )
}
