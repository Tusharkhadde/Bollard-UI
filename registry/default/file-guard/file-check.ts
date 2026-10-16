// Pure file checks used by <FileGuard>. No React, so they also run in workers and on the server.

export type SniffedType = "png" | "jpeg" | "gif" | "webp" | "pdf" | "zip" | "mp4"

const SIGNATURES: { type: SniffedType; at: number; bytes: number[]; also?: [number, number[]] }[] = [
  { type: "png", at: 0, bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
  { type: "jpeg", at: 0, bytes: [0xff, 0xd8, 0xff] },
  { type: "gif", at: 0, bytes: [0x47, 0x49, 0x46, 0x38] },
  { type: "webp", at: 0, bytes: [0x52, 0x49, 0x46, 0x46], also: [8, [0x57, 0x45, 0x42, 0x50]] },
  { type: "pdf", at: 0, bytes: [0x25, 0x50, 0x44, 0x46] },
  { type: "zip", at: 0, bytes: [0x50, 0x4b, 0x03, 0x04] },
  { type: "mp4", at: 4, bytes: [0x66, 0x74, 0x79, 0x70] },
]

/** Extensions each real format may legitimately wear (first = canonical). DOCX/XLSX/PPTX are ZIP containers. */
const EXTENSIONS: Record<SniffedType, string[]> = {
  png: ["png"],
  jpeg: ["jpg", "jpeg", "jfif"],
  gif: ["gif"],
  webp: ["webp"],
  pdf: ["pdf"],
  zip: ["zip", "docx", "xlsx", "pptx"],
  mp4: ["mp4", "m4v", "mov"],
}
const MIME: Record<SniffedType, string> = {
  png: "image/png", jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp",
  pdf: "application/pdf", zip: "application/zip", mp4: "video/mp4",
}

/** Reads the first 12 bytes of a file and returns its real format, or null if unknown. */
export async function sniffFileType(file: Blob): Promise<SniffedType | null> {
  try {
    const head = new Uint8Array(await file.slice(0, 12).arrayBuffer())
    const matches = (at: number, bytes: number[]) => bytes.every((b, i) => head[at + i] === b)
    return SIGNATURES.find((s) => matches(s.at, s.bytes) && (!s.also || matches(...s.also)))?.type ?? null
  } catch {
    return null
  }
}

/** 1536 → "1.5 KB". */
export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  const units = ["KB", "MB", "GB"]
  let value = bytes / 1024
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit++
  }
  return `${value.toFixed(value < 10 ? 1 : 0)} ${units[unit]}`
}

const extOf = (name: string) => (name.includes(".") ? name.split(".").pop()!.toLowerCase() : "")
/** Identity used for duplicate detection. */
export const fingerprint = (f: File) => `${f.name}:${f.size}:${f.lastModified}`
// .mov is often QuickTime ("moov"/"wide" boxes), which we don't sniff, so don't call it fake.
const sniffable = (ext: string) => ext !== "mov" && Object.values(EXTENSIONS).some((list) => list.includes(ext))

export interface FileCheckOptions {
  /** Allowed extensions without dots, lowercase. */
  allowed?: string[]
  maxSize?: number
  maxFiles?: number
}

export interface FileVerdict {
  file: File
  /** Why it was rejected. Absent when the file is fine. */
  reason?: string
  /** One-tap fix: the same bytes under the extension they really are. */
  fix?: { label: string; file: File }
}

/** Checks one file against the limits, the already-accepted fingerprints and its own first bytes. */
export async function checkFile(file: File, { allowed, maxSize, maxFiles }: FileCheckOptions, seen: Set<string>): Promise<FileVerdict> {
  const ext = extOf(file.name)
  const dotExt = ext ? `.${ext}` : "file"
  if (file.size === 0) return { file, reason: "This file is empty (0 bytes)." }
  if (seen.has(fingerprint(file))) return { file, reason: "Already added. This is the same file." }
  if (maxFiles !== undefined && seen.size >= maxFiles) return { file, reason: `Over the ${maxFiles}-file limit.` }
  if (maxSize !== undefined && file.size > maxSize)
    return { file, reason: `${formatBytes(file.size)} is over the ${formatBytes(maxSize)} limit.` }
  if (allowed && !allowed.includes(ext))
    return { file, reason: `${ext ? dotExt : "Files without an extension"} isn't allowed. Use ${allowed.map((a) => `.${a}`).join(", ")}.` }
  const real = await sniffFileType(file)
  if (real && !EXTENSIONS[real].includes(ext)) {
    const fixExt = EXTENSIONS[real][0]
    const name = `${ext ? file.name.slice(0, -ext.length - 1) : file.name}.${fixExt}`
    const renamed = new File([file], name, { type: MIME[real], lastModified: file.lastModified })
    const canFix = (!allowed || allowed.includes(fixExt)) && !seen.has(fingerprint(renamed))
    return {
      file,
      reason: `This ${dotExt} is actually a ${real.toUpperCase()}.`,
      fix: canFix ? { label: `Rename to .${fixExt}`, file: renamed } : undefined,
    }
  }
  if (!real && sniffable(ext)) return { file, reason: `Its contents don't match a real ${dotExt}. It may be corrupted or mislabeled.` }
  return { file }
}
