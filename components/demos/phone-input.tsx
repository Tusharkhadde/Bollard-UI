"use client"

import * as React from "react"

import { PhoneInput } from "@/registry/default/phone-input/phone-input"

export function Demo() {
  const [saved, setSaved] = React.useState<string | null>("+919876543210")
  return (
    <div className="grid w-full max-w-sm gap-4">
      <PhoneInput
        label="Your mobile"
        defaultValue="+91 +91 098765-43210"
        preferredCountries={["IN", "US", "GB", "AE", "SG"]}
        onNumberChange={(e164) => setSaved(e164)}
      />
      <PhoneInput label="Mobile for OTP" expect="mobile" defaultValue="020 2794 6095" hint="We text a code to this number." />
      <PhoneInput label="London office" defaultValue="0044 (0)20 7946 0958" />
      <PhoneInput label="Delivery contact" countries={["SG", "MY", "ID", "TH"]} defaultCountry="SG" defaultValue="9123 456" />
      <p className="text-xs text-muted-foreground">
        Try pasting <code className="font-mono text-foreground">+1 416 555 0199</code> (it picks Canada from the area code) or{" "}
        <code className="font-mono text-foreground">+971 050 123 4567</code>. First field stores{" "}
        <code className="font-mono text-foreground">{saved ?? "nothing (incomplete)"}</code>
      </p>
    </div>
  )
}
