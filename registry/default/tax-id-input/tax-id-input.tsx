"use client"

import * as React from "react"
import { CircleCheck, ExternalLink, TriangleAlert } from "lucide-react"

import { cn } from "@/lib/utils"
import { checkTaxId, cleanTaxId, groupTaxId, type TaxIdKind } from "@/registry/default/tax-id-input/tax-id"

export * from "@/registry/default/tax-id-input/tax-id"

/** Default messages. `{n}`, `{ch}`, `{want}`, `{code}`, `{length}` and `{expected}` are filled in. */
export const TAX_ID_MESSAGES = {
  short: "Too short: {length} of {expected} characters.",
  shortVat: "Too short for this country's VAT number.",
  long: "Too long: {length} characters.",
  belgium: "Belgian VAT numbers have 10 digits; old 9-digit ones take a leading 0.",
  letter: "Character {n} should be a letter, not {ch}.",
  digit: "Character {n} should be a digit, not the letter {ch}.",
  literal: "Character {n} is always {want} here, not {ch}.",
  state: "{code} isn't a GST state code.",
  holder: "{ch} isn't a PAN holder type. Use P, C, H, F, A, T, B, L, J or G.",
  entity: "Character 13 counts registrations and starts at 1, not 0.",
  check: "The check character doesn't match, so a character is mistyped.",
  swapped: "Swapped? Switching the highlighted pair makes the check character match.",
  prefix: "Start with the 2-letter country code, like DE or FR.",
  greece: "Greek VAT numbers start with EL, not GR.",
  country: "{code} isn't an EU VAT prefix.",
  gstinValid: "Check character matches.",
  panValid: "Format is right. PAN's check letter isn't public, so confirm the name too.",
  vatValid: "Format matches. Only VIES can confirm it's registered.",
  vies: "Check on VIES",
  swap: "Swap them",
}

const LABELS: Record<TaxIdKind, string> = { gstin: "GSTIN", pan: "PAN", vat: "EU VAT number" }
const PLACEHOLDERS: Record<TaxIdKind, string> = { gstin: "27 ABCDE1234F 1Z5", pan: "ABCDE 1234 F", vat: "DE 123456789" }

export interface TaxIdInputProps
  extends Omit<React.ComponentProps<"input">, "value" | "defaultValue" | "onChange" | "type"> {
  /** Which number the field holds. */
  kind: TaxIdKind
  /** Visible label. Defaults to the kind's name. */
  label?: string
  /** Controlled value, without spaces. */
  value?: string
  /** Initial value when uncontrolled. */
  defaultValue?: string
  /** Called with the cleaned value (no spaces, upper case) and whether it passed every check. */
  onValueChange?: (value: string, valid: boolean) => void
  /** Helper text shown while there is nothing to report. */
  hint?: string
  /** Locale for EU country names. */
  locale?: string
  /** Override any of the default messages. */
  messages?: Partial<typeof TAX_ID_MESSAGES>
}

const fieldClass =
  "flex h-9 w-full min-w-0 items-center rounded-md border bg-transparent shadow-xs transition-[color,box-shadow] focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50 has-disabled:cursor-not-allowed has-disabled:opacity-50 dark:bg-input/30 data-warning:border-amber-500 dark:data-warning:border-amber-400"
const fixClass =
  "inline-flex h-6 items-center gap-1 rounded-md border border-amber-500/40 px-2 font-medium text-amber-900 transition-colors hover:bg-amber-500/10 dark:text-amber-200 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
const keyframes = `@keyframes cui-tax-id-input-flash{0%{transform:scale(1.4);background-color:rgb(245 158 11 / .7)}100%{transform:scale(1)}}`

const fill = (template: string, values: Record<string, string | number | undefined>) =>
  template.replace(/\{(\w+)\}/g, (match, key: string) => String(values[key] ?? match))

/**
 * A field for Indian GSTIN and PAN numbers and EU VAT numbers that catches the typo before it lands on an
 * invoice. It recomputes the GSTIN's mod-36 check character, reads back the state, holder type and country,
 * and names the exact character that is wrong ("character 8 should be a digit, not the letter O") with a
 * one-tap fix for look-alikes, an adjacent swap or Greece's GR → EL. The value is never saved, autofilled,
 * spell-checked or read out by the live region.
 */
