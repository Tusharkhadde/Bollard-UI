// Bollard UI — photo-location-guard · MIT licence · https://bollard-ui.vercel.app/components/photo-location-guard

/** What a JPEG gives away about where, when and with what it was taken. */
export interface PhotoMetadata {
  /** GPS position in decimal degrees, with how precisely it was stored (metres). */
  gps?: { latitude: number; longitude: number; altitude?: number; precision: number }
  /** Capture time as the camera's wall clock, e.g. "2026:10:12 07:42:15", plus its UTC offset when stored. */
  capturedAt?: { raw: string; offset?: string }
  /** "Apple iPhone 15 Pro". */
  camera?: string
  /** Body serial number: links every photo from the same camera. */
  serial?: string
  lensSerial?: string
  /** Artist or CameraOwnerName. */
  owner?: string
  /** EXIF orientation, 1–8. */
  orientation?: number
  /** An embedded preview of the original image, which can outlive crops and edits. */
  thumbnail: boolean
  /** Location written as XMP (Lightroom, Photos) rather than EXIF. */
  xmpLocation: boolean
}

type Entry = { type: number; count: number; at: number }
const SIZES: Record<number, number> = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 7: 1, 9: 4, 10: 8 }
const EXIF_HEADER = "Exif\0\0"
const XMP_HEADER = "http://ns.adobe.com/xap/1.0/\0"

const ascii = (view: DataView, at: number, length: number) => {
  let text = ""
  for (let i = 0; i < length && at + i < view.byteLength; i++) text += String.fromCharCode(view.getUint8(at + i))
  return text
}

