"use client"

// Bollard UI — clean-paste-input · MIT licence · https://bollard-ui.vercel.app/components/clean-paste-input

import * as React from "react"
import { Eraser, EyeOff, Undo2, X } from "lucide-react"

import { cn } from "@/lib/utils"

const HIDDEN: { label: string; pattern: RegExp; replacement: string }[] = [
  { label: "zero-width character", pattern: /[\u200B-\u200D\u2060\u180E]/g, replacement: "" },
  { label: "hidden tag character", pattern: /[\u{E0000}-\u{E007F}]/gu, replacement: "" },
  { label: "blank filler character", pattern: /[\u3164\u115F\u1160\uFFA0]/g, replacement: "" },
  { label: "byte order mark", pattern: /\uFEFF/g, replacement: "" },
  { label: "soft hyphen", pattern: /\u00AD/g, replacement: "" },
  { label: "text-direction control", pattern: /[\u202A-\u202E\u2066-\u2069\u200E\u200F]/g, replacement: "" },
  { label: "non-breaking space", pattern: /[\u00A0\u2007\u202F]/g, replacement: " " },
]

export interface HiddenCharacterReport {
  /** The cleaned text. */
  text: string
  /** How many characters were removed or replaced, by kind. */
  found: { label: string; count: number }[]
  /** Total characters removed or replaced, not counting trimmed whitespace. */
  total: number
}

/** Finds and removes invisible characters, and reports what it changed. */
export function scanHiddenCharacters(input: string, { trim = true } = {}): HiddenCharacterReport {
  let text = input
  const found: HiddenCharacterReport["found"] = []
  for (const { label, pattern, replacement } of HIDDEN) {
    const count = text.match(pattern)?.length ?? 0
    if (count) {
      found.push({ label, count })
      text = text.replace(pattern, replacement)
    }
  }
  return { text: trim ? text.trim() : text, found, total: found.reduce((sum, item) => sum + item.count, 0) }
}

/**
 * Strips zero-width characters, BOMs, soft hyphens and bidi controls, turns
 * non-breaking spaces into plain ones, and trims.
 */
export function cleanText(input: string, options?: { trim?: boolean }) {
  return scanHiddenCharacters(input, options).text
}

/** Every sentence the field shows. Override any of them to reword or translate. */
export const CLEAN_PASTE_MESSAGES = {
  kind: (label: string, count: number) => `${count} ${label}${count === 1 ? "" : "s"}`,
  removed: (count: number, trimmed: boolean) => `Removed ${count} hidden character${count === 1 ? "" : "s"}${trimmed ? " and trimmed the ends" : ""}.`,
  trimmedOnly: "Trimmed spaces around the pasted text.",
  contains: (list: string) => `Contains ${list}.`,
  remove: (count: number) => (count === 1 ? "Remove it" : "Remove them"),
  undo: "Undo",
  dismiss: "Dismiss",
}

type FieldProps = Omit<React.InputHTMLAttributes<HTMLInputElement> & React.TextareaHTMLAttributes<HTMLTextAreaElement>, "value" | "defaultValue" | "onChange">

export interface CleanPasteInputProps extends FieldProps {
  /** Visible label. */
  label?: string
  /** Helper text shown while there is nothing to report. */
  hint?: string
  /** Render a textarea instead of a single-line input. */
  multiline?: boolean
  /** Controlled value. */
  value?: string
  /** Initial value when uncontrolled. */
  defaultValue?: string
  /** Called with the new value on every change. */
  onValueChange?: (value: string) => void
  /** Reword or translate any message. */
  messages?: Partial<typeof CLEAN_PASTE_MESSAGES>
  /** Ref to the underlying input or textarea. */
  ref?: React.Ref<HTMLInputElement | HTMLTextAreaElement>
}

type Notice = { found: HiddenCharacterReport["found"]; total: number; trimmed: boolean; original: string }

const fixClass =
  "inline-flex h-6 items-center gap-1 rounded-md border px-2 font-medium transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
const warnFix = "border-amber-500/40 text-amber-900 hover:bg-amber-500/10 dark:text-amber-200"
const iconButton =
  "grid size-6 place-items-center rounded-md transition-colors hover:bg-accent hover:text-foreground outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"

/**
 * A text field that removes the invisible characters that ride along with a
 * copy from PDFs, chat apps and web pages (zero-width spaces, BOMs, bidi
 * overrides), which otherwise make "identical" IDs, IBANs or coupon codes fail.
 * Pastes are cleaned on the spot with an undo; hidden characters that arrive
 * any other way (autofill, a saved draft) get a warning with a one-tap fix.
 */
