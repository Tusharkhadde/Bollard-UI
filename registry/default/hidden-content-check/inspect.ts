/**
 * Reads an Office Open XML file (.xlsx, .docx, .pptx) in the browser or on the server and lists what is
 * inside it that the person sharing it can't see on screen: hidden and "very hidden" sheets, hidden
 * rows and columns, comments, tracked deletions, hidden text, speaker notes, hidden slides, embedded
 * files (a chart's whole source workbook rides inside a deck), links to files on internal drives and
 * author details. No dependencies: the zip is read by hand and inflated with the platform's
 * DecompressionStream("deflate-raw").
 */

export type HiddenKind =
  | "hidden-sheet"
  | "hidden-rows"
  | "hidden-columns"
  | "tracked-changes"
  | "hidden-text"
  | "comments"
  | "speaker-notes"
  | "hidden-slides"
  | "embedded-files"
  | "external-links"
  | "author"

export type HiddenSeverity = "high" | "medium" | "low"

export interface HiddenFinding {
  /** Stable id, e.g. "hidden-sheet:SAP export". */
  id: string
  kind: HiddenKind
  severity: HiddenSeverity
  /** How many: rows in a hidden sheet, hidden columns, comments, changes, notes… */
  count: number
  /** Sheet or part it sits in, when there is one. */
  where?: string
  /** A sheet hidden with state="veryHidden", which Excel's Unhide menu doesn't list. */
  veryHidden?: boolean
  /** Sample of the hidden content: table rows for sheets, passages of text otherwise. */
  preview: string[][]
}

export interface HiddenReport {
  format: "xlsx" | "docx" | "pptx" | "other"
  findings: HiddenFinding[]
  /** Set when the file couldn't be read: `locked` is an old binary (.xls/.doc) or password-protected file. */
  error?: "locked" | "unreadable" | "too-large"
}

const MAX_BYTES = 200 * 1024 * 1024
const MAX_PART = 64 * 1024 * 1024
const SEVERITY: Record<HiddenKind, HiddenSeverity> = {
  "hidden-sheet": "high", "tracked-changes": "high", "hidden-text": "high", "hidden-rows": "medium", "hidden-columns": "medium",
  comments: "medium", "speaker-notes": "medium", "hidden-slides": "medium", "embedded-files": "medium", "external-links": "medium", author: "low",
}

type Zip = Map<string, () => Promise<Uint8Array>>

/** Lists a zip's entries with lazy readers. Returns null for anything that isn't a readable zip (ZIP64 included). */
export function readZip(bytes: Uint8Array): Zip | null {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  let eocd = -1
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) {
    if (view.getUint32(i, true) === 0x06054b50) { eocd = i; break }
  }
  if (eocd < 0) return null
  const count = view.getUint16(eocd + 10, true)
  let p = view.getUint32(eocd + 16, true)
  const zip: Zip = new Map()
  const names = new TextDecoder()
  for (let n = 0; n < count && p + 46 <= bytes.length; n++) {
    if (view.getUint32(p, true) !== 0x02014b50) return null
    const method = view.getUint16(p + 10, true)
    const size = view.getUint32(p + 20, true)
    const full = view.getUint32(p + 24, true)
    const nameLen = view.getUint16(p + 28, true)
    const skip = nameLen + view.getUint16(p + 30, true) + view.getUint16(p + 32, true)
    const local = view.getUint32(p + 42, true)
    const name = names.decode(bytes.subarray(p + 46, p + 46 + nameLen))
    p += 46 + skip
    if (local + 30 > bytes.length || full > MAX_PART) continue
    const start = local + 30 + view.getUint16(local + 26, true) + view.getUint16(local + 28, true)
    const data = bytes.subarray(start, start + size)
    zip.set(name.replace(/^\//, ""), async () => {
      if (method === 0) return data
      if (method !== 8) throw new Error("unsupported compression")
      const stream = new Blob([data as BlobPart]).stream().pipeThrough(new DecompressionStream("deflate-raw"))
      return new Uint8Array(await new Response(stream).arrayBuffer())
    })
  }
  return zip
}

