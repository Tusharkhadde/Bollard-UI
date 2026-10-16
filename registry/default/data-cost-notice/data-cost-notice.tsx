"use client"

import * as React from "react"
import { Feather, Signal, SignalLow, Wifi } from "lucide-react"

import { cn } from "@/lib/utils"

const bar = "flex min-h-11 flex-wrap items-center gap-x-3 gap-y-1.5 px-3 py-1.5 text-sm"
const action =
  "inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-md px-3 text-sm font-medium whitespace-nowrap outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-60"
/** The Bollard UI warning tone. */
const tone = {
  surface: "border-amber-500/30 bg-background bg-linear-to-r from-amber-500/10 to-amber-500/10 text-amber-950 dark:text-amber-50",
  icon: "text-amber-600 dark:text-amber-400",
  muted: "text-amber-900/75 dark:text-amber-100/75",
  solid: "bg-amber-700 text-white hover:bg-amber-800 dark:bg-amber-400 dark:text-amber-950 dark:hover:bg-amber-300",
  outline: "border border-amber-700/25 hover:bg-amber-500/15 dark:border-amber-300/25",
}

/** The parts of the Network Information API this reads (Chromium only). */
export interface ConnectionInfo {
  /** "cellular", "wifi", "ethernet"… (reported on Android and ChromeOS only). */
  type?: string
  effectiveType?: "slow-2g" | "2g" | "3g" | "4g"
  /** Mbps. Chrome caps it at 10, so 10 means "10 or more". */
  downlink?: number
  /** Round trip in ms. */
  rtt?: number
  /** The user turned on Data Saver / Save-Data. */
  saveData?: boolean
}

export type TransferDirection = "download" | "upload"
export type DataCostReason = "save-data" | "cellular" | "slow"

/** Speeds the NetInfo spec gives for each effective type, used when `downlink` is missing. */
const typical: Record<string, { downlink: number; rtt: number }> = {
  "slow-2g": { downlink: 0.05, rtt: 2000 },
  "2g": { downlink: 0.07, rtt: 1400 },
  "3g": { downlink: 0.7, rtt: 270 },
}

/**
 * Rough transfer time. `bound` says how to read it: "under" when the speed hit
 * Chrome's 10 Mbps cap (it is faster than reported), "over" for uploads (upload
 * speed isn't measured and is usually slower), "about" otherwise.
 */
export function estimateTransfer(bytes: number, connection: ConnectionInfo, direction: TransferDirection = "download") {
  const fallback = typical[connection.effectiveType ?? ""]
  const downlink = connection.downlink || fallback?.downlink
  if (!downlink) return { seconds: undefined, bound: "about" as const }
  const seconds = (connection.rtt ?? fallback?.rtt ?? 0) / 1000 + (bytes * 8) / (downlink * 1e6)
  const bound = direction === "upload" ? ("over" as const) : downlink >= 10 ? ("under" as const) : ("about" as const)
  return { seconds, bound }
}

/**
 * Why a transfer of `bytes` deserves a warning on this connection, or undefined
 * when it doesn't. A speed at Chrome's 10 Mbps cap is never called slow: the
 * real line may be much faster.
 */
export function dataCostReason(bytes: number, connection: ConnectionInfo, { minBytes = 20e6, slowSeconds = 60 } = {}): DataCostReason | undefined {
  const large = bytes >= minBytes
  if (large && connection.saveData) return "save-data"
  if (large && connection.type === "cellular") return "cellular"
  const { seconds, bound } = estimateTransfer(bytes, connection)
  if (seconds !== undefined && bound !== "under" && seconds > slowSeconds) return "slow"
  if (large && connection.effectiveType && connection.effectiveType !== "4g") return "slow"
}

/** 480_000_000 → "480 MB". Decimal units, like data plans. */
export function formatBytes(bytes: number) {
  if (bytes >= 1e9) return `${(bytes / 1e9).toFixed(bytes >= 1e10 ? 0 : 1)} GB`
  return bytes >= 1e6 ? `${Math.round(bytes / 1e6)} MB` : `${Math.max(1, Math.round(bytes / 1e3))} kB`
}

