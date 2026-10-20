"use client"

import * as React from "react"

import { AmountInput } from "@/registry/default/amount-input/amount-input"
import { TypeToConfirm } from "@/registry/default/type-to-confirm/type-to-confirm"

type Props = {
  onSend: (amount: number) => Promise<void>
  onDeleteWorkspace: () => Promise<void>
}

/**
 * A minimal integration example. The server must still authenticate the caller,
 * enforce authorization, validate the amount and make money movement idempotent.
 */
export function SafeTransferForm({ onSend, onDeleteWorkspace }: Props) {
  const [amount, setAmount] = React.useState(10_000)
  const [confirmed, setConfirmed] = React.useState(false)
  const [sending, setSending] = React.useState(false)
  const [deleteOpen, setDeleteOpen] = React.useState(false)

  const send = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!confirmed || sending) return
    setSending(true)
    try {
      await onSend(amount)
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="grid max-w-xl gap-8">
      <form onSubmit={send} className="grid gap-4 rounded-xl border p-5">
        <h2 className="text-lg font-semibold">Transfer money</h2>
        <AmountInput label="Amount" locale="en-IN" currency="INR" typical={10_000} value={amount} onValueChange={(next) => setAmount(next ?? 0)} />
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} className="mt-1" />
          <span>I reviewed the amount and recipient.</span>
        </label>
        <button type="submit" disabled={!confirmed || sending} className="rounded-md bg-primary px-3 py-2 text-primary-foreground disabled:opacity-50">
          {sending ? "Sending…" : "Confirm and send"}
        </button>
      </form>

      <section className="rounded-xl border border-destructive/40 p-5">
        <h2 className="text-lg font-semibold">Delete workspace</h2>
        <p className="mt-1 text-sm text-muted-foreground">Require a meaningful readback before calling the destructive server action.</p>
        <button type="button" onClick={() => setDeleteOpen(true)} className="mt-4 rounded-md border border-destructive/40 px-3 py-2 text-destructive">
          Delete workspace
        </button>
        <TypeToConfirm open={deleteOpen} onOpenChange={setDeleteOpen} phrase="delete workspace" onConfirm={onDeleteWorkspace} />
      </section>
    </div>
  )
}
