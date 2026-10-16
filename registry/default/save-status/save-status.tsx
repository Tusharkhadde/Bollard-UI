"use client"

// Bollard UI — save-status · MIT licence · https://bollard-ui.vercel.app/components/save-status

import * as React from "react"
import { Check, CircleAlert, CloudOff, LoaderCircle, RotateCw } from "lucide-react"

import { cn } from "@/lib/utils"

export type AutosaveStatus = "idle" | "saving" | "saved" | "offline" | "error"

export interface AutosaveOptions {
  /** Quiet time after the last change before saving, in ms. */
  delay?: number
  /** When set, the unsynced value is kept in localStorage under this key while offline. */
  draftKey?: string
  /** Warn before the tab closes while a change hasn't reached the server. */
  guardUnload?: boolean
}

/** Reads a draft that `useAutosave` kept on this device, e.g. to offer a restore. */
export function readAutosaveDraft<T>(draftKey: string): T | undefined {
  try {
    const raw = localStorage.getItem(draftKey)
    return raw === null ? undefined : (JSON.parse(raw) as T)
  } catch {
    return undefined
  }
}

/** "just now", "3 min ago", "2 h ago", then a date. */
export function formatSavedAgo(from: number, now: number) {
  const seconds = Math.max(0, Math.round((now - from) / 1000))
  if (seconds < 45) return "just now"
  if (seconds < 3600) return `${Math.max(1, Math.round(seconds / 60))} min ago`
  if (seconds < 86_400) return `${Math.round(seconds / 3600)} h ago`
  return new Date(from).toLocaleDateString()
}

/**
 * Debounced autosave that never writes stale data: one save runs at a time,
 * and when it finishes the newest value goes next, so an old request can't
 * land after a newer one. Waits out offline spells, retries on demand and
 * flushes a pending change when the component unmounts.
 */
export function useAutosave<T>(
  value: T,
  save: (value: T) => Promise<void>,
  { delay = 800, draftKey, guardUnload = true }: AutosaveOptions = {}
) {
  const [status, setStatus] = React.useState<AutosaveStatus>("idle")
  const [savedAt, setSavedAt] = React.useState<number>()
  const [error, setError] = React.useState<string>()
  const latest = React.useRef(value)
  const lastSaved = React.useRef(JSON.stringify(value))
  const saveRef = React.useRef(save)
  const inFlight = React.useRef(false)
  const queued = React.useRef(false)
  const timer = React.useRef<ReturnType<typeof setTimeout>>(undefined)

  React.useEffect(() => {
    latest.current = value
    saveRef.current = save
  })

  const keepDraft = React.useCallback(
    (serialized: string) => {
      if (draftKey) localStorage.setItem(draftKey, serialized)
      setStatus("offline")
    },
    [draftKey]
  )

  const run = React.useCallback(async (): Promise<void> => {
    clearTimeout(timer.current)
    if (inFlight.current) {
      queued.current = true // picked up with the newest value once this save ends
      return
    }
    const target = latest.current
    const serialized = JSON.stringify(target)
    if (serialized === lastSaved.current) return
    if (!navigator.onLine) return keepDraft(serialized)
    inFlight.current = true
    setStatus("saving")
    try {
      await saveRef.current(target)
      lastSaved.current = serialized
      if (draftKey) localStorage.removeItem(draftKey)
      setSavedAt(Date.now())
      setError(undefined)
      setStatus("saved")
    } catch (err) {
      queued.current = false // stop and show Retry instead of hammering a failing server
      if (!navigator.onLine) keepDraft(serialized)
      else {
        setError(err instanceof Error ? err.message : undefined)
        setStatus("error")
      }
    } finally {
      inFlight.current = false
    }
    if (queued.current) {
      queued.current = false
      return run()
    }
  }, [draftKey, keepDraft])

  const serialized = JSON.stringify(value)
  React.useEffect(() => {
    if (serialized === lastSaved.current) return clearTimeout(timer.current)
    timer.current = setTimeout(() => void run(), delay)
    return () => clearTimeout(timer.current)
  }, [serialized, delay, run])

  const runRef = React.useRef(run)
  React.useEffect(() => {
    runRef.current = run
    const onOnline = () => void run()
    window.addEventListener("online", onOnline)
    return () => window.removeEventListener("online", onOnline)
  }, [run])

  // Leaving the screen mid-debounce must not drop the last edit.
  React.useEffect(() => () => void runRef.current(), [])

  React.useEffect(() => {
    if (!guardUnload) return
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (JSON.stringify(latest.current) === lastSaved.current) return
      event.preventDefault()
      event.returnValue = ""
    }
    window.addEventListener("beforeunload", onBeforeUnload)
    return () => window.removeEventListener("beforeunload", onBeforeUnload)
  }, [guardUnload])

  return { status, savedAt, error, retry: run, flush: run }
}