/** "~40 s", "under 2 min", "over 1 h 5 min". */
export function formatTransfer({ seconds, bound }: ReturnType<typeof estimateTransfer>) {
  if (seconds === undefined) return ""
  const s = Math.max(1, Math.ceil(seconds))
  const text = s < 60 ? `${Math.ceil(s / 5) * 5} s` : s < 3600 ? `${Math.ceil(s / 60)} min` : `${Math.floor(s / 3600)} h ${Math.ceil((s % 3600) / 60)} min`
  return bound === "about" ? `~${text}` : `${bound} ${text}`
}

/** Follows `navigator.connection`. undefined where the API doesn't exist (Safari, Firefox) or before mount. */
export function useConnection() {
  const [info, setInfo] = React.useState<ConnectionInfo>()
  React.useEffect(() => {
    const connection = (navigator as Navigator & { connection?: ConnectionInfo & EventTarget }).connection
    if (!connection) return
    const read = () => setInfo({ type: connection.type, effectiveType: connection.effectiveType, downlink: connection.downlink, rtt: connection.rtt, saveData: connection.saveData })
    read()
    connection.addEventListener("change", read)
    return () => connection.removeEventListener("change", read)
  }, [])
  return info
}

const fill = (template: string, values: Record<string, string>) =>
  template.replace(/\{(\w+)\}/g, (match, key: string) => values[key] ?? match)

export interface DataCostNoticeProps extends Omit<React.ComponentProps<"div">, "children"> {
  /** Size of the full version in bytes. */
  bytes: number
  /** Name of the full version, e.g. "1080p". */
  label: string
  /** A smaller alternative: lower quality, compressed, audio only. */
  lighter?: { label: string; bytes: number }
  /** Uploads are estimated as "over" the time, since upload speed isn't measured. */
  direction?: TransferDirection
  /** Verb for the detail line; defaults to "Downloading"/"Uploading". Use "Playing" for autoplay. */
  verb?: string
  /** Override the browser's reading, e.g. from a `Save-Data: on` request header or a native shell. */
  connection?: ConnectionInfo
  /** The user picked a version. A deferred choice arrives once the connection stops being a concern. */
  onChoose: (choice: "full" | "lighter") => void
  /** Transfers smaller than this only warn when they'd be slow. */
  minBytes?: number
  /** Transfers slower than this always warn, in seconds. */
  slowSeconds?: number
  /** Templates: `{verb}`, `{label}`, `{size}`, `{time}`, `{type}` (e.g. "3G") are filled in; `savesText` takes `{saved}`. */
  saveDataTitle?: string
  cellularTitle?: string
  slowTitle?: string
  detailText?: string
  timeText?: string
  savesText?: string
  waitLabel?: string
  waitingText?: string
  fullLabel?: string
  cancelLabel?: string
}

/**
 * Stops a big download, upload or autoplay eating someone's data plan or
 * hanging on a slow line. On Data Saver, mobile data or a slow connection it
 * says what the transfer costs in size and rough time (reading Chrome's 10 Mbps
 * cap and unmeasured upload speed honestly), offers the lighter version with
 * what it saves, or waits for Wi-Fi and then goes ahead by itself.
 */