function readTiff(view: DataView, tiff: number, meta: PhotoMetadata) {
  const little = view.getUint16(tiff) === 0x4949
  const u16 = (at: number) => view.getUint16(tiff + at, little)
  const u32 = (at: number) => view.getUint32(tiff + at, little)
  if (u16(2) !== 42) return

  const ifd = (at: number) => {
    const tags = new Map<number, Entry>()
    const count = Math.min(u16(at), 512)
    for (let i = 0; i < count; i++) {
      const e = at + 2 + i * 12
      const type = u16(e + 2)
      const n = u32(e + 4)
      tags.set(u16(e), { type, count: n, at: n * (SIZES[type] ?? 1) <= 4 ? e + 8 : u32(e + 8) })
    }
    return { tags, next: u32(at + 2 + count * 12) }
  }
  const text = (e?: Entry) => (e?.type === 2 ? ascii(view, tiff + e.at, e.count).replace(/\0+$/, "").trim() || undefined : undefined)
  const int = (e?: Entry) => (!e ? undefined : e.type === 3 ? u16(e.at) : e.type === 4 ? u32(e.at) : view.getUint8(tiff + e.at))
  const rational = (e: Entry, i: number): [number, number] => [u32(e.at + i * 8), u32(e.at + i * 8 + 4)]

  const ifd0 = ifd(u32(4))
  const at = (tag: number) => int(ifd0.tags.get(tag))
  meta.orientation = at(0x0112)
  meta.owner = text(ifd0.tags.get(0x013b))
  const make = text(ifd0.tags.get(0x010f))
  const model = text(ifd0.tags.get(0x0110))
  meta.camera = model && make && !model.startsWith(make) ? `${make} ${model}` : (model ?? make)
  if (ifd0.next) meta.thumbnail = (int(ifd(ifd0.next).tags.get(0x0202)) ?? 0) > 0

  const exifAt = at(0x8769)
  if (exifAt) {
    const exif = ifd(exifAt).tags
    const raw = text(exif.get(0x9003)) ?? text(ifd0.tags.get(0x0132))
    if (raw) meta.capturedAt = { raw, offset: text(exif.get(0x9011)) }
    meta.serial = text(exif.get(0xa431))
    meta.lensSerial = text(exif.get(0xa435))
    meta.owner ??= text(exif.get(0xa430))
  }

  const gpsAt = at(0x8825)
  if (!gpsAt) return
  const gps = ifd(gpsAt).tags
  const lat = gps.get(2)
  const lon = gps.get(4)
  if (lat?.type !== 5 || lon?.type !== 5 || lat.count < 3 || lon.count < 3) return
  let precision = Infinity
  const degrees = (e: Entry) =>
    [1, 60, 3600].reduce((sum, scale, i) => {
      const [n, d] = rational(e, i)
      if (!d) return sum
      precision = Math.min(precision, 111_320 / scale / d)
      return sum + n / d / scale
    }, 0)
  const latitude = degrees(lat) * (text(gps.get(1)) === "S" ? -1 : 1)
  const longitude = degrees(lon) * (text(gps.get(3)) === "W" ? -1 : 1)
  // 0,0 ("Null Island") is what many cameras write when they had no fix.
  if (!isFinite(latitude + longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180 || (!latitude && !longitude)) return
  const alt = gps.get(6)
  const [an, ad] = alt?.type === 5 ? rational(alt, 0) : [0, 0]
  const altitude = ad ? (an / ad) * (int(gps.get(5)) === 1 ? -1 : 1) : undefined
  meta.gps = { latitude, longitude, altitude, precision: isFinite(precision) ? precision : 1000 }
}

/**
 * Reads location, capture time, camera serials and embedded previews from a JPEG's
 * EXIF and XMP segments. Returns null for anything that isn't a JPEG. Never throws:
 * a truncated or malformed segment just yields what was read before it.
 */
export function readPhotoMetadata(buffer: ArrayBuffer): PhotoMetadata | null {
  const view = new DataView(buffer)
  if (view.byteLength < 4 || view.getUint16(0) !== 0xffd8) return null
  const meta: PhotoMetadata = { thumbnail: false, xmpLocation: false }
  try {
    for (let at = 2; at + 4 <= view.byteLength; ) {
      const marker = view.getUint16(at)
      if (marker >> 8 !== 0xff || marker === 0xffda || marker === 0xffd9) break
      const length = view.getUint16(at + 2)
      if (marker === 0xffe1 && ascii(view, at + 4, 6) === EXIF_HEADER) readTiff(view, at + 10, meta)
      else if (marker === 0xffe1 && ascii(view, at + 4, XMP_HEADER.length) === XMP_HEADER) {
        const xmp = ascii(view, at + 4, length - 2)
        meta.xmpLocation ||= /GPSLatitude|photoshop:City|Iptc4xmpCore:Location/.test(xmp)
      }
      at += 2 + length
    }
  } catch {
    // Malformed metadata: keep whatever was read before it.
  }
  return meta
}

/** True when the metadata reveals anything worth a second look before posting. */
export const hasRevealingMetadata = (m: PhotoMetadata) =>
  !!(m.gps || m.xmpLocation || m.capturedAt || m.serial || m.lensSerial || m.owner || m.thumbnail)

/** 18.520430, 73.856743 → "18.5204° N, 73.8567° E". */
export function formatCoordinates(latitude: number, longitude: number, digits = 4) {
  const part = (value: number, pos: string, neg: string) => `${Math.abs(value).toFixed(digits)}° ${value < 0 ? neg : pos}`
  return `${part(latitude, "N", "S")}, ${part(longitude, "E", "W")}`
}

/** "2026:10:12 07:42:15" → a Date whose UTC fields are the camera's wall clock, or null. */
export function parseExifDate(raw: string) {
  const m = raw.match(/^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/)
  if (!m) return null
  const [, y, mo, d, h, mi, s = "0"] = m
  if (+y < 1900 || +mo < 1 || +d < 1) return null // "0000:00:00 00:00:00" means unset
  const date = new Date(Date.UTC(+y, +mo - 1, +d, +h, +mi, +s))
  return isNaN(date.getTime()) ? null : date
}

/**
 * Re-encodes a photo through a canvas, which writes a fresh JPEG with no EXIF, XMP,
 * GPS or embedded preview. The orientation is baked into the pixels first, so a
 * portrait phone photo doesn't come out sideways once its orientation tag is gone.
 * Browser only.
 */
export async function removePhotoMetadata(file: Blob, name = "photo.jpg", quality = 0.92): Promise<File> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" })
  const canvas = document.createElement("canvas")
  canvas.width = bitmap.width
  canvas.height = bitmap.height
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0)
  bitmap.close()
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality))
  if (!blob) throw new Error("Could not re-encode the photo.")
  return new File([blob], name.replace(/\.(jpe?g|jfif)$/i, "") + ".jpg", { type: "image/jpeg", lastModified: Date.now() })
}
