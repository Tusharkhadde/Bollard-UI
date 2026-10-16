"use client"

import * as React from "react"

import { FilterNotice, hiddenByEach } from "@/registry/default/filter-notice/filter-notice"

type Invoice = { id: string; client: string; status: "Paid" | "Overdue" | "Draft"; owner: "Me" | "Priya" }

const invoices: Invoice[] = [
  { id: "INV-101", client: "Acme", status: "Overdue", owner: "Me" },
  { id: "INV-102", client: "Globex", status: "Paid", owner: "Me" },
  { id: "INV-103", client: "Acme", status: "Overdue", owner: "Priya" },
  { id: "INV-104", client: "Initech", status: "Draft", owner: "Me" },
  { id: "INV-105", client: "Acme", status: "Paid", owner: "Priya" },
  { id: "INV-106", client: "Umbrella", status: "Overdue", owner: "Priya" },
  { id: "INV-107", client: "Globex", status: "Overdue", owner: "Me" },
  { id: "INV-108", client: "Hooli", status: "Paid", owner: "Priya" },
  { id: "INV-109", client: "Acme", status: "Draft", owner: "Priya" },
  { id: "INV-110", client: "Initech", status: "Overdue", owner: "Priya" },
]

const allFilters = [
  { id: "status", label: "Status: Overdue", test: (invoice: Invoice) => invoice.status === "Overdue" },
  { id: "owner", label: "Owner: Me", test: (invoice: Invoice) => invoice.owner === "Me" },
]

export function Demo() {
  const [active, setActive] = React.useState(["status", "owner"])
  const [selected, setSelected] = React.useState(["INV-101", "INV-103", "INV-106"])

  const filters = allFilters.filter((filter) => active.includes(filter.id))
  const matches = (invoice: Invoice, skip?: string) => filters.every((filter) => filter.id === skip || filter.test(invoice))
  const visible = invoices.filter((invoice) => matches(invoice))
  const hides = hiddenByEach(invoices, active, matches)
  const hiddenSelected = selected.filter((id) => !visible.some((invoice) => invoice.id === id)).length
  const toggle = (id: string) => setSelected((list) => (list.includes(id) ? list.filter((item) => item !== id) : [...list, id]))

  return (
    <div className="w-full max-w-md space-y-3">
      <FilterNotice
        total={invoices.length}
        shown={visible.length}
        filters={filters.map((filter) => ({ id: filter.id, label: filter.label, hides: hides[filter.id] }))}
        hiddenSelected={hiddenSelected}
        formatCount={(count) => `${count} ${count === 1 ? "invoice" : "invoices"}`}
        onRemoveFilter={(id) => setActive((list) => list.filter((item) => item !== id))}
        onClearAll={() => setActive([])}
      />
      <div className="rounded-xl border bg-background text-sm">
        <div className="flex items-center justify-between gap-2 border-b px-4 py-2 text-xs text-muted-foreground">
          <span>{selected.length} selected</span>
          {active.length < 2 && (
            <button
              type="button"
              onClick={() => setActive(["status", "owner"])}
              className="rounded-md border px-2 py-1 hover:bg-accent outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
            >
              Reset demo
            </button>
          )}
        </div>
        <ul className="max-h-64 overflow-auto px-4 py-1">
          {visible.map((invoice) => (
            <li key={invoice.id} className="flex h-9 items-center gap-2.5">
              <input
                id={`filter-demo-${invoice.id}`}
                type="checkbox"
                checked={selected.includes(invoice.id)}
                onChange={() => toggle(invoice.id)}
                className="size-4 accent-primary"
              />
              <label htmlFor={`filter-demo-${invoice.id}`} className="flex min-w-0 flex-1 justify-between gap-2">
                <span className="truncate">
                  {invoice.id} · {invoice.client}
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {invoice.status} · {invoice.owner}
                </span>
              </label>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
