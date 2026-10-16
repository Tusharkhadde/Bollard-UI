"use client"

// Bollard UI — experimental-badge · MIT licence · https://bollard-ui.vercel.app/components/experimental-badge

import * as React from "react"
import { CircleSlash, DatabaseZap, FlaskConical, LoaderCircle, MessageSquareText, Shuffle, Undo2 } from "lucide-react"

import { cn } from "@/lib/utils"

export type ExperimentStage = "experimental" | "beta" | "preview"
export type RiskKind = "data" | "change" | "removal"

export interface ExperimentRisk {
  /** Picks the icon: `data` loss, things that `change`, or `removal` of the feature. */
  kind: RiskKind
  /** One concrete sentence, e.g. "Filters you save here may be deleted before launch." */
  text: string
}

const riskIcons = { data: DatabaseZap, change: Shuffle, removal: CircleSlash } as const

/** Concrete defaults per stage. Replace them with what's actually true for your feature. */
export const DEFAULT_RISKS: Record<ExperimentStage, ExperimentRisk[]> = {
  experimental: [
    { kind: "data", text: "Anything you create with it may be lost. Keep a copy of what matters." },
    { kind: "change", text: "It can change from one day to the next." },
    { kind: "removal", text: "It may be removed without notice." },
  ],
  beta: [
    { kind: "data", text: "Work made with it may not carry over when it launches." },
    { kind: "change", text: "Buttons and layout may change before launch." },
  ],
  preview: [{ kind: "change", text: "Details may still change before it’s final." }],
}

const stageLabels: Record<ExperimentStage, string> = { experimental: "Experimental", beta: "Beta", preview: "Preview" }
const small =
  "inline-flex h-8 items-center justify-center gap-1.5 rounded-md px-3 text-sm font-medium whitespace-nowrap outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-60"

export interface ExperimentalBadgeProps extends Omit<React.ComponentProps<"span">, "children"> {
  /** The feature's name, e.g. "Smart inbox". */
  feature: string
  /** How unfinished the feature is. */
  stage?: ExperimentStage
  /** What can go wrong, as concrete sentences. Defaults depend on `stage`. */
  risks?: ExperimentRisk[]
  /** Where feedback goes: a form, an issue, a mailto. */
  feedbackHref?: string
  /** Or handle feedback yourself (open your widget). */
  onFeedback?: () => void
  /** Turn the feature off and go back to the stable version. May return a promise. */
  onSwitchBack?: () => void | Promise<void>
  /** What happens to their work when they switch back, e.g. "Your 3 saved views stay here for when you return." */
  switchBackNote?: string
  /** Controlled open state of the panel. */
  open?: boolean
  /** Initial open state when uncontrolled. */
  defaultOpen?: boolean
  /** Called when the panel opens or closes. */
  onOpenChange?: (open: boolean) => void
  /** Badge text. Defaults to the stage name. */
  label?: string
  /** Panel heading; `{feature}` and `{stage}` are filled in. */
  heading?: string
  /** Text for the feedback link. */
  feedbackLabel?: string
  /** Text for the switch-back button. */
  switchBackLabel?: string
  /** Button text while switching back. */
  switchingLabel?: string
  /** Shown when switching back fails. */
  errorText?: string
}

/**
 * A badge for features that aren't finished. Tapping it says plainly what can
 * go wrong (lost work, changes, removal) instead of a vague "beta", where to
 * send feedback, and offers a one-tap way back to the stable version that says
 * up front what happens to the user's work. The dashed outline reads as
 * "unfinished" even at a glance.
 */
