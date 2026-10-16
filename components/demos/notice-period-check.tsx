"use client"

import * as React from "react"

import { NoticePeriodCheck, type NoticeInput, type NoticePolicy } from "@/registry/default/notice-period-check/notice-period-check"

const POLICY: NoticePolicy = {
  length: 1,
  unit: "months",
  startsOn: "next-day",
  offDay: "previous",
  timeZone: "America/New_York",
  leaveSetOff: true,
  buyout: { monthly: 120000, divisor: 30 },
}
const HOLIDAYS = [{ date: "2027-02-19", name: "Shivaji Jayanti" }]

export function Demo() {
  // Sent just after midnight in Pune: still Sunday 31 Jan for HR in New York.
  const [value, setValue] = React.useState<NoticeInput>({ sentAt: "2027-02-01T00:30", requestedLastDay: "2027-02-12" })
  return (
    <div className="grid w-full max-w-md gap-3">
      <p className="text-xs text-muted-foreground">Contract: 1 month notice · HR in New York · 6 days of leave left</p>
      <NoticePeriodCheck policy={POLICY} timeZone="Asia/Kolkata" holidays={HOLIDAYS} leaveBalance={6} value={value} onValueChange={setValue} />
    </div>
  )
}
