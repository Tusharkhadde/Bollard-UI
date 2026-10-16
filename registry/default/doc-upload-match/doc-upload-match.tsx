"use client"

import * as React from "react"
import { CircleCheck, FileLock2, FileText, ImageOff, Loader2, ScanEye, Upload } from "lucide-react"

import { cn } from "@/lib/utils"
import { matchDocument, readSignals, type DocGuess, type DocIssue, type DocKind, type DocSignals, type DocSpec } from "./doc-signals"

export { hasExif, matchDocument, nameSignals, pdfFacts, pixelSignals, readSignals, sniffFormat, type DocFormat, type DocGuess, type DocIssue, type DocKind, type DocSignals, type DocSpec } from "./doc-signals"

/** Every visible string. `{…}` placeholders are filled in. */
export const DOC_UPLOAD_MESSAGES = {
  choose: "Choose file",
  replace: "Upload again",
  useAnyway: "Use anyway",
  continue: "Continue",
  remove: "Remove",
  drop: "or drop it here",
  checking: "Checking the file…",
  looksRight: "Looks like the right document.",
  page: "1 page",
  pages: "{n} pages",
  names: {
    "aadhaar-front": "the front of your Aadhaar", "aadhaar-back": "the back of your Aadhaar", aadhaar: "your Aadhaar", pan: "your PAN card",
    passport: "your passport", photo: "a photo of you", statement: "a bank statement", other: "this document",
  } as Record<DocKind, string>,
  needs: {
    "aadhaar-front": "The side with your photo, name, date of birth and 12-digit number.",
    "aadhaar-back": "The side with your address.",
    aadhaar: "Both sides, or the e-Aadhaar PDF.",
    pan: "Your name and the 10-character PAN, like ABCDE1234F.",
    passport: "The photo page, with both lines of code at the bottom.",
    photo: "Your face, front-on, in good light.",
    statement: "All pages for the period asked, as the bank's PDF.",
    other: "",
  } as Record<DocKind, string>,
  empty: "This file is empty (0 bytes). Pick it again from where it was saved.",
  format: "This file is {format}, which we can't take. Upload {accept} instead.",
  unknown: "We can't tell what kind of file this is, so it may be damaged or renamed. Upload {accept} instead.",
  heic: "This is an iPhone HEIC photo, which we can't read. Export it as JPG, or set Settings › Camera › Formats › Most Compatible and retake it.",
  tooBig: "This is {size}; the limit is {max}. Upload a smaller photo or a compressed PDF.",
  lockedAadhaar: "This e-Aadhaar PDF is password-locked, so we can't read it. Its password is the first 4 letters of your name as printed, in CAPITALS without spaces, then your birth year (SURESH KUMAR, 1990 → SURE1990). Open it, save or print an unlocked copy, and upload that.",
  locked: "This PDF is password-locked, so we can't read it. Open it, then save or print an unlocked copy and upload that.",
  pagesMany: "This PDF has {pages} pages; we need {max}. Upload just the page with {name}.",
  small: "This image is only {width}×{height} px, too small to read. Take the photo closer, or upload the original instead of a forwarded copy.",
  blurry: "This photo looks blurry, so the text may not be readable. Retake it with the card flat, in good light, and tap to focus.",
  screenshot: "This looks like a screenshot. Upload the original photo or PDF instead.",
  screenshotNested: "This looks like a screenshot with the document small inside it. Upload the original photo or PDF instead.",
  framed: "The document fills only {pct}% of the picture. Crop to the card, or retake it closer.",
  wrongDoc: "This looks like {found}, but this slot needs {want}.",
  wrongDocName: "The file name says this is {found}, but this slot needs {want}. Check it's the right file.",
  forwarded: "Forwarded chat images are compressed; the original is sharper.",
}
export type DocUploadMessages = typeof DOC_UPLOAD_MESSAGES

