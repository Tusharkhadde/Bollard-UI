"use client"

import { AddressCheck } from "@/registry/default/address-check/address-check"
import { lookupDemoPostcode } from "./address-check-directory"

const lookup = (country: string, postcode: string, signal: AbortSignal) => lookupDemoPostcode(country, postcode, signal)

export function Demo() {
  return (
    <AddressCheck
      lookupPostcode={lookup}
      postcodeLookupUnknownMessage="This preview only recognizes a few sample postcodes. Your address isn't sent anywhere."
      defaultValue={{ country: "IN", line1: "Sai Residency, Baner Road", line2: "", city: "Mumbai", region: "Maharashtra", postcode: "411045" }}
    />
  )
}
