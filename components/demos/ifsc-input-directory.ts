import type { IfscDetails } from "@/registry/default/ifsc-input/ifsc-input"

// A small offline demo dataset; it is not a full branch directory.
const branches: Record<string, IfscDetails> = {
  HDFC0001234: { bank: "HDFC Bank", bankCode: "HDFC", branch: "Bhosari", city: "Pune", state: "Maharashtra", neft: true, rtgs: true, imps: true, upi: true },
  ICIC0000456: { bank: "ICICI Bank", bankCode: "ICIC", branch: "Shivajinagar", city: "Pune", state: "Maharashtra", neft: true, rtgs: true, imps: true, upi: true },
  UTIB0000102: { bank: "Axis Bank", bankCode: "UTIB", branch: "Pimpri", city: "Pune", state: "Maharashtra", neft: true, rtgs: false, imps: true, upi: true },
  UBIN0532207: { bank: "Union Bank of India", bankCode: "UBIN", branch: "Kasarwadi - Pune", city: "Pune", state: "Maharashtra" },
}

export function lookupDemoIfsc(ifsc: string): Promise<IfscDetails | null | undefined> {
  return new Promise((resolve) => setTimeout(() => {
    // This intentionally mistyped preset is a teaching example for the O/0 fix.
    if (ifsc === "UTIB0000IO2") return resolve(null)
    resolve(branches[ifsc] ?? undefined)
  }, 250))
}
