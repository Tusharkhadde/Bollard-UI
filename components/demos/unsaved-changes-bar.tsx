"use client"

import * as React from "react"

import { UnsavedChangesBar, useUnsavedChanges } from "@/registry/default/unsaved-changes-bar/unsaved-changes-bar"

type Profile = { name: string; email: string; plan: string; billing: boolean }

const labels = { name: "Name", email: "Email", plan: "Plan", billing: "Billing contact" }
const SAVED: Profile = { name: "Priya Sharma", email: "priya@acme.com", plan: "Pro", billing: false }
const field =
  "h-9 w-full rounded-md border bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30"

export function Demo() {
  const [saved, setSaved] = React.useState(SAVED)
  // Starts with two edits, so the bar is already naming what would be lost.
  const [draft, setDraft] = React.useState<Profile>({ ...SAVED, email: "priya.sharma@acme.com", plan: "Enterprise" })
  const dirty = useUnsavedChanges(saved, draft)
  const set = <K extends keyof Profile>(key: K, value: Profile[K]) => setDraft((d) => ({ ...d, [key]: value }))

  return (
    <div className="w-full max-w-lg space-y-3">
      <div className="grid gap-3 rounded-xl border bg-background p-4 sm:grid-cols-2">
        <label className="space-y-1.5 text-sm">
          <span className="font-medium">Name</span>
          <input className={field} value={draft.name} onChange={(e) => set("name", e.target.value)} />
        </label>
        <label className="space-y-1.5 text-sm">
          <span className="font-medium">Email</span>
          <input className={field} type="email" value={draft.email} onChange={(e) => set("email", e.target.value)} />
        </label>
        <label className="space-y-1.5 text-sm">
          <span className="font-medium">Plan</span>
          <select className={field} value={draft.plan} onChange={(e) => set("plan", e.target.value)}>
            <option>Free</option>
            <option>Pro</option>
            <option>Enterprise</option>
          </select>
        </label>
        <label className="flex items-center gap-2 self-end pb-2 text-sm">
          <input type="checkbox" checked={draft.billing} onChange={(e) => set("billing", e.target.checked)} />
          Billing contact
        </label>
        <p className="text-xs text-muted-foreground sm:col-span-2">
          Tap a chip to undo one field. Typing a value back to the saved one clears it too.
        </p>
      </div>
      <UnsavedChangesBar
        fields={dirty}
        labels={labels}
        onSave={() => new Promise<void>((resolve) => setTimeout(() => { setSaved(draft); resolve() }, 700))}
        onDiscard={() => setDraft(saved)}
        onRevertField={(key) => setDraft((d) => ({ ...d, [key]: saved[key as keyof Profile] }))}
        className="bottom-0"
      />
      {dirty.length === 0 && <p className="text-center text-xs text-muted-foreground">All changes saved.</p>}
    </div>
  )
}
