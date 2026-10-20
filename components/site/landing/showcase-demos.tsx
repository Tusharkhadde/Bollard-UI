"use client"

// Small examples of everyday fields, each rendered with its real Bollard UI
// component and a realistic value that demonstrates the guard.
import { AmountInput } from "@/registry/default/amount-input/amount-input"
import { CardExpiryInput } from "@/registry/default/card-expiry-input/card-expiry-input"
import { EmailInput } from "@/registry/default/email-input/email-input"
import { PasswordInput } from "@/registry/default/password-input/password-input"
import { PhoneInput } from "@/registry/default/phone-input/phone-input"
import { UpiIdInput, type UpiVerification } from "@/registry/default/upi-id-input/upi-id-input"

export function AmountDemo() {
  return <AmountInput label="Monthly rent" locale="en-IN" currency="INR" defaultValue={24000} typical={2400} className="w-full max-w-none" />
}

export function EmailDemo() {
  return <div className="grid gap-2"><EmailInput label="Work email" defaultValue="priya.sharma@gmial.con" className="w-full max-w-none" /><p className="rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-1 font-mono text-[11px]"><del className="text-destructive">gmial.con</del><span className="px-1 text-muted-foreground">→</span><ins className="font-semibold text-emerald-700 no-underline dark:text-emerald-300">gmail.com</ins></p></div>
}

export function PasswordDemo() {
  return <PasswordInput label="Password" defaultValue={"Ызкштп2026"} className="w-full max-w-none" />
}

export function PhoneDemo() {
  return (
    <PhoneInput
      label="Mobile number"
      defaultValue="+91 +91 98765 43210"
      preferredCountries={["IN", "US", "GB", "AE", "SG"]}
      className="w-full max-w-none"
    />
  )
}

export function ExpiryDemo() {
  return <CardExpiryInput label="Card expiry" defaultValue="12/28" className="w-full max-w-none" />
}

const directory: Record<string, string> = { "rohan.sharma@okaxis": "ROHAN SHARMA" }
const verifyUpi = (vpa: string) =>
  new Promise<UpiVerification>((resolve) => setTimeout(() => resolve(directory[vpa] ? { valid: true, name: directory[vpa] } : { valid: false }), 300))

export function UpiDemo() {
  return (
    <UpiIdInput
      label="Pay to UPI ID"
      defaultValue="rohan.sharma@okaxsi"
      expectedName="Rohan Sharma"
      verify={verifyUpi}
      className="w-full max-w-none"
    />
  )
}
