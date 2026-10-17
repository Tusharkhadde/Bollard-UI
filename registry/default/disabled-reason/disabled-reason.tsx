"use client"

// Bollard UI — disabled-reason · MIT licence · https://bollard-ui.vercel.app/components/disabled-reason

import * as React from "react"
import { FloatingPortal, autoUpdate, flip, offset, shift, size, useFloating, type Placement } from "@floating-ui/react"
import { ArrowRight, Lock } from "lucide-react"
import { AnimatePresence, animate, motion, useReducedMotion } from "motion/react"

import { cn } from "@/lib/utils"

/** One thing standing between the user and the action, with an optional jump to the fix. */
export interface BlockedReason {
  /** Stable key, so a cleared blocker animates out instead of the list reshuffling. Defaults to the message. */
  id?: string
  /** Why the control can't be used, e.g. "You need Editor access". */
  message: string
  /** Label of the fix button, e.g. "Ask Priya" or "Show me". */
  actionLabel?: string
  /** Takes the user to the fix: focus the empty field, open the access request... */
  onAction?: () => void
}

type TriggerProps = { "aria-disabled"?: boolean | "true" | "false"; "aria-describedby"?: string }

export interface DisabledReasonProps extends Omit<React.ComponentProps<"span">, "children"> {
  /** What's blocking the control. An empty list means it's usable and the wrapper steps aside. */
  reasons: (BlockedReason | string)[]
  /** The button or control to wrap. Don't give it `disabled`; this sets `aria-disabled` instead. */
  children: React.ReactElement<TriggerProps>
  /** First line of the explanation. */
  heading?: string
  /** Read to screen readers when the control becomes usable. */
  readyMessage?: string
  /** Preferred side for the explanation; it flips when there's no room. */
  side?: "top" | "bottom"
  /** Which edge of the control it lines up with. */
  align?: "start" | "end"
  /** Controlled open state of the explanation. */
  open?: boolean
  /** Initial open state when uncontrolled. */
  defaultOpen?: boolean
  /** Called when the explanation opens or closes. */
  onOpenChange?: (open: boolean) => void
}

const fixClass =
  "inline-flex h-6 shrink-0 items-center gap-1 rounded-md border border-amber-500/40 px-2 text-xs font-medium text-amber-900 transition-colors hover:bg-amber-500/10 dark:text-amber-200 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"

/**
 * Stops "why won't this button work?" dead ends. Instead of a `disabled`
 * button that swallows clicks and can't be focused, the control stays
 * focusable with `aria-disabled`, and hover, focus or a tap explains every
 * blocker with a one-tap jump to its fix. The explanation is portalled and
 * positioned with floating-ui, so a toolbar or card with overflow hidden can't
 * clip it. A blocked press shakes the control and says so; each blocker you
 * clear slides out of the list, so you can see the path to "ready" shrink.
 */
