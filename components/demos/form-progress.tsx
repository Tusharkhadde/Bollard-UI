"use client"

import * as React from "react"

import { FormProgress } from "@/registry/default/form-progress/form-progress"

const input =
  "h-9 w-full rounded-md border bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30 dark:[&>option]:bg-popover"

export function Demo() {
  const formRef = React.useRef<HTMLFormElement>(null)
  const [hasGst, setHasGst] = React.useState(false)

  return (
    <form ref={formRef} noValidate onSubmit={(event) => event.preventDefault()} className="w-full max-w-sm space-y-3">
      <FormProgress formRef={formRef} className="sticky top-2 z-10" />
      <label className="block space-y-1.5 text-sm">
        <span className="font-medium">Business name *</span>
        <input required name="business" className={input} />
      </label>
      <label className="block space-y-1.5 text-sm">
        <span className="font-medium">Work email *</span>
        <input required name="email" type="email" defaultValue="priya@" className={input} />
      </label>
      <label className="block space-y-1.5 text-sm">
        <span className="font-medium">Company (optional)</span>
        <input name="company" className={input} />
      </label>
      <label className="block space-y-1.5 text-sm">
        <span className="font-medium">City *</span>
        <select required name="city" defaultValue="" className={input}>
          <option value="" disabled>
            Choose a city
          </option>
          <option>Pune</option>
          <option>Mumbai</option>
          <option>Bengaluru</option>
        </select>
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={hasGst} onChange={(event) => setHasGst(event.target.checked)} />I have a GST
        number
      </label>
      {hasGst && (
        <label className="block space-y-1.5 text-sm">
          <span className="font-medium">GSTIN *</span>
          <input required name="gstin" pattern="[0-9A-Z]{15}" placeholder="15 characters" className={input} />
        </label>
      )}
      <label className="flex items-center gap-2 text-sm">
        <input required type="checkbox" name="terms" />I agree to the terms *
      </label>
    </form>
  )
}
