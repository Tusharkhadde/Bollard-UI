"use client"

import * as React from "react"
import { ArrowDown, ArrowUp, Minus, UserMinus } from "lucide-react"

import { cn } from "@/lib/utils"

export interface RankEntry {
  id: string
  name: string
  score: number
  /** How many games, ratings or attempts the score is based on. */
  samples?: number
  /** Rank last period: a number, `null` if they were not ranked then, or leave it out to show no movement. */
  previousRank?: number | null
}

export interface RankedRow {
  entry: RankEntry
  rank: number
  tied: boolean
  /** Places gained since last period (negative means dropped), "new", or null when unknown. */
  move: number | "new" | null
}

export interface RankOptions {
  /** Set false for times, golf scores and anything where lower wins. */
  higherIsBetter?: boolean
  /** Entries with fewer samples are listed but not ranked, and don't push anyone down. */
  minSamples?: number
  /** Decimals shown. Scores are compared as displayed, so two scores that look equal always share a rank. */
  decimals?: number
}

/**
 * Standard competition ranking ("1224"): tied entries share the better rank and the next rank is
 * skipped, so a 4th place really has three people ahead of it. Unqualified entries are set aside with
 * the rank they would have had.
 */
export function rankEntries(entries: RankEntry[], { higherIsBetter = true, minSamples = 0, decimals = 1 }: RankOptions = {}) {
  const key = (e: RankEntry) => Number(e.score.toFixed(decimals)) * (higherIsBetter ? -1 : 1)
  const sorted = [...entries].sort((a, b) => key(a) - key(b) || a.name.localeCompare(b.name))
  const eligible = sorted.filter((e) => (e.samples ?? Infinity) >= minSamples)
  const rankOf = (e: RankEntry) => 1 + eligible.filter((o) => key(o) < key(e)).length
  const ranked: RankedRow[] = eligible.map((entry) => {
    const rank = rankOf(entry)
    const move = entry.previousRank === undefined ? null : entry.previousRank === null ? "new" : entry.previousRank - rank
    return { entry, rank, tied: eligible.some((o) => o !== entry && key(o) === key(entry)), move }
  })
  const unranked = sorted.filter((e) => !eligible.includes(e)).map((entry) => ({ entry, wouldBe: rankOf(entry) }))
  return { ranked, unranked }
}

/** English ordinal: 1st, 2nd, 3rd, 4th, 11th, 22nd. Pass your own `formatOrdinal` for other languages. */
export const englishOrdinal = (n: number) => `${n}${["th", "st", "nd", "rd"][n % 100 > 10 && n % 100 < 14 ? 0 : n % 10 < 4 ? n % 10 : 0]}`
const fill = (t: string, v: Record<string, string | number>) => t.replace(/\{(\w+)\}/g, (m, key: string) => String(v[key] ?? m))

export interface FairRankProps extends Omit<React.ComponentProps<"div">, "children">, RankOptions {
  entries: RankEntry[]
  /** Table caption, e.g. "CSAT, October". */
  caption?: string
  /** Formats a score for display; receives the score already rounded to `decimals`. */
  format?: (score: string) => string
  /** Noun for samples, e.g. "ratings". */
  samplesLabel?: string
  /** Templates: `{min}`, `{has}`, `{samples}`, `{rank}`. */
  unrankedText?: string
  tieNote?: string
  newLabel?: string
  /** Turns a rank into words for screen readers and the unranked note: 3 → "3rd". */
  formatOrdinal?: (rank: number) => string
  /** Shown before a tied rank: "T-" gives T-2. */
  tiedPrefix?: string
  /** Screen reader text for a tied rank. `{rank}` is the ordinal. */
  tiedText?: string
  /** Screen reader text for movement. */
  noChangeLabel?: string
  upLabel?: string
  downLabel?: string
  /** Hidden column headers, read by screen readers. */
  columnLabels?: { rank?: string; name?: string; score?: string; change?: string }
  /** Name of the list of entries that aren't ranked yet. */
  unrankedLabel?: string
}

/**
 * A leaderboard that ranks fairly. Ties share a rank shown as T-2 and the next rank is skipped, scores
 * are compared at the precision people see, movement since last period is shown per row (rows slide in
 * from where they were), and entries below the minimum sample are greyed out with the reason and the
 * rank they would have had, instead of quietly topping the board.
 */
