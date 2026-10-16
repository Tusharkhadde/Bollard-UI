"use client"

import * as React from "react"
import { FileText } from "lucide-react"

import { isApplePlatform, ShortcutConfirm } from "@/registry/default/shortcut-confirm/shortcut-confirm"

const files = ["Q3 report.pdf", "Invoice 0142.pdf", "Team photo.jpg", "Roadmap.key", "Notes.txt"]

export function Demo() {
  const [items, setItems] = React.useState(files)
  const [selected, setSelected] = React.useState(() => new Set(files.slice(0, 3)))
  const [log, setLog] = React.useState("One press only arms it. Try it, then type in the field.")
  const count = items.filter((item) => selected.has(item)).length

  // Open on the catch: one stray press of the shortcut, which only arms it.
  React.useEffect(() => {
    const apple = isApplePlatform()
    const init = { key: "Backspace", code: "Backspace", metaKey: apple, ctrlKey: !apple, bubbles: true }
    const timer = setTimeout(() => {
      document.dispatchEvent(new KeyboardEvent("keydown", init))
      document.dispatchEvent(new KeyboardEvent("keyup", init))
    }, 150)
    return () => clearTimeout(timer)
  }, [])

  const toggle = (item: string) =>
    setSelected((current) => {
      const next = new Set(current)
      if (!next.delete(item)) next.add(item)
      return next
    })

  return (
    <div className="flex w-full max-w-xs flex-col gap-3">
      <ul aria-label="Files" className="divide-y rounded-md border text-sm">
        {items.map((item) => (
          <li key={item}>
            <label className="flex h-9 cursor-pointer items-center gap-2 px-3">
              <input type="checkbox" checked={selected.has(item)} onChange={() => toggle(item)} className="size-4 accent-primary" />
              <FileText aria-hidden className="size-4 text-muted-foreground" />
              <span className="truncate">{item}</span>
            </label>
          </li>
        ))}
      </ul>
      <ShortcutConfirm
        shortcut="Mod+Backspace"
        enabled={count > 0}
        action={`delete ${count} ${count === 1 ? "item" : "items"}`}
        onConfirm={() => {
          setItems((current) => current.filter((item) => !selected.has(item)))
          setLog(`Deleted ${count} ${count === 1 ? "item" : "items"}.`)
        }}
      />
      <input
        aria-label="Rename"
        defaultValue="Shortcuts in here edit text"
        className="h-9 w-full min-w-0 rounded-md border bg-transparent px-3 text-base shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 md:text-sm dark:bg-input/30"
      />
      <p className="text-xs text-muted-foreground">{log}</p>
    </div>
  )
}
