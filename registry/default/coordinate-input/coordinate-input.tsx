"use client"

import * as React from "react"
import { ExternalLink, MapPin, TriangleAlert } from "lucide-react"

import { cn } from "@/lib/utils"
import {
  distanceKm,
  findCoordinateSlip,
  formatDecimal,
  formatDms,
  osmUrl,
  parseCoordinates,
  type LatLon,
} from "@/registry/default/coordinate-input/coordinates"

export * from "@/registry/default/coordinate-input/coordinates"

/** Default messages. `{km}`, `{area}` and `{point}` are filled in. */
export const COORDINATE_MESSAGES = {
  unreadable: "Couldn't read that. Try 18.5204, 73.8567, or 18°31'13\"N 73°51'24\"E, or paste a map link.",
  "short-link": "Short links hide the coordinates. Open it and copy the full link from the address bar.",
  labels: "One part should be N or S and the other E or W.",
  minutes: "Minutes and seconds only go up to 59.",
  "lat-range": "Latitude only goes up to 90°. Latitude and longitude look swapped.",
  "lon-range": "Longitude only goes up to 180°.",
  swapped: "That's {km} km from {area}. Latitude and longitude look swapped.",
  south: "That's south of the equator, {km} km from {area}. Missing an N, or an extra minus?",
  west: "That's {km} km from {area}. Is the east/west sign flipped?",
  both: "That's {km} km from {area}. Both signs look flipped.",
  outside: "That's {km} km from {area}, outside the expected area.",
  nullIsland: "0, 0 is open sea off West Africa, usually a blank value saved as a location.",
  pin: "map pin",
  centre: "This is where the map was centred, not a pin. Drop a pin and copy that link for the exact spot.",
  use: "Use {point}",
  swap: "Swap them",
  open: "Open in OpenStreetMap",
  area: "the expected area",
}

export interface CoordinateInputProps
  extends Omit<React.ComponentProps<"input">, "value" | "defaultValue" | "onChange" | "type"> {
  /** Visible label. */
  label?: string
  /** Controlled text, as typed or pasted. */
  value?: string
  /** Initial text when uncontrolled. */
  defaultValue?: string
  /** Called with the text and the point, or null while it can't be read or is out of range. */
  onValueChange?: (text: string, point: LatLon | null) => void
  /** Where points should usually be. Enables the swapped and flipped-sign checks. */
  expectedArea?: LatLon & { radiusKm: number; name?: string }
  /** Helper text shown while the field is empty. */
  hint?: string
  /** Override any of the default messages. */
  messages?: Partial<typeof COORDINATE_MESSAGES>
}

const fieldClass =
  "h-9 w-full min-w-0 rounded-md border bg-transparent px-3 text-base shadow-xs transition-[color,box-shadow] outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm dark:bg-input/30 aria-invalid:border-destructive data-warning:border-amber-500 dark:data-warning:border-amber-400"
const fixClass =
  "inline-flex h-6 items-center gap-1 rounded-md border border-amber-500/40 px-2 font-medium text-amber-900 transition-colors hover:bg-amber-500/10 dark:text-amber-200 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
const keyframes = `@keyframes cui-coordinate-input-flash{0%{background-color:rgb(16 185 129 / .3)}100%{background-color:transparent}}`

const fill = (template: string, values: Record<string, string>) =>
  template.replace(/\{(\w+)\}/g, (match, key: string) => values[key] ?? match)
const meters = (m: number) => (m < 1 ? "±1 m" : m < 1000 ? `±${Math.round(m)} m` : `±${Number((m / 1000).toFixed(1))} km`)

/**
 * A latitude/longitude field that reads decimal degrees, DMS and DDM, or a pasted Google Maps,
 * OpenStreetMap or geo: link (taking the dropped pin, not the map's centre). It catches the slips that
 * put a pin on the wrong continent: latitude and longitude swapped, a missing minus for west or south
 * (checked against an expected area), out-of-range values and the 0, 0 "Null Island" default. Every
 * reading is spelled out with its precision and an OpenStreetMap link to look before saving.
 */
