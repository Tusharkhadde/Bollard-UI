"use client"

import * as React from "react"
import { CircleAlert, LoaderCircle, MapPin, RotateCw, TriangleAlert } from "lucide-react"

import { cn } from "@/lib/utils"
import { findPostcodeProblem, normalizePostcode, pinRegion, POSTCODE_SHAPES, sameCity, sameState, type PinPlace, type PostcodeProblem } from "./pincode"

export * from "./pincode"

/** Default messages. `{pin}`, `{fixed}`, `{length}`, `{prefix}`, `{name}`, `{label}`, `{state}`, `{typed}`, `{city}`, `{count}` are filled in. */
export const PINCODE_MESSAGES = {
  "letter-digit": "That has a letter where a digit should be (O for 0, I for 1).",
  "extra-text": "There's other text around the PIN.",
  length: "PIN codes have 6 digits. This one has {length}.",
  "leading-zero": "No PIN code starts with 0.",
  unassigned: "No PIN code starts with {prefix}. Check the first two digits.",
  army: "PINs starting with 9 are only for the Army Postal Service.",
  "other-country": "That looks like a {name} {label}, not an Indian PIN.",
  invalid: "That doesn't look like a postcode for this country.",
  "no-postcodes": "The UAE doesn't use postcodes. You can leave this empty.",
  useFixed: "Use {fixed}",
  switchCountry: "Switch country",
  inState: "{prefix}… is in {state}",
  stateMismatch: "{pin} is in {state}, but the state says {typed}.",
  useState: "Use {state}",
  cityMismatch: "{pin} is in {city}, not {typed}.",
  useCity: "Use {city}",
  checking: "Finding the area…",
  failed: "Couldn't look up this PIN.",
  retry: "Retry",
  notFound: "No post office uses {pin}. Check it on a recent letter or bill.",
  moreAreas: "+{count} more",
  or: "or",
}

type Lookup = { pin: string; state: "checking" } | { pin: string; state: "done"; place: PinPlace | null } | { pin: string; state: "failed" }
const fill = (s: string, d: Record<string, string>) => s.replace(/\{(\w+)\}/g, (m, k: string) => d[k] ?? m)
const fixClass =
  "inline-flex h-6 items-center gap-1 rounded-md border border-amber-500/40 px-2 font-medium whitespace-nowrap text-amber-900 transition-colors hover:bg-amber-500/10 dark:text-amber-200 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"

export interface PincodeInputProps extends Omit<React.ComponentProps<"input">, "value" | "defaultValue" | "onChange"> {
  /** Visible label. */
  label?: string
  /** Controlled code (other-script digits converted, spaces removed for India). */
  value?: string
  /** Initial code when uncontrolled. */
  defaultValue?: string
  /** Called with the cleaned code on every change. */
  onValueChange?: (value: string) => void
  /** ISO country the address is in. India gets full PIN checks; others get a shape check. */
  country?: string
  /** Offered as a one-tap switch when the code looks like it belongs to another country. */
  onCountryChange?: (country: string) => void
  /** The state picked elsewhere in the form, checked against the PIN. */
  state?: string
  /** Lets the user take the PIN's state in one tap. */
  onUseState?: (state: string) => void
  /** The city typed elsewhere in the form, checked against the lookup. */
  city?: string
  /** Lets the user take the PIN's district in one tap. */
  onUseCity?: (city: string) => void
  /** Finds where a complete Indian PIN is. Resolve null when no post office has it. See createIndiaPostLookup. */
  lookup?: (pin: string, signal: AbortSignal) => Promise<PinPlace | null>
  /** Called with the place once found, or null when the PIN changes or isn't found. */
  onPlaceChange?: (place: PinPlace | null) => void
  /** Override any message or label. */
  messages?: Partial<typeof PINCODE_MESSAGES>
}

/**
 * A PIN code field that stops parcels going to the wrong place. It reads the
 * state from the PIN's first digits as you type (no network needed) and warns
 * when it disagrees with the state picked, catches O typed for 0, a wrong
 * length, prefixes no PIN uses, Army Post codes and a ZIP or UK postcode typed
 * for India, then reads the area back from your lookup and checks the city.
 */