const decoder = new TextDecoder()
async function text(zip: Zip, name: string) {
  const read = zip.get(name)
  if (!read) return ""
  try {
    return decoder.decode(await read()).replace(/^\uFEFF/, "")
  } catch {
    return ""
  }
}

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" }
const unescape = (s: string) =>
  s.replace(/&(#x[\da-f]+|#\d+|\w+);/gi, (m, e: string) =>
    e[0] === "#" ? String.fromCodePoint(parseInt(e[1] === "x" || e[1] === "X" ? e.slice(2) : e.slice(1), e[1] === "x" || e[1] === "X" ? 16 : 10) || 32) : ENTITIES[e] ?? m)
const attr = (tag: string, name: string) => unescape(new RegExp(`\\s${name}="([^"]*)"`).exec(tag)?.[1] ?? "")
/** Text of every <prefix:t> run in a fragment, joined. */
const runs = (xml: string, tag: string) => [...xml.matchAll(new RegExp(`<${tag}(?:\\s[^>]*)?>([^<]*)</${tag}>`, "g"))].map((m) => unescape(m[1])).join("")
const clip = (s: string, n = 140) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s)
const isOn = (tag: string) => !/\sw:val="(0|false|off)"/.test(tag)
const resolve = (base: string, target: string) => {
  if (target.startsWith("/")) return target.slice(1)
  const parts = base.split("/").slice(0, -1)
  for (const seg of target.split("/")) seg === ".." ? parts.pop() : seg !== "." && parts.push(seg)
  return parts.join("/")
}
const rels = async (zip: Zip, part: string) => {
  const slash = part.lastIndexOf("/")
  const xml = await text(zip, `${part.slice(0, slash)}/_rels/${part.slice(slash + 1)}.rels`)
  return new Map([...xml.matchAll(/<Relationship\s[^>]*>/g)].map((m) => [attr(m[0], "Id"), { target: attr(m[0], "Target"), external: attr(m[0], "TargetMode") === "External" }]))
}

const safeDecode = (s: string) => {
  try {
    return decodeURI(s)
  } catch {
    return s
  }
}
/** A link into a file share or company drive rather than the public web. */
export const isInternalLink = (target: string) =>
  /^(file:|\\\\|smb:|[a-z]:[\\/])/i.test(target) || /^https?:\/\/[^/]*(\.sharepoint\.com|\.internal|\.local|\.corp|intranet)[/:]/i.test(target)

/** "D12" → 3. Returns -1 without a column reference. */
const colIndex = (ref: string) => {
  const letters = /^([A-Z]{1,3})\d/i.exec(ref)?.[1]?.toUpperCase()
  if (!letters) return -1
  let n = 0
  for (const ch of letters) n = n * 26 + ch.charCodeAt(0) - 64
  return n - 1
}

/**
 * Every row of a worksheet as cell strings, shared strings resolved. Cells sit at their real column
 * (Excel leaves empty cells out, so "A1, D1" must land at 0 and 3, not 0 and 1).
 */
