"use client"

import * as React from "react"
import { CircleAlert, TriangleAlert } from "lucide-react"

import { cn } from "@/lib/utils"

/** "si" counts in 1,000s (KB, MB, GB: macOS, phones, drive boxes); "iec" in 1,024s (KiB, MiB, GiB). */
export type UnitSystem = "si" | "iec"

const UNITS = { si: ["B", "KB", "MB", "GB", "TB", "PB"], iec: ["B", "KiB", "MiB", "GiB", "TiB", "PiB"] }
const PREFIXES = "kmgtp"

/** "4.7 GB", "4.38 GiB", "812 B". Three significant digits, never "1,000 KB". */
export function formatBytes(bytes: number, system: UnitSystem = "si", locale?: string) {
  const base = system === "si" ? 1000 : 1024
  let exp = bytes < base ? 0 : Math.min(5, Math.floor(Math.log(bytes) / Math.log(base)))
  if (exp < 5 && Number((bytes / base ** exp).toPrecision(3)) >= base) exp++
  const digits = exp === 0 ? { maximumFractionDigits: 0 } : { maximumSignificantDigits: 3 }
  return `${new Intl.NumberFormat(locale, digits).format(bytes / base ** exp)} ${UNITS[system][exp]}`
}

/**
 * Parses "2 GB", "500MiB", "1.5 t". `bytes` is the strict (smallest) reading; a unit
 * without the "i" is ambiguous because many services mean 1,024s anyway, so
 * `maxBytes` holds the 1,024-based reading too.
 */
export function parseSize(text: string): { bytes: number; maxBytes: number } | null {
  const match = text.trim().match(/^([\d.,]+)\s*([kmgtp]?)(i?)b?$/i)
  if (!match) return null
  const value = Number(match[1].replace(/,/g, ""))
  const exp = match[2] ? PREFIXES.indexOf(match[2].toLowerCase()) + 1 : 0
  if (!Number.isFinite(value)) return null
  const binary = value * 1024 ** exp
  return match[3] ? { bytes: binary, maxBytes: binary } : { bytes: value * 1000 ** exp, maxBytes: binary }
}

export interface SizeComparison {
  /** Typical size of one item in bytes. */
  bytes: number
  one: string
  other: string
}

/** Tried in order; the first that gives a count people can picture (2 to 10,000) wins. */
export const DEFAULT_COMPARISONS: SizeComparison[] = [
  { bytes: 4e6, one: "phone photo", other: "phone photos" },
  { bytes: 2e3, one: "page of text", other: "pages of text" },
  { bytes: 3e9, one: "hour of HD video", other: "hours of HD video" },
]

/** "about 1,200 phone photos": rounded to two significant digits so it never pretends to be exact. */
export function compareSize(bytes: number, comparisons = DEFAULT_COMPARISONS, locale?: string) {
  const pick = comparisons.find((c) => bytes / c.bytes >= 2 && bytes / c.bytes <= 10_000)
  if (!pick) return null
  const count = Number((bytes / pick.bytes).toPrecision(2))
  return `about ${new Intl.NumberFormat(locale).format(count)} ${count === 1 ? pick.one : pick.other}`
}

