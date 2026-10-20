"use client"

import * as React from "react"
import Link from "next/link"
import { ArrowRight } from "lucide-react"

import { cn } from "@/lib/utils"
import { AmountInput } from "@/registry/default/amount-input/amount-input"

/** One transfer scenario: no carousel or secondary tab competes with the contrast. */
export function HeroPreview({ className }: { className?: string }) {
  const [withBollard, setWithBollard] = React.useState(false)

  return (
    <div className={cn("rounded-[1rem] bg-foreground/[0.04] p-1 shadow-[0_30px_80px_-30px_rgb(0_0_0/0.22)] sm:p-1.5 dark:bg-white/[0.05] dark:shadow-[0_30px_80px_-20px_rgb(0_0_0/0.8)]", className)}>
      <div className="overflow-hidden rounded-xl border bg-background">
        <div className="flex h-11 items-center gap-3 border-b px-3 sm:px-4">
          <div aria-hidden className="hidden shrink-0 gap-1.5 sm:flex"><span className="size-2.5 rounded-full bg-foreground/25" /><span className="size-2.5 rounded-full bg-foreground/25" /><span className="size-2.5 rounded-full bg-foreground/25" /></div>
          <div className="mx-auto flex h-7 min-w-0 max-w-[16rem] flex-1 items-center justify-center gap-1.5 truncate rounded-md border bg-muted px-3 font-mono text-xs text-foreground/80"><span aria-hidden className="size-1.5 shrink-0 rounded-full bg-emerald-500/80" />acme.app/transfer</div>
          <div aria-hidden className="hidden w-[2.625rem] shrink-0 sm:block" />
        </div>
        <div role="group" aria-label="Transfer safety comparison" className="flex gap-1 border-b bg-background p-2 sm:px-3">
          <button type="button" aria-pressed={!withBollard} onClick={() => setWithBollard(false)} className={cn("h-8 rounded-md px-3 text-xs font-medium outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50", !withBollard ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground")}>Without Bollard</button>
          <button type="button" aria-pressed={withBollard} onClick={() => setWithBollard(true)} className={cn("h-8 rounded-md px-3 text-xs font-medium outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50", withBollard ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground")}>With Bollard</button>
        </div>
        <div className="ink-amber bg-dots flex min-h-[29rem] justify-center bg-surface px-3 py-6 sm:px-6 sm:py-8"><TransferComparison withBollard={withBollard} /></div>
        <div className="flex items-center gap-2 border-t px-4 py-3 text-xs text-muted-foreground sm:px-5"><span>Built with</span><Link href="/components/amount-input" className="rounded-md border px-1.5 py-0.5 font-mono text-[11px] text-foreground outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50">amount-input</Link><Link href="/components" className="ml-auto hidden items-center gap-1 text-xs text-muted-foreground hover:text-foreground sm:inline-flex">All components <ArrowRight aria-hidden className="size-3" /></Link></div>
      </div>
    </div>
  )
}

function TransferComparison({ withBollard }: { withBollard: boolean }) {
  const [confirmed, setConfirmed] = React.useState(false)
  const [sent, setSent] = React.useState(false)
  React.useEffect(() => { setConfirmed(false); setSent(false) }, [withBollard])

  if (!withBollard) return <div className="w-full max-w-sm self-center rounded-lg border bg-card p-5"><h3 className="text-sm font-medium">Send money</h3><label className="mt-4 block text-sm font-medium" htmlFor="unsafe-transfer">Amount (₹)</label><input id="unsafe-transfer" defaultValue="1,00,000" className="mt-1 h-10 w-full rounded-md border bg-background px-3 font-mono outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50" /><button type="button" onClick={() => setSent(true)} className="mt-4 h-10 w-full rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground">Send</button>{sent && <p role="alert" className="mt-3 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">Fictional failure: transfer rejected after the amount was submitted.</p>}</div>

  return <div className="w-full max-w-sm self-center rounded-lg border bg-card p-5"><h3 className="text-sm font-medium">Send money</h3><AmountInput label="Amount (₹)" locale="en-IN" currency="INR" defaultValue={100000} typical={10000} /><label className="mt-3 flex items-start gap-2 text-sm"><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} className="mt-1 size-4 accent-[var(--brand)]" />I confirm this transfer is ₹1,00,000, not ₹10,000.</label><button type="button" disabled={!confirmed} onClick={() => setSent(true)} className="mt-4 h-10 w-full rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50">Confirm and send</button>{sent && <p role="status" className="mt-3 rounded-md border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-foreground">Confirmation recorded. Your server should validate and send the transfer.</p>}</div>
}