export function DisabledReason({
  reasons,
  children,
  heading = "Not available yet",
  readyMessage = "Ready. You can use it now.",
  side = "top",
  align = "start",
  open,
  defaultOpen = false,
  onOpenChange,
  className,
  ...props
}: DisabledReasonProps) {
  const [innerOpen, setInnerOpen] = React.useState(defaultOpen)
  const [announcement, setAnnouncement] = React.useState("")
  const rootRef = React.useRef<HTMLSpanElement>(null)
  const triggerRef = React.useRef<HTMLSpanElement>(null)
  const hoverTimer = React.useRef<ReturnType<typeof setTimeout>>(undefined)
  const descriptionId = React.useId()
  const reduceMotion = useReducedMotion()
  const list = reasons.map((reason) => (typeof reason === "string" ? { message: reason } : reason))
  const blocked = list.length > 0
  const isOpen = blocked && (open ?? innerOpen)

  const { refs, floatingStyles, placement } = useFloating({
    open: isOpen,
    placement: `${side}-${align}` as Placement,
    middleware: [
      offset(8),
      flip({ padding: 8 }),
      shift({ padding: 8 }),
      size({
        padding: 8,
        apply: ({ availableWidth, elements }) => elements.floating.style.setProperty("--dr-max", `${Math.min(320, availableWidth)}px`),
      }),
    ],
    whileElementsMounted: autoUpdate,
  })
  const above = placement.startsWith("top")

  const setOpen = React.useCallback(
    (next: boolean) => {
      clearTimeout(hoverTimer.current)
      if (open === undefined) setInnerOpen(next)
      onOpenChange?.(next)
    },
    [open, onOpenChange],
  )

  // Once nothing blocks it any more, say so instead of silently re-enabling.
  const wasBlocked = React.useRef(blocked)
  React.useEffect(() => {
    if (wasBlocked.current && !blocked) setAnnouncement(readyMessage)
    wasBlocked.current = blocked
  }, [blocked, readyMessage])

  const inside = React.useCallback(
    (node: Node | null) => !!node && (!!rootRef.current?.contains(node) || !!refs.floating.current?.contains(node)),
    [refs.floating],
  )

  // Close on a tap or click anywhere else.
  React.useEffect(() => {
    if (!isOpen) return
    const onDown = (event: PointerEvent) => !inside(event.target as Node) && setOpen(false)
    document.addEventListener("pointerdown", onDown)
    return () => document.removeEventListener("pointerdown", onDown)
  }, [isOpen, setOpen, inside])

  React.useEffect(() => () => clearTimeout(hoverTimer.current), [])

  const onClickCapture = (event: React.MouseEvent) => {
    if (!blocked || !triggerRef.current?.contains(event.target as Node)) return
    event.preventDefault()
    event.stopPropagation()
    setOpen(true)
    // A trailing space toggles so the same explanation is read again on a second press.
    const text = `${heading}: ${list.map((reason) => reason.message).join(". ")}.`
    setAnnouncement((current) => (current === text ? `${text}\u00a0` : text))
    if (!reduceMotion) animate(triggerRef.current, { x: [0, -5, 5, -3, 2, 0] }, { duration: 0.36, ease: "easeOut" })
  }

  const hover = (next: boolean) => (event: React.PointerEvent) => {
    if (!blocked || event.pointerType !== "mouse") return
    clearTimeout(hoverTimer.current)
    // Focus keeps it open, so a keyboard or clicked-on explanation doesn't vanish when the mouse drifts off.
    if (!next && inside(document.activeElement)) return
    hoverTimer.current = setTimeout(() => setOpen(next), next ? 150 : 250)
  }

  const describedBy = [children.props["aria-describedby"], blocked ? descriptionId : undefined].filter(Boolean).join(" ")
  const trigger = React.cloneElement(children, {
    "aria-disabled": blocked || undefined,
    "aria-describedby": describedBy || undefined,
  })

  return (
    <span
      ref={rootRef}
      data-slot="disabled-reason"
      data-state={blocked ? (isOpen ? "open" : "blocked") : "ready"}
      className={cn("relative inline-flex", className)}
      onClickCapture={onClickCapture}
      onPointerLeave={hover(false)}
      onFocus={() => blocked && setOpen(true)}
      onBlur={(event) => !inside(event.relatedTarget as Node | null) && setOpen(false)}
      onKeyDown={(event) => {
        if (event.key !== "Escape" || !isOpen) return
        event.stopPropagation()
        setOpen(false)
        triggerRef.current?.querySelector<HTMLElement>("button, a, input, [tabindex]")?.focus()
      }}
      {...props}
    >
      <span
        ref={(node) => {
          triggerRef.current = node
          refs.setReference(node)
        }}
        onPointerEnter={hover(true)}
        className={cn("inline-flex", blocked && "[&>*]:cursor-not-allowed [&>*]:opacity-60")}
      >
        {trigger}
      </span>

      {/* Always present, so the reasons are read with the control even while the panel is closed. */}
      {blocked && (
        <span id={descriptionId} className="sr-only">
          {heading}: {list.map((reason) => reason.message).join(". ")}.
        </span>
      )}

      <FloatingPortal>
        <AnimatePresence>
          {isOpen && (
            <div ref={refs.setFloating} style={floatingStyles} className="z-50" onPointerEnter={hover(true)} onPointerLeave={hover(false)}>
              <motion.div
                data-side={above ? "top" : "bottom"}
                initial={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.94, y: above ? 6 : -6 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.97, y: above ? 3 : -3 }}
                transition={reduceMotion ? { duration: 0.12 } : { type: "spring", stiffness: 480, damping: 34, mass: 0.7 }}
                style={{ transformOrigin: `${align === "start" ? "0%" : "100%"} ${above ? "100%" : "0%"}` }}
                className="w-max max-w-(--dr-max,20rem) rounded-lg border bg-popover p-3 text-sm text-popover-foreground shadow-md"
              >
                <p className="flex items-center gap-1.5 font-medium">
                  <Lock aria-hidden className="size-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
                  {heading}
                </p>
                <ul className="mt-2 grid">
                  <AnimatePresence initial={false}>
                    {list.map((reason) => (
                      <motion.li
                        key={reason.id ?? reason.message}
                        layout={!reduceMotion}
                        initial={reduceMotion ? { opacity: 0 } : { opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={reduceMotion ? { opacity: 0 } : { opacity: 0, height: 0, x: 12 }}
                        transition={{ duration: reduceMotion ? 0.1 : 0.24, ease: [0.2, 0, 0, 1] }}
                        className="overflow-hidden"
                      >
                        <span className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 py-1 text-muted-foreground">
                          <span className="min-w-0">{reason.message}</span>
                          {reason.onAction && reason.actionLabel && (
                            <button
                              type="button"
                              className={fixClass}
                              onClick={() => {
                                setOpen(false)
                                reason.onAction?.()
                              }}
                            >
                              {reason.actionLabel}
                              <ArrowRight aria-hidden className="size-3" />
                            </button>
                          )}
                        </span>
                      </motion.li>
                    ))}
                  </AnimatePresence>
                </ul>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </FloatingPortal>
      <span aria-live="polite" className="sr-only">
        {announcement}
      </span>
    </span>
  )
}
