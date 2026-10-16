"use client"

import * as React from "react"
import { Moon, RotateCcw, Sun } from "lucide-react"

import { cn } from "@/lib/utils"
import { DemoPreview } from "./demo-preview"
import { useResolvedDark } from "./theme"

/** Live demo with its own light/dark switch, independent of the site theme. */
export function PreviewPanel({ name }: { name: string }) {
  const siteDark = useResolvedDark()
  const [override, setOverride] = React.useState<"light" | "dark" | null>(null)
  const [key, setKey] = React.useState(0)
  const theme = override ?? (siteDark ? "dark" : "light")
  return (
    <div className="overflow-hidden rounded-xl border" data-preview-panel>
      <div className="flex items-center justify-between gap-2 border-b bg-muted/30 px-3 py-1.5">
        <span className="text-xs font-medium text-muted-foreground">Preview</span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setKey((k) => k + 1)}
            aria-label="Reset demo"
            title="Reset demo"
            className="grid size-7 place-items-center rounded-md text-muted-foreground outline-none hover:bg-accent hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            <RotateCcw className="size-3.5" aria-hidden />
          </button>
          <div role="radiogroup" aria-label="Preview theme" className="inline-flex rounded-md border p-0.5">
            {(["light", "dark"] as const).map((value) => {
              const Icon = value === "light" ? Sun : Moon
              return (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={theme === value}
                  aria-label={`Preview in ${value} mode`}
                  title={`Preview in ${value} mode`}
                  data-preview-theme={value}
                  onClick={() => setOverride(value === (siteDark ? "dark" : "light") ? null : value)}
                  className={cn(
                    "grid size-6 place-items-center rounded text-muted-foreground outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50",
                    theme === value && "bg-accent text-foreground",
                  )}
                >
                  <Icon className="size-3.5" aria-hidden />
                </button>
              )
            })}
          </div>
        </div>
      </div>
      <div
        className={cn(override, "bg-background text-foreground")}
        style={override ? { colorScheme: override } : undefined}
        data-preview-surface={theme}
      >
        <div className="flex min-h-72 items-center justify-center overflow-x-auto p-4 sm:p-10">
          <div className="flex w-full justify-center">
            <DemoPreview key={key} name={name} />
          </div>
        </div>
      </div>
    </div>
  )
}