export function DataCostNotice({
  bytes,
  label,
  lighter,
  direction = "download",
  verb = direction === "upload" ? "Uploading" : "Downloading",
  connection: connectionProp,
  onChoose,
  minBytes,
  slowSeconds,
  saveDataTitle = "Data Saver is on",
  cellularTitle = "You're on mobile data",
  slowTitle = "Slow connection ({type})",
  detailText = "{verb} {label} uses {size}",
  timeText = "{time} at this speed",
  savesText = "saves {saved}",
  waitLabel = "Wait for Wi-Fi",
  waitingText = "Waiting for Wi-Fi · {label} starts once you're on it",
  fullLabel = "{label} anyway",
  cancelLabel = "Cancel",
  className,
  ...props
}: DataCostNoticeProps) {
  const browser = useConnection()
  const connection = connectionProp ?? browser
  const [waiting, setWaiting] = React.useState(false)
  const detailRef = React.useRef<HTMLParagraphElement>(null)
  const reason = connection ? dataCostReason(bytes, connection, { minBytes, slowSeconds }) : undefined
  const time = connection ? formatTransfer(estimateTransfer(bytes, connection, direction)) : ""

  // Waiting for Wi-Fi: go ahead as soon as the connection stops being a concern.
  React.useEffect(() => {
    if (!waiting || reason) return
    setWaiting(false)
    onChoose("full")
  }, [waiting, reason, onChoose])

  // Flash the estimate when the connection changes under the user.
  const seenTime = React.useRef(time)
  React.useEffect(() => {
    if (seenTime.current === time) return
    seenTime.current = time
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return
    detailRef.current?.animate([{ backgroundColor: "rgb(245 158 11 / 0.35)" }, { backgroundColor: "transparent" }], { duration: 400, easing: "ease-out" })
  }, [time])

  if (!connection || !reason) return null

  const values = { verb, label, size: formatBytes(bytes), time, type: connection.effectiveType?.toUpperCase() ?? "slow" }
  const title = { "save-data": saveDataTitle, cellular: cellularTitle, slow: slowTitle }[reason]
  const Icon = reason === "save-data" ? Feather : reason === "cellular" ? Signal : SignalLow
  const lighterTime = lighter ? formatTransfer(estimateTransfer(lighter.bytes, connection, direction)) : ""
  const option = "flex w-full flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 rounded-md px-3 py-2 text-left text-sm outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50"

  return (
    <div data-slot="data-cost-notice" data-state={waiting ? "waiting" : reason} className={cn("overflow-hidden rounded-lg border", tone.surface, className)} {...props}>
      <div className={bar}>
        <div className="flex min-w-0 flex-1 basis-64 items-start gap-3">
          <Icon aria-hidden className={cn("mt-0.5 size-4 shrink-0", tone.icon, waiting && "motion-safe:animate-pulse")} />
          <div className="min-w-0 flex-1" role="status">
            <p className="font-medium">{waiting ? fill(waitingText, values) : fill(title, values)}</p>
            {!waiting && (
              <p ref={detailRef} className={cn("rounded-sm text-xs tabular-nums", tone.muted)}>
                {fill(detailText, values)}
                {time && `, ${fill(timeText, values)}`}
              </p>
            )}
          </div>
        </div>
        <div className="ml-auto flex flex-wrap justify-end gap-2">
          {waiting ? (
            <button type="button" onClick={() => setWaiting(false)} className={cn(action, tone.outline)}>
              {cancelLabel}
            </button>
          ) : (
            reason === "cellular" && (
              <button type="button" onClick={() => setWaiting(true)} className={cn(action, tone.outline)}>
                <Wifi aria-hidden className="size-4" />
                {waitLabel}
              </button>
            )
          )}
        </div>
      </div>
      {!waiting && (
        <div role="group" aria-label="Choose a version" className="grid gap-1.5 px-3 pb-3">
          {lighter && (
            <button type="button" onClick={() => onChoose("lighter")} className={cn(option, tone.solid)}>
              <span className="min-w-0 font-medium">{lighter.label}</span>
              <span className="text-xs tabular-nums opacity-90">
                {formatBytes(lighter.bytes)}
                {lighterTime && ` · ${lighterTime}`} · {fill(savesText, { saved: formatBytes(Math.max(0, bytes - lighter.bytes)) })}
              </span>
            </button>
          )}
          <button type="button" onClick={() => onChoose("full")} className={cn(option, tone.outline)}>
            <span className="min-w-0 font-medium">{fill(fullLabel, values)}</span>
            <span className={cn("text-xs tabular-nums", tone.muted)}>
              {values.size}
              {time && ` · ${time}`}
            </span>
          </button>
        </div>
      )}
    </div>
  )
}
