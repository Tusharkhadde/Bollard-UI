"use client"

import { OverflowList, type OverflowItem } from "@/registry/default/overflow-list/overflow-list"

// A plain "first 3, then +N" would fold away the failed check (6th) and the reviewer asking for changes.
const checks: OverflowItem[] = [
  { id: "build", label: "Build" },
  { id: "lint", label: "Lint" },
  { id: "types", label: "Type check" },
  { id: "unit", label: "Unit tests", tone: "warning", status: "skipped" },
  { id: "e2e-chrome", label: "E2E Chrome" },
  { id: "integration", label: "Integration", tone: "error", status: "failed" },
  { id: "e2e-safari", label: "E2E Safari", status: "pending" },
  { id: "bundle", label: "Bundle size" },
]

const reviewers: OverflowItem[] = [
  { id: "asha", label: "Asha Rao" },
  { id: "ben", label: "Ben Ortiz" },
  { id: "chen", label: "Chen Wei" },
  { id: "divya", label: "Divya Nair", status: "away" },
  { id: "elif", label: "Elif Kaya" },
  { id: "farah", label: "Farah Ali", tone: "error", status: "changes requested" },
  { id: "sam", label: "Sam Patel", current: true },
]

export function Demo() {
  return (
    <div className="grid w-full max-w-sm gap-4">
      <div className="grid gap-1.5">
        <p className="text-xs font-medium text-muted-foreground">Checks</p>
        <OverflowList label="Checks" items={checks} max={3} />
      </div>
      <div className="grid gap-1.5">
        <p className="text-xs font-medium text-muted-foreground">Reviewers</p>
        <OverflowList label="Reviewers" items={reviewers} max={3} variant="avatars" />
      </div>
    </div>
  )
}
