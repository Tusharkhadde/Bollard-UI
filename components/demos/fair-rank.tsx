"use client"

import * as React from "react"

import { FairRank, type RankEntry } from "@/registry/default/fair-rank/fair-rank"

const WEEKS: Record<string, RankEntry[]> = {
  "Week 41": [
    { id: "meera", name: "Meera Iyer", score: 93.2, samples: 41, previousRank: 2 },
    { id: "rohan", name: "Rohan Gupta", score: 90.1, samples: 37, previousRank: 1 },
    { id: "kabir", name: "Kabir Singh", score: 88.7, samples: 29, previousRank: 3 },
    { id: "dev", name: "Dev Malhotra", score: 86.4, samples: 33, previousRank: 4 },
    { id: "ananya", name: "Ananya Rao", score: 97.0, samples: 4, previousRank: null },
  ],
  "Week 42": [
    { id: "rohan", name: "Rohan Gupta", score: 92.4, samples: 44, previousRank: 2 },
    { id: "meera", name: "Meera Iyer", score: 90.96, samples: 52, previousRank: 1 },
    { id: "kabir", name: "Kabir Singh", score: 91.04, samples: 38, previousRank: 3 },
    { id: "dev", name: "Dev Malhotra", score: 88.5, samples: 35, previousRank: 4 },
    { id: "isha", name: "Isha Nair", score: 85.2, samples: 21, previousRank: null },
    { id: "ananya", name: "Ananya Rao", score: 96.0, samples: 8, previousRank: null },
  ],
}

export function Demo() {
  const [week, setWeek] = React.useState("Week 42")
  return (
    <div className="grid w-full max-w-sm gap-3">
      <div role="group" aria-label="Period" className="flex w-fit gap-1 rounded-md border p-0.5">
        {Object.keys(WEEKS).map((w) => (
          <button
            key={w}
            type="button"
            aria-pressed={week === w}
            onClick={() => setWeek(w)}
            className="h-8 rounded-sm px-3 text-sm font-medium transition-colors outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-pressed:bg-primary aria-pressed:text-primary-foreground"
          >
            {w}
          </button>
        ))}
      </div>
      <FairRank caption={`Support CSAT, ${week}`} entries={WEEKS[week]} minSamples={20} samplesLabel="ratings" format={(s) => `${s}%`} />
    </div>
  )
}
