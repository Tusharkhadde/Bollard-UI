"use client"

import { cn } from "@/lib/utils"
import { CopyConfirm } from "@/registry/default/copy-confirm/copy-confirm"

const asIs = (value: string) => value

/**
 * The shadcn install line, styled as a terminal prompt. `registryBase` is the
 * site's /r/ URL, so the command a user copies is exactly what they would run.
 *
 * It always reads from "$ npx" (never opened scrolled). The display shortens
 * gracefully instead: the full host shows when the box is wide enough (a
 * container query), otherwise it becomes "…/r/". If even that doesn't fit, the
 * line wraps between whole words ("npx shadcn@latest add" / the URL), never
 * mid-string. Copy always copies the full command.
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
  const dim = tone === "default" ? "text-muted-foreground" : "text-white/60"
  const dimmer = tone === "default" ? "text-muted-foreground/80" : "text-white/45"

  return (
    <div
      data-install-command
      className={cn(
        "group/install flex min-h-12 items-center gap-3 rounded-xl border py-1.5 pr-1.5 pl-3.5 text-left font-mono text-[13px] leading-5 shadow-xs",
        tone === "default" ? "bg-card" : "border-white/15 bg-white/[0.06] text-white",
        className,
      )}
    >
      {/* Hanging indent: if the line wraps, the URL lines up under "npx", not under the "$". */}
      <div className="@container min-w-0 flex-1">
        <code className="block overflow-x-auto pl-[2ch] [text-indent:-2ch] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <span aria-hidden className="select-none text-amber-700 dark:text-amber-400">
            ${" "}
          </span>
          <span className={cn("whitespace-nowrap", dim)}>npx shadcn@latest add</span>{" "}
          <span className="whitespace-nowrap">
            <span className={dimmer}>
              <span className="hidden @[32rem]:inline">{host}</span>
              <span className="@[32rem]:hidden">…/r/</span>
            </span>
            <span className="font-semibold">{name}</span>
            <span className={dimmer}>.json</span>
          </span>
        </code>
      </div>
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