const fill = (s: string, v: Record<string, string | number>) => s.replace(/\{(\w+)\}/g, (m, k: string) => String(v[k] ?? m))
const size = (b: number) => (b >= 1048576 ? `${(b / 1048576).toFixed(1)} MB` : b >= 1024 ? `${Math.round(b / 1024)} KB` : `${b} bytes`)
const MIME: Record<string, string> = { pdf: "application/pdf", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", heic: "image/heic", avif: "image/avif" }

export interface DocUploadMatchProps extends Omit<React.ComponentProps<"div">, "defaultValue" | "onChange"> {
  /** Visible label, e.g. "Aadhaar (front)". */
  label: string
  /** What the slot asks for. */
  spec: DocSpec
  /** Controlled file. */
  value?: File | null
  /** Initial file when uncontrolled. */
  defaultValue?: File | null
  /** Called when a file is chosen or removed. */
  onValueChange?: (file: File | null) => void
  /** Optional OCR or model check. Gets the file and the cheap signals; return null when unsure. Aborted when the file changes. */
  classify?: (file: File, signals: DocSignals, signal: AbortSignal) => Promise<DocGuess | null>
  /** Laplacian variance below which a photo counts as blurry. */
  blurBelow?: number
  /** Called with the file and its open issues once the user accepts it (no issues, or "Use anyway"). */
  onAccept?: (file: File, issues: DocIssue[]) => void
  /** Any visible string. */
  messages?: Partial<Omit<DocUploadMessages, "names" | "needs">> & { names?: Partial<Record<DocKind, string>>; needs?: Partial<Record<DocKind, string>> }
}

/**
 * Catches the wrong KYC upload before it's submitted and rejected days later: the back of the Aadhaar
 * instead of the front, an Aadhaar in the PAN slot, a password-locked e-Aadhaar PDF (with its password
 * rule), a multi-page PDF, a tiny, blurry or HEIC photo, and a screenshot of a screenshot. It uses cheap
 * in-browser signals plus an optional `classify` hook, and says exactly what to upload instead.
 */
export function DocUploadMatch({ label, spec, value, defaultValue = null, onValueChange, classify, blurBelow, onAccept, messages, className, "aria-describedby": describedBy, ...props }: DocUploadMatchProps) {
  const t = { ...DOC_UPLOAD_MESSAGES, ...messages, names: { ...DOC_UPLOAD_MESSAGES.names, ...messages?.names }, needs: { ...DOC_UPLOAD_MESSAGES.needs, ...messages?.needs } }
  const [inner, setInner] = React.useState<File | null>(defaultValue)
  const file = value === undefined ? inner : value
  const [result, setResult] = React.useState<{ file: File; signals: DocSignals; guess: DocGuess | null; guessing: boolean }>()
  const [accepted, setAccepted] = React.useState<File>()
  const [preview, setPreview] = React.useState<string>()
  const [dragging, setDragging] = React.useState(false)
  const inputRef = React.useRef<HTMLInputElement>(null)
  const pickRef = React.useRef<HTMLButtonElement>(null)
  const id = React.useId()
  const accept = spec.accept ?? ["pdf", "jpeg", "png"]
  // Latest classify without re-reading the file each render: an inline `classify={...}` must not loop.
  const classifyRef = React.useRef(classify)
  React.useEffect(() => { classifyRef.current = classify })

  React.useEffect(() => {
    if (!file) return
    const controller = new AbortController()
    readSignals(file)
      .then(async (signals) => {
        if (controller.signal.aborted) return
        const classify = classifyRef.current
        setResult({ file, signals, guess: null, guessing: !!classify && signals.bytes > 0 })
        if (!classify || !signals.bytes) return
        const guess = await classify(file, signals, controller.signal).catch(() => null)
        // A verdict for a file the user has since replaced is dropped.
        if (!controller.signal.aborted) setResult({ file, signals, guess, guessing: false })
      })
      .catch(() => {})
    const url = file.type.startsWith("image/") && !/heic|heif/i.test(file.type) ? URL.createObjectURL(file) : undefined
    setPreview(url)
    return () => {
      controller.abort()
      if (url) URL.revokeObjectURL(url)
    }
  }, [file])

  const current = result?.file === file ? result : undefined
  const issues = current ? matchDocument(spec, current.signals, { blurBelow, guess: current.guess }) : []
  const checking = !!file && (!current || current.guessing)

  const choose = (next: File | null) => {
    if (value === undefined) setInner(next)
    onValueChange?.(next)
    setAccepted(undefined)
    requestAnimationFrame(() => pickRef.current?.focus())
  }
  const accept1 = () => {
    if (!file) return
    setAccepted(file)
    onAccept?.(file, issues)
    requestAnimationFrame(() => pickRef.current?.focus())
  }

  const describe = (issue: DocIssue) => {
    switch (issue.kind) {
      case "empty": return t.empty
      case "format": {
        const kinds = accept.map((f) => (f === "jpeg" ? "JPG" : f.toUpperCase()))
        const list = typeof Intl.ListFormat === "function" ? new Intl.ListFormat("en", { type: "disjunction" }).format(kinds) : kinds.join(", ")
        return issue.format === "heic" ? t.heic : fill(issue.format === "unknown" ? t.unknown : t.format, { format: issue.format.toUpperCase(), accept: `a ${list}` })
      }
      case "tooBig": return fill(t.tooBig, { size: size(issue.bytes), max: size(issue.max) })
      case "locked": return spec.kind.startsWith("aadhaar") ? t.lockedAadhaar : t.locked
      case "pages": return fill(t.pagesMany, { pages: issue.pages, max: issue.max, name: t.names[spec.kind] })
      case "small": return fill(t.small, issue)
      case "blurry": return t.blurry
      case "screenshot": return issue.nested ? t.screenshotNested : t.screenshot
      case "framed": return fill(t.framed, { pct: Math.round(issue.fill * 100) })
      case "wrongDoc": return fill(issue.by === "name" ? t.wrongDocName : t.wrongDoc, { found: t.names[issue.found], want: t.names[spec.kind] })
    }
  }

  const ok = !!current && !checking && issues.length === 0
  const statusText = !file ? "" : checking ? t.checking : ok ? t.looksRight : issues.map(describe).join(" ")

  return (
    <div data-slot="doc-upload-match" data-state={!file ? "empty" : checking ? "checking" : ok ? "ok" : "issues"} className={cn("grid w-full max-w-md gap-1.5 text-sm", className)} {...props}>
      <label id={`${id}-label`} htmlFor={`${id}-input`} className="font-medium">{label}</label>
      {t.needs[spec.kind] && <p id={`${id}-needs`} className="text-xs text-muted-foreground">{t.needs[spec.kind]}</p>}
      <input
        ref={inputRef}
        id={`${id}-input`}
        type="file"
        tabIndex={-1}
        aria-hidden
        accept={accept.map((f) => MIME[f]).filter(Boolean).join(",")}
        className="sr-only"
        onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) choose(f) }}
      />
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragging(false) }}
        onDrop={(e) => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files?.[0]; if (f) choose(f) }}
        className={cn("rounded-md border border-dashed p-3 transition-colors", dragging && "border-ring bg-accent", file && !ok && !checking && "border-solid border-amber-500/50", ok && "border-solid border-emerald-500/50")}
      >
        {file ? (
          <div className="flex min-w-0 gap-3">
            <div className="grid size-14 shrink-0 place-items-center overflow-hidden rounded border bg-muted">
              {preview ? <img src={preview} alt="" className="size-full object-cover" /> : current?.signals.pdf?.encrypted ? <FileLock2 aria-hidden className="size-5 text-muted-foreground" /> : current?.signals.format === "heic" ? <ImageOff aria-hidden className="size-5 text-muted-foreground" /> : <FileText aria-hidden className="size-5 text-muted-foreground" />}
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-medium [overflow-wrap:anywhere]">{file.name}</p>
              <p className="text-xs text-muted-foreground">
                {size(file.size)}
                {current?.signals.pdf?.pages ? ` · ${current.signals.pdf.pages === 1 ? t.page : fill(t.pages, { n: current.signals.pdf.pages })}` : ""}
                {current?.signals.image ? ` · ${current.signals.image.width}×${current.signals.image.height}` : ""}
              </p>
              {checking && <p className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground"><Loader2 aria-hidden className="size-3.5 animate-spin" />{t.checking}</p>}
              {ok && <p className="mt-1.5 flex items-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-400"><CircleCheck aria-hidden className="size-3.5" />{t.looksRight}</p>}
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <button ref={pickRef} id={`${id}-choose`} type="button" onClick={() => inputRef.current?.click()} aria-labelledby={`${id}-choose ${id}-label`} aria-describedby={[describedBy, t.needs[spec.kind] ? `${id}-needs` : ""].filter(Boolean).join(" ") || undefined} className="inline-flex h-9 items-center gap-2 rounded-md border bg-background px-4 text-sm font-medium shadow-xs outline-none transition-colors hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30">
              <Upload aria-hidden className="size-4" />
              {t.choose}
            </button>
            <span className="text-xs text-muted-foreground">{t.drop}</span>
          </div>
        )}
      </div>

      {file && !checking && issues.length > 0 && (
        <ul id={`${id}-issues`} className="mt-1.5 grid gap-1.5">
          {issues.map((issue) => (
            <li key={issue.kind} className="flex gap-1.5 text-xs text-amber-700 dark:text-amber-400">
              {issue.kind === "locked" ? <FileLock2 aria-hidden className="mt-0.5 size-3.5 shrink-0" /> : <ScanEye aria-hidden className="mt-0.5 size-3.5 shrink-0" />}
              <span className="min-w-0 break-words">{describe(issue)}</span>
            </li>
          ))}
          {current?.signals.forwarded && issues.some((i) => i.kind === "small" || i.kind === "blurry") && <li className="pl-5 text-xs text-muted-foreground">{t.forwarded}</li>}
        </ul>
      )}

      {file && (
        <div className="mt-1.5 flex flex-wrap gap-2">
          <button ref={pickRef} id={`${id}-replace`} type="button" data-replace aria-labelledby={`${id}-replace ${id}-label`} onClick={() => inputRef.current?.click()} aria-describedby={[describedBy, issues.length && !checking ? `${id}-issues` : ""].filter(Boolean).join(" ") || undefined} className={cn("inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-sm font-medium outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50", issues.length && !checking ? "bg-amber-700 text-white hover:bg-amber-800 dark:bg-amber-400 dark:text-amber-950" : "border bg-background hover:bg-accent dark:bg-input/30")}>
            <Upload aria-hidden className="size-3.5" />
            {t.replace}
          </button>
          {onAccept && !checking && accepted !== file && (
            <button type="button" onClick={accept1} className="inline-flex h-8 items-center rounded-md px-3 text-sm font-medium text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50">
              {issues.length ? t.useAnyway : t.continue}
            </button>
          )}
          <button id={`${id}-remove`} type="button" aria-labelledby={`${id}-remove ${id}-label`} onClick={() => choose(null)} className="inline-flex h-8 items-center rounded-md px-3 text-sm font-medium text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50">
            {t.remove}
          </button>
        </div>
      )}
      <Announce text={statusText} />
    </div>
  )
}

/** One polite region, updated after the text settles, so checks don't chatter. */
function Announce({ text, delay = 500 }: { text: string; delay?: number }) {
  const [said, setSaid] = React.useState("")
  React.useEffect(() => {
    const timer = setTimeout(() => setSaid(text), delay)
    return () => clearTimeout(timer)
  }, [text, delay])
  return <span aria-live="polite" className="sr-only">{said}</span>
}
