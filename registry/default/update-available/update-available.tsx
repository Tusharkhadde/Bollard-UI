"use client"

// Bollard UI — update-available · MIT licence · https://bollard-ui.vercel.app/components/update-available

import * as React from "react"
import { CircleArrowUp, Clock, RefreshCw } from "lucide-react"

import { cn } from "@/lib/utils"

/** Banner layout shared by every Bollard UI banner: one height, padding, icon size and action style. */
const bar = "flex min-h-11 flex-wrap items-center gap-x-3 gap-y-1.5 px-3 py-1.5 text-sm"
const action =
  "inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-md px-3 text-sm font-medium whitespace-nowrap outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-60"
/** Banner tones, identical across Bollard UI banners. */
const tones = {
  warning: {
    surface: "border-amber-500/30 bg-background bg-linear-to-r from-amber-500/10 to-amber-500/10 text-amber-950 dark:text-amber-50",
    icon: "text-amber-600 dark:text-amber-400",
    muted: "text-amber-900/75 dark:text-amber-100/75",
    solid: "bg-amber-700 text-white hover:bg-amber-800 dark:bg-amber-400 dark:text-amber-950 dark:hover:bg-amber-300",
    outline: "border border-amber-700/25 hover:bg-amber-500/15 dark:border-amber-300/25",
  },
  info: {
    surface: "border-sky-500/30 bg-background bg-linear-to-r from-sky-500/10 to-sky-500/10 text-sky-950 dark:text-sky-50",
    icon: "text-sky-600 dark:text-sky-400",
    muted: "text-sky-900/75 dark:text-sky-100/75",
    solid: "bg-sky-700 text-white hover:bg-sky-800 dark:bg-sky-400 dark:text-sky-950 dark:hover:bg-sky-300",
    outline: "border border-sky-700/25 hover:bg-sky-500/15 dark:border-sky-300/25",
  },
} as const

/** Reads a build id from a version endpoint payload: a string, or `{ version | buildId | sha | hash | id }`. */
export function readVersion(payload: unknown): string | undefined {
  if (typeof payload === "string") return payload.trim() || undefined
  if (payload && typeof payload === "object") {
    const record = payload as Record<string, unknown>
    const value = record.version ?? record.buildId ?? record.sha ?? record.hash ?? record.id
    return typeof value === "string" || typeof value === "number" ? String(value) : undefined
  }
}

/**
 * Polls `url` for the deployed build id while the tab is visible, and again on
 * focus. A failed or unreadable response leaves the last known value alone, so
 * a flaky endpoint never invents an update.
 */
export function useDeployedVersion(url: string | undefined, interval = 5 * 60_000) {
  const [version, setVersion] = React.useState<string>()
  React.useEffect(() => {
    if (!url) return
    const check = async () => {
      if (document.hidden) return
      try {
        const response = await fetch(url, { cache: "no-store" })
        if (!response.ok) return
        const text = await response.text()
        let payload: unknown = text
        try {
          payload = JSON.parse(text)
        } catch {}
        const next = readVersion(payload)
        if (next) setVersion(next)
      } catch {}
    }
    check()
    const id = setInterval(check, interval)
    document.addEventListener("visibilitychange", check)
    window.addEventListener("focus", check)
    return () => {
      clearInterval(id)
      document.removeEventListener("visibilitychange", check)
      window.removeEventListener("focus", check)
    }
  }, [url, interval])
  return version
}

