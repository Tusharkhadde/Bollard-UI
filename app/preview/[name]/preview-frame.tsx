"use client"

import * as React from "react"

import { demos } from "@/components/demo-index"

/** Renders one demo alone. Add ?theme=dark for dark mode. Used for visual checks. */
export function PreviewFrame({ name }: { name: string }) {
  const entry = demos.find((demo) => demo.name === name)
  React.useEffect(() => {
    const dark = new URLSearchParams(window.location.search).get("theme") === "dark"
    document.documentElement.classList.toggle("dark", dark)
  }, [])
  if (!entry) return null
  const { Demo } = entry
  return (
    <main className="flex min-h-dvh items-center justify-center bg-background p-8 text-foreground">
      <div data-preview={name} className="flex w-full max-w-xl justify-center rounded-2xl border bg-card p-8">
        <Demo />
      </div>
    </main>
  )
}
