"use client"

// Bollard UI — checksum-input · MIT licence · https://bollard-ui.vercel.app/components/checksum-input

import * as React from "react"
import { CircleCheck, TriangleAlert } from "lucide-react"

import { cn } from "@/lib/utils"
import {
  checkChecksum,
  checksumGroups,
  cleanChecksum,
  splitGroups,
  type ChecksumKind,
} from "@/registry/default/checksum-input/checksum"

export * from "@/registry/default/checksum-input/checksum"

/** Default messages. `{length}`, `{expected}` and `{code}` are filled in. */
export const CHECKSUM_MESSAGES = {
  tooShort: "Too short: {length} of {expected} characters.",
  tooLong: "Too long: {length} of {expected} characters.",
  doubled: "Typed twice? Without one of the highlighted characters, the check digits match.",
  swapped: "Swapped? Switching the highlighted pair makes the check digits match.",
  checksum: "The check digits don't match, so a character is wrong.",
  country: "{code} isn't an IBAN country code.",
  letterO: "That's the letter O. This spot is always the digit 0.",
  bankLetters: "The bank code is 4 letters, not digits.",
  ibanFormat: "An IBAN starts with a 2-letter country code and 2 digits.",
  isbnFormat: "An ISBN-13 starts with 978 or 979, and X can only be last.",
  ifscFormat: "The 5th character of an IFSC is always 0.",
  valid: "Check digits match.",
  ifscValid: "Format looks right. IFSC has no check digit, so confirm the branch.",
  fix: "Use {value}",
}

const LABELS: Record<ChecksumKind, string> = { iban: "IBAN", card: "Card number", isbn: "ISBN", ifsc: "IFSC" }

export interface ChecksumInputProps
  extends Omit<React.ComponentProps<"input">, "value" | "defaultValue" | "onChange" | "type"> {
  /** What the field holds. */
  kind: ChecksumKind
  /** Visible label. Defaults to the kind's name. */
  label?: string
  /** Controlled value, without spaces. */
  value?: string
  /** Initial value when uncontrolled. */
  defaultValue?: string
  /** Called with the cleaned value (no spaces, upper case). */
  onValueChange?: (value: string) => void
  /** Helper text shown while there is nothing to report. */
  hint?: string
  /** Locale for IBAN country names. */
  locale?: string
  /** Override any of the default messages. */
  messages?: Partial<typeof CHECKSUM_MESSAGES>
}

const fieldClass =
  "flex h-9 w-full min-w-0 items-center rounded-md border bg-transparent shadow-xs transition-[color,box-shadow] focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50 has-disabled:cursor-not-allowed has-disabled:opacity-50 dark:bg-input/30 data-warning:border-amber-500 dark:data-warning:border-amber-400"
const fixClass =
  "inline-flex h-6 items-center gap-1 rounded-md border border-amber-500/40 px-2 font-mono font-medium text-amber-900 transition-colors hover:bg-amber-500/10 dark:text-amber-200 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"

const fill = (template: string, values: Record<string, string | number | undefined>) =>
  template.replace(/\{(\w+)\}/g, (match, key: string) => String(values[key] ?? match))

/**
 * An account or ID number field that checks the check digits as you type, so a
 * mistyped IBAN, card number, ISBN or IFSC is caught before money or an order
 * goes to the wrong place. It groups characters the way they are printed, shows
 * a length counter, and when exactly one adjacent swap or doubled character
 * would make the number valid, it highlights those characters for the user to
 * check. It never guesses a digit for them, and keeps the value out of
 * spellcheck, autocorrect and live announcements.
 */
