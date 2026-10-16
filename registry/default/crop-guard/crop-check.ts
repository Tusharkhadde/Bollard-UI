/** A rectangle in the image's own pixels. */
export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

/** Something a detector found that a crop shouldn't cut: a face or a line of text. */
export interface DetectedBox extends Rect {
  kind: "face" | "text"
  label?: string
}

/** A target shape: its aspect, how it's masked, what the platform's UI covers and the size it's shown at. */
export interface CropPreset {
  id: string
  label: string
  /** Width ÷ height. */
  aspect: number
  shape?: "rect" | "circle"
  /** Share of each edge covered by the platform's UI (Story: progress bar on top, reply bar at the bottom). */
  unsafe?: { top?: number; right?: number; bottom?: number; left?: number }
  /** Name of what covers the unsafe area, for the warning. */
  unsafeLabel?: string
  /** Width it is shown at on a phone, in CSS px (a profile picture: 40; a Story: the screen). */
  shownAt: number
}

/** Story and Reel overlays per Meta's ad guidance: 14% top, 20% bottom, 6% sides. */
export const DEFAULT_PRESETS: CropPreset[] = [
  { id: "avatar", label: "Profile", aspect: 1, shape: "circle", shownAt: 40 },
  { id: "story", label: "Story", aspect: 9 / 16, unsafe: { top: 0.14, bottom: 0.2, left: 0.06, right: 0.06 }, unsafeLabel: "the app's buttons", shownAt: 360 },
  { id: "post", label: "Post", aspect: 4 / 5, shownAt: 360 },
  { id: "wide", label: "Link", aspect: 1.91, shownAt: 280 },
]

export interface CropProblem {
  box: DetectedBox
  kind: "cut" | "covered" | "tiny"
}

/** Text shorter than this on screen, in CSS px, can't be read. */
const MIN_TEXT_PX = 7
const CIRCLE_INSET = (1 - Math.SQRT1_2) / 2

const area = (r: Rect) => Math.max(0, r.w) * Math.max(0, r.h)
function overlap(a: Rect, b: Rect): Rect {
  const x = Math.max(a.x, b.x)
  const y = Math.max(a.y, b.y)
  return { x, y, w: Math.min(a.x + a.w, b.x + b.w) - x, h: Math.min(a.y + a.h, b.y + b.h) - y }
}

/** Whether two rectangles share any area. */
export const intersects = (a: Rect, b: Rect) => area(overlap(a, b)) > 0

/** The part of a crop nothing covers: inset by the preset's UI, and for a circle the square inside it. */
export function safeArea(crop: Rect, preset: CropPreset): Rect {
  const i = preset.unsafe ?? {}
  const c = preset.shape === "circle" ? CIRCLE_INSET : 0
  const [t, r, b, l] = [Math.max(i.top ?? 0, c), Math.max(i.right ?? 0, c), Math.max(i.bottom ?? 0, c), Math.max(i.left ?? 0, c)]
  return { x: crop.x + crop.w * l, y: crop.y + crop.h * t, w: crop.w * (1 - l - r), h: crop.h * (1 - t - b) }
}

/** Whether every corner of the box is inside the circle the crop is masked to. */
const insideCircle = (box: Rect, crop: Rect) =>
  [box.x, box.x + box.w].every((x) => [box.y, box.y + box.h].every((y) => Math.hypot(x - crop.x - crop.w / 2, y - crop.y - crop.h / 2) <= crop.w / 2))

/**
 * What a crop does wrong to each detected box: cuts it (part in, part out,
 * counting the circle mask), leaves it under the platform's UI, or shrinks text
 * below legible at the size the image is shown at. Boxes fully outside are
 * taken as left out on purpose.
 */
export function checkCrop(crop: Rect, boxes: DetectedBox[], preset: CropPreset): CropProblem[] {
  const problems: CropProblem[] = []
  const safe = safeArea(crop, preset)
  for (const box of boxes) {
    const shown = area(overlap(box, crop)) / area(box)
    if (shown === 0) continue
    if (shown < 0.98 || (preset.shape === "circle" && !insideCircle(box, crop))) problems.push({ box, kind: "cut" })
    else if (area(overlap(box, safe)) / area(box) < 0.98) problems.push({ box, kind: "covered" })
    else if (box.kind === "text" && (box.h * preset.shownAt) / crop.w < MIN_TEXT_PX) problems.push({ box, kind: "tiny" })
  }
  return problems
}

/** The biggest crop of this aspect that fits the image, centred on a point. */
export function fitAspect(aspect: number, imageW: number, imageH: number, cx = imageW / 2, cy = imageH / 2): Rect {
  const w = Math.min(imageW, imageH * aspect)
  const h = w / aspect
  return clampRect({ x: cx - w / 2, y: cy - h / 2, w, h }, imageW, imageH)
}

export function clampRect(r: Rect, imageW: number, imageH: number): Rect {
  const w = Math.min(r.w, imageW)
  const h = Math.min(r.h, imageH)
  return { x: Math.min(Math.max(r.x, 0), imageW - w), y: Math.min(Math.max(r.y, 0), imageH - h), w, h }
}

/**
 * The crop closest to the current one that keeps every box in `keep` whole and
 * clear of the UI: grown only as much as needed, moved as little as possible.
 * Null when they can't all fit in this shape.
 */
export function cropAround(crop: Rect, keep: Rect[], preset: CropPreset, imageW: number, imageH: number): Rect | null {
  if (!keep.length) return crop
  const pad = 0.04
  const x1 = Math.min(...keep.map((b) => b.x - b.w * pad))
  const y1 = Math.min(...keep.map((b) => b.y - b.h * pad))
  const x2 = Math.max(...keep.map((b) => b.x + b.w * (1 + pad)))
  const y2 = Math.max(...keep.map((b) => b.y + b.h * (1 + pad)))
  const unit = safeArea({ x: 0, y: 0, w: 1, h: 1 / preset.aspect }, preset)
  const w = Math.max(crop.w, (x2 - x1) / unit.w, (y2 - y1) / unit.h)
  const h = w / preset.aspect
  if (w > imageW + 0.5 || h > imageH + 0.5) return null
  const near = (value: number, lo: number, hi: number) => Math.min(Math.max(value, lo), hi)
  const x = near(crop.x, x2 - (unit.x + unit.w) * w, x1 - unit.x * w)
  const y = near(crop.y, y2 - (unit.y + unit.h) * w, y1 - unit.y * w)
  const next = clampRect({ x, y, w, h }, imageW, imageH)
  return checkCrop(next, keep.map((b) => ({ ...b, kind: "face" })), preset).length ? null : next
}
