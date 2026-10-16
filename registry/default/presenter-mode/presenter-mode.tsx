"use client"

import * as React from "react"
import { EyeOff, ScreenShare } from "lucide-react"

import { cn } from "@/lib/utils"

/** Banner layout shared by every Bollard UI banner: one height, padding, icon size and action style. */
const bar = "flex min-h-11 flex-wrap items-center gap-x-3 gap-y-1.5 px-3 py-1.5 text-sm"
const action =
  "inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-md px-3 text-sm font-medium whitespace-nowrap outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50"
const tones = {
  warning: {
    surface: "border-amber-500/30 bg-background bg-linear-to-r from-amber-500/10 to-amber-500/10 text-amber-950 dark:text-amber-50",
    icon: "text-amber-600 dark:text-amber-400",
    muted: "text-amber-900/75 dark:text-amber-100/75",
    solid: "bg-amber-700 text-white hover:bg-amber-800 dark:bg-amber-400 dark:text-amber-950 dark:hover:bg-amber-300",
    outline: "border border-amber-700/25 hover:bg-amber-500/15 dark:border-amber-300/25",
  },
  success: {
    surface: "border-emerald-500/30 bg-background bg-linear-to-r from-emerald-500/10 to-emerald-500/10 text-emerald-950 dark:text-emerald-50",
    icon: "text-emerald-600 dark:text-emerald-400",
    muted: "text-emerald-900/75 dark:text-emerald-100/75",
    solid: "bg-emerald-700 text-white hover:bg-emerald-800 dark:bg-emerald-400 dark:text-emerald-950 dark:hover:bg-emerald-300",
    outline: "border border-emerald-700/25 hover:bg-emerald-500/15 dark:border-emerald-300/25",
  },
} as const

export type SensitiveKind = "email" | "amount" | "key" | "text"

/** Fixed-length masks, so the hidden value's length isn't given away either. */
export const defaultMasks: Record<SensitiveKind, string> = { email: "•••••@•••••", amount: "••••••", key: "••••••••••••", text: "••••••" }

interface PresenterState {
  presenting: boolean
  setPresenting: (value: boolean) => void
  /** This tab started a screen share that is still running. */
  sharing: boolean
  suggested: boolean
  dismissSuggestion: () => void
  hiddenCount: number
  register: () => () => void
}

const PresenterContext = React.createContext<PresenterState | null>(null)

export function usePresenterMode() {
  const state = React.useContext(PresenterContext)
  if (!state) throw new Error("usePresenterMode must be used inside <PresenterModeProvider>")
  return state
}

export interface PresenterModeProviderProps {
  /** Controlled presenting state. */
  value?: boolean
  defaultValue?: boolean
  onValueChange?: (presenting: boolean) => void
  /** Offer presenter mode when this tab starts sharing via `getDisplayMedia`. */
  detectScreenShare?: boolean
  children: React.ReactNode
}

/**
 * Holds presenter mode for everything inside it. While `detectScreenShare` is
 * on, it wraps `navigator.mediaDevices.getDisplayMedia` (restored on unmount),
 * so a share started from this tab raises a suggestion, and the share ending
 * withdraws it.
 */
