"use client"

import * as React from "react"
import { Check, Copy, Hand, Loader2, MonitorUp, PhoneCall, ShieldAlert, ShieldCheck, Shuffle } from "lucide-react"

import { cn } from "@/lib/utils"
import { describeOtpAction, formatOtpSms, groupOtp, normalizeOtp, otpRisks, OTP_ACTION_TEXT, type OtpAction, type OtpActionKind, type OtpRisk } from "./otp"

export { describeOtpAction, formatOtpAmount, formatOtpSms, groupOtp, normalizeOtp, otpRisks, OTP_ACTION_TEXT, type OtpAction, type OtpActionKind, type OtpActionText, type OtpContext, type OtpRisk } from "./otp"

/** Every visible string. `{brand}`, `{started}`, `{seconds}` and `{time}` are filled in. */
export const OTP_SHARE_MESSAGES = {
  actions: OTP_ACTION_TEXT,
  started: {
    payment: "a payment", transfer: "a money transfer", login: "a sign-in", "add-payee": "adding a payee",
    "change-contact": "changing your phone or email", "reset-password": "a password reset", other: "something else",
  } as Record<OtpActionKind, string>,
  neverShare: "Never share this code. {brand} will never call you for it.",
  risks: {
    "screen-share": "Your screen is being shared. Stop sharing to see this code.",
    "on-call": "You're on a call. If anyone on the line is asking for this code, hang up.",
    mismatch: "You started {started}, but this code is for something different. Someone else may have asked for it.",
  } as Record<OtpRisk, string>,
  calm: "Only type it into {brand} yourself. Never read it out or send it to anyone.",
  hold: "Hold to see code",
  hidden: "Code hidden",
  copy: "Copy code",
  copyWait: "Copy in {seconds}s",
  copied: "Copied",
  copyFailed: "Couldn't copy. Read the code and type it in yourself.",
  expires: "Expires in {time}",
  expired: "This code has expired. Ask for a new one if you still need it.",
  notMe: "I didn't request this",
  reported: "Thanks for telling us. This code no longer works and nothing was approved.",
  codeIs: "Code: {digits}",
  sender: "{brand}",
}

export type OtpShareMessages = Omit<typeof OTP_SHARE_MESSAGES, "actions" | "started" | "risks"> & {
  actions: typeof OTP_ACTION_TEXT
  started: Record<OtpActionKind, string>
  risks: Record<OtpRisk, string>
}

type MessageOverrides = Partial<Omit<OtpShareMessages, "actions" | "started" | "risks">> & {
  actions?: Partial<OtpShareMessages["actions"]>
  started?: Partial<OtpShareMessages["started"]>
  risks?: Partial<OtpShareMessages["risks"]>
}

const fill = (template: string, values: Record<string, string | number>) => template.replace(/\{(\w+)\}/g, (m, k: string) => String(values[k] ?? m))
const buttonClass = "inline-flex h-8 items-center justify-center gap-1.5 rounded-md border px-3 text-sm font-medium outline-none transition-colors hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30"

export interface OtpShareGuardProps extends Omit<React.ComponentProps<"div">, "children"> {
  /** The one-time code. Anything but letters and digits is dropped. */
  code: string
  /** What the code authorises; drives the plain-language sentence. */
  action: OtpAction
  /** What the user started in your app. A different `action.kind` triggers the strong warning. */
  expected?: OtpActionKind
  /** Your app knows a phone call is active. */
  onCall?: boolean
  /** Your app knows the screen is being shared or recorded. The code is never drawn while true. */
  screenSharing?: boolean
  /** Your bank or app name, used in "{brand} will never call you for it". */
  brand?: string
  /** `app` is an in-app card; `sms` draws it as the text message in RBI order (purpose first, code last). */
  variant?: "app" | "sms"
  /** Always require press-and-hold to see the code, even with no risk. Risks always require it. */
  holdToReveal?: boolean
  /** Seconds before Copy works when a risk is present. Defaults to 5. */
  copyDelay?: number
  /** Seconds until the code expires, counted from when it is shown. */
  expiresIn?: number
  /** Called after the code is copied. */
  onCodeCopy?: (code: string) => void
  /** "I didn't request this": block the code and alert your fraud team. May return a Promise. */
  onNotMe?: () => void | Promise<void>
  locale?: string
  /** Any visible string. */
  messages?: MessageOverrides
}

