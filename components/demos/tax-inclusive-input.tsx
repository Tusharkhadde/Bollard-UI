"use client"

import { TaxInclusiveInput } from "@/registry/default/tax-inclusive-input/tax-inclusive-input"

export function Demo() {
  return (
    <form className="grid w-full max-w-sm gap-6" onSubmit={(event) => event.preventDefault()}>
      <TaxInclusiveInput label="Plan price" defaultValue={{ amount: 1180, rate: 18, includesTax: false }} />
      <TaxInclusiveInput
        label="Price (UK)"
        currency="GBP"
        locale="en-GB"
        taxName="VAT"
        rates={[0, 5, 20]}
        defaultValue={{ amount: 49.99, rate: 0.2, includesTax: true }}
      />
    </form>
  )
}
