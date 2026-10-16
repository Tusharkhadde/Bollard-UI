"use client"

import * as React from "react"
import { X } from "lucide-react"

import { Logo } from "./logo"
import { Sidebar } from "./sidebar"

export function MobileDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const panelRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    if (!open) return
    const previous = document.activeElement as HTMLElement | null
    const overflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose()
    const onResize = () => window.matchMedia("(min-width: 1024px)").matches && onClose()
    window.addEventListener("keydown", onKey)
    window.addEventListener("resize", onResize)
    return () => {
      document.body.style.overflow = overflow
      window.removeEventListener("keydown", onKey)
      window.removeEventListener("resize", onResize)
      previous?.focus?.()
    }
  }, [open, onClose])

  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 lg:hidden">
      <div aria-hidden className="absolute inset-0 bg-black/40 motion-safe:animate-[site-fade_150ms_ease-out]" onClick={onClose} />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Navigation"
        data-mobile-drawer
        className="absolute inset-y-0 left-0 flex w-[85vw] max-w-80 flex-col border-r bg-background shadow-xl motion-safe:animate-[site-slide_200ms_ease-out]"
      >
        <div className="flex h-14 shrink-0 items-center justify-between border-b px-4">
          <Logo />
          <button
            type="button"
            onClick={onClose}
            aria-label="Close navigation"
            className="grid size-8 place-items-center rounded-md text-muted-foreground outline-none hover:bg-accent hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>
        <Sidebar className="flex-1" />
      </div>
    </div>
  )
}
