"use client"

import * as React from "react"

import { LocaleNotice, LocaleNumberField } from "@/registry/default/locale-notice/locale-notice"

export function Demo() {
  const [units, setUnits] = React.useState<string>()

  return (
    <div className="grid w-full max-w-sm gap-4">
      <div className="grid gap-1.5">
        <p className="text-sm font-medium">Order quantity for the Berlin warehouse</p>
        {units ? (
          <p className="rounded-md border px-3 py-2 text-base font-medium tabular-nums shadow-xs">{units} units</p>
        ) : (
          <LocaleNotice value={1000} readerLocale="de-DE" onUseSafe={setUnits} />
        )}
      </div>
      <LocaleNotice value={new Date(2026, 2, 4)} readerLocale="en-GB" aria-label="Ship date" />
      <LocaleNumberField label="Weight (kg)" locale="en-US" defaultValue="1,5" />
    </div>
  )
}
