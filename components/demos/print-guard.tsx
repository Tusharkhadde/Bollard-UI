"use client"

import * as React from "react"

import { PrintGuard } from "@/registry/default/print-guard/print-guard"

const rows = [
  ["INV-2041", "12 Oct 2026", "Website redesign", "1", "₹32,000", "18%", "₹5,760", "₹37,760"],
  ["INV-2042", "12 Oct 2026", "Hosting, 12 months", "1", "₹8,850", "18%", "₹1,593", "₹10,443"],
]
const head = ["Invoice", "Date", "Item", "Qty", "Amount", "GST", "Tax", "Total"]

export function Demo() {
  const doc = React.useRef<HTMLElement>(null)

  return (
    <div className="w-full max-w-xl space-y-3">
      <PrintGuard target={doc} checkOnMount />
      <article ref={doc} className="space-y-3 rounded-xl border bg-white p-4 text-sm text-zinc-900">
        <div className="rounded-lg bg-zinc-900 p-3 text-white">
          <p className="text-xs text-zinc-300">Total due by 31 Oct</p>
          <p className="text-lg font-semibold tabular-nums">₹48,203</p>
        </div>
        <div className="overflow-x-auto rounded-md border border-zinc-200">
          <table className="min-w-[960px] text-left text-xs">
            <thead className="bg-zinc-50">
              <tr>{head.map((cell) => <th key={cell} className="px-3 py-1.5 font-medium">{cell}</th>)}</tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row[0]} className="border-t border-zinc-200">
                  {row.map((cell, index) => <td key={index} className="px-3 py-1.5 tabular-nums">{cell}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <details className="rounded-md border border-zinc-200 px-3 py-1.5">
          <summary className="cursor-pointer font-medium">Payment terms</summary>
          <p className="mt-1 text-xs text-zinc-600">Pay within 15 days. Late payments carry 1.5% interest per month.</p>
        </details>
        <p className="text-xs text-zinc-600">
          Pay by UPI or card at the{" "}
          <a href="https://pay.example.com/inv/2041" className="font-medium text-blue-700 underline">
            payment page
          </a>
          .
        </p>
      </article>
    </div>
  )
}
