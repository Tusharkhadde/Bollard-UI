"use client"

import { PasteTargetGuard } from "@/registry/default/paste-target-guard/paste-target-guard"

const INVOICE_IBAN = "DE89 3704 0044 0532 0130 00"
// What a clipper put on the clipboard: same start and end, different middle.
const SWAPPED = "DE89 3704 0044 7718 2930 00"

export function Demo() {
  return (
    <div className="grid w-full max-w-md gap-3">
      <div className="rounded-md border bg-muted/40 p-3 text-sm">
        <p className="text-xs text-muted-foreground">Invoice #2041 · Asha Traders GmbH · €1,240.00</p>
        <p className="mt-1 font-mono select-all">{INVOICE_IBAN}</p>
      </div>
      <PasteTargetGuard label="Payee IBAN" expected={INVOICE_IBAN} defaultValue={SWAPPED} placeholder="DE00 0000 0000 0000 0000 00" />
    </div>
  )
}
