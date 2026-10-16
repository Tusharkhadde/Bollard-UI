"use client"

import * as React from "react"

import { InlineEdit } from "@/registry/default/inline-edit/inline-edit"

export function Demo() {
  const [name, setName] = React.useState("Bollard UI launch")
  return (
    <div className="grid w-full max-w-sm gap-4">
      <div className="text-xl font-semibold">
        <InlineEdit
          label="Project name"
          value={name}
          onValueChange={setName}
          validate={(value) => (value.length < 3 ? "Use at least 3 characters." : undefined)}
          onSave={async (value) => {
            await new Promise((resolve) => setTimeout(resolve, 600))
            if (/fail/i.test(value)) throw new Error("The server said no. Your text is still here.")
          }}
        />
      </div>
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <button
          type="button"
          onPointerDown={(event) => event.preventDefault()}
          onClick={() => setName("Bollard UI public beta")}
          className="h-8 rounded-md border px-3 text-sm font-medium text-foreground hover:bg-accent outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          Teammate renames it
        </button>
        <span>Edit the name, then press this. Or press Esc to see Restore.</span>
      </div>
    </div>
  )
}
