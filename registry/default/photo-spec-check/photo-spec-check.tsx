"use client"

// Bollard UI — photo-spec-check · MIT licence · https://bollard-ui.vercel.app/components/photo-spec-check

import * as React from "react"
import { CircleCheck, Crop, ExternalLink, ImageUp, Loader2, TriangleAlert, Undo2, UserRound } from "lucide-react"

import { cn } from "@/lib/utils"
import { fixPhoto, readPhoto } from "./photo-canvas"
import { checkPhoto, FIXABLE, PHOTO_SPECS, type FaceBox, type PhotoFacts, type PhotoIssue, type PhotoSpec } from "./photo-spec"

export { fixPhoto, readPhoto } from "./photo-canvas"
export { byteWindow, checkPhoto, FIXABLE, PHOTO_SPECS, planCrop, planSize, setJpegDpi, sniff, type FaceBox, type PhotoFacts, type PhotoIssue, type PhotoSpec } from "./photo-spec"

/** Every visible string. Issue texts fill in the fields of each issue (`{kb}`, `{max}`, `{width}`…). */
export const PHOTO_SPEC_MESSAGES = {
  heading: "Photo for {label}",
  choose: "Choose photo",
  replace: "Choose another",
  reading: "Checking the photo…",
  pass: "Meets the {label} photo rules",
  fix: "Fix it: crop and resize",
  fixing: "Fixing…",
  fixed: "Fixed copy: {width} × {height} px, {kb} KB JPEG.",
  undo: "Undo",
  failed: "Couldn't fix this photo automatically. Try another one.",
  retake: "Needs a new photo",
  official: "Official instructions",
  summary: "{count} problems with this photo.",
  summaryOne: "1 problem with this photo.",
  issues: {
    format: "It's really a {type} file{claimedText}. This portal takes JPEG only.",
    tooBig: "{kb} KB is over the {max} KB limit.",
    tooSmall: "{kb} KB is under the {min} KB minimum. Portals read tiny files as blurred.",
    compressed: "It's compressed {ratio}:1; the most allowed is {max}:1, so it would look blocky.",
    dimsSmall: "{width} × {height} px is smaller than {minWidth} × {minHeight} px.",
    dimsBig: "{width} × {height} px is bigger than {maxWidth} × {maxHeight} px.",
    aspect: "The shape is {actual}; it must be {wanted}.",
    printSize: "Prints at {widthCm} × {heightCm} cm; it should be {wanted}.",
    faceSmall: "Your face fills {share}% of the photo; it should be at least {min}%.",
    faceBig: "Your head fills {share}% of the height; the most allowed is {max}%.",
    faceOffCentre: "Your face isn't centred.",
    background: "The background isn't plain white. Retake it against a white wall; editing it out isn't allowed.",
    colour: "This is black and white. A colour photo is required.",
    unreadable: "This file can't be opened as an image.",
  } as Record<PhotoIssue["kind"], string>,
  renamed: " renamed .{claimed}",
}

export type PhotoSpecMessages = typeof PHOTO_SPEC_MESSAGES

const fill = (template: string, values: Record<string, unknown>) => template.replace(/\{(\w+)\}/g, (m, k: string) => (values[k] === undefined ? m : String(values[k])))
const summarise = (s: PhotoSpec) =>
  [
    s.formats?.map((f) => f.toUpperCase()).join("/"),
    s.minKB && s.maxKB ? `${s.minKB}–${s.maxKB} KB` : s.maxKB ? `≤ ${s.maxKB} KB` : s.minKB ? `≥ ${s.minKB} KB` : "",
    s.minWidth && s.maxWidth ? `${s.minWidth}–${s.maxWidth} px` : s.minWidth ? `≥ ${s.minWidth} px` : s.maxWidth ? `≤ ${s.maxWidth} px` : "",
    s.sizeCm ? `${s.sizeCm.width} × ${s.sizeCm.height} cm` : s.aspect === 1 ? "square" : "",
  ].filter(Boolean).join(" · ")
const button = "inline-flex min-h-9 py-1.5 text-center items-center justify-center gap-2 rounded-md px-4 text-sm font-medium transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-60"

export interface PhotoSpecCheckProps extends Omit<React.ComponentProps<"div">, "defaultValue" | "onChange"> {
  /** A preset key from `PHOTO_SPECS` ("upsc", "ssc", "nta", "neet", "us-visa") or your own spec. */
  spec: string | PhotoSpec
  /** Controlled file. */
  value?: File | null
  /** Initial file when uncontrolled. */
  defaultValue?: File | null
  /** Called with the chosen file, or the fixed copy after a one-tap fix. */
  onValueChange?: (file: File | null) => void
  /** The face (or head) box in the file's pixels, or a detector that returns one. Enables the face checks and a face-aware crop. */
  face?: FaceBox | null | ((file: File) => FaceBox | null | Promise<FaceBox | null>)
  /** Called whenever the open issues change, to gate the upload. */
  onIssuesChange?: (issues: PhotoIssue[]) => void
  /** Any visible string; `issues` may be partial. */
  messages?: Partial<Omit<PhotoSpecMessages, "issues">> & { issues?: Partial<PhotoSpecMessages["issues"]> }
}

