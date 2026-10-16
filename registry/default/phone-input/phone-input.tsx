"use client"

// Bollard UI — phone-input · MIT licence · https://bollard-ui.vercel.app/components/phone-input

import * as React from "react"
import { isSupportedCountry, parsePhoneNumberFromString, type CountryCode, type NumberType } from "libphonenumber-js/max"
import { Check, ChevronDown, TriangleAlert, WandSparkles } from "lucide-react"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"

import { cn } from "@/lib/utils"

import { PHONE_COUNTRIES, type PhoneCountry, type PhoneCountryCode } from "./phone-countries"

export { PHONE_COUNTRIES, parsePhoneCountries, type PhoneCountry, type PhoneCountryCode } from "./phone-countries"

/** Built-in codes to offer (in any order), or your own table keyed by code. */
export type PhoneCountryList<C extends string = PhoneCountryCode> = readonly C[] | Record<C, PhoneCountry>

const ALL = PHONE_COUNTRIES as Record<string, PhoneCountry>

/** Turns a `countries` prop into a table. Codes that aren't built in are skipped; an empty list means all. */
export function resolveCountries<C extends string = PhoneCountryCode>(list?: PhoneCountryList<C>): Record<C, PhoneCountry> {
  const table = {} as Record<C, PhoneCountry>
  if (list && !Array.isArray(list)) Object.assign(table, list)
  else for (const code of (list ?? []) as readonly C[]) if (ALL[code]) table[code] = ALL[code]
  return Object.keys(table).length ? table : (ALL as Record<C, PhoneCountry>)
}

/** Groups national digits for display, e.g. 9876543210 → "98765 43210" for India. */
export function formatNational(digits: string, groups: number[]) {
  const parts: string[] = []
  let rest = digits
  for (const size of groups) {
    if (!rest) break
    parts.push(rest.slice(0, size))
    rest = rest.slice(size)
  }
  return [...parts, rest].filter(Boolean).join(" ")
}

/** Every user-visible string, so the field can be translated. */
export const PHONE_MESSAGES = {
  removedParenZero: "Removed the (0) that's only dialled at home",
  /** `shared` is true when other countries use the same code and the number didn't say which. */
  switched: (dial: string, country: string, shared: boolean) =>
    `Detected +${dial}, switched to ${country}${shared ? ` (other countries share +${dial}, so check it)` : ""}`,
  removedTrunk: (trunk: string, dial: string) => `Removed the leading ${trunk}, which isn't dialled with +${dial}`,
  removedDoubleCode: (dial: string) => `Removed +${dial}, which was entered twice`,
  unknownCode: "That country code isn't on the list. Pick the country and enter the local number.",
  wrongLength: (country: string, digits: string, dial: string, length: number, missing: number) =>
    `${country} numbers have ${digits} digits after +${dial}; this has ${length} (${missing > 0 ? `${missing} missing` : `${-missing} extra`}).`,
  /** The length fits but no real number in that country starts this way. */
  notAssigned: (country: string) => `The digit count is right, but no ${country} number starts like this. Check the first digits.`,
  /** `kind` is one of the `kinds` labels below. */
  notMobile: (kind: string) => `That's a ${kind.toLowerCase()} number, so it can't receive texts or OTPs. Use a mobile number.`,
  premium: "Premium-rate number: calls to it are charged extra. Is that really the contact number?",
  /** Short labels for the line type shown after the read-back. */
  kinds: {
    MOBILE: "Mobile",
    FIXED_LINE: "Landline",
    FIXED_LINE_OR_MOBILE: "Mobile or landline",
    TOLL_FREE: "Toll-free",
    PREMIUM_RATE: "Premium rate",
    SHARED_COST: "Shared cost",
    VOIP: "VoIP",
    PERSONAL_NUMBER: "Personal number",
    PAGER: "Pager",
    UAN: "Company number",
    VOICEMAIL: "Voicemail",
  } as Record<NumberType & string, string>,
}
export type PhoneMessages = typeof PHONE_MESSAGES

