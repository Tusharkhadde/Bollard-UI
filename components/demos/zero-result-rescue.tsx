"use client"

import * as React from "react"
import { Search } from "lucide-react"

import { ZeroResultRescue, type SearchAttempt } from "@/registry/default/zero-result-rescue/zero-result-rescue"

const products = [
  {
    name: "Sony WH-1000XM5 wireless headphones",
    category: "Audio",
    price: 29990,
  },
  {
    name: "boAt Rockerz 450 wireless headphones",
    category: "Audio",
    price: 1499,
  },
  {
    name: "JBL Tune 510BT wireless headphones",
    category: "Audio",
    price: 2999,
  },
  { name: "Noise Buds wireless earbuds", category: "Audio", price: 1299 },
  { name: "boAt Bassheads wired earphones", category: "Audio", price: 399 },
  {
    name: "Zebronics Thunder wireless headphones",
    category: "Gaming",
    price: 899,
  },
  { name: "Logitech M235 wireless mouse", category: "Computers", price: 699 },
  {
    name: "Portronics Key2 wireless keyboard",
    category: "Computers",
    price: 899,
  },
]
const categories = ["Audio", "Gaming", "Computers"]
const budget = { id: "under-1000", label: "Under ₹1,000" }
const vocabulary = [...new Set(products.flatMap((p) => `${p.name} ${p.category}`.toLowerCase().split(/[^\p{L}\p{N}]+/u)))]

function search(attempt: SearchAttempt, category: string) {
  const words = attempt.query.toLowerCase().split(/\s+/).filter(Boolean)
  return products.filter(
    (p) =>
      (attempt.allCategories || p.category === category) &&
      (!attempt.filters.includes(budget.id) || p.price < 1000) &&
      words.every((word) => `${p.name} ${p.category}`.toLowerCase().includes(word)),
  )
}

export function Demo() {
  const [query, setQuery] = React.useState("wireles hedphones")
  const [category, setCategory] = React.useState("Audio")
  const [allCategories, setAllCategories] = React.useState(false)
  const [budgetOn, setBudgetOn] = React.useState(true)
  const filters = React.useMemo(() => (budgetOn ? [budget] : []), [budgetOn])
  // Counted like a count-only API call would be: async, a quarter second each, all at once.
  const count = React.useCallback(
    (attempt: SearchAttempt, signal: AbortSignal) =>
      new Promise<number>((resolve, reject) => {
        const timer = setTimeout(() => resolve(search({ ...attempt, allCategories: allCategories || attempt.allCategories }, category).length), 250)
        signal.addEventListener("abort", () => {
          clearTimeout(timer)
          reject(signal.reason)
        })
      }),
    [allCategories, category],
  )
  const results = search({ query, filters: filters.map((f) => f.id), allCategories }, category)

  return (
    <div className="grid w-full max-w-md gap-3">
      <label className="relative">
        <span className="sr-only">Search products</span>
        <Search
          aria-hidden
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
        />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="h-9 w-full min-w-0 rounded-md border bg-transparent pr-3 pl-9 text-base shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 md:text-sm dark:bg-input/30"
        />
      </label>
      <div className="flex flex-wrap gap-2">
        <select
          aria-label="Category"
          value={allCategories ? "" : category}
          onChange={(event) => {
            setAllCategories(!event.target.value)
            if (event.target.value) setCategory(event.target.value)
          }}
          className="h-8 rounded-md border bg-transparent px-2 text-sm shadow-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30"
        >
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <button
          type="button"
          aria-pressed={budgetOn}
          onClick={() => setBudgetOn((on) => !on)}
          className="h-8 rounded-md border px-3 text-sm font-medium shadow-xs transition-colors outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-pressed:border-foreground/30 aria-pressed:bg-accent"
        >
          {budget.label}
        </button>
      </div>
      {results.length ? (
        <ul className="grid gap-1 text-sm" aria-label="Results">
          {results.map((p) => (
            <li key={p.name} className="flex justify-between gap-3 rounded-md border px-3 py-2">
              <span className="min-w-0 truncate">{p.name}</span>
              <span className="shrink-0 text-muted-foreground">₹{p.price.toLocaleString("en-IN")}</span>
            </li>
          ))}
        </ul>
      ) : (
        <ZeroResultRescue
          query={query}
          filters={filters}
          scope={allCategories ? undefined : category}
          vocabulary={vocabulary}
          count={count}
          onRescue={(attempt) => {
            setQuery(attempt.query)
            setBudgetOn(attempt.filters.includes(budget.id))
            setAllCategories(allCategories || attempt.allCategories)
          }}
        />
      )}
    </div>
  )
}