function sheetRows(xml: string, shared: string[]) {
  const rows: { hidden: boolean; cells: string[] }[] = []
  for (const row of xml.matchAll(/<row(\s[^>]*)?(?:\/>|>([\s\S]*?)<\/row>)/g)) {
    const cells: string[] = []
    let next = 0
    for (const c of (row[2] ?? "").matchAll(/<c(\s[^>]*)?(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const type = attr(c[1] ?? "", "t")
      const body = c[2] ?? ""
      const v = unescape(/<v>([^<]*)<\/v>/.exec(body)?.[1] ?? "")
      const at = colIndex(attr(c[1] ?? "", "r"))
      const col = at >= 0 && at < 16384 ? at : next
      while (cells.length < col) cells.push("")
      cells[col] = type === "inlineStr" ? runs(body, "t") : type === "s" ? shared[Number(v)] ?? "" : v
      next = col + 1
    }
    rows.push({ hidden: /\shidden="(1|true)"/.test(row[1] ?? ""), cells })
  }
  return rows
}
const sample = (rows: { cells: string[] }[]) => rows.filter((r) => r.cells.some(Boolean)).slice(0, 3).map((r) => r.cells.slice(0, 6).map((c) => clip(c, 40)))

async function xlsx(zip: Zip, out: HiddenFinding[]) {
  const book = await text(zip, "xl/workbook.xml")
  const links = await rels(zip, "xl/workbook.xml")
  const shared = [...(await text(zip, "xl/sharedStrings.xml")).matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) => runs(m[1], "t"))
  for (const tag of book.match(/<sheet\s[^>]*>/g) ?? []) {
    const name = attr(tag, "name")
    const state = attr(tag, "state")
    const target = links.get(/\s[\w]+:id="([^"]*)"/.exec(tag)?.[1] ?? "")?.target
    const sheetXml = target ? await text(zip, resolve("xl/workbook.xml", target)) : ""
    const rows = sheetRows(sheetXml, shared)
    const filled = rows.filter((r) => r.cells.some(Boolean))
    if (state === "hidden" || state === "veryHidden") {
      out.push({ id: `hidden-sheet:${name}`, kind: "hidden-sheet", severity: "high", count: filled.length, where: name, veryHidden: state === "veryHidden", preview: sample(rows) })
      continue
    }
    const hiddenRows = rows.filter((r) => r.hidden && r.cells.some(Boolean))
    if (hiddenRows.length) out.push({ id: `hidden-rows:${name}`, kind: "hidden-rows", severity: "medium", count: hiddenRows.length, where: name, preview: sample(hiddenRows) })
    const cols = (sheetXml.match(/<col\s[^>]*>/g) ?? []).filter((c) => /\shidden="(1|true)"/.test(c))
    const indexes = cols.flatMap((c) => {
      const min = Number(attr(c, "min")) || 1
      const max = Math.min(Number(attr(c, "max")) || min, min + 16383)
      return Array.from({ length: max - min + 1 }, (_, i) => min - 1 + i)
    })
    // Only columns that hold something count; a styled empty range isn't a leak.
    const used = indexes.filter((i) => filled.some((r) => r.cells[i]))
    if (used.length) {
      out.push({ id: `hidden-columns:${name}`, kind: "hidden-columns", severity: "medium", count: used.length, where: name, preview: filled.slice(0, 3).map((r) => used.slice(0, 6).map((i) => clip(r.cells[i] ?? "", 40))) })
    }
  }
  const notes: string[][] = []
  for (const part of [...zip.keys()].filter((k) => /^xl\/(comments\d*|threadedComments\/[^/]+)\.xml$/.test(k))) {
    const xml = await text(zip, part)
    for (const c of xml.matchAll(/<(?:comment|threadedComment)\s[^>]*>([\s\S]*?)<\/(?:comment|threadedComment)>/g)) {
      const body = runs(c[1], "t") || runs(c[1], "text")
      // Excel mirrors every threaded comment into the legacy comments part with this stub; count it once.
      if (/^\s*\[Threaded comment\]/.test(body)) continue
      notes.push([clip(body)])
    }
  }
  if (notes.length) out.push({ id: "comments", kind: "comments", severity: "medium", count: notes.length, preview: notes.slice(0, 3) })
  const external: string[][] = []
  for (const part of [...zip.keys()].filter((k) => /^xl\/externalLinks\/[^/]+\.xml$/.test(k))) {
    for (const r of (await rels(zip, part)).values()) if (r.external) external.push([safeDecode(r.target)])
  }
  if (external.length) out.push({ id: "external-links", kind: "external-links", severity: "medium", count: external.length, preview: external.slice(0, 3) })
}

