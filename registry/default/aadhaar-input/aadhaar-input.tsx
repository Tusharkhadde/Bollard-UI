"use client"

import * as React from "react"
import { CircleCheck, Eye, EyeOff, IdCard, Info, Lock, TriangleAlert } from "lucide-react"

import { cn } from "@/lib/utils"
import { groupDigits, maskAadhaar, readAadhaar, toAsciiDigits, type AadhaarKind, type AadhaarReading } from "./aadhaar"

export { groupDigits, maskAadhaar, readAadhaar, toAsciiDigits, verhoeffValid, type AadhaarKind, type AadhaarProblem, type AadhaarReading } from "./aadhaar"

type Accept = "aadhaar" | "vid" | "either"

/** Every visible string. `{count}`, `{expected}`, `{a}` and `{b}` are filled in. */
export const AADHAAR_MESSAGES = {
  label: { aadhaar: "Aadhaar number", vid: "Virtual ID (VID)", either: "Aadhaar number or VID" } as Record<Accept, string>,
  recommend: "UIDAI advises sharing as little as you can: a 16-digit Virtual ID works here too, and we only ever show the last 4 digits.",
  storage: {
    masked: "We keep only the last 4 digits (XXXX XXXX 1234).",
    vault: "Stored encrypted in a separate Aadhaar Data Vault, as UIDAI requires, and never shown in full.",
    none: "Used once to verify you, then deleted.",
  },
  show: "Show number",
  hide: "Hide number",
  ok: { aadhaar: "Valid Aadhaar number", vid: "Valid Virtual ID" } as Record<"aadhaar" | "vid", string>,
  firstDigit: "Aadhaar numbers never start with 0 or 1. Check the first digit.",
  checksum: "This number doesn't add up: a digit is mistyped or two are swapped. Check it against your Aadhaar letter or e-Aadhaar.",
  letters: "Some letters look like digits (O for 0, I or l for 1).",
  lettersFix: "Use digits",
  length: "That's {count} digits. Aadhaar has 12, a VID has 16.",
  separators: "Removed the spaces and dashes from the pasted number.",
  wrongKind: {
    vid: "That's a 16-digit Virtual ID, not your 12-digit Aadhaar number.",
    aadhaar: "That's a 12-digit Aadhaar number. This form needs your 16-digit VID.",
    enrolment: "That's the enrolment ID from your enrolment slip, not your Aadhaar number. Your Aadhaar is the 12-digit number on the letter or e-Aadhaar.",
    masked: "That's a masked Aadhaar. Type the full 12-digit number here; we'll mask it again.",
    pan: "That's a PAN, not an Aadhaar number.",
    mobile: "That looks like a mobile number. Aadhaar has 12 digits.",
  } as Partial<Record<AadhaarKind, string>>,
  useInstead: { aadhaar: "Use as Aadhaar", vid: "Use my VID instead" } as Record<"aadhaar" | "vid", string>,
}

export type AadhaarMessages = typeof AADHAAR_MESSAGES

const fill = (template: string, values: Record<string, string | number>) => template.replace(/\{(\w+)\}/g, (m, k: string) => String(values[k] ?? m))
/** Letters and digits only, any Indian-script digit as ASCII, BOM and line breaks dropped. */
const normalize = (text: string) => toAsciiDigits(text.replace(/^\uFEFF/, "")).replace(/[^0-9A-Za-z*•]/g, "").toUpperCase()
const fixClass = "inline-flex h-6 shrink-0 items-center rounded-md border border-amber-500/40 px-2 font-medium text-amber-900 outline-none transition-colors hover:bg-amber-500/10 focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:text-amber-200"
const MAX = 28

export interface AadhaarInputProps extends Omit<React.ComponentProps<"input">, "value" | "defaultValue" | "onChange" | "type"> {
  /** What the form wants. Defaults to `aadhaar`. */
  accept?: Accept
  /** Controlled entry (digits; letters only while a look-alike fix is pending). */
  value?: string
  /** Initial entry when uncontrolled. Spaces and dashes are removed. */
  defaultValue?: string
  /** Called with the entry and what it was read as. Store `maskAadhaar(entry)`, not the entry, unless you run an Aadhaar Data Vault. */
  onValueChange?: (value: string, reading: AadhaarReading) => void
  /** Offer a one-tap switch when the other kind is pasted (VID in an Aadhaar field, or the reverse). */
  onAcceptChange?: (accept: "aadhaar" | "vid") => void
  /** How you keep the number, shown as the storage note. Defaults to `masked`. */
  storage?: "masked" | "vault" | "none"
  /** Visible label; defaults to one matching `accept`. */
  label?: string
  /** Any visible string. */
  messages?: Partial<AadhaarMessages>
}

