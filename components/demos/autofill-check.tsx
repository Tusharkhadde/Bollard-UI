"use client"

import * as React from "react"

import { AutofillCheck } from "@/registry/default/autofill-check/autofill-check"

const input =
  "h-9 w-full min-w-0 rounded-md border bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30"

/** What a password manager might paste in: an email in Name and an address from two moves ago. */
const SAVED = { name: "priya.sharma@gmail.com", email: "priya.sharma@gmail.com", tel: "+91 98220 41567", address: "Flat 4, Lane 7, Koregaon Park" }

export function Demo() {
  const [values, setValues] = React.useState({ name: "", email: "", tel: "", address: "" })
  const [sent, setSent] = React.useState(false)
  const formRef = React.useRef<HTMLFormElement>(null)

  // Fill the form the way an extension does: set each value and fire input, no typing.
  const simulate = React.useCallback(() => {
    for (const [name, value] of Object.entries(SAVED)) {
      const el = formRef.current?.elements.namedItem(name) as HTMLInputElement | null
      if (!el) continue
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(el, value)
      el.dispatchEvent(new Event("input", { bubbles: true }))
    }
  }, [])
  React.useEffect(() => {
    const timer = setTimeout(simulate, 300)
    return () => clearTimeout(timer)
  }, [simulate])

  const field = (name: keyof typeof values, label: string, props: React.ComponentProps<"input">) => (
    <div className="grid gap-1.5">
      <label htmlFor={`af-${name}`} className="w-fit text-sm font-medium">{label}</label>
      <input id={`af-${name}`} name={name} value={values[name]} onChange={(e) => setValues((v) => ({ ...v, [name]: e.target.value }))} className={input} {...props} />
    </div>
  )

  return (
    <form ref={formRef} className="w-full max-w-sm" onSubmit={(e) => { e.preventDefault(); setSent(true) }}>
      <AutofillCheck reference={{ address: "B-204, Sai Residency, Baner Road" }}>
        {field("name", "Full name", { autoComplete: "name" })}
        {field("email", "Email", { type: "email", autoComplete: "email" })}
        {field("tel", "Phone", { type: "tel", autoComplete: "tel" })}
        {field("address", "Delivery address", { autoComplete: "street-address" })}
        <div className="flex items-center justify-between gap-2">
          <button type="button" onClick={simulate} className="h-8 rounded-md px-3 text-sm text-muted-foreground hover:bg-accent outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50">
            Autofill again
          </button>
          <button type="submit" className="h-9 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50">
            {sent ? "Sent" : "Place order"}
          </button>
        </div>
      </AutofillCheck>
    </form>
  )
}