async function docx(zip: Zip, out: HiddenFinding[]) {
  const doc = await text(zip, "word/document.xml")
  const changes = (doc.match(/<w:(ins|del|moveFrom|moveTo)[\s>]/g) ?? []).length
  const deleted = [...doc.matchAll(/<w:del\s[^>]*[^/]>([\s\S]*?)<\/w:del>/g)].map((m) => runs(m[1], "w:delText")).filter((s) => s.trim())
  if (changes) out.push({ id: "tracked-changes", kind: "tracked-changes", severity: "high", count: changes, preview: deleted.slice(0, 3).map((s) => [clip(s)]) })
  const hidden = [...doc.matchAll(/<w:r[\s>](?:(?!<\/w:r>)[\s\S])*?<\/w:r>/g)]
    .filter((m) => { const v = /<w:vanish(\s[^>]*)?\/>/.exec(m[0]); return !!v && isOn(v[0]) })
    .map((m) => runs(m[0], "w:t")).filter((s) => s.trim())
  if (hidden.length) out.push({ id: "hidden-text", kind: "hidden-text", severity: "high", count: hidden.length, preview: hidden.slice(0, 3).map((s) => [clip(s)]) })
  const comments = [...(await text(zip, "word/comments.xml")).matchAll(/<w:comment\s([^>]*)>([\s\S]*?)<\/w:comment>/g)]
  if (comments.length) out.push({ id: "comments", kind: "comments", severity: "medium", count: comments.length, preview: comments.slice(0, 3).map((c) => [clip(`${attr(c[1], "w:author") ? `${attr(c[1], "w:author")}: ` : ""}${runs(c[2], "w:t")}`)]) })
}

const slideNo = (k: string) => Number(/(\d+)\.xml$/.exec(k)?.[1] ?? 0)
async function pptx(zip: Zip, out: HiddenFinding[]) {
  const slides = [...zip.keys()].filter((k) => /^ppt\/slides\/slide\d+\.xml$/.test(k)).sort((a, b) => slideNo(a) - slideNo(b))
  const hidden: string[][] = []
  for (const s of slides) {
    const xml = await text(zip, s)
    if (/<p:sld\s[^>]*\sshow="(0|false)"/.test(xml)) hidden.push([`${slideNo(s)}. ${clip(runs(xml, "a:t"), 100)}`])
  }
  if (hidden.length) out.push({ id: "hidden-slides", kind: "hidden-slides", severity: "medium", count: hidden.length, preview: hidden.slice(0, 3) })
  const notes: string[][] = []
  for (const n of [...zip.keys()].filter((k) => /^ppt\/notesSlides\/notesSlide\d+\.xml$/.test(k)).sort((a, b) => slideNo(a) - slideNo(b))) {
    const body = runs((await text(zip, n)).replace(/<a:fld\s[\s\S]*?<\/a:fld>/g, ""), "a:t").trim()
    if (body) notes.push([clip(body)])
  }
  if (notes.length) out.push({ id: "speaker-notes", kind: "speaker-notes", severity: "medium", count: notes.length, preview: notes.slice(0, 3) })
  const comments = [...zip.keys()].filter((k) => /^ppt\/comments\/[^/]+\.xml$/.test(k))
  let count = 0
  const preview: string[][] = []
  for (const c of comments) {
    for (const m of (await text(zip, c)).matchAll(/<\w+:cm\s[^>]*>([\s\S]*?)<\/\w+:cm>/g)) {
      count++
      preview.push([clip(runs(m[1], "p:text") || runs(m[1], "a:t"))])
    }
  }
  if (count) out.push({ id: "comments", kind: "comments", severity: "medium", count, preview: preview.slice(0, 3) })
}

/**
 * Lists what an .xlsx, .docx or .pptx carries that isn't visible on screen. Accepts a Blob/File, an
 * ArrayBuffer or bytes. Never throws: unreadable input comes back with `error` set.
 */
