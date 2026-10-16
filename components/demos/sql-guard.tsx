"use client"

import * as React from "react"

import { SqlGuard, type SqlStatementInfo } from "@/registry/default/sql-guard/sql-guard"

const TABLE_ROWS: Record<string, number> = { users: 48_210, orders: 312_904 }

/** Stand-in for EXPLAIN: whole table without a usable WHERE, one row otherwise. */
const estimate = (s: SqlStatementInfo) =>
  new Promise<number | null>((resolve) =>
    setTimeout(() => resolve(s.risks.length ? (TABLE_ROWS[s.table ?? ""] ?? null) : 1), 600),
  )

export function Demo() {
  const [log, setLog] = React.useState<string>()
  return (
    <div className="grid w-full max-w-lg gap-2">
      <SqlGuard
        env="production"
        defaultValue={"UPDATE users SET plan = 'free'\n-- WHERE id = 4182;"}
        estimateRows={estimate}
        onRun={(sql) => setLog(`Ran ${sql.split(/\s+/)[0].toUpperCase()} on production.`)}
      />
      <p aria-live="polite" className="min-h-5 text-xs text-muted-foreground">{log}</p>
    </div>
  )
}
