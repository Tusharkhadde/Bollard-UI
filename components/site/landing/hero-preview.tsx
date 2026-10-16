"use client"

import * as React from "react"
import Link from "next/link"
import { AnimatePresence, motion } from "motion/react"

import { cn } from "@/lib/utils"

import { DangerZoneScreen, DeveloperScreen, PaymentsScreen, SignUpScreen } from "./hero-screens"

const TABS = [
  { id: "payments", label: "Payments", path: "acme.app/pay/ravi", uses: ["amount-input", "duplicate-payment-guard"], Screen: PaymentsScreen },
  { id: "signup", label: "Sign-up", path: "acme.app/signup", uses: ["email-input", "phone-input", "password-input", "safe-submit"], Screen: SignUpScreen },
  { id: "danger", label: "Danger zone", path: "acme.app/settings/danger", uses: ["account-deletion-readback"], Screen: DangerZoneScreen },
  { id: "developer", label: "Developer", path: "acme.app/support", uses: ["secret-paste-guard", "connection-string-input"], Screen: DeveloperScreen },
] as const

type TabId = (typeof TABS)[number]["id"]

/**
 * The hero's example app: a browser-style window with four tabs, each a small
 * screen built from real registry components with a mistake already in it.
 * Switching tabs is the only interaction it adds; the components stay live.
 */
export function HeroPreview({ className }: { className?: string }) {
  const [active, setActive] = React.useState<TabId>("payments")
  const tabRefs = React.useRef<Record<string, HTMLButtonElement | null>>({})
  const baseId = React.useId()
  const tab = TABS.find((t) => t.id === active) ?? TABS[0]

  const onKeyDown = (event: React.KeyboardEvent) => {
    const i = TABS.findIndex((t) => t.id === active)
    const step = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0
    if (!step) return
    event.preventDefault()
    const next = TABS[(i + step + TABS.length) % TABS.length]
    setActive(next.id)
    tabRefs.current[next.id]?.focus()
  }

  return (
    <div className={cn("overflow-hidden rounded-2xl border bg-background shadow-[0_24px_60px_-24px_rgb(0_0_0/0.25)] dark:shadow-[0_24px_60px_-24px_rgb(0_0_0/0.7)]", className)}>
      {/* Window chrome */}
      <div className="flex h-11 items-center gap-3 border-b bg-muted/40 px-4">
        <div aria-hidden className="flex shrink-0 gap-1.5">
          <span className="size-2.5 rounded-full bg-foreground/15" />
          <span className="size-2.5 rounded-full bg-foreground/15" />
          <span className="size-2.5 rounded-full bg-foreground/15" />
        </div>
        <div className="mx-auto flex h-7 min-w-0 max-w-xs flex-1 items-center justify-center truncate rounded-md border bg-background px-3 font-mono text-xs text-muted-foreground">
          {tab.path}
        </div>
        <div aria-hidden className="w-[2.625rem] shrink-0" />
      </div>

      {/* Tabs */}
      <div className="border-b">
        <div
          role="tablist"
          aria-label="Example screens"
          onKeyDown={onKeyDown}
          className="flex overflow-x-auto px-2 [scrollbar-width:none] sm:px-4 [&::-webkit-scrollbar]:hidden"
        >
          {TABS.map((t) => {
            const selected = t.id === active
            return (
              <button
                key={t.id}
                ref={(node) => {
                  tabRefs.current[t.id] = node
                }}
                type="button"
                role="tab"
                id={`${baseId}-tab-${t.id}`}
                aria-selected={selected}
                aria-controls={`${baseId}-panel`}
                tabIndex={selected ? 0 : -1}
                onClick={() => setActive(t.id)}
                className={cn(
                  "relative h-11 shrink-0 px-3 text-sm whitespace-nowrap outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:ring-inset sm:px-4",
                  selected ? "font-bold text-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {t.label}
                {selected && (
                  <motion.span
                    layoutId={`${baseId}-underline`}
                    aria-hidden
                    className="absolute inset-x-3 -bottom-px h-0.5 rounded-full bg-amber-500 sm:inset-x-4"
                    transition={{ type: "spring", stiffness: 500, damping: 40 }}
                  />
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Screen */}
      <div
        role="tabpanel"
        id={`${baseId}-panel`}
        aria-labelledby={`${baseId}-tab-${active}`}
        className="flex justify-center sm:min-h-[34rem] bg-muted/30 px-3 py-6 sm:px-8 sm:py-10 lg:min-h-[42rem] dark:bg-muted/15"
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={active}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.14, ease: "easeOut" }}
            className="flex w-full min-w-0 items-start justify-center"
          >
            <tab.Screen />
          </motion.div>
        </AnimatePresence>
      </div>

      {/* What this screen is made of */}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 border-t px-4 py-3 text-xs text-muted-foreground sm:px-5">
        <span>Built with</span>
        {tab.uses.map((name) => (
          <Link
            key={name}
            href={`/components/${name}`}
            className="rounded-md border bg-muted/40 px-1.5 py-0.5 font-mono text-[11px] text-foreground outline-none transition-colors hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            {name}
          </Link>
        ))}
      </div>
    </div>
  )
}