export function TaxIdInput({
  kind,
  label = LABELS[kind],
  value,
  defaultValue = "",
  onValueChange,
  hint,
  locale = "en",
  messages,
  placeholder = PLACEHOLDERS[kind],
  name,
  id,
  className,
  onBlur,
  ref,
  ...props
}: TaxIdInputProps) {
  const [inner, setInner] = React.useState(() => cleanTaxId(defaultValue))
  const [left, setLeft] = React.useState(() => defaultValue !== "")
  const inputRef = React.useRef<HTMLInputElement>(null)
  const caret = React.useRef<number | null>(null)
  const autoId = React.useId()
  const inputId = id ?? autoId
  const clean = cleanTaxId(value ?? inner)
  const text = { ...TAX_ID_MESSAGES, ...messages }

  React.useImperativeHandle(ref, () => inputRef.current as HTMLInputElement)

  const countryName = React.useMemo(() => {
    let regions: Intl.DisplayNames | undefined
    try {
      regions = new Intl.DisplayNames([locale], { type: "region" })
    } catch {}
    return (code: string) => (code === "XI" ? "Northern Ireland" : regions?.of(code === "EL" ? "GR" : code))
  }, [locale])

  const result = checkTaxId(kind, clean, left, countryName)
  const parts = groupTaxId(clean, result.groups)

  const update = (next: string) => {
    if (value === undefined) setInner(next)
    onValueChange?.(next, checkTaxId(kind, next, true).status === "valid")
  }

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const input = event.target
    caret.current = cleanTaxId(input.value.slice(0, input.selectionStart ?? input.value.length)).length
    setLeft(false)
    update(cleanTaxId(input.value))
  }

  // Keep the caret after the same character when the grouping spaces move.
  React.useLayoutEffect(() => {
    const input = inputRef.current
    if (caret.current === null || !input) return
    let pos = 0
    for (let seen = 0; pos < input.value.length && seen < caret.current; pos++) if (input.value[pos] !== " ") seen++
    caret.current = null
    input.setSelectionRange(pos, pos)
  })

  const at = result.at ?? []
  const first = at[0] ?? 0
  const isBelgium = kind === "vat" && result.code === "short" && result.fix
  const key = isBelgium ? "belgium" : kind === "vat" && result.code === "short" && !result.expected ? "shortVat" : result.code
  const message = result.status === "invalid" && key
    ? fill(text[key], { n: first + 1, ch: clean[first], want: result.want, code: clean.slice(0, 2), length: clean.length, expected: result.expected })
    : ""
  const fixLabel = result.code === "swapped"
    ? text.swap
    : result.fix && !isBelgium
      ? `${clean.slice(first, first + at.length)} → ${result.fix.slice(first, first + at.length)}`
      : result.fix && `Use ${groupTaxId(result.fix, [2, 10]).join(" ")}`
  const applyFix = () => {
    const swapped = result.code === "swapped" && clean.slice(0, first) + clean[first + 1] + clean[first] + clean.slice(first + 2)
    update(swapped || result.fix || clean)
    inputRef.current?.focus()
  }
  const validText = kind === "gstin" ? text.gstinValid : kind === "pan" ? text.panValid : text.vatValid

  let index = 0
  const marked = parts.map((part, p) => (
    <span key={p} className="mr-1.5 last:mr-0">
      {[...part].map((ch) => {
        const i = index++
        return at.includes(i) ? (
          <mark key={`${i}-${at.join()}`} className="inline-block rounded-sm bg-amber-300/60 px-px text-inherit motion-safe:animate-[cui-tax-id-input-flash_350ms_ease-out] dark:bg-amber-400/30">
            {ch}
          </mark>
        ) : (
          <React.Fragment key={i}>{ch}</React.Fragment>
        )
      })}
    </span>
  ))

  return (
    <div data-slot="tax-id-input" className={cn("grid w-full max-w-sm gap-1.5", className)}>
      <style>{keyframes}</style>
      <label htmlFor={inputId} className="w-fit text-sm font-medium">
        {label}
      </label>
      <div data-warning={message ? "" : undefined} className={fieldClass}>
        <input
          ref={inputRef}
          id={inputId}
          type="text"
          autoComplete="off"
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
          value={parts.join(" ")}
          placeholder={placeholder}
          onChange={handleChange}
          onBlur={(event) => {
            setLeft(true)
            onBlur?.(event)
          }}
          aria-invalid={message ? true : undefined}
          aria-describedby={`${inputId}-status`}
          className="h-full min-w-0 flex-1 bg-transparent px-3 font-mono text-base uppercase outline-none placeholder:font-sans placeholder:normal-case placeholder:text-muted-foreground disabled:cursor-not-allowed md:text-sm"
          {...props}
        />
        {clean && result.expected && (
          <span aria-hidden className="shrink-0 pr-3 text-xs text-muted-foreground tabular-nums">
            {clean.length}/{result.expected}
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
                {fixLabel && (
                  <button type="button" onClick={applyFix} className={cn(fixClass, result.code !== "swapped" && "font-mono")}>
                    {fixLabel}
                  </button>
                )}
              </p>
              {at.length > 0 && (
                <p aria-hidden className="w-fit rounded-md bg-amber-500/10 px-2 py-1 font-mono text-amber-950 dark:text-amber-100">
                  {marked}
                </p>
              )}
            </div>
          </div>
        ) : result.status === "valid" ? (
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 py-1 text-emerald-700 dark:text-emerald-400">
            <CircleCheck aria-hidden className="size-3.5 shrink-0" />
            <span className="min-w-0 flex-1">
              <span className="font-medium">{result.facts.join(" · ")}</span>
              <span className="text-muted-foreground"> · {validText}</span>
            </span>
            {kind === "vat" && (
              <a
                href="https://ec.europa.eu/taxation_customs/vies/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded-sm font-medium underline-offset-2 hover:underline outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                {text.vies}
                <ExternalLink aria-hidden className="size-3" />
              </a>
            )}
          </p>
        ) : hint ? (
          <p className="py-1 text-muted-foreground">{hint}</p>
        ) : null}
      </div>
    </div>
  )
}
