"use client"

import * as React from "react"

import { UpdateAvailable } from "@/registry/default/update-available/update-available"

const saved = "Ship the pricing page on Friday."

export function Demo() {
  const [running, setRunning] = React.useState("2026.10.12")
  const [draft, setDraft] = React.useState(`${saved} Ask Priya for the final copy`)
  const [lastSaved, setLastSaved] = React.useState(saved)
  const [saving, setSaving] = React.useState(false)
  const dirty = draft !== lastSaved

  const save = () => {
    setSaving(true)
    setTimeout(() => {
      setLastSaved(draft)
      setSaving(false)
    }, 700)
  }

  return (
    <div className="w-full max-w-md space-y-3">
      <UpdateAvailable
        currentVersion={running}
        latestVersion="2026.10.13"
        dirty={dirty}
        whatsNew="Fixes rounding on invoice totals."
        onRefresh={() => setRunning("2026.10.13")}
      />
      <div className="space-y-2 rounded-xl border bg-background p-4">
        <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
          <label htmlFor="update-demo-note" className="font-medium">
            Note
          </label>
          <span>
            v{running} · {saving ? "Saving…" : dirty ? "Unsaved changes" : "Saved"}
          </span>
        </div>
        <textarea
          id="update-demo-note"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          rows={3}
          className="w-full resize-none rounded-md border bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30"
        />
        <div className="flex justify-end gap-2">
          {running === "2026.10.13" && (
            <button
              type="button"
              onClick={() => setRunning("2026.10.12")}
              className="h-8 rounded-md border px-3 text-sm font-medium hover:bg-accent outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
            >
              Reset demo
            </button>
          )}
          <button
            type="button"
            onClick={save}
            disabled={!dirty || saving}
            className="h-8 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground outline-none hover:bg-primary/90 focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-50"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  )
}
