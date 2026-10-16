"use client"

import * as React from "react"
import { FileSpreadsheet, FileText, Image as ImageIcon, Presentation } from "lucide-react"

import { TrashCountdown, type TrashItem } from "@/registry/default/trash-countdown/trash-countdown"

const DAY = 86_400_000

/** Name, icon, location and how long ago (ms) it was trashed. */
const SEED: [string, React.ReactNode, string, number][] = [
  ["Q3 board deck.pptx", <Presentation key="p" />, "Board / 2026", 29 * DAY + 5 * 3_600_000],
  ["Vendor contract – signed.pdf", <FileText key="f" />, "Legal", 27.5 * DAY],
  ["Payroll October.xlsx", <FileSpreadsheet key="s" />, "Finance / Payroll", 14 * DAY],
  ["Offsite photos.zip", <ImageIcon key="i" />, "Team", 6 * DAY],
  ["Draft – pricing page.docx", <FileText key="d" />, "Marketing", 40 * 60_000],
]

export function Demo() {
  const [items, setItems] = React.useState<TrashItem[]>()
  const [arrived, setArrived] = React.useState(false)

  React.useEffect(() => {
    const now = Date.now()
    setItems(SEED.map(([name, icon, location, ago], i) => ({ id: `t${i}`, name, icon, location, deletedAt: now - ago })))
  }, [])

  if (!items) return null

  return (
    <div className="grid w-full max-w-md gap-3">
      <TrashCountdown
        items={items}
        onRestore={(id) => setItems((list) => list?.filter((item) => item.id !== id))}
        onEmpty={() => new Promise<void>((resolve) => setTimeout(() => { setItems([]); resolve() }, 600))}
      />
      <button
        type="button"
        disabled={arrived}
        onClick={() => {
          setArrived(true)
          setItems((list) => [...(list ?? []), { id: "t-new", name: "Old logo.svg", icon: <ImageIcon />, location: "Brand", deletedAt: Date.now() }])
        }}
        className="mx-auto h-8 rounded-md border px-3 text-xs font-medium outline-none transition-colors hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-50"
      >
        A teammate trashes another file
      </button>
    </div>
  )
}
