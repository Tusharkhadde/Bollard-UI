"use client"

import { KycNameMatch, type IdRecord } from "@/registry/default/kyc-name-match/kyc-name-match"

// The user typed a short form of their name, and Aadhaar has day and month swapped in the date of birth.
const records: IdRecord[] = [
  { id: "pan", label: "PAN", name: "RAJESH KUMAR SHARMA", pan: "ABCPS1234K", dob: "1994-03-12", gender: "M" },
  { id: "aadhaar", label: "Aadhaar", name: "Rajesh Kumar Sharma", dob: "1994-12-03", gender: "M" },
  { id: "bank", label: "Bank account", name: "R K SHARMA" },
]

export function Demo() {
  return <KycNameMatch defaultValue="Rajesh Sharma" records={records} />
}
