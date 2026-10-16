"use client"

import { ReadingLevel } from "@/registry/default/reading-level/reading-level"

const NOTICE = `Your refund will arrive in 5 to 7 days. In the event that the original payment method is no longer available, the remuneration will subsequently be transmitted to an alternative account that you designate through the account settings interface. Prior to that, please verify your details. Contact us if you need assistance.`

export function Demo() {
  return <ReadingLevel label="Refund email" defaultValue={NOTICE} targetGrade={8} />
}