export interface SaveStatusProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "children"> {
  /** Current state, usually from `useAutosave`. */
  status: AutosaveStatus
  /** When the last successful save finished (ms epoch). */
  savedAt?: number
  /** Error detail shown after `errorLabel`, e.g. "Server returned 503". */
  error?: string
  /** Called by the Retry button. The button is hidden without it. */
  onRetry?: () => void
  /** Text before anything has changed. */
  idleLabel?: string
  /** Text while a save is in flight. */
  savingLabel?: string
  /** Text after a save; the age is appended ("Saved · 2 min ago"). */
  savedLabel?: string
  /** Offline text. Only claim "on this device" when a `draftKey` really keeps a copy. */
  offlineLabel?: string
  /** Text when the save failed. */
  errorLabel?: string
  /** Retry button text. */
  retryLabel?: string
}

const tone = {
  idle: "text-muted-foreground",
  saving: "text-muted-foreground",
  saved: "text-muted-foreground",
  offline: "text-amber-700 dark:text-amber-400",
  error: "text-red-700 dark:text-red-400",
} as const

/**
 * An honest autosave indicator. It ages its own "Saved · 2 min ago", tells
 * the truth when offline, and turns failures into a visible Retry instead of
 * a silent spinner, so nobody closes a tab believing work was saved.
 */
export function SaveStatus({
  status,
  savedAt,
  error,
  onRetry,
  idleLabel = "No changes yet",
  savingLabel = "Saving…",
  savedLabel = "Saved",
  offlineLabel = "Offline. Will save when you're back",
  errorLabel = "Not saved",
  retryLabel = "Retry",
  className,
  ...props
}: SaveStatusProps) {
  const [now, setNow] = React.useState<number>()

  React.useEffect(() => {
    setNow(Date.now())
    if (status !== "saved") return
    const id = setInterval(() => setNow(Date.now()), 15_000)
    return () => clearInterval(id)
  }, [status, savedAt])

  const text = {
    idle: idleLabel,
    saving: savingLabel,
    saved: savedAt && now ? `${savedLabel} · ${formatSavedAgo(savedAt, now)}` : savedLabel,
    offline: offlineLabel,
    error: error ? `${errorLabel}: ${error}` : errorLabel,
  }[status]
  const Icon = { idle: null, saving: LoaderCircle, saved: Check, offline: CloudOff, error: CircleAlert }[status]
  // Announce outcomes only: not every "Saving…" and not the ticking age.
  const announcement = status === "saved" ? savedLabel : status === "offline" ? offlineLabel : ""

  return (
    <div
      data-slot="save-status"
      data-state={status}
      className={cn("inline-flex min-w-0 flex-wrap items-center gap-2 text-sm", className)}
      {...props}
    >
      <span className="sr-only" aria-live="polite">
        {announcement}
      </span>
      <span className="sr-only" role="alert">
        {status === "error" ? text : ""}
      </span>
      <span
        aria-hidden={status === "error" || undefined}
        title={status === "saved" && savedAt && now ? new Date(savedAt).toLocaleString() : undefined}
        className={cn("inline-flex min-w-0 items-start gap-1.5", tone[status])}
      >
        {Icon && (
          <Icon
            aria-hidden
            className={cn(
              "mt-0.5 size-4 shrink-0",
              status === "saving" && "animate-spin",
              status === "saved" && "text-emerald-600 dark:text-emerald-400"
            )}
          />
        )}
        <span>{text}</span>
      </span>
      {status === "error" && onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md border bg-background px-3 text-sm font-medium outline-none transition-colors hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          <RotateCw aria-hidden className="size-4" />
          {retryLabel}
        </button>
      )}
    </div>
  )
}
