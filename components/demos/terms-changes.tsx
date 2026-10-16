"use client"

import * as React from "react"

import { TermsChanges, type TermsAcceptance } from "@/registry/default/terms-changes/terms-changes"

const v2 = `1. Refunds. You can cancel a booking and get a full refund up to 30 days after purchase. Refunds go back to the original payment method within 7 working days.

2. Accounts. Keep your login details private. You are responsible for activity on your account, and you must tell us quickly if you think someone else has used it. We may suspend accounts that break these terms after giving you notice, unless the law requires us to act at once.

3. Your content. You keep ownership of anything you upload. We only use it to run the service for you.

4. Disputes. Disputes are handled by the courts of Pune, India.`

const v3 = `1. Refunds. You can cancel a booking and get a full refund up to 14 days after purchase. Refunds go back to the original payment method within 7 working days.

2. Accounts. Keep your login details private. You are responsible for activity on your account, and you must tell us quickly if you think someone else has used it. We may suspend accounts that break these terms after giving you notice, unless the law requires us to act at once.

3. Your content. You keep ownership of anything you upload. We use it to run the service for you and, unless you opt out in Settings, to improve our recommendations.

4. Disputes. Disputes are settled by binding arbitration in Mumbai, India.`

export function Demo() {
  const [record, setRecord] = React.useState<TermsAcceptance>()
  return (
    <div className="grid w-full max-w-md gap-3">
      <TermsChanges
        title="Terms of Service"
        accepted={{ version: "v2.1", text: v2, date: "4 Mar 2025" }}
        current={{ version: "v3.0", text: v3, date: "1 Nov 2026" }}
        summary={[
          "Full refunds now within 14 days instead of 30.",
          "Your uploads may improve recommendations unless you opt out.",
          "Disputes go to arbitration in Mumbai, not the Pune courts.",
        ]}
        onAccept={async (r) => {
          await new Promise((resolve) => setTimeout(resolve, 500))
          setRecord(r)
        }}
      />
      {record && (
        <pre className="overflow-x-auto rounded-md border bg-muted/40 p-2 font-mono text-xs" data-testid="record">
          {JSON.stringify({ ...record, acceptedAt: "…" }, null, 1)}
        </pre>
      )}
    </div>
  )
}
