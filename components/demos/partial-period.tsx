"use client"

import { PartialPeriod } from "@/registry/default/partial-period/partial-period"

// Orders per hour, 12 AM to 11 PM. Today is 2:15 PM, so 14.25 hours have gone by.
const yesterday = [6, 3, 2, 1, 1, 3, 9, 22, 41, 58, 66, 71, 88, 92, 79, 74, 81, 96, 118, 131, 112, 84, 47, 19]
const today = [7, 4, 2, 1, 2, 3, 11, 24, 44, 63, 72, 77, 95, 99, 23, null, null, null, null, null, null, null, null, null]
const hours = Array.from({ length: 24 }, (_, h) => `${h % 12 || 12}${h < 12 ? "a" : "p"}`)

export function Demo() {
  return (
    <PartialPeriod
      className="max-w-md"
      label="Orders today"
      current={today}
      previous={yesterday}
      elapsed={14.25}
      cutoffLabel="2:15 PM"
      bucketLabels={hours}
      defaultMode="full"
    />
  )
}
