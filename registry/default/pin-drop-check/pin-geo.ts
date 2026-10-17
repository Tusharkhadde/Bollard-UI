// Bollard UI — pin-drop-check · MIT licence · https://bollard-ui.vercel.app/components/pin-drop-check

export interface LatLng {
  lat: number
  lng: number
}
/** Where a point landed, from your geo helper (map tiles, OSM landuse, a roads API). */
export type PinSurface = "water" | "highway" | "land" | null
export type PinIssue =
  | { type: "no-pin" }
  | { type: "far"; distance: number }
  | { type: "outside-pincode"; distance: number }
  | { type: "water" }
  | { type: "highway" }

/** A usable coordinate: finite, in range and not the 0, 0 "nothing loaded" default. */
export const isValidPoint = (p?: Partial<LatLng> | null): p is LatLng =>
  !!p && Number.isFinite(p.lat) && Number.isFinite(p.lng) && Math.abs(p.lat as number) <= 90 && Math.abs(p.lng as number) <= 180 && !(p.lat === 0 && p.lng === 0)

/** Great-circle distance in metres (haversine). NaN when either point is unusable. */
export function distanceMeters(a?: LatLng | null, b?: LatLng | null) {
  if (!isValidPoint(a) || !isValidPoint(b)) return NaN
  const rad = Math.PI / 180
  const h = Math.sin(((b.lat - a.lat) * rad) / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(((b.lng - a.lng) * rad) / 2) ** 2
  return 2 * 6371008.8 * Math.asin(Math.min(1, Math.sqrt(h)))
}

export const formatDistance = (m: number) => (!Number.isFinite(m) ? "?" : m < 1000 ? `${Math.max(10, Math.round(m / 10) * 10)} m` : `${(m / 1000).toFixed(m < 10000 ? 1 : 0)} km`)

export interface PinCheckInput {
  pin?: LatLng | null
  /** The typed address, geocoded. */
  addressPoint?: LatLng | null
  /** Centre of the typed PIN / postcode and how far it reaches (metres). */
  pincodeCenter?: LatLng | null
  pincodeRadius?: number
  /** GPS accuracy of the pin in metres. Gaps smaller than this aren't flagged. */
  accuracy?: number
  /** Gap in metres that counts as far. Default 250. */
  farAfter?: number
  surface?: PinSurface
}

/** Every reason a courier might end up at the wrong door. */
export function checkPin({ pin, addressPoint, pincodeCenter, pincodeRadius = 3000, accuracy = 0, farAfter = 250, surface }: PinCheckInput): PinIssue[] {
  if (!isValidPoint(pin)) return [{ type: "no-pin" }]
  const issues: PinIssue[] = []
  const slack = Math.max(Number(farAfter) || 0, Number(accuracy) || 0)
  const far = distanceMeters(pin, addressPoint)
  if (far > slack) issues.push({ type: "far", distance: far })
  const out = distanceMeters(pin, pincodeCenter)
  if (out > Math.max(Number(pincodeRadius) || 0, slack)) issues.push({ type: "outside-pincode", distance: out })
  if (surface === "water" || surface === "highway") issues.push({ type: surface })
  return issues
}
