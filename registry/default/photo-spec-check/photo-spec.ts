// Bollard UI — photo-spec-check · MIT licence · https://bollard-ui.vercel.app/components/photo-spec-check

/** What a portal accepts for a photo upload. Every field is optional; only the ones set are checked. */
export interface PhotoSpec {
  label: string
  /** Accepted formats, by real file type (read from the bytes, not the name). */
  formats?: ("jpeg" | "png" | "webp")[]
  minKB?: number
  maxKB?: number
  minWidth?: number
  minHeight?: number
  maxWidth?: number
  maxHeight?: number
  /** Width ÷ height, e.g. 1 for square. */
  aspect?: number
  /** Printed size in cm; checked through the file's DPI and written into the fixed file. */
  sizeCm?: { width: number; height: number }
  /** Head height as a share of the image height (chin to top of head). */
  faceHeight?: [number, number]
  /** Smallest share of the image the face box should cover. */
  faceArea?: number
  /** Plain white (or off-white) background required. */
  whiteBackground?: boolean
  /** Colour photo required (no black and white). */
  colour?: boolean
  /** Highest JPEG compression ratio allowed (raw 24-bit size ÷ file size). US visa: 20. */
  maxCompression?: number
  /** File name the portal wants, without extension. */
  fileName?: string
  /** Bytes per KB used by the portal. */
  kb?: 1000 | 1024
  source?: string
  note?: string
}

/** Starter presets from the official instructions, re-checked 14 Oct 2026. Confirm against the current notice. */
export const PHOTO_SPECS: Record<string, PhotoSpec> = {
  upsc: {
    label: "UPSC",
    formats: ["jpeg"],
    minKB: 20,
    maxKB: 200,
    // The current instructions give no pixel size; 350 px is the floor from UPSC's older OTR FAQ, kept as a safe minimum.
    minWidth: 350,
    minHeight: 350,
    faceArea: 0.75,
    whiteBackground: true,
    colour: true,
    fileName: "photo",
    source: "https://upsconline.nic.in/caf/assets/PDF/instruction-photo-signature-upload-upsc.pdf",
    note: "Colour JPG named “photo”, 20–200 KB, plain white background, face at least 3/4 of the photo, both ears visible. You'll also take a live photo that must match it.",
  },
  ssc: {
    label: "SSC (photo upload)",
    formats: ["jpeg"],
    minKB: 20,
    maxKB: 50,
    sizeCm: { width: 3.5, height: 4.5 },
    source: "https://ssc.gov.in/candidate-portal/one-time-registration/scribe-otr-details",
    note: "JPEG 20–50 KB, about 3.5 × 4.5 cm (SSC's scribe registration). SSC exam applications now take a live photo in the form instead of an upload.",
  },
  nta: {
    label: "NTA (JEE Main, CUET)",
    formats: ["jpeg"],
    minKB: 10,
    maxKB: 200,
    faceArea: 0.8,
    whiteBackground: true,
    colour: true,
    source: "https://cdnbbsr.s3waas.gov.in/s3f8e59f4b2fe7c5705bf878bbd494ccdf/uploads/2025/11/202511021649722475.pdf",
    note: "Colour JPG 10–200 KB, face (with ears, no mask) about 80% of the image, white background. A live photo is captured too.",
  },
  neet: {
    label: "NEET (UG)",
    formats: ["jpeg"],
    minKB: 10,
    maxKB: 200,
    faceArea: 0.8,
    whiteBackground: true,
    source: "https://cdnbbsr.s3waas.gov.in/s37bc1ec1d9c3426357e69acd5bf320061/uploads/2026/02/202602081576322299.pdf",
    note: "JPG 10–200 KB, colour or black and white, face (with ears, no mask) 80% of the image, white background.",
  },
  "us-visa": {
    label: "US visa (DS-160)",
    formats: ["jpeg"],
    maxKB: 240,
    minWidth: 600,
    minHeight: 600,
    maxWidth: 1200,
    maxHeight: 1200,
    aspect: 1,
    faceHeight: [0.5, 0.69],
    whiteBackground: true,
    colour: true,
    maxCompression: 20,
    kb: 1000,
    source: "https://travel.state.gov/content/travel/en/us-visas/visa-information-resources/photos/digital-image-requirements.html",
    note: "Square colour JPEG, 600–1200 px, ≤ 240 kB, compressed no more than 20:1; head 50–69% of the height on a white or off-white background.",
  },
}

