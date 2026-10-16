"use client"

import * as React from "react"
import { CircleCheck, ImageOff, Type } from "lucide-react"

import { cn } from "@/lib/utils"

export interface AltImage {
  id: string
  /** Thumbnail URL. */
  src: string
  filename?: string
  alt: string
  /** Purely visual: published with alt="" so screen readers skip it. */
  decorative?: boolean
  /** Caption shown next to the image, if any. */
  caption?: string
  /** The image contains text (from OCR or the uploader). Screenshots are assumed to. */
  hasText?: boolean
}

export type AltStatus = "missing" | "filename" | "redundant" | "too-long" | "caption" | "ok" | "decorative"

export interface AltCheck {
  status: AltStatus
  message?: string
  /** Fixed alt text for a one-tap fix. */
  fix?: string
}

const CAMERA_NAME = /^(img|dsc[fn]?|pxl|mvimg|vid|photo|image|pic|screenshot|screen shot|whatsapp image|signal)[\s_-]*[\d\s_.:-]*(at[\s\d.:-]*(am|pm)?)?$/i
const IMAGE_EXT = /\.(jpe?g|png|gif|webp|heic|avif|bmp|tiff?|svg)$/i
const REDUNDANT = /^(an?\s+|the\s+)?(image|picture|photo|photograph|graphic|pic)\s+(of|showing)\s+/i
const SCREENSHOT = /screen ?shot|screen[\s_-]?capture|^scr[_-]/i

const stem = (name = "") => name.replace(IMAGE_EXT, "").toLowerCase()

/** Is this alt text really a filename (IMG_2041.jpg, PXL_20261013_0915, a hash, or the file's own name)? */
export function looksLikeFilename(alt: string, filename?: string) {
  const text = alt.trim()
  return IMAGE_EXT.test(text) || CAMERA_NAME.test(text) || /^[a-f0-9-]{16,}$/i.test(text) || (!!filename && text.toLowerCase() === stem(filename))
}

/** Whether to remind the author to put the image's words in the alt text. */
export const mayContainText = (image: AltImage) => image.hasText ?? SCREENSHOT.test(image.filename ?? "")

/** Why each alt text was flagged. Override any of them to reword or translate. */
export const ALT_TEXT_MESSAGES = {
  missing: "Screen readers will read the filename instead.",
  filename: "This is the filename, not a description.",
  redundant: "Screen readers already say “image”.",
  caption: "Repeats the caption, so it's heard twice. Describe what the caption doesn't.",
  tooLong: (length: number) => `${length} characters. Alt text can't be paused or skimmed; move detail to the caption.`,
}

/** Checks one image's alt text against WebAIM / W3C guidance. */
export function checkAltText(image: AltImage, maxLength = 125, messages: Partial<typeof ALT_TEXT_MESSAGES> = {}): AltCheck {
  const t = { ...ALT_TEXT_MESSAGES, ...messages }
  const alt = image.alt.trim()
  if (image.decorative) return { status: "decorative" }
  if (!alt) return { status: "missing", message: t.missing }
  if (looksLikeFilename(alt, image.filename)) return { status: "filename", message: t.filename, fix: "" }
  if (REDUNDANT.test(alt)) {
    const rest = alt.replace(REDUNDANT, "")
    return { status: "redundant", message: t.redundant, fix: rest.charAt(0).toUpperCase() + rest.slice(1) }
  }
  if (image.caption && alt.toLowerCase() === image.caption.trim().toLowerCase()) return { status: "caption", message: t.caption }
  if (Array.from(alt).length > maxLength) return { status: "too-long", message: t.tooLong(Array.from(alt).length) }
  return { status: "ok" }
}

const CHIP: Record<AltStatus, { label: string; tone: string }> = {
  missing: { label: "Missing", tone: "bg-red-500/15 text-red-800 dark:text-red-300" },
  filename: { label: "Filename", tone: "bg-amber-500/15 text-amber-800 dark:text-amber-300" },
  redundant: { label: "“Image of”", tone: "bg-amber-500/15 text-amber-800 dark:text-amber-300" },
  caption: { label: "Same as caption", tone: "bg-amber-500/15 text-amber-800 dark:text-amber-300" },
  "too-long": { label: "Too long", tone: "bg-amber-500/15 text-amber-800 dark:text-amber-300" },
  ok: { label: "Good", tone: "bg-emerald-500/15 text-emerald-800 dark:text-emerald-300" },
  decorative: { label: "Decorative", tone: "bg-muted text-muted-foreground" },
}

