// Bollard UI — doc-upload-match · MIT licence · https://bollard-ui.vercel.app/components/doc-upload-match

export type DocKind = "aadhaar-front" | "aadhaar-back" | "aadhaar" | "pan" | "passport" | "photo" | "statement" | "other"
export type DocFormat = "pdf" | "jpeg" | "png" | "webp" | "heic" | "avif" | "unknown"

/** What the upload slot asks for. */
export interface DocSpec {
  kind: DocKind
  /** Most pages a PDF may have. Defaults to 1, or unlimited for a statement. */
  pages?: number
  /** Smallest acceptable short side of an image, px. */
  minShortSide?: number
  /** Largest file, bytes. */
  maxBytes?: number
  /** Formats the server takes. */
  accept?: DocFormat[]
}

export interface DocSignals {
  format: DocFormat
  bytes: number
  pdf?: { encrypted: boolean; pages: number | null }
  image?: {
    width: number
    height: number
    /** Variance of the Laplacian on a ≤512px greyscale copy. Low means blurry. */
    sharpness: number | null
    /** Share of the picture that isn't flat border (0–1). Low means the document is small in the frame. */
    fill: number | null
  }
  /** JPEG camera metadata present. Screenshots and WhatsApp-forwarded images have none. */
  exif: boolean
  /** Kinds the file name points to ("PAN.jpg", "aadhaar_back.png"). */
  nameKinds: DocKind[]
  screenshotName: boolean
  forwarded: boolean
}

/** A classifier's verdict, from OCR or a model the caller plugs in. */
export interface DocGuess { kind: DocKind; confidence: number }

/** Reads the first bytes, not the extension: a renamed .heic is still HEIC. */
export function sniffFormat(head: Uint8Array): DocFormat {
  const at = (i: number, ...b: number[]) => b.every((x, j) => head[i + j] === x)
  if (at(0, 0x25, 0x50, 0x44, 0x46)) return "pdf"
  if (at(0, 0xff, 0xd8, 0xff)) return "jpeg"
  if (at(0, 0x89, 0x50, 0x4e, 0x47)) return "png"
  if (at(0, 0x52, 0x49, 0x46, 0x46) && at(8, 0x57, 0x45, 0x42, 0x50)) return "webp"
  if (at(4, 0x66, 0x74, 0x79, 0x70)) {
    const brand = String.fromCharCode(...head.slice(8, 12))
    if (/avi[fs]/.test(brand)) return "avif"
    if (/hei[cfsx]|mif1|msf1/.test(brand)) return "heic"
  }
  return "unknown"
}

/** Encryption and page count from a PDF's raw text (head and tail are enough for the trailer). */
export function pdfFacts(raw: string) {
  const encrypted = /\/Encrypt\s*(\d+\s+\d+\s+R|<<)/.test(raw)
  const pageObjects = raw.match(/\/Type\s*\/Page(?![a-zA-Z])/g)?.length ?? 0
  const counts = [...raw.matchAll(/\/Type\s*\/Pages[^>]*?\/Count\s+(\d+)|\/Count\s+(\d+)[^>]*?\/Type\s*\/Pages/g)].map((m) => Number(m[1] ?? m[2]))
  const pages = counts.length ? Math.max(...counts) : pageObjects || null
  return { encrypted, pages }
}

/** An APP1 "Exif" segment in the first 64 KB of a JPEG. */
export function hasExif(head: Uint8Array) {
  for (let i = 2; i < Math.min(head.length - 10, 65536); i++) {
    if (head[i] === 0xff && head[i + 1] === 0xe1 && head[i + 4] === 0x45 && head[i + 5] === 0x78 && head[i + 6] === 0x69 && head[i + 7] === 0x66) return true
  }
  return false
}

