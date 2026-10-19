"use client"

import * as React from "react"
import { Check, Copy } from "lucide-react"

import { cn } from "@/lib/utils"

/** A small copy-to-clipboard button that says "Copied" for a moment. Announces the result politely. */
export function CopyButton({
  value,
  label,
  children,
  className,
  onCopy,
}: {
  value: string
  label: string
  children?: React.ReactNode
  className?: string
  onCopy?: () => void
}) {
  const [state, setState] = React.useState<"idle" | "copied" | "failed">("idle")
  React.useEffect(() => {
    if (state === "idle") return
    const t = window.setTimeout(() => setState("idle"), 1600)
    return () => window.clearTimeout(t)
  }, [state])

  const copy = async (event: React.MouseEvent) => {
    event.preventDefault()
    event.stopPropagation()
    try {
      await navigator.clipboard.writeText(value)
      setState("copied")
      onCopy?.()
    } catch {
      setState("failed")
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex items-center justify-center gap-1.5 rounded-md border bg-background text-xs font-medium text-muted-foreground outline-none transition-colors hover:border-border-strong hover:bg-accent hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50",
        className,
      )}
    >
      {state === "copied" ? <Check aria-hidden className="size-3.5 text-emerald-600 dark:text-emerald-400" /> : <Copy aria-hidden className="size-3.5" />}
      {children && <span>{state === "copied" ? "Copied" : state === "failed" ? "Press ⌘C" : children}</span>}
      <span className="sr-only" aria-live="polite">
        {state === "copied" ? "Copied" : state === "failed" ? "Copy failed" : ""}
      </span>
    </button>
  )
}
