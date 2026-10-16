"use client"

import * as React from "react"
import { Globe, TriangleAlert, X } from "lucide-react"

import { cn } from "@/lib/utils"
import {
  detectSeparatorSlip,
  formatNumber,
  formatNumericDate,
  formatSafeNumber,
  formatWordedDate,
  placeName,
  readDateAs,
  readNumberAs,
  sameDay,
} from "./locale-format"

export * from "./locale-format"

export interface LocaleComparison {
  /** The value as you write it. */
  here: string
  /** The same value as the reader's locale writes it. */
  there: string
  /** "1 thousand", "Mar 4, 2026": what `here` means, in words. */
  meaning: string | null
  /** What a reader in the other locale takes `here` to mean, when that is a different value. */
  misread: string | null
  /** A form neither side can misread (SI grouping, worded month), or null. */
  safe: string | null
}

/** Compares how `value` is written and read in two locales. Pure, so it runs on the server too. */
export function compareLocales(value: number | Date, authorLocale: string, readerLocale: string, options?: Intl.NumberFormatOptions): LocaleComparison {
  if (value instanceof Date) {
    const here = formatNumericDate(value, authorLocale)
    const read = readDateAs(here, readerLocale)
    const worded = formatWordedDate(value, authorLocale)
    return {
      here,
      there: formatNumericDate(value, readerLocale),
      meaning: worded,
      misread: read && !sameDay(read, value) ? formatWordedDate(read, authorLocale) : null,
      safe: worded,
    }
  }
  const here = formatNumber(value, authorLocale, options)
  const meant = readNumberAs(here, authorLocale).value
  const read = readNumberAs(here, readerLocale)
  // "1 thousand", "15 lakh": only when the words are exact and short (not "1.2345 thousand").
  const compact = new Intl.NumberFormat(authorLocale, { notation: "compact", compactDisplay: "long", maximumSignificantDigits: 21 }).formatToParts(value)
  const short = (compact.find((p) => p.type === "fraction")?.value.length ?? 0) <= 1 && compact.some((p) => p.type === "compact")
  return {
    here,
    there: formatNumber(value, readerLocale, options),
    meaning: short ? compact.map((p) => p.value).join("") : null,
    misread: read.confident && read.value !== null && read.value !== meant ? formatNumber(read.value, authorLocale) : null,
    safe: Number.isInteger(value) && Math.abs(value) >= 1000 ? formatSafeNumber(value) : null,
  }
}

const fill = (template: string, values: Record<string, string>) =>
  template.replace(/\{(\w+)\}/g, (match, key: string) => values[key] ?? match)

const fixClass =
  "inline-flex h-6 items-center gap-1 rounded-md border border-amber-500/40 px-2 font-medium text-amber-900 transition-colors hover:bg-amber-500/10 dark:text-amber-200 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
const flash = "motion-safe:animate-[cui-locale-notice-flash_400ms_ease-out]"
const keyframes = "@keyframes cui-locale-notice-flash{from{background-color:rgb(245 158 11/.35)}to{background-color:transparent}}"

export interface LocaleNoticeProps extends Omit<React.ComponentProps<"div">, "children"> {
  /** The number or date you are about to show someone. */
  value: number | Date
  /** The locale it is written in. */
  authorLocale?: string
  /** The locale of the person reading it, e.g. "de-DE". */
  readerLocale: string
  /** Number formatting (currency, fraction digits). Ignored for dates. */
  numberOptions?: Intl.NumberFormatOptions
  /** Called with a form no reader can misread ("1 000", "Mar 4, 2026"). Shows a one-tap fix when set. */
  onUseSafe?: (text: string) => void
  /** Label of the author column. `{place}` is filled in. */
  hereLabel?: string
  /** Templates: `{value}`, `{place}`, `{there}`, `{misread}`, `{safe}` are filled in. */
  misreadText?: string
  /** Shown when both locales read the value the same way. */
  sameText?: string
  /** Button text to use the unambiguous form. */
  safeLabel?: string
}

/**
 * Stops a number or date being misread across locales: "1,000" is one thousand
 * in the US but 1 in Germany, and 3/4/2026 is 4 March or 3 April depending on
 * who reads it. Shows the value both ways, says exactly what the other reader
 * would take it to mean, and offers a form neither side can flip.
 */
export function LocaleNotice({
  value,
  authorLocale = "en-US",
  readerLocale,
  numberOptions,
  onUseSafe,
  hereLabel = "Here · {place}",
  misreadText = "In {place}, {value} reads as {misread}.",
  sameText = "Reads the same in {place}.",
  safeLabel = "Write {safe}",
  className,
  ...props
}: LocaleNoticeProps) {
  const result = compareLocales(value, authorLocale, readerLocale, numberOptions)
  const values = {
    value: result.here,
    there: result.there,
    place: placeName(readerLocale, authorLocale),
    misread: result.misread ?? "",
    safe: result.safe ?? "",
  }
  const tile = "grid min-w-0 content-start gap-0.5 px-3 py-2"

  return (
    <div data-slot="locale-notice" className={cn("w-full max-w-sm text-sm", className)} {...props}>
      <style>{keyframes}</style>
      <div className="grid grid-cols-2 divide-x rounded-md border shadow-xs">
        <div className={tile}>
          <span className="text-xs break-words text-muted-foreground">{fill(hereLabel, { place: placeName(authorLocale, authorLocale) })}</span>
          <span className="truncate text-base font-medium tabular-nums">{result.here}</span>
          {result.meaning && <span className="truncate text-xs text-muted-foreground">{result.meaning}</span>}
        </div>
        <div className={cn(tile, result.misread && "bg-amber-500/5")}>
          <span className="flex gap-1 text-xs text-muted-foreground">
            <Globe aria-hidden className="mt-0.5 size-3 shrink-0" />
            <span className="min-w-0 break-words">{values.place}</span>
          </span>
          <span key={result.there} className={cn("w-fit truncate rounded-sm text-base font-medium tabular-nums", flash)}>
            {result.there}
          </span>
        </div>
      </div>
      <div aria-live="polite" className="mt-1.5 min-h-6 text-xs">
        {result.misread ? (
          <p className="flex gap-1.5 text-amber-700 dark:text-amber-400">
            <span className="flex h-6 shrink-0 items-center">
              <TriangleAlert aria-hidden className="size-3.5" />
            </span>
            <span className="flex min-w-0 flex-wrap items-center gap-x-2">
              <span className="py-1">{fill(misreadText, values)}</span>
              {onUseSafe && result.safe && (
                <button type="button" onClick={() => onUseSafe(result.safe as string)} className={fixClass}>
                  {fill(safeLabel, values)}
                </button>
              )}
            </span>
          </p>
        ) : result.here === result.there ? (
          <p className="py-1 text-muted-foreground">{fill(sameText, values)}</p>
        ) : null}
      </div>
    </div>
  )
}

