"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { X } from "lucide-react"

import { GITHUB_URL } from "@/lib/site"
import { cn } from "@/lib/utils"
import { Logo } from "./logo"
import { Sidebar } from "./sidebar"

const focusable = 'a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])'

/** Below lg: the docs navigation as a left sheet. Main links on top, then the same sidebar as desktop. Traps focus, Esc closes. */
export function MobileDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const panelRef = React.useRef<HTMLDivElement>(null)
  const closeRef = React.useRef<HTMLButtonElement>(null)
  const pathname = usePathname()

  React.useEffect(() => {
    if (!open) return
    const previous = document.activeElement as HTMLElement | null
    const overflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    closeRef.current?.focus({ preventScroll: true })
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose()
      if (event.key !== "Tab" || !panelRef.current) return
      const nodes = Array.from(panelRef.current.querySelectorAll<HTMLElement>(focusable)).filter((n) => n.offsetParent !== null)
      if (!nodes.length) return
      const first = nodes[0]
      const last = nodes[nodes.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
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

  const link = (active: boolean) =>
    cn(
      "flex h-9 items-center rounded-md px-2 text-[15px] outline-none transition-colors hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50",
      active ? "font-medium text-foreground" : "text-muted-foreground",
    )

  return (
    <div className="fixed inset-0 z-50 lg:hidden">
      <div aria-hidden className="absolute inset-0 bg-black/50 backdrop-blur-[1px] motion-safe:animate-[site-fade_150ms_ease-out]" onClick={onClose} />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Navigation"
        data-mobile-drawer
        className="absolute inset-y-0 left-0 flex w-[86vw] max-w-[20rem] flex-col border-r bg-background motion-safe:animate-[site-slide_220ms_cubic-bezier(0.22,1,0.36,1)]"
      >
        <div className="flex h-14 shrink-0 items-center justify-between px-4">
          <Logo />
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close navigation"
            className="grid size-8 place-items-center rounded-md text-muted-foreground outline-none hover:bg-accent hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>
        <nav aria-label="Main" className="shrink-0 border-b px-3 pb-3">
          <Link href="/" onClick={onClose} className={link(pathname === "/")}>
            Home
          </Link>
          <Link href="/components" onClick={onClose} className={link(pathname.startsWith("/components"))}>
            Components
          </Link>
          <Link href="/#flows" onClick={onClose} className={link(false)}>
            Flows
          </Link>
          <a href={GITHUB_URL} className={link(false)}>
            GitHub
          </a>
        </nav>
        <Sidebar className="min-h-0 flex-1" />
      </div>
    </div>
  )
}