export function PresenterModeProvider({ value, defaultValue = false, onValueChange, detectScreenShare = true, children }: PresenterModeProviderProps) {
  const [inner, setInner] = React.useState(defaultValue)
  const [sharing, setSharing] = React.useState(false)
  const [suggested, setSuggested] = React.useState(false)
  const [hiddenCount, setHiddenCount] = React.useState(0)
  const presenting = value ?? inner

  const setPresenting = React.useCallback(
    (next: boolean) => {
      if (value === undefined) setInner(next)
      setSuggested(false)
      onValueChange?.(next)
    },
    [value, onValueChange],
  )

  React.useEffect(() => {
    const media = detectScreenShare ? navigator.mediaDevices : undefined
    const original = media?.getDisplayMedia
    if (!media || !original) return
    const wrapped: typeof original = async function (this: MediaDevices, ...args) {
      const stream = await original.apply(this, args)
      setSharing(true)
      setSuggested(true)
      const ended = () => {
        if (stream.getVideoTracks().every((track) => track.readyState === "ended")) {
          setSharing(false)
          setSuggested(false)
        }
      }
      stream.getVideoTracks().forEach((track) => track.addEventListener("ended", ended))
      return stream
    }
    media.getDisplayMedia = wrapped
    return () => {
      if (media.getDisplayMedia === wrapped) media.getDisplayMedia = original
    }
  }, [detectScreenShare])

  const register = React.useCallback(() => {
    setHiddenCount((count) => count + 1)
    return () => setHiddenCount((count) => count - 1)
  }, [])

  const state = React.useMemo<PresenterState>(
    () => ({ presenting, setPresenting, sharing, suggested: suggested && !presenting, dismissSuggestion: () => setSuggested(false), hiddenCount, register }),
    [presenting, setPresenting, sharing, suggested, hiddenCount, register],
  )
  return <PresenterContext.Provider value={state}>{children}</PresenterContext.Provider>
}

export interface SensitiveProps extends React.ComponentProps<"span"> {
  /** Picks the default mask. */
  kind?: SensitiveKind
  /** Custom mask text. */
  mask?: string
  /** How long to hold before the value shows, in ms, so a stray click never flashes it to viewers. */
  peekDelay?: number
  /** Accessible name while masked. `{kind}` is filled in. */
  maskedLabel?: string
}

/** Marks a value to hide while presenting. Masked, the real value is not in the DOM at all; hold to peek. */
export function Sensitive({ kind = "text", mask, peekDelay = 250, maskedLabel = "Hidden {kind}. Hold to peek.", className, children, ...props }: SensitiveProps) {
  const { presenting, register } = usePresenterMode()
  const [holding, setHolding] = React.useState(false)
  const [peeking, setPeeking] = React.useState(false)

  React.useEffect(() => (presenting ? register() : undefined), [presenting, register])
  React.useEffect(() => {
    if (!holding) return setPeeking(false)
    const timer = setTimeout(() => setPeeking(true), peekDelay)
    return () => clearTimeout(timer)
  }, [holding, peekDelay])
  React.useEffect(() => setHolding(false), [presenting])

  if (!presenting) return <span data-slot="sensitive" className={className} {...props}>{children}</span>
  const hold = (on: boolean) => () => {
    setHolding(on)
    if (!on) setPeeking(false)
  }

  return (
    <span
      data-slot="sensitive"
      data-state={peeking ? "peeking" : "masked"}
      role="button"
      tabIndex={0}
      aria-label={peeking ? undefined : maskedLabel.replace("{kind}", kind)}
      onPointerDown={hold(true)}
      onPointerUp={hold(false)}
      onPointerLeave={hold(false)}
      onPointerCancel={hold(false)}
      onContextMenu={(event) => event.preventDefault()}
      onKeyDown={(event) => {
        if (event.key !== " " && event.key !== "Enter") return
        event.preventDefault()
        setHolding(true)
      }}
      onKeyUp={hold(false)}
      onBlur={hold(false)}
      className={cn(
        "relative inline-block cursor-pointer touch-none rounded-sm px-0.5 align-baseline select-none outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
        peeking ? "bg-amber-500/15 ring-1 ring-amber-500/50" : "bg-muted text-muted-foreground",
        className,
      )}
      {...props}
    >
      {peeking ? children : mask ?? defaultMasks[kind]}
      <span
        aria-hidden
        className="absolute inset-x-0 bottom-0 h-0.5 origin-left rounded-full bg-amber-500 ease-out motion-reduce:hidden"
        style={{ transform: `scaleX(${holding ? 1 : 0})`, transition: holding && !peeking ? `transform ${peekDelay}ms` : "none", opacity: holding && !peeking ? 1 : 0 }}
      />
    </span>
  )
}

