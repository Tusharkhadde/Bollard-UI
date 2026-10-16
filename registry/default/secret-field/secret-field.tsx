"use client"

import * as React from "react"
import { Check, Copy, Eye, EyeOff } from "lucide-react"

import { cn } from "@/lib/utils"

/** The readable prefix of a key ("sk_live_", "ghp_"), or "" when there isn't one. */
export function secretPrefix(value: string) {
  const prefix = value.match(/^[a-z]+(?:_[a-z]+)*_/i)?.[0] ?? ""
  return prefix.length <= 16 && value.length - prefix.length >= 8 ? prefix : ""
}

/** "live" or "test" when the prefix says so (sk_live_, pk_test_ ...), otherwise undefined. */
export function secretMode(value: string): "live" | "test" | undefined {
  const prefix = secretPrefix(value).toLowerCase()
  return /(^|_)(live|prod)_/.test(prefix) ? "live" : /(^|_)(test|sandbox|dev)_/.test(prefix) ? "test" : undefined
}

/** Masks a secret but keeps its prefix and last few characters, so keys stay tellable apart. Short values are fully hidden. */
export function maskSecret(value: string, visibleTail = 4) {
  const prefix = secretPrefix(value)
  const rest = value.length - prefix.length
  const tail = rest >= visibleTail * 3 ? visibleTail : 0
  const dots = Math.max(4, Math.min(16, rest - tail))
  return `${prefix}${"•".repeat(dots)}${tail ? value.slice(-tail) : ""}`
}

export interface SecretFieldProps extends Omit<React.ComponentProps<"div">, "children"> {
  /** The secret itself, e.g. an API key. */
  value: string
  /** Visible label. */
  label?: string
  /** Allow the user to reveal the full value. */
  revealable?: boolean
  /** Controlled reveal state. */
  revealed?: boolean
  /** Initial reveal state when uncontrolled. */
  defaultRevealed?: boolean
  /** Called when the value is revealed or re-masked. */
  onRevealedChange?: (revealed: boolean) => void
  /** Re-mask after this many ms. 0 disables. The value also re-masks when the tab is hidden. */
  autoHide?: number
  /** Trailing characters left visible while masked. */
  visibleTail?: number
  /** Accessible names for the buttons and feedback. */
  revealLabel?: string
  hideLabel?: string
  copyLabel?: string
  copiedLabel?: string
  copyFailedLabel?: string
  /** Shown when someone copies the masked dots by hand and gets the real key instead. */
  copiedMaskedLabel?: string
  /** Pill text for live and test keys. */
  liveLabel?: string
  testLabel?: string
}

type Feedback = "copied" | "masked" | "failed"

/**
 * A read-only field for API keys and tokens. Masked by default with the
 * prefix kept, so people can tell `sk_live_` from `sk_test_` (flagged with a
 * pill), and it re-masks on a timer or when the tab is hidden. The twist:
 * selecting the dots and pressing Ctrl+C copies the real key, not
 * "sk_live_••••", so nobody pastes a masked key into their config.
 */
export function SecretField({
  value,
  label = "API key",
  revealable = true,
  revealed: revealedProp,
  defaultRevealed = false,
  onRevealedChange,
  autoHide = 10_000,
  visibleTail = 4,
  revealLabel = "Reveal",
  hideLabel = "Hide",
  copyLabel = "Copy",
  copiedLabel = "Copied",
  copyFailedLabel = "Couldn't copy. Reveal and select it instead.",
  copiedMaskedLabel = "Copied the full key, not the dots",
  liveLabel = "Live",
  testLabel = "Test",
  className,
  ...props
}: SecretFieldProps) {
  const [revealedState, setRevealedState] = React.useState(defaultRevealed)
  const revealed = revealable && (revealedProp ?? revealedState)
  const [feedback, setFeedback] = React.useState<Feedback>()
  const id = React.useId()
  const mode = secretMode(value)

  const setRevealed = React.useCallback(
    (next: boolean) => {
      if (revealedProp === undefined) setRevealedState(next)
      onRevealedChange?.(next)
    },
    [revealedProp, onRevealedChange],
  )

  React.useEffect(() => {
    if (!revealed) return
    const timer = autoHide > 0 ? setTimeout(() => setRevealed(false), autoHide) : undefined
    const onVisibility = () => document.hidden && setRevealed(false)
    document.addEventListener("visibilitychange", onVisibility)
    return () => {
      clearTimeout(timer)
      document.removeEventListener("visibilitychange", onVisibility)
    }
  }, [revealed, autoHide, setRevealed])

  React.useEffect(() => {
    if (!feedback) return
    const timer = setTimeout(() => setFeedback(undefined), feedback === "copied" ? 1800 : 3500)
    return () => clearTimeout(timer)
  }, [feedback])

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value)
      setFeedback("copied")
    } catch {
      setFeedback("failed")
    }
  }

  // Copying the masked text by hand would put bullets on the clipboard. Hand over the real value.
  const onCopy = (event: React.ClipboardEvent<HTMLInputElement>) => {
    if (revealed) return
    event.preventDefault()
    event.clipboardData.setData("text/plain", value)
    setFeedback("masked")
  }

  const iconButton =
    "inline-flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
  const message = feedback === "masked" ? copiedMaskedLabel : feedback === "failed" ? copyFailedLabel : feedback ? copiedLabel : ""

  return (
    <div data-slot="secret-field" className={cn("w-full max-w-md", className)} {...props}>
      <div className="flex items-center gap-2">
        <label htmlFor={id} className="text-sm font-medium">
          {label}
        </label>
        {mode && (
          <span
            className={cn(
              "rounded-full px-1.5 py-px text-[11px] leading-4 font-semibold",
              mode === "live" ? "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300" : "bg-muted text-muted-foreground",
            )}
          >
            {mode === "live" ? liveLabel : testLabel}
          </span>
        )}
      </div>
      <div className="mt-1.5 flex h-9 items-center gap-0.5 rounded-md border bg-transparent pr-1 shadow-xs focus-within:ring-[3px] focus-within:ring-ring/50 dark:bg-input/30">
        <input
          id={id}
          readOnly
          value={revealed ? value : maskSecret(value, visibleTail)}
          onCopy={onCopy}
          onFocus={(event) => event.currentTarget.select()}
          spellCheck={false}
          autoComplete="off"
          aria-description={revealed ? undefined : "Hidden"}
          className="h-full min-w-0 flex-1 truncate bg-transparent pl-3 font-mono text-sm tracking-tight outline-none"
        />
        {revealable && (
          <button
            type="button"
            onClick={() => setRevealed(!revealed)}
            aria-label={revealed ? hideLabel : revealLabel}
            aria-pressed={revealed}
            aria-controls={id}
            className={iconButton}
          >
            {revealed ? <EyeOff aria-hidden className="size-4" /> : <Eye aria-hidden className="size-4" />}
          </button>
        )}
        <button
          type="button"
          onClick={() => void copy()}
          aria-label={copyLabel}
          className={cn(iconButton, feedback === "copied" && "text-emerald-600 dark:text-emerald-400")}
        >
          {feedback === "copied" ? <Check aria-hidden className="size-4" /> : <Copy aria-hidden className="size-4" />}
        </button>
      </div>
      <p
        aria-live="polite"
        className={cn("mt-1.5 min-h-4 text-xs", feedback === "failed" ? "text-destructive" : "text-emerald-700 dark:text-emerald-400")}
      >
        {message}
      </p>
    </div>
  )
}