export interface UpdateAvailableProps extends Omit<React.ComponentProps<"div">, "children"> {
  /** The build this page is running, baked in at build time. */
  currentVersion: string
  /** The deployed build, if you learn it yourself (websocket, service worker). Wins over `versionUrl`. */
  latestVersion?: string
  /** Endpoint to poll for the deployed build id, e.g. "/version.json". */
  versionUrl?: string
  /** How often to poll `versionUrl`, in ms. */
  pollInterval?: number
  /** There are unsaved changes. The banner never refreshes while this is true. */
  dirty?: boolean
  /** Loads the new version. Defaults to `location.reload()`. */
  onRefresh?: () => void
  /** One line on what's new, e.g. "Fixes rounding on invoice totals." */
  whatsNew?: React.ReactNode
  /** Main banner text. */
  message?: string
  /** What refreshing does, shown before anyone presses it. */
  explainText?: string
  /** Shown when unsaved changes hold the refresh. */
  dirtyText?: string
  /** Shown once refresh-after-save is armed. */
  armedText?: string
  /** Label of the Refresh button. */
  refreshLabel?: string
  /** Label of the refresh-after-I-save button. */
  refreshAfterSaveLabel?: string
  /** Label of the cancel-armed button. */
  cancelLabel?: string
  /** Label of the Later button. */
  laterLabel?: string
  /** Accessible name of the banner. */
  regionLabel?: string
}

/**
 * Gets people onto a new deploy without costing them their work. It explains
 * what a refresh does before they press it, refuses to refresh while there
 * are unsaved changes and instead offers "Refresh after I save", which waits
 * for the save and then reloads. "Later" only hides this build, so the next
 * deploy still asks. An unknown version on either side shows nothing.
 */
export function UpdateAvailable({
  currentVersion,
  latestVersion,
  versionUrl,
  pollInterval,
  dirty = false,
  onRefresh = () => location.reload(),
  whatsNew,
  message = "A new version is available.",
  explainText = "Refreshing reloads this page in about a second. You stay where you are and everything saved is kept.",
  dirtyText = "You have unsaved changes, so it won't refresh yet. Refreshing now would lose them.",
  armedText = "Will refresh as soon as your changes are saved.",
  refreshLabel = "Refresh",
  refreshAfterSaveLabel = "Refresh after I save",
  cancelLabel = "Cancel",
  laterLabel = "Later",
  regionLabel = "Update available",
  className,
  ...props
}: UpdateAvailableProps) {
  const polled = useDeployedVersion(latestVersion === undefined ? versionUrl : undefined, pollInterval)
  const latest = latestVersion ?? polled
  const [dismissed, setDismissed] = React.useState<string>()
  const [armed, setArmed] = React.useState(false)
  const refreshRef = React.useRef(onRefresh)
  React.useEffect(() => {
    refreshRef.current = onRefresh
  })

  // The safe moment: the save that was holding the refresh back just finished.
  React.useEffect(() => {
    if (armed && !dirty) {
      setArmed(false)
      refreshRef.current()
    }
  }, [armed, dirty])

  if (!latest || !currentVersion || latest === currentVersion || dismissed === latest) return null

  const tone = dirty && !armed ? tones.warning : tones.info
  const Icon = armed ? Clock : CircleArrowUp

  return (
    <div
      data-slot="update-available"
      data-state={armed ? "armed" : dirty ? "blocked" : "ready"}
      role="region"
      aria-label={regionLabel}
      className={cn("overflow-hidden rounded-lg border transition-colors", tone.surface, className)}
      {...props}
    >
      <div className={cn(bar, "items-start py-2")}>
        <div className="flex min-w-0 flex-1 basis-56 items-start gap-3">
          <Icon aria-hidden className={cn("mt-0.5 size-4 shrink-0", tone.icon)} />
          <div className="min-w-0 flex-1" aria-live="polite">
            <p className="font-medium">{message}</p>
            {whatsNew && <p className="mt-0.5">{whatsNew}</p>}
            <p className={cn("mt-0.5 text-xs", tone.muted)}>{armed ? armedText : dirty ? dirtyText : explainText}</p>
          </div>
        </div>
        <div className="ml-auto flex flex-wrap justify-end gap-2">
          {armed ? (
            <button type="button" onClick={() => setArmed(false)} className={cn(action, tone.outline)}>
              {cancelLabel}
            </button>
          ) : (
            <>
              <button type="button" onClick={() => setDismissed(latest)} className={cn(action, tone.outline)}>
                {laterLabel}
              </button>
              <button type="button" onClick={() => (dirty ? setArmed(true) : onRefresh())} className={cn(action, tone.solid)}>
                {!dirty && <RefreshCw aria-hidden className="size-4" />}
                {dirty ? refreshAfterSaveLabel : refreshLabel}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
