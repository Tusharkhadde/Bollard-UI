"use client"

import * as React from "react"

import { PresenceAvatars, PresenceLock, type Collaborator } from "@/registry/default/presence-lock/presence-lock"

const input =
  "h-9 w-full rounded-md border bg-transparent px-3 text-base shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 md:text-sm dark:bg-input/30"
const small =
  "h-8 rounded-md border px-3 text-xs font-medium hover:bg-accent outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"

export function Demo() {
  const [people, setPeople] = React.useState<Collaborator[]>([])
  const [priyaOnPrice, setPriyaOnPrice] = React.useState(true)

  React.useEffect(() => {
    const now = Date.now()
    setPeople([
      { id: "priya", name: "Priya Shah", field: "price", lastActiveAt: now },
      { id: "arjun", name: "Arjun Mehta", field: "guests", lastActiveAt: now - 3 * 60_000 },
    ])
    // Stand-in for a heartbeat from the transport.
    const id = setInterval(() => setPeople((list) => list.map((p) => (p.id === "priya" ? { ...p, lastActiveAt: Date.now() } : p))), 10_000)
    return () => clearInterval(id)
  }, [])

  const togglePriya = () => {
    setPriyaOnPrice((on) => !on)
    setPeople((list) => list.map((p) => (p.id === "priya" ? { ...p, field: priyaOnPrice ? null : "price", lastActiveAt: Date.now() } : p)))
  }
  const hasNeha = people.some((p) => p.id === "neha")
  const toggleNeha = () =>
    setPeople((list) => (hasNeha ? list.filter((p) => p.id !== "neha") : [...list, { id: "neha", name: "Neha Rao", field: null, lastActiveAt: Date.now() }]))

  return (
    <div className="grid w-full max-w-sm gap-4">
      <div className="flex items-center justify-between gap-2 border-b pb-3">
        <span className="text-sm font-semibold">Booking #1042</span>
        <PresenceAvatars people={people} />
      </div>
      <PresenceLock field="price" label="Price per guest" htmlFor="pl-price" people={people}>
        <input id="pl-price" defaultValue="₹650" className={input} />
      </PresenceLock>
      <PresenceLock field="guests" label="Guests" htmlFor="pl-guests" people={people}>
        <input id="pl-guests" defaultValue="24" inputMode="numeric" className={input} />
      </PresenceLock>
      <div className="flex flex-wrap gap-2 border-t pt-3">
        <button type="button" onClick={togglePriya} className={small}>
          {priyaOnPrice ? "Priya leaves Price" : "Priya edits Price"}
        </button>
        <button type="button" onClick={toggleNeha} className={small}>
          {hasNeha ? "Neha leaves" : "Neha joins"}
        </button>
      </div>
    </div>
  )
}