export function CleanPasteInput({
  label = "Text",
  hint,
  multiline = false,
  value,
  defaultValue = "",
  onValueChange,
  id,
  className,
  onPaste,
  messages,
  ref,
  ...props
}: CleanPasteInputProps) {
  const t = { ...CLEAN_PASTE_MESSAGES, ...messages }
  const describe = (found: HiddenCharacterReport["found"]) => found.map(({ label, count }) => t.kind(label, count)).join(", ")
  const [inner, setInner] = React.useState(defaultValue)
  const [notice, setNotice] = React.useState<Notice | null>(null)
  const fieldRef = React.useRef<HTMLInputElement & HTMLTextAreaElement>(null)
  const autoId = React.useId()
  const inputId = id ?? autoId
  const text = value ?? inner

  React.useImperativeHandle(ref, () => fieldRef.current as HTMLInputElement & HTMLTextAreaElement)

  const update = (next: string, caret?: number) => {
    if (value === undefined) setInner(next)
    onValueChange?.(next)
    if (caret !== undefined) requestAnimationFrame(() => fieldRef.current?.setSelectionRange(caret, caret))
  }

  const handlePaste = (event: React.ClipboardEvent<HTMLInputElement & HTMLTextAreaElement>) => {
    onPaste?.(event)
    if (event.defaultPrevented) return
    const pasted = event.clipboardData.getData("text")
    const field = event.currentTarget
    const start = field.selectionStart ?? text.length
    const end = field.selectionEnd ?? text.length
    // Trim only when the paste becomes the whole value; mid-text spaces may be intended.
    const replacesAll = start === 0 && end === text.length
    const report = scanHiddenCharacters(pasted, { trim: false })
    const cleaned = replacesAll ? report.text.trim() : report.text
    const trimmed = cleaned.length !== report.text.length
    if (!report.total && !trimmed) return
    event.preventDefault()
    const before = text.slice(0, start)
    const after = text.slice(end)
    update(before + cleaned + after, before.length + cleaned.length)
    setNotice({ found: report.found, total: report.total, trimmed, original: before + pasted + after })
  }

  const finish = (next?: string) => {
    if (next !== undefined) update(next)
    setNotice(null)
    fieldRef.current?.focus()
  }

  // Hidden characters that didn't come from a paste (autofill, a restored draft, drag and drop).
  const leftover = notice ? null : scanHiddenCharacters(text, { trim: false })
  const warning = leftover && leftover.total > 0 ? leftover : null

  const shared = {
    ref: fieldRef,
    id: inputId,
    value: text,
    onPaste: handlePaste,
    onChange: (event: React.ChangeEvent<HTMLInputElement & HTMLTextAreaElement>) => {
      // Once the user edits by hand, undoing the paste would throw their edits away.
      setNotice(null)
      update(event.target.value)
    },
    "aria-describedby": `${inputId}-notice`,
    "data-warning": warning ? "" : undefined,
    className: cn(
      "w-full min-w-0 rounded-md border bg-transparent px-3 text-base shadow-xs transition-[color,box-shadow] outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm dark:bg-input/30 data-warning:border-amber-500 dark:data-warning:border-amber-400",
      multiline ? "min-h-20 py-2" : "h-9"
    ),
    ...props,
  }

  return (
    <div data-slot="clean-paste-input" className={cn("grid w-full max-w-sm gap-1.5", className)}>
      <label htmlFor={inputId} className="w-fit text-sm font-medium">
        {label}
      </label>
      {multiline ? <textarea {...shared} /> : <input {...shared} />}
      <div id={`${inputId}-notice`} aria-live="polite" className="min-h-6 text-xs">
        {notice ? (
          <div className="flex gap-1.5 text-muted-foreground">
            <span className="flex h-6 shrink-0 items-center">
              <Eraser aria-hidden className="size-3.5 text-emerald-600 dark:text-emerald-400" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-2">
                <span className="py-1 text-foreground">
                  {notice.total ? t.removed(notice.total, notice.trimmed) : t.trimmedOnly}
                </span>
                <span className="flex items-center gap-1">
                  <button type="button" onClick={() => finish(notice.original)} className={cn(fixClass, "text-foreground hover:bg-accent")}>
                    <Undo2 aria-hidden className="size-3" />
                    {t.undo}
                  </button>
                  <button type="button" onClick={() => finish()} aria-label={t.dismiss} title={t.dismiss} className={iconButton}>
                    <X aria-hidden className="size-3.5" />
                  </button>
                </span>
              </div>
              {notice.total > 0 && <p>{describe(notice.found)}</p>}
            </div>
          </div>
        ) : warning ? (
          <div className="flex gap-1.5 text-amber-700 dark:text-amber-400">
            <span className="flex h-6 shrink-0 items-center">
              <EyeOff aria-hidden className="size-3.5" />
            </span>
            <span className="flex min-w-0 flex-wrap items-center gap-x-2">
              <span className="py-1">{t.contains(describe(warning.found))}</span>
              <button type="button" onClick={() => finish(warning.text)} className={cn(fixClass, warnFix)}>
                {t.remove(warning.total)}
              </button>
            </span>
          </div>
        ) : hint ? (
          <p className="py-1 text-muted-foreground">{hint}</p>
        ) : null}
      </div>
    </div>
  )
}
