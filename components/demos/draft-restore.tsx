"use client"

import * as React from "react"

import { DraftRestore, type FormValues, type StoredDraft } from "@/registry/default/draft-restore/draft-restore"

const KEY = "bollard-ui:demo:draft-restore"
const labels: FormValues = { email: "Billing email", phone: "Phone", notes: "Notes" }
/** What the server had when the draft was started. */
const base: FormValues = { email: "billing@acme.in", phone: "+91 98200 11223", notes: "" }
/** Since then, a colleague changed the phone number on the server. */
const server: FormValues = { ...base, phone: "+91 98200 99887" }
const draft: FormValues = { email: "accounts@acme.in", phone: "+91 98200 44556", notes: "Invoice monthly, net 30" }

const field =
  "h-9 w-full min-w-0 rounded-md border bg-transparent px-3 text-base shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 md:text-sm dark:bg-input/30"

export function Demo() {
  const [values, setValues] = React.useState<FormValues>(server)
  const [opened, setOpened] = React.useState(0)

  // Pretend the form was edited 5 minutes ago and the tab closed before saving.
  React.useEffect(() => {
    const stored: StoredDraft = { v: 1, savedAt: Date.now() - 5 * 60_000, base, values: draft }
    localStorage.setItem(KEY, JSON.stringify(stored))
    setOpened(1)
  }, [])

  const reopen = () => {
    setValues(server)
    setOpened((count) => count + 1)
  }

  return (
    <div className="grid w-full max-w-md gap-3">
      {opened > 0 && (
        <DraftRestore
          key={opened}
          storageKey={KEY}
          values={values}
          serverValues={server}
          labels={labels}
          onRestore={setValues}
          defaultExpanded
        />
      )}
      <form className="grid gap-3 rounded-xl border bg-background p-4" onSubmit={(event) => event.preventDefault()}>
        <p className="text-sm font-medium">Edit customer · Acme Traders</p>
        {Object.keys(labels).map((name) => (
          <label key={name} className="grid gap-1.5 text-sm font-medium">
            {labels[name]}
            <input name={name} value={values[name]} onChange={(event) => setValues({ ...values, [name]: event.target.value })} className={field} />
          </label>
        ))}
        <button
          type="button"
          onClick={reopen}
          className="h-8 justify-self-start rounded-md border px-3 text-sm font-medium hover:bg-accent outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          Close and reopen form
        </button>
      </form>
    </div>
  )
}
