"use client"

import { DiffTable, type DiffColumn, type DiffRow } from "@/registry/default/diff-table/diff-table"

const columns: DiffColumn[] = [
  { id: "starter", label: "Starter", description: "₹0/mo" },
  { id: "team", label: "Team", description: "₹799/mo" },
  { id: "business", label: "Business", description: "₹2,499/mo" },
]

// The vendor's sheet left Team's audit log blank and put a dash for Starter's SLA.
// Storage reads "100GB" vs "100 GB": the same value, so it isn't marked.
const rows: DiffRow[] = [
  { id: "seats", label: "Seats", values: { starter: 1, team: 10, business: "Unlimited" } },
  { id: "storage", label: "Storage", values: { starter: "5 GB", team: "100GB", business: "100 GB" } },
  { id: "sso", label: "SSO", values: { starter: false, team: false, business: true } },
  { id: "audit", label: "Audit log", values: { starter: false, business: true } },
  { id: "api", label: "API access", values: { starter: true, team: true, business: true } },
  { id: "sla", label: "Uptime SLA", values: { starter: "—", team: "99.9%", business: "99.9%" } },
  { id: "domain", label: "Custom domain", values: { starter: true, team: true, business: true } },
  { id: "2fa", label: "Two-factor login", values: { starter: true, team: true, business: true } },
  { id: "support", label: "Support", values: { starter: "Email", team: "Email", business: "Priority" } },
]

export function Demo() {
  return <DiffTable columns={columns} rows={rows} caption="Plan comparison" defaultDifferencesOnly className="max-w-lg" />
}
