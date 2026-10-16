"use client"

import * as React from "react"

import { IrreversibleBadge, IrreversibleDiffSummary, type IrreversibleField } from "@/registry/default/irreversible-diff-badge/irreversible-diff-badge"

const REGIONS: Record<string, string> = { "ap-south-1": "Mumbai (ap-south-1)", "eu-central-1": "Frankfurt (eu-central-1)", "us-east-1": "Virginia (us-east-1)" }

const permanent: IrreversibleField[] = [
  { key: "username", label: "Username", severity: "limited", consequence: "Your old profile and gist links stop working, and someone else can claim the old name." },
  { key: "region", label: "Data region", consequence: "Existing data stays in the old region. Moving it later means a support migration.", format: (v) => REGIONS[String(v)] ?? String(v) },
  { key: "encryption", label: "Encryption", consequence: "Self-managed keys can't be recovered by us. Lose the passphrase, lose the data.", format: (v) => (v === "self" ? "Self-managed key" : "Managed by us") },
]

const saved = { name: "Tushar K", username: "tusharkhadde", region: "ap-south-1", encryption: "managed" }
const field = "h-9 w-full min-w-0 rounded-md border bg-transparent px-3 text-base shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 md:text-sm dark:bg-input/30"

export function Demo() {
  const [form, setForm] = React.useState({ ...saved, username: "devtushar", region: "eu-central-1" })
  const [status, setStatus] = React.useState("")
  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm({ ...form, [key]: e.target.value })
  const changed = (key: keyof typeof form) => form[key] !== saved[key]

  return (
    <form className="grid w-full max-w-md gap-4" onSubmit={(e) => e.preventDefault()}>
      <div className="grid gap-1.5">
        <label htmlFor="ir-name" className="text-sm font-medium">Display name</label>
        <input id="ir-name" value={form.name} onChange={set("name")} className={field} />
      </div>
      <div className="grid gap-1.5">
        <label htmlFor="ir-username" className="flex items-center gap-2 text-sm font-medium">
          Username <IrreversibleBadge severity="limited" changed={changed("username")} />
        </label>
        <input id="ir-username" value={form.username} onChange={set("username")} className={field} />
      </div>
      <div className="grid gap-1.5">
        <label htmlFor="ir-region" className="flex items-center gap-2 text-sm font-medium">
          Data region <IrreversibleBadge changed={changed("region")} />
        </label>
        <select id="ir-region" value={form.region} onChange={set("region")} className={field}>
          {Object.entries(REGIONS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>
      <fieldset className="grid gap-1.5">
        <legend className="mb-1.5 flex items-center gap-2 text-sm font-medium">
          Encryption <IrreversibleBadge changed={changed("encryption")} />
        </legend>
        {(["managed", "self"] as const).map((v) => (
          <label key={v} className="flex items-center gap-2 text-sm">
            <input type="radio" name="ir-enc" value={v} checked={form.encryption === v} onChange={set("encryption")} className="size-4" />
            {v === "self" ? "Self-managed key" : "Managed by us"}
          </label>
        ))}
      </fieldset>
      <IrreversibleDiffSummary
        fields={permanent}
        saved={saved}
        current={form}
        onRevert={(key, value) => setForm((f) => ({ ...f, [key]: value }))}
        onSave={async () => {
          await new Promise((r) => setTimeout(r, 600))
          setStatus("Saved.")
        }}
      />
      <p aria-live="polite" className="text-xs text-muted-foreground empty:hidden">{status}</p>
    </form>
  )
}
