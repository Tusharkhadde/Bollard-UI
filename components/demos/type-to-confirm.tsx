"use client"

import * as React from "react"
import { Trash2 } from "lucide-react"

import { TypeToConfirm } from "@/registry/default/type-to-confirm/type-to-confirm"

export function Demo() {
  const [open, setOpen] = React.useState(false)
  const [deleted, setDeleted] = React.useState(false)

  return (
    <div className="flex flex-col items-center gap-3">
      <button
        type="button"
        onClick={() => (deleted ? setDeleted(false) : setOpen(true))}
        className="inline-flex h-9 items-center gap-2 rounded-md border border-destructive/40 bg-background px-4 text-sm font-medium text-destructive shadow-xs outline-none hover:bg-destructive/10 focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30"
      >
        <Trash2 aria-hidden className="size-4" />
        {deleted ? "Restore demo" : "Delete repository"}
      </button>
      <p aria-live="polite" className="text-center text-xs text-muted-foreground">
        {deleted ? "acme/website was deleted." : "Try typing acme/webiste: the button stays locked."}
      </p>
      <TypeToConfirm
        open={open}
        onOpenChange={setOpen}
        phrase="acme/website"
        description="This permanently deletes the repository, its wiki, issues and comments."
        confirmLabel="Delete this repository"
        onConfirm={async () => {
          await new Promise((resolve) => setTimeout(resolve, 800))
          setDeleted(true)
        }}
      />
    </div>
  )
}