export function ExperimentalBadge({
  feature,
  stage = "beta",
  risks = DEFAULT_RISKS[stage],
  feedbackHref,
  onFeedback,
  onSwitchBack,
  switchBackNote,
  open: openProp,
  defaultOpen = false,
  onOpenChange,
  label = stageLabels[stage],
  heading = "{feature} is in {stage}",
  feedbackLabel = "Send feedback",
  switchBackLabel = "Use stable version",
  switchingLabel = "Switching…",
  errorText = "Couldn’t switch back. Try again.",
  className,
  ...props
}: ExperimentalBadgeProps) {
  const [openState, setOpenState] = React.useState(defaultOpen)
  const open = openProp ?? openState
  const [pending, setPending] = React.useState(false)
  const [error, setError] = React.useState(false)
  const panelRef = React.useRef<HTMLDivElement>(null)
  const triggerRef = React.useRef<HTMLButtonElement>(null)
  const panelId = React.useId()

  // The panel lives in the top layer (Popover API), so overflow-hidden cards can't clip it.
  // It's placed under the badge and kept inside the viewport.
  const place = React.useCallback(() => {
    const panel = panelRef.current
    const trigger = triggerRef.current
    if (!panel || !trigger) return
    const anchor = trigger.getBoundingClientRect()
    const width = panel.offsetWidth
    const viewport = document.documentElement.clientWidth
    panel.style.top = `${anchor.bottom + 8}px`
    panel.style.left = `${Math.max(8, Math.min(anchor.left, viewport - width - 8))}px`
  }, [])

  React.useLayoutEffect(() => {
    const panel = panelRef.current
    if (!panel || panel.matches(":popover-open") === open) return
    if (open) {
      panel.showPopover()
      place()
    } else panel.hidePopover()
  }, [open, place])

  React.useEffect(() => {
    if (!open) return
    window.addEventListener("resize", place)
    window.addEventListener("scroll", place, true)
    return () => {
      window.removeEventListener("resize", place)
      window.removeEventListener("scroll", place, true)
    }
  }, [open, place])

  const onToggle = (event: React.ToggleEvent<HTMLDivElement>) => {
    const next = event.newState === "open"
    if (next) place()
    if (next === open) return
    setOpenState(next)
    onOpenChange?.(next)
  }

  const switchBack = async () => {
    if (!onSwitchBack) return
    setError(false)
    setPending(true)
    try {
      await onSwitchBack()
    } catch {
      setError(true)
    } finally {
      setPending(false)
    }
  }

  const title = heading.replace("{feature}", feature).replace("{stage}", stageLabels[stage].toLowerCase())

  return (
    <span
      data-slot="experimental-badge"
      data-stage={stage}
      data-state={open ? "open" : "closed"}
      className={cn("inline-flex align-middle", className)}
      {...props}
    >
      <button
        ref={triggerRef}
        type="button"
        aria-expanded={open}
        popoverTarget={panelId}
        aria-label={`${label}: what this means for ${feature}`}
        className="inline-flex h-5 items-center gap-1 rounded-full border border-dashed border-amber-600/60 bg-amber-500/10 px-2 text-xs font-medium text-amber-800 outline-none transition-colors hover:bg-amber-500/20 focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:border-amber-400/60 dark:text-amber-300"
      >
        <FlaskConical aria-hidden className="size-3" />
        {label}
      </button>
      <div
        ref={panelRef}
        id={panelId}
        popover="auto"
        role="dialog"
        aria-label={title}
        onToggle={onToggle}
        className="fixed inset-auto m-0 w-72 max-w-[calc(100vw-1rem)] origin-top-left rounded-lg border bg-popover p-3 text-left text-sm font-normal text-popover-foreground shadow-md motion-safe:open:animate-[cui-experimental-badge-in_160ms_ease-out]"
      >
        <style>{"@keyframes cui-experimental-badge-in{from{opacity:0;transform:scale(.96) translateY(-4px)}}"}</style>
        <p className="font-medium">{title}</p>
        <ul className="mt-2 space-y-1.5">
          {risks.map((risk) => {
            const Icon = riskIcons[risk.kind]
            return (
              <li key={risk.text} className="flex gap-2 text-muted-foreground">
                <Icon aria-hidden className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
                <span>{risk.text}</span>
              </li>
            )
          })}
        </ul>
        {(feedbackHref || onFeedback || onSwitchBack) && (
          <div className="mt-3 flex flex-wrap gap-2 border-t pt-3">
            {feedbackHref ? (
              <a
                href={feedbackHref}
                target="_blank"
                rel="noreferrer"
                className={cn(small, "border shadow-xs hover:bg-accent dark:bg-input/30")}
              >
                <MessageSquareText aria-hidden className="size-4" />
                {feedbackLabel}
              </a>
            ) : onFeedback ? (
              <button
                type="button"
                onClick={onFeedback}
                className={cn(small, "border shadow-xs hover:bg-accent dark:bg-input/30")}
              >
                <MessageSquareText aria-hidden className="size-4" />
                {feedbackLabel}
              </button>
            ) : null}
            {onSwitchBack && (
              <button
                type="button"
                onClick={() => void switchBack()}
                disabled={pending}
                aria-describedby={switchBackNote ? `${panelId}-note` : undefined}
                className={cn(small, "bg-primary text-primary-foreground shadow-xs hover:bg-primary/90")}
              >
                {pending ? (
                  <LoaderCircle aria-hidden className="size-4 animate-spin" />
                ) : (
                  <Undo2 aria-hidden className="size-4" />
                )}
                {pending ? switchingLabel : switchBackLabel}
              </button>
            )}
            {switchBackNote && onSwitchBack && (
              <p id={`${panelId}-note`} className="w-full text-xs text-muted-foreground">
                {switchBackNote}
              </p>
            )}
            {error && (
              <p role="alert" className="w-full text-xs text-destructive">
                {errorText}
              </p>
            )}
          </div>
        )}
      </div>
    </span>
  )
}
