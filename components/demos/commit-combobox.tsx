"use client"

import * as React from "react"

import { CommitCombobox, type ComboOption } from "@/registry/default/commit-combobox/commit-combobox"

const CITIES: ComboOption[] = [
  { value: "blr", label: "Bengaluru, Karnataka", keywords: ["Bangalore", "BLR"] },
  { value: "bom", label: "Mumbai, Maharashtra", keywords: ["Bombay"] },
  { value: "pnq", label: "Pune, Maharashtra" },
  { value: "ixu", label: "Chhatrapati Sambhajinagar, Maharashtra", keywords: ["Aurangabad"] },
  { value: "aur-br", label: "Aurangabad, Bihar" },
  { value: "del", label: "New Delhi, Delhi" },
  { value: "maa", label: "Chennai, Tamil Nadu", keywords: ["Madras"] },
  { value: "hyd", label: "Hyderabad, Telangana" },
  { value: "ccu", label: "Kolkata, West Bengal", keywords: ["Calcutta"] },
  { value: "amd", label: "Ahmedabad, Gujarat" },
]

export function Demo() {
  const [office, setOffice] = React.useState<ComboOption | null>(CITIES[2])
  return (
    <form className="grid w-full max-w-sm gap-3" onSubmit={(event) => event.preventDefault()}>
      <CommitCombobox label="Delivery city" options={CITIES} defaultInputValue="Banglore" />
      <CommitCombobox label="Warehouse city" options={CITIES} defaultInputValue="aurangabad" />
      <CommitCombobox label="Office city" options={CITIES} value={office} onValueChange={setOffice} />
      <p className="text-xs text-muted-foreground">
        Office saved as <code className="font-mono text-foreground">{office?.value ?? "nothing"}</code>. Edit its text to see the pick drop, then press Esc.
      </p>
    </form>
  )
}
