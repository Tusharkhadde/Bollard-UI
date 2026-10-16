"use client"

import * as React from "react"
import { Scale, Split, Star, TriangleAlert } from "lucide-react"

import { cn } from "@/lib/utils"

/** Review counts for 1★ to 5★, in that order. */
export type RatingDistribution = readonly [number, number, number, number, number]

export interface RatingPrior {
  /** Rating new items are pulled toward: your catalogue's mean. */
  mean: number
  /** How many reviews it takes to outweigh the prior. */
  weight: number
}

export const DEFAULT_PRIOR: RatingPrior = { mean: 3.5, weight: 10 }

/**
 * Bayesian average for sorting (the IMDb Top 250 formula): (C·m + Σ stars) / (C + n).
 * A 5.0 from 2 reviews no longer outranks a 4.6 from 900.
 */
export function bayesianScore(distribution: RatingDistribution, { mean, weight }: RatingPrior = DEFAULT_PRIOR) {
  const n = distribution.reduce((a, b) => a + b, 0)
  const stars = distribution.reduce((sum, count, i) => sum + count * (i + 1), 0)
  return (weight * mean + stars) / (weight + n)
}

/**
 * Count, mean, shares, a likely range for the true average (Evan Miller's Dirichlet approximation with a
 * light prior of one pseudo-review spread across the stars, 90%) and whether opinions split into love-it and hate-it camps.
 */
export function ratingStats(distribution: RatingDistribution) {
  const count = distribution.reduce((a, b) => a + b, 0)
  const mean = count ? distribution.reduce((s, c, i) => s + c * (i + 1), 0) / count : 0
  const shares = distribution.map((c) => (count ? c / count : 0))
  const k = distribution.length
  const a = 1 / k
  const m1 = distribution.reduce((s, c, i) => s + (i + 1) * (c + a), 0) / (count + 1)
  const m2 = distribution.reduce((s, c, i) => s + (i + 1) ** 2 * (c + a), 0) / (count + 1)
  const sd = Math.sqrt((m2 - m1 * m1) / (count + 2))
  const range: [number, number] = [Math.max(1, m1 - 1.65 * sd), Math.min(5, m1 + 1.65 * sd)]
  const middle = shares[1] + shares[2] + shares[3]
  const polarized = count >= 10 && shares[0] >= 0.2 && shares[4] >= 0.3 && middle <= 0.35
  return { count, mean, shares, range, polarized }
}

const one = (x: number) => (Math.round(x * 10) / 10).toFixed(1)
const pct = (x: number) => `${Math.round(x * 100)}%`
const fill = (t: string, v: Record<string, string>) => t.replace(/\{(\w+)\}/g, (m, key: string) => v[key] ?? m)
const fixClass =
  "inline-flex h-6 items-center gap-1 rounded-md border border-amber-500/40 px-2 font-medium text-amber-900 transition-colors hover:bg-amber-500/10 dark:text-amber-200 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"

function Stars({ value }: { value: number }) {
  return (
    <span aria-hidden className="relative inline-flex text-muted-foreground/40">
      {[0, 1, 2, 3, 4].map((i) => <Star key={i} className="size-4" />)}
      <span className="absolute inset-0 inline-flex overflow-hidden text-amber-500 dark:text-amber-400" style={{ width: `${(value / 5) * 100}%` }}>
        {[0, 1, 2, 3, 4].map((i) => <Star key={i} className="size-4 shrink-0 fill-current" />)}
      </span>
    </span>
  )
}

export interface HonestRatingProps extends Omit<React.ComponentProps<"div">, "children"> {
  /** Review counts for 1★ to 5★. */
  distribution: RatingDistribution
  /** Below this many reviews the score is flagged as a tiny sample. */
  minReviews?: number
  /** Prior for the sorting score; pass your catalogue's mean. */
  prior?: RatingPrior
  /** Called when a star row (or "Read the 1★ reviews") is chosen, to filter the reviews below. */
  onSelectStars?: (stars: number) => void
  /** Templates: `{count}`, `{low}`, `{high}`, `{one}`, `{five}`, `{score}`, `{mean}`. */
  countText?: string
  /** Shown when the review count is below minReviews. */
  smallSampleText?: string
  /** Shown for a love-it-or-hate-it split. */
  polarizedText?: string
  /** Explains the Bayesian sorting score. */
  adjustedText?: string
  /** Button text to read the 1-star reviews. */
  readLowLabel?: string
  /** Shown when there are no reviews. */
  emptyText?: string
}

/**
 * Stops a "4.8" being trusted on its own. It shows how many reviews stand behind the score and how
 * they split, flags tiny samples with the range the true score could really be in, calls out
 * love-it-or-hate-it splits the average hides, and discloses the Bayesian score used for sorting.
 */
