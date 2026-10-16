"use client"

import * as React from "react"
import { Check, ChevronRight, CircleX, Copy, LifeBuoy, LoaderCircle, RotateCw, Settings, TriangleAlert } from "lucide-react"

import { cn } from "@/lib/utils"

export type ErrorExplanation = {
  /** Short plain-language headline. */
  title: string
  /** What happened, without jargon. */
  meaning: string
  /** The likely cause, when it helps the person act. */
  cause?: string
  /** The best next step. */
  action: "retry" | "contact" | "fix"
  /** Label for a "fix" action, e.g. "Sign in again". */
  actionLabel?: string
  /** The request may have reached the server and finished anyway (timeouts, dropped connections, 502/504). */
  ambiguous?: boolean
}

/** Plain-language meanings for common HTTP statuses and network failures. Override or extend per product. */
export const DEFAULT_EXPLANATIONS: Record<string, ErrorExplanation> = {
  network: { title: "You're offline", meaning: "We couldn't reach our servers.", cause: "Your connection dropped or a network is blocking us.", action: "retry", ambiguous: true },
  timeout: { title: "That took too long", meaning: "We stopped waiting for an answer.", cause: "The server or your connection is slow right now.", action: "retry", ambiguous: true },
  "400": { title: "Something in the request was off", meaning: "We couldn't read part of what was sent.", cause: "Usually an outdated page or a bad link.", action: "fix", actionLabel: "Reload the page" },
  "401": { title: "You've been signed out", meaning: "Your session ended, so we couldn't confirm it's you.", action: "fix", actionLabel: "Sign in again" },
  "403": { title: "You don't have access", meaning: "Your account isn't allowed to do this.", cause: "An admin may need to give you permission.", action: "contact" },
  "404": { title: "We can't find that", meaning: "It may have been moved or deleted.", action: "fix", actionLabel: "Go back" },
  "409": { title: "Someone else changed this", meaning: "It was updated after you opened it.", action: "fix", actionLabel: "Reload and review" },
  "413": { title: "That's too large", meaning: "The file or request is over the size limit.", action: "fix", actionLabel: "Choose a smaller file" },
  "422": { title: "Some details need fixing", meaning: "We couldn't accept one or more of the values.", action: "fix", actionLabel: "Review the form" },
  "429": { title: "Too many tries", meaning: "We've paused requests from you for a moment.", cause: "Lots of attempts in a short time.", action: "retry" },
  "500": { title: "Something broke on our side", meaning: "It's not something you did.", action: "retry" },
  "502": { title: "We couldn't get an answer", meaning: "A server in the middle didn't respond properly.", cause: "Usually a brief outage.", action: "retry", ambiguous: true },
  "503": { title: "We're briefly unavailable", meaning: "The service is overloaded or under maintenance.", action: "retry" },
  "504": { title: "The server took too long", meaning: "We stopped waiting before it replied.", cause: "Usually a brief slowdown on our side.", action: "retry", ambiguous: true },
}

/** The explanation for a code: exact match, then its class (5xx → 500, 4xx → 400), then a generic fallback. */
export function explainError(code: string | number, catalog: Record<string, ErrorExplanation> = DEFAULT_EXPLANATIONS): ErrorExplanation {
  const key = String(code)
  if (catalog[key]) return catalog[key]
  if (/^5\d\d$/.test(key) && catalog["500"]) return catalog["500"]
  if (/^4\d\d$/.test(key) && catalog["400"]) return catalog["400"]
  return { title: "Something went wrong", meaning: "We couldn't finish that.", action: "contact" }
}

/** The block support needs to find this exact failure in their logs. */
export function supportReference(parts: { referenceId: string; code?: string | number; message?: string; occurredAt?: Date | number | string }) {
  const lines = [`Reference: ${parts.referenceId}`]
  if (parts.code !== undefined) lines.push(`Code: ${parts.code}`)
  if (parts.occurredAt !== undefined) lines.push(`Time: ${new Date(parts.occurredAt).toISOString()}`)
  if (parts.message) lines.push(`Message: ${parts.message}`)
  return lines.join("\n")
}

