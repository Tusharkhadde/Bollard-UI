"use client"

import * as React from "react"

import { TransferOwnership, type TransferRequest } from "@/registry/default/transfer-ownership/transfer-ownership"

const MEMBERS = [
  { name: "Priya Nair", email: "priya.nair@acme.in", plan: "Team" },
  { name: "Arjun Rao", email: "arjun@acme.in", plan: "Free" },
]

export function Demo() {
  const [request, setRequest] = React.useState<TransferRequest | null>(null)

  return (
    <div className="flex w-full flex-col items-center gap-3">
      <TransferOwnership
        resource="Acme workspace"
        orgDomain="acme.in"
        members={MEMBERS}
        requiredPlan="Team"
        defaultValue="priya.nair@gmail.com"
        moves={["Billing and the ₹24,000/yr plan", "Deleting the workspace", "Owner role"]}
        keeps={["Admin access", "Your personal drafts"]}
        request={request}
        onRequestChange={setRequest}
        onSend={() => new Promise<void>((resolve) => setTimeout(resolve, 500))}
        onWithdraw={() => new Promise<void>((resolve) => setTimeout(resolve, 300))}
      />
      {request?.status === "pending" && (
        <div className="flex gap-2 text-xs">
          <button
            type="button"
            onClick={() => setRequest({ ...request, status: "accepted" })}
            className="inline-flex h-8 items-center rounded-md border bg-background px-3 font-medium shadow-xs outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:border-input dark:bg-input/30"
          >
            Simulate: they accept
          </button>
          <button
            type="button"
            onClick={() => setRequest({ ...request, status: "declined" })}
            className="inline-flex h-8 items-center rounded-md border bg-background px-3 font-medium shadow-xs outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:border-input dark:bg-input/30"
          >
            Simulate: they decline
          </button>
        </div>
      )}
    </div>
  )
}