const fixClass =
  "inline-flex h-6 items-center rounded-md border border-amber-500/40 px-2 font-medium text-amber-900 transition-colors hover:bg-amber-500/10 dark:text-amber-200 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"

export interface AltTextCheckProps extends Omit<React.ComponentProps<"div">, "defaultValue"> {
  /** Controlled images. */
  value?: AltImage[]
  /** Initial images when uncontrolled. */
  defaultValue?: AltImage[]
  /** Called with the updated images whenever alt text or the decorative flag changes. */
  onValueChange?: (images: AltImage[]) => void
  /** Called when posting. With problems left, the first click jumps to them and asks again. */
  onPost?: (images: AltImage[]) => void
  /** Alt text longer than this is flagged. */
  maxLength?: number
  /** Status chip labels, by status. */
  chipLabels?: Partial<Record<AltStatus, string>>
  /** `{count}` (images with problems) and `{total}` are filled in. Without `{total}`, `{count}` reads "3 of 4". */
  summaryText?: string
  /** Reasons shown under each flagged image. */
  messages?: Partial<typeof ALT_TEXT_MESSAGES>
  /** Summary shown when every image passes. */
  allGoodText?: string
  /** Label for each alt text field. */
  altLabel?: string
  /** Label for the decorative toggle. */
  decorativeLabel?: string
  /** Reminder shown for images that contain text. */
  textHint?: string
  /** Placeholder shown in the field when the image is marked decorative. */
  decorativePlaceholder?: string
  /** Text for the one-tap fix button. */
  fixLabel?: string
  /** Text for the button that clears a filename used as alt text. */
  clearLabel?: string
  /** Post button text. */
  postLabel?: string
  /** Post button text after problems were shown once. */
  postAnywayLabel?: string
}

/**
 * Checks alt text before images go out: missing, a filename (IMG_2041.jpg), "image of…",
 * a copy of the caption, or too long to listen to. Each image gets a status chip and a one-tap
 * fix where one exists; screenshots get a reminder to include their words; and posting with
 * problems left jumps to the first one before a second click posts anyway.
 */