export interface ErrorExplainerProps extends Omit<React.ComponentProps<"div">, "children"> {
  /** Error code: an HTTP status, "network", "timeout" or your own key. */
  code: string | number
  /** The raw message from the system, shown under Technical details. */
  message?: string
  /** Overrides for the catalog entry (title, meaning, cause, action...). */
  explanation?: Partial<ErrorExplanation>
  /** Your own catalog of codes. */
  catalog?: Record<string, ErrorExplanation>
  /** Request or trace ID support can search for. */
  referenceId?: string
  /** When it failed. */
  occurredAt?: Date | number | string
  /** Stack trace or response body, hidden until asked for. */
  details?: string
  /** Retries the failed action. May return a Promise; a rejection counts as another failure. */
  onRetry?: () => void | Promise<unknown>
  /** Seconds to wait before retrying (from a Retry-After header). */
  retryAfter?: number
  /** False when repeating the action could do it twice (a payment, a send). Ambiguous failures then say to check first. */
  idempotent?: boolean
  /** Looks up whether the action actually went through, offered first when a retry might duplicate it. */
  onCheckStatus?: () => void
  /** Runs the "fix" action (sign in, open settings...). */
  onFix?: () => void
  /** Opens support. */
  onContact?: () => void
  /** Failed retries after which support is suggested instead. */
  maxRetries?: number
  /** Templates: `{seconds}` and `{count}` are filled in. */
  causeLabel?: string
  /** Retry button text. */
  retryLabel?: string
  /** Text for retrying despite an ambiguous outcome. */
  retryAnywayLabel?: string
  /** Text shown while waiting for Retry-After. */
  waitLabel?: string
  /** Text for the check-status button. */
  checkLabel?: string
  /** Text for the contact-support button. */
  contactLabel?: string
  /** Warning that the request may already have gone through. */
  ambiguousText?: string
  /** Shown after repeated failures. */
  stillFailingText?: string
  /** Label for the support reference. */
  referenceLabel?: string
  /** Text for the copy-reference button. */
  copyLabel?: string
  /** Shown after copying the reference. */
  copiedLabel?: string
  /** Visible text of the copy button (`copyLabel` is its accessible name). */
  copyText?: string
  /** Button text for a "fix" action without its own `actionLabel`. */
  fixLabel?: string
  /** Text for the technical-details toggle. */
  detailsLabel?: string
}

const fill = (t: string, v: Record<string, string | number>) => t.replace(/\{(\w+)\}/g, (m, k: string) => String(v[k] ?? m))
const btn =
  "inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-md px-3 text-sm font-medium whitespace-nowrap outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-60"
const solid = "bg-red-700 text-white hover:bg-red-800 dark:bg-red-400 dark:text-red-950 dark:hover:bg-red-300"
const outline = "border border-red-700/25 hover:bg-red-500/15 dark:border-red-300/25"

/**
 * Turns an error code into something a person can act on: what happened in plain words, the
 * likely cause and one clear next step, with the code and stack tucked behind "Technical
 * details". The reference copies as a support-ready block. Retry waits out Retry-After with a
 * draining countdown, gives up after a few tries, and when the failure is ambiguous (a timeout
 * on a payment) it says the action may have gone through and puts "Check status" first, so a
 * retry doesn't charge or send twice.
 */
