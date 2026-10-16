"use client"

import * as React from "react"

import { CurlPipeGuard } from "@/registry/default/curl-pipe-guard/curl-pipe-guard"

const EXAMPLES = [
  { label: "From a forum post", command: "curl -sSL http://bun-install.sh/install | sudo bash", docsDomain: "bun.sh" },
  { label: "Official docs", command: "curl -fsSL https://bun.sh/install | bash -s -- bun-v1.2.0", docsDomain: "bun.sh" },
  { label: "PowerShell", command: 'powershell -c "irm https://bun.sh/install.ps1 | iex"', docsDomain: "bun.sh" },
  { label: "Homebrew", command: '/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"', docsDomain: "brew.sh" },
]

export function Demo() {
  const [pick, setPick] = React.useState(0)
  const [log, setLog] = React.useState("")
  const example = EXAMPLES[pick]

  return (
    <div className="grid w-full max-w-lg gap-2">
      <div className="flex flex-wrap gap-1.5" aria-label="Examples">
        {EXAMPLES.map((e, i) => (
          <button key={e.label} type="button" aria-pressed={pick === i} onClick={() => (setPick(i), setLog(""))} className="rounded-md border px-2 py-1 text-xs outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-pressed:bg-accent aria-pressed:font-medium">
            {e.label}
          </button>
        ))}
      </div>
      <CurlPipeGuard
        key={pick}
        {...example}
        onCopy={(_, mode) => setLog(mode === "steps" ? "Copied the safer steps." : "Copied the one-liner.")}
        onRun={(_, mode) => new Promise<void>((resolve) => setTimeout(() => (setLog(`Ran the ${mode === "steps" ? "steps" : "one-liner"} in the terminal.`), resolve()), 700))}
      />
      <p aria-live="polite" className="min-h-4 text-xs text-muted-foreground">{log}</p>
    </div>
  )
}
