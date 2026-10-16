"use client"

// Bollard UI — safe-submit · MIT licence · https://bollard-ui.vercel.app/components/safe-submit

import * as React from "react"
import { Check, CircleAlert, LoaderCircle, RotateCw } from "lucide-react"

import { cn } from "@/lib/utils"

/** A v4 UUID, with fallbacks for older browsers and non-secure (http) origins. */
export function createIdempotencyKey(): string {
  const c = globalThis.crypto
  if (c?.randomUUID) return c.randomUUID()
  const bytes = new Uint8Array(16)
  if (c?.getRandomValues) c.getRandomValues(bytes)
  else for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256)
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

/** Network failures, timeouts and 408/429/5xx: the server may or may not have acted, so retry with the same key. */
export function isRetryableError(error: unknown) {
  if (error instanceof TypeError) return true // fetch() rejects with TypeError when the network fails
  if (!(error instanceof Error)) return false
  const { status, retryable } = error as Error & { status?: number; retryable?: boolean }
  if (retryable !== undefined) return retryable
  if (error.name === "AbortError" || error.name === "TimeoutError") return true
  return status !== undefined && [408, 425, 429, 500, 502, 503, 504].includes(status)
}

export type ActionStatus = "idle" | "pending" | "success" | "error"

export interface IdempotentActionOptions {
  /** Ignore new attempts for this long after one settles, in ms (catches double-taps). */
  cooldown?: number
  /** Decides whether a failure keeps the key for a safe retry. */
  isRetryable?: (error: unknown) => boolean
}

/**
 * Runs an action at most once at a time and hands it an idempotency key per
 * logical attempt. A retry after a network error reuses the key, so the
 * server can dedupe; a success or a definite rejection mints a fresh one.
 */
export function useIdempotentAction<A extends unknown[]>(
  action: (idempotencyKey: string, ...args: A) => Promise<unknown>,
  { cooldown = 400, isRetryable = isRetryableError }: IdempotentActionOptions = {},
) {
  const [status, setStatus] = React.useState<ActionStatus>("idle")
  const [error, setError] = React.useState<unknown>()
  const [retrySafe, setRetrySafe] = React.useState(false)
  const locked = React.useRef(false)
  const settledAt = React.useRef(0)
  const key = React.useRef<string>(undefined)

  const run = React.useCallback(
    async (...args: A) => {
      // Synchronous guard: checked before any await, so same-frame clicks and Enter spam can't slip through.
      if (locked.current || Date.now() - settledAt.current < cooldown) return
      locked.current = true
      key.current ??= createIdempotencyKey()
      setStatus("pending")
      setError(undefined)
      try {
        await action(key.current, ...args)
        key.current = undefined
        setStatus("success")
      } catch (err) {
        const safe = isRetryable(err)
        if (!safe) key.current = undefined
        setRetrySafe(safe)
        setError(err)
        setStatus("error")
      } finally {
        locked.current = false
        settledAt.current = Date.now()
      }
    },
    [action, cooldown, isRetryable],
  )

  const reset = React.useCallback(() => {
    key.current = undefined
    setStatus("idle")
    setError(undefined)
  }, [])

  return { run, status, error, retrySafe, reset }
}

const variants = {
  default: "bg-primary text-primary-foreground hover:bg-primary/90",
  destructive: "bg-destructive text-white hover:bg-destructive/90 dark:bg-destructive/60 dark:hover:bg-destructive/70",
  outline:
    "border bg-background text-foreground hover:bg-accent dark:border-input dark:bg-input/30 dark:hover:bg-input/50",
} as const
const sizes = { default: "h-9 px-4", sm: "h-8 px-3" } as const

