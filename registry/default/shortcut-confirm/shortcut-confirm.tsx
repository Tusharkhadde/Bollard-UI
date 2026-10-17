"use client"

// Bollard UI — shortcut-confirm · MIT licence · https://bollard-ui.vercel.app/components/shortcut-confirm

import * as React from "react"
import { Check, Keyboard, TriangleAlert } from "lucide-react"

import { cn } from "@/lib/utils"

export interface ParsedShortcut {
  mod: boolean
  shift: boolean
  alt: boolean
  /** Lower-cased `KeyboardEvent.key`, e.g. "backspace" or "d". */
  key: string
}

/** Parses "Mod+Shift+D". `Mod` is ⌘ on Apple platforms and Ctrl elsewhere. */
export function parseShortcut(shortcut: string): ParsedShortcut {
  const parts = shortcut.split("+").map((part) => part.trim().toLowerCase())
  const key = parts.pop() ?? ""
  return { mod: parts.includes("mod"), shift: parts.includes("shift"), alt: parts.includes("alt"), key }
}

/** Exact match: an extra modifier (a slipped Shift) does not count. Letters also match by physical key, so ⌘D still works on a Cyrillic or Greek layout. */
export function matchesShortcut(event: KeyboardEvent, shortcut: ParsedShortcut, apple: boolean) {
  const mod = apple ? event.metaKey : event.ctrlKey
  const other = apple ? event.ctrlKey : event.metaKey
  if (mod !== shortcut.mod || other || event.shiftKey !== shortcut.shift || event.altKey !== shortcut.alt) return false
  const key = event.key.toLowerCase()
  if (key === shortcut.key) return true
  return /^[a-z0-9]$/.test(shortcut.key) && event.code.toLowerCase() === (/\d/.test(shortcut.key) ? "digit" : "key") + shortcut.key
}

const appleKeys: Record<string, string> = { mod: "⌘", shift: "⇧", alt: "⌥", backspace: "⌫", delete: "⌦", enter: "↩" }

/** "⌘⇧D" on Apple platforms, "Ctrl+Shift+D" elsewhere. */
export function formatShortcut(shortcut: ParsedShortcut, apple: boolean) {
  const names = [shortcut.mod && "mod", shortcut.shift && "shift", shortcut.alt && "alt", shortcut.key].filter(Boolean) as string[]
  if (apple) return names.map((name) => appleKeys[name] ?? name.toUpperCase()).join("")
  const pc: Record<string, string> = { mod: "Ctrl", shift: "Shift", alt: "Alt" }
  return names.map((name) => pc[name] ?? name.charAt(0).toUpperCase() + name.slice(1)).join("+")
}

/** True where the keystroke belongs to text editing (Mod+Backspace deletes a word or line there). */
export function isEditableTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable) return true
  if (target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) return true
  return target instanceof HTMLInputElement && !["button", "checkbox", "radio", "submit", "reset", "range", "color"].includes(target.type)
}

export function isApplePlatform() {
  return /mac|iphone|ipad/i.test(navigator.platform || navigator.userAgent)
}

const MODIFIERS = new Set(["Shift", "Control", "Alt", "Meta", "CapsLock"])

export interface ShortcutConfirmProps extends Omit<React.ComponentProps<"div">, "children"> {
  /** The destructive chord, e.g. "Mod+Backspace" or "Mod+Shift+D". */
  shortcut: string
  /** Runs on the confirming second press. */
  onConfirm: () => void
  /** Ms the second press has to land in. */
  window?: number
  /** Listen only while this is true, e.g. when something is selected. */
  enabled?: boolean
  /** Also listen while typing in inputs and contenteditable. Off by default. */
  allowInInputs?: boolean
  /** What the shortcut does, used in every message, e.g. "delete 3 items". */
  action: string
  /** Templates: `{keys}` and `{action}` are filled in. */
  idleText?: string
  /** Prompt after the first press. `{shortcut}` and `{action}` are filled in. */
  armedText?: string
  /** Shown after the action is confirmed. */
  doneText?: string
}

const fill = (template: string, values: Record<string, string>) =>
  template.replace(/\{(\w+)\}/g, (match, key: string) => values[key] ?? match)

/**
 * Guards a destructive shortcut so a slip of the fingers can't fire it. The
 * first press only arms it and shows "Press ⌘⌫ again to delete 3 items" with a
 * draining bar; a second, separate press within the window confirms. Auto-repeat
 * from a held chord, an extra modifier, any other key in between, Escape, IME
 * composition and focus in a text field all keep it from firing.
 */