/**
 * An Aadhaar or VID field that shows the number masked as XXXX XXXX 1234 while typing (reveal on
 * demand, offered in one tap when the check digit fails), checks the Verhoeff digit and the
 * never-0-or-1 first digit, and recognises the wrong number pasted in: a VID, the 28-digit enrolment
 * ID, a masked copy, a PAN or a mobile number (with or without +91). It says up front that a VID or masked number is enough and how the number is kept,
 * since Aadhaar regulations bar displaying it in full and require a vault to store it.
 */
export function AadhaarInput({
  accept = "aadhaar", value, defaultValue = "", onValueChange, onAcceptChange, storage = "masked", label, messages,
  id, name, className, onBlur, onFocus, onPaste, ref, "aria-describedby": describedBy, disabled, ...props
}: AadhaarInputProps) {
  const t: AadhaarMessages = { ...AADHAAR_MESSAGES, ...messages }
  const [inner, setInner] = React.useState(() => normalize(defaultValue).slice(0, MAX))
  const [revealed, setRevealed] = React.useState(false)
  const [touched, setTouched] = React.useState(() => normalize(defaultValue).length > 0)
  const [pasteNote, setPasteNote] = React.useState(false)
  const [spoken, setSpoken] = React.useState("")
  const inputRef = React.useRef<HTMLInputElement>(null)
  const caret = React.useRef<number | null>(null)
  const pasting = React.useRef(false)
  // What the raw clipboard text was read as, when cleaning it loses the clue ("+91 98765 43210").
  const pastedRef = React.useRef<AadhaarReading | undefined>(undefined)
  const [pasted, setPasted] = React.useState<AadhaarReading>()
  const autoId = React.useId()
  const inputId = id ?? autoId
  const entry = normalize(value ?? inner).slice(0, MAX)
  const sameDigits = (r: AadhaarReading | undefined, text: string): r is AadhaarReading => !!r && r.digits === text.replace(/\D/g, "")
  const reading = sameDigits(pasted, entry) ? pasted : readAadhaar(entry, accept)
  const display = groupDigits(revealed || entry.length <= 4 ? entry : "X".repeat(entry.length - 4) + entry.slice(-4))

  React.useImperativeHandle(ref, () => inputRef.current as HTMLInputElement)

  React.useLayoutEffect(() => {
    if (caret.current === null) return
    inputRef.current?.setSelectionRange(caret.current, caret.current)
    caret.current = null
  })

  // Re-mask when the user leaves the tab.
  React.useEffect(() => {
    const hide = () => document.hidden && setRevealed(false)
    document.addEventListener("visibilitychange", hide)
    return () => document.removeEventListener("visibilitychange", hide)
  }, [])

  const complete = [12, 14, 16, 28].includes(reading.digits.length) || reading.kind === "pan" || reading.kind === "masked" || reading.problem?.kind === "letters"
  const problem = touched || complete ? reading.problem : undefined
  const isError = !!problem && problem.kind !== "wrong-kind"

  const update = (next: string, at?: number) => {
    const clean = normalize(next).slice(0, MAX)
    if (value === undefined) setInner(clean)
    const fromPaste = pastedRef.current
    onValueChange?.(clean, sameDigits(fromPaste, clean) ? fromPaste : readAadhaar(clean, accept))
    if (at !== undefined) caret.current = Math.min(at, clean.length) + Math.floor(Math.max(0, Math.min(at, clean.length) - 1) / 4)
  }

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const next = event.target.value
    let start = 0
    while (start < display.length && start < next.length && display[start] === next[start]) start++
    let end = 0
    while (end < display.length - start && end < next.length - start && display[display.length - 1 - end] === next[next.length - 1 - end]) end++
    const toEntry = (pos: number) => display.slice(0, pos).replace(/ /g, "").length
    const inserted = normalize(next.slice(start, next.length - end))
    const from = toEntry(start)
    const to = toEntry(display.length - end)
    if (!pasting.current) { setPasteNote(false); setPasted(undefined); pastedRef.current = undefined }
    pasting.current = false
    update(entry.slice(0, from) + inserted + entry.slice(to), from + inserted.length)
  }

  const fix = (next: string) => {
    update(next)
    setTouched(true)
    inputRef.current?.focus()
  }

  // One debounced announcement for whatever the message line says.
  const line = problem ? describe() : reading.valid ? t.ok[reading.kind as "aadhaar" | "vid"] : ""
  React.useEffect(() => {
    const timer = setTimeout(() => setSpoken(line), 600)
    return () => clearTimeout(timer)
  }, [line])

  function describe(): string {
    if (!problem) return ""
    switch (problem.kind) {
      case "first-digit": return t.firstDigit
      // No "digits 7 and 8 look swapped" hint: for a single mistyped digit that guess is wrong ~40% of the time.
      case "checksum": return t.checksum
      case "letters": return t.letters
      case "length": return fill(t.length, { count: problem.count, expected: problem.expected })
      case "wrong-kind": return t.wrongKind[problem.found] ?? ""
    }
  }

  const switchTo = problem?.kind === "wrong-kind" && onAcceptChange && (problem.found === "vid" || problem.found === "aadhaar") ? problem.found : undefined
  const fixValue = problem?.kind === "letters" ? problem.fixed : undefined
  // The number is masked, so a checksum error is impossible to find without seeing it: offer the reveal.
  const offerReveal = problem?.kind === "checksum" && !revealed
  const messageId = `${inputId}-message`
  const noteId = `${inputId}-note`

  return (
    <div data-slot="aadhaar-input" data-state={problem ? (isError ? "error" : "warning") : reading.valid ? "valid" : "idle"} className={cn("grid w-full max-w-sm gap-1.5", className)}>
      <label htmlFor={inputId} className="w-fit text-sm font-medium">{label ?? t.label[accept]}</label>
      <div className="relative">
        <IdCard aria-hidden className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          ref={inputRef}
          id={inputId}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          value={display}
          disabled={disabled}
          onChange={handleChange}
          onPaste={(event) => {
            const text = event.clipboardData.getData("text")
            pasting.current = true
            const raw = readAadhaar(text, accept)
            pastedRef.current = raw.kind === "mobile" ? raw : undefined
            setPasted(pastedRef.current)
            setPasteNote(/\d[\s\u00A0\-–—.·/]+\d/.test(text))
            setTouched(true)
            onPaste?.(event)
          }}
          onBlur={(event) => { setTouched(entry.length > 0); onBlur?.(event) }}
          onFocus={onFocus}
          aria-invalid={isError || undefined}
          aria-describedby={[describedBy, messageId, noteId].filter(Boolean).join(" ")}
          className="h-9 w-full min-w-0 rounded-md border bg-transparent pr-10 pl-9 font-mono text-base tracking-wider shadow-xs outline-none transition-[color,box-shadow] placeholder:font-sans placeholder:tracking-normal placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-50 aria-invalid:border-destructive md:text-sm dark:bg-input/30 data-warning:border-amber-500"
          data-warning={problem && !isError ? "" : undefined}
          placeholder={accept === "vid" ? "XXXX XXXX XXXX XXXX" : "XXXX XXXX XXXX"}
          {...props}
        />
        <button
          type="button"
          onClick={() => { setRevealed(!revealed); inputRef.current?.focus() }}
          aria-pressed={revealed}
          aria-label={revealed ? t.hide : t.show}
          disabled={disabled}
          className="absolute top-1/2 right-1 inline-flex size-7 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground outline-none hover:bg-accent hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          {revealed ? <EyeOff aria-hidden className="size-4" /> : <Eye aria-hidden className="size-4" />}
        </button>
      </div>
      {name && <input type="hidden" name={name} value={reading.valid ? reading.digits : ""} />}

      <div id={messageId} className="min-h-5 text-xs">
        {problem ? (
          <p className={cn("flex flex-wrap items-center gap-x-2 gap-y-1", isError ? "text-destructive" : "text-amber-700 dark:text-amber-400")}>
            <span className="flex min-w-48 flex-1 gap-1.5"><TriangleAlert aria-hidden className="mt-px size-3.5 shrink-0" /><span className="min-w-0">{describe()}</span></span>
            {fixValue && <button type="button" className={fixClass} onClick={() => fix(fixValue)}>{t.lettersFix}</button>}
            {offerReveal && <button type="button" className={fixClass} onClick={() => { setRevealed(true); inputRef.current?.focus() }}>{t.show}</button>}
            {switchTo && <button type="button" className={fixClass} onClick={() => { onAcceptChange?.(switchTo); inputRef.current?.focus() }}>{t.useInstead[switchTo]}</button>}
          </p>
        ) : reading.valid ? (
          <p className="flex gap-1.5 text-emerald-700 dark:text-emerald-400"><CircleCheck aria-hidden className="mt-px size-3.5 shrink-0" />{t.ok[reading.kind as "aadhaar" | "vid"]}</p>
        ) : null}
        {pasteNote && <p className="mt-1 flex gap-1.5 text-muted-foreground"><Info aria-hidden className="mt-px size-3.5 shrink-0" />{t.separators}</p>}
      </div>
      <div id={noteId} className="space-y-1 text-xs text-muted-foreground">
        <p>{t.recommend}</p>
        <p className="flex gap-1.5"><Lock aria-hidden className="mt-px size-3.5 shrink-0" />{t.storage[storage]}</p>
      </div>
      <span role="status" className="sr-only">{spoken}</span>
    </div>
  )
}
