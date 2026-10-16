"use client"

import * as React from "react"
import { ScanFace, Scissors, Smartphone, Type } from "lucide-react"

import { cn } from "@/lib/utils"
import { checkCrop, clampRect, cropAround, DEFAULT_PRESETS, fitAspect, intersects, safeArea, type CropPreset, type CropProblem, type DetectedBox, type Rect } from "./crop-check"

export { checkCrop, cropAround, DEFAULT_PRESETS, fitAspect, intersects, safeArea, type CropPreset, type CropProblem, type DetectedBox, type Rect } from "./crop-check"

const pct = (r: Rect, w: number, h: number) => ({ left: `${(r.x / w) * 100}%`, top: `${(r.y / h) * 100}%`, width: `${(r.w / w) * 100}%`, height: `${(r.h / h) * 100}%` })
const count = (boxes: DetectedBox[], nouns: CropGuardProps["nouns"] & object, both: string) => {
  const faces = boxes.filter((b) => b.kind === "face").length
  const texts = boxes.length - faces
  const parts = [faces && (faces === 1 ? nouns.face : `${faces} ${nouns.faces}`), texts && (texts === 1 ? nouns.text : `${texts} ${nouns.texts}`)].filter(
    (p): p is string => Boolean(p),
  )
  return parts.length === 2 ? both.replace("{a}", parts[0]).replace("{b}", parts[1]) : (parts[0] ?? "")
}

export interface CropGuardProps extends Omit<React.ComponentProps<"div">, "children" | "defaultValue"> {
  /** Image to crop. */
  src: string
  /** Its natural size in pixels. Crops and boxes use these pixels. */
  imageWidth: number
  /** Natural height of the image in pixels. */
  imageHeight: number
  /** Accessible description of the image. */
  alt?: string
  /** Faces and text already found, in image pixels. */
  boxes?: DetectedBox[]
  /** Finds faces and text once the image loads (the FaceDetector API, a model, a server call). Merged with `boxes`. */
  detect?: (image: HTMLImageElement) => Promise<DetectedBox[]>
  /** Crop shapes and safe zones to offer. */
  presets?: CropPreset[]
  /** Controlled preset id. */
  preset?: string
  /** Initially selected preset id when uncontrolled. */
  defaultPreset?: string
  /** Called when the user picks another preset. */
  onPresetChange?: (id: string) => void
  /** Controlled crop in image pixels. */
  value?: Rect
  /** Initial crop when uncontrolled. Defaults to the largest centred crop. */
  defaultValue?: Rect
  /** Called with the crop rectangle whenever it changes. */
  onValueChange?: (crop: Rect) => void
  /** Words used in the warnings. */
  nouns?: { face: string; faces: string; text: string; texts: string }
  /** Templates: `{what}`, `{ui}` and `{size}` are filled in. */
  cutText?: string
  /** Message when a subject sits under platform UI. */
  coveredText?: string
  /** Message when a subject is too small at preview size. */
  tinyText?: string
  /** Message when no crop can fit every subject. */
  noFitText?: string
  /** Text for the fit button. */
  fixLabel?: string
  /** Caption when the preview is at the real size, and when it's scaled down. */
  previewLabel?: string
  /** Label for the scaled-down preview. */
  scaledLabel?: string
  /** Largest preview side, in px. */
  previewMax?: number
  /** Joins faces and text in a warning: "{a} and {b}". */
  bothText?: string
  /** `{ui}` when a preset has no `unsafeLabel`. */
  uiLabel?: string
  /** Status when nothing is cut, and when there is nothing to check. */
  wholeText?: string
  /** Message when there are no subjects to check. */
  nothingText?: string
  /** Screen reader names of the shape picker and the crop box. */
  shapesLabel?: string
  /** Accessible label for the crop area. */
  cropAreaLabel?: string
}

const fix =
  "inline-flex h-6 items-center gap-1 rounded-md border border-amber-500/40 px-2 font-medium text-amber-900 transition-colors hover:bg-amber-500/10 dark:text-amber-200 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"

/**
 * An image cropper that won't let you post a crop that slices a face or a
 * headline. Pluggable detector boxes are checked against the crop, the circle
 * mask and the platform's UI (a Story's top and bottom bars), with a one-tap
 * "Fit them" that grows and nudges the crop as little as possible; a live
 * preview shows it at the size people will actually see it.
 */