export function ShortcutConfirm({
  shortcut,
  onConfirm,
  window: windowMs = 2000,
  enabled = true,
  allowInInputs = false,
  action,
  idleText = "{keys} twice to {action}",
  armedText = "Press {keys} again to {action}",
  doneText = "Done: {action}",
  className,
  ...props
}: ShortcutConfirmProps) {
  const [phase, setPhase] = React.useState<"idle" | "armed" | "done">("idle")
  const [apple, setApple] = React.useState(false)
  const [draining, setDraining] = React.useState(false)
  const released = React.useRef(true)
  const phaseRef = React.useRef(phase)
  const confirm = React.useRef(onConfirm)
  const parsed = React.useMemo(() => parseShortcut(shortcut), [shortcut])

  React.useEffect(() => {
    confirm.current = onConfirm
    phaseRef.current = phase
  })
  React.useEffect(() => setApple(isApplePlatform()), [])

  React.useEffect(() => {
    if (!enabled) return setPhase("idle")
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.isComposing || event.keyCode === 229) return
      if (!allowInInputs && isEditableTarget(event.target)) return
      if (!matchesShortcut(event, parsed, apple)) {
        // Escape or any other key between the two presses means it wasn't a deliberate double press.
        if (!MODIFIERS.has(event.key)) setPhase((current) => (current === "armed" ? "idle" : current))
        return
      }
      event.preventDefault()
      // Some Linux setups send auto-repeat as fresh keydown/keyup pairs, so elsewhere the key must also come
      // back up first. macOS never sends keyup for keys pressed while ⌘ is held, but its `repeat` is reliable.
      if (event.repeat || (!apple && !released.current)) return
      released.current = false
      const next = phaseRef.current === "armed" ? "done" : "armed"
      phaseRef.current = next
      setPhase(next)
      if (next === "done") confirm.current()
    }
    const onKeyUp = (event: KeyboardEvent) => {
      if (!MODIFIERS.has(event.key)) released.current = true
    }
    const reset = () => {
      released.current = true
      setPhase((current) => (current === "armed" ? "idle" : current))
    }
    document.addEventListener("keydown", onKeyDown)
    document.addEventListener("keyup", onKeyUp)
    window.addEventListener("blur", reset)
    return () => {
      document.removeEventListener("keydown", onKeyDown)
      document.removeEventListener("keyup", onKeyUp)
      window.removeEventListener("blur", reset)
    }
  }, [enabled, allowInInputs, parsed, apple])

  React.useEffect(() => {
    if (phase === "idle") return
    let frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => setDraining(true))
    })
    const timer = setTimeout(() => setPhase("idle"), phase === "armed" ? windowMs : 1600)
    return () => {
      cancelAnimationFrame(frame)
      clearTimeout(timer)
      setDraining(false)
    }
  }, [phase, windowMs])

  const keys = formatShortcut(parsed, apple)
  const values = { keys, action }
  const text = fill(phase === "armed" ? armedText : phase === "done" ? doneText : idleText, values)
  const [before, after] = text.split(keys)
  const Icon = phase === "armed" ? TriangleAlert : phase === "done" ? Check : Keyboard

  return (
    <div
      data-slot="shortcut-confirm"
      data-state={phase}
      aria-live="polite"
      className={cn(
        "relative flex min-h-8 items-center gap-1.5 overflow-hidden rounded-md px-2 text-xs transition-colors",
        phase === "idle" && "text-muted-foreground",
        phase === "armed" && "bg-amber-500/10 text-amber-800 dark:text-amber-300",
        phase === "done" && "text-emerald-700 dark:text-emerald-400",
        !enabled && "opacity-50",
        className,
      )}
      {...props}
    >
      <Icon aria-hidden className="size-3.5 shrink-0" />
      <span>
        {before}
        {after !== undefined && (
          <kbd className="mx-0.5 rounded border border-current/25 bg-background/60 px-1 py-px font-sans font-medium">{keys}</kbd>
        )}
        {after}
      </span>
      <span
        aria-hidden
        className="absolute inset-x-0 bottom-0 h-0.5 origin-left bg-amber-500/70 ease-linear"
        style={{
          opacity: phase === "armed" ? 1 : 0,
          transform: `scaleX(${draining ? 0 : 1})`,
          transitionProperty: draining ? "transform" : "none",
          transitionDuration: `${windowMs}ms`,
        }}
      />
    </div>
  )
}
