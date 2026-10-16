"use client"

import * as React from "react"
import { FileText } from "lucide-react"

import { UndoToaster, undoable } from "@/registry/default/undo-toast/undo-toast"

const FILES = ["design-spec.pdf", "invoice-0042.pdf", "roadmap.key", "contract-signed.pdf"]
// The server refuses to delete this one, to show a failed commit rolling back.
const LOCKED = "contract-signed.pdf"

export function Demo() {
  const [files, setFiles] = React.useState(FILES)
  const [log, setLog] = React.useState("Nothing is deleted on the server until the ring runs out.")

  const remove = React.useCallback((file: string, duration?: number) => {
    setFiles((list) => list.filter((item) => item !== file))
    let committing = false
    return undoable({
      message: `Deleted ${file}`,
      duration,
      onUndo: () => {
        setFiles((list) => FILES.filter((item) => item === file || list.includes(item)))
        setLog(committing ? `The server refused to delete ${file} (legal hold), so it's back.` : `${file} restored. The server never heard about it.`)
      },
      onCommit: () => {
        committing = true
        return file === LOCKED
          ? new Promise<void>((_, reject) => setTimeout(() => reject(new Error("Legal hold")), 400))
          : setLog(`${file} permanently deleted.`)
      },
    })
  }, [])

  // Start mid-mistake: one file was just deleted and can still be taken back.
  const started = React.useRef(false)
  React.useEffect(() => {
    if (started.current) return
    started.current = true
    remove("invoice-0042.pdf", 8000)
  }, [remove])

  return (
    <div className="w-full max-w-sm space-y-2">
      <ul className="divide-y rounded-md border">
        {files.map((file) => (
          <li key={file} className="flex items-center gap-2 py-1 pr-1 pl-3 text-sm">
            <FileText aria-hidden className="size-4 text-muted-foreground" />
            <span className="flex-1 truncate">{file}</span>
            <button
              type="button"
              onClick={() => remove(file)}
              className="h-8 rounded-md px-3 text-xs font-medium text-destructive outline-none hover:bg-destructive/10 focus-visible:ring-[3px] focus-visible:ring-ring/50"
            >
              Delete
            </button>
          </li>
        ))}
        {files.length === 0 && (
          <li className="p-3 text-center text-sm text-muted-foreground">All gone. Try ⌘/Ctrl+Z.</li>
        )}
      </ul>
      <UndoToaster className="static inset-auto mx-0 max-w-none px-0" />
      <p aria-live="polite" className="text-xs text-muted-foreground">
        {log}
      </p>
    </div>
  )
}
