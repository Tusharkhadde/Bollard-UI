"use client"

import { DualAxisGuard } from "@/registry/default/dual-axis-guard/dual-axis-guard"

const months = ["Apr", "May", "Jun", "Jul", "Aug", "Sep"]
const lakh = (v: number) => `₹${v.toFixed(1)}L`

export function Demo() {
  return (
    <div className="grid w-full max-w-md gap-4">
      <DualAxisGuard
        label="Ad spend vs sign-ups"
        labels={months}
        left={{ label: "Ad spend", values: [4.0, 4.1, 4.2, 4.35, 4.45, 4.6], format: lakh }}
        right={{ label: "Sign-ups", values: [1000, 1180, 1460, 1720, 2050, 2400] }}
        height={130}
      />
      <DualAxisGuard
        label="Revenue vs churn"
        labels={months}
        left={{ label: "Revenue", values: [18, 19.5, 21, 22, 23.4, 25], domain: [0, 30], format: lakh }}
        right={{ label: "Churn %", values: [4.2, 3.9, 3.7, 3.6, 3.3, 3.1], format: (v) => `${v.toFixed(1)}%` }}
        height={110}
      />
    </div>
  )
}
