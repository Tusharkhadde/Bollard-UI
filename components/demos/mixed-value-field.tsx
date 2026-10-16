"use client"

import * as React from "react"

import { countChanged, MixedValueField, type BulkChange } from "@/registry/default/mixed-value-field/mixed-value-field"

const repeat = <T,>(value: T, times: number) => Array<T>(times).fill(value)
// 40 selected tasks.
const status = [...repeat("todo", 18), ...repeat("doing", 10), ...repeat("done", 12)]
const assignee = [...repeat("Priya", 20), ...repeat("Rahul", 15), ...repeat(null, 5)]
const statusOptions = [
  { value: "todo", label: "To do" },
  { value: "doing", label: "In progress" },
  { value: "done", label: "Done" },
]
const tasks = (count: number) => `${count} ${count === 1 ? "task" : "tasks"}`

export function Demo() {
  const [statusChange, setStatusChange] = React.useState<BulkChange>({
    set: "done",
  })
  const [assigneeChange, setAssigneeChange] = React.useState<BulkChange>(null)
  const [saved, setSaved] = React.useState("")
  const edits = [
    statusChange && countChanged(status, statusChange),
    assigneeChange && countChanged(assignee, assigneeChange),
  ].filter(Boolean).length

  return (
    <form
      className="grid w-full max-w-sm gap-4"
      onSubmit={(event) => {
        event.preventDefault()
        setSaved(`Saved ${edits} ${edits === 1 ? "field" : "fields"}. Untouched fields kept their own values.`)
      }}
    >
      <p className="text-sm font-medium">Edit 40 tasks</p>
      <MixedValueField
        label="Status"
        values={status}
        options={statusOptions}
        value={statusChange}
        onValueChange={setStatusChange}
        formatItems={tasks}
      />
      <MixedValueField
        label="Assignee"
        values={assignee}
        value={assigneeChange}
        onValueChange={setAssigneeChange}
        formatItems={tasks}
        allowClear
      />
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground" aria-live="polite">
          {saved}
        </p>
        <button
          type="submit"
          disabled={!edits}
          className="inline-flex h-9 shrink-0 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow-xs transition-colors outline-none hover:bg-primary/90 focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50"
        >
          Apply {edits === 1 ? "1 change" : `${edits} changes`}
        </button>
      </div>
    </form>
  )
}
