"use client"

import * as React from "react"
import { KeyRound, Trash2 } from "lucide-react"

import { TwoStepButton } from "@/registry/default/two-step-button/two-step-button"

export function Demo() {
  const [log, setLog] = React.useState("Try a fast double-click: it only arms.")

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex flex-wrap justify-center gap-3">
        <TwoStepButton
          armedLabel="Click again to delete"
          pendingLabel="Deleting…"
          confirmedLabel="Deleted"
          onConfirm={() =>
            new Promise<void>((resolve) =>
              setTimeout(() => {
                setLog("Project deleted.")
                resolve()
              }, 900),
            )
          }
        >
          <Trash2 aria-hidden className="size-4" /> Delete project
        </TwoStepButton>
        <TwoStepButton
          variant="outline"
          timeout={4000}
          armedLabel="Click again to revoke"
          confirmedLabel="Revoked"
          onConfirm={() => setLog("API key revoked.")}
        >
          <KeyRound aria-hidden className="size-4" /> Revoke API key
        </TwoStepButton>
      </div>
      <p aria-live="polite" className="text-xs text-muted-foreground">
        {log}
      </p>
    </div>
  )
}
