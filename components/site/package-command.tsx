"use client"

import * as React from "react"

import { CopyConfirm } from "@/registry/default/copy-confirm/copy-confirm"
import { registryItemsFromArgs, trackInstallCopy } from "@/lib/analytics"
import { DocsTabs } from "./docs-tabs"

const MANAGERS = ["pnpm", "npm", "yarn", "bun"] as const
type Manager = (typeof MANAGERS)[number]

const KEY = "bollard-ui-package-manager"
const EVENT = "bollard-ui-package-manager"
const asIs = (value: string) => value
const shortRegistryArgs = (args: string) => args.replace(/https:\/\/bollard-ui\.vercel\.app\/r\/([a-z0-9-]+)\.json/g, "@bollard/$1")

function read(): Manager {
  try {
    const saved = localStorage.getItem(KEY)
    if (saved && (MANAGERS as readonly string[]).includes(saved)) return saved as Manager
  } catch {}
  return "pnpm"
}

/** The chosen package manager, shared by every command block on the page and remembered across visits. */
function useManager() {
  const manager = React.useSyncExternalStore(
    (notify) => {
      window.addEventListener(EVENT, notify)
      window.addEventListener("storage", notify)
      return () => {
        window.removeEventListener(EVENT, notify)
        window.removeEventListener("storage", notify)
      }
    },
    read,
    () => "pnpm" as Manager,
  )
  const set = React.useCallback((next: string) => {
    try {
      localStorage.setItem(KEY, next)
    } catch {}
    window.dispatchEvent(new Event(EVENT))
  }, [])
  return [manager, set] as const
}

function commandFor(manager: Manager, kind: "add" | "install" | "shadcn", args: string) {
  if (kind === "shadcn") {
    return { pnpm: "pnpm dlx shadcn@4.21.0", npm: "npx shadcn@4.21.0", yarn: "yarn dlx shadcn@4.21.0", bun: "bunx --bun shadcn@4.21.0" }[manager] + ` ${args}`
  }
  if (kind === "add") {
    return { pnpm: "pnpm dlx shadcn@4.21.0 add", npm: "npx shadcn@4.21.0 add", yarn: "yarn dlx shadcn@4.21.0 add", bun: "bunx --bun shadcn@4.21.0 add" }[manager] + ` ${args}`
  }
  return { pnpm: "pnpm add", npm: "npm install", yarn: "yarn add", bun: "bun add" }[manager] + ` ${args}`
}

/**
 * A command in pnpm / npm / yarn / bun, shadcn-docs style: package-manager tabs
 * on top, the command below, copy at the right. `kind="add"` runs the shadcn CLI
 * with `args` (registry URLs); `kind="install"` installs npm packages; `kind="shadcn"`
 * runs any other shadcn CLI command (`init`, `add … --overwrite`).
 */
export function PackageCommand({ kind, args, label }: { kind: "add" | "install" | "shadcn"; args: string; label?: string }) {
  const [manager, setManager] = useManager()
  const displayArgs = kind === "add" ? shortRegistryArgs(args) : args
  const command = commandFor(manager, kind, displayArgs)
  const registryItems = registryItemsFromArgs(args)
  return (
    <div className="rounded-xl border bg-surface" data-package-command={kind}>
      <DocsTabs
        label="Package manager"
        variant="segmented"
        value={manager}
        onValueChange={setManager}
        listClassName="border-b px-2 py-1.5"
        actions={() => (
          <CopyConfirm
            value={command}
            label={label ?? "Copy command"}
            toPlain={asIs}
            onCopy={() => registryItems.length > 0 && trackInstallCopy({ components: registryItems, surface: "package-command", packageManager: manager })}
            className="size-7 border-transparent bg-transparent text-muted-foreground shadow-none hover:bg-accent hover:text-foreground [&_svg]:size-3.5"
          />
        )}
        tabs={MANAGERS.map((m) => ({
          value: m,
          label: m,
          content: (
            <div className="overflow-x-auto px-4 py-3.5 [scrollbar-width:thin]">
              <code className="font-mono text-[12.5px] whitespace-nowrap">
                <span className="text-muted-foreground">{commandFor(m, kind, "").trim()}</span> {displayArgs}
              </code>
            </div>
          ),
        }))}
      />
    </div>
  )
}