export function ChecksumInput({
  kind,
  label = LABELS[kind],
  value,
  defaultValue = "",
  onValueChange,
  hint,
  locale = "en",
  messages,
  name,
  id,
  className,
  onBlur,
  ref,
  ...props
}: ChecksumInputProps) {
  const [inner, setInner] = React.useState(() => cleanChecksum(kind, defaultValue))
  const [left, setLeft] = React.useState(false)
  const inputRef = React.useRef<HTMLInputElement>(null)
  const caret = React.useRef<number | null>(null)
  const autoId = React.useId()
  const inputId = id ?? autoId
  const clean = cleanChecksum(kind, value ?? inner)
  const text = { ...CHECKSUM_MESSAGES, ...messages }

  React.useImperativeHandle(ref, () => inputRef.current as HTMLInputElement)

  const regions = React.useMemo(() => {
    try {
      return new Intl.DisplayNames([locale], { type: "region" })
    } catch {
      return undefined
    }
  }, [locale])

  const groups = checksumGroups(kind, clean)
  const display = splitGroups(clean, groups).join(" ")
  const result = checkChecksum(kind, clean, left)
  const country = kind === "iban" && result.status === "valid" ? regions?.of(clean.slice(0, 2)) : undefined
  const tag = country ?? result.label

  const update = (next: string) => {
    if (value === undefined) setInner(next)
    onValueChange?.(next)
  }

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const input = event.target
    const next = cleanChecksum(kind, input.value)
    const significant = cleanChecksum(kind, input.value.slice(0, input.selectionStart ?? input.value.length)).length
    setLeft(false)
    update(next)
    caret.current = significant
  }

  // Put the caret back after the same character once the grouping spaces move, before the next keystroke.
  React.useLayoutEffect(() => {
    const input = inputRef.current
    if (caret.current === null || !input) return
    let pos = 0
    for (let seen = 0; pos < input.value.length && seen < caret.current; pos++) if (input.value[pos] !== " ") seen++
    caret.current = null
    input.setSelectionRange(pos, pos)
  })

  const values = { length: clean.length, expected: result.expected, code: clean.slice(0, 2) }
  const code = result.code === "format" ? (`${kind}Format` as "ibanFormat") : result.code
  const message = result.status === "invalid" && code ? fill(text[code as keyof typeof text], values) : ""
  let end = 0
  const fixGroup = result.fix ? splitGroups(result.fix, groups).find((part) => (end += part.length) > (result.suspects?.[0] ?? 0)) : undefined

  // The grouped value with suspect characters marked, so the user knows exactly which ones to compare.
  let at = 0
  const marked = splitGroups(clean, groups).map((group, g) => (
    <span key={g} className="mr-1.5 last:mr-0">
      {[...group].map((ch) => {
        const i = at++
        return result.suspects?.includes(i) ? (
          <mark key={i} className="rounded-sm bg-amber-300/60 px-px text-inherit dark:bg-amber-400/30">{ch}</mark>
        ) : (
          <React.Fragment key={i}>{ch}</React.Fragment>
        )
      })}
    </span>
  ))

  return (
    <div data-slot="checksum-input" className={cn("grid w-full max-w-sm gap-1.5", className)}>
      <label htmlFor={inputId} className="w-fit text-sm font-medium">
        {label}
      </label>
      <div data-warning={message ? "" : undefined} className={fieldClass}>
        <input
          ref={inputRef}
          id={inputId}
          type="text"
          inputMode={kind === "card" ? "numeric" : "text"}
          autoComplete={kind === "card" ? "cc-number" : "off"}
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
          value={display}
          onChange={handleChange}
          onBlur={(event) => {
            setLeft(true)
            onBlur?.(event)
          }}
          aria-invalid={message ? true : undefined}
          aria-describedby={`${inputId}-status`}
          className="h-full min-w-0 flex-1 bg-transparent px-3 font-mono text-base outline-none placeholder:font-sans placeholder:text-muted-foreground disabled:cursor-not-allowed md:text-sm"
          {...props}
        />
        {clean && (
          <span aria-hidden className="flex shrink-0 items-center gap-1.5 pr-3 text-xs text-muted-foreground tabular-nums">
            {kind === "card" && result.label && <span className="font-medium text-foreground/80">{result.label}</span>}
            {result.expected && kind !== "ifsc" && `${clean.length}/${result.expected}`}
          </span>
        )}
      </div>
      {name && <input type="hidden" name={name} value={clean} />}
      <div id={`${inputId}-status`} aria-live="polite" className="min-h-6 text-xs">
        {message ? (
          <div className="flex gap-1.5 text-amber-700 dark:text-amber-400">
            <span className="flex h-6 shrink-0 items-center">
              <TriangleAlert aria-hidden className="size-3.5" />
            </span>
            <div className="grid min-w-0 gap-1">
              <p className="flex flex-wrap items-center gap-x-2">
                <span className="py-1">{message}</span>
                {result.fix && fixGroup && (
                  <button
                    type="button"
                    onClick={() => {
                      update(result.fix as string)
                      inputRef.current?.focus()
                    }}
                    className={fixClass}
                  >
                    {fill(text.fix, { value: fixGroup })}
                  </button>
                )}
              </p>
              {result.suspects && !result.fix && (
                <p aria-hidden className="w-fit rounded-md bg-amber-500/10 px-2 py-1 font-mono text-amber-950 dark:text-amber-100">
                  {marked}
                </p>
              )}
            </div>
          </div>
        ) : result.status === "valid" ? (
          <p className="flex items-center gap-1.5 py-1 text-emerald-700 dark:text-emerald-400">
            <CircleCheck aria-hidden className="size-3.5 shrink-0" />
            <span>
              {tag && <span className="font-medium">{tag} · </span>}
              {kind === "ifsc" ? text.ifscValid : text.valid}
            </span>
          </p>
        ) : hint ? (
          <p className="py-1 text-muted-foreground">{hint}</p>
        ) : null}
      </div>
    </div>
  )
}