/**
 * Checks an exam, passport or visa photo against the portal's rules before upload: real file type,
 * KB, pixels, shape, print size, face size and position, a background that isn't white and black and
 * white photos. One tap crops around the face, resizes and re-encodes a copy that fits.
 */
export function PhotoSpecCheck({ spec: specProp, value, defaultValue = null, onValueChange, face, onIssuesChange, messages, className, ...props }: PhotoSpecCheckProps) {
  const t = { ...PHOTO_SPEC_MESSAGES, ...messages, issues: { ...PHOTO_SPEC_MESSAGES.issues, ...messages?.issues } }
  const spec: PhotoSpec = (typeof specProp === "string" ? PHOTO_SPECS[specProp] : specProp) ?? { label: "" }
  const [inner, setInner] = React.useState<File | null>(defaultValue)
  const file = value === undefined ? inner : value
  const [facts, setFacts] = React.useState<{ file: File; facts: PhotoFacts }>()
  const [preview, setPreview] = React.useState<string>()
  const [fixing, setFixing] = React.useState(false)
  const [failed, setFailed] = React.useState(false)
  const [undo, setUndo] = React.useState<{ from: File; to: File; width: number; height: number }>()
  const known = React.useRef(new WeakMap<File, FaceBox | null>())
  const inputRef = React.useRef<HTMLInputElement>(null)
  const chooseRef = React.useRef<HTMLButtonElement>(null)
  const fixRef = React.useRef<HTMLButtonElement>(null)
  const refocus = React.useRef(false)
  const id = React.useId()
  const inputFile = React.useRef(file)
  inputFile.current = file
  const faceRef = React.useRef(face)
  faceRef.current = face
  const faceKey = typeof face === "function" ? "detector" : JSON.stringify(face ?? null)

  React.useEffect(() => {
    if (!file) return setPreview(undefined)
    const url = URL.createObjectURL(file)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  React.useEffect(() => {
    if (!file) return
    let live = true
    ;(async () => {
      const hint = faceRef.current
      const box = known.current.has(file) ? known.current.get(file) : typeof hint === "function" ? await hint(file) : hint
      const read = await readPhoto(file, box ?? null)
      if (live) setFacts({ file, facts: read })
    })().catch(() => live && setFacts({ file, facts: { bytes: file.size, type: "unknown" } }))
    return () => {
      live = false
    }
  }, [file, faceKey])

  const current = file && facts?.file === file ? facts.facts : undefined
  const issues = React.useMemo(() => (current ? checkPhoto(current, spec) : []), [current, spec])
  const fixable = issues.some((i) => FIXABLE.includes(i.kind)) && !!current?.width
  const key = issues.map((i) => i.kind).join()

  React.useEffect(() => onIssuesChange?.(issues), [key, current]) // eslint-disable-line react-hooks/exhaustive-deps
  React.useEffect(() => {
    if (!refocus.current || !current) return
    refocus.current = false
    ;(fixRef.current ?? chooseRef.current)?.focus()
  })

  const update = (next: File | null) => {
    if (value === undefined) setInner(next)
    onValueChange?.(next)
  }
  const choose = (next: File | null) => {
    setUndo(undefined)
    setFailed(false)
    update(next)
  }
  const fix = async () => {
    if (!file || fixing) return
    const from = file
    setFixing(true)
    setFailed(false)
    try {
      const box = known.current.has(from) ? known.current.get(from) : (current?.face ?? null)
      const out = await fixPhoto(from, spec, box)
      if (inputFile.current !== from) return // the user picked another file meanwhile
      known.current.set(out.file, out.face ?? null)
      setUndo({ from, to: out.file, width: out.width, height: out.height })
      refocus.current = true
      update(out.file)
    } catch {
      setFailed(true)
    } finally {
      setFixing(false)
    }
  }

  const kbOf = (bytes: number) => Math.round(bytes / (spec.kb ?? 1024))
  const status = !file ? "" : !current ? t.reading : issues.length === 0 ? fill(t.pass, { label: spec.label }) : issues.length === 1 ? t.summaryOne : fill(t.summary, { count: issues.length })
  const f = current?.face
  const showFixed = undo && undo.to === file

  return (
    <div data-slot="photo-spec-check" data-state={!current ? "idle" : issues.length ? "issues" : "pass"} className={cn("@container grid w-full max-w-md min-w-0 gap-3 rounded-lg border bg-card p-4 text-sm text-card-foreground shadow-xs", className)} {...props}>
      <div className="grid gap-0.5">
        <h3 className="font-medium">{fill(t.heading, { label: spec.label })}</h3>
        <p className="text-xs text-muted-foreground">{summarise(spec)}</p>
      </div>

      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <input ref={inputRef} id={`${id}-file`} type="file" accept="image/*" className="sr-only" tabIndex={-1} aria-hidden onChange={(e) => { choose(e.target.files?.[0] ?? null); e.target.value = "" }} />
        <button ref={chooseRef} type="button" onClick={() => inputRef.current?.click()} aria-describedby={`${id}-status`} className={cn(button, "border hover:bg-accent")}>
          <ImageUp aria-hidden className="size-4" />
          {file ? t.replace : t.choose}
        </button>
        {file && <span className="min-w-0 truncate text-xs text-muted-foreground">{file.name} · {kbOf(file.size)} KB</span>}
      </div>

      {file && (
        <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-3 @2xs:grid-cols-[5rem_minmax(0,1fr)]">
          <div className="relative grid aspect-[3/4] w-20 place-items-center overflow-hidden rounded-md border bg-muted @2xs:w-auto">
            {preview && current?.width && current.height ? (
              <div className="relative max-h-full max-w-full" style={{ aspectRatio: `${current.width} / ${current.height}`, width: current.width >= current.height * 0.75 ? "100%" : "auto", height: current.width >= current.height * 0.75 ? "auto" : "100%" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={preview} alt="" className="size-full object-cover" />
                {f && current.width && current.height && <span aria-hidden className="absolute rounded-[40%] border-2 border-amber-400" style={{ left: `${(f.x / current.width) * 100}%`, top: `${(f.y / current.height) * 100}%`, width: `${(f.width / current.width) * 100}%`, height: `${(f.height / current.height) * 100}%` }} />}
              </div>
            ) : (
              <UserRound aria-hidden className="size-6 text-muted-foreground" />
            )}
          </div>
          <div id={`${id}-status`} className="grid min-w-0 content-start gap-1.5">
            {!current ? (
              <p className="flex items-center gap-1.5 text-muted-foreground"><Loader2 aria-hidden className="size-3.5 animate-spin" />{t.reading}</p>
            ) : issues.length === 0 ? (
              <p className="flex items-center gap-1.5 font-medium text-emerald-700 dark:text-emerald-400"><CircleCheck aria-hidden className="size-4 shrink-0" />{status}</p>
            ) : (
              <ul className="grid gap-1 text-xs">
                {issues.map((issue) => {
                  const retake = !FIXABLE.includes(issue.kind)
                  return (
                    <li key={issue.kind} className={cn("flex gap-1.5", retake ? "text-red-700 dark:text-red-400" : "text-amber-700 dark:text-amber-400")}>
                      <TriangleAlert aria-hidden className="mt-px size-3.5 shrink-0" />
                      <span className="min-w-0 break-words">
                        {fill(t.issues[issue.kind], { ...issue, type: "type" in issue ? issue.type.toUpperCase() : "", claimedText: issue.kind === "format" && issue.claimed && issue.claimed !== issue.type && !(issue.type === "jpeg" && issue.claimed === "jpg") ? fill(t.renamed, { claimed: issue.claimed }) : "" })}
                        {retake && <span className="sr-only"> ({t.retake})</span>}
                      </span>
                    </li>
                  )
                })}
              </ul>
            )}
            {showFixed && <p className="text-xs text-muted-foreground">{fill(t.fixed, { width: undo.width, height: undo.height, kb: kbOf(undo.to.size) })}</p>}
          </div>
        </div>
      )}

      {failed && <p role="alert" className="text-xs text-red-700 dark:text-red-400">{t.failed}</p>}
      {(fixable || showFixed) && (
        <div className="flex flex-wrap gap-2">
          {fixable && (
            <button ref={fixRef} type="button" onClick={fix} aria-disabled={fixing || undefined} aria-busy={fixing || undefined} className={cn(button, "flex-1 bg-primary text-primary-foreground hover:bg-primary/90", fixing && "opacity-70")}>
              {fixing ? <Loader2 aria-hidden className="size-4 animate-spin" /> : <Crop aria-hidden className="size-4" />}
              {fixing ? t.fixing : t.fix}
            </button>
          )}
          {showFixed && (
            <button type="button" onClick={() => { refocus.current = true; setUndo(undefined); update(undo.from) }} className={cn(button, "border hover:bg-accent")}>
              <Undo2 aria-hidden className="size-4" />
              {t.undo}
            </button>
          )}
        </div>
      )}

      {(spec.note || spec.source) && (
        <p className="border-t pt-3 text-xs text-muted-foreground">
          {spec.note}{" "}
          {spec.source && (
            <a href={spec.source} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1 rounded-sm font-medium text-foreground underline underline-offset-2 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50">
              {t.official}
              <ExternalLink aria-hidden className="size-3" />
            </a>
          )}
        </p>
      )}
      <span aria-live="polite" className="sr-only">{current ? status : ""}</span>
    </div>
  )
}
