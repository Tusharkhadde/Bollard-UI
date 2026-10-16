export interface LatLon {
  lat: number
  lon: number
}

/** Where a pair came from. Google's `@lat,lng` is the map centre, not the dropped pin (`!3d…!4d…`). */
export type CoordinateSource = "text" | "pin" | "centre" | "query"

export type CoordinateResult =
  | { kind: "empty" }
  | { kind: "error"; code: "unreadable" | "short-link" | "labels" | "minutes" | "lat-range" | "lon-range"; fix?: LatLon }
  | { kind: "ok"; lat: number; lon: number; source: CoordinateSource; precision: number }

const NUM = "([-+−]?\\d+(?:\\.\\d+)?)"

/** Pulls a pair out of a pasted Google Maps, OpenStreetMap or geo: link, preferring the pin over the map centre. */
function fromUrl(text: string): { pair: [string, string]; source: CoordinateSource } | "short-link" | null {
  const url = decodeURIComponent(text.replace(/\+/g, " "))
  if (/goo\.gl\/|maps\.app\./.test(url)) return "short-link"
  const tries: [RegExp, CoordinateSource][] = [
    [new RegExp(`!3d${NUM}!4d${NUM}`), "pin"],
    [new RegExp(`[?&](?:q|query|ll|destination|daddr|center)=(?:loc:)?${NUM}\\s*,\\s*${NUM}`), "query"],
    [new RegExp(`mlat=${NUM}&mlon=${NUM}`), "pin"],
    [new RegExp(`^geo:${NUM},${NUM}`), "pin"],
    [new RegExp(`@${NUM},${NUM}`), "centre"],
    [new RegExp(`#map=\\d+(?:\\.\\d+)?/${NUM}/${NUM}`), "centre"],
  ]
  for (const [pattern, source] of tries) {
    const match = url.match(pattern)
    if (match) return { pair: [match[1], match[2]], source }
  }
  return null
}

/** Splits free text into two coordinate parts: by hemisphere letters, a comma, or a new degree sign. */
function splitPair(text: string): string[] {
  const letters = text.match(/[NSEW]/g) ?? []
  if (letters.length === 2) {
    const prefix = /^[NSEW]/.test(text)
    const parts = prefix ? text.split(/(?=[NSEW])/) : text.split(/(?<=[NSEW])/)
    return parts.map((p) => p.replace(/^[\s,;]+|[\s,;]+$/g, "")).filter(Boolean)
  }
  if (/[,;]/.test(text)) return text.split(/\s*[,;]\s*/)
  const tokens = text.split(/\s+/)
  if (tokens.length === 2) return tokens
  return text.split(/\s+(?=[-+−]?\d+(?:\.\d+)?\s*°)/)
}