export interface LocaleNumberFieldProps
  extends Omit<React.ComponentProps<"input">, "value" | "defaultValue" | "onChange" | "type"> {
  /** Visible label. */
  label?: string
  /** The locale this field parses numbers in. */
  locale?: string
  /** Controlled text. */
  value?: string
  /** Initial text when uncontrolled. */
  defaultValue?: string
  /** Called with the text and the number it parses to in `locale` (null when it doesn't). */
  onValueChange?: (text: string, parsed: number | null) => void
  /** Templates: `{value}`, `{reads}`, `{meant}`, `{suggestion}` are filled in. */
  mismatchText?: string
  /** Shown when the typed number is ambiguous. */
  ambiguousText?: string
  /** Template for what the reader's locale reads. */
  readsAsText?: string
  /** Button text to apply the suggested number. */
  fixLabel?: string
  /** Accessible label of the button that keeps the number as typed. */
  keepLabel?: string
}

const fieldClass =
  "h-9 w-full min-w-0 rounded-md border bg-transparent px-3 text-base tabular-nums shadow-xs transition-[color,box-shadow] outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 md:text-sm dark:bg-input/30 data-warning:border-amber-500 dark:data-warning:border-amber-400"

/**
 * A number field that catches the other convention's decimal mark: "1,5" in a
 * US field silently becomes 15, "1.500" could be one and a half or fifteen
 * hundred. It reads the number back and offers the corrected form in one tap.
 */
export function LocaleNumberField({
  label = "Amount",
  locale = "en-US",
  value,
  defaultValue = "",
  onValueChange,
  mismatchText = "{value} reads as {reads} here. Meant {meant}?",
  ambiguousText = "{value} reads as {reads}. Meant {meant}?",
  readsAsText = "Reads as {reads}",
  fixLabel = "Use {suggestion}",
  keepLabel = "Keep it as typed",
  id,
  className,
  ...props
}: LocaleNumberFieldProps) {
  const [inner, setInner] = React.useState(defaultValue)
  const [dismissed, setDismissed] = React.useState<string>()
  const autoId = React.useId()
  const inputId = id ?? autoId
  const text = value ?? inner

  const update = (next: string) => {
    if (value === undefined) setInner(next)
    onValueChange?.(next, readNumberAs(next, locale).value)
  }

  const slip = text !== dismissed ? detectSeparatorSlip(text, locale) : null
  const reads = readNumberAs(text, locale).value
  const values = {
    value: text.trim(),
    reads: reads === null ? "not a number" : formatNumber(reads, locale),
    meant: slip ? slip.suggestion : "",
    suggestion: slip ? slip.suggestion : "",
  }

  return (
    <div data-slot="locale-number-field" className={cn("grid w-full max-w-sm gap-1.5", className)}>
      <label htmlFor={inputId} className="w-fit text-sm font-medium">
        {label}
      </label>
      <input
        id={inputId}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        value={text}
        onChange={(event) => update(event.target.value)}
        aria-describedby={`${inputId}-hint`}
        data-warning={slip ? "" : undefined}
        className={fieldClass}
        {...props}
      />
      <div id={`${inputId}-hint`} aria-live="polite" className="min-h-6 text-xs">
        {slip ? (
          <p className="flex gap-1.5 text-amber-700 dark:text-amber-400">
            <span className="flex h-6 shrink-0 items-center">
              <TriangleAlert aria-hidden className="size-3.5" />
            </span>
            <span className="flex min-w-0 flex-wrap items-center gap-x-2">
              <span className="py-1">{fill(slip.kind === "mismatch" ? mismatchText : ambiguousText, values)}</span>
              <span className="flex items-center gap-1">
                <button type="button" onClick={() => update(slip.suggestion)} className={fixClass}>
                  {fill(fixLabel, values)}
                </button>
                <button
                  type="button"
                  onClick={() => setDismissed(text)}
                  aria-label={keepLabel}
                  title={keepLabel}
                  className="grid size-6 place-items-center rounded-md transition-colors hover:bg-amber-500/10 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                >
                  <X aria-hidden className="size-3.5" />
                </button>
              </span>
            </span>
          </p>
        ) : reads !== null && text.trim() ? (
          <p className="py-1 text-muted-foreground tabular-nums">{fill(readsAsText, values)}</p>
        ) : null}
      </div>
    </div>
  )
}
