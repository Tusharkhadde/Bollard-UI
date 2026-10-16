"use client"

import * as React from "react"
import { Link2 } from "lucide-react"

import {
  LargeAttachment,
  estimateCompressed,
  formatSize,
  type AttachmentFile,
} from "@/registry/default/large-attachment/large-attachment"

const MB = 1024 * 1024
const initial: AttachmentFile[] = [
  { name: "Final-deck.pptx", size: 8.4 * MB },
  { name: "Site-walkthrough.mp4", size: 9.6 * MB },
  { name: "Floor-plan.png", size: 2.1 * MB },
  { name: "Notes.txt", size: 42_000 },
]

export function Demo() {
  const [files, setFiles] = React.useState(initial)
  const [linked, setLinked] = React.useState<AttachmentFile[]>([])

  return (
    <div className="w-full max-w-md space-y-3">
      <LargeAttachment
        files={files}
        onSendAsLink={(over) => {
          setLinked((prev) => [...prev, ...over])
          setFiles((prev) => prev.filter((file) => !over.includes(file)))
        }}
        onCompress={() => setFiles((prev) => prev.map((file) => ({ ...file, size: estimateCompressed(file) })))}
      />
      {linked.length > 0 && (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Link2 aria-hidden className="size-3.5" />
          <span className="min-w-0 flex-1 truncate">
            Sharing as a link: {linked.map((file) => `${file.name} (${formatSize(file.size)})`).join(", ")}
          </span>
        </p>
      )}
      {(linked.length > 0 || files !== initial) && (
        <button
          type="button"
          onClick={() => {
            setFiles(initial)
            setLinked([])
          }}
          className="rounded-md border px-2 py-1 text-xs outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          Reset demo
        </button>
      )}
    </div>
  )
}
