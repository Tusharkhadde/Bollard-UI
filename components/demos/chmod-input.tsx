"use client"

import * as React from "react"

import { ChmodInput } from "@/registry/default/chmod-input/chmod-input"

const samples = [
  { name: "SSH key", path: "~/.ssh/id_ed25519", value: "644" },
  { name: "Uploads", path: "public/uploads/", value: "777" },
  { name: "Deploy script", path: "deploy.sh", value: "775" },
  { name: "CSV export", path: "exports/report.csv", value: "755" },
  { name: ".env", path: ".env.production", value: "0644" },
  { name: "Setuid", path: "bin/backup", value: "4755" },
  { name: "Decimal", path: "server.js", value: "420" },
  { name: "+x", path: "deploy.sh", value: "+x" },
]

export function Demo() {
  const [sample, setSample] = React.useState(samples[0])
  const [value, setValue] = React.useState(sample.value)
  return (
    <div className="grid w-full max-w-sm gap-3">
      <ChmodInput key={sample.name} path={sample.path} value={value} onValueChange={setValue} />
      <div className="flex flex-wrap items-center gap-1.5 text-xs" role="group" aria-label="Try a file">
        <span className="text-muted-foreground">Try:</span>
        {samples.map((item) => (
          <button
            key={item.name}
            type="button"
            aria-pressed={item === sample}
            onClick={() => {
              setSample(item)
              setValue(item.value)
            }}
            className="h-7 rounded-md border px-2 transition-colors outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-pressed:bg-accent"
          >
            {item.name}
          </button>
        ))}
      </div>
    </div>
  )
}
