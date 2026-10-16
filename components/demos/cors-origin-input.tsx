"use client"

import { CorsOriginInput } from "@/registry/default/cors-origin-input/cors-origin-input"

export function Demo() {
  return (
    <CorsOriginInput
      credentials
      production
      defaultValue={["https://app.acme.com/", "admin.acme.com", "*", "http://localhost:3000", "https://acme.com"]}
    />
  )
}
