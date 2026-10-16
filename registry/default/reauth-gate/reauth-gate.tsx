"use client"

import * as React from "react"
import { Fingerprint, KeyRound, LoaderCircle, LockKeyhole, ShieldCheck, X } from "lucide-react"

import { cn } from "@/lib/utils"

export type ReauthMethod = "passkey" | "password" | "pin"
export type ReauthCredential = { method: ReauthMethod; secret?: string }

/** "4:59" for 299 s. */
export function formatClock(ms: number) {
  const s = Math.max(0, Math.ceil(ms / 1000))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`
}

const fill = (template: string, values: Record<string, string>) =>
  template.replace(/\{(\w+)\}/g, (match, key: string) => values[key] ?? match)
const button =
  "inline-flex h-9 items-center justify-center gap-2 rounded-md px-4 text-sm font-medium whitespace-nowrap shadow-xs outline-none transition-[color,background-color,box-shadow] focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50"
const outline = "border bg-background hover:bg-accent dark:border-input dark:bg-input/30 dark:hover:bg-input/50"
const ICONS = { passkey: Fingerprint, password: KeyRound, pin: LockKeyhole }
const NAMES = { passkey: "Passkey", password: "Password", pin: "PIN" }

/** Wrap a sensitive action: it runs now if recently confirmed, otherwise after the user re-confirms. */
export type Protect = (label: string, action: () => void | Promise<void>) => void

export interface ReauthGateProps extends Omit<React.ComponentProps<"div">, "children"> {
  /** Check the credential. Resolve true to unlock; false (or a rejection) counts as a wrong attempt. */
  verify: (credential: ReauthCredential) => boolean | Promise<boolean>
  /** Offered methods, preferred first. */
  methods?: ReauthMethod[]
  /** How long a confirmation is remembered, in ms. Every protected action resets it. */
  duration?: number
  /** Why this area asks again, shown in the prompt. */
  reason?: string
  /** Render the protected UI. Call `protect(label, action)` from sensitive buttons. */
  children: (protect: Protect, state: { unlocked: boolean }) => React.ReactNode
  /** Templates: `{action}`, `{time}` are filled in. */
  promptText?: string
  rememberText?: string
  wrongText?: string
  cancelledText?: string
  chipText?: string
  endLabel?: string
}

/**
 * "Sudo mode" for sensitive actions. The first protected action opens a
 * prompt that names that exact action and says why it's asking; once
 * confirmed (passkey, password or PIN through your own `verify`), the queued
 * action runs at once, with no second click. The confirmation is remembered
 * for `duration`, shown as a countdown chip that turns amber in its last 30
 * seconds and can be ended early on a shared computer. Like GitHub's sudo
 * mode, each protected action resets the window.
 */
export function ReauthGate({
  verify, methods = ["passkey", "password"], duration = 5 * 60_000,
  reason = "This changes who can get into your account, so we check it's still you.",
  children,
  promptText = "Confirm it's you to {action}.",
  rememberText = "You won't be asked again for {time}.",
  wrongText = "That didn't match. Try again.",
  cancelledText = "Cancelled. Nothing was changed.",
  chipText = "Confirmed · {time}",
  endLabel = "End now",
  className, ...props
}: ReauthGateProps) {
  const [until, setUntil] = React.useState(0)
  const [now, setNow] = React.useState(0)
  const [queued, setQueued] = React.useState<{ label: string; action: () => void | Promise<void> }>()
  const [method, setMethod] = React.useState(methods[0])
  const [secret, setSecret] = React.useState("")
  const [pending, setPending] = React.useState(false)
  const [message, setMessage] = React.useState("")
  const panelRef = React.useRef<HTMLDivElement>(null)
  const firstRef = React.useRef<HTMLElement | null>(null)
  const setFirst = (el: HTMLElement | null) => {
    firstRef.current = el
  }
  const id = React.useId()

  const unlocked = until > now
  React.useEffect(() => {
    if (!until) return
    const tick = () => {
      const t = Date.now()
      setNow(t)
      if (t >= until) clearInterval(timer)
    }
    const timer = setInterval(tick, 1000)
    tick()
    return () => clearInterval(timer)
  }, [until])
  React.useEffect(() => {
    if (queued) firstRef.current?.focus()
  }, [queued, method])

  const protect: Protect = (label, action) => {
    const t = Date.now()
    if (until > t) {
      setUntil(t + duration)
      void action()
      return
    }
    setMessage("")
    setSecret("")
    setQueued({ label, action })
  }

  const shake = () => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return
    panelRef.current?.animate(
      [{ transform: "translateX(0)" }, { transform: "translateX(-6px)" }, { transform: "translateX(5px)" }, { transform: "translateX(-3px)" }, { transform: "translateX(0)" }],
      { duration: 300, easing: "ease-out" },
    )
  }

  const confirm = async (event?: React.FormEvent) => {
    event?.preventDefault()
    if (!queued || pending || (method !== "passkey" && !secret)) return
    setPending(true)
    let ok = false
    try {
      ok = await verify({ method, secret: method === "passkey" ? undefined : secret })
    } catch {
      ok = false
    }
    setPending(false)
    if (!ok) {
      setSecret("")
      setMessage(wrongText)
      shake()
      firstRef.current?.focus()
      return
    }
    const t = Date.now()
    setNow(t)
    setUntil(t + duration)
    setQueued(undefined)
    setMessage("")
    void queued.action()
  }

  const cancel = () => {
    setQueued(undefined)
    setMessage(cancelledText)
  }

  const left = until - now
  const ending = unlocked && left <= 30_000
  const minutes = Math.round(duration / 60_000)
  const Icon = ICONS[method]

  return (
    <div data-slot="reauth-gate" data-state={queued ? "prompting" : unlocked ? "unlocked" : "locked"} className={cn("grid w-full max-w-md gap-3", className)} {...props}>
      <style>{`@keyframes cui-reauth-gate-in{from{opacity:0;transform:scale(.9)}to{opacity:1;transform:none}}`}</style>
      {/* The chip's row is always reserved, so the buttons below never shift under the pointer. */}
      <div className="flex min-h-7 items-center justify-end">
        {unlocked ? (
          <span
            className={cn(
              "relative inline-flex h-7 items-center gap-1.5 overflow-hidden rounded-full border pr-1 pl-2.5 text-xs font-medium tabular-nums transition-colors motion-safe:animate-[cui-reauth-gate-in_250ms_ease-out]",
              ending ? "border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-300" : "border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300",
            )}
          >
            <ShieldCheck aria-hidden className="size-3.5" />
            <span role="timer" aria-label={`Sensitive actions unlocked, ${formatClock(left)} left`}>{fill(chipText, { time: formatClock(left) })}</span>
            <button type="button" onClick={() => { setUntil(0); setNow(0) }} className="inline-flex h-5 items-center gap-0.5 rounded-full px-1.5 outline-none transition-colors hover:bg-foreground/10 focus-visible:ring-[3px] focus-visible:ring-ring/50">
              <X aria-hidden className="size-3" /> {endLabel}
            </button>
            <span aria-hidden className="absolute inset-x-0 bottom-0 h-0.5 origin-left bg-current opacity-40 transition-transform duration-1000 ease-linear motion-reduce:transition-none" style={{ transform: `scaleX(${Math.max(0, left / duration)})` }} />
          </span>
        ) : null}
      </div>

      {children(protect, { unlocked })}

      {queued ? (
        <div ref={panelRef} role="region" aria-labelledby={`${id}-title`} className="grid gap-3 rounded-lg border bg-card p-3 text-card-foreground shadow-xs motion-safe:animate-[cui-reauth-gate-in_200ms_ease-out]" onKeyDown={(e) => e.key === "Escape" && cancel()}>
          <div className="flex gap-3">
            <span className="grid size-8 shrink-0 place-items-center rounded-full bg-muted"><ShieldCheck aria-hidden className="size-4" /></span>
            <div className="min-w-0 text-sm">
              <p id={`${id}-title`} className="font-medium">{fill(promptText, { action: queued.label })}</p>
              <p className="text-xs text-muted-foreground">{reason} {fill(rememberText, { time: `${minutes} min` })}</p>
            </div>
          </div>
          {methods.length > 1 ? (
            <div role="group" aria-label="How to confirm" className="inline-flex w-fit rounded-md border p-0.5 text-xs">
              {methods.map((m) => (
                <button key={m} type="button" aria-pressed={method === m} onClick={() => { setMethod(m); setSecret(""); setMessage("") }} className={cn("h-7 rounded-sm px-2.5 font-medium outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50", method === m ? "bg-primary text-primary-foreground" : "hover:bg-accent")}>
                  {NAMES[m]}
                </button>
              ))}
            </div>
          ) : null}
          <form onSubmit={(e) => void confirm(e)} className="flex flex-wrap items-center gap-2">
            {method === "passkey" ? (
              <button ref={setFirst} type="submit" disabled={pending} className={cn(button, "bg-primary text-primary-foreground hover:bg-primary/90")}>
                {pending ? <LoaderCircle aria-hidden className="size-4 animate-spin" /> : <Icon aria-hidden className="size-4" />} Use passkey
              </button>
            ) : (
              <>
                <label htmlFor={`${id}-secret`} className="sr-only">{NAMES[method]}</label>
                <input
                  ref={setFirst}
                  id={`${id}-secret`}
                  type="password"
                  inputMode={method === "pin" ? "numeric" : undefined}
                  autoComplete={method === "pin" ? "off" : "current-password"}
                  placeholder={NAMES[method]}
                  value={secret}
                  aria-invalid={message === wrongText || undefined}
                  aria-describedby={`${id}-msg`}
                  onChange={(e) => setSecret(method === "pin" ? e.target.value.replace(/\D/g, "") : e.target.value)}
                  className="h-9 min-w-0 flex-1 basis-40 rounded-md border bg-transparent px-3 text-base shadow-xs outline-none transition-[color,box-shadow] placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-destructive md:text-sm dark:bg-input/30"
                />
                <button type="submit" disabled={pending || !secret} className={cn(button, "bg-primary text-primary-foreground hover:bg-primary/90")}>
                  {pending ? <LoaderCircle aria-hidden className="size-4 animate-spin" /> : null} Confirm
                </button>
              </>
            )}
            <button type="button" onClick={cancel} className={cn(button, outline, method === "passkey" && "ml-auto")}>Cancel</button>
          </form>
        </div>
      ) : null}
      <p id={`${id}-msg`} aria-live="polite" className={cn("text-xs empty:hidden", queued ? "-mt-1.5 text-red-700 dark:text-red-400" : "text-center text-muted-foreground")}>
        {message}
      </p>
    </div>
  )
}
