import { byteWindow, planCrop, planSize, setJpegDpi, sniff, type FaceBox, type PhotoFacts, type PhotoSpec } from "./photo-spec"

// Browser-only helpers: call them from effects and event handlers, never during render.

function canvas(width: number, height: number) {
  const c = document.createElement("canvas")
  c.width = width
  c.height = height
  const ctx = c.getContext("2d", { willReadFrequently: true })
  if (!ctx) throw new Error("Canvas is not available")
  return { c, ctx }
}

/** Samples the top and upper sides (where the background shows) and the whole image for colour. */
function sampleBackground(bitmap: ImageBitmap): PhotoFacts["background"] {
  const w = 120
  const h = Math.max(1, Math.round((bitmap.height / bitmap.width) * w))
  const { ctx } = canvas(w, h)
  ctx.drawImage(bitmap, 0, 0, w, h)
  const { data } = ctx.getImageData(0, 0, w, h)
  const edge = Math.max(1, Math.round(w * 0.08))
  let sum = [0, 0, 0]
  let n = 0
  let colourful = 0
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4
      const [r, g, b] = [data[i], data[i + 1], data[i + 2]]
      if (Math.max(r, g, b) - Math.min(r, g, b) > 12) colourful++
      if (y < edge || (y < h / 2 && (x < edge || x >= w - edge))) {
        sum = [sum[0] + r, sum[1] + g, sum[2] + b]
        n++
      }
    }
  const mean = sum.map((s) => s / Math.max(1, n))
  return { white: Math.min(...mean) >= 215 && Math.max(...mean) - Math.min(...mean) <= 25, grey: colourful / (w * h) < 0.01 }
}

/** Reads type, DPI, size in pixels and the background of a photo file. Never throws. */
export async function readPhoto(file: Blob & { name?: string }, face?: FaceBox | null): Promise<PhotoFacts> {
  const head = new Uint8Array(await file.slice(0, 64).arrayBuffer())
  const { type, dpi } = sniff(head)
  const claimed = (file.name?.includes(".") ? file.name.split(".").pop() : file.type?.split("/")[1])?.toLowerCase()
  try {
    const bitmap = await createImageBitmap(file)
    const facts: PhotoFacts = { bytes: file.size, type, claimed, dpi, width: bitmap.width, height: bitmap.height, background: sampleBackground(bitmap), face }
    bitmap.close()
    return facts
  } catch {
    return { bytes: file.size, type, claimed, dpi, face }
  }
}

const toBlob = (c: HTMLCanvasElement, quality: number) =>
  new Promise<Blob>((resolve, reject) => c.toBlob((b) => (b ? resolve(b) : reject(new Error("Could not encode"))), "image/jpeg", quality))

export interface FixedPhoto {
  file: File
  face?: FaceBox
  width: number
  height: number
}

/** Crops to the spec's shape (around the face when known), resizes into its limits and re-encodes a JPEG inside its KB window. */
export async function fixPhoto(file: Blob, spec: PhotoSpec, face?: FaceBox | null): Promise<FixedPhoto> {
  const bitmap = await createImageBitmap(file)
  try {
    const crop = planCrop(bitmap.width, bitmap.height, spec, face)
    const size = planSize(crop, spec)
    let scale = 1
    for (let attempt = 0; attempt < 6; attempt++) {
      const width = Math.round(size.width * scale)
      const height = Math.round(size.height * scale)
      const [minBytes, maxBytes] = byteWindow(spec, { width, height })
      const { c, ctx } = canvas(width, height)
      ctx.fillStyle = "#fff"
      ctx.fillRect(0, 0, width, height)
      ctx.imageSmoothingQuality = "high"
      ctx.drawImage(bitmap, crop.x, crop.y, crop.width, crop.height, 0, 0, width, height)
      let [lo, hi] = [0.4, 0.95]
      let best: Blob | undefined
      let smallest: Blob | undefined
      for (let step = 0; step < 7; step++) {
        const q = step === 0 ? hi : (lo + hi) / 2
        const blob = await toBlob(c, q)
        if (!smallest || blob.size < smallest.size) smallest = blob
        if (blob.size > maxBytes) hi = q
        else {
          best = blob
          if (blob.size >= minBytes) break
          if (step === 0) break
          lo = q
        }
      }
      const canGrow = !spec.maxWidth || Math.round(size.width * scale * 1.25) <= spec.maxWidth
      const canShrink = !spec.minWidth || Math.round(size.width * scale * 0.85) >= spec.minWidth
      if (best && best.size >= minBytes) {
        const bytes = new Uint8Array(await best.arrayBuffer())
        const named = `${spec.fileName ?? "photo"}.jpg`
        const k = width / crop.width
        return {
          file: new File([(size.dpi ? setJpegDpi(bytes, Math.round(size.dpi * scale)) : bytes) as BlobPart], named, { type: "image/jpeg" }),
          face: face ? { x: (face.x - crop.x) * k, y: (face.y - crop.y) * k, width: face.width * k, height: face.height * k } : undefined,
          width,
          height,
        }
      }
      if (best && canGrow) scale *= 1.25
      else if (!best && smallest && canShrink) scale *= 0.85
      else break
    }
    throw new Error("No size and quality fits this spec")
  } finally {
    bitmap.close()
  }
}
