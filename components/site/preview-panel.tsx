"use client"

import * as React from "react"
import { ArrowUpRight, Moon, RotateCcw, Sun } from "lucide-react"

import { cn } from "@/lib/utils"
import { CopyButton } from "./copy-button"
import { DemoPreview } from "./demo-preview"
import { DocsTabs } from "./docs-tabs"
import { useResolvedDark } from "./theme"

const iconButton =
  "grid size-7 place-items-center rounded-md text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"

/**
 * shadcn-style example block: Preview / Code tabs with a sliding underline, and a
 * framed stage below. The stage has its own light/dark switch (independent of the
 * site theme), a reset, and a link to the standalone /preview/<name> page.
 * Without `code` it renders the stage alone.
 */
export function PreviewPanel({ name, code }: { name: string; code?: React.ReactNode }) {
  const siteDark = useResolvedDark()
  const [override, setOverride] = React.useState<"light" | "dark" | null>(null)
  const [key, setKey] = React.useState(0)
  const theme = override ?? (siteDark ? "dark" : "light")

  const stage = (
    <div className="overflow-hidden rounded-xl border" data-preview-panel>
      <div
        className={cn(override, "relative bg-background text-foreground")}
        style={override ? { colorScheme: override } : undefined}
        data-preview-surface={theme}
      >
        <div aria-hidden className="bg-dots pointer-events-none absolute inset-0 [mask-image:radial-gradient(ellipse_at_center,black_40%,transparent_85%)]" />
        <div className="relative flex min-h-[22rem] items-center justify-center overflow-x-auto p-4 sm:p-10">
          <div className="flex w-full justify-center">
            <DemoPreview key={key} name={name} />
          </div>
        </div>
      </div>
    </div>
  )

  const tools = (
    <>
      <CopyButton
        value={`Build a polished, accessible React example using the Bollard UI ${name} component. Preserve its public props, include keyboard support and prefers-reduced-motion-safe feedback. Install with: npx shadcn@latest add https://bollard-ui.vercel.app/r/${name}.json`}
        label="Copy prompt for v0/Cursor"
        className="h-7 px-2 text-[11px]"
      >
        Copy prompt for v0/Cursor
      </CopyButton>
      <button type="button" onClick={() => setKey((k) => k + 1)} aria-label="Reset demo" title="Reset demo" className={iconButton}>
        <RotateCcw className="size-3.5" aria-hidden />
      </button>
      <button
        type="button"
        onClick={() => {
          const next = theme === "dark" ? "light" : "dark"
          setOverride(next === (siteDark ? "dark" : "light") ? null : next)
        }}
        aria-label={`Preview in ${theme === "dark" ? "light" : "dark"} mode`}
        title={`Preview in ${theme === "dark" ? "light" : "dark"} mode`}
        data-preview-theme-toggle={theme}
        className={iconButton}
      >
        {theme === "dark" ? <Sun className="size-3.5" aria-hidden /> : <Moon className="size-3.5" aria-hidden />}
      </button>
      <a
        href={`/preview/${name}${theme === "dark" ? "?theme=dark" : ""}`}
        target="_blank"
        rel="noreferrer"
        aria-label="Open preview in a new tab"
        title="Open preview in a new tab"
        className={iconButton}
      >
        <ArrowUpRight className="size-3.5" aria-hidden />
      </a>
    </>
  )

  if (!code) {
    return (
      <div className="space-y-2">
        <div className="flex justify-end gap-1">{tools}</div>
        {stage}
      </div>
    )
  }

  return (
    <DocsTabs
      label="Example"
      data-attr="example"
      listClassName="mb-4"
      actions={(value) => (value === "preview" ? tools : null)}
      tabs={[
        { value: "preview", label: "Preview", content: stage },
        { value: "code", label: "Code", content: code },
      ]}
    />
  )
}