/** One part ("18°31'13.4"N", "-73.8567", "N 18 31.2") as signed degrees, with its letter and precision. */
function readPart(part: string) {
  const letter = part.match(/[NSEW]/)?.[0]
  const numbers = part.replace(/[NSEW]/g, " ").match(/[-+−]?\d+(?:\.\d+)?/g) ?? []
  if (!numbers.length || numbers.length > 3 || /[^\d\s.°'"+\-−NSEW]/.test(part)) return null
  const [d = "0", m = "0", s = "0"] = numbers
  if ((numbers.length > 1 && d.includes(".")) || Number(m) >= 60 || Number(s) >= 60) return "minutes" as const
  const negative = /^[-−]/.test(d) !== (letter === "S" || letter === "W")
  const value = Math.abs(Number(d.replace("−", "-"))) + Number(m) / 60 + Number(s) / 3600
  const decimals = (numbers[numbers.length - 1].split(".")[1] ?? "").length
  // Precision in degrees of the smallest unit typed.
  const step = 10 ** -decimals / [1, 60, 3600][numbers.length - 1]
  return { value: negative ? -value : value, letter, step }
}

/**
 * Reads decimal degrees, DMS or DDM ("18°31'13"N 73°51'24"E", "18 31.2 N, 73 51.4 E") or a pasted map link.
 * Hemisphere letters decide which part is latitude, so "73.85 E 18.52 N" still reads correctly.
 */
export function parseCoordinates(input: string): CoordinateResult {
  const text = input.trim().toUpperCase().replace(/[′’‘´`]/g, "'").replace(/[″”“]|''/g, '"').replace(/º|˚/g, "°")
  if (!text) return { kind: "empty" }
  const link = /^(HTTPS?:|GEO:|WWW\.)|MAPS?\./.test(text) ? fromUrl(input.trim()) : null
  if (link === "short-link") return { kind: "error", code: "short-link" }
  const parts = link ? link.pair : splitPair(text)
  if (parts.length !== 2) return { kind: "error", code: "unreadable" }
  const [a, b] = parts.map(readPart)
  if (!a || !b) return { kind: "error", code: "unreadable" }
  if (a === "minutes" || b === "minutes") return { kind: "error", code: "minutes" }
  const latLetter = (l?: string) => l === "N" || l === "S"
  const lonLetter = (l?: string) => l === "E" || l === "W"
  if ((latLetter(a.letter) && latLetter(b.letter)) || (lonLetter(a.letter) && lonLetter(b.letter))) return { kind: "error", code: "labels" }
  const [lat, lon] = lonLetter(a.letter) || latLetter(b.letter) ? [b, a] : [a, b]
  if (Math.abs(lat.value) > 90) {
    return { kind: "error", code: "lat-range", fix: Math.abs(lon.value) <= 90 && Math.abs(lat.value) <= 180 ? { lat: lon.value, lon: lat.value } : undefined }
  }
  if (Math.abs(lon.value) > 180) return { kind: "error", code: "lon-range" }
  return { kind: "ok", lat: lat.value, lon: lon.value, source: link ? link.source : "text", precision: Math.max(lat.step, lon.step) * 111_320 }
}

/** Great-circle distance in km. */
export function distanceKm(a: LatLon, b: LatLon) {
  const rad = Math.PI / 180
  const h = Math.sin(((b.lat - a.lat) * rad) / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(((b.lon - a.lon) * rad) / 2) ** 2
  return 12_742 * Math.asin(Math.sqrt(h))
}

export type CoordinateSlip = "swapped" | "south" | "west" | "both"

/**
 * When a point lands outside the expected area but a swapped or sign-flipped reading lands inside it,
 * returns that reading: the classic "forgot the minus for west" or "lat and long the wrong way round".
 */
export function findCoordinateSlip(point: LatLon, area: LatLon & { radiusKm: number }): { slip: CoordinateSlip; fix: LatLon } | null {
  if (distanceKm(point, area) <= area.radiusKm) return null
  const { lat, lon } = point
  const candidates: [CoordinateSlip, LatLon][] = [
    ["swapped", { lat: lon, lon: lat }],
    ["south", { lat: -lat, lon }],
    ["west", { lat, lon: -lon }],
    ["both", { lat: -lat, lon: -lon }],
  ]
  const hit = candidates.find(([, c]) => Math.abs(c.lat) <= 90 && distanceKm(c, area) <= area.radiusKm)
  return hit ? { slip: hit[0], fix: hit[1] } : null
}

const round = (n: number, places: number) => Number(n.toFixed(places))

/** "18.5204° N, 73.8567° E". */
export function formatDecimal({ lat, lon }: LatLon, places = 6) {
  return `${round(Math.abs(lat), places)}° ${lat < 0 ? "S" : "N"}, ${round(Math.abs(lon), places)}° ${lon < 0 ? "W" : "E"}`
}

/** "18°31'13.4"N 73°51'24.1"E". */
export function formatDms({ lat, lon }: LatLon) {
  const one = (v: number, pos: string, neg: string) => {
    const total = Math.round(Math.abs(v) * 36_000) / 10
    const d = Math.floor(total / 3600)
    const m = Math.floor((total - d * 3600) / 60)
    return `${d}°${m}'${round(total - d * 3600 - m * 60, 1)}"${v < 0 ? neg : pos}`
  }
  return `${one(lat, "N", "S")} ${one(lon, "E", "W")}`
}

/** An OpenStreetMap link with a marker on the point. */
export function osmUrl({ lat, lon }: LatLon, zoom = 16) {
  const la = round(lat, 6)
  const lo = round(lon, 6)
  return `https://www.openstreetmap.org/?mlat=${la}&mlon=${lo}#map=${zoom}/${la}/${lo}`
}
