"use client"

import { CopyButton } from "@/components/site/copy-button"

const registrySnippet = `{
  "registries": {
    "@bollard": "https://bollard-ui.vercel.app/r/{name}.json"
  }
}`

/** A small, copyable configuration step that makes @bollard installs work in a consuming shadcn project. */
export function RegistrySetup({ className }: { className?: string }) {
  return (
    <div className={className}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-medium">Add the Bollard namespace once</p>
        <CopyButton value={registrySnippet} label="Copy Bollard registry configuration" className="h-8 px-2.5 text-[11px]">
          Copy config
        </CopyButton>
      </div>
      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
        Merge this into <code className="font-mono text-[0.9em] text-foreground">components.json</code> once. Then run <code className="font-mono text-[0.9em] text-foreground">npx shadcn@4.21.0 list</code> to check registry resolution before installing with the short command.
      </p>
      <pre className="mt-3 overflow-x-auto rounded-lg border bg-surface p-3 text-left text-xs leading-5 [scrollbar-width:thin]"><code>{registrySnippet}</code></pre>
    </div>
  )
}
