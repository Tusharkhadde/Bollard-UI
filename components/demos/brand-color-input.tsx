"use client"

import { BrandColorInput } from "@/registry/default/brand-color-input/brand-color-input"

const palette = {
  "blue-700": "#1e40af",
  "blue-500": "#3b82f6",
  "slate-900": "#0f172a",
  "amber-400": "#fbbf24",
}

export function Demo() {
  return (
    <form className="grid w-full max-w-sm gap-3" onSubmit={(event) => event.preventDefault()}>
      <BrandColorInput label="Button background" defaultValue="#1E40AE" palette={palette} />
      <BrandColorInput label="Link colour (from the Android app)" defaultValue="#FF3B82F6" palette={palette} />
      <BrandColorInput label="Heading text" placeholder="#0f172a" palette={palette} />
    </form>
  )
}
