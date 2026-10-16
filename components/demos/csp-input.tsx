"use client"

import { CspInput } from "@/registry/default/csp-input/csp-input"

export function Demo() {
  return (
    <CspInput
      defaultValue={"Content-Security-Policy-Report-Only: default-src 'self'; script-src 'self' 'unsafe-inline' data:; style-src self"}
    />
  )
}