export function HonestRating({
  distribution,
  minReviews = 10,
  prior = DEFAULT_PRIOR,
  onSelectStars,
  countText = "from {count}",
  smallSampleText = "Only {count}: the real score could be anywhere from {low} to {high}.",
  polarizedText = "Split opinions: {one} gave 1★ and {five} gave 5★. The average hides both.",
  adjustedText = "Ranked as {score} when sorting, pulled toward {mean} until it has more reviews.",
  readLowLabel = "Read the 1★ reviews",
  emptyText = "No reviews yet",
  className,
  ...props
}: HonestRatingProps) {
  const stats = ratingStats(distribution)
  const score = bayesianScore(distribution, prior)
  const reviews = `${stats.count.toLocaleString("en-IN")} ${stats.count === 1 ? "review" : "reviews"}`
  const small = stats.count > 0 && stats.count < minReviews
  const max = Math.max(...distribution, 1)
  const [low, high] = stats.range

  return (
    <div data-slot="honest-rating" data-state={!stats.count ? "empty" : small ? "small-sample" : stats.polarized ? "polarized" : "ok"} className={cn("grid w-full max-w-xs gap-3 rounded-lg border bg-card p-3 text-card-foreground", className)} {...props}>
      <style>{"@keyframes cui-honest-rating-grow{from{transform:scaleX(0)}}"}</style>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className={cn("text-2xl font-semibold tabular-nums", small && "text-muted-foreground")}>{stats.count ? one(stats.mean) : "–"}</span>
        <Stars value={stats.mean} />
        <span className={cn("text-sm tabular-nums", small ? "font-medium text-amber-700 dark:text-amber-400" : "text-muted-foreground")}>
          {stats.count ? fill(countText, { count: reviews }) : emptyText}
        </span>
      </div>

      {stats.count > 0 && (
        <div role="img" aria-label={`Likely true score ${one(low)} to ${one(high)}`} className="relative h-1.5 rounded-full bg-muted" title={`Likely ${one(low)}–${one(high)}`}>
          <span
            className={cn("absolute inset-y-0 origin-left rounded-full motion-safe:animate-[cui-honest-rating-grow_400ms_ease-out]", small ? "bg-amber-500/40" : "bg-foreground/20")}
            style={{ left: `${((low - 1) / 4) * 100}%`, width: `${((high - low) / 4) * 100}%` }}
          />
          <span className="absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-card bg-foreground" style={{ left: `${((stats.mean - 1) / 4) * 100}%` }} />
        </div>
      )}

      <ul aria-label="Rating breakdown" className="grid gap-0.5">
        {[5, 4, 3, 2, 1].map((stars) => {
          const count = distribution[stars - 1]
          const label = `${stars} star: ${count} ${count === 1 ? "review" : "reviews"}, ${pct(stats.shares[stars - 1])}`
          const content = (
            <>
              <span className="sr-only">{label}</span>
              <span aria-hidden className="w-6 shrink-0 text-muted-foreground">{stars}★</span>
              <span aria-hidden className="relative h-2 flex-1 overflow-hidden rounded-full bg-muted">
                <span
                  className={cn("absolute inset-y-0 left-0 origin-left rounded-full motion-safe:animate-[cui-honest-rating-grow_400ms_ease-out]", stats.polarized && (stars === 1 || stars === 5) ? "bg-amber-500" : "bg-foreground/70")}
                  style={{ width: `${(count / max) * 100}%` }}
                />
              </span>
              <span aria-hidden className="w-16 shrink-0 text-right tabular-nums text-muted-foreground">
                {count.toLocaleString("en-IN")} <span className="text-muted-foreground/70">· {pct(stats.shares[stars - 1])}</span>
              </span>
            </>
          )
          return (
            <li key={stars}>
              {onSelectStars ? (
                <button type="button" disabled={!count} onClick={() => onSelectStars(stars)} className="flex h-6 w-full items-center gap-2 rounded-sm px-1 text-xs transition-colors outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none">
                  {content}
                </button>
              ) : (
                <div className="flex h-6 items-center gap-2 px-1 text-xs">{content}</div>
              )}
            </li>
          )
        })}
      </ul>

      <div aria-live="polite" className="grid gap-1.5 text-xs">
        {small && (
          <p className="flex gap-1.5 text-amber-700 dark:text-amber-400">
            <TriangleAlert aria-hidden className="mt-0.5 size-3.5 shrink-0" />
            <span>{fill(smallSampleText, { count: reviews, low: one(low), high: one(high) })}</span>
          </p>
        )}
        {stats.polarized && (
          <p className="flex gap-1.5 text-amber-700 dark:text-amber-400">
            <span className="flex h-6 shrink-0 items-center"><Split aria-hidden className="size-3.5" /></span>
            <span className="flex min-w-0 flex-wrap items-center gap-x-2">
              <span className="py-1">{fill(polarizedText, { one: pct(stats.shares[0]), five: pct(stats.shares[4]) })}</span>
              {onSelectStars && <button type="button" onClick={() => onSelectStars(1)} className={fixClass}>{readLowLabel}</button>}
            </span>
          </p>
        )}
        {stats.count > 0 && (
          <p className="flex gap-1.5 text-muted-foreground">
            <Scale aria-hidden className="mt-0.5 size-3.5 shrink-0" />
            <span className="tabular-nums">{fill(adjustedText, { score: score.toFixed(2), mean: one(prior.mean) })}</span>
          </p>
        )}
      </div>
    </div>
  )
}