/** "40 s", "6 min", "2 h 5 min". */
export function formatDuration(seconds: number) {
  if (seconds < 60) return `${Math.max(1, Math.round(seconds))} s`
  const minutes = Math.round(seconds / 60)
  return minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)} h${minutes % 60 ? ` ${minutes % 60} min` : ""}`
}

const fill = (template: string, values: Record<string, string>) => template.replace(/\{(\w+)\}/g, (m, k: string) => values[k] ?? m)

export interface SizeContextProps extends Omit<React.ComponentProps<"div">, "children"> {
  /** Exact size in bytes. */
  bytes: number
  /** Unit system for the headline. The other system is one tap away. */
  system?: UnitSystem
  /** Upload limit: bytes, or text like "4 GB" (treated as ambiguous) or "4 GiB" (exact). */
  limit?: number | string
  /** Connection speed in bits per second. Without it, the browser's own estimate is used where available. */
  bitsPerSecond?: number
  /** Override platform detection, which decides whether to say what Windows Explorer will show. */
  platform?: "windows" | "other"
  /** Typical item sizes used for the comparison. */
  comparisons?: SizeComparison[]
  /** Locale for number formatting. */
  locale?: string
  /** Templates: `{size}`, `{alt}`, `{limit}`, `{over}`, `{left}`, `{time}`, `{speed}`, `{binary}`, `{limitBinary}`, `{exact}` are filled in. */
  transferText?: string
  /** Says what Windows will show. */
  windowsText?: string
  /** Explanation of GB versus GiB. */
  explainText?: string
  /** Shown when the file is over the limit. */
  overText?: string
  /** Shown when it fits only if the limit means GiB. */
  ambiguousText?: string
  /** Shown when the file fits. */
  fitsText?: string
}

/**
 * Stops "will it fit?" guesses going wrong. Shows a size with a picture-able
 * comparison and a transfer time, puts GB and GiB side by side (and says what
 * Windows, which counts in 1,024s but writes "GB", will show), and checks an
 * upload limit before it starts, including the grey zone where a "4 GB" limit
 * only fits if the service secretly means 4 GiB.
 */
export function SizeContext({
  bytes,
  system = "si",
  limit,
  bitsPerSecond,
  platform,
  comparisons,
  locale,
  transferText = "~{time} at {speed}",
  windowsText = "Windows shows this as {binary}.",
  explainText = "Both mean the same {exact} bytes. GB counts in 1,000s (macOS, phones, drive boxes); GiB counts in 1,024s. Windows counts in 1,024s but still writes “GB”.",
  overText = "Over the {limit} limit by {over}. Compress or split it before uploading.",
  ambiguousText = "Over {limit} if the limit counts in 1,000s, under it if it counts in 1,024s ({limitBinary}). Check before uploading.",
  fitsText = "Fits: {left} under the {limit} limit.",
  className,
  ...props
}: SizeContextProps) {
  const [open, setOpen] = React.useState(false)
  const [detected, setDetected] = React.useState<{ windows: boolean; bps?: number; capped: boolean }>()
  const [shown, setShown] = React.useState(false)
  const explainId = React.useId()

  React.useEffect(() => {
    const nav = navigator as Navigator & { connection?: { downlink?: number }; userAgentData?: { platform?: string } }
    const downlink = nav.connection?.downlink
    // Chromium caps `downlink` at 10 Mbps for privacy, so a 10 reading means "at least 10".
    setDetected({
      windows: /win/i.test(nav.userAgentData?.platform ?? navigator.platform),
      bps: downlink ? downlink * 1e6 : undefined,
      capped: downlink !== undefined && downlink >= 10,
    })
    requestAnimationFrame(() => setShown(true))
  }, [])

  const other: UnitSystem = system === "si" ? "iec" : "si"
  const size = formatBytes(bytes, system, locale)
  const alt = formatBytes(bytes, other, locale)
  const binary = formatBytes(bytes, "iec", locale).replace("i", "")
  const comparison = compareSize(bytes, comparisons, locale)
  const bps = bitsPerSecond ?? detected?.bps
  const capped = bitsPerSecond === undefined && detected?.capped
  const time = bps ? `${capped ? "≤" : ""}${formatDuration((bytes * 8) / bps)}` : ""
  const speed = bitsPerSecond ? `${new Intl.NumberFormat(locale, { maximumSignificantDigits: 3 }).format(bitsPerSecond / 1e6)} Mbps` : "your connection"
  const onWindows = platform ? platform === "windows" : detected?.windows
  const exact = new Intl.NumberFormat(locale).format(bytes)

  const parsed = typeof limit === "string" ? parseSize(limit) : limit === undefined ? null : { bytes: limit, maxBytes: limit }
  const limitLabel = typeof limit === "string" ? limit : limit === undefined ? "" : formatBytes(limit, system, locale)
  const state = !parsed ? null : bytes > parsed.maxBytes ? "over" : bytes > parsed.bytes ? "ambiguous" : "fits"
  const values = {
    size, alt, binary, exact, time, speed, limit: limitLabel,
    // Measured against the strict reading, so following the advice always works.
    over: parsed ? formatBytes(bytes - parsed.bytes, system, locale) : "",
    left: parsed ? formatBytes(parsed.bytes - bytes, system, locale) : "",
    limitBinary: parsed ? formatBytes(parsed.maxBytes, "iec", locale) : "",
  }
  const scale = parsed ? Math.max(bytes, parsed.maxBytes) * 1.05 : 1

  return (
    <div data-slot="size-context" data-state={state ?? undefined} className={cn("grid w-full max-w-sm gap-1.5", className)} {...props}>
      <p className="flex flex-wrap items-baseline gap-x-2">
        <span className="text-2xl font-semibold tabular-nums" title={`${exact} bytes`}>
          {size}
        </span>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={explainId}
          onClick={() => setOpen((v) => !v)}
          className="rounded-md px-1 text-sm text-muted-foreground tabular-nums underline decoration-dotted underline-offset-4 transition-colors outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          = {alt}
        </button>
      </p>
      {(comparison || time) && (
        <p className="text-sm text-muted-foreground">{[comparison, time && fill(transferText, values)].filter(Boolean).join(" · ")}</p>
      )}
      <div id={explainId} hidden={!open && !(onWindows && system === "si")} className="text-xs text-muted-foreground">
        {onWindows && system === "si" && <p>{fill(windowsText, values)}</p>}
        {open && <p className="mt-1">{fill(explainText, values)}</p>}
      </div>

      {parsed && (
        <>
          <div aria-hidden className="relative mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className={cn(
                "h-full rounded-full motion-safe:transition-[width] motion-safe:duration-300 motion-safe:ease-out",
                state === "over" ? "bg-red-600 dark:bg-red-500" : state === "ambiguous" ? "bg-amber-500" : "bg-emerald-600 dark:bg-emerald-500",
              )}
              style={{ width: shown ? `${(bytes / scale) * 100}%` : 0 }}
            />
            <div className="absolute inset-y-0 w-0.5 bg-foreground/70" style={{ left: `${(parsed.bytes / scale) * 100}%` }} />
            {parsed.maxBytes > parsed.bytes && (
              <div className="absolute inset-y-0 w-0.5 bg-foreground/35" style={{ left: `${(parsed.maxBytes / scale) * 100}%` }} />
            )}
          </div>
          <div aria-live="polite" className="text-xs">
            {state === "over" ? (
              <p role="alert" className="flex gap-1.5 text-red-700 dark:text-red-400">
                <CircleAlert aria-hidden className="mt-px size-3.5 shrink-0" />
                {fill(overText, values)}
              </p>
            ) : state === "ambiguous" ? (
              <p className="flex gap-1.5 text-amber-700 dark:text-amber-400">
                <TriangleAlert aria-hidden className="mt-px size-3.5 shrink-0" />
                {fill(ambiguousText, values)}
              </p>
            ) : (
              <p className="text-muted-foreground">{fill(fitsText, values)}</p>
            )}
          </div>
        </>
      )}
    </div>
  )
}
