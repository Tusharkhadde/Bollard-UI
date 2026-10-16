"use client"

// Bollard UI — click-shield · MIT licence · https://bollard-ui.vercel.app/components/click-shield

import * as React from "react"

import { cn } from "@/lib/utils"

/** Why the shield went up: the target just mounted, shifted, relabelled, the tab came back, or focus was moved onto it by code. */
export type ShieldReason = "appeared" | "moved" | "changed" | "returned" | "focused"

export interface ClickShieldOptions {
  /** How long clicks are ignored after a change, in ms. Chrome's dialog guard uses 500. */
  duration?: number
  /** Turn the shield off entirely. */
  enabled?: boolean
  /** Called for every click the shield swallowed, with the reason it was up. */
  onBlockedClick?: (reason: ShieldReason) => void
}

/** Pixels an element may drift (subpixel layout, zoom) before it counts as moved. */
const MOVE_TOLERANCE = 2
/** A focus that follows a Tab, arrow key or pointer press within this many ms was the user's own. */
const USER_FOCUS_WINDOW = 400

const NAV_KEYS = new Set(["Tab", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Home", "End"])

/**
 * Ignores pointer clicks on `ref` for `duration` ms after it appears, moves
 * (not counting scrolls), changes its label, or the tab becomes visible again.
 * A press that *started* inside the window is ignored even if released after it.
 *
 * Keyboard users aim with focus, not a cursor, so moves and relabels never block
 * them. Their one trap is a dialog that steals focus onto a button while they are
 * mid-keystroke, so Enter/Space are only shielded right after code (not the user)
 * moved focus there, and a held Enter's auto-repeat never activates.
 */
export function useClickShield(
  ref: React.RefObject<HTMLElement | null>,
  { duration = 500, enabled = true, onBlockedClick }: ClickShieldOptions = {},
) {
  const [reason, setReason] = React.useState<ShieldReason | null>(null)
  const until = React.useRef(0)
  const reasonRef = React.useRef<ShieldReason>("appeared")
  const pressShielded = React.useRef(false)
  const focus = React.useRef({ at: -Infinity, byUser: true })
  const userInputAt = React.useRef(-Infinity)
  const timer = React.useRef<ReturnType<typeof setTimeout>>(undefined)

  const raise = React.useCallback(
    (next: ShieldReason) => {
      until.current = performance.now() + duration
      reasonRef.current = next
      setReason(next)
      clearTimeout(timer.current)
      timer.current = setTimeout(() => setReason(null), duration)
    },
    [duration],
  )

  React.useEffect(() => {
    const el = ref.current
    if (!enabled || !el) return
    raise("appeared")

    // Positions are polled per frame: nothing else reports a shift caused by content elsewhere on the page.
    let scrolledAt = -Infinity
    let last = el.getBoundingClientRect()
    let frame = requestAnimationFrame(function tick() {
      const rect = el.getBoundingClientRect()
      const moved = Math.abs(rect.left - last.left) > MOVE_TOLERANCE || Math.abs(rect.top - last.top) > MOVE_TOLERANCE
      if (moved && performance.now() - scrolledAt > 100) raise("moved")
      last = rect
      frame = requestAnimationFrame(tick)
    })

    let label = el.textContent
    const observer = new MutationObserver(() => {
      if (el.textContent === label) return
      label = el.textContent
      raise("changed")
    })
    observer.observe(el, { subtree: true, childList: true, characterData: true })

    const onScroll = () => (scrolledAt = performance.now())
    const onVisible = () => document.visibilityState === "visible" && raise("returned")
    const onUserInput = (event: Event) => {
      if (event.type === "pointerdown" || NAV_KEYS.has((event as KeyboardEvent).key)) userInputAt.current = performance.now()
    }
    document.addEventListener("scroll", onScroll, { capture: true, passive: true })
    document.addEventListener("visibilitychange", onVisible)
    document.addEventListener("keydown", onUserInput, true)
    document.addEventListener("pointerdown", onUserInput, true)
    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      clearTimeout(timer.current)
      document.removeEventListener("scroll", onScroll, true)
      document.removeEventListener("visibilitychange", onVisible)
      document.removeEventListener("keydown", onUserInput, true)
      document.removeEventListener("pointerdown", onUserInput, true)
    }
  }, [ref, enabled, raise])

  const handlers = {
    onPointerDownCapture: () => {
      pressShielded.current = enabled && performance.now() < until.current
    },
    onFocusCapture: () => {
      const now = performance.now()
      const byUser = now - userInputAt.current < USER_FOCUS_WINDOW
      focus.current = { at: now, byUser }
      if (enabled && !byUser) raise("focused")
    },
    onKeyDownCapture: (event: React.KeyboardEvent) => {
      // A held Enter clicks on every auto-repeat; only a fresh press may activate.
      if (enabled && event.repeat && (event.key === "Enter" || event.key === " ")) event.preventDefault()
    },
    onClickCapture: (event: React.MouseEvent) => {
      if (!enabled) return
      const now = performance.now()
      const keyboard = event.detail === 0
      const blocked = keyboard
        ? !focus.current.byUser && now - focus.current.at < duration
        : pressShielded.current || now < until.current
      pressShielded.current = false
      if (!blocked) return
      event.preventDefault()
      event.stopPropagation()
      onBlockedClick?.(keyboard ? "focused" : reasonRef.current)
    },
  }

  return { shielded: reason !== null, reason, handlers }
}

export interface ClickShieldProps extends ClickShieldOptions, React.ComponentProps<"span"> {}

/**
 * Wrap a button (or a group of them) so a click meant for something else can't
 * land on it: when a banner loads above it, a popup opens under the cursor or
 * its label flips from "Save" to "Delete", clicks are ignored for ~500ms while
 * it fades back in. See `useClickShield` for how keyboard users are treated.
 */
export function ClickShield({ duration, enabled, onBlockedClick, className, children, ref: forwarded, ...props }: ClickShieldProps) {
  const ref = React.useRef<HTMLSpanElement>(null)
  React.useImperativeHandle(forwarded, () => ref.current as HTMLSpanElement)
  const { shielded, reason, handlers } = useClickShield(ref, { duration, enabled, onBlockedClick })

  return (
    <span
      ref={ref}
      data-slot="click-shield"
      data-shielded={shielded || undefined}
      data-reason={reason ?? undefined}
      className={cn(
        "inline-flex [&>*]:transition-[opacity,filter] [&>*]:duration-300",
        shielded && "[&>*]:opacity-60 [&>*]:saturate-50 [&>*]:duration-0",
        className,
      )}
      {...props}
      {...handlers}
    >
      {children}
    </span>
  )
}
