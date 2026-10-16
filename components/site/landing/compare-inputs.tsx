"use client"

import * as React from "react"
import { CircleCheck, TriangleAlert } from "lucide-react"

import { AmountInput } from "@/registry/default/amount-input/amount-input"

const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 })

/** One honest pair: the same typo in a plain input and in amount-input. Both are live. */
export function CompareInputs() {
  const [plain, setPlain] = React.useState("240000")
  const amount = Number(plain.replace(/\D/g, "")) || 0

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <figure className="flex min-w-0 flex-col rounded-xl border bg-card shadow-xs">
        <figcaption className="flex items-center justify-between gap-3 border-b px-5 py-3">
          <span className="font-bold">A normal input</span>
          <code className="font-mono text-xs text-muted-foreground">{"<input />"}</code>
        </figcaption>
        <div className="grid flex-1 content-start gap-2 p-5">
          <label htmlFor="plain-rent" className="text-sm font-medium">
            Monthly rent
          </label>
          <input
            id="plain-rent"
            inputMode="numeric"
            value={plain}
            onChange={(event) => setPlain(event.target.value)}
            className="h-9 w-full min-w-0 rounded-md border bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30"
          />
        </div>
        <p className="flex items-start gap-2 border-t px-5 py-3 text-sm text-muted-foreground">
          <CircleCheck aria-hidden className="mt-0.5 size-4 shrink-0" />
          <span>
            No complaint. <span className="font-bold text-foreground tabular-nums">{inr.format(amount)}</span> goes through.
          </span>
        </p>
      </figure>

      <figure className="flex min-w-0 flex-col rounded-xl border bg-card shadow-xs">
        <figcaption className="flex items-center justify-between gap-3 border-b px-5 py-3">
          <span className="font-bold">A Bollard input</span>
          <code className="font-mono text-xs text-muted-foreground">{"<AmountInput />"}</code>
        </figcaption>
        <div className="flex-1 p-5">
          <AmountInput label="Monthly rent" defaultValue={240000} typical={24000} />
        </div>
        <p className="flex items-start gap-2 border-t px-5 py-3 text-sm text-muted-foreground">
          <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
          <span>Same typo, caught: grouped as you type, spelled out, and one tap to fix the extra zero.</span>
        </p>
      </figure>
    </div>
  )
}
