"use client"

// Bollard UI — sign-in-approve · MIT licence · https://bollard-ui.vercel.app/components/sign-in-approve

import * as React from "react"
import { Clock, LoaderCircle, MapPin, Monitor, ShieldCheck, ShieldQuestion, ShieldX, TriangleAlert } from "lucide-react"

import { cn } from "@/lib/utils"

const button =
  "inline-flex h-9 items-center justify-center gap-2 rounded-md px-4 text-sm font-medium whitespace-nowrap outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50"
const outline = "border bg-background shadow-xs hover:bg-accent dark:border-input dark:bg-input/30 dark:hover:bg-input/50"

export interface SignInRequest {
  /** Approximate place of the device asking to sign in. */
  location: string
  /** e.g. "Chrome on Windows". */
  device: string
  /** What they are signing in to, e.g. "Acme Admin". */
  app?: string
  requestedAt: Date | number | string
  /** When the request stops being valid. */
  expiresAt: Date | number | string
  /** True when the location is far from where this account usually signs in. */
  unusualLocation?: boolean
  /** Sign-in requests for this account in the last 15 minutes, this one included. */
  recentRequests?: number
}

const fill = (template: string, values: Record<string, string | number>) =>
  template.replace(/\{(\w+)\}/g, (match, key: string) => String(values[key] ?? match))

export type DenyReason = "not-me" | "no-number" | "wrong-number" | "expired"
type Phase = "asking" | "approving" | "approved" | "denied" | "expired"

export interface SignInApproveProps extends React.ComponentProps<"section"> {
  /** The sign-in request: place, device, app, expiry and burst count. */
  request: SignInRequest
  /** Checks the typed number against the sign-in screen. Resolve `true` to approve; `false` counts as a wrong number. */
  onApprove: (number: string) => boolean | Promise<boolean>
  /** Called once the request is refused, with why. */
  onDeny: (reason: DenyReason) => void
  /** Starts the "secure my account" path (change password, sign out everywhere). */
  onSecure: () => void
  /** Wrong numbers allowed before the request is refused. */
  maxAttempts?: number
  /** Digits in the number shown on the sign-in screen. */
  length?: number
  /** Templates: `{app}`, `{count}`, `{left}` and `{device}` are filled in. */
  title?: string
  /** Label of the number input. */
  numberLabel?: string
  /** Warning that support will never ask for the number. */
  scamWarning?: string
  /** Warning for many requests in a short time. */
  burstWarning?: string
  /** Flag for an unusual location. */
  unusualText?: string
  /** Label of the approve button. */
  approveLabel?: string
  /** Label of the deny button. */
  notMeLabel?: string
  /** Label for "I don't see a number". */
  noNumberLabel?: string
  /** Shown after a wrong number. */
  wrongText?: string
  /** Shown after approving. */
  approvedText?: string
  /** Shown after denying. */
  deniedText?: string
  /** Shown when the request expired. */
  expiredText?: string
  /** Label of the secure-my-account button. */
  secureLabel?: string
  /** Used for `{app}` when the request names none. */
  accountLabel?: string
  /** Term for the location row. */
  locationLabel?: string
  /** Term for the device row. */
  deviceLabel?: string
  /** Label before the expiry countdown. */
  expiresLabel?: string
}

/**
 * A "Was this you?" approval built against MFA fatigue (push bombing). There is
 * no one-tap Approve: the user must type the number on the sign-in screen, which
 * an attacker's victim never sees. It shows where and what is signing in, warns
 * when requests arrive in a burst, says plainly never to type a number someone
 * sent you, and every refusal ends on a one-tap "secure my account" step.
 */
