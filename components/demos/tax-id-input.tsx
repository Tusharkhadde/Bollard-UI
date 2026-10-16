"use client"

import { TaxIdInput } from "@/registry/default/tax-id-input/tax-id-input"

export function Demo() {
  return (
    <form className="grid w-full max-w-sm gap-3" onSubmit={(event) => event.preventDefault()}>
      <TaxIdInput kind="gstin" label="Supplier GSTIN" defaultValue="27AAPFUO939F1ZV" />
      <TaxIdInput kind="vat" label="Customer VAT number" defaultValue="GR094014201" />
      <TaxIdInput kind="pan" label="PAN" hint="Try ABCQK1234F or ABCPK12B4F." />
    </form>
  )
}
