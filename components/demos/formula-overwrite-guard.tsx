"use client"

import * as React from "react"

import { FormulaOverwriteGuard, type Grid } from "@/registry/default/formula-overwrite-guard/formula-overwrite-guard"

const SHEET: Grid = [
  [{ value: "Item" }, { value: "Qty" }, { value: "Price" }, { value: "Total" }],
  [{ value: "Paper" }, { value: "4" }, { value: "250" }, { value: "1000", formula: "=B2*C2" }],
  [{ value: "Toner" }, { value: "" }, { value: "" }, { value: "0", formula: "=B3*C3" }],
  [{ value: "Pens" }, { value: "" }, { value: "" }, { value: "0", formula: "=B4*C4" }],
  [{ value: "Sum", locked: true }, { value: "4", formula: "=SUM(B2:B4)", locked: true }, { value: "", locked: true }, { value: "1000", formula: "=SUM(D2:D4)", locked: true }],
]

// Copied from the supplier's sheet: it has its own heading row and a Notes column.
const COPIED = "Qty\tPrice\tTotal\tNotes\r\n2\t1800\t3600\tA4\r\n10\t20\t200\tblue\r\n"

/** Stand-in for a formula engine: recomputes the demo's Total and Sum cells that are still formulas. */
function recalc(grid: Grid): Grid {
  const n = (s: string | undefined) => Number(s) || 0
  const next = grid.map((row) => row.map((cell) => ({ ...cell })))
  for (let r = 1; r <= 3; r++) if (next[r]?.[3]?.formula) next[r][3].value = String(n(next[r][1].value) * n(next[r][2].value))
  const sum = (c: number) => String([1, 2, 3].reduce((s, r) => s + n(next[r]?.[c]?.value), 0))
  if (next[4]?.[1]?.formula) next[4][1].value = sum(1)
  if (next[4]?.[3]?.formula) next[4][3].value = sum(3)
  return next
}

export function Demo() {
  const [sheet, setSheet] = React.useState(SHEET)
  return <FormulaOverwriteGuard value={sheet} onValueChange={(g) => setSheet(recalc(g))} defaultPaste={{ text: COPIED, row: 2, col: 1 }} />
}
