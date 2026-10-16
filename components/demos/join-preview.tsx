"use client"

import { JoinPreview } from "@/registry/default/join-preview/join-preview"

const orders = [
  { order_id: "A-1001", customer_id: 101, total: 1499 },
  { order_id: "A-1002", customer_id: 102, total: 820 },
  { order_id: "A-1003", customer_id: 102, total: 2350 },
  { order_id: "A-1004", customer_id: 103, total: 640 },
  { order_id: "A-1005", customer_id: 104, total: 1210 },
  { order_id: "A-1006", customer_id: 105, total: 380 },
  { order_id: "A-1007", customer_id: null, total: 990 },
  { order_id: "A-1008", customer_id: 107, total: 1750 },
]

// Exported from a spreadsheet: ids are text, one has a stray space, one kept its leading zero,
// and customer 102 has two rows because their segment changed.
const customers = [
  { id: "101", name: "Priya Sharma", segment: "Retail" },
  { id: "102", name: "Rahul Verma", segment: "Retail" },
  { id: "102", name: "Rahul Verma", segment: "Wholesale" },
  { id: "103", name: "Ananya Iyer", segment: "Retail" },
  { id: "0104", name: "Kabir Mehta", segment: "Wholesale" },
  { id: "105 ", name: "Sara Khan", segment: "Retail" },
  { id: "106", name: "Dev Patel", segment: "Retail" },
]

export function Demo() {
  return (
    <JoinPreview
      left={{ name: "orders", rows: orders }}
      right={{ name: "customers", rows: customers }}
      leftOn="customer_id"
      rightOn="id"
      expect="m:1"
      onJoin={() => new Promise((resolve) => setTimeout(resolve, 600))}
    />
  )
}
