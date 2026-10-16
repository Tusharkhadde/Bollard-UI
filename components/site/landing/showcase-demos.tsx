"use client"

// The landing's live examples grid: each one is a real Bollard UI registry component,
// set up with a mistake already in it. Loaded as one lazy chunk by LiveDemo.
// (The hero's tabbed preview uses a different set, so the two never repeat.)
import * as React from "react"
import { Trash2 } from "lucide-react"

import { CardExpiryInput } from "@/registry/default/card-expiry-input/card-expiry-input"
import { CooldownButton } from "@/registry/default/cooldown-button/cooldown-button"
import { HomoglyphGuard } from "@/registry/default/homoglyph-guard/homoglyph-guard"
import { IfscInput } from "@/registry/default/ifsc-input/ifsc-input"
import { PercentInput } from "@/registry/default/percent-input/percent-input"
import { SqlGuard } from "@/registry/default/sql-guard/sql-guard"
import { TypeToConfirm } from "@/registry/default/type-to-confirm/type-to-confirm"
import { UpiIdInput, type UpiVerification } from "@/registry/default/upi-id-input/upi-id-input"

const note = "text-xs text-muted-foreground"

export function SqlDemo() {
  const [log, setLog] = React.useState("")
  return (
    <div className="grid w-full gap-2">
      <SqlGuard
        label="Query · production"
        env="production"
        defaultValue={"DELETE FROM orders\n-- WHERE id = 4182;"}
        estimateRows={() => 184_302}
        onRun={() => new Promise<void>((resolve) => setTimeout(() => (setLog("Ran on production."), resolve()), 500))}
        className="w-full max-w-none"
      />
      <p aria-live="polite" className={`${note} empty:hidden`}>
        {log}
      </p>
    </div>
  )
}

export function CardExpiryDemo() {
  return <CardExpiryInput label="Card expiry" defaultValue="13/28" className="w-full max-w-none" />
}

export function IfscDemo() {
  return <IfscInput label="Branch IFSC" defaultValue="HDFCO001234" className="w-full max-w-none" />
}

export function PercentDemo() {
  return <PercentInput label="Discount" defaultValue={0.15} base={2000} currency="INR" locale="en-IN" className="w-full max-w-none" />
}

const directory: Record<string, string> = { "rohan.sharma@okaxis": "ROHAN SHARMA" }
const verifyUpi = (vpa: string) =>
  new Promise<UpiVerification>((resolve) => setTimeout(() => resolve(directory[vpa] ? { valid: true, name: directory[vpa] } : { valid: false }), 300))

export function UpiDemo() {
  return <UpiIdInput label="Pay to UPI ID" defaultValue="rohan.sharma@okaxsi" expectedName="Rohan Sharma" verify={verifyUpi} className="w-full max-w-none" />
}

export function CooldownDemo() {
  const [sent, setSent] = React.useState(1)
  return (
    <div className="grid w-full justify-items-center gap-3">
      <p className="text-center text-sm">
        We sent a code to <span className="font-medium">+91 98765 43210</span>
      </p>
      <CooldownButton
        id="landing-resend-otp"
        startCoolingDown
        cooldowns={[20, 40, 80]}
        onAction={() => new Promise<void>((resolve) => setTimeout(() => (setSent((n) => n + 1), resolve()), 500))}
        className="items-center"
      >
        Resend code
      </CooldownButton>
      <p className={note} aria-live="polite">
        Codes sent: <span className="font-mono text-foreground tabular-nums">{sent}</span>
      </p>
    </div>
  )
}

export function HomoglyphDemo() {
  // "pаypal_support" with a Cyrillic а, written as an escape so it survives editors.
  return <HomoglyphGuard label="Username" defaultValue={"p\u0430ypal_support"} protectedNames={["paypal"]} className="w-full max-w-none" />
}

export function TypeToConfirmDemo() {
  const [open, setOpen] = React.useState(false)
  const [deleted, setDeleted] = React.useState(false)
  return (
    <div className="flex flex-col items-center gap-3">
      <button
        type="button"
        onClick={() => (deleted ? setDeleted(false) : setOpen(true))}
        className="inline-flex h-9 items-center gap-2 rounded-md border border-destructive/40 bg-background px-4 text-sm font-medium text-destructive shadow-xs outline-none hover:bg-destructive/10 focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30"
      >
        <Trash2 aria-hidden className="size-4" />
        {deleted ? "Restore demo" : "Delete repository"}
      </button>
      <p aria-live="polite" className={`${note} text-center`}>
        {deleted ? "acme/website was deleted." : "Type acme/webiste and the button stays locked."}
      </p>
      <TypeToConfirm
        open={open}
        onOpenChange={setOpen}
        phrase="acme/website"
        description="This permanently deletes the repository, its wiki, issues and comments."
        confirmLabel="Delete this repository"
        onConfirm={async () => {
          await new Promise((resolve) => setTimeout(resolve, 600))
          setDeleted(true)
        }}
      />
    </div>
  )
}
