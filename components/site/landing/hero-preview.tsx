"use client"

import * as React from "react"
import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { AnimatePresence, motion } from "motion/react"

import { cn } from "@/lib/utils"

import { AgentScreen, DangerZoneScreen, PaymentsScreen, SignUpScreen } from "./hero-screens"

const TABS = [
  { id: "payments", label: "Payments", path: "acme.app/pay/ravi", uses: ["amount-input", "duplicate-payment-guard"], Screen: PaymentsScreen },
  { id: "signup", label: "Sign-up", path: "acme.app/signup", uses: ["email-input", "phone-input", "password-input", "safe-submit"], Screen: SignUpScreen },
  { id: "danger", label: "Danger zone", path: "acme.app/settings/danger", uses: ["account-deletion-readback"], Screen: DangerZoneScreen },
  { id: "agents", label: "AI agents", path: "acme.app/agent", uses: ["agent-action-approve"], Screen: AgentScreen },
] as const

type TabId = (typeof TABS)[number]["id"]

/**
 * The hero's product window: a framed browser with four tabs, each a small
 * screen built from real registry components with a mistake already in it.
 * A sliding pill marks the active tab; arrow keys move between tabs.
 */
export function HeroPreview({ className }: { className?: string }) {
  const [active, setActive] = React.useState<TabId>("payments")
  const tabRefs = React.useRef<Record<string, HTMLButtonElement | null>>({})
  const baseId = React.useId()
  const tab = TABS.find((t) => t.id === active) ?? TABS[0]

  const onKeyDown = (event: React.KeyboardEvent) => {
    const i = TABS.findIndex((t) => t.id === active)
    const step = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0
    const jump = event.key === "Home" ? 0 : event.key === "End" ? TABS.length - 1 : -1
    if (!step && jump < 0) return
    event.preventDefault()
    const next = jump >= 0 ? TABS[jump] : TABS[(i + step + TABS.length) % TABS.length]
    setActive(next.id)
    tabRefs.current[next.id]?.focus()
  }

  return (
    // Outer bezel: a borderless tinted rim around the window (one hairline only, on the inner window), like a product shot.
    <div className={cn("rounded-[1rem] bg-foreground/[0.04] p-1 shadow-[0_30px_80px_-30px_rgb(0_0_0/0.22)] sm:p-1.5 dark:bg-white/[0.05] dark:shadow-[0_30px_80px_-20px_rgb(0_0_0/0.8)]", className)}>
      <div className="overflow-hidden rounded-xl border bg-background">
        {/* Chrome: traffic lights, address, tabs */}
        <div className="flex h-11 items-center gap-3 border-b px-3 sm:px-4">
          <div aria-hidden className="hidden shrink-0 gap-1.5 sm:flex">
            <span className="size-2.5 rounded-full bg-foreground/25 ring-1 ring-foreground/10 ring-inset" />
            <span className="size-2.5 rounded-full bg-foreground/25 ring-1 ring-foreground/10 ring-inset" />
            <span className="size-2.5 rounded-full bg-foreground/25 ring-1 ring-foreground/10 ring-inset" />
          </div>
          <div className="mx-auto flex h-7 min-w-0 max-w-[16rem] flex-1 items-center justify-center gap-1.5 truncate rounded-md border bg-muted px-3 font-mono text-xs text-foreground/80">
            <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-emerald-500/80" />
            <span className="truncate">{tab.path}</span>
          </div>
          <div aria-hidden className="hidden w-[2.625rem] shrink-0 sm:block" />
        </div>

        <div className="flex items-center border-b px-2 py-2 sm:px-3">
          <div
            role="tablist"
            aria-label="Example screens"
            onKeyDown={onKeyDown}
            className="flex min-w-0 gap-0.5 overflow-x-auto rounded-lg [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
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
                    "relative h-8 shrink-0 rounded-md px-3 text-[13px] whitespace-nowrap outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50",
                    selected ? "text-foreground" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {selected && (
                    <motion.span
                      layoutId={`${baseId}-pill`}
                      aria-hidden
                      className="absolute inset-0 rounded-md border bg-accent"
                      transition={{ type: "spring", stiffness: 500, damping: 40 }}
                    />
                  )}
                  <span className="relative">{t.label}</span>
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
          className="ink-amber bg-dots relative flex justify-center bg-surface px-3 py-8 sm:min-h-[37rem] sm:px-8 sm:py-12"
        >
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={active}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.16, ease: "easeOut" }}
              className="flex w-full min-w-0 items-center justify-center"
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
              className="rounded-md border px-1.5 py-0.5 font-mono text-[11px] text-foreground outline-none transition-colors hover:border-border-strong hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50"
            >
              {name}
            </Link>
          ))}
          {/* Right-hand anchor so every tab's row is balanced, whether it lists one component or four. */}
          <Link
            href="/components"
            className="ml-auto hidden items-center gap-1 rounded-md text-xs text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 sm:inline-flex"
          >
            All components
            <ArrowRight aria-hidden className="size-3" />
          </Link>
        </div>
      </div>
    </div>
  )
}
