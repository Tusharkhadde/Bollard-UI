"use client"

import * as React from "react"

import { SlugInput } from "@/registry/default/slug-input/slug-input"

const taken = new Set(["pricing", "pricing-2026", "launch-week", "launch-week-2"])
const check = (slug: string) => new Promise<boolean>((resolve) => setTimeout(() => resolve(!taken.has(slug)), 300))

export function Demo() {
  const [title, setTitle] = React.useState("Pricing update for 2026")

  return (
    <div className="grid w-full max-w-sm gap-3">
      <div className="grid gap-1.5">
        <label htmlFor="slug-demo-title" className="w-fit text-sm font-medium">
          Title
        </label>
        <input
          id="slug-demo-title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          className="h-9 w-full min-w-0 rounded-md border bg-transparent px-3 text-base shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 md:text-sm dark:bg-input/30"
        />
      </div>
      <SlugInput
        title={title}
        baseUrl="https://acme.com/blog/"
        publishedSlug="pricing-update"
        defaultValue="pricing-update-2026"
        checkAvailability={check}
      />
    </div>
  )
}
