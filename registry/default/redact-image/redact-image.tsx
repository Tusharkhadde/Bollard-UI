"use client"

import * as React from "react"
import { CircleAlert, Download, LoaderCircle, ScanText, ShieldCheck, SquarePlus, TriangleAlert, Undo2, X } from "lucide-react"

import { cn } from "@/lib/utils"
import { covers, inspectPng, padRegion, type Region } from "./redact"

export { covers, findSensitiveText, inspectPng, padRegion, SENSITIVE_LABELS, type DetectedWord, type PngReport, type Region, type SensitiveKind } from "./redact"

/** Every user-visible string, so the redactor can be translated. */
export const REDACT_IMAGE_MESSAGES = {
  alt: "Screenshot to redact",
  undo: "Undo",
  addBox: "Add box",
  exportLabel: "Export redacted PNG",
  scanning: "Looking for text…",
  status: (boxes: number) => `Drag to cover · ${boxes} ${boxes === 1 ? "box" : "boxes"}`,
  cover: (what: string) => `Cover ${what}`,
  suggestedRegion: "suggested region",
  /** Tag on a suggestion that the detector didn't label. */
  text: "Text",
  remove: (index: number, label?: string) => `Remove redaction ${index}${label ? `, ${label}` : ""}`,
  boxKeys: "Arrow keys move it, Shift with an arrow moves it further, Alt with an arrow resizes it, Delete removes it.",
  uncovered: (count: number, labels: string[]) =>
    `${count} detected ${count === 1 ? "item isn’t" : "items aren’t"} covered: ${labels.join(", ")}.`,
  coverAll: "Cover all",
  verified: (boxes: number, width: number, height: number, kb: number) =>
    `Verified: ${boxes} solid ${boxes === 1 ? "box" : "boxes"}, no metadata, nothing hidden after the image. ${width}×${height}, ${kb} KB.`,
  download: "Download",
  notSafe: (problems: string[]) => `Not safe to share. ${problems.join(" ")}`,
  flattenFailed: "Couldn’t flatten this image. It may come from another site; load it as a file instead.",
  invalidPng: "The export isn’t a valid PNG.",
  trailingData: (bytes: number) => `${bytes} bytes of hidden data after the image end.`,
  metadataLeft: (chunks: string[]) => `Metadata left in the file: ${chunks.join(", ")}.`,
  sizeChanged: "The export has a different size from the original.",
  notSolid: (box: number) => `Box ${box} isn’t fully solid: original pixels show through.`,
}
export type RedactImageMessages = typeof REDACT_IMAGE_MESSAGES

export interface RedactionReport {
  ok: boolean
  /** What failed, in plain words. Empty when `ok`. */
  problems: string[]
  width: number
  height: number
  bytes: number
}

/**
 * Re-reads an exported PNG and proves the redaction holds: every pixel inside every
 * box is the solid fill, the size matches, there is no metadata chunk and nothing
 * after the end of the image (the aCropalypse leak).
 */
export async function verifyRedaction(
  blob: Blob,
  boxes: Region[],
  fill: [number, number, number],
  size: { width: number; height: number },
  messages: Partial<RedactImageMessages> = {},
): Promise<RedactionReport> {
  const t = { ...REDACT_IMAGE_MESSAGES, ...messages }
  const bytes = new Uint8Array(await blob.arrayBuffer())
  const png = inspectPng(bytes)
  const problems: string[] = []
  if (!png.valid) problems.push(t.invalidPng)
  if (png.trailingBytes) problems.push(t.trailingData(png.trailingBytes))
  if (png.metadata.length) problems.push(t.metadataLeft(png.metadata))
  if (png.width !== size.width || png.height !== size.height) problems.push(t.sizeChanged)
  const bitmap = await createImageBitmap(blob)
  const canvas = document.createElement("canvas")
  canvas.width = bitmap.width
  canvas.height = bitmap.height
  const ctx = canvas.getContext("2d", { willReadFrequently: true })
  ctx?.drawImage(bitmap, 0, 0)
  boxes.forEach((box, i) => {
    if (!ctx || !box.width || !box.height) return
    const data = ctx.getImageData(box.x, box.y, box.width, box.height).data
    for (let p = 0; p < data.length; p += 4) {
      if (data[p] !== fill[0] || data[p + 1] !== fill[1] || data[p + 2] !== fill[2] || data[p + 3] !== 255) {
        problems.push(t.notSolid(i + 1))
        return
      }
    }
  })
  return { ok: problems.length === 0, problems, width: png.width, height: png.height, bytes: bytes.length }
}

