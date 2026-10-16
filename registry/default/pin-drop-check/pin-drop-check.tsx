"use client"

import * as React from "react"
import { CircleAlert, CircleCheck, House, LoaderCircle, MapPin } from "lucide-react"

import { cn } from "@/lib/utils"
import { checkPin, distanceMeters, formatDistance, isValidPoint, type LatLng, type PinIssue, type PinSurface } from "./pin-geo"

export { checkPin, distanceMeters, formatDistance, isValidPoint, type LatLng, type PinCheckInput, type PinIssue, type PinSurface } from "./pin-geo"

const DEFAULT_MESSAGES = {
  noPin: "Drop a pin on your door so the rider finds it.",
  far: "The pin is {distance} from {address}.",
  outsidePincode: "The pin is outside PIN {pincode}, {distance} from its centre.",
  water: "The pin is in water. Move it to your building's entrance.",
  highway: "The pin is on a highway, where riders can't stop. Move it to the nearest gate.",
  matches: "Pin and address agree ({distance} apart).",
  pinOnly: "Pin dropped. Add the address to double-check it.",
  label: "Delivery location check",
  checking: "Checking where the pin landed…",
  question: "Use pin or address?",
  usePin: "Use pin",
  usePinHint: "Rider goes to the pin",
  useAddress: "Use address",
  pinLabel: "Pin",
  addressLabel: "Address",
  mapLabel: "Pin {distance} from the typed address",
  distance: formatDistance,
}
export type PinDropMessages = typeof DEFAULT_MESSAGES
const fill = (t: string, v: Record<string, string | number | undefined>) => t.replace(/\{(\w+)\}/g, (_, k) => String(v[k] ?? ""))

export interface PinMapContext {
  pin: LatLng | null
  addressPoint: LatLng | null
  pincodeCenter: LatLng | null
  /** Reach of the PIN area in metres. */
  pincodeRadius: number
  distance: number
  issues: PinIssue[]
}

export interface PinDropCheckProps extends Omit<React.ComponentProps<"div">, "defaultValue" | "children"> {
  /** Where the user dropped the pin. */
  pin: LatLng | null
  /** The typed address as text, for the readback. */
  address: string
  /** The typed address, geocoded. */
  addressPoint?: LatLng | null
  /** The typed PIN / postcode. */
  pincode?: string
  /** Centre of that PIN area. */
  pincodeCenter?: LatLng | null
  /** How far the PIN area reaches, in metres. Default 3000. */
  pincodeRadius?: number
  /** GPS accuracy of the pin in metres. */
  accuracy?: number
  /** Gap in metres that counts as far. Default 250. */
  farAfter?: number
  /** Where the pin landed, if you already know. */
  surface?: PinSurface
  /** Geo helper that says where a point landed. Called after the pin settles; errors are ignored. */
  classify?: (point: LatLng) => PinSurface | Promise<PinSurface>
  /** Controlled choice. */
  value?: "pin" | "address" | null
  /** Initial choice when uncontrolled. */
  defaultValue?: "pin" | "address" | null
  /** Called when the user picks pin or address. */
  onValueChange?: (value: "pin" | "address") => void
  /** Draw your own map (Leaflet, Google, Mapbox). Defaults to a small SVG sketch. */
  renderMap?: (context: PinMapContext) => React.ReactNode
  /** Every visible string. */
  messages?: Partial<PinDropMessages>
}

