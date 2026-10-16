"use client"

import * as React from "react"

import { NewContentPill } from "@/registry/default/new-content-pill/new-content-pill"

interface Post {
  id: string
  author: string
  text: string
  minutes: number
}

const authors = ["Priya", "Arjun", "Meera", "Kabir", "Sana", "Dev"]
const lines = [
  "Shipped the new search index. Queries are about 3x faster.",
  "Reminder: design review moves to 4 pm today.",
  "Anyone else seeing flaky tests in checkout?",
  "Wrote up the incident from Tuesday. Comments welcome.",
  "The staging database restarts at 6 pm.",
  "New hire onboarding doc is live in the handbook.",
]
const post = (n: number, minutes: number): Post => ({
  id: `p-${n}`,
  author: authors[n % authors.length],
  text: lines[n % lines.length],
  minutes,
})
const initial = Array.from({ length: 14 }, (_, i) => post(14 - i, 5 + i * 7))

export function Demo() {
  const [posts, setPosts] = React.useState(initial)
  const next = React.useRef(15)
  const feedRef = React.useRef<HTMLDivElement>(null)
  const started = React.useRef(false)

  const arrive = (count: number) => {
    const fresh = Array.from({ length: count }, () => post(next.current++, 0)).reverse()
    setPosts((current) => [...fresh, ...current])
  }

  // Open mid-feed, then let three posts arrive so the pill is already holding them.
  React.useEffect(() => {
    if (started.current) return
    started.current = true
    feedRef.current?.scrollTo({ top: 260 })
    arrive(3)
  }, [])

  return (
    <div className="w-full max-w-sm space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium">#engineering</span>
        <button
          type="button"
          onClick={() => arrive(1)}
          className="rounded-md border px-2 py-1 text-xs hover:bg-accent outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          Simulate a new post
        </button>
      </div>
      <NewContentPill
        ref={feedRef}
        items={posts}
        getKey={(item) => item.id}
        aria-label="#engineering feed"
        className="h-80 rounded-xl border bg-background"
        renderItem={(item) => (
          <article className="flex gap-3 border-b px-3 py-3">
            <span aria-hidden className="grid size-8 shrink-0 place-items-center rounded-full bg-muted text-xs font-medium">
              {item.author[0]}
            </span>
            <div className="min-w-0 text-sm">
              <p>
                <span className="font-medium">{item.author}</span>{" "}
                <span className="text-xs text-muted-foreground">{item.minutes ? `${item.minutes} min ago` : "just now"}</span>
              </p>
              <p className="text-muted-foreground">{item.text}</p>
            </div>
          </article>
        )}
      />
    </div>
  )
}
