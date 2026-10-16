"use client"

import * as React from "react"

import { cn } from "@/lib/utils"
import { bayesianScore, HonestRating, ratingStats, type RatingDistribution } from "@/registry/default/honest-rating/honest-rating"

const products: { name: string; distribution: RatingDistribution }[] = [
  { name: "Brass diya set", distribution: [0, 0, 0, 0, 3] },
  { name: "Clay diya pack of 12", distribution: [14, 6, 21, 180, 679] },
  { name: "LED string lights", distribution: [96, 10, 8, 22, 114] },
]

export function Demo() {
  const [sort, setSort] = React.useState<"adjusted" | "average">("average")
  const [picked, setPicked] = React.useState(0)
  const [filter, setFilter] = React.useState<number>()
  const order = products
    .map((p, i) => ({ ...p, i, mean: ratingStats(p.distribution).mean, score: bayesianScore(p.distribution) }))
    .sort((a, b) => (sort === "average" ? b.mean - a.mean : b.score - a.score))

  return (
    <div className="grid w-full max-w-xs gap-3">
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="text-muted-foreground">Sort by</span>
        <div role="radiogroup" aria-label="Sort by" className="flex rounded-md border p-0.5">
          {(["average", "adjusted"] as const).map((s) => (
            <button key={s} type="button" role="radio" aria-checked={sort === s} onClick={() => setSort(s)} className="h-7 rounded-sm px-2.5 font-medium text-muted-foreground transition-colors aria-checked:bg-accent aria-checked:text-foreground outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50">
              {s === "average" ? "Star average" : "Honest score"}
            </button>
          ))}
        </div>
      </div>
      <ol aria-label="Products" className="grid divide-y rounded-md border">
        {order.map((p, rank) => (
          <li key={p.name}>
            <button
              type="button"
              aria-pressed={picked === p.i}
              onClick={() => { setPicked(p.i); setFilter(undefined) }}
              className={cn("flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors outline-none hover:bg-accent/60 focus-visible:ring-[3px] focus-visible:ring-ring/50", picked === p.i && "bg-accent")}
            >
              <span className="w-4 text-xs text-muted-foreground tabular-nums">{rank + 1}</span>
              <span className="min-w-0 flex-1 truncate">{p.name}</span>
              <span className="text-xs tabular-nums text-muted-foreground">
                {(sort === "average" ? p.mean : p.score).toFixed(sort === "average" ? 1 : 2)} · {p.distribution.reduce((a, b) => a + b, 0)}
              </span>
            </button>
          </li>
        ))}
      </ol>
      <HonestRating key={picked} distribution={products[picked].distribution} onSelectStars={setFilter} />
      <p role="status" className="min-h-4 text-center text-xs text-muted-foreground">{filter ? `Showing ${filter}★ reviews` : ""}</p>
    </div>
  )
}