export interface FaceBox {
  x: number
  y: number
  width: number
  height: number
}

/** What was read from the file. Pixel fields are absent when the image couldn't be decoded. */
export interface PhotoFacts {
  bytes: number
  /** Real type from the first bytes. */
  type: "jpeg" | "png" | "webp" | "gif" | "heic" | "unknown"
  /** Type the name or MIME claims. */
  claimed?: string
  width?: number
  height?: number
  /** Dots per inch from the JPEG header, when set. */
  dpi?: number
  /** Background sample: is it white enough, and is the image colour at all. */
  background?: { white: boolean; grey: boolean }
  face?: FaceBox | null
}

export type PhotoIssue =
  | { kind: "format"; type: string; claimed?: string }
  | { kind: "tooBig"; kb: number; max: number }
  | { kind: "tooSmall"; kb: number; min: number }
  | { kind: "compressed"; ratio: number; max: number }
  | { kind: "dimsSmall"; width: number; height: number; minWidth: number; minHeight: number }
  | { kind: "dimsBig"; width: number; height: number; maxWidth: number; maxHeight: number }
  | { kind: "aspect"; actual: string; wanted: string }
  | { kind: "printSize"; widthCm: number; heightCm: number; wanted: string }
  | { kind: "faceSmall"; share: number; min: number }
  | { kind: "faceBig"; share: number; max: number }
  | { kind: "faceOffCentre" }
  | { kind: "background" }
  | { kind: "colour" }
  | { kind: "unreadable" }

/** Issues a crop and re-encode can honestly fix. Background and colour need a new photo. */
export const FIXABLE: PhotoIssue["kind"][] = ["format", "tooBig", "tooSmall", "compressed", "dimsSmall", "dimsBig", "aspect", "printSize", "faceSmall", "faceBig", "faceOffCentre"]

const ratio = (a: number) => {
  for (const [w, h] of [[1, 1], [3, 4], [4, 3], [7, 9], [2, 3], [3, 2], [4, 5], [16, 9], [9, 16]]) if (Math.abs(a - w / h) < 0.02) return `${w}:${h}`
  return a.toFixed(2)
}
const round1 = (n: number) => Math.round(n * 10) / 10

export const wantedAspect = (spec: PhotoSpec) => spec.aspect ?? (spec.sizeCm ? spec.sizeCm.width / spec.sizeCm.height : undefined)

/** Reads the real file type and the JPEG DPI from the first bytes. */
export function sniff(head: Uint8Array): { type: PhotoFacts["type"]; dpi?: number } {
  const b = (i: number) => head[i] ?? -1
  const ascii = (from: number, len: number) => String.fromCharCode(...Array.from(head.slice(from, from + len)))
  if (b(0) === 0xff && b(1) === 0xd8 && b(2) === 0xff) {
    let dpi: number | undefined
    if (b(3) === 0xe0 && ascii(6, 5) === "JFIF\0") {
      const units = b(13)
      const x = (b(14) << 8) | b(15)
      dpi = units === 1 ? x : units === 2 ? Math.round(x * 2.54) : undefined
    }
    return { type: "jpeg", dpi: dpi && dpi > 1 ? dpi : undefined }
  }
  if (b(0) === 0x89 && ascii(1, 3) === "PNG") return { type: "png" }
  if (ascii(0, 4) === "RIFF" && ascii(8, 4) === "WEBP") return { type: "webp" }
  if (ascii(0, 3) === "GIF") return { type: "gif" }
  if (ascii(4, 4) === "ftyp" && /hei|hev|mif/.test(ascii(8, 4))) return { type: "heic" }
  return { type: "unknown" }
}