export function ErrorExplainer({
  code, message, explanation, catalog, referenceId, occurredAt, details, onRetry, retryAfter = 0, idempotent = true,
  onCheckStatus, onFix, onContact, maxRetries = 3,
  causeLabel = "Likely cause:", retryLabel = "Try again", retryAnywayLabel = "Retry anyway", waitLabel = "Try again in {seconds}s",
  checkLabel = "Check status", contactLabel = "Contact support",
  ambiguousText = "This may have gone through before the error. Check first, or retrying could do it twice.",
  stillFailingText = "Still failing after {count} tries.", referenceLabel = "Reference", copyLabel = "Copy reference for support",
  copiedLabel = "Copied", copyText = "Copy", fixLabel = "Fix it", detailsLabel = "Technical details",
  className, ...props
}: ErrorExplainerProps) {
  const info = { ...explainError(code, catalog), ...explanation }
  const [failures, setFailures] = React.useState(0)
  const [pending, setPending] = React.useState(false)
  const [waitUntil, setWaitUntil] = React.useState<number>()
  const [now, setNow] = React.useState(0)
  const [copied, setCopied] = React.useState(false)
  const [time, setTime] = React.useState("")

  React.useEffect(() => {
    if (retryAfter > 0) setWaitUntil(Date.now() + retryAfter * 1000)
  }, [retryAfter])
  React.useEffect(() => {
    if (occurredAt !== undefined) setTime(new Date(occurredAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }))
  }, [occurredAt])
  React.useEffect(() => {
    if (!waitUntil) return
    setNow(Date.now())
    const id = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(id)
  }, [waitUntil])
  React.useEffect(() => {
    if (!copied) return
    const id = setTimeout(() => setCopied(false), 1500)
    return () => clearTimeout(id)
  }, [copied])

  const seconds = waitUntil ? Math.max(0, Math.ceil((waitUntil - now) / 1000)) : 0
  React.useEffect(() => {
    if (waitUntil && now >= waitUntil) setWaitUntil(undefined)
  }, [waitUntil, now])
  const risky = Boolean(info.ambiguous) && !idempotent
  const gaveUp = failures >= maxRetries
  const canRetry = info.action === "retry" && onRetry && !gaveUp

  const retry = async () => {
    setPending(true)
    try {
      await onRetry?.()
    } catch {
      setFailures((n) => n + 1)
    } finally {
      setPending(false)
    }
  }
  const copy = async () => {
    if (!referenceId) return
    try {
      await navigator.clipboard.writeText(supportReference({ referenceId, code, message, occurredAt }))
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }

  return (
    <div
      data-slot="error-explainer"
      data-state={risky ? "ambiguous" : gaveUp ? "gave-up" : "error"}
      className={cn("grid gap-3 rounded-lg border border-red-500/30 bg-background bg-linear-to-r from-red-500/10 to-red-500/10 p-3 text-sm text-red-950 dark:text-red-50", className)}
      {...props}
    >
      <div role="alert" className="flex gap-3">
        <CircleX aria-hidden className="mt-0.5 size-4 shrink-0 text-red-600 dark:text-red-400" />
        <div className="grid min-w-0 flex-1 gap-1">
          <p className="flex items-start justify-between gap-2 font-medium">
            <span className="min-w-0">{info.title}</span>
            <code className="mt-0.5 shrink-0 rounded-sm bg-red-500/10 px-1.5 font-mono text-xs font-normal text-red-900/75 dark:text-red-100/75">{code}</code>
          </p>
          <p className="text-red-900/75 dark:text-red-100/75">
            {info.meaning}
            {info.cause && (
              <>
                {" "}
                <span className="font-medium text-red-950 dark:text-red-50">{causeLabel}</span> {info.cause.charAt(0).toLowerCase() + info.cause.slice(1)}
              </>
            )}
          </p>
        </div>
      </div>

      <div aria-live="polite" className="empty:hidden">
        {risky && canRetry && (
          <p className="flex gap-1.5 text-xs text-amber-700 dark:text-amber-400">
            <TriangleAlert aria-hidden className="mt-px size-3.5 shrink-0" />
            {ambiguousText}
          </p>
        )}
        {failures > 0 && <p className="text-xs text-red-900/75 dark:text-red-100/75">{fill(stillFailingText, { count: failures + 1 })}</p>}
      </div>

      <div className="flex flex-wrap gap-2">
        {risky && canRetry && onCheckStatus && (
          <button type="button" onClick={onCheckStatus} className={cn(btn, solid)}>
            {checkLabel}
          </button>
        )}
        {canRetry && (
          <button
            type="button"
            onClick={retry}
            disabled={pending || seconds > 0}
            className={cn(btn, "relative overflow-hidden", risky && onCheckStatus ? outline : solid)}
          >
            {pending ? <LoaderCircle aria-hidden className="size-4 animate-spin" /> : <RotateCw aria-hidden className="size-4" />}
            {/* Not live: the countdown would be read out every second. */}
            <span>{seconds > 0 ? fill(waitLabel, { seconds }) : risky ? retryAnywayLabel : retryLabel}</span>
            {seconds > 0 && waitUntil && (
              <span
                aria-hidden
                className="absolute inset-x-0 bottom-0 h-0.5 origin-left bg-current/60 transition-transform duration-300 ease-linear motion-reduce:hidden"
                style={{ transform: `scaleX(${Math.max(0, (waitUntil - now) / (retryAfter * 1000))})` }}
              />
            )}
          </button>
        )}
        {info.action === "fix" && onFix && (
          <button type="button" onClick={onFix} className={cn(btn, solid)}>
            <Settings aria-hidden className="size-4" />
            {info.actionLabel ?? fixLabel}
          </button>
        )}
        {onContact && (info.action === "contact" || gaveUp || failures > 0) && (
          <button type="button" onClick={onContact} className={cn(btn, info.action === "contact" || gaveUp ? solid : outline)}>
            <LifeBuoy aria-hidden className="size-4" />
            {contactLabel}
          </button>
        )}
      </div>

      {(referenceId || message || details) && (
        <div className="grid gap-1.5 border-t border-red-500/20 pt-2 text-xs text-red-900/75 dark:text-red-100/75">
          {referenceId && (
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span>{referenceLabel}</span>
              <code className="font-mono text-red-950 select-all dark:text-red-50">{referenceId}</code>
              {time && <span>· {time}</span>}
              <button
                type="button"
                onClick={copy}
                aria-label={copyLabel}
                title={copyLabel}
                className="inline-flex h-6 items-center gap-1 rounded-md px-1.5 font-medium transition-colors hover:bg-red-500/15 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                {copied ? <Check aria-hidden className="size-3.5" /> : <Copy aria-hidden className="size-3.5" />}
                <span aria-live="polite">{copied ? copiedLabel : copyText}</span>
              </button>
            </p>
          )}
          {(message || details) && (
            <details className="group">
              <summary className="inline-flex h-6 cursor-pointer list-none items-center gap-1 rounded-md font-medium outline-none select-none focus-visible:ring-[3px] focus-visible:ring-ring/50 [&::-webkit-details-marker]:hidden">
                <ChevronRight aria-hidden className="size-3.5 transition-transform group-open:rotate-90" />
                {detailsLabel}
              </summary>
              <pre className="mt-1.5 max-h-48 overflow-auto rounded-md border bg-muted p-2 font-mono text-[11px] leading-relaxed whitespace-pre-wrap text-foreground">
                {[message, details].filter(Boolean).join("\n\n")}
              </pre>
            </details>
          )}
        </div>
      )}
    </div>
  )
}