export function AltTextCheck({
  value,
  defaultValue = [],
  onValueChange,
  onPost,
  maxLength = 125,
  chipLabels,
  summaryText = "{count} of {total} need better alt text",
  messages,
  allGoodText = "Every image is described",
  altLabel = "Alt text",
  decorativeLabel = "Decorative",
  textHint = "Has text in it? Include the words that matter.",
  decorativePlaceholder = "Skipped by screen readers (alt=\"\")",
  fixLabel = "Remove “Image of”",
  clearLabel = "Clear it",
  postLabel = "Post",
  postAnywayLabel = "Post anyway",
  className,
  ...props
}: AltTextCheckProps) {
  const [inner, setInner] = React.useState(defaultValue)
  const [asked, setAsked] = React.useState(false)
  const images = value ?? inner
  const fields = React.useRef(new Map<string, HTMLTextAreaElement>())
  const checks = images.map((image) => checkAltText(image, maxLength, messages))
  const problems = checks.filter((check) => check.status !== "ok" && check.status !== "decorative").length

  const update = (id: string, patch: Partial<AltImage>) => {
    const next = images.map((image) => (image.id === id ? { ...image, ...patch } : image))
    if (value === undefined) setInner(next)
    onValueChange?.(next)
    setAsked(false)
  }

  const post = () => {
    if (problems && !asked) {
      setAsked(true)
      const first = images[checks.findIndex((check) => check.status !== "ok" && check.status !== "decorative")]
      fields.current.get(first.id)?.focus()
      return
    }
    onPost?.(images)
  }

  return (
    <div data-slot="alt-text-check" data-state={problems ? "issues" : "ok"} className={cn("w-full max-w-md space-y-3 text-sm", className)} {...props}>
      <style>{`@keyframes cui-alt-text-check-pop { from { transform: scale(.8); opacity: .4 } }`}</style>
      <ul className="space-y-2">
        {images.map((image, index) => {
          const check = checks[index]
          const inputId = `alt-${image.id}`
          const hintId = `${inputId}-hint`
          const showTextHint = !image.decorative && mayContainText(image)
          return (
            <li key={image.id} data-status={check.status} className="flex gap-3 rounded-md border p-3">
              <img src={image.src} alt="" className="size-14 shrink-0 rounded-md border bg-muted object-cover" />
              <div className="grid min-w-0 flex-1 grid-cols-1 gap-1.5">
                <div className="flex items-center justify-between gap-2">
                  <label htmlFor={inputId} className="min-w-0 truncate text-xs text-muted-foreground" title={image.filename}>
                    {altLabel} · {image.filename}
                  </label>
                  <span
                    key={check.status}
                    className={cn("shrink-0 rounded-full px-2 py-0.5 text-xs font-medium motion-safe:animate-[cui-alt-text-check-pop_250ms_ease-out]", CHIP[check.status].tone)}
                  >
                    {chipLabels?.[check.status] ?? CHIP[check.status].label}
                  </span>
                </div>
                <textarea
                  ref={(el) => {
                    if (el) fields.current.set(image.id, el)
                    else fields.current.delete(image.id)
                  }}
                  id={inputId}
                  rows={2}
                  value={image.decorative ? "" : image.alt}
                  disabled={image.decorative}
                  placeholder={image.decorative ? decorativePlaceholder : undefined}
                  onChange={(event) => update(image.id, { alt: event.target.value })}
                  aria-describedby={hintId}
                  aria-invalid={check.message ? true : undefined}
                  className="min-h-9 w-full min-w-0 resize-none rounded-md border bg-transparent px-3 py-1.5 text-base shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-amber-500 md:text-sm dark:bg-input/30"
                />
                <div id={hintId} aria-live="polite" className="grid gap-1 text-xs">
                  {check.message && (
                    <p className={cn("flex gap-1.5", check.status === "missing" ? "text-red-700 dark:text-red-400" : "text-amber-700 dark:text-amber-400")}>
                      <ImageOff aria-hidden className="mt-1 size-3.5 shrink-0" />
                      <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="py-0.5">{check.message}</span>
                        {check.fix !== undefined && (
                          <button
                            type="button"
                            onClick={() => {
                              update(image.id, { alt: check.fix })
                              fields.current.get(image.id)?.focus()
                            }}
                            className={fixClass}
                          >
                            {check.fix ? fixLabel : clearLabel}
                          </button>
                        )}
                      </span>
                    </p>
                  )}
                  {showTextHint && (
                    <p className="flex gap-1.5 text-muted-foreground">
                      <Type aria-hidden className="mt-0.5 size-3.5 shrink-0" />
                      {textHint}
                    </p>
                  )}
                </div>
                <label className="flex w-fit items-center gap-2 text-xs">
                  <input type="checkbox" checked={!!image.decorative} onChange={(event) => update(image.id, { decorative: event.target.checked })} className="size-4 accent-primary" />
                  {decorativeLabel}
                </label>
              </div>
            </li>
          )
        })}
      </ul>
      <div className="flex items-center justify-between gap-3">
        <p aria-live="polite" className={cn("flex items-center gap-1.5 text-sm", problems ? "text-amber-700 dark:text-amber-400" : "text-emerald-700 dark:text-emerald-400")}>
          {problems ? <ImageOff aria-hidden className="size-4" /> : <CircleCheck aria-hidden className="size-4" />}
          {problems ? (summaryText.includes("{total}") ? summaryText.replace("{count}", String(problems)).replace("{total}", String(images.length)) : summaryText.replace("{count}", `${problems} of ${images.length}`)) : allGoodText}
        </p>
        {onPost && (
          <button
            type="button"
            onClick={post}
            className={cn(
              "inline-flex h-9 shrink-0 items-center rounded-md px-4 text-sm font-medium outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50",
              asked ? "bg-amber-700 text-white hover:bg-amber-800 dark:bg-amber-400 dark:text-amber-950" : "bg-primary text-primary-foreground hover:bg-primary/90",
            )}
          >
            {asked ? postAnywayLabel : postLabel}
          </button>
        )}
      </div>
    </div>
  )
}