/** What the number really is, from Google's libphonenumber data: whether it's assigned and its line type. */
export interface PhoneDetails {
  /** False when the length fits but the digits match no real numbering range. `null` when the country has no metadata. */
  valid: boolean | null
  /** MOBILE, FIXED_LINE, TOLL_FREE, PREMIUM_RATE... or undefined when unknown. */
  type?: NumberType
}

/** Checks an E.164 number for a real numbering range and line type. Never throws. */
export function describePhone(e164: string | null, country: string): PhoneDetails {
  if (!e164 || !isSupportedCountry(country)) return { valid: null }
  try {
    const parsed = parsePhoneNumberFromString(e164, country as CountryCode)
    if (!parsed) return { valid: null }
    const valid = parsed.isValid()
    return { valid, type: valid ? parsed.getType() : undefined }
  } catch {
    return { valid: null }
  }
}

const leadCache = new Map<string, RegExp>()
const startsWithLead = (pattern: string, digits: string) => {
  if (!leadCache.has(pattern)) leadCache.set(pattern, new RegExp(`^(?:${pattern})`))
  return leadCache.get(pattern)!.test(digits)
}

/**
 * Cleans up a typed or pasted number: separators, a "(0)", a 00 or + prefix (which can switch
 * the country, using area codes to tell +1 Canada or Jamaica from the US), a country code entered
 * twice and a domestic trunk prefix. Each fix is described, and `e164` is the number to store, or
 * null while it isn't a valid length. `countries` defaults to every built-in country.
 */
export function normalizePhone<C extends string = PhoneCountryCode>(
  raw: string,
  selected: C,
  messages: Partial<PhoneMessages> = {},
  countries?: PhoneCountryList<C>,
) {
  const table = resolveCountries(countries)
  const codes = Object.keys(table) as C[]
  const say = { ...PHONE_MESSAGES, ...messages }
  const notes: string[] = []
  let country: C = selected in table ? selected : codes[0]
  let text = raw.normalize("NFKC")
  if (/\(0\)/.test(text)) {
    text = text.replace(/\(0\)/g, "")
    notes.push(say.removedParenZero)
  }
  let digits = text.replace(/\D/g, "")
  if (/^\s*(\+|00)/.test(text)) {
    if (!text.trim().startsWith("+")) digits = digits.slice(2)
    // Longest dial code wins; within a shared code: an area-code match, then the selected country, then the first listed.
    const rank = (code: C) => {
      const { dial, leading } = table[code]
      if (leading) return startsWithLead(leading, digits.slice(dial.length)) ? 3 : 0
      return code === country ? 2 : 1
    }
    const candidates = codes.filter((code) => digits.startsWith(table[code].dial) && digits.length - table[code].dial.length >= 4)
    const match = candidates.sort((a, b) => table[b].dial.length - table[a].dial.length || rank(b) - rank(a))[0]
    if (!match) return { country, national: digits, notes, unknownCode: true, e164: null }
    const { dial, name } = table[match]
    // Only call it shared when another country with this code has no area-code pattern to rule it out.
    const shared = rank(match) < 3 && candidates.some((code) => code !== match && table[code].dial === dial && !table[code].leading)
    if (match !== country) notes.push(say.switched(dial, name, shared))
    country = match
    digits = digits.slice(dial.length)
  }
  const { dial, lengths, trunk } = table[country]
  const fits = (n: number) => n >= lengths[0] && n <= lengths[1]
  // Strip a repeated country code and/or trunk prefix, but only when that lands on a valid length.
  let candidate = digits
  const fixes: string[] = []
  for (let pass = 0; pass < 3 && !fits(candidate.length); pass++) {
    const strip = [`00${dial}`, dial, trunk].find((p) => p && candidate.startsWith(p) && candidate.length - p.length >= lengths[0])
    if (!strip) break
    candidate = candidate.slice(strip.length)
    fixes.push(strip === trunk ? say.removedTrunk(trunk, dial) : say.removedDoubleCode(dial))
  }
  if (fits(candidate.length)) {
    digits = candidate
    notes.push(...fixes)
  }
  return { country, national: digits, notes, unknownCode: false, e164: fits(digits.length) ? `+${dial}${digits}` : null }
}