export interface SafeSubmitProps extends Omit<React.ComponentProps<"button">, "onSubmit" | "onClick" | "type"> {
  /** Does the work. Send `idempotencyKey` as an `Idempotency-Key` header. `formData` is the enclosing form's data. */
  onSubmit: (submission: { idempotencyKey: string; formData?: FormData }) => Promise<unknown>
  /** Visual style of the button. */
  variant?: keyof typeof variants
  /** Size of the button. */
  size?: keyof typeof sizes
  /** Label while the request is in flight. */
  pendingLabel?: React.ReactNode
  /** Label shown briefly after success. */
  successLabel?: React.ReactNode
  /** Label after a failure. */
  retryLabel?: React.ReactNode
  /** Shown after a retryable failure (network, timeout, 5xx). */
  retrySafeHint?: React.ReactNode
  /** Shown after a definite rejection (validation, 4xx). */
  retryUnsafeHint?: React.ReactNode
  /** Fallback when the error has no message. */
  errorMessage?: string
  /** Milliseconds the success label stays before the button resets. */
  resetAfter?: number
  /** Ignore new attempts for this long after one settles, in ms. */
  cooldown?: number
  /** Decides whether a failure keeps the same key for a safe retry. */
  isRetryable?: (error: unknown) => boolean
}

/**
 * A submit button that can't double-charge. Repeated clicks, Enter spam and
 * double-taps collapse into one request, every logical attempt carries an
 * idempotency key, and "Retry" after a dropped connection reuses that key so
 * the server can recognise the repeat. It works inside a <form> (native
 * validation runs first) or on its own.
 */
export function SafeSubmit({
  onSubmit,
  variant = "default",
  size = "default",
  pendingLabel = "Submitting…",
  successLabel = "Done",
  retryLabel = "Retry",
  retrySafeHint = "Retrying is safe: it reuses the same request, so nothing happens twice.",
  retryUnsafeHint = "Fix the issue, then try again.",
  errorMessage = "Something went wrong",
  resetAfter = 2000,
  cooldown,
  isRetryable,
  className,
  children,
  ...props
}: SafeSubmitProps) {
  const submit = React.useCallback(
    (idempotencyKey: string, formData?: FormData) => onSubmit({ idempotencyKey, formData }),
    [onSubmit],
  )
  const { run, status, error, retrySafe, reset } = useIdempotentAction(submit, { cooldown, isRetryable })
  const errorId = React.useId()

  React.useEffect(() => {
    if (status !== "success" || resetAfter <= 0) return
    const timer = setTimeout(reset, resetAfter)
    return () => clearTimeout(timer)
  }, [status, reset, resetAfter])

  const pending = status === "pending"
  const message = (error instanceof Error && error.message ? error.message : errorMessage).replace(/[.!]+$/, "")

  return (
    <span data-slot="safe-submit" className="inline-flex flex-col items-start gap-1.5">
      <button
        type="submit"
        data-state={status}
        // aria-busy, not disabled: the button keeps focus and the guard swallows the extra clicks.
        aria-busy={pending || undefined}
        aria-describedby={status === "error" ? errorId : undefined}
        onClick={(event) => {
          const form = event.currentTarget.form
          if (form && !pending && !form.checkValidity()) return // let the browser show its validation
          event.preventDefault()
          void run(form ? new FormData(form) : undefined)
        }}
        className={cn(
          "inline-flex shrink-0 items-center justify-center rounded-md text-sm font-medium whitespace-nowrap shadow-xs outline-none transition-[color,background-color,box-shadow] focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 aria-busy:cursor-progress",
          variants[variant],
          sizes[size],
          className,
        )}
        {...props}
      >
        {/* All labels share one grid cell, so the button never changes width mid-request. */}
        <span className="grid">
          {(["idle", "pending", "success", "error"] as const).map((key) => (
            <span
              key={key}
              aria-hidden={status !== key || undefined}
              className={cn(
                "col-start-1 row-start-1 inline-flex items-center justify-center gap-2",
                status !== key && "invisible",
              )}
            >
              {key === "idle" && children}
              {key === "pending" && <LoaderCircle aria-hidden className="size-4 animate-spin" />}
              {key === "pending" && pendingLabel}
              {key === "success" && <Check aria-hidden className="size-4" />}
              {key === "success" && successLabel}
              {key === "error" && <RotateCw aria-hidden className="size-4" />}
              {key === "error" && retryLabel}
            </span>
          ))}
        </span>
      </button>
      {status === "error" && (
        <span id={errorId} role="alert" className="inline-flex items-start gap-1.5 text-xs text-destructive">
          <CircleAlert aria-hidden className="mt-px size-3.5 shrink-0" />
          <span>
            {message}. <span className="text-muted-foreground">{retrySafe ? retrySafeHint : retryUnsafeHint}</span>
          </span>
        </span>
      )}
    </span>
  )
}
