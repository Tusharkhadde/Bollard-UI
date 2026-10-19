import type { PinPlace } from "@/registry/default/pincode-input/pincode"

// A small offline preview dataset, not a complete India Post directory.
const places: Record<string, PinPlace> = {
  "411039": { district: "Pune", state: "Maharashtra", areas: ["Bhosari", "Bhosari Gaon", "Dighi Camp"] },
  "400001": { district: "Mumbai", state: "Maharashtra", areas: ["Fort", "Mumbai GPO"] },
  "560001": { district: "Bengaluru", state: "Karnataka", areas: ["Bangalore GPO", "Vidhana Soudha"] },
}

export function lookupDemoPin(pin: string): Promise<PinPlace | undefined> {
  return new Promise((resolve) => setTimeout(() => resolve(places[pin]), 300))
}