export interface PhoneInputProps<C extends string = PhoneCountryCode>
  extends Omit<React.ComponentProps<"input">, "value" | "defaultValue" | "onChange" | "type"> {
  /** Visible label. */
  label?: string
  /** Helper text shown under the field while it is empty. */
  hint?: string
  /** Controlled text in the number field. */
  value?: string
  /** Initial text when uncontrolled; it is tidied on mount like a paste. */
  defaultValue?: string
  /** Called with the field's text on every change. */
  onValueChange?: (value: string) => void
  /** Called with the E.164 number (+919876543210), or `null` while it isn't a valid length, plus its line type and range check. */
  onNumberChange?: (e164: string | null, country: C, details: PhoneDetails) => void
  /** `mobile` warns when the number is a landline, toll-free or premium line (an SMS/OTP field). Default `any`. */
  expect?: "mobile" | "any"
  /** Controlled country. A typed or pasted +code still reports its country through `onCountryChange`. */
  country?: C
  /** Country selected before anything is typed (uncontrolled). Falls back to the first country offered. */
  defaultCountry?: C
  /** Called when the country changes, from the picker or a detected dial code. */
  onCountryChange?: (country: C) => void
  /** Countries to offer: built-in codes (`["IN", "US"]`) or your own table. Defaults to all 245 built in. */
  countries?: PhoneCountryList<C>
  /** Codes pinned to the top of the picker, in this order. */
  preferredCountries?: readonly C[]
  /** BCP 47 locale for country names and their order (e.g. "de"). Defaults to the English names in the data. */
  locale?: string
  /** Accessible label of the country picker. */
  countryLabel?: string
  /** Text before the read-back of the stored number. */
  savesAsLabel?: string
  /** Override the clean-up notes and warnings (see `PHONE_MESSAGES`). */
  messages?: Partial<PhoneMessages>
}

const groupClass =
  "flex h-9 w-full min-w-0 rounded-md border bg-transparent shadow-xs transition-[color,box-shadow] focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50 dark:bg-input/30 data-warning:border-amber-500 dark:data-warning:border-amber-400"

/** Country names in `locale`, falling back to the table's own name. */
function useCountryTable<C extends string>(countries: PhoneCountryList<C> | undefined, locale: string | undefined) {
  return React.useMemo(() => {
    const table = resolveCountries(countries)
    if (!locale) return table
    let names: Intl.DisplayNames | undefined
    try {
      names = new Intl.DisplayNames([locale], { type: "region", fallback: "none" })
    } catch {}
    const named = {} as Record<C, PhoneCountry>
    for (const code of Object.keys(table) as C[]) {
      let name: string | undefined
      try {
        name = names?.of(code)
      } catch {}
      named[code] = { ...table[code], name: name ?? table[code].name }
    }
    return named
  }, [countries, locale])
}

/**
 * A phone field that stops the classic bad saves: a doubled country code, a leading 0 kept after
 * +91, a pasted foreign number filed under the wrong country, or a digit missing. It explains
 * every clean-up it made and reads back the exact E.164 number that will be stored. Google's
 * libphonenumber data then checks the digits are a real range and names the line type, so a
 * landline in an OTP field or a premium-rate number gets caught before it is saved.
 */