/** The default map: a to-scale SVG sketch of the address, the pin, the gap and the PIN area. No map library. */
function Sketch({ pin, addressPoint, pincodeCenter, pincodeRadius, distance, label, pinLabel, addressLabel, bad }: PinMapContext & { label: string; pinLabel: string; addressLabel: string; bad: boolean }) {
  const gridId = `cui-pin-grid-${React.useId().replace(/[^a-z0-9]/gi, "")}`
  // Draw in real pixels (viewBox = rendered width) so labels stay 9–10px at any width instead of scaling up.
  const ref = React.useRef<SVGSVGElement>(null)
  const [width, setWidth] = React.useState(240)
  const pts = [pin, addressPoint].filter(isValidPoint)
  const drawn = pts.length > 0
  React.useEffect(() => {
    const el = ref.current
    if (!el || typeof ResizeObserver === "undefined") return
    const ro = new ResizeObserver(([e]) => setWidth(Math.max(160, Math.round(e.contentRect.width))))
    ro.observe(el)
    return () => ro.disconnect()
  }, [drawn])
  if (!drawn) return null
  const [W, H, pad] = [width, Math.round(Math.min(200, Math.max(120, width / 2.4))), 26]
  const cLat = pts.reduce((s, p) => s + p.lat, 0) / pts.length
  const cLng = pts.reduce((s, p) => s + p.lng, 0) / pts.length
  const kx = Math.cos((cLat * Math.PI) / 180)
  const span = Math.max(...pts.map((p) => Math.max(Math.abs(p.lng - cLng) * kx / ((W - 2 * pad) / 2), Math.abs(p.lat - cLat) / ((H - 2 * pad) / 2))), 1e-6)
  const at = (p: LatLng) => ({ x: W / 2 + ((p.lng - cLng) * kx) / span, y: H / 2 - (p.lat - cLat) / span })
  const [P, A] = [isValidPoint(pin) ? at(pin) : null, isValidPoint(addressPoint) ? at(addressPoint) : null]
  const zone = isValidPoint(pincodeCenter) ? at(pincodeCenter) : null
  return (
    <svg ref={ref} role="img" aria-label={label} viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full rounded-md bg-muted">
      <defs>
        <pattern id={gridId} width="16" height="16" patternUnits="userSpaceOnUse"><path d="M16 0H0V16" fill="none" className="stroke-foreground/5" /></pattern>
      </defs>
      <rect width={W} height={H} fill={`url(#${gridId})`} />
      {zone && <circle cx={zone.x} cy={zone.y} r={Math.min(400, pincodeRadius / (span * 111320))} className="fill-primary/5 stroke-primary/20" strokeDasharray="3 3" />}
      {P && A && <line x1={A.x} y1={A.y} x2={P.x} y2={P.y} strokeWidth={1.5} strokeDasharray="4 3" className={bad ? "stroke-amber-500" : "stroke-emerald-500"} />}
      {P && A && Number.isFinite(distance) && (
        <text x={(A.x + P.x) / 2} y={(A.y + P.y) / 2 - 6} textAnchor="middle" className="fill-foreground text-[10px] font-medium">{formatDistance(distance)}</text>
      )}
      {A && <g><circle cx={A.x} cy={A.y} r={6} className="fill-background stroke-foreground" strokeWidth={1.5} /><text x={A.x} y={A.y + 17} textAnchor="middle" className="fill-muted-foreground text-[9px]">{addressLabel}</text></g>}
      {P && <g><path d={`M${P.x} ${P.y}c-5-7-8-10-8-14a8 8 0 0 1 16 0c0 4-3 7-8 14z`} className={bad ? "fill-amber-500" : "fill-emerald-500"} /><circle cx={P.x} cy={P.y - 14} r={2.5} className="fill-background" /><text x={P.x} y={P.y + 11} textAnchor="middle" className="fill-muted-foreground text-[9px]">{pinLabel}</text></g>}
    </svg>
  )
}

/**
 * Confirms a delivery pin before the order goes out: it measures the pin
 * against the typed address and PIN area (ignoring gaps inside GPS accuracy),
 * flags pins in water or on a highway, shows the gap on a to-scale sketch and
 * asks one plain question: use the pin or the address?
 */