export interface RedactImageProps extends Omit<React.ComponentProps<"div">, "defaultValue"> {
  /** The screenshot. Must be same-origin, a data: URL or a blob: URL so it can be flattened. */
  src: string
  /** Accessible description of the screenshot. */
  alt?: string
  /** Controlled redaction boxes, in image pixels. */
  value?: Region[]
  /** Initial boxes when uncontrolled. */
  defaultValue?: Region[]
  /** Called when boxes are drawn, accepted or removed. */
  onValueChange?: (boxes: Region[]) => void
  /** Pluggable text detector. Return regions to suggest, e.g. `findSensitiveText(ocrWords)`. */
  detect?: (image: HTMLImageElement) => Region[] | Promise<Region[]>
  /** Pixels added around every box so glyph edges can't leak. */
  padding?: number
  /** Box colour as RGB. Always fully opaque. */
  fill?: [number, number, number]
  /** Called with the flattened, verified PNG. */
  onExport?: (blob: Blob, report: RedactionReport) => void
  /** File name of the download. */
  fileName?: string
  /** Every visible string (see `REDACT_IMAGE_MESSAGES`). */
  messages?: Partial<RedactImageMessages>
  /** @deprecated Use `messages.exportLabel`. */
  exportLabel?: string
}

const button =
  "inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-sm font-medium whitespace-nowrap transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50"
const pct = (r: Region, w: number, h: number) => ({
  left: `${(r.x / w) * 100}%`,
  top: `${(r.y / h) * 100}%`,
  width: `${(r.width / w) * 100}%`,
  height: `${(r.height / h) * 100}%`,
})

/**
 * Redacts a screenshot before it's shared, the way that can't be undone: solid boxes
 * only (blur and pixelation can be reversed), suggestions from a pluggable text
 * detector, boxes padded and snapped to whole pixels, and an export that is
 * flattened to a fresh PNG and then re-read to prove no original pixels or metadata survive.
 */