export function PincodeInput({
  label = "PIN code",
  value,
  defaultValue = "",
  onValueChange,
  country = "IN",
  onCountryChange,
  state,
  onUseState,
  city,
  onUseCity,
  lookup,
  onPlaceChange,
  messages,
  id,
  className,
  onBlur,
  ref,
  "aria-describedby": describedBy,
  ...props
}: PincodeInputProps) {
  const t = { ...PINCODE_MESSAGES, ...messages }
  const india = country === "IN"
  const clean = React.useCallback((raw: string) => (india ? normalizePostcode(raw).replace(/[\s-]/g, "") : normalizePostcode(raw).toUpperCase()), [india])
  const [inner, setInner] = React.useState(() => clean(defaultValue))
  // The value being typed right now. Anything else (prefilled, autofilled, set by code) is checked as complete.
  const [typing, setTyping] = React.useState<string | null>(null)
  const [result, setResult] = React.useState<Lookup>()
  const [attempt, setAttempt] = React.useState(0)
  const inputRef = React.useRef<HTMLInputElement>(null)
  React.useImperativeHandle(ref, () => inputRef.current as HTMLInputElement)
  const autoId = React.useId()
  const inputId = id ?? autoId
  const code = value ?? inner
  const complete = india && /^[1-8]\d{5}$/.test(code)
  const lookupRef = React.useRef(lookup)
  const placeRef = React.useRef(onPlaceChange)
  React.useEffect(() => {
    lookupRef.current = lookup
    placeRef.current = onPlaceChange
  })

  React.useEffect(() => {
    if (!complete || !lookupRef.current) return
    const controller = new AbortController()
    const timer = setTimeout(() => {
      setResult({ pin: code, state: "checking" })
      lookupRef.current!(code, controller.signal).then(
        (place) => {
          if (controller.signal.aborted) return
          setResult({ pin: code, state: "done", place })
          placeRef.current?.(place)
        },
        () => !controller.signal.aborted && setResult({ pin: code, state: "failed" })
      )
    }, 250)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [code, complete, attempt])

  const update = (raw: string) => {
    const next = clean(raw).slice(0, 120)
    if (value === undefined) setInner(next)
    if (next !== code) placeRef.current?.(null)
    onValueChange?.(next)
    return next
  }

  const current = result?.pin === code ? result : undefined
  const place = current?.state === "done" ? current.place : undefined
  const problem: PostcodeProblem | null = findPostcodeProblem(code, country, typing !== code || code.length >= 6)
  const region = india && !problem ? pinRegion(code) : null
  const pinStates = place ? [place.state] : region?.kind === "state" ? region.states : []
  const stateOff = !!state && pinStates.length > 0 && !pinStates.some((s) => sameState(s, state))
  const cityOff = !!city && !!place && !sameCity(city, place)
  const d: Record<string, string> = { pin: code, typed: "", prefix: code.slice(0, india ? 3 : 2), state: pinStates.join(` ${t.or} `) }
  if (problem?.kind === "letter-digit" || problem?.kind === "extra-text") d.fixed = problem.fixed
  if (problem?.kind === "length") d.length = String(problem.length)
  if (problem?.kind === "unassigned") d.prefix = problem.prefix
  if (problem?.kind === "other-country") Object.assign(d, POSTCODE_SHAPES[problem.country] ?? { name: "Indian", label: "PIN code" })

  const warn = (key: string, text: React.ReactNode, action?: React.ReactNode) => (
    <p key={key} className="flex gap-1.5 text-amber-700 dark:text-amber-400">
      <span className="flex h-6 shrink-0 items-center"><TriangleAlert aria-hidden className="size-3.5" /></span>
      <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1"><span className="py-1">{text}</span>{action}</span>
    </p>
  )

  return (
    <div data-slot="pincode-input" className={cn("grid w-full max-w-sm gap-1.5", className)}>
      <style>{`@keyframes cui-pincode-input-reveal{from{opacity:0;transform:translateY(-4px)}}`}</style>
      <label htmlFor={inputId} className="w-fit text-sm font-medium">{label}</label>
      <input
        ref={inputRef}
        id={inputId}
        autoComplete="postal-code"
        inputMode={india ? "numeric" : "text"}
        autoCorrect="off"
        spellCheck={false}
        placeholder={india ? "e.g. 411039" : undefined}
        value={code}
        onChange={(e) => setTyping(update(e.target.value))}
        onBlur={(e) => {
          setTyping(null)
          onBlur?.(e)
        }}
        aria-describedby={[`${inputId}-status`, describedBy].filter(Boolean).join(" ")}
        aria-invalid={place === null || undefined}
        data-warning={problem || stateOff ? "" : undefined}
        className="h-9 w-full min-w-0 rounded-md border bg-transparent px-3 font-mono text-base tracking-wider shadow-xs transition-[color,box-shadow] outline-none placeholder:font-sans placeholder:tracking-normal placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-destructive md:text-sm dark:bg-input/30 data-warning:border-amber-500 dark:data-warning:border-amber-400"
        {...props}
      />
      <div id={`${inputId}-status`} aria-live="polite" className="grid min-h-6 gap-1.5 text-xs">
        {problem &&
          warn(
            "problem",
            fill(t[problem.kind], d),
            problem.kind === "letter-digit" || problem.kind === "extra-text" ? (
              <button
                type="button"
                onClick={() => {
                  update(problem.fixed)
                  inputRef.current?.focus()
                }}
                className={fixClass}
              >
                {fill(t.useFixed, d)}
              </button>
            ) : problem.kind === "other-country" && onCountryChange ? (
              <button type="button" onClick={() => onCountryChange(problem.country)} className={fixClass}>{t.switchCountry}</button>
            ) : undefined
          )}
        {!problem && !complete && region?.kind === "state" && !stateOff && (
          <p className="py-1 text-muted-foreground">{fill(t.inState, d)}</p>
        )}
        {stateOff &&
          warn(
            "state",
            fill(t.stateMismatch, { ...d, typed: state! }),
            onUseState && pinStates.length === 1 && (
              <button type="button" onClick={() => onUseState(pinStates[0])} className={fixClass}>{fill(t.useState, d)}</button>
            )
          )}
        {current?.state === "checking" && (
          <p className="flex items-center gap-1.5 py-1 text-muted-foreground motion-safe:animate-pulse">
            <LoaderCircle aria-hidden className="size-3.5 animate-spin" /> {t.checking}
          </p>
        )}
        {current?.state === "failed" &&
          warn("failed", t.failed, (
            <button type="button" onClick={() => setAttempt((n) => n + 1)} className={fixClass}><RotateCw aria-hidden className="size-3" /> {t.retry}</button>
          ))}
        {place === null && (
          <div role="alert" className="flex gap-2 rounded-md border border-red-500/30 bg-red-500/10 px-2.5 py-2 text-sm text-red-900 motion-safe:animate-[cui-pincode-input-reveal_250ms_ease-out] dark:text-red-100">
            <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0 text-red-600 dark:text-red-400" />
            <p>{fill(t.notFound, d)}</p>
          </div>
        )}
        {place && (
          <div className="flex gap-2.5 rounded-md border bg-muted/40 px-3 py-2.5 text-sm motion-safe:animate-[cui-pincode-input-reveal_250ms_ease-out]">
            <MapPin aria-hidden className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            <div className="grid min-w-0 gap-0.5">
              <p className="font-medium">
                {place.district}, {place.state}
              </p>
              {!!place.areas?.length && (
                <p className="text-muted-foreground">
                  {place.areas.slice(0, 2).join(", ")}
                  {place.areas.length > 2 && ` ${fill(t.moreAreas, { count: String(place.areas.length - 2) })}`}
                </p>
              )}
            </div>
          </div>
        )}
        {cityOff &&
          warn(
            "city",
            fill(t.cityMismatch, { ...d, city: place!.district, typed: city! }),
            onUseCity && <button type="button" onClick={() => onUseCity(place!.district)} className={fixClass}>{fill(t.useCity, { city: place!.district })}</button>
          )}
      </div>
    </div>
  )
}