export function PinDropCheck({
  pin, address, addressPoint = null, pincode, pincodeCenter = null, pincodeRadius, accuracy, farAfter, surface, classify,
  value, defaultValue = null, onValueChange, renderMap, messages, className, ...props
}: PinDropCheckProps) {
  const t = { ...DEFAULT_MESSAGES, ...messages }
  const [found, setFound] = React.useState<{ key: string; surface: PinSurface }>()
  const pinKey = isValidPoint(pin) ? `${pin.lat.toFixed(5)},${pin.lng.toFixed(5)}` : ""
  // An uncontrolled choice belongs to the pin it was made for: moving the pin asks again.
  const [inner, setInner] = React.useState({ key: pinKey, choice: defaultValue })
  const choice = value === undefined ? (inner.key === pinKey ? inner.choice : null) : value
  const rootRef = React.useRef<HTMLDivElement>(null)
  const id = React.useId()

  // Ask the geo helper once the pin stops moving.
  React.useEffect(() => {
    if (!classify || !pinKey || !isValidPoint(pin)) return
    let live = true
    const timer = setTimeout(async () => {
      try {
        const s = await classify(pin)
        if (live) setFound({ key: pinKey, surface: s })
      } catch {
        if (live) setFound({ key: pinKey, surface: null })
      }
    }, 400)
    return () => {
      live = false
      clearTimeout(timer)
    }
  }, [pinKey, classify]) // eslint-disable-line react-hooks/exhaustive-deps

  const checking = !!classify && !!pinKey && surface === undefined && found?.key !== pinKey
  const landed = surface !== undefined ? surface : found?.key === pinKey ? found.surface : null
  const issues = checkPin({ pin, addressPoint, pincodeCenter, pincodeRadius, accuracy, farAfter, surface: landed })
  const gap = distanceMeters(pin, addressPoint)
  const ask = issues.some((i) => i.type !== "no-pin") && isValidPoint(addressPoint)
  const say = (i: PinIssue) =>
    i.type === "no-pin" ? t.noPin
      : i.type === "far" ? fill(t.far, { distance: t.distance(i.distance), address: address || t.addressLabel })
      : i.type === "outside-pincode" ? fill(t.outsidePincode, { pincode, distance: t.distance(i.distance) })
      : t[i.type]
  const status = checking ? t.checking : issues.length ? issues.map(say).join(" ") : Number.isFinite(gap) ? fill(t.matches, { distance: t.distance(gap) }) : t.pinOnly

  const [announced, setAnnounced] = React.useState("")
  React.useEffect(() => {
    const timer = setTimeout(() => setAnnounced(status), 800)
    return () => clearTimeout(timer)
  }, [status])

  const pick = (next: "pin" | "address") => {
    if (value === undefined) setInner({ key: pinKey, choice: next })
    onValueChange?.(next)
  }
  const ctx: PinMapContext = { pin: isValidPoint(pin) ? pin : null, addressPoint: isValidPoint(addressPoint) ? addressPoint : null, pincodeCenter: isValidPoint(pincodeCenter) ? pincodeCenter : null, pincodeRadius: Number(pincodeRadius) || 3000, distance: gap, issues }
  const option = (v: "pin" | "address", title: string, hint: string, Icon: typeof MapPin) => (
    <label className="flex min-w-0 cursor-pointer items-start gap-2 rounded-md border p-2.5 transition-colors has-checked:border-primary has-checked:bg-accent has-focus-visible:ring-[3px] has-focus-visible:ring-ring/50">
      <input type="radio" name={`${id}-choice`} value={v} checked={choice === v} onChange={() => pick(v)} className="mt-0.5 size-4 shrink-0 accent-primary outline-none" />
      <span className="min-w-0">
        <span className="flex items-center gap-1.5 font-medium"><Icon aria-hidden className="size-3.5 shrink-0" />{title}</span>
        <span className="block text-xs text-muted-foreground [overflow-wrap:anywhere]">{hint}</span>
      </span>
    </label>
  )

  return (
    <div
      ref={rootRef}
      data-slot="pin-drop-check"
      role="group"
      aria-label={props["aria-labelledby"] ? undefined : t.label}
      className={cn("grid w-full max-w-sm gap-3 text-sm", className)}
      {...props}
      aria-describedby={cn(props["aria-describedby"], `${id}-status`) || undefined}
    >
      {renderMap ? renderMap(ctx) : <Sketch {...ctx} bad={issues.length > 0} label={fill(t.mapLabel, { distance: t.distance(gap) })} pinLabel={t.pinLabel} addressLabel={t.addressLabel} />}

      <div id={`${id}-status`} className="grid gap-1 text-xs">
        {checking ? (
          <p className="flex items-center gap-1.5 text-muted-foreground"><LoaderCircle aria-hidden className="size-3.5 animate-spin" />{t.checking}</p>
        ) : issues.length ? issues.map((i) => (
          <p key={i.type} className="flex gap-1.5 text-amber-700 dark:text-amber-400">
            <CircleAlert aria-hidden className="mt-px size-3.5 shrink-0" />
            <span>{say(i)}</span>
          </p>
        )) : (
          <p className="flex gap-1.5 text-emerald-700 dark:text-emerald-400"><CircleCheck aria-hidden className="mt-px size-3.5 shrink-0" />{status}</p>
        )}
      </div>
      <span className="sr-only" aria-live="polite">{announced}</span>

      {ask && (
        <fieldset className="grid gap-2">
          <legend className="mb-2 font-medium">{t.question}</legend>
          <div className="grid gap-2">
            {option("pin", t.usePin, Number.isFinite(gap) ? `${t.usePinHint} · ${t.distance(gap)}` : t.usePinHint, MapPin)}
            {option("address", t.useAddress, address, House)}
          </div>
        </fieldset>
      )}
    </div>
  )
}
