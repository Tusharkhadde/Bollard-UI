"use client"

import * as React from "react"
import { ArrowUpLeft, Bell, Camera, CircleCheck, LoaderCircle, MapPin, Mic, ShieldAlert, Smartphone } from "lucide-react"

import { cn } from "@/lib/utils"
import {
  detectBrowser,
  PERMISSION_NOUNS,
  queryPermission,
  reEnableSteps,
  requestPermission,
  type BrowserName,
  type PermissionKind,
  type PermissionResult,
} from "./permissions"

export * from "./permissions"

type State = PermissionResult | "checking" | "requesting" | "later"

const ICONS = { notifications: Bell, geolocation: MapPin, camera: Camera, microphone: Mic }
const TITLES: Record<PermissionKind, string> = {
  notifications: "Turn on notifications?",
  geolocation: "Use your location?",
  camera: "Use your camera?",
  microphone: "Use your microphone?",
}
const btn = "inline-flex h-8 items-center justify-center gap-1.5 rounded-md px-3 text-sm font-medium whitespace-nowrap transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"

export interface PermissionPreAskProps extends Omit<React.ComponentProps<"div">, "title"> {
  /** Which browser permission this asks for. */
  permission: PermissionKind
  /** Why you need it and what for, in the user's terms. Shown before the browser prompt. */
  reason: React.ReactNode
  /** Heading of the pre-ask. */
  title?: string
  /** Called once the permission is granted, whether just now or later from browser settings. */
  onGranted?: () => void
  /** Called when the user picks "Not now"; the browser prompt has not been used up. */
  onDecline?: () => void
  /** Override how the state is read (tests, native wrappers). */
  query?: (permission: PermissionKind) => Promise<PermissionResult>
  /** Override how the real prompt is shown. */
  request?: (permission: PermissionKind) => Promise<PermissionResult>
  /** Browser whose re-enable steps to show; detected when omitted. */
  browser?: BrowserName
  /** Button text to ask the browser. */
  allowLabel?: string
  /** Button text to decline for now. */
  laterLabel?: string
  /** Shown while the browser prompt is open. */
  waitingText?: string
  /** Shown when the prompt was closed without a choice. */
  dismissedText?: string
  /** `{noun}` and `{is}` (is/are) are filled in. */
  blockedTitle?: string
  /** Button text to check again after changing settings. */
  recheckLabel?: string
  /** Button text to ask again after a dismissal. */
  askAgainLabel?: string
}

/**
 * Stops sites burning the browser's one-shot permission prompt. It explains why and what for in the
 * page first and only calls the real API after "Turn on"; "Not now" never touches it. A closed
 * prompt and a hard block are told apart, and a block shows this browser's exact re-enable steps,
 * then flips to "on" by itself once the user allows it in settings.
 */