export function RedactImage({
  src,
  alt,
  value,
  defaultValue = [],
  onValueChange,
  detect,
  padding = 2,
  fill = [0, 0, 0],
  onExport,
  fileName = "redacted.png",
  exportLabel,
  messages,
  className,
  ...props
}: RedactImageProps) {
  const t = { ...REDACT_IMAGE_MESSAGES, ...messages, ...(exportLabel !== undefined && { exportLabel }) }
  const [inner, setInner] = React.useState(defaultValue)
  const [size, setSize] = React.useState<{ width: number; height: number }>()
  const [suggested, setSuggested] = React.useState<Region[]>([])
  const [scanning, setScanning] = React.useState(false)
  const [draft, setDraft] = React.useState<Region>()
  const [result, setResult] = React.useState<{ url?: string; report?: RedactionReport; error?: string }>()
  const [exporting, setExporting] = React.useState(false)
  const imgRef = React.useRef<HTMLImageElement>(null)
  const canvasRef = React.useRef<HTMLDivElement>(null)
  const focusLast = React.useRef(false)
  const start = React.useRef<{ x: number; y: number }>(undefined)
  const hintId = React.useId()
  const boxes = value ?? inner
  const color = `rgb(${fill.join(" ")})`

  React.useEffect(() => () => void (result?.url && URL.revokeObjectURL(result.url)), [result])

  const update = (next: Region[]) => {
    if (value === undefined) setInner(next)
    onValueChange?.(next)
    setResult(undefined)
  }

  // After "Add box", move focus to the new box so the keyboard can place it.
  React.useEffect(() => {
    if (!focusLast.current) return
    focusLast.current = false
    const all = canvasRef.current?.querySelectorAll<HTMLButtonElement>("[data-redaction]")
    all?.[all.length - 1]?.focus()
  }, [boxes.length])

  /** Keyboard placement: arrows move, Shift moves 10×, Alt resizes, Delete removes. */
  const nudge = (event: React.KeyboardEvent, i: number) => {
    if (!size) return
    if (event.key === "Delete" || event.key === "Backspace") {
      event.preventDefault()
      return update(boxes.filter((_, j) => j !== i))
    }
    const delta = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[event.key]
    if (!delta) return
    event.preventDefault()
    const stepPx = Math.max(1, Math.round(size.width / 200)) * (event.shiftKey ? 10 : 1)
    const [dx, dy] = delta.map((d) => d * stepPx)
    const b = boxes[i]
    const next = event.altKey
      ? { ...b, width: Math.min(size.width - b.x, Math.max(4, b.width + dx)), height: Math.min(size.height - b.y, Math.max(4, b.height + dy)) }
      : { ...b, x: Math.min(size.width - b.width, Math.max(0, b.x + dx)), y: Math.min(size.height - b.height, Math.max(0, b.y + dy)) }
    update(boxes.map((box, j) => (j === i ? next : box)))
  }
  const addBox = () => {
    if (!size) return
    focusLast.current = true
    const width = Math.round(size.width / 4)
    const height = Math.round(size.height / 10)
    update([...boxes, { x: Math.round((size.width - width) / 2), y: Math.round((size.height - height) / 2), width, height }])
  }

  const onLoad = async () => {
    const img = imgRef.current
    if (!img) return
    setSize({ width: img.naturalWidth, height: img.naturalHeight })
    if (!detect) return
    setScanning(true)
    try {
      setSuggested(await detect(img))
    } catch {
      setSuggested([])
    } finally {
      setScanning(false)
    }
  }

  // A cached image can finish loading before React attaches onLoad.
  React.useEffect(() => {
    if (imgRef.current?.complete && imgRef.current.naturalWidth) void onLoad()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src])

  const toImage = (event: React.PointerEvent) => {
    const rect = event.currentTarget.getBoundingClientRect()
    const scale = (size?.width ?? rect.width) / rect.width
    return { x: Math.max(0, (event.clientX - rect.left) * scale), y: Math.max(0, (event.clientY - rect.top) * scale) }
  }
  const box = (a: { x: number; y: number }, b: { x: number; y: number }): Region => ({
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    width: Math.abs(a.x - b.x),
    height: Math.abs(a.y - b.y),
  })

  const padded = size ? boxes.map((b) => padRegion(b, padding, size.width, size.height)) : []
  const uncovered = suggested.filter((s) => !padded.some((b) => covers(b, s)))

  const exportPng = async () => {
    const img = imgRef.current
    if (!img || !size) return
    setExporting(true)
    try {
      const canvas = document.createElement("canvas")
      canvas.width = size.width
      canvas.height = size.height
      const ctx = canvas.getContext("2d")
      if (!ctx) throw new Error("no canvas")
      ctx.drawImage(img, 0, 0)
      ctx.fillStyle = color
      ctx.globalAlpha = 1
      for (const b of padded) ctx.fillRect(b.x, b.y, b.width, b.height)
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"))
      if (!blob) throw new Error("no blob")
      const report = await verifyRedaction(blob, padded, fill, size, t)
      setResult({ url: report.ok ? URL.createObjectURL(blob) : undefined, report })
      if (report.ok) onExport?.(blob, report)
    } catch {
      setResult({ error: t.flattenFailed })
    } finally {
      setExporting(false)
    }
  }

  return (
    <div data-slot="redact-image" className={cn("grid w-full max-w-xl gap-2", className)} {...props}>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => update(boxes.slice(0, -1))} disabled={!boxes.length} className={cn(button, "border hover:bg-accent")}>
          <Undo2 aria-hidden className="size-4" />
          {t.undo}
        </button>
        <button type="button" onClick={addBox} disabled={!size} className={cn(button, "border hover:bg-accent")}>
          <SquarePlus aria-hidden className="size-4" />
          {t.addBox}
        </button>
        <p className="mr-auto text-xs text-muted-foreground" aria-live="polite">
          {scanning ? (
            <span className="inline-flex items-center gap-1.5">
              <LoaderCircle aria-hidden className="size-3.5 animate-spin" /> {t.scanning}
            </span>
          ) : (
            t.status(boxes.length)
          )}
        </p>
        <button
          type="button"
          onClick={exportPng}
          disabled={!size || !boxes.length || exporting}
          className={cn(button, "bg-primary text-primary-foreground hover:bg-primary/90")}
        >
          {exporting ? <LoaderCircle aria-hidden className="size-4 animate-spin" /> : <ShieldCheck aria-hidden className="size-4" />}
          {t.exportLabel}
        </button>
      </div>

      <span id={hintId} hidden>{t.boxKeys}</span>
      <div
        ref={canvasRef}
        className="@container relative cursor-crosshair touch-none overflow-hidden rounded-lg border select-none"
        onPointerDown={(e) => {
          if (e.target !== e.currentTarget && e.target !== imgRef.current) return
          e.currentTarget.setPointerCapture(e.pointerId)
          start.current = toImage(e)
        }}
        onPointerMove={(e) => start.current && setDraft(box(start.current, toImage(e)))}
        onPointerUp={(e) => {
          const drawn = start.current && box(start.current, toImage(e))
          start.current = undefined
          setDraft(undefined)
          if (drawn && drawn.width >= 4 && drawn.height >= 4) update([...boxes, drawn])
        }}
        onPointerCancel={() => {
          start.current = undefined
          setDraft(undefined)
        }}
      >
        <img ref={imgRef} src={src} alt={alt ?? t.alt} onLoad={onLoad} draggable={false} className="block h-auto w-full" />
        {size
          ? uncovered.map((s, i) => (
              <button
                key={`s${i}`}
                type="button"
                onClick={() => update([...boxes, s])}
                aria-label={t.cover(s.label ?? t.suggestedRegion)}
                style={pct(padRegion(s, padding, size.width, size.height), size.width, size.height)}
                className="absolute rounded-sm border-2 border-dashed border-amber-500 bg-amber-400/15 outline-none hover:bg-amber-400/30 focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                <span className="absolute -top-5 left-0 hidden rounded-sm bg-amber-500 @md:block px-1 text-[10px] font-medium whitespace-nowrap text-amber-950">
                  {s.label ?? t.text}
                </span>
              </button>
            ))
          : null}
        {size
          ? padded.map((b, i) => (
              <button
                key={`b${i}`}
                type="button"
                data-redaction=""
                onClick={() => update(boxes.filter((_, j) => j !== i))}
                onKeyDown={(event) => nudge(event, i)}
                aria-label={t.remove(i + 1, b.label)}
                aria-describedby={hintId}
                style={{ ...pct(b, size.width, size.height), background: color }}
                className="group absolute grid place-items-center outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 motion-safe:animate-[cui-redact-image-drop_180ms_ease-out]"
              >
                <X aria-hidden className="size-3.5 text-white opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100" />
              </button>
            ))
          : null}
        {draft && size ? (
          <div aria-hidden className="pointer-events-none absolute" style={{ ...pct(draft, size.width, size.height), background: color }} />
        ) : null}
      </div>

      <div aria-live="polite" className="min-h-6 text-xs">
        {result?.error || result?.report?.ok === false ? (
          <div role="alert" className="flex gap-1.5 text-destructive">
            <CircleAlert aria-hidden className="mt-0.5 size-3.5 shrink-0" />
            <p>{result.error ?? t.notSafe(result.report?.problems ?? [])}</p>
          </div>
        ) : result?.report ? (
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-emerald-700 dark:text-emerald-400">
            <ShieldCheck aria-hidden className="-mr-0.5 size-3.5 shrink-0" />
            <span className="py-1">{t.verified(padded.length, result.report.width, result.report.height, Math.ceil(result.report.bytes / 1024))}</span>
            <a href={result.url} download={fileName} className={cn(button, "h-6 border border-emerald-600/40 px-2 text-xs hover:bg-emerald-500/10")}>
              <Download aria-hidden className="size-3.5" />
              {t.download}
            </a>
          </p>
        ) : uncovered.length ? (
          <div className="flex gap-1.5 text-amber-700 dark:text-amber-400">
            <span className="flex h-6 shrink-0 items-center">
              <TriangleAlert aria-hidden className="size-3.5" />
            </span>
            <p className="flex min-w-0 flex-wrap items-center gap-x-2">
              <span className="py-1">{t.uncovered(uncovered.length, uncovered.map((s) => s.label ?? t.text.toLowerCase()))}</span>
              <button
                type="button"
                onClick={() => update([...boxes, ...uncovered])}
                className="inline-flex h-6 items-center gap-1 rounded-md border border-amber-500/40 px-2 font-medium text-amber-900 transition-colors hover:bg-amber-500/10 dark:text-amber-200 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                <ScanText aria-hidden className="size-3.5" />
                {t.coverAll}
              </button>
            </p>
          </div>
        ) : null}
      </div>
      <style>{`@keyframes cui-redact-image-drop{from{transform:scale(1.08)}to{transform:none}}`}</style>
    </div>
  )
}
