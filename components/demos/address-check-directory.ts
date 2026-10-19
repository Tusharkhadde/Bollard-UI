import type { PostcodePlace } from "@/registry/default/address-check/address-rules"

// A few offline preview entries; this is not an address-provider database.
const places: Record<string, PostcodePlace> = {
  "IN:411045": { city: "Pune", region: "Maharashtra" },
  "IN:560001": { city: "Bengaluru", aliases: ["Bangalore"], region: "Karnataka" },
  "GB:SW1A 1AA": { city: "London" },
  "US:94103": { city: "San Francisco", region: "CA" },
}

export function lookupDemoPostcode(country: string, postcode: string, signal?: AbortSignal): Promise<PostcodePlace | undefined> {
  return new Promise((resolve, reject) => {
    const finish = () => {
      signal?.removeEventListener("abort", abort)
      resolve(places[`${country}:${postcode}`])
    }
    const timer = setTimeout(finish, 400)
    const abort = () => {
      clearTimeout(timer)
      signal?.removeEventListener("abort", abort)
      reject(signal?.reason)
    }
    if (signal?.aborted) abort()
    else signal?.addEventListener("abort", abort, { once: true })
  })
}