/**
 * Shows a one-time code with the one sentence scams hide: what it actually approves ("This code
 * approves a ₹24,999 payment to Croma"). On a call, during screen sharing, or when the code is for
 * something other than what the user started, it switches to a strong "never share" warning, hides
 * the code behind press-and-hold, delays Copy, and keeps "I didn't request this" one tap away.
 */
export function OtpShareGuard({
  code, action, expected, onCall, screenSharing, brand = "We", variant = "app", holdToReveal, copyDelay = 5,
  expiresIn, onCodeCopy, onNotMe, locale = "en-IN", messages, className, ...props
}: OtpShareGuardProps) {
  const t: OtpShareMessages = {
    ...OTP_SHARE_MESSAGES, ...messages,
    actions: { ...OTP_SHARE_MESSAGES.actions, ...messages?.actions },
    started: { ...OTP_SHARE_MESSAGES.started, ...messages?.started },
    risks: { ...OTP_SHARE_MESSAGES.risks, ...messages?.risks },
  }
  const digits = normalizeOtp(code)
  const safeAction: OtpAction = action && typeof action === "object" ? action : { kind: "other" }
  const risks = otpRisks(safeAction, { expected, onCall, screenSharing })
  const risky = risks.length > 0
  const mustHold = risky || !!holdToReveal
  const sentence = describeOtpAction(safeAction, t.actions, locale)
  const [held, setHeld] = React.useState(false)
  const [wait, setWait] = React.useState(0)
  const [left, setLeft] = React.useState<number>()
  const [copied, setCopied] = React.useState(false)
  const [pending, setPending] = React.useState(false)
  const [reported, setReported] = React.useState(false)
  const [status, setStatus] = React.useState("")
  const busy = React.useRef(false)
  const id = React.useId()
  const brandName = brand.trim() || "We"
  const expired = left === 0
  const shown = !screenSharing && !expired && !reported && (!mustHold || held)

  // A new code starts fresh: hidden, nothing announced, not reported.
  React.useEffect(() => {
    setHeld(false)
    setCopied(false)
    setReported(false)
    setStatus("")
  }, [digits])

  // The expiry clock belongs to the code alone, so a call starting or a share stopping never resets it.
  React.useEffect(() => {
    const total = Number(expiresIn)
    if (!Number.isFinite(total) || total <= 0) return setLeft(undefined)
    const end = Date.now() + total * 1000
    setLeft(Math.ceil(total))
    const timer = setInterval(() => setLeft(Math.max(0, Math.ceil((end - Date.now()) / 1000))), 250)
    return () => clearInterval(timer)
  }, [digits, expiresIn])

  // Copy waits again whenever a risk appears (a call starts mid-way, the code changes).
  React.useEffect(() => {
    const seconds = Math.max(0, Math.round(Number(copyDelay) || 0))
    if (!risky || !seconds) return setWait(0)
    setWait(seconds)
    const start = Date.now()
    const timer = setInterval(() => setWait(Math.max(0, seconds - Math.floor((Date.now() - start) / 1000))), 250)
    return () => clearInterval(timer)
  }, [digits, risky, copyDelay])

  // The code is only ever announced while it is on screen: sharing, expiry, a report or letting go clears it.
  // A plain release keeps it a few seconds so a quick key tap is still read out; sharing, expiry or a report wipe it at once.
  const urgent = !!screenSharing || expired || reported
  React.useEffect(() => {
    if (shown) return
    const wipe = () => setStatus((current) => (current.startsWith("\u2063") ? "" : current))
    if (urgent) return wipe()
    const timer = setTimeout(wipe, 3000)
    return () => clearTimeout(timer)
  }, [shown, urgent])

  // Switching app or tab mid-hold hides the code.
  React.useEffect(() => {
    const hide = () => document.visibilityState === "hidden" && setHeld(false)
    document.addEventListener("visibilitychange", hide)
    window.addEventListener("blur", hide)
    return () => {
      document.removeEventListener("visibilitychange", hide)
      window.removeEventListener("blur", hide)
    }
  }, [])
  const copiedTimer = React.useRef<ReturnType<typeof setTimeout>>(undefined)
  React.useEffect(() => () => clearTimeout(copiedTimer.current), [])

  React.useEffect(() => {
    if (!expired) return
    setHeld(false)
    setStatus(t.expired)
  }, [expired, t.expired])

  // One debounced announcement, never the countdown. The code itself is spoken at once and only while shown.
  const [spoken, setSpoken] = React.useState("")
  React.useEffect(() => {
    if (status.startsWith("\u2063") || !status) return setSpoken(status.replace("\u2063", ""))
    const timer = setTimeout(() => setSpoken(status), 400)
    return () => clearTimeout(timer)
  }, [status])

  const reveal = (next: boolean) => {
    if (screenSharing || expired || reported) return
    setHeld(next)
    // Marked with an invisible separator so it can be wiped the moment the code is hidden again.
    if (next) setStatus("\u2063" + fill(t.codeIs, { digits: digits.split("").join(" ") }))
  }

  const copy = async () => {
    if (wait > 0 || screenSharing || expired || reported || !digits) return
    try {
      await navigator.clipboard.writeText(digits)
      setCopied(true)
      setStatus(t.copied)
      onCodeCopy?.(digits)
      clearTimeout(copiedTimer.current)
      copiedTimer.current = setTimeout(() => setCopied(false), 1500)
    } catch {
      // Clipboard can be blocked; say so instead of failing silently.
      setStatus(t.copyFailed)
    }
  }

  const notMe = async () => {
    if (!onNotMe || busy.current || reported) return
    busy.current = true
    setPending(true)
    try {
      await onNotMe()
      setReported(true)
      setHeld(false)
      setStatus(t.reported)
    } catch {
      // The caller reports failures; the link works again.
    } finally {
      busy.current = false
      setPending(false)
    }
  }

  const time = left === undefined ? "" : `${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}`
  const masked = groupOtp(digits).replace(/[0-9A-Za-z]/g, "•")
  const icon = { "screen-share": MonitorUp, "on-call": PhoneCall, mismatch: Shuffle }
  const holdProps = {
    onPointerDown: (e: React.PointerEvent<HTMLButtonElement>) => { e.currentTarget.setPointerCapture?.(e.pointerId); reveal(true) },
    onPointerUp: () => setHeld(false),
    onPointerCancel: () => setHeld(false),
    onLostPointerCapture: () => setHeld(false),
    onKeyDown: (e: React.KeyboardEvent) => { if ((e.key === " " || e.key === "Enter") && !e.repeat) { e.preventDefault(); reveal(true) } },
    onKeyUp: (e: React.KeyboardEvent) => { if (e.key === " " || e.key === "Enter") setHeld(false) },
    onBlur: () => setHeld(false),
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
  }

  return (
    <div data-slot="otp-share-guard" data-state={reported ? "reported" : expired ? "expired" : risky ? "warning" : "ok"} className={cn("w-full max-w-sm space-y-3 rounded-xl border bg-card p-4 text-sm text-card-foreground", className)} {...props}>
      {variant === "sms" && (
        <div className="rounded-2xl rounded-bl-sm bg-muted px-3 py-2 text-[13px] leading-snug">
          <p className="text-xs font-medium text-muted-foreground">{fill(t.sender, { brand: brandName })}</p>
          <p className="mt-1 [overflow-wrap:anywhere]">{formatOtpSms(shown ? digits : "0".repeat(digits.length), safeAction, { brand: brand.trim() && brand !== "We" ? brandName : undefined, locale, masked: !shown })}</p>
        </div>
      )}
      <p id={`${id}-what`} className="text-base font-medium leading-snug [overflow-wrap:anywhere]">{sentence}</p>

      {reported ? (
        <p className="flex gap-1.5 rounded-md border border-emerald-500/30 bg-emerald-500/5 p-3 text-emerald-800 dark:text-emerald-300">
          <ShieldCheck aria-hidden className="mt-0.5 size-4 shrink-0" />{t.reported}
        </p>
      ) : (
        <>
          {risky ? (
            <div id={`${id}-warn`} className="space-y-1.5 rounded-md border border-red-500/40 bg-red-500/10 p-3 text-red-800 dark:text-red-300">
              <p className="flex gap-1.5 font-semibold"><ShieldAlert aria-hidden className="mt-0.5 size-4 shrink-0" />{fill(t.neverShare, { brand: brandName })}</p>
              <ul className="space-y-1 text-xs">
                {risks.map((risk) => {
                  const Icon = icon[risk]
                  return <li key={risk} className="flex gap-1.5"><Icon aria-hidden className="mt-px size-3.5 shrink-0" /><span>{fill(t.risks[risk], { started: expected ? t.started[expected] : "" })}</span></li>
                })}
              </ul>
            </div>
          ) : (
            <p id={`${id}-warn`} className="text-xs text-muted-foreground">{fill(t.calm, { brand: brandName })}</p>
          )}

          <div className="flex min-h-14 items-center justify-center rounded-lg border bg-background px-3 dark:bg-input/30">
            {expired ? <p className="py-2 text-center text-xs text-muted-foreground">{t.expired}</p> : (
              <span aria-hidden={!shown} className={cn("font-mono text-3xl font-semibold tracking-[0.2em] tabular-nums", !shown && "text-muted-foreground")}>
                {shown ? groupOtp(digits) : masked}
              </span>
            )}
            {!shown && !expired && <span className="sr-only">{t.hidden}</span>}
          </div>

          {!expired && (
            <div className="flex flex-wrap items-center gap-2">
              {mustHold && (
                <button type="button" aria-pressed={held} aria-describedby={`${id}-what ${id}-warn`} disabled={screenSharing} className={cn(buttonClass, "touch-none select-none disabled:opacity-50")} {...holdProps}>
                  <Hand aria-hidden className="size-4" />{t.hold}
                </button>
              )}
              <button type="button" onClick={copy} aria-disabled={wait > 0 || screenSharing || undefined} aria-label={wait > 0 ? t.copy : undefined} className={cn(buttonClass, "relative overflow-hidden aria-disabled:cursor-not-allowed aria-disabled:opacity-60")}>
                {wait > 0 && <span aria-hidden className="absolute inset-y-0 left-0 bg-amber-500/15 motion-safe:transition-[width] motion-safe:duration-300" style={{ width: `${(wait / Math.max(1, copyDelay)) * 100}%` }} />}
                {copied ? <Check aria-hidden className="size-4" /> : <Copy aria-hidden className="size-4" />}
                <span className="relative">{copied ? t.copied : wait > 0 ? fill(t.copyWait, { seconds: wait }) : t.copy}</span>
              </button>
              {time && <span aria-hidden className="ms-auto text-xs tabular-nums text-muted-foreground">{fill(t.expires, { time })}</span>}
            </div>
          )}

          {onNotMe && (
            <button type="button" onClick={notMe} aria-disabled={pending || undefined} className="inline-flex items-center gap-1.5 rounded-sm text-xs font-medium text-red-700 underline underline-offset-4 outline-none hover:text-red-800 focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:text-red-400">
              {pending && <Loader2 aria-hidden className="size-3.5 animate-spin" />}{t.notMe}
            </button>
          )}
        </>
      )}
      <span role="status" className="sr-only">{spoken}</span>
    </div>
  )
}
