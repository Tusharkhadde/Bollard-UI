"use client"

import * as React from "react"

import { OtpPasteInput } from "@/registry/default/otp-paste-input/otp-paste-input"

const SMS = "Rs.4,999 debited from A/c XX4821. Your OTP for login is 482913. Valid 10 mins. Don't share it. Call 1800 123 4567 if this wasn't you. -HDFC"

export function Demo() {
  const [verified, setVerified] = React.useState<string>()
  const inputRef = React.useRef<HTMLInputElement>(null)

  // Simulates pasting the whole SMS, so the demo works without clipboard permission.
  const pasteSms = () => {
    const input = inputRef.current
    if (!input) return
    const data = new DataTransfer()
    data.setData("text/plain", SMS)
    input.focus()
    input.dispatchEvent(new ClipboardEvent("paste", { clipboardData: data, bubbles: true, cancelable: true }))
  }

  return (
    <form className="grid w-full max-w-sm gap-4" onSubmit={(event) => event.preventDefault()}>
      <div className="grid gap-2 rounded-lg border bg-muted/40 p-3 text-xs">
        <p className="text-muted-foreground">{SMS}</p>
        <button
          type="button"
          onClick={pasteSms}
          className="inline-flex h-8 w-fit items-center rounded-md border bg-background px-3 text-xs font-medium transition-colors hover:bg-accent outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          Paste this whole SMS
        </button>
      </div>
      <OtpPasteInput ref={inputRef} onComplete={setVerified} onValueChange={() => setVerified(undefined)} />
      <p aria-live="polite" className="min-h-4 text-xs text-emerald-700 dark:text-emerald-400">
        {verified ? `Submitting ${verified}…` : ""}
      </p>
    </form>
  )
}
