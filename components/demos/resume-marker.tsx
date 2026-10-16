"use client"

import * as React from "react"

import { ResumeMarker } from "@/registry/default/resume-marker/resume-marker"

const topics = [
  "Welcome", "How we work", "Working hours", "Remote setup", "Your first week", "Tools and access",
  "Code review", "Deploying", "On-call", "Incidents", "Security basics", "Expenses", "Travel",
  "Time off", "Parental leave", "Learning budget", "Feedback", "Promotions", "Equipment",
  "Office etiquette", "Meetings", "Writing docs", "Offboarding", "Glossary",
]
const sections = topics.map((title, index) => ({ id: `s-${index + 1}`, number: index + 1, title }))
const STORAGE = "demo:handbook"

export function Demo() {
  const [run, setRun] = React.useState(0)

  // Pretend the reader stopped at section 14 two days ago, then mount the reader.
  React.useEffect(() => {
    localStorage.setItem(`bollard-ui:resume:${STORAGE}`, JSON.stringify({ key: "s-14", at: Date.now() - 2 * 86_400_000 }))
    setRun((value) => value + 1)
  }, [])

  return (
    <div className="w-full max-w-sm space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium">Team handbook</span>
        <button
          type="button"
          onClick={() => setRun((value) => value + 1)}
          className="rounded-md border px-2 py-1 text-xs hover:bg-accent outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          Close and reopen
        </button>
      </div>
      {run > 0 && (
        <ResumeMarker
          key={run}
          storageKey={STORAGE}
          items={sections}
          getKey={(section) => section.id}
          aria-label="Team handbook"
          className="h-80 rounded-xl border bg-background"
          renderItem={(section) => (
            <article className="border-b px-3 py-3 last:border-b-0">
              <h3 className="text-sm font-medium">
                {section.number}. {section.title}
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                What to know about {section.title.toLowerCase()}, who to ask, and the links you&apos;ll need.
              </p>
            </article>
          )}
        />
      )}
    </div>
  )
}
