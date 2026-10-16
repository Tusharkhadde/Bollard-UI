"use client"

import * as React from "react"
import { FileCode2 } from "lucide-react"

import { cn } from "@/lib/utils"
import { CopyConfirm } from "@/registry/default/copy-confirm/copy-confirm"

export interface CodeFile {
  path: string
  source: string
  lines: number
  code: React.ReactNode
}

const asIs = (value: string) => value

/** Source viewer with a tab per file, line numbers, its own scroll area and a copy button. */
export function CodeBlock({ files }: { files: CodeFile[] }) {
  const [index, setIndex] = React.useState(0)
  const file = files[index]
  const name = file.path.split("/").pop()
  return (
    <div className="overflow-hidden rounded-xl border bg-muted/30" data-code-block>
      <div className="flex items-center gap-2 border-b bg-background/60 px-2 py-1.5">
        <div role="tablist" aria-label="Files" className="flex min-w-0 flex-1 gap-1 overflow-x-auto">
          {files.map((f, i) => (
            <button
              key={f.path}
              type="button"
              role="tab"
              aria-selected={i === index}
              onClick={() => setIndex(i)}
              className={cn(
                "flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1 font-mono text-xs text-muted-foreground outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50",
                i === index && "bg-accent text-foreground",
              )}
            >
              <FileCode2 className="size-3.5" aria-hidden />
              {f.path.split("/").pop()}
            </button>
          ))}
        </div>
        <span className="hidden text-xs text-muted-foreground tabular-nums sm:inline">{file.lines} lines</span>
        <CopyConfirm value={file.source.trimEnd()} label={`Copy ${name}`} toPlain={asIs} className="size-7" />
      </div>
      <div role="tabpanel" className="max-h-[32rem] overflow-auto overscroll-contain">
        <pre className="flex min-w-max py-3 font-mono text-[12.5px] leading-5">
          <span aria-hidden className="sticky left-0 shrink-0 bg-muted/90 px-3 text-right text-muted-foreground/60 select-none tabular-nums backdrop-blur">
            {Array.from({ length: file.lines }, (_, i) => (
              <span key={i} className="block">
                {i + 1}
              </span>
            ))}
          </span>
          <code className="pr-6 pl-2">{file.code}</code>
        </pre>
      </div>
    </div>
  )
}

/** One-line command with a copy button. */
export function CommandLine({ command, label = "Copy command", className }: { command: string; label?: string; className?: string }) {
  return (
    <div className={cn("flex items-center gap-2 rounded-lg border bg-muted/40 py-1.5 pr-1.5 pl-3", className)} data-command-line>
      <span aria-hidden className="font-mono text-xs text-muted-foreground select-none">
        $
      </span>
      <code className="min-w-0 flex-1 overflow-x-auto font-mono text-xs whitespace-nowrap [scrollbar-width:none]">{command}</code>
      <CopyConfirm value={command} label={label} toPlain={asIs} className="size-7 shrink-0" />
    </div>
  )
}
