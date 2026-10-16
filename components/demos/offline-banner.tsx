"use client"

import * as React from "react"
import { Clock } from "lucide-react"

import { cn } from "@/lib/utils"
import { OfflineBanner } from "@/registry/default/offline-banner/offline-banner"

const tasks = ["Send invoice to Acme", "Book venue for offsite", "Review Q3 budget", "Renew SSL certificate"]

const button =
  "h-8 rounded-md border bg-background px-3 text-sm font-medium hover:bg-accent outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"

export function Demo() {
  const [online, setOnline] = React.useState(false)
  const [done, setDone] = React.useState([true, true, false, false])
  const [unsynced, setUnsynced] = React.useState([0, 1]) // task indexes waiting in the outbox

  // Drain the outbox one item at a time once the connection is back.
  React.useEffect(() => {
    if (!online || unsynced.length === 0) return
    const timer = setTimeout(() => setUnsynced((queue) => queue.slice(1)), 900)
    return () => clearTimeout(timer)
  }, [online, unsynced])

  const toggle = (index: number) => {
    setDone((list) => list.map((value, i) => (i === index ? !value : value)))
    setUnsynced((queue) => (queue.includes(index) ? queue : [...queue, index]))
  }

  return (
    <div className="w-full max-w-md overflow-hidden rounded-xl border bg-background">
      <OfflineBanner online={online} queued={unsynced.length} guardUnload={false} />
      <div className="flex items-center justify-between gap-2 px-4 pt-3">
        <p className="text-sm font-medium">Tasks</p>
        <button type="button" className={button} onClick={() => setOnline((value) => !value)}>
          {online ? "Go offline" : "Reconnect"}
        </button>
      </div>
      <ul className="px-4 py-2 text-sm">
        {tasks.map((task, index) => (
          <li key={task} className="flex h-9 items-center gap-2.5">
            <input
              id={`offline-demo-${index}`}
              type="checkbox"
              checked={done[index]}
              onChange={() => toggle(index)}
              className="size-4 accent-primary"
            />
            <label
              htmlFor={`offline-demo-${index}`}
              className={cn("min-w-0 truncate", done[index] && "text-muted-foreground line-through")}
            >
              {task}
            </label>
            {unsynced.includes(index) && (
              <span className="ml-auto inline-flex shrink-0 items-center gap-1 text-xs whitespace-nowrap text-muted-foreground">
                <Clock aria-hidden className="size-3.5" /> Not synced
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