export async function inspectHiddenContent(input: Blob | ArrayBuffer | Uint8Array | null | undefined, depth = 0): Promise<HiddenReport> {
  if (!input) return { format: "other", findings: [], error: "unreadable" }
  try {
    const size = input instanceof Uint8Array ? input.byteLength : input instanceof ArrayBuffer ? input.byteLength : input.size
    if (size > MAX_BYTES) return { format: "other", findings: [], error: "too-large" }
    const bytes = input instanceof Uint8Array ? input : new Uint8Array(input instanceof ArrayBuffer ? input : await input.arrayBuffer())
    // D0 CF 11 E0: an OLE container, i.e. a legacy .xls/.doc/.ppt or an encrypted OOXML file.
    if (bytes[0] === 0xd0 && bytes[1] === 0xcf && bytes[2] === 0x11 && bytes[3] === 0xe0) return { format: "other", findings: [], error: "locked" }
    const zip = bytes.length > 22 ? readZip(bytes) : null
    if (!zip) return { format: "other", findings: [], error: "unreadable" }
    const format = zip.has("xl/workbook.xml") ? "xlsx" : zip.has("word/document.xml") ? "docx" : zip.has("ppt/presentation.xml") ? "pptx" : "other"
    const findings: HiddenFinding[] = []
    if (format === "xlsx") await xlsx(zip, findings)
    if (format === "docx") await docx(zip, findings)
    if (format === "pptx") await pptx(zip, findings)
    const embedded = [...zip.keys()].filter((k) => /^(xl|word|ppt)\/embeddings\/[^/]+$/.test(k))
    if (embedded.length) {
      const preview: string[][] = []
      for (const e of embedded.slice(0, 3)) {
        const name = e.split("/").pop() ?? e
        // A chart's source workbook: say what it holds, one level deep.
        const inner = depth === 0 && /\.xlsx$/i.test(name) ? await inspectHiddenContent(await zip.get(e)!(), 1) : null
        const sheets = inner?.findings.filter((f) => f.kind === "hidden-sheet").length
        preview.push([sheets ? `${name} (${sheets} hidden sheet${sheets > 1 ? "s" : ""} inside)` : name])
      }
      findings.push({ id: "embedded-files", kind: "embedded-files", severity: "medium", count: embedded.length, preview })
    }
    if (format === "docx" || format === "pptx") {
      // Hyperlinks to file shares and internal drives reveal server names, folder structure and file names.
      const internal = new Set<string>()
      for (const part of [...zip.keys()].filter((k) => /^(word|ppt)\/(?:[^/]+\/)*_rels\/[^/]+\.rels$/.test(k))) {
        for (const m of (await text(zip, part)).matchAll(/<Relationship\s[^>]*>/g)) {
          const target = attr(m[0], "Target")
          if (attr(m[0], "TargetMode") === "External" && isInternalLink(target)) internal.add(safeDecode(target))
        }
      }
      if (internal.size) findings.push({ id: "external-links", kind: "external-links", severity: "medium", count: internal.size, preview: [...internal].slice(0, 3).map((t) => [clip(t)]) })
    }
    const core = await text(zip, "docProps/core.xml")
    const app = await text(zip, "docProps/app.xml")
    const people = [["Author", runs(core, "dc:creator")], ["Last saved by", runs(core, "cp:lastModifiedBy")], ["Company", runs(app, "Company")], ["Manager", runs(app, "Manager")]]
      .filter(([, v]) => v.trim())
    if (people.length) findings.push({ id: "author", kind: "author", severity: "low", count: people.length, preview: people.map(([k, v]) => [`${k}: ${clip(v, 60)}`]) })
    const rank = { high: 0, medium: 1, low: 2 }
    return { format, findings: findings.map((f) => ({ ...f, severity: SEVERITY[f.kind] })).sort((a, b) => rank[a.severity] - rank[b.severity]) }
  } catch {
    return { format: "other", findings: [], error: "unreadable" }
  }
}
