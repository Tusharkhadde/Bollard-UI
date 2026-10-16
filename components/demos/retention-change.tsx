"use client"

import * as React from "react"

import { RetentionChange, type RetentionDay } from "@/registry/default/retention-change/retention-change"

const DAY = 86_400_000

/** 90 days of event counts with a weekday rhythm and slow growth, ending today. */
function sampleHistory(today: number): RetentionDay[] {
  return Array.from({ length: 90 }, (_, i) => {
    const t = today - (89 - i) * DAY
    const weekday = new Date(t).getUTCDay()
    const count = Math.round((320 + i * 2.4) * (weekday === 0 || weekday === 6 ? 0.55 : 1) + ((i * 37) % 23) * 4)
    return { date: new Date(t).toISOString().slice(0, 10), count }
  })
}

/** The next 02:00 in the viewer's zone. */
function nextPurge(now: number) {
  const d = new Date(now)
  d.setHours(2, 0, 0, 0)
  if (d.getTime() <= now) d.setDate(d.getDate() + 1)
  return d.getTime()
}

export function Demo() {
  const [setup, setSetup] = React.useState<{ history: RetentionDay[]; purgeAt: number } | null>(null)
  const [current, setCurrent] = React.useState(90)
  const [saved, setSaved] = React.useState("")

  React.useEffect(() => {
    const now = Date.now()
    setSetup({ history: sampleHistory(now), purgeAt: nextPurge(now) })
  }, [])

  if (!setup) return <div className="h-72 w-full max-w-md" />
  if (saved)
    return (
      <div className="space-y-2 text-center text-sm">
        <p>{saved}</p>
        <button
          type="button"
          onClick={() => {
            setSaved("")
            setCurrent(90)
          }}
          className="inline-flex h-8 items-center rounded-md border bg-background px-3 font-medium shadow-xs outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:border-input dark:bg-input/30"
        >
          Run the demo again
        </button>
      </div>
    )

  return (
    <RetentionChange
      current={current}
      defaultValue={30}
      noun="events"
      history={setup.history}
      purgeAt={setup.purgeAt}
      onExport={() => new Promise((resolve) => setTimeout(resolve, 900))}
      onConfirm={(days) => new Promise<void>((resolve) => setTimeout(() => {
        setCurrent(days)
        setSaved(`Retention set to ${days} days.`)
        resolve()
      }, 600))}
    />
  )
}
