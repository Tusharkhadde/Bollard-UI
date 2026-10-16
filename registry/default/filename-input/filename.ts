// Bollard UI — filename-input · MIT licence · https://bollard-ui.vercel.app/components/filename-input

/** Extensions made of two parts, kept together so "backup.tar.gz" keeps ".tar.gz". */
export const COMPOUND_EXTENSIONS = [".tar.gz", ".tar.bz2", ".tar.xz", ".tar.zst"]

// Windows device names, also reserved with any extension (NUL.txt, NUL.tar.gz) and with superscript digits.
const RESERVED = /^(con|prn|aux|nul|com[0-9¹²³]|lpt[0-9¹²³])$/i
// Characters Windows forbids, plus ASCII control characters. "/" is also the separator on macOS and Linux.
// eslint-disable-next-line no-control-regex
const ILLEGAL = /[<>:"/\\|?*\u0000-\u001f]/

/** Splits a file name into base and extension (with its dot). A dotfile like ".gitignore" has no extension. */
export function splitFilename(name: string) {
  const lower = name.toLowerCase()
  const compound = COMPOUND_EXTENSIONS.find((ext) => lower.endsWith(ext) && lower.length > ext.length)
  if (compound) return { base: name.slice(0, -compound.length), ext: name.slice(-compound.length) }
  const dot = name.lastIndexOf(".")
  return dot > 0 && dot < name.length - 1 ? { base: name.slice(0, dot), ext: name.slice(dot) } : { base: name, ext: "" }
}

export type FilenameIssueCode = "empty" | "illegal" | "reserved" | "edge" | "long" | "duplicate" | "caseDuplicate" | "extRemoved" | "extChanged"

export interface FilenameIssue {
  code: FilenameIssueCode
  /** Errors stop the rename on some system; warnings are a heads-up. */
  severity: "error" | "warning"
  /** Indexes of the characters at fault, for highlighting. */
  at?: number[]
  /** The name with the problem fixed. */
  fix?: string
  /** The existing name it clashes with, or the extension it replaces. */
  other?: string
}

export interface FilenameCheckOptions {
  /** The name before renaming; its extension is the one to keep. */
  original?: string
  /** Other names already in the folder. */
  existing?: string[]
  /** Longest name in UTF-8 bytes (255 on ext4, APFS and NTFS for plain ASCII). */
  maxBytes?: number
}

const bytes = (text: string) => new TextEncoder().encode(text).length
const same = (a: string, b: string) => a.normalize("NFC").toLowerCase() === b.normalize("NFC").toLowerCase()

/** Cuts the base so the whole name fits in `maxBytes`, never splitting a character. */
function fitBytes(base: string, ext: string, maxBytes: number) {
  let out = ""
  for (const ch of base) {
    if (bytes(out + ch + ext) > maxBytes) break
    out += ch
  }
  return out.trimEnd() + ext
}

/** Every problem with a new file name, errors first. */
export function checkFilename(name: string, { original, existing = [], maxBytes = 255 }: FilenameCheckOptions = {}): FilenameIssue[] {
  if (!name.trim()) return [{ code: "empty", severity: "error" }]
  const issues: FilenameIssue[] = []
  const chars = [...name]

  const illegal = chars.flatMap((ch, i) => (ILLEGAL.test(ch) ? [i] : []))
  if (illegal.length) {
    const fix = chars.map((ch) => (/[/\\:|]/.test(ch) ? "-" : ILLEGAL.test(ch) ? "" : ch)).join("")
    issues.push({ code: "illegal", severity: "error", at: illegal, fix })
  }

  const stem = name.split(".")[0].trim()
  if (RESERVED.test(stem)) issues.push({ code: "reserved", severity: "error", fix: name.replace(stem, `${stem}_`) })

  const lead = chars.length - name.trimStart().length
  const trail = chars.length - [...name.replace(/[. ]+$/, "")].length
  if (lead || trail) {
    const at = [...Array(lead).keys(), ...Array.from({ length: trail }, (_, i) => chars.length - trail + i)]
    issues.push({ code: "edge", severity: "error", at, fix: name.trimStart().replace(/[. ]+$/, "") })
  }

  // Windows drops leading spaces and trailing dots and spaces, so judge the rest on what would be saved.
  const tidy = name.trimStart().replace(/[. ]+$/, "")
  const { base, ext } = splitFilename(tidy)
  if (bytes(name) > maxBytes) issues.push({ code: "long", severity: "error", fix: fitBytes(base, ext, maxBytes) })

  const others = existing.filter((other) => !original || !same(other, original))
  const clash = others.find((other) => same(other, tidy))
  if (clash) {
    let n = 2
    while (others.some((other) => same(other, `${base} (${n})${ext}`))) n++
    issues.push({ code: clash.normalize("NFC") === tidy.normalize("NFC") ? "duplicate" : "caseDuplicate", severity: "error", fix: `${base} (${n})${ext}`, other: clash })
  }

  // A changed ending that doesn't look like an extension ("v1.2 final") reads as the extension being removed.
  const before = original ? splitFilename(original).ext : ""
  const real = COMPOUND_EXTENSIONS.includes(ext.toLowerCase()) || /^\.[a-z0-9]{1,4}$/i.test(ext)
  if (before && !same(before, ext)) {
    issues.push(
      real
        ? { code: "extChanged", severity: "warning", fix: `${base}${before}`, other: before }
        : { code: "extRemoved", severity: "warning", fix: `${tidy}${before}`, other: before },
    )
  }
  return issues
}
