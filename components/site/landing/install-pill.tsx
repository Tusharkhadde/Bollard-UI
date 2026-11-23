"use client"

import * as React from "react"
import { Check, Copy } from "lucide-react"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"

import { trackCopyInstall } from "@/lib/analytics"
import { cn } from "@/lib/utils"

/** The short registry command for one item. Namespace setup lives in "How it works" and /docs. */
export const shortInstall = (name: string) => `npx shadcn add @bollard/${name}`

/**
 * A compact, copyable install command. The whole pill is the button, so it is one
 * tab stop with one obvious action; the text shown is exactly what is copied.
 */
export function InstallPill({
  name,
  surface,
  className,
  size = "md",
}: {
  name: string
  surface: string
  className?: string
  size?: "sm" | "md"
}) {
  const reduce = useReducedMotion()
  const [state, setState] = React.useState<"idle" | "copied" | "failed">("idle")
  const command = shortInstall(name)

  React.useEffect(() => {
    if (state === "idle") return
    const timer = window.setTimeout(() => setState("idle"), 1800)
    return () => window.clearTimeout(timer)
  }, [state])

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(command)
      setState("copied")
      trackCopyInstall({ component: name, surface })
    } catch {
      setState("failed")
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      aria-label={`Copy install command: ${command}`}
      data-install-pill
      className={cn(
        "group/pill relative inline-flex max-w-full min-w-0 items-center gap-2.5 rounded-full border bg-background/80 font-mono text-muted-foreground shadow-xs backdrop-blur outline-none transition-[border-color,background-color,color,box-shadow] hover:border-border-strong hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-card/70",
        size === "md" ? "h-10 pr-1.5 pl-4 text-[13px]" : "h-8 pr-1 pl-3 text-xs",
        className,
      )}
    >
      <span aria-hidden className="select-none text-brand">$</span>
      <span className="min-w-0 truncate">
        npx shadcn add <span className="font-medium text-foreground">@bollard/{name}</span>
      </span>
      <span
        aria-hidden
        className={cn(
          "grid shrink-0 place-items-center rounded-full border bg-surface text-muted-foreground transition-colors group-hover/pill:text-foreground",
          size === "md" ? "size-7" : "size-6",
          state === "copied" && "border-emerald-500/40 text-emerald-600 dark:text-emerald-400",
        )}
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={state === "copied" ? "check" : "copy"}
            initial={reduce ? false : { opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={reduce ? { opacity: 0, transition: { duration: 0 } } : { opacity: 0, scale: 0.6 }}
            transition={{ duration: 0.16 }}
            className="grid place-items-center"
          >
            {state === "copied" ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
          </motion.span>
        </AnimatePresence>
      </span>
      <span className="sr-only" aria-live="polite">
        {state === "copied" ? "Copied to clipboard" : state === "failed" ? "Copy failed. Select the command and copy it manually." : ""}
      </span>
    </button>
  )
}
