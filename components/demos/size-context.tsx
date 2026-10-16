"use client"

import * as React from "react"

import { SizeContext } from "@/registry/default/size-context/size-context"

const files = [
  { name: "holiday-4k.mov", bytes: 4_700_000_000 },
  { name: "site-backup.zip", bytes: 4_210_000_000 },
  { name: "pitch-deck.pdf", bytes: 18_400_000 },
]

export function Demo() {
  const [picked, setPicked] = React.useState(files[0])

  return (
    <div className="grid w-full max-w-sm gap-4">
      <fieldset className="grid gap-1.5">
        <legend className="mb-1.5 text-sm font-medium">Upload to Drop (4 GB limit)</legend>
        <div className="flex flex-wrap gap-1.5">
          {files.map((file) => (
            <button
              key={file.name}
              type="button"
              aria-pressed={picked.name === file.name}
              onClick={() => setPicked(file)}
              className="h-8 rounded-md border px-3 text-sm transition-colors outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-pressed:border-foreground/40 aria-pressed:bg-accent"
            >
              {file.name}
            </button>
          ))}
        </div>
        <label className="w-fit cursor-pointer text-xs text-muted-foreground underline underline-offset-4 has-focus-visible:ring-[3px] has-focus-visible:ring-ring/50">
          or try one of your own files
          <input
            type="file"
            className="sr-only"
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (file) setPicked({ name: file.name, bytes: file.size })
            }}
          />
        </label>
      </fieldset>
      <div className="grid gap-1 rounded-lg border p-3">
        <p className="truncate text-xs text-muted-foreground">{picked.name}</p>
        <SizeContext bytes={picked.bytes} limit="4 GB" bitsPerSecond={100e6} />
      </div>
    </div>
  )
}
