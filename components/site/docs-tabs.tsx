"use client"

import * as React from "react"
import { MotionConfig, motion } from "motion/react"

import { cn } from "@/lib/utils"

export interface DocsTab {
  value: string
  label: React.ReactNode
  content: React.ReactNode
}

/**
 * Docs tabs with a sliding indicator (motion layoutId).
 * - "underline": text tabs on a hairline, the active one underlined (Preview / Code).
 * - "segmented": a quiet track with a sliding pill (CLI / Manual, package managers).
 * Panels stay mounted (hidden when inactive) so a demo keeps its state while you read its code.
 * Arrow keys, Home and End move between tabs (automatic activation).
 */
export function DocsTabs({
  tabs,
  label,
  defaultValue,
  value: controlled,
  onValueChange,
  variant = "underline",
  actions,
  className,
  listClassName,
  panelClassName,
  "data-attr": dataAttr,
}: {
  tabs: DocsTab[]
  label: string
  defaultValue?: string
  value?: string
  onValueChange?: (value: string) => void
  variant?: "underline" | "segmented"
  /** Extra controls at the right of the tab row; gets the active tab. */
  actions?: (value: string) => React.ReactNode
  className?: string
  listClassName?: string
  panelClassName?: string
  "data-attr"?: string
}) {
  const [internal, setInternal] = React.useState(defaultValue ?? tabs[0]?.value)
  const value = controlled ?? internal
  const id = React.useId()
  const refs = React.useRef<(HTMLButtonElement | null)[]>([])

  const select = (next: string) => {
    if (controlled === undefined) setInternal(next)
    onValueChange?.(next)
  }

  const onKeyDown = (event: React.KeyboardEvent, index: number) => {
    const last = tabs.length - 1
    const to =
      event.key === "ArrowRight" ? (index === last ? 0 : index + 1) : event.key === "ArrowLeft" ? (index === 0 ? last : index - 1) : event.key === "Home" ? 0 : event.key === "End" ? last : -1
    if (to === -1) return
    event.preventDefault()
    select(tabs[to].value)
    refs.current[to]?.focus()
  }

  const underline = variant === "underline"

  return (
    <MotionConfig reducedMotion="user">
      <div className={className} data-docs-tabs={dataAttr}>
        <div className={cn("flex min-w-0 items-center gap-2", underline && "border-b", listClassName)}>
          <div
            role="tablist"
            aria-label={label}
            className={cn(
              "flex min-w-0 items-center overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
              underline ? "-mb-px gap-4" : "gap-0.5 rounded-lg bg-muted/70 p-0.5 dark:bg-white/[0.05]",
            )}
          >
            {tabs.map((tab, index) => {
              const active = tab.value === value
              return (
                <button
                  key={tab.value}
                  ref={(node) => {
                    refs.current[index] = node
                  }}
                  type="button"
                  role="tab"
                  id={`${id}-tab-${tab.value}`}
                  aria-selected={active}
                  aria-controls={`${id}-panel-${tab.value}`}
                  tabIndex={active ? 0 : -1}
                  onClick={() => select(tab.value)}
                  onKeyDown={(event) => onKeyDown(event, index)}
                  data-tab={tab.value}
                  className={cn(
                    "relative inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50",
                    underline
                      ? "h-10 rounded-sm px-0.5 text-sm font-medium"
                      : "h-7 rounded-md px-2.5 text-[13px] font-medium",
                    active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {active &&
                    (underline ? (
                      <motion.span
                        layoutId={`${id}-indicator`}
                        aria-hidden
                        className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-foreground"
                        transition={{ type: "spring", stiffness: 520, damping: 40 }}
                      />
                    ) : (
                      <motion.span
                        layoutId={`${id}-indicator`}
                        aria-hidden
                        className="absolute inset-0 rounded-md bg-background shadow-[0_1px_2px_rgb(0_0_0/0.06),0_0_0_1px_var(--border)] dark:bg-white/[0.09] dark:shadow-none"
                        transition={{ type: "spring", stiffness: 520, damping: 40 }}
                      />
                    ))}
                  <span className="relative">{tab.label}</span>
                </button>
              )
            })}
          </div>
          {actions && <div className="ml-auto flex shrink-0 items-center gap-1">{actions(value)}</div>}
        </div>
        {tabs.map((tab) => (
          <div
            key={tab.value}
            role="tabpanel"
            id={`${id}-panel-${tab.value}`}
            aria-labelledby={`${id}-tab-${tab.value}`}
            hidden={tab.value !== value}
            className={panelClassName}
          >
            {tab.content}
          </div>
        ))}
      </div>
    </MotionConfig>
  )
}