/** What a file name says about its contents. */
export function nameSignals(name: string) {
  const n = String(name ?? "").toLowerCase().replace(/[_\-.()]+/g, " ")
  const kinds: DocKind[] = []
  const aadhaar = /\b(e ?)?aa?dh?aa?r|\buid(ai)?\b/.test(n)
  if (aadhaar && /\b(back|rear|reverse|address)\b/.test(n)) kinds.push("aadhaar-back")
  else if (aadhaar && /\bfront\b/.test(n)) kinds.push("aadhaar-front")
  else if (aadhaar) kinds.push("aadhaar")
  if (/\b(e ?)?pan( ?card)?\b/.test(n)) kinds.push("pan")
  if (/\bpassport\b/.test(n)) kinds.push("passport")
  if (/\b(statement|bank stmt|account statement)\b/.test(n)) kinds.push("statement")
  return {
    nameKinds: kinds,
    screenshotName: /\b(screenshot|screen shot|scrnshot|screen ?capture|scr \d)/.test(n),
    forwarded: /\bwhatsapp image\b|\bimg \d{8} wa\d+/.test(n),
  }
}

/** Sharpness and border fill from greyscale pixels (one byte each, row-major). */
export function pixelSignals(grey: Uint8ClampedArray | Uint8Array, w: number, h: number) {
  if (w < 3 || h < 3 || grey.length < w * h) return { sharpness: null, fill: null }
  let sum = 0, sumSq = 0, count = 0
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x
      const lap = grey[i - 1] + grey[i + 1] + grey[i - w] + grey[i + w] - 4 * grey[i]
      sum += lap; sumSq += lap * lap; count++
    }
  }
  const mean = sum / count
  const flatRow = (y: number) => spread(Array.from({ length: w }, (_, x) => grey[y * w + x])) < 6
  const flatCol = (x: number) => spread(Array.from({ length: h }, (_, y) => grey[y * w + x])) < 6
  let top = 0, bottom = h - 1, left = 0, right = w - 1
  while (top < bottom && flatRow(top)) top++
  while (bottom > top && flatRow(bottom)) bottom--
  while (left < right && flatCol(left)) left++
  while (right > left && flatCol(right)) right--
  return { sharpness: sumSq / count - mean * mean, fill: ((bottom - top + 1) * (right - left + 1)) / (w * h) }
}

function spread(values: number[]) {
  const m = values.reduce((a, b) => a + b, 0) / values.length
  return Math.sqrt(values.reduce((a, b) => a + (b - m) ** 2, 0) / values.length)
}

export type DocIssue =
  | { kind: "empty" }
  | { kind: "format"; format: DocFormat }
  | { kind: "tooBig"; bytes: number; max: number }
  | { kind: "locked" }
  | { kind: "pages"; pages: number; max: number }
  | { kind: "small"; width: number; height: number; min: number }
  | { kind: "blurry" }
  | { kind: "screenshot"; nested: boolean }
  | { kind: "framed"; fill: number }
  | { kind: "wrongDoc"; found: DocKind; by: "name" | "classifier" }

export interface MatchOptions { blurBelow?: number; guess?: DocGuess | null; minConfidence?: number }

const sameFamily = (want: DocKind, got: DocKind) => want === got || (want === "aadhaar" && got.startsWith("aadhaar")) || (got === "aadhaar" && want.startsWith("aadhaar"))

