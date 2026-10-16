"use client"

import * as React from "react"

import { checkSum, SumCheck, type SumCheckKind, type SumRow } from "@/registry/default/sum-check/sum-check"

const examples: Record<string, { kind: SumCheckKind; rows: SumRow[]; total?: number; roundedTo?: number }> = {
  Invoice: {
    kind: "total",
    total: 5009,
    rows: [
      { id: "design", label: "Design", value: 1250 },
      { id: "dev", label: "Development", value: 3480 },
      { id: "hosting", label: "Hosting (12 mo)", value: 216 },
      { id: "domain", label: "Domain", value: 18 },
    ],
  },
  Survey: {
    kind: "percent",
    roundedTo: 0,
    rows: [
      { id: "very", label: "Very likely", value: 47 },
      { id: "some", label: "Somewhat likely", value: 31 },
      { id: "un", label: "Unlikely", value: 21 },
    ],
  },
  Journal: {
    kind: "balance",
    rows: [
      { id: "rent", label: "Rent expense", value: 1200, side: "debit" },
      { id: "cash", label: "Cash", value: 1200, side: "credit" },
      { id: "supplies", label: "Office supplies", value: 85, side: "debit" },
      { id: "payable", label: "Accounts payable", value: 85, side: "debit" },
    ],
  },
}

export function Demo() {
  const [tab, setTab] = React.useState<keyof typeof examples>("Invoice")
  const [totals, setTotals] = React.useState<Record<string, number>>({})
  const rowRefs = React.useRef(new Map<string, HTMLTableRowElement>())
  const example = examples[tab]
  const total = totals[tab] ?? example.total
  const suspects = new Set(checkSum(example.rows, { ...example, total }).suspects.map((s) => s.id))
  const money = (n: number) => n.toLocaleString("en-IN", { minimumFractionDigits: example.kind === "percent" ? 0 : 2 })

  const flash = (id: string) => {
    const row = rowRefs.current.get(id)
    row?.scrollIntoView({ block: "nearest" })
    if (row && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
      row.animate([{ backgroundColor: "rgb(239 68 68 / 0.3)" }, { backgroundColor: "transparent" }], { duration: 400, easing: "ease-out" })
    }
  }

  return (
    <div className="grid w-full max-w-sm gap-3">
      <div role="group" aria-label="Example" className="flex gap-1 rounded-lg bg-muted p-1">
        {Object.keys(examples).map((name) => (
          <button
            key={name}
            type="button"
            aria-pressed={tab === name}
            onClick={() => setTab(name)}
            className="h-7 flex-1 rounded-md text-xs font-medium text-muted-foreground transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-pressed:bg-background aria-pressed:text-foreground aria-pressed:shadow-xs"
          >
            {name}
          </button>
        ))}
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-xs text-muted-foreground">
            <th className="py-1.5 font-medium">Item</th>
            {example.kind === "balance" && <th className="py-1.5 font-medium">Side</th>}
            <th className="py-1.5 text-right font-medium">{example.kind === "percent" ? "Share" : "Amount (₹)"}</th>
          </tr>
        </thead>
        <tbody>
          {example.rows.map((row) => (
            <tr
              key={row.id}
              ref={(el) => void (el ? rowRefs.current.set(row.id, el) : rowRefs.current.delete(row.id))}
              className="border-b last:border-0 data-suspect:bg-red-500/8"
              data-suspect={suspects.has(row.id) ? "" : undefined}
            >
              <td className="py-1.5">{row.label}</td>
              {example.kind === "balance" && <td className="py-1.5 text-xs text-muted-foreground capitalize">{row.side}</td>}
              <td className="py-1.5 text-right tabular-nums">
                {money(row.value)}
                {example.kind === "percent" && "%"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <SumCheck
        key={tab}
        rows={example.rows}
        kind={example.kind}
        total={total}
        roundedTo={example.roundedTo}
        format={example.kind === "percent" ? undefined : money}
        totalLabel={example.kind === "total" ? "Stated subtotal" : undefined}
        onSuspectSelect={flash}
        onUseSum={(sum) => setTotals((t) => ({ ...t, [tab]: sum }))}
      />
    </div>
  )
}
