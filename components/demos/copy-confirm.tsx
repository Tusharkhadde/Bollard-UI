"use client"

import { cn } from "@/lib/utils"
import { CopyConfirm } from "@/registry/default/copy-confirm/copy-confirm"

const rows = [
  { label: "Amount due", shown: "₹1,23,456.50", value: "₹1,23,456.50" },
  { label: "IFSC (pasted from a PDF)", shown: "HDFC0001234", value: " HDFC0001234\n" },
  { label: "Coupon (copied from a doc)", shown: "DIWALI25", value: "DIWALI\u200B25" },
  { label: "Wallet", shown: "0x71C7656E…976F", value: "0x71C7656EC7ab88b098defB751B7401B5f6d8976F" },
  { label: "Referral code", shown: "Not generated yet", value: "" },
]

export function Demo() {
  return (
    <div className="w-full max-w-md space-y-4">
      <dl className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-x-3 gap-y-3 text-sm">
        {rows.map((row) => (
          <div key={row.label} className="contents">
            <dt className="truncate text-muted-foreground">{row.label}</dt>
            <dd className={cn("truncate text-right", row.value ? "font-mono" : "text-muted-foreground italic")}>{row.shown}</dd>
            <dd>
              <CopyConfirm value={row.value} label={`Copy ${row.label}`} />
            </dd>
          </div>
        ))}
      </dl>
      <p className="text-xs text-muted-foreground">
        The IFSC and coupon look clean but carry hidden characters. Copy them to see.
      </p>
    </div>
  )
}
