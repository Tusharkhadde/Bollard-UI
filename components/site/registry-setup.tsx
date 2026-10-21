"use client"

import { CopyButton } from "@/components/site/copy-button"

const registrySnippet = `{
  "registries": {
    "@bollard": "https://bollard-ui.vercel.app/r/{name}.json"
  }
}`
const registryCommand = "npx shadcn@latest registry add @bollard=https://bollard-ui.vercel.app/r/{name}.json"

/** A small, copyable configuration step that makes @bollard installs work in a consuming shadcn project. */
export function RegistrySetup({ className }: { className?: string }) {
  return (
    <div className={className}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-medium">Add the Bollard namespace once</p>
        <CopyButton value={registryCommand} label="Copy Bollard registry setup command" className="h-8 px-2.5 text-[11px]">
          Copy setup command
        </CopyButton>
      </div>
      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
        Run this once from a shadcn project. It adds the namespace to <code className="font-mono text-[0.9em] text-foreground">components.json</code>, so every Bollard install can use the short command.
      </p>
      <pre className="mt-3 overflow-x-auto rounded-lg border bg-surface p-3 text-left text-xs leading-5 [scrollbar-width:thin]"><code>{registryCommand}</code></pre>
      <p className="mt-4 text-xs text-muted-foreground">Prefer a manual edit? Merge this configuration instead.</p>
      <pre className="mt-3 overflow-x-auto rounded-lg border bg-surface p-3 text-left text-xs leading-5 [scrollbar-width:thin]"><code>{registrySnippet}</code></pre>
    </div>
  )
}
