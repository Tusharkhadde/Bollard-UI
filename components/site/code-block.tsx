"use client"

import * as React from "react"
import { ChevronDown, FileCode2, Terminal } from "lucide-react"

import { cn } from "@/lib/utils"
import { CopyConfirm } from "@/registry/default/copy-confirm/copy-confirm"

export interface CodeFile {
  path: string
  source: string
  lines: number
  code: React.ReactNode
}

const asIs = (value: string) => value
const COLLAPSED_LINES = 16

/**
 * Source viewer: a file tab per file (or just the file name), optional line numbers,
 * its own scroll area and a copy button. `collapsible` folds long files to ~16 lines
 * behind an "Expand" button, like shadcn's docs. `bare` drops the outer frame when the
 * block sits inside another framed panel (the Code tab).
 */
export function CodeBlock({
  files,
  lineNumbers = true,
  collapsible = false,
  bare = false,
  className,
}: {
  files: CodeFile[]
  lineNumbers?: boolean
  collapsible?: boolean
  bare?: boolean
  className?: string
}) {
  const [index, setIndex] = React.useState(0)
  const [expanded, setExpanded] = React.useState(false)
  const file = files[index]
  const name = file.path.split("/").pop()
  const folded = collapsible && !expanded && file.lines > COLLAPSED_LINES + 4

  return (
    <div className={cn("relative overflow-hidden bg-surface", !bare && "rounded-xl border", className)} data-code-block>
      <div className="flex h-11 items-center gap-2 border-b px-2">
        {files.length > 1 ? (
          <div role="tablist" aria-label="Files" className="flex min-w-0 flex-1 gap-0.5 overflow-x-auto [scrollbar-width:none]">
            {files.map((f, i) => (
              <button
                key={f.path}
                type="button"
                role="tab"
                aria-selected={i === index}
                onClick={() => setIndex(i)}
                className={cn(
                  "flex h-7 shrink-0 items-center gap-1.5 rounded-md px-2 font-mono text-xs text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50",
                  i === index && "bg-accent text-foreground",
                )}
              >
                <FileCode2 className="size-3.5" aria-hidden />
                {f.path.split("/").pop()}
              </button>
            ))}
          </div>
        ) : (
          <span className="flex min-w-0 flex-1 items-center gap-1.5 px-1.5 font-mono text-xs text-muted-foreground">
            <FileCode2 className="size-3.5 shrink-0" aria-hidden />
            <span className="truncate">{name}</span>
          </span>
        )}
        <span className="hidden font-mono text-[11px] text-muted-foreground/80 tabular-nums sm:inline">{file.lines} lines</span>
        <CopyConfirm value={file.source.trimEnd()} label={`Copy ${name}`} toPlain={asIs} className="size-7 border-transparent bg-transparent text-muted-foreground shadow-none hover:bg-accent hover:text-foreground [&_svg]:size-3.5" />
      </div>
      <div
        role={files.length > 1 ? "tabpanel" : undefined}
        className={cn("overflow-auto overscroll-contain", folded ? "max-h-[22rem] overflow-hidden" : "max-h-[36rem]")}
      >
        <pre className="flex min-w-max py-3.5 font-mono text-[12.5px] leading-[1.7]">
          {lineNumbers && (
            <span aria-hidden className="sticky left-0 shrink-0 bg-surface pr-3 pl-4 text-right text-muted-foreground/45 select-none tabular-nums">
              {Array.from({ length: file.lines }, (_, i) => (
                <span key={i} className="block">
                  {i + 1}
                </span>
              ))}
            </span>
          )}
          <code className={cn("pr-6", lineNumbers ? "pl-1" : "pl-4")}>{file.code}</code>
        </pre>
      </div>
      {collapsible && file.lines > COLLAPSED_LINES + 4 && (
        <div
          className={cn(
            "flex justify-center",
            folded ? "absolute inset-x-0 bottom-0 bg-gradient-to-t from-surface via-surface/90 to-transparent pt-16 pb-4" : "border-t py-2",
          )}
        >
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
            className="inline-flex h-8 items-center gap-1.5 rounded-md border bg-background px-3 text-xs font-medium text-foreground outline-none transition-colors hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            {expanded ? "Collapse" : `Expand ${file.lines} lines`}
            <ChevronDown className={cn("size-3.5 transition-transform motion-reduce:transition-none", expanded && "rotate-180")} aria-hidden />
          </button>
        </div>
      )}
    </div>
  )
}

/** One-line command with a copy button. */
export function CommandLine({ command, label = "Copy command", className }: { command: string; label?: string; className?: string }) {
  return (
    <div className={cn("flex h-11 items-center gap-2.5 rounded-lg border bg-surface pr-1.5 pl-3", className)} data-command-line>
      <Terminal aria-hidden className="size-3.5 shrink-0 text-muted-foreground" />
      <code className="min-w-0 flex-1 overflow-x-auto font-mono text-[12.5px] whitespace-nowrap [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {command}
      </code>
      <CopyConfirm value={command} label={label} toPlain={asIs} className="size-7 shrink-0 border-transparent bg-transparent text-muted-foreground shadow-none hover:bg-accent hover:text-foreground [&_svg]:size-3.5" />
    </div>
  )
}