export function CoordinateInput({
  label = "Coordinates",
  value,
  defaultValue = "",
  onValueChange,
  expectedArea,
  hint,
  messages,
  placeholder = "18.5204, 73.8567",
  id,
  className,
  ref,
  ...props
}: CoordinateInputProps) {
  const [inner, setInner] = React.useState(defaultValue)
  const [flash, setFlash] = React.useState(0)
  const autoId = React.useId()
  const inputId = id ?? autoId
  const text = value ?? inner
  const t = { ...COORDINATE_MESSAGES, ...messages }
  const result = parseCoordinates(text)

  const commit = (next: string) => {
    const parsed = parseCoordinates(next)
    if (value === undefined) setInner(next)
    onValueChange?.(next, parsed.kind === "ok" ? { lat: parsed.lat, lon: parsed.lon } : null)
  }
  const apply = (point: LatLon) => {
    commit(`${Number(point.lat.toFixed(6))}, ${Number(point.lon.toFixed(6))}`)
    setFlash((n) => n + 1)
  }

  const point = result.kind === "ok" ? { lat: result.lat, lon: result.lon } : null
  const slip = point && expectedArea ? findCoordinateSlip(point, expectedArea) : null
  const values = {
    km: point && expectedArea ? Math.round(distanceKm(point, expectedArea)).toLocaleString("en") : "",
    area: expectedArea?.name ?? t.area,
  }
  let warning: { message: string; fix?: LatLon; fixLabel?: string } | null = null
  if (result.kind === "error" && result.fix) warning = { message: t["lat-range"], fix: result.fix, fixLabel: t.swap }
  else if (point && Math.abs(point.lat) < 1e-4 && Math.abs(point.lon) < 1e-4) warning = { message: t.nullIsland }
  else if (slip) {
    warning = {
      message: fill(t[slip.slip], values),
      fix: slip.fix,
      fixLabel: slip.slip === "swapped" ? t.swap : fill(t.use, { point: formatDecimal(slip.fix, 4) }),
    }
  } else if (point && expectedArea && distanceKm(point, expectedArea) > expectedArea.radiusKm) warning = { message: fill(t.outside, values) }
  const error = result.kind === "error" && !result.fix ? t[result.code] : null

  return (
    <div data-slot="coordinate-input" className={cn("grid w-full max-w-sm gap-1.5", className)}>
      <style>{keyframes}</style>
      <label htmlFor={inputId} className="w-fit text-sm font-medium">
        {label}
      </label>
      <input
        ref={ref}
        id={inputId}
        type="text"
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        value={text}
        placeholder={placeholder}
        onChange={(event) => commit(event.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={`${inputId}-status`}
        data-warning={warning ? "" : undefined}
        className={fieldClass}
        {...props}
      />
      <div id={`${inputId}-status`} aria-live="polite" className="grid min-h-6 gap-1 text-xs">
        {error ? (
          <p className="flex gap-1.5 py-1 text-destructive">
            <TriangleAlert aria-hidden className="mt-px size-3.5 shrink-0" />
            {error}
          </p>
        ) : point && result.kind === "ok" ? (
          <div
            key={flash}
            className={cn("grid w-fit gap-0.5 rounded-sm py-1 pr-1", flash > 0 && "motion-safe:animate-[cui-coordinate-input-flash_400ms_ease-out]")}
          >
            <p className="flex items-center gap-1.5">
              <MapPin aria-hidden className="size-3.5 shrink-0 text-muted-foreground" />
              <span className="font-medium tabular-nums">{formatDecimal(point, 6)}</span>
              <span className="text-muted-foreground">
                {meters(result.precision)}
                {result.source === "pin" && <> · {t.pin}</>}
              </span>
            </p>
            <p className="flex flex-wrap items-center gap-x-2 pl-5 text-muted-foreground">
              <span className="tabular-nums">{formatDms(point)}</span>
              <a
                href={osmUrl(point)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded-sm font-medium text-foreground underline-offset-2 hover:underline outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                {t.open}
                <ExternalLink aria-hidden className="size-3" />
              </a>
            </p>
            {result.source === "centre" && <p className="pl-5 text-muted-foreground">{t.centre}</p>}
          </div>
        ) : !warning && hint ? (
          <p className="py-1 text-muted-foreground">{hint}</p>
        ) : null}
        {warning && (
          <p className="flex gap-1.5 text-amber-700 dark:text-amber-400">
            <span className="flex h-6 shrink-0 items-center">
              <TriangleAlert aria-hidden className="size-3.5" />
            </span>
            <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
              <span className="py-1">{warning.message}</span>
              {warning.fix && (
                <button type="button" onClick={() => apply(warning.fix as LatLon)} className={fixClass}>
                  {warning.fixLabel}
                </button>
              )}
            </span>
          </p>
        )}
      </div>
    </div>
  )
}
