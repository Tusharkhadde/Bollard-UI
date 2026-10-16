"use client"

import * as React from "react"
import { RotateCw } from "lucide-react"

import { StatusChip, type DefaultStatus } from "@/registry/default/status-chip/status-chip"

const initial: { id: string; customer: string; status: DefaultStatus; detail?: string }[] = [
  { id: "1042", customer: "Asha Rao", status: "failed", detail: "Card ending 4242 was declined: insufficient funds." },
  { id: "1041", customer: "Leo Martin", status: "paid" },
  { id: "1040", customer: "Mei Tan", status: "pending" },
  { id: "1039", customer: "Omar Haddad", status: "refunded" },
  { id: "1038", customer: "Draft order", status: "draft" },
]

export function Demo() {
  const [orders, setOrders] = React.useState(initial)
  const [noColour, setNoColour] = React.useState(true)
  const timer = React.useRef<ReturnType<typeof setTimeout>>(undefined)
  React.useEffect(() => () => clearTimeout(timer.current), [])

  const set = (id: string, status: DefaultStatus) =>
    setOrders((list) => list.map((o) => (o.id === id ? { ...o, status, detail: undefined } : o)))
  const retry = (id: string) => {
    set(id, "processing")
    timer.current = setTimeout(() => set(id, "paid"), 1400)
  }

  return (
    <div className="grid w-full max-w-sm min-w-0 gap-3">
      <label className="flex w-fit items-center gap-2 text-xs text-muted-foreground">
        <input type="checkbox" checked={noColour} onChange={(e) => setNoColour(e.target.checked)} className="size-4 accent-foreground" />
        Preview with no colour vision
      </label>
      <ul className={`divide-y rounded-lg border transition-[filter] ${noColour ? "grayscale" : ""}`}>
        {orders.map((order) => (
          <li key={order.id} className="flex items-center gap-2 px-3 py-2 text-sm">
            <span className="min-w-0 flex-1 truncate">
              <span className="text-muted-foreground tabular-nums">#{order.id}</span> {order.customer}
            </span>
            {order.status === "failed" && (
              <button
                type="button"
                onClick={() => retry(order.id)}
                aria-label="Retry payment"
                title="Retry payment"
                className="grid size-6 shrink-0 place-items-center rounded-md border transition-colors outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                <RotateCw aria-hidden className="size-3.5" />
              </button>
            )}
            <StatusChip status={order.status} detail={order.detail} size="sm" />
          </li>
        ))}
      </ul>
      <p className="text-xs text-muted-foreground">Hover or tab to a status to see what it means.</p>
    </div>
  )
}