/** Everything that would get this upload rejected, most fundamental first. */
export function matchDocument(spec: DocSpec, s: DocSignals, { blurBelow = 60, guess, minConfidence = 0.6 }: MatchOptions = {}): DocIssue[] {
  if (!s.bytes) return [{ kind: "empty" }]
  const accept = spec.accept ?? ["pdf", "jpeg", "png"]
  const issues: DocIssue[] = []
  if (!accept.includes(s.format)) issues.push({ kind: "format", format: s.format })
  const max = spec.maxBytes ?? 5 * 1024 * 1024
  if (s.bytes > max) issues.push({ kind: "tooBig", bytes: s.bytes, max })
  if (s.pdf?.encrypted) issues.push({ kind: "locked" })
  const maxPages = spec.pages ?? (spec.kind === "statement" ? Infinity : 1)
  if (s.pdf?.pages && s.pdf.pages > maxPages) issues.push({ kind: "pages", pages: s.pdf.pages, max: maxPages })
  const img = s.image
  if (img) {
    const min = spec.minShortSide ?? 600
    if (Math.min(img.width, img.height) < min) issues.push({ kind: "small", width: img.width, height: img.height, min })
    const tall = Math.max(img.width, img.height) / Math.max(1, Math.min(img.width, img.height))
    const screenshot = s.screenshotName || (s.format === "png" && !s.exif && tall >= 1.9)
    const framed = img.fill !== null && img.fill < 0.55
    if (screenshot) issues.push({ kind: "screenshot", nested: framed })
    else if (framed) issues.push({ kind: "framed", fill: img.fill! })
    if (img.sharpness !== null && img.sharpness < blurBelow && !issues.some((i) => i.kind === "small")) issues.push({ kind: "blurry" })
  }
  const found = guess && guess.confidence >= minConfidence && guess.kind !== "other" ? { kind: guess.kind, by: "classifier" as const } : s.nameKinds[0] ? { kind: s.nameKinds[0], by: "name" as const } : null
  if (found && !sameFamily(spec.kind, found.kind) && spec.kind !== "other") issues.unshift({ kind: "wrongDoc", found: found.kind, by: found.by })
  else if (found && spec.kind.startsWith("aadhaar-") && found.kind.startsWith("aadhaar-") && found.kind !== spec.kind) issues.unshift({ kind: "wrongDoc", found: found.kind, by: found.by })
  return issues
}

/** Reads every cheap signal from a File in the browser. Never throws: unreadable parts come back empty. */
export async function readSignals(file: File): Promise<DocSignals> {
  const names = nameSignals(file.name)
  const base: DocSignals = { format: "unknown", bytes: file.size, exif: false, ...names }
  if (!file.size) return base
  const head = new Uint8Array(await file.slice(0, 65536).arrayBuffer().catch(() => new ArrayBuffer(0)))
  base.format = sniffFormat(head)
  if (base.format === "jpeg") base.exif = hasExif(head)
  if (base.format === "pdf") {
    // The whole file when small; otherwise head and tail, where the trailer and page tree usually sit.
    const part = file.size <= 4_000_000 ? file : new Blob([file.slice(0, 1_000_000), file.slice(-1_000_000)])
    const raw = new TextDecoder("latin1").decode(await part.arrayBuffer().catch(() => new ArrayBuffer(0)))
    base.pdf = pdfFacts(raw)
  }
  if (base.format === "jpeg" || base.format === "png" || base.format === "webp") {
    try {
      const bitmap = await createImageBitmap(file)
      const scale = Math.min(1, 512 / Math.max(bitmap.width, bitmap.height))
      const w = Math.max(1, Math.round(bitmap.width * scale)), h = Math.max(1, Math.round(bitmap.height * scale))
      const canvas = document.createElement("canvas")
      canvas.width = w; canvas.height = h
      const ctx = canvas.getContext("2d", { willReadFrequently: true })
      let px = { sharpness: null as number | null, fill: null as number | null }
      if (ctx) {
        ctx.drawImage(bitmap, 0, 0, w, h)
        const rgba = ctx.getImageData(0, 0, w, h).data
        const grey = new Uint8ClampedArray(w * h)
        for (let i = 0; i < grey.length; i++) grey[i] = rgba[i * 4] * 0.299 + rgba[i * 4 + 1] * 0.587 + rgba[i * 4 + 2] * 0.114
        px = pixelSignals(grey, w, h)
      }
      base.image = { width: bitmap.width, height: bitmap.height, ...px }
      bitmap.close()
    } catch {
      // Undecodable image: the format check already covers what the user can do about it.
    }
  }
  return base
}
