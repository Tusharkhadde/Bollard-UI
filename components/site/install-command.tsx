"use client"

import { cn } from "@/lib/utils"
import { trackInstallCopy } from "@/lib/analytics"
import { CopyConfirm } from "@/registry/default/copy-confirm/copy-confirm"

const asIs = (value: string) => value

/**
 * The shadcn install line, styled as a terminal prompt. `registryBase` is the
 * site's shadcn namespace. The command shown is exactly the command copied and
 * run; the namespace setup lives in the getting-started instructions.
 *
 * It always reads from "$ npx". When the box is narrow the line wraps between
 * "npx shadcn@4.21.0 add" and the registry name (hanging indent). Copy copies
 * the same short command.
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
  const command = `npx shadcn@4.21.0 add @bollard/${name}`
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
      <div className="min-w-0 flex-1">
        <code className="block pl-[2ch] [text-indent:-2ch]">
          <span aria-hidden className="select-none text-amber-700 dark:text-amber-400">
            ${" "}
          </span>
          <span className={cn("whitespace-nowrap", dim)}>npx shadcn@4.21.0 add</span>{" "}<span className="font-semibold whitespace-nowrap">@bollard/{name}</span>
        </code>
      </div>
      <CopyConfirm
        value={command}
        label="Copy install command"
        toPlain={asIs}
        onCopy={() => trackInstallCopy({ component: name, surface: "install-command" })}
        className={cn("h-9 shrink-0 rounded-lg px-3 font-sans text-xs", tone === "inverted" && "border-white/15 bg-white/10 text-white hover:bg-white/20")}
      >
        Copy
      </CopyConfirm>
    </div>
  )
}
