"use client"

// Compact samples for familiar form controls. Each one is the real registry
// component, shown with a small mistake so visitors can see the guard at work.
import { AtSign, CalendarDays, CreditCard, KeyRound, Smartphone } from "lucide-react"
import type { ReactNode } from "react"

import { AmountInput } from "@/registry/default/amount-input/amount-input"
import { CardExpiryInput } from "@/registry/default/card-expiry-input/card-expiry-input"
import { EmailInput } from "@/registry/default/email-input/email-input"
import { PasswordInput } from "@/registry/default/password-input/password-input"
import { PhoneInput } from "@/registry/default/phone-input/phone-input"

function SampleCard({
  title,
  description,
  icon,
  children,
}: {
  title: string
  description: string
  icon: ReactNode
  children: ReactNode
}) {
  return (
    <div className="w-full max-w-sm overflow-hidden rounded-lg border bg-card text-card-foreground">
      <div className="flex items-center gap-3 border-b px-4 py-3.5">
        <span aria-hidden className="grid size-8 shrink-0 place-items-center rounded-md border bg-background text-muted-foreground [&_svg]:size-4">
          {icon}
        </span>
        <span>
          <span className="block text-sm font-medium tracking-tight">{title}</span>
          <span className="block text-xs text-muted-foreground">{description}</span>
        </span>
      </div>
      <div className="grid gap-4 p-4 sm:p-5">{children}</div>
    </div>
  )
}

export function AmountScreen() {
  return (
    <SampleCard title="Payment details" description="Check the amount before you send" icon={<CreditCard />}>
      <AmountInput label="Monthly rent" locale="en-IN" currency="INR" defaultValue={24000} typical={2400} className="max-w-none" />
    </SampleCard>
  )
}

export function EmailScreen() {
  return (
    <SampleCard title="Your account" description="A clear email, the first time" icon={<AtSign />}>
      <EmailInput label="Work email" defaultValue="priya.sharma@gmial.con" className="max-w-none" />
    </SampleCard>
  )
}

export function PasswordScreen() {
  return (
    <SampleCard title="Sign in securely" description="Catch keyboard layout mix-ups" icon={<KeyRound />}>
      <PasswordInput label="Password" defaultValue={"Ызкштп2026"} className="max-w-none" />
    </SampleCard>
  )
}

export function PhoneScreen() {
  return (
    <SampleCard title="Contact details" description="Normalize the number before saving" icon={<Smartphone />}>
      <PhoneInput
        label="Mobile number"
        defaultValue="+91 +91 98765 43210"
        preferredCountries={["IN", "US", "GB", "AE", "SG"]}
        className="max-w-none"
      />
    </SampleCard>
  )
}

export function ExpiryScreen() {
  return (
    <SampleCard title="Payment method" description="Spot an invalid expiry month" icon={<CalendarDays />}>
      <CardExpiryInput label="Card expiry" defaultValue="13/28" className="max-w-none" />
    </SampleCard>
  )
}