/** Compares what was read against the spec, worst first. */
export function checkPhoto(facts: PhotoFacts, spec: PhotoSpec): PhotoIssue[] {
  const issues: PhotoIssue[] = []
  if (!facts || !spec) return issues
  const kb = Math.round((Number(facts.bytes) || 0) / (spec.kb ?? 1024))
  if (spec.formats?.length && !spec.formats.includes(facts.type as "jpeg")) issues.push({ kind: "format", type: facts.type, claimed: facts.claimed })
  if (!facts.width || !facts.height) {
    issues.push({ kind: "unreadable" })
    return issues
  }
  if (spec.maxKB && kb > spec.maxKB) issues.push({ kind: "tooBig", kb, max: spec.maxKB })
  if (spec.minKB && kb < spec.minKB) issues.push({ kind: "tooSmall", kb, min: spec.minKB })
  const { width: w, height: h } = facts
  const ratioNow = (w * h * 3) / Math.max(1, Number(facts.bytes) || 0)
  if (spec.maxCompression && ratioNow > spec.maxCompression) issues.push({ kind: "compressed", ratio: Math.round(ratioNow), max: spec.maxCompression })
  if ((spec.minWidth && w < spec.minWidth) || (spec.minHeight && h < spec.minHeight)) issues.push({ kind: "dimsSmall", width: w, height: h, minWidth: spec.minWidth ?? 0, minHeight: spec.minHeight ?? 0 })
  if ((spec.maxWidth && w > spec.maxWidth) || (spec.maxHeight && h > spec.maxHeight)) issues.push({ kind: "dimsBig", width: w, height: h, maxWidth: spec.maxWidth ?? w, maxHeight: spec.maxHeight ?? h })
  const aspect = wantedAspect(spec)
  if (aspect && Math.abs(w / h - aspect) / aspect > 0.03) issues.push({ kind: "aspect", actual: ratio(w / h), wanted: ratio(aspect) })
  else if (spec.sizeCm && facts.dpi) {
    const [cw, ch] = [(w / facts.dpi) * 2.54, (h / facts.dpi) * 2.54]
    if (Math.abs(cw - spec.sizeCm.width) / spec.sizeCm.width > 0.1) issues.push({ kind: "printSize", widthCm: round1(cw), heightCm: round1(ch), wanted: `${spec.sizeCm.width} × ${spec.sizeCm.height} cm` })
  }
  const f = facts.face
  if (f && f.width > 0 && f.height > 0) {
    if (spec.faceHeight) {
      const share = f.height / h
      if (share < spec.faceHeight[0]) issues.push({ kind: "faceSmall", share: Math.round(share * 100), min: Math.round(spec.faceHeight[0] * 100) })
      else if (share > spec.faceHeight[1]) issues.push({ kind: "faceBig", share: Math.round(share * 100), max: Math.round(spec.faceHeight[1] * 100) })
    } else if (spec.faceArea) {
      const share = (f.width * f.height) / (w * h)
      if (share < spec.faceArea * 0.9) issues.push({ kind: "faceSmall", share: Math.round(share * 100), min: Math.round(spec.faceArea * 100) })
    }
    if (Math.abs(f.x + f.width / 2 - w / 2) / w > 0.08) issues.push({ kind: "faceOffCentre" })
  }
  if (spec.whiteBackground && facts.background && !facts.background.white) issues.push({ kind: "background" })
  if (spec.colour && facts.background?.grey) issues.push({ kind: "colour" })
  return issues
}

