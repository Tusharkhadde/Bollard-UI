"use client"

import * as React from "react"
import { Files, GripVertical } from "lucide-react"

import { DropConfirm, type MoveItems } from "@/registry/default/drop-confirm/drop-confirm"

const selection: MoveItems = { count: 12, noun: "file", space: "Private" }

export function Demo() {
  const [where, setWhere] = React.useState("My files")
  const sharedRef = React.useRef<HTMLDivElement>(null)

  // Open on the catch: moving private files into a shared folder asks first.
  React.useEffect(() => {
    sharedRef.current?.querySelector("button")?.click()
  }, [])

  const items = where === "My files" ? selection : null

  return (
    <div className="flex w-full max-w-sm flex-col gap-3">
      <div
        draggable={Boolean(items)}
        onDragStart={(event) => {
          event.dataTransfer.setData("text/plain", "12 files")
          event.dataTransfer.effectAllowed = "move"
        }}
        className="flex h-11 items-center gap-2 rounded-md border bg-muted/50 px-3 text-sm aria-disabled:opacity-50"
        aria-disabled={!items}
      >
        <GripVertical aria-hidden className="size-4 text-muted-foreground" />
        <Files aria-hidden className="size-4" />
        <span className="flex-1">{items ? "12 files selected in My files" : `12 files are in ${where}`}</span>
      </div>
      <DropConfirm
        destination="Archive"
        items={items}
        onMove={() => setWhere("Archive")}
        onUndo={() => setWhere("My files")}
      />
      <DropConfirm
        ref={sharedRef}
        destination="Team Shared"
        space="Shared with Marketing"
        items={items}
        onMove={() => setWhere("Team Shared")}
        onUndo={() => setWhere("My files")}
      />
    </div>
  )
}
