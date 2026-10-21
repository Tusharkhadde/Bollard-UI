"use client"

import * as React from "react"
import { trackComponentFeedback } from "@/lib/analytics"

export function ComponentFeedback({ component }: { component: string }) {
  const [answer, setAnswer] = React.useState<"yes" | "no" | null>(null)
  const respond = (helpful: boolean) => {
    const next = helpful ? "yes" : "no"
    setAnswer(next)
    trackComponentFeedback({ component, helpful })
  }
  return (
    <section aria-label="Component feedback" className="mt-10 rounded-xl border bg-surface p-4 sm:flex sm:items-center sm:justify-between">
      <p className="text-sm font-medium">Was this component page useful?</p>
      {answer ? (
        <p className="mt-2 text-sm text-muted-foreground sm:mt-0" role="status">Thanks for the feedback.</p>
      ) : (
        <div className="mt-3 flex gap-2 sm:mt-0">
          {([true, false] as const).map((helpful) => (
            <button key={String(helpful)} type="button" onClick={() => respond(helpful)} className="rounded-md border bg-background px-3 py-1.5 text-sm outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50">
              {helpful ? "Yes" : "Not yet"}
            </button>
          ))}
        </div>
      )}
    </section>
  )
}