export function FairRank({
  entries,
  higherIsBetter = true,
  minSamples = 0,
  decimals = 1,
  caption,
  format = (s) => s,
  samplesLabel = "samples",
  unrankedText = "Not ranked: needs {min} {samples}, has {has}. Would be {rank}.",
  tieNote = "T = tied. Tied entries share a rank, so the next rank is skipped (1, T-2, T-2, 4).",
  newLabel = "New",
  formatOrdinal = englishOrdinal,
  tiedPrefix = "T-",
  tiedText = "Tied {rank}",
  noChangeLabel = "No change",
  upLabel = "Up",
  downLabel = "Down",
  columnLabels,
  unrankedLabel = "Not ranked yet",
  className,
  ...props
}: FairRankProps) {
  const { ranked, unranked } = rankEntries(entries, { higherIsBetter, minSamples, decimals })
  const rows = React.useRef(new Map<string, HTMLTableRowElement>())
  const lastTops = React.useRef<Map<string, number>>(null)
  const order = ranked.map((r) => r.entry.id).join()

  // Rows slide from where they were: last period's rank on first paint, their old row after an update.
  React.useLayoutEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    const tops = new Map([...rows.current].map(([id, el]) => [id, el.getBoundingClientRect().top]))
    const height = rows.current.values().next().value?.getBoundingClientRect().height ?? 0
    ranked.forEach(({ entry, move }, index) => {
      const el = rows.current.get(entry.id)
      const top = tops.get(entry.id)
      if (!el || top === undefined || reduce) return
      const before = lastTops.current ? lastTops.current.get(entry.id) : typeof move === "number" && move !== 0 ? top + Math.max(-index, Math.min(move, ranked.length - 1 - index)) * height : undefined
      if (before === undefined || before === top) return
      el.animate([{ transform: `translateY(${before - top}px)` }, { transform: "none" }], { duration: 400, easing: "cubic-bezier(.2,.8,.2,1)" })
    })
    lastTops.current = tops
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order])

  const tied = ranked.some((r) => r.tied)
  return (
    <div data-slot="fair-rank" className={cn("grid w-full max-w-sm gap-2", className)} {...props}>
      <table className="w-full table-fixed border-separate border-spacing-0 text-sm">
        {caption && <caption className="pb-2 text-left font-medium">{caption}</caption>}
        <colgroup>
          <col className="w-10" />
          <col />
          <col className="w-16" />
          <col className="w-11" />
        </colgroup>
        <thead className="sr-only">
          <tr>
            <th scope="col">{columnLabels?.rank ?? "Rank"}</th>
            <th scope="col">{columnLabels?.name ?? "Name"}</th>
            <th scope="col">{columnLabels?.score ?? "Score"}</th>
            <th scope="col">{columnLabels?.change ?? "Change"}</th>
          </tr>
        </thead>
        <tbody>
          {ranked.map(({ entry, rank, tied: isTied, move }) => (
            <tr
              key={entry.id}
              ref={(el) => void (el ? rows.current.set(entry.id, el) : rows.current.delete(entry.id))}
              className="relative bg-card [&>td]:h-9 [&>td]:border-b [&>td]:px-1.5"
            >
              <td className="font-medium tabular-nums">
                <span aria-hidden className={cn(isTied && "text-amber-700 dark:text-amber-400")}>{isTied ? `${tiedPrefix}${rank}` : rank}</span>
                <span className="sr-only">{isTied ? fill(tiedText, { rank: formatOrdinal(rank) }) : formatOrdinal(rank)}</span>
              </td>
              <td className="truncate">{entry.name}</td>
              <td className="text-right tabular-nums">{format(entry.score.toFixed(decimals))}</td>
              <td className="text-right text-xs tabular-nums">
                {move === "new" ? (
                  <span className="rounded-sm bg-sky-500/15 px-1 py-0.5 font-medium text-sky-800 dark:text-sky-300">{newLabel}</span>
                ) : move === null ? null : move === 0 ? (
                  <span className="inline-flex items-center text-muted-foreground"><Minus aria-hidden className="size-3.5" /><span className="sr-only">{noChangeLabel}</span></span>
                ) : (
                  <span className={cn("inline-flex items-center gap-0.5 font-medium", move > 0 ? "text-emerald-700 dark:text-emerald-400" : "text-red-700 dark:text-red-400")}>
                    {move > 0 ? <ArrowUp aria-hidden className="size-3.5" /> : <ArrowDown aria-hidden className="size-3.5" />}
                    <span className="sr-only">{move > 0 ? upLabel : downLabel}</span>
                    {Math.abs(move)}
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {unranked.length > 0 && (
        <ul aria-label={unrankedLabel} className="grid gap-1.5">
          {unranked.map(({ entry, wouldBe }) => (
            <li key={entry.id} className="grid grid-cols-[auto_1fr_auto] items-start gap-x-2 rounded-md border border-dashed px-2 py-1.5 text-sm text-muted-foreground">
              <UserMinus aria-hidden className="mt-0.5 size-4" />
              <span className="min-w-0">
                <span className="block truncate">{entry.name}</span>
                <span className="block text-xs">
                  {fill(unrankedText, { min: minSamples, has: entry.samples ?? 0, samples: samplesLabel, rank: formatOrdinal(wouldBe) })}
                </span>
              </span>
              <span className="tabular-nums line-through decoration-muted-foreground/50">{format(entry.score.toFixed(decimals))}</span>
            </li>
          ))}
        </ul>
      )}
      {tied && <p className="text-xs text-muted-foreground">{tieNote}</p>}
    </div>
  )
}