export function PermissionPreAsk({
  permission,
  reason,
  title = TITLES[permission],
  onGranted,
  onDecline,
  query = queryPermission,
  request = requestPermission,
  browser,
  allowLabel = "Turn on",
  laterLabel = "Not now",
  waitingText = "Choose Allow in your browser's prompt, near the address bar.",
  dismissedText = "You closed the browser's prompt without choosing.",
  blockedTitle = "{noun} {is} blocked for this site",
  recheckLabel = "I've turned it on",
  askAgainLabel = "Ask again",
  className,
  ...props
}: PermissionPreAskProps) {
  const [state, setState] = React.useState<State>("checking")
  const [closes, setCloses] = React.useState(0)
  const [detected, setDetected] = React.useState<BrowserName>("other")
  const granted = React.useRef(onGranted)
  React.useEffect(() => {
    granted.current = onGranted
  })
  const noun = PERMISSION_NOUNS[permission]
  const is = permission === "notifications" ? "are" : "is"
  const Icon = ICONS[permission]

  const settle = React.useCallback((next: State) => {
    setState(next)
    if (next === "granted") granted.current?.()
  }, [])

  React.useEffect(() => {
    let live = true
    setDetected(detectBrowser(navigator.userAgent, navigator.maxTouchPoints))
    query(permission).then((s) => live && settle(s), () => live && settle("unsupported"))
    // Catch the user re-enabling it in browser settings without a reload.
    let status: PermissionStatus | undefined
    const onChange = () => status && live && settle(status.state === "prompt" ? "prompt" : status.state)
    if (query === queryPermission) navigator.permissions?.query({ name: permission as PermissionName }).then((s) => {
      status = s
      s.addEventListener("change", onChange)
    }, () => {})
    return () => {
      live = false
      status?.removeEventListener("change", onChange)
    }
  }, [permission, query, settle])

  const ask = async () => {
    setState("requesting")
    try {
      const result = await request(permission)
      if (result === "dismissed") setCloses((n) => n + 1)
      settle(result)
    } catch {
      settle("unsupported")
    }
  }
  const recheck = async () => settle(await query(permission))

  if (state === "checking") return null
  if (state === "granted" || state === "later" || state === "unsupported") {
    return (
      <div data-slot="permission-pre-ask" data-state={state} role="status" className={cn("flex min-h-9 items-center gap-2 text-sm", className)} {...props}>
        {state === "granted" ? <CircleCheck aria-hidden className="size-4 text-emerald-600 dark:text-emerald-400" /> : <Icon aria-hidden className="size-4 text-muted-foreground" />}
        <span className={cn(state !== "granted" && "text-muted-foreground")}>
          {state === "granted" ? `${noun} ${is} on.` : state === "later" ? `${noun} ${is} off.` : `This browser can't use ${noun.toLowerCase()}.`}
        </span>
        {state === "later" && (
          <button type="button" onClick={ask} className={cn(btn, "h-7 px-2 hover:bg-accent")}>{allowLabel}</button>
        )}
      </div>
    )
  }

  const blocked = state === "denied"
  const install = state === "needs-install"
  const steps = install ? ["Tap the Share button", "Choose Add to Home Screen", "Open the app from your Home Screen and turn this on there"] : reEnableSteps(browser ?? detected, permission)
  const chromium = (browser ?? detected) === "chrome" || (browser ?? detected) === "edge"

  return (
    <div
      data-slot="permission-pre-ask"
      data-state={state}
      role="region"
      aria-label={blocked ? blockedTitle.replace("{noun}", noun).replace("{is}", is) : title}
      className={cn("flex w-full max-w-sm gap-3 rounded-lg border p-3 text-sm", blocked ? "border-amber-500/30 bg-amber-500/10" : "bg-card text-card-foreground", className)}
      {...props}
    >
      <style>{"@keyframes cui-permission-pre-ask-nudge{0%,100%{transform:translate(0,0)}50%{transform:translate(-3px,-3px)}}"}</style>
      <span className={cn("grid size-9 shrink-0 place-items-center rounded-md", blocked ? "bg-amber-500/15 text-amber-700 dark:text-amber-400" : "bg-muted")}>
        {blocked ? <ShieldAlert aria-hidden className="size-4" /> : install ? <Smartphone aria-hidden className="size-4" /> : <Icon aria-hidden className="size-4" />}
      </span>
      <div className="grid min-w-0 flex-1 gap-1.5">
        <p className="font-medium">{blocked ? blockedTitle.replace("{noun}", noun).replace("{is}", is) : install ? "Add this site to your Home Screen first" : title}</p>
        <div className="text-muted-foreground">{reason}</div>
        {(blocked || install) && (
          <ol className="grid list-decimal gap-1 pt-0.5 pl-4 marker:text-muted-foreground">
            {steps.map((step) => <li key={step}>{step}</li>)}
          </ol>
        )}
        <div aria-live="polite" className="grid gap-2 pt-1">
          {state === "requesting" ? (
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <ArrowUpLeft aria-hidden className="size-3.5 shrink-0 motion-safe:animate-[cui-permission-pre-ask-nudge_400ms_ease-out_2]" />
              {waitingText}
            </p>
          ) : state === "dismissed" ? (
            <p className="flex gap-1.5 text-xs text-amber-700 dark:text-amber-400">
              {dismissedText}
              {chromium && closes >= 2 ? " Chrome stops asking after 3 closes." : ""}
            </p>
          ) : null}
          {!install && (
            <div className="flex flex-wrap gap-2">
              {blocked ? (
                <button type="button" onClick={recheck} className={cn(btn, "border border-amber-700/25 hover:bg-amber-500/15 dark:border-amber-300/25")}>{recheckLabel}</button>
              ) : (
                <>
                  <button type="button" onClick={ask} disabled={state === "requesting"} className={cn(btn, "bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-60")}>
                    {state === "requesting" && <LoaderCircle aria-hidden className="size-4 animate-spin" />}
                    {state === "dismissed" ? askAgainLabel : allowLabel}
                  </button>
                  <button type="button" onClick={() => { setState("later"); onDecline?.() }} className={cn(btn, "hover:bg-accent")}>{laterLabel}</button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
