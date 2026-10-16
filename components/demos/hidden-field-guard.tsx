"use client"

import * as React from "react"

import { HiddenFieldGuard } from "@/registry/default/hidden-field-guard/hidden-field-guard"

const input =
  "h-9 w-full min-w-0 rounded-md border bg-transparent px-3 text-base shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 md:text-sm dark:bg-input/30"

export function Demo() {
  const [different, setDifferent] = React.useState(false)
  const [address, setAddress] = React.useState({ street: "14 Lake Road", city: "Pune", postcode: "411039" })
  const [sent, setSent] = React.useState<string>()
  const set = (key: keyof typeof address) => (event: React.ChangeEvent<HTMLInputElement>) =>
    setAddress((current) => ({ ...current, [key]: event.target.value }))

  return (
    <form
      className="grid w-full max-w-sm gap-3"
      onSubmit={(event) => {
        event.preventDefault()
        const data = [...new FormData(event.currentTarget).entries()].filter(([, value]) => value !== "")
        setSent(data.map(([key]) => key).join(", "))
      }}
    >
      <label className="flex items-center gap-2 text-sm font-medium">
        <input
          type="checkbox"
          checked={different}
          onChange={(event) => setDifferent(event.target.checked)}
          className="size-4 accent-primary"
        />
        Ship to a different address
      </label>
      <HiddenFieldGuard hidden={!different} label="Shipping address">
        <div className="grid gap-2 rounded-lg border p-3">
          <label className="grid gap-1.5 text-sm">
            <span className="font-medium">Street</span>
            <input name="street" value={address.street} onChange={set("street")} className={input} />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="grid gap-1.5 text-sm">
              <span className="font-medium">City</span>
              <input name="city" value={address.city} onChange={set("city")} className={input} />
            </label>
            <label className="grid gap-1.5 text-sm">
              <span className="font-medium">Postcode</span>
              <input name="postcode" value={address.postcode} onChange={set("postcode")} className={input} />
            </label>
          </div>
          <label className="grid gap-1.5 text-sm">
            <span className="font-medium">Country</span>
            <select name="country" defaultValue="IN" className={input}>
              <option value="IN">India</option>
              <option value="AE">United Arab Emirates</option>
            </select>
          </label>
        </div>
      </HiddenFieldGuard>
      <div className="flex items-center justify-between gap-3">
        <span className="min-w-0 truncate text-xs text-muted-foreground" aria-live="polite">
          {sent === undefined ? "" : `Sent: ${sent || "nothing"}`}
        </span>
        <button
          type="submit"
          className="inline-flex h-9 shrink-0 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow-xs outline-none hover:bg-primary/90 focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          Place order
        </button>
      </div>
    </form>
  )
}
