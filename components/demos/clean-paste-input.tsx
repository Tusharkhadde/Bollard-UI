"use client"

import * as React from "react"

import { CleanPasteInput } from "@/registry/default/clean-paste-input/clean-paste-input"

// What a code copied from a PDF or a chat app often really contains.
const SAVED_DRAFT = "DIWALI\u200B25\u2060"
const UPI_ID = "\u200Bpriya.sharma@okhdfc\u00AD\uFEFF "

export function Demo() {
  const [copied, setCopied] = React.useState(false)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(UPI_ID)
      setCopied(true)
    } catch {
      // Clipboard access can be blocked; the field still works with any paste.
    }
  }

  return (
    <form className="grid w-full max-w-sm gap-3" onSubmit={(event) => event.preventDefault()}>
      <CleanPasteInput label="Coupon code" defaultValue={SAVED_DRAFT} autoComplete="off" spellCheck={false} />
      <div className="grid gap-2">
        <button
          type="button"
          onClick={copy}
          className="inline-flex min-h-8 w-fit items-center rounded-md py-1.5 text-left border bg-muted/40 px-3 text-xs font-medium transition-colors hover:bg-accent outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          {copied ? "Copied. Now paste it below" : "Copy a UPI ID with 3 hidden characters"}
        </button>
        <CleanPasteInput label="UPI ID" placeholder="Paste the UPI ID" autoComplete="off" spellCheck={false} />
      </div>
    </form>
  )
}