export function SignInApprove({
  request,
  onApprove,
  onDeny,
  onSecure,
  maxAttempts = 2,
  length = 2,
  title = "Is someone signing in to {app}?",
  numberLabel = "Type the number shown on your sign-in screen",
  scamWarning = "Never type a number someone sent you by call or message. We'll never ask for it.",
  burstWarning = "{count} sign-in requests in 15 minutes. If they aren't you, someone has your password.",
  unusualText = "Not where you usually sign in",
  approveLabel = "Approve",
  notMeLabel = "This wasn't me",
  noNumberLabel = "I don't see a number",
  wrongText = "That number doesn't match. {left} left.",
  approvedText = "Approved. You're signed in on {device}.",
  deniedText = "Blocked. Nobody got in. Your password may be known, so change it now.",
  expiredText = "This request expired and nobody got in.",
  secureLabel = "Secure my account",
  accountLabel = "your account",
  locationLabel = "Location",
  deviceLabel = "Device",
  expiresLabel = "Expires in",
  className,
  ...props
}: SignInApproveProps) {
  const id = React.useId()
  const [phase, setPhase] = React.useState<Phase>("asking")
  const [code, setCode] = React.useState("")
  const [misses, setMisses] = React.useState(0)
  const [now, setNow] = React.useState<number>()
  const inputRef = React.useRef<HTMLInputElement>(null)
  const doneRef = React.useRef<HTMLParagraphElement>(null)
  const expiresAt = new Date(request.expiresAt).getTime()
  const total = expiresAt - new Date(request.requestedAt).getTime()
  const left = now === undefined ? total : Math.max(0, expiresAt - now)
  const burst = (request.recentRequests ?? 1) >= 3
  const values = { app: request.app ?? accountLabel, count: request.recentRequests ?? 1, left: maxAttempts - misses, device: request.device }

  const deny = React.useCallback((reason: DenyReason) => {
    setPhase(reason === "expired" ? "expired" : "denied")
    onDeny(reason)
  }, [onDeny])

  React.useEffect(() => {
    if (phase !== "asking") return
    const tick = () => setNow(Date.now())
    tick()
    const timer = setInterval(tick, 1000)
    return () => clearInterval(timer)
  }, [phase])
  React.useEffect(() => {
    if (phase === "asking" && now !== undefined && now >= expiresAt) deny("expired")
  }, [now, expiresAt, phase, deny])

  // A new request (same component, new props) starts fresh instead of inheriting the old result.
  const requestKey = `${new Date(request.requestedAt).getTime()}-${expiresAt}`
  const lastKey = React.useRef(requestKey)
  React.useEffect(() => {
    if (lastKey.current === requestKey) return
    lastKey.current = requestKey
    setPhase("asking")
    setCode("")
    setMisses(0)
  }, [requestKey])

  // The buttons that had focus are gone once the request ends; move focus to the outcome, not <body>.
  const finished = phase === "approved" || phase === "denied" || phase === "expired"
  React.useEffect(() => {
    const active = document.activeElement
    if (finished && (!active || active === document.body)) doneRef.current?.focus()
  }, [finished])

  const approve = async () => {
    if (code.length !== length || phase !== "asking") return
    setPhase("approving")
    let ok = false
    try {
      ok = await onApprove(code)
    } catch {
      // A failed check never approves.
    }
    if (ok) return setPhase("approved")
    const missed = misses + 1
    setMisses(missed)
    setCode("")
    if (missed >= maxAttempts) return deny("wrong-number")
    setPhase("asking")
    requestAnimationFrame(() => inputRef.current?.focus())
  }

  if (finished) {
    const Icon = phase === "approved" ? ShieldCheck : ShieldX
    return (
      <section data-slot="sign-in-approve" data-state={phase} aria-labelledby={`${id}-done`} className={cn("grid w-full max-w-sm gap-3 rounded-lg border bg-card p-4 text-card-foreground shadow-xs", className)} {...props}>
        <p ref={doneRef} id={`${id}-done`} role="status" tabIndex={-1} className="flex gap-3 rounded-sm text-sm font-medium outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50">
          <Icon aria-hidden className={cn("size-5 shrink-0", phase === "approved" ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400")} />
          {fill(phase === "approved" ? approvedText : phase === "denied" ? deniedText : expiredText, values)}
        </p>
        {phase === "denied" && (
          <button type="button" onClick={onSecure} className={cn(button, "bg-red-700 text-white hover:bg-red-800 dark:bg-red-400 dark:text-red-950 dark:hover:bg-red-300")}>
            <ShieldCheck aria-hidden className="size-4" /> {secureLabel}
          </button>
        )}
      </section>
    )
  }

  return (
    <section data-slot="sign-in-approve" data-state={phase} aria-labelledby={`${id}-title`} className={cn("relative grid w-full max-w-sm gap-3 overflow-hidden rounded-lg border bg-card p-4 text-card-foreground shadow-xs", className)} {...props}>
      <div className="flex gap-3">
        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-muted"><ShieldQuestion aria-hidden className="size-4" /></span>
        <div className="min-w-0 text-sm">
          <h3 id={`${id}-title`} className="font-medium">{fill(title, values)}</h3>
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground tabular-nums">
            <Clock aria-hidden className="size-3.5" /> <span className="sr-only">{expiresLabel}</span> {Math.floor(left / 60_000)}:{String(Math.floor((left % 60_000) / 1000)).padStart(2, "0")}
          </p>
        </div>
      </div>

      <dl className="grid gap-1.5 rounded-md border bg-muted/40 px-3 py-2 text-sm">
        <div className="flex items-center gap-2">
          <dt className="sr-only">{locationLabel}</dt>
          <MapPin aria-hidden className={cn("size-4 shrink-0", request.unusualLocation ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground")} />
          <dd className="min-w-0">
            {request.location}
            {request.unusualLocation && <span className="block text-xs text-amber-800 dark:text-amber-300">{unusualText}</span>}
          </dd>
        </div>
        <div className="flex items-center gap-2">
          <dt className="sr-only">{deviceLabel}</dt>
          <Monitor aria-hidden className="size-4 shrink-0 text-muted-foreground" />
          <dd>{request.device}</dd>
        </div>
      </dl>

      {burst && (
        <p className="flex items-start gap-1.5 text-xs text-amber-800 dark:text-amber-300">
          <TriangleAlert aria-hidden className="mt-px size-3.5 shrink-0" /> {fill(burstWarning, values)}
        </p>
      )}

      <form onSubmit={(event) => { event.preventDefault(); void approve() }} className="grid gap-1.5">
        <label htmlFor={`${id}-code`} className="text-sm font-medium">{numberLabel}</label>
        <div className="flex gap-2">
          <input
            ref={inputRef}
            id={`${id}-code`}
            value={code}
            inputMode="numeric"
            autoComplete="off"
            maxLength={length}
            placeholder={"•".repeat(length)}
            aria-invalid={misses > 0 && code === "" ? true : undefined}
            aria-describedby={`${id}-msg`}
            disabled={phase === "approving"}
            onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, length))}
            className="h-9 w-20 rounded-md border bg-transparent px-3 text-center font-mono text-lg tracking-[0.3em] tabular-nums shadow-xs outline-none transition-[color,box-shadow] placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-destructive dark:bg-input/30"
          />
          <button type="submit" disabled={code.length !== length || phase === "approving"} className={cn(button, "flex-1", outline)}>
            {phase === "approving" && <LoaderCircle aria-hidden className="size-4 animate-spin" />}
            {approveLabel}
          </button>
        </div>
        <p id={`${id}-msg`} aria-live="polite" className={cn("text-xs", misses > 0 ? "text-red-700 dark:text-red-400" : "text-muted-foreground")}>
          {misses > 0 ? fill(wrongText, values) : scamWarning}
        </p>
      </form>

      <div className="flex flex-wrap gap-2 border-t pt-3">
        <button type="button" onClick={() => deny("not-me")} className={cn(button, "flex-1 basis-36 px-2 bg-red-700 text-white hover:bg-red-800 dark:bg-red-400 dark:text-red-950 dark:hover:bg-red-300")}>{notMeLabel}</button>
        <button type="button" onClick={() => deny("no-number")} className={cn(button, "flex-1 basis-36 px-2", outline)}>{noNumberLabel}</button>
      </div>

      <span aria-hidden className="absolute inset-x-0 bottom-0 h-0.5 origin-left bg-amber-500/70 transition-transform duration-1000 ease-linear motion-reduce:transition-none" style={{ transform: `scaleX(${total > 0 ? left / total : 0})` }} />
    </section>
  )
}
