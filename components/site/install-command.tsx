"use client"

import * as React from "react"

import { cn } from "@/lib/utils"
import { CopyConfirm } from "@/registry/default/copy-confirm/copy-confirm"

const asIs = (value: string) => value

/**
 * The shadcn install line, styled as a terminal prompt. `registryBase` is the
 * site's /r/ URL, so the command a user copies is exactly what they would run.
 * The component name is highlighted and kept in view (a line too long for the
 * screen scrolls to its end); the https:// is left off screen and phones show
 * the host as …/r/. Copy always copies the full command.
 */
export function InstallCommand({
  registryBase,
  name,
  className,
  tone = "default",
}: {
  registryBase: string
  name: string
  className?: string
  tone?: "default" | "inverted"
}) {
  const command = `npx shadcn@latest add ${registryBase}${name}.json`
  const host = registryBase.replace(/^https?:\/\//, "")
  const codeRef = React.useRef<HTMLElement>(null)
  const [clipped, setClipped] = React.useState(false)

  // When the line doesn't fit (phones), scroll it to the end so the component name shows, and fade the start instead.
  React.useEffect(() => {
    const node = codeRef.current
    if (!node) return
    const fit = () => {
      const over = node.scrollWidth > node.clientWidth + 1
      setClipped(over)
      if (over) node.scrollLeft = node.scrollWidth
    }
    fit()
    window.addEventListener("resize", fit)
    return () => window.removeEventListener("resize", fit)
  }, [name])

  return (
    <div
      data-install-command
      className={cn(
        "group/install flex h-12 items-center gap-3 rounded-xl border pr-1.5 pl-4 text-left font-mono text-[13px] shadow-xs",
        tone === "default" ? "bg-card" : "border-white/15 bg-white/[0.06] text-white",
        className,
      )}
    >
      <span aria-hidden className="select-none text-amber-600 dark:text-amber-400">
        $
      </span>
      <code
        ref={codeRef}
        className={cn(
          "min-w-0 flex-1 overflow-x-auto whitespace-nowrap [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
          clipped && "[mask-image:linear-gradient(to_right,transparent,black_1.5rem)]",
        )}
        tabIndex={0}
        role="region"
        aria-label="Install command"
      >
        <span>
          <span className={tone === "default" ? "text-muted-foreground" : "text-white/55"}>npx shadcn@latest add </span>
          <span className={tone === "default" ? "text-muted-foreground/70" : "text-white/40"}>
            <span className="hidden sm:inline">{host}</span>
            <span className="sm:hidden">…/r/</span>
          </span>
          <span className="font-semibold">{name}</span>
          <span className={tone === "default" ? "text-muted-foreground/70" : "text-white/40"}>.json</span>
        </span>
      </code>
      <CopyConfirm
        value={command}
        label="Copy install command"
        toPlain={asIs}
        className={cn("h-9 shrink-0 rounded-lg px-3 font-sans text-xs", tone === "inverted" && "border-white/15 bg-white/10 text-white hover:bg-white/20")}
      >
        Copy
      </CopyConfirm>
    </div>
  )
}