export function CropGuard({
  src,
  imageWidth: W,
  imageHeight: H,
  alt = "",
  boxes = [],
  detect,
  presets = DEFAULT_PRESETS,
  preset,
  defaultPreset,
  onPresetChange,
  value,
  defaultValue,
  onValueChange,
  nouns = { face: "a face", faces: "faces", text: "text", texts: "lines of text" },
  cutText = "Cuts through {what}.",
  coveredText = "{what} sits under {ui}.",
  tinyText = "Text is too small to read at {size} px.",
  noFitText = "They don't all fit this shape.",
  fixLabel = "Fit them",
  previewLabel = "Actual size, {size} px",
  scaledLabel = "Shown {size} px wide",
  previewMax = 96,
  bothText = "{a} and {b}",
  uiLabel = "the app's UI",
  wholeText = "Every face and line of text is whole.",
  nothingText = "Nothing detected to protect.",
  shapesLabel = "Crop shape",
  cropAreaLabel = "Crop area. Arrow keys move it, plus and minus resize it.",
  className,
  ...props
}: CropGuardProps) {
  const [innerPreset, setInnerPreset] = React.useState(defaultPreset ?? presets[0].id)
  const active = presets.find((p) => p.id === (preset ?? innerPreset)) ?? presets[0]
  const [inner, setInner] = React.useState<Rect>(() => defaultValue ?? fitAspect(active.aspect, W, H))
  const crop = value ?? inner
  const [found, setFound] = React.useState<DetectedBox[]>([])
  const [dragging, setDragging] = React.useState(false)
  const frame = React.useRef<HTMLDivElement>(null)
  const drag = React.useRef<{ px: number; py: number; start: Rect; mode: "move" | "resize" } | null>(null)
  const hintId = React.useId()
  const all = [...boxes, ...found]

  const update = (next: Rect) => {
    const clamped = clampRect(next, W, H)
    if (value === undefined) setInner(clamped)
    onValueChange?.(clamped)
  }
  const choosePreset = (p: CropPreset) => {
    if (preset === undefined) setInnerPreset(p.id)
    onPresetChange?.(p.id)
    update(fitAspect(p.aspect, W, H, crop.x + crop.w / 2, crop.y + crop.h / 2))
  }
  const resize = (start: Rect, w: number) => {
    const max = Math.min(W, H * active.aspect)
    const width = Math.min(Math.max(w, max * 0.15), max)
    update({ ...start, w: width, h: width / active.aspect })
  }

  React.useEffect(() => {
    const image = frame.current?.querySelector("img")
    if (!detect || !image) return
    let live = true
    const run = () => detect(image).then((b) => live && setFound(b), () => {})
    if (image.complete) run()
    else image.addEventListener("load", run, { once: true })
    return () => {
      live = false
    }
  }, [detect, src])

  const problems = checkCrop(crop, all, active)
  const of = (kind: CropProblem["kind"]) => problems.filter((p) => p.kind === kind).map((p) => p.box)
  const [cut, covered, tiny] = [of("cut"), of("covered"), of("tiny")]
  // Keep everything the crop already touches, not just the problem boxes, so fixing one never cuts another.
  const fitted = cut.length || covered.length ? cropAround(crop, all.filter((b) => intersects(b, crop)), active, W, H) : null
  const fill = (t: string, what: DetectedBox[]) =>
    t.replace("{what}", count(what, nouns, bothText)).replace("{ui}", active.unsafeLabel ?? uiLabel).replace("{size}", String(active.shownAt)).replace(/^./, (c) => c.toUpperCase())
  const lines = [
    cut.length > 0 && { icon: Scissors, text: fill(cutText, cut) },
    covered.length > 0 && { icon: Smartphone, text: fill(coveredText, covered) },
    tiny.length > 0 && { icon: Type, text: fill(tinyText, tiny) },
  ].filter((l): l is { icon: typeof Scissors; text: string } => !!l)

  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current
    const rect = frame.current?.getBoundingClientRect()
    if (!d || !rect) return
    const dx = ((e.clientX - d.px) / rect.width) * W
    const dy = ((e.clientY - d.py) / rect.height) * H
    if (d.mode === "move") update({ ...d.start, x: d.start.x + dx, y: d.start.y + dy })
    else resize(d.start, d.start.w + Math.max(dx, dy * active.aspect))
  }
  const startDrag = (mode: "move" | "resize") => (e: React.PointerEvent) => {
    e.stopPropagation()
    e.currentTarget.setPointerCapture(e.pointerId)
    drag.current = { px: e.clientX, py: e.clientY, start: crop, mode }
    setDragging(true)
  }
  const endDrag = () => {
    drag.current = null
    setDragging(false)
  }
  const onKeyDown = (e: React.KeyboardEvent) => {
    const step = (e.shiftKey ? 0.1 : 0.02) * W
    const moves: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }
    if (moves[e.key]) update({ ...crop, x: crop.x + moves[e.key][0], y: crop.y + moves[e.key][1] })
    else if (e.key === "+" || e.key === "=") resize({ ...crop, x: crop.x - step / 2, y: crop.y - step / active.aspect / 2 }, crop.w + step)
    else if (e.key === "-") resize({ ...crop, x: crop.x + step / 2, y: crop.y + step / active.aspect / 2 }, crop.w - step)
    else return
    e.preventDefault()
  }

  const circle = active.shape === "circle"
  const safe = safeArea({ x: 0, y: 0, w: crop.w, h: crop.h }, active)
  // Small targets preview at their true size; big ones are scaled into a thumbnail that fits the card.
  const previewW = Math.min(active.shownAt, previewMax * Math.min(1, active.aspect))
  const scale = previewW / crop.w
  const shownH = previewW / active.aspect
  const flagged = new Set(problems.filter((p) => p.kind !== "tiny").map((p) => p.box))

  return (
    <div data-slot="crop-guard" className={cn("grid w-full max-w-md gap-3", className)} {...props}>
      <div
        role="radiogroup"
        aria-label={shapesLabel}
        onKeyDown={(e) => {
          // Radio-group keys: arrows move the choice and the focus together, wrapping at the ends.
          const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key]
          if (!step) return
          e.preventDefault()
          const next = presets[(presets.indexOf(active) + step + presets.length) % presets.length]
          choosePreset(next)
          e.currentTarget.querySelector<HTMLButtonElement>(`[data-preset="${CSS.escape(next.id)}"]`)?.focus()
        }}
        className="flex flex-wrap gap-1 rounded-md bg-muted p-1"
      >
        {presets.map((p) => (
          <button key={p.id} type="button" role="radio" data-preset={p.id} tabIndex={p.id === active.id ? 0 : -1} aria-checked={p.id === active.id} onClick={() => choosePreset(p)} className="h-7 flex-1 rounded-sm px-2 text-xs font-medium whitespace-nowrap text-muted-foreground outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-checked:bg-background aria-checked:text-foreground aria-checked:shadow-xs">
            {p.label}
          </button>
        ))}
      </div>

      <div ref={frame} className="relative touch-none overflow-hidden rounded-md bg-muted select-none" style={{ aspectRatio: `${W} / ${H}` }} onPointerMove={onPointerMove} onPointerUp={endDrag} onPointerCancel={endDrag}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={alt} draggable={false} className="absolute inset-0 size-full" />
        {all.map((b, i) => (
          <span key={i} aria-hidden className={cn("absolute rounded-sm border", flagged.has(b) ? "border-amber-400 bg-amber-400/15" : "border-white/60 border-dashed")} style={pct(b, W, H)} />
        ))}
        <div
          tabIndex={0}
          role="group"
          aria-label={cropAreaLabel}
          aria-describedby={hintId}
          onPointerDown={startDrag("move")}
          onKeyDown={onKeyDown}
          className={cn(
            "absolute cursor-move border-2 border-white shadow-[0_0_0_9999px_rgb(0_0_0/0.55)] outline-none focus-visible:ring-[3px] focus-visible:ring-ring/80",
            !dragging && "transition-[left,top,width,height] duration-300 ease-out motion-reduce:transition-none",
            circle && "rounded-full",
            problems.some((p) => p.kind !== "tiny") && "border-amber-400",
          )}
          style={pct(crop, W, H)}
        >
          {active.unsafe && (
            <span aria-hidden className="pointer-events-none absolute border border-dashed border-white/70" style={pct(safe, crop.w, crop.h)} />
          )}
          <span
            aria-hidden
            onPointerDown={startDrag("resize")}
            className={cn("absolute size-4 cursor-nwse-resize rounded-sm border-2 border-white bg-black/40", circle ? "right-[12%] bottom-[12%]" : "-right-1.5 -bottom-1.5")}
          />
        </div>
      </div>

      <div className="flex items-start gap-3">
        <div id={hintId} aria-live="polite" className="grid min-w-0 flex-1 gap-1 text-xs">
          {lines.length ? (
            lines.map(({ icon: Icon, text }) => (
              <p key={text} className="flex gap-1.5 text-amber-700 dark:text-amber-400">
                <Icon aria-hidden className="mt-0.5 size-3.5 shrink-0" />
                <span>{text}</span>
              </p>
            ))
          ) : (
            <p className="flex gap-1.5 text-muted-foreground">
              <ScanFace aria-hidden className="mt-0.5 size-3.5 shrink-0" />
              <span>{all.length ? wholeText : nothingText}</span>
            </p>
          )}
          {(cut.length > 0 || covered.length > 0) &&
            (fitted ? (
              <button type="button" onClick={() => update(fitted)} className={cn(fix, "w-fit")}>{fixLabel}</button>
            ) : (
              <p className="text-muted-foreground">{noFitText}</p>
            ))}
        </div>
        <figure className="grid shrink-0 justify-items-center gap-1">
          <div className={cn("relative overflow-hidden bg-muted ring-1 ring-border", circle ? "rounded-full" : "rounded-sm")} style={{ width: previewW, height: shownH }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt="" className="absolute max-w-none" style={{ width: W * scale, height: H * scale, left: -crop.x * scale, top: -crop.y * scale }} />
          </div>
          <figcaption className="text-[11px] text-muted-foreground">{(previewW === active.shownAt ? previewLabel : scaledLabel).replace("{size}", String(active.shownAt))}</figcaption>
        </figure>
      </div>
    </div>
  )
}