export function PhoneInput<C extends string = PhoneCountryCode>({
  label = "Phone number",
  hint,
  value,
  defaultValue = "",
  onValueChange,
  onNumberChange,
  country: countryProp,
  defaultCountry = "IN" as C,
  onCountryChange,
  countries,
  preferredCountries,
  locale,
  messages,
  countryLabel = "Country",
  savesAsLabel = "Saves as",
  expect = "any",
  id,
  className,
  onBlur,
  onPaste,
  "aria-describedby": describedBy,
  ...props
}: PhoneInputProps<C>) {
  const reduce = useReducedMotion()
  const say = { ...PHONE_MESSAGES, ...messages }
  const table = useCountryTable(countries, locale)
  const normalize = (raw: string, selected: C) => normalizePhone(raw, selected, messages, table)
  const [initial] = React.useState(() => normalize(defaultValue, countryProp ?? defaultCountry))
  const [innerCountry, setInnerCountry] = React.useState<C>(initial.country)
  const country = countryProp ?? innerCountry
  const [inner, setInner] = React.useState(() =>
    !defaultValue || initial.unknownCode ? defaultValue : formatNational(initial.national, table[initial.country].groups),
  )
  const [notes, setNotes] = React.useState(initial.notes)
  const [touched, setTouched] = React.useState(defaultValue !== "")
  const autoId = React.useId()
  const inputId = id ?? autoId
  const text = value ?? inner

  const result = normalize(text, country)
  const current = table[result.country]
  const length = result.national.length
  const [min, max] = current.lengths

  const options = React.useMemo(() => {
    const sorted = (Object.keys(table) as C[]).sort((a, b) => table[a].name.localeCompare(table[b].name, locale ?? "en"))
    return { pinned: (preferredCountries ?? []).filter((code) => code in table), sorted }
  }, [table, preferredCountries, locale])

  /** Applies new text; `tidy` reformats it and shows what was cleaned (paste, blur, country change). */
  const commit = (nextText: string, nextCountry: C, tidy: boolean) => {
    const next = normalize(nextText, nextCountry)
    const switched = !next.unknownCode && (next.country !== nextCountry || /^\s*(\+|00)/.test(nextText))
    const shown = (tidy || switched) && !next.unknownCode && next.national ? formatNational(next.national, table[next.country].groups) : nextText
    if (countryProp === undefined) setInnerCountry(next.country)
    if (next.country !== country) onCountryChange?.(next.country)
    setNotes(tidy || switched ? next.notes : [])
    if (value === undefined) setInner(shown)
    onValueChange?.(shown)
    onNumberChange?.(next.e164, next.country, describePhone(next.e164, next.country))
  }

  const details = describePhone(result.e164, result.country)
  const kinds = { ...PHONE_MESSAGES.kinds, ...messages?.kinds }
  const kind = details.type && kinds[details.type]
  const wrongLine = expect === "mobile" && details.type && !["MOBILE", "FIXED_LINE_OR_MOBILE"].includes(details.type)
  const warning = result.unknownCode
    ? touched && say.unknownCode
    : !result.e164
      ? length > 0 && (touched || length > max) &&
        say.wrongLength(current.name, min === max ? String(min) : `${min}–${max}`, current.dial, length, length < min ? min - length : max - length)
      : details.valid === false
        ? touched && say.notAssigned(current.name)
        : details.type === "PREMIUM_RATE"
          ? say.premium
          : wrongLine && kind
            ? say.notMobile(kind)
            : false
  const reveal = reduce
    ? { initial: false, animate: { opacity: 1 }, exit: { opacity: 0 } }
    : {
        initial: { opacity: 0, height: 0, y: -4 },
        animate: { opacity: 1, height: "auto", y: 0 },
        exit: { opacity: 0, height: 0 },
        transition: { type: "spring", stiffness: 420, damping: 34 },
      } as const

  const option = (code: C, key = code as string) => (
    <option key={key} value={code}>{`${table[code].name} +${table[code].dial}`}</option>
  )

  return (
    <div data-slot="phone-input" className={cn("grid w-full max-w-sm gap-1.5", className)}>
      <label htmlFor={inputId} className="w-fit text-sm font-medium">{label}</label>
      <div className={groupClass} data-warning={warning ? "" : undefined}>
        {/* The native select keeps mobile pickers and type-to-find; the visible face stays a compact "IN +91". */}
        <div className="relative flex shrink-0 items-center gap-1 rounded-l-md border-r pr-1.5 pl-2.5 text-sm has-[select:focus-visible]:bg-accent">
          <span aria-hidden className="font-medium">{result.country}</span>
          <span aria-hidden className="text-muted-foreground tabular-nums">+{current.dial}</span>
          <ChevronDown aria-hidden className="size-3.5 text-muted-foreground" />
          <select
            aria-label={countryLabel}
            value={result.country}
            onChange={(event) => commit(text, event.target.value as C, true)}
            className="absolute inset-0 cursor-pointer appearance-none opacity-0 outline-none dark:[color-scheme:dark]"
          >
            {options.pinned.map((code) => option(code, `pinned-${code}`))}
            {options.pinned.length > 0 && <option disabled>──────────</option>}
            {options.sorted.map((code) => option(code))}
          </select>
        </div>
        <input
          id={inputId}
          type="tel"
          inputMode="tel"
          autoComplete="tel-national"
          value={text}
          placeholder={formatNational("9".repeat(max), current.groups)}
          aria-invalid={!!warning || undefined}
          aria-describedby={cn(`${inputId}-hint`, describedBy)}
          onChange={(event) => commit(event.target.value, country, false)}
          onPaste={(event) => {
            onPaste?.(event)
            const input = event.currentTarget
            event.preventDefault()
            const pasted = event.clipboardData.getData("text")
            commit(text.slice(0, input.selectionStart ?? 0) + pasted + text.slice(input.selectionEnd ?? text.length), country, true)
          }}
          onBlur={(event) => {
            setTouched(true)
            if (text) commit(text, country, true)
            onBlur?.(event)
          }}
          className="h-full min-w-0 flex-1 bg-transparent px-3 font-mono text-base tabular-nums outline-none placeholder:text-muted-foreground md:text-sm"
          {...props}
        />
      </div>
      <div id={`${inputId}-hint`} aria-live="polite" className="min-h-6 overflow-hidden text-xs">
        <AnimatePresence initial={false}>
          {result.e164 && (
            <motion.p key="saves" {...reveal} className={cn("flex flex-wrap items-center gap-x-1.5 py-1", details.valid === false || warning ? "text-muted-foreground" : "text-emerald-700 dark:text-emerald-400")}>
              <Check aria-hidden className="size-3.5 shrink-0" />
              {savesAsLabel}
              <motion.span layout={!reduce} className="font-mono font-semibold">+{current.dial} {formatNational(result.national, current.groups)}</motion.span>
              <span className="text-muted-foreground">({current.name}{kind ? ` · ${kind}` : ""})</span>
            </motion.p>
          )}
          {warning && (
            <motion.p key={`warn-${warning}`} {...reveal} className="flex gap-1.5 py-1 text-amber-700 dark:text-amber-400">
              <TriangleAlert aria-hidden className="mt-px size-3.5 shrink-0" />
              <span>{warning}</span>
            </motion.p>
          )}
          {notes.map((note, index) => (
            <motion.p
              key={note}
              {...reveal}
              transition={reduce ? undefined : { type: "spring", stiffness: 420, damping: 34, delay: index * 0.06 }}
              className="flex gap-1.5 py-0.5 text-muted-foreground"
            >
              <WandSparkles aria-hidden className="mt-px size-3.5 shrink-0" />
              <span>{note}</span>
            </motion.p>
          ))}
        </AnimatePresence>
        {!text && hint && <p className="py-1 text-muted-foreground">{hint}</p>}
      </div>
    </div>
  )
}
