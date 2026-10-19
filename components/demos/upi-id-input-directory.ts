import type { UpiVerification } from "@/registry/default/upi-id-input/upi-id-input"

// A tiny local directory for the interactive preview; it is not a real UPI lookup.
const directory: Record<string, string> = {
  "rohan.sharma@okaxis": "ROHAN SHARMA",
  "9876543210@ybl": "PRIYA MEHTA",
  "kumarstores@ybl": "RAVI VERMA",
}

export function verifyDemoUpi(vpa: string): Promise<UpiVerification | null> {
  return new Promise((resolve) => setTimeout(() => {
    const name = directory[vpa]
    resolve(name ? { valid: true, name } : null)
  }, 300))
}
