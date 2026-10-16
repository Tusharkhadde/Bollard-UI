"use client"

import { AddressCheck, type PostcodePlace } from "@/registry/default/address-check/address-check"

/** A tiny stand-in for a real postcode API (India Post, Royal Mail PAF, USPS). */
const PLACES: Record<string, PostcodePlace> = {
  "IN:411045": { city: "Pune", region: "Maharashtra" },
  "IN:560001": { city: "Bengaluru", aliases: ["Bangalore"], region: "Karnataka" },
  "GB:SW1A 1AA": { city: "London" },
  "US:94103": { city: "San Francisco", region: "CA" },
}

const lookup = (country: string, postcode: string, signal: AbortSignal) =>
  new Promise<PostcodePlace | null>((resolve, reject) => {
    const timer = setTimeout(() => resolve(PLACES[`${country}:${postcode}`] ?? null), 400)
    signal.addEventListener("abort", () => { clearTimeout(timer); reject(signal.reason) })
  })

export function Demo() {
  return (
    <AddressCheck
      lookupPostcode={lookup}
      defaultValue={{ country: "IN", line1: "Sai Residency, Baner Road", line2: "", city: "Mumbai", region: "Maharashtra", postcode: "411045" }}
    />
  )
}