/** The crop that meets the spec's shape and face rules, in source pixels. */
export function planCrop(width: number, height: number, spec: PhotoSpec, face?: FaceBox | null): FaceBox {
  // No shape in the spec: keep the photo's own, but turn a landscape shot into an Indian passport-size 3.5 × 4.5 portrait.
  const aspect = wantedAspect(spec) ?? Math.min(width / height, 7 / 9)
  let cw = Math.min(width, height * aspect)
  let ch = cw / aspect
  let cx = (width - cw) / 2
  let cy = (height - ch) / 2
  if (face && face.width > 0 && face.height > 0) {
    if (spec.faceHeight) ch = Math.min(height, face.height / ((spec.faceHeight[0] + spec.faceHeight[1]) / 2))
    else if (spec.faceArea) ch = Math.min(height, Math.sqrt((face.width * face.height) / Math.min(0.95, spec.faceArea + 0.03) / aspect))
    cw = ch * aspect
    if (cw > width) [cw, ch] = [width, width / aspect]
    cx = face.x + face.width / 2 - cw / 2
    cy = face.y + face.height / 2 - ch * 0.48
  }
  cx = Math.max(0, Math.min(width - cw, cx))
  cy = Math.max(0, Math.min(height - ch, cy))
  return { x: Math.round(cx), y: Math.round(cy), width: Math.round(cw), height: Math.round(ch) }
}

/** Output size in pixels for a crop, inside the spec's limits. cm specs default to 300 DPI. */
export function planSize(crop: FaceBox, spec: PhotoSpec): { width: number; height: number; dpi?: number } {
  const aspect = crop.width / crop.height
  let width = spec.sizeCm ? Math.round((spec.sizeCm.width / 2.54) * 300) : crop.width
  if (spec.maxWidth) width = Math.min(width, spec.maxWidth, Math.floor((spec.maxHeight ?? Infinity) * aspect))
  // With a compression cap, keep the pixel count low enough that a file under maxKB still meets it.
  if (spec.maxCompression && spec.maxKB) width = Math.min(width, Math.floor(Math.sqrt(((spec.maxKB * 1000 * 0.8 * spec.maxCompression) / 3) * aspect)))
  if (spec.minWidth) width = Math.max(width, spec.minWidth, Math.ceil((spec.minHeight ?? 0) * aspect))
  width = Math.max(1, Math.min(width, 4000))
  const height = Math.max(1, Math.round(width / aspect))
  return { width, height, dpi: spec.sizeCm ? Math.round((width * 2.54) / spec.sizeCm.width) : undefined }
}

/** Writes DPI into a JPEG's JFIF header (adding one if missing) so the printed size comes out right. */
export function setJpegDpi(bytes: Uint8Array, dpi: number): Uint8Array {
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) return bytes
  const d = Math.max(1, Math.min(65535, Math.round(dpi)))
  if (bytes[2] === 0xff && bytes[3] === 0xe0 && String.fromCharCode(...Array.from(bytes.slice(6, 11))) === "JFIF\0") {
    const out = bytes.slice()
    out[13] = 1
    out[14] = out[16] = d >> 8
    out[15] = out[17] = d & 255
    return out
  }
  const app0 = [0xff, 0xe0, 0, 16, 0x4a, 0x46, 0x49, 0x46, 0, 1, 1, 1, d >> 8, d & 255, d >> 8, d & 255, 0, 0]
  const out = new Uint8Array(bytes.length + app0.length)
  out.set(bytes.slice(0, 2))
  out.set(app0, 2)
  out.set(bytes.slice(2), 2 + app0.length)
  return out
}

/** Byte limits a fixed file should land inside, safe whether the portal counts 1000 or 1024 bytes per KB. Pass the output size to honour `maxCompression`. */
export function byteWindow(spec: PhotoSpec, size?: { width: number; height: number }): [number, number] {
  const fromKB = spec.minKB ? spec.minKB * 1024 * 1.05 : 0
  const min = Math.max(fromKB, spec.maxCompression && size ? ((size.width * size.height * 3) / spec.maxCompression) * 1.05 : 0)
  const max = spec.maxKB ? spec.maxKB * 1000 * 0.95 : Infinity
  return [Math.min(min, max), max]
}
