"use client"

import * as React from "react"
import { Pin } from "lucide-react"

import { ariaSort, SortButton, SortIndicator, sortRows, useFlip, type SortColumn, type SortState } from "@/registry/default/sort-indicator/sort-indicator"

interface Task {
  id: string
  task: string
  due: string | null
  priority: number
  pinned?: boolean
}

const tasks: Task[] = [
  { id: "t1", task: "Quarterly GST filing", due: "2026-10-20", priority: 3, pinned: true },
  { id: "t2", task: "Renew domain", due: "2026-10-16", priority: 1 },
  { id: "t3", task: "Fix checkout bug", due: null, priority: 5 },
  { id: "t4", task: "Send invoices", due: "2026-10-14", priority: 4 },
  { id: "t5", task: "Update docs", due: null, priority: 2 },
  { id: "t6", task: "Team retro", due: "2026-10-18", priority: 2 },
]

const dateFormat = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" })

export function Demo() {
  const [sort, setSort] = React.useState<SortState | null>({ column: "priority", direction: "desc" })
  const [showPriority, setShowPriority] = React.useState(false)
  const columns: SortColumn[] = [
    { id: "task", label: "Task", type: "text" },
    { id: "due", label: "Due date", type: "date" },
    { id: "priority", label: "Priority", type: "number", hidden: !showPriority, firstDirection: "desc" },
  ]
  const sorted = sortRows(tasks, sort, {
    getValue: (row, column) => (column === "due" ? (row.due ? Date.parse(row.due) : null) : row[column as keyof Task]),
    isPinned: (row) => !!row.pinned,
  })
  const tbody = useFlip<HTMLTableSectionElement>(sorted.rows.map((r) => r.id).join())
  const visible = columns.filter((c) => !c.hidden)

  return (
    <div className="grid w-full max-w-sm gap-3">
      <SortIndicator
        columns={columns}
        value={sort}
        onValueChange={setSort}
        emptyCount={sorted.emptyCount}
        pinnedCount={sorted.pinnedCount}
        onRevealColumn={() => setShowPriority(true)}
        rowWords={["task", "tasks"]}
      />
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-xs text-muted-foreground">
            {visible.map((column) => (
              <th key={column.id} aria-sort={ariaSort(sort, column.id)} className={column.id === "task" ? "py-1.5" : "py-1.5 text-right"}>
                <SortButton column={column} sort={sort} onSortChange={setSort} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody ref={tbody}>
          {sorted.rows.map((row) => (
            <tr key={row.id} data-flip-key={row.id} className="relative border-b bg-card last:border-0">
              <td className="py-1.5 pr-2">
                <span className="flex items-center gap-1.5">
                  {row.pinned && <Pin aria-label="Pinned" className="size-3.5 shrink-0 text-muted-foreground" />}
                  <span className="truncate">{row.task}</span>
                </span>
              </td>
              <td className="py-1.5 text-right whitespace-nowrap tabular-nums">
                {row.due ? dateFormat.format(new Date(row.due)) : <span className="text-muted-foreground">None</span>}
              </td>
              {showPriority && <td className="py-1.5 text-right tabular-nums">P{row.priority}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
