"use client"

import { HonestBar } from "@/registry/default/honest-bar/honest-bar"

const users = [
  { label: "Jul", value: 9420 },
  { label: "Aug", value: 9610 },
  { label: "Sep", value: 9880 },
  { label: "Oct", value: 10240 },
]
const refunds = [
  { label: "Pune", value: 42 },
  { label: "Mumbai", value: 67 },
  { label: "Bengaluru", value: 340 },
  { label: "Hyderabad", value: 55 },
]

export function Demo() {
  return (
    <div className="grid w-full max-w-md gap-4">
      <HonestBar label="Monthly active users" data={users} min={9000} />
      <HonestBar label="Refund requests this week" data={refunds} orientation="horizontal" max={100} size={24} />
    </div>
  )
}
