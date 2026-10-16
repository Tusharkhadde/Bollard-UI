"use client"

import * as React from "react"

import { CancelReadback } from "@/registry/default/cancel-readback/cancel-readback"

const ALTERNATIVES = [
  { id: "pause", label: "Pause for 1 month", detail: "No charge in December. Billing resumes 13 Jan at ₹499/mo." },
  { id: "free", label: "Switch to Free", detail: "Keep 3 projects. No charge from your next renewal." },
]

export function Demo() {
  const [endsAt, setEndsAt] = React.useState<number | null>(null)
  const [note, setNote] = React.useState("Cancel stays the first button. Offers show once, below it.")

  React.useEffect(() => {
    // The end of the paid period: 31 days from now at 23:59 IST.
    const end = new Date(Date.now() + 31 * 86_400_000)
    setEndsAt(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate(), 18, 29))
  }, [])

  if (endsAt === null) return null
  return (
    <div className="flex w-full flex-col items-center gap-3">
      <CancelReadback
        plan="Pro"
        accessEndsAt={endsAt}
        locale="en-IN"
        timeZone="Asia/Kolkata"
        lose={["Unlimited projects", "Custom domains", "Priority support"]}
        keep={["All your data, read-only", "3 projects on Free"]}
        alternatives={ALTERNATIVES}
        onAlternative={(id) => setNote(id === "pause" ? "You chose to pause for 1 month." : "You chose to switch to Free.")}
        onConfirm={() => new Promise<void>((resolve) => setTimeout(resolve, 600))}
        onResume={() => new Promise<void>((resolve) => setTimeout(resolve, 400))}
        onKeep={() => setNote("You kept Pro. Nothing changed.")}
      />
      <p aria-live="polite" className="text-center text-xs text-muted-foreground">{note}</p>
    </div>
  )
}
