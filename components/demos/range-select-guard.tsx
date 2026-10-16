"use client"

import * as React from "react"

import { RangeSelectGuard, type RangeRow } from "@/registry/default/range-select-guard/range-select-guard"

const CUSTOMERS = ["Acme Retail", "Bluestone Labs", "Chai Point", "Dhruv Exports", "Evergreen Foods", "Fable Studio", "Gupta & Sons"]
const INVOICES = Array.from({ length: 60 }, (_, i) => ({
  id: `INV-${1001 + i}`,
  customer: CUSTOMERS[i % CUSTOMERS.length],
  amount: 1200 + ((i * 7919) % 48000),
  paid: i % 3 === 1,
}))

export function Demo() {
  const [unpaidOnly, setUnpaidOnly] = React.useState(true)
  const [selected, setSelected] = React.useState<string[]>([])
  const ref = React.useRef<HTMLDivElement>(null)

  // Open on the slip: click a row on page 1, jump to page 3, shift-click.
  React.useEffect(() => {
    const root = ref.current
    if (!root) return
    const click = (el: Element | null | undefined, shiftKey = false) =>
      el?.dispatchEvent(new MouseEvent("click", { bubbles: true, shiftKey }))
    const next = () => root.querySelector('[aria-label="Next page"]')
    const steps = [
      () => click(root.querySelector('[data-row="INV-1001"]')),
      () => click(next()),
      () => click(next()),
      () => click(root.querySelectorAll('[role="option"]')[2], true),
    ]
    const timers = steps.map((step, i) => setTimeout(step, 30 * (i + 1)))
    return () => timers.forEach(clearTimeout)
  }, [])

  const rows: RangeRow[] = INVOICES.map((inv) => ({
    id: inv.id,
    label: (
      <>
        <span className="font-mono text-xs text-muted-foreground">{inv.id}</span> {inv.customer}
      </>
    ),
    detail: `₹${inv.amount.toLocaleString("en-IN")}`,
    hidden: unpaidOnly && inv.paid,
  }))

  return (
    <div ref={ref} className="grid w-full max-w-md gap-3">
      <div className="flex items-center justify-between gap-2 text-xs">
        <label className="inline-flex items-center gap-2 font-medium">
          <input type="checkbox" checked={unpaidOnly} onChange={(e) => setUnpaidOnly(e.target.checked)} className="size-4 accent-current" />
          Unpaid only
        </label>
        <button
          type="button"
          disabled={!selected.length}
          className="h-8 rounded-md bg-destructive px-3 text-sm font-medium text-white shadow-xs outline-none hover:bg-destructive/90 focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-50 dark:bg-destructive/60"
        >
          Void {selected.length} {selected.length === 1 ? "invoice" : "invoices"}
        </button>
      </div>
      <RangeSelectGuard label="Invoices" rows={rows} pageSize={6} value={selected} onValueChange={setSelected} />
    </div>
  )
}