export interface PresentingBarProps extends Omit<React.ComponentProps<"div">, "children"> {
  /** `{count}` is "4 values". */
  presentingText?: string
  hintText?: string
  stopLabel?: string
  suggestText?: string
  suggestHint?: string
  hideLabel?: string
  notNowLabel?: string
}

/** The visible "Presenting" bar, and the suggestion shown when a screen share starts. Renders nothing otherwise. */
export function PresentingBar({
  presentingText = "Presenting · {count} hidden",
  hintText = "Hold a value to peek. Viewers see it too.",
  stopLabel = "Stop presenting",
  suggestText = "You're sharing your screen.",
  suggestHint = "Hide emails, amounts and keys while you share?",
  hideLabel = "Hide them",
  notNowLabel = "Not now",
  className,
  ...props
}: PresentingBarProps) {
  const { presenting, setPresenting, suggested, dismissSuggestion, hiddenCount } = usePresenterMode()
  if (!presenting && !suggested) return null
  const tone = presenting ? tones.success : tones.warning
  const count = `${hiddenCount} ${hiddenCount === 1 ? "value" : "values"}`

  return (
    <div
      data-slot="presenting-bar"
      data-state={presenting ? "presenting" : "suggested"}
      role="status"
      className={cn(bar, "rounded-lg border motion-safe:animate-[cui-presenter-mode-in_220ms_ease-out]", tone.surface, className)}
      {...props}
    >
      <style>{`@keyframes cui-presenter-mode-in{from{opacity:0;transform:translateY(-4px)}}`}</style>
      <div className="flex min-w-0 flex-1 basis-52 items-start gap-3 py-1">
        {presenting ? (
          <span aria-hidden className="relative mt-1.5 flex size-2 shrink-0">
            <span className="absolute inset-0 rounded-full bg-emerald-500 motion-safe:animate-pulse" />
          </span>
        ) : (
          <ScreenShare aria-hidden className={cn("mt-0.5 size-4 shrink-0", tone.icon)} />
        )}
        <p className="min-w-0">
          <span className="font-medium">{presenting ? presentingText.replace("{count}", count) : suggestText}</span>{" "}
          <span className={tone.muted}>{presenting ? hintText : suggestHint}</span>
        </p>
      </div>
      <div className="ml-auto flex gap-2">
        {presenting ? (
          <button type="button" onClick={() => setPresenting(false)} className={cn(action, tone.outline)}>{stopLabel}</button>
        ) : (
          <>
            <button type="button" onClick={dismissSuggestion} className={cn(action, tone.outline)}>{notNowLabel}</button>
            <button type="button" onClick={() => setPresenting(true)} className={cn(action, tone.solid)}>
              <EyeOff aria-hidden className="size-4" />
              {hideLabel}
            </button>
          </>
        )}
      </div>
    </div>
  )
}

export interface PresenterToggleProps extends Omit<React.ComponentProps<"button">, "onClick"> {
  label?: string
}

/** A switch for turning presenter mode on and off by hand. */
export function PresenterToggle({ label = "Presenter mode", className, ...props }: PresenterToggleProps) {
  const { presenting, setPresenting } = usePresenterMode()
  return (
    <button
      type="button"
      role="switch"
      aria-checked={presenting}
      data-slot="presenter-toggle"
      onClick={() => setPresenting(!presenting)}
      className={cn("group inline-flex h-8 items-center gap-2 rounded-md px-2 text-sm font-medium outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50", className)}
      {...props}
    >
      <span className="relative h-5 w-9 rounded-full bg-input transition-colors group-aria-checked:bg-primary">
        <span className="absolute top-0.5 left-0.5 size-4 rounded-full bg-background shadow-xs transition-transform duration-200 ease-out group-aria-checked:translate-x-4 motion-reduce:transition-none" />
      </span>
      {label}
    </button>
  )
}
