"use client"

// Bollard UI — address-check · MIT licence · https://bollard-ui.vercel.app/components/address-check

import * as React from "react"
import { LoaderCircle, MapPinOff, PackageX, Tag } from "lucide-react"

import { cn } from "@/lib/utils"
import {
  COUNTRIES,
  checkPostcode,
  findAddressIssues,
  formatLabel,
  type Address,
  type AddressField,
  type AddressIssue,
  type PostcodePlace,
} from "./address-rules"

export * from "./address-rules"

const fill = (template: string, values: Record<string, string>) => template.replace(/\{(\w+)\}/g, (m, k: string) => values[k] ?? m)

const fieldClass =
  "h-9 w-full min-w-0 rounded-md border bg-transparent px-3 text-base shadow-xs transition-[color,box-shadow] outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 md:text-sm dark:bg-input/30 data-warning:border-amber-500 dark:data-warning:border-amber-400"
const fixClass =
  "inline-flex h-6 items-center gap-1 rounded-md border border-amber-500/40 px-2 font-medium text-amber-900 transition-colors hover:bg-amber-500/10 dark:text-amber-200 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
const EMPTY: Address = { country: "IN", line1: "", line2: "", city: "", region: "", postcode: "" }

export interface AddressCheckProps extends Omit<React.ComponentProps<"fieldset">, "defaultValue" | "onChange"> {
  /** Controlled address. */
  value?: Address
  /** Initial address when uncontrolled. */
  defaultValue?: Partial<Address>
  /** Called with the whole address on every change. */
  onValueChange?: (value: Address) => void
  /** Looks up where a postcode is. Resolve null when unknown; rejections are ignored. */
  lookupPostcode?: (country: string, postcode: string, signal: AbortSignal) => Promise<PostcodePlace | null>
  /** Country codes offered in the picker, from the built-in rules. */
  countries?: string[]
  /** Labels and placeholders. */
  line1Label?: string
  /** Placeholder for the first address line. */
  line1Placeholder?: string
  /** Label for the second address line. */
  line2Label?: string
  /** Placeholder for the second address line. */
  line2Placeholder?: string
  /** Label for the city field. */
  cityLabel?: string
  /** Heading above the printed-label readback. */
  labelHeading?: string
  /** Messages. `{city}`, `{typed}`, `{postcode}`, `{label}`, `{example}`, `{country}` are filled in. */
  noNumberMessage?: string
  /** Text for dismissing the missing-number warning. */
  noNumberDismissLabel?: string
  /** Warning for PO box addresses. */
  poBoxMessage?: string
  /** Message offering the corrected postcode. */
  postcodeFixMessage?: string
  /** Message when the postcode fits another country. */
  otherCountryMessage?: string
  /** Message when the postcode doesn't fit the country. */
  invalidPostcodeMessage?: string
  /** Message when the city doesn't match the postcode. */
  cityMismatchMessage?: string
  /** Message when the city is empty but the postcode is known. */
  cityMissingMessage?: string
}

/**
 * A postal address block that catches what makes parcels come back: no house
 * or flat number, a postcode that doesn't fit the country (or fits another one),
 * a city that the postcode lookup says is elsewhere, and PO boxes couriers can't
 * reach. It prints a live label of exactly what the courier will see, with the
 * weak spots marked, and every fix is one tap, never automatic.
 */
export function AddressCheck({
  value,
  defaultValue,
  onValueChange,
  lookupPostcode,
  countries = Object.keys(COUNTRIES),
  line1Label = "Flat / house no., building, street",
  line1Placeholder = "B-204, Sai Residency, Baner Road",
  line2Label = "Area, landmark (optional)",
  line2Placeholder = "Near Balewadi High Street",
  cityLabel = "City",
  labelHeading = "Will print as",
  noNumberMessage = "No flat or house number. Couriers may not find the door.",
  noNumberDismissLabel = "It has none",
  poBoxMessage = "Couriers can't deliver to a PO box. Use a street address.",
  postcodeFixMessage = "{label} should be written {fixed}.",
  otherCountryMessage = "That looks like a {country} postcode.",
  invalidPostcodeMessage = "{label} should be {example}.",
  cityMismatchMessage = "{postcode} is in {city}, not {typed}.",
  cityMissingMessage = "{postcode} is in {city}.",
  className,
  ...props
}: AddressCheckProps) {
  const [inner, setInner] = React.useState<Address>({ ...EMPTY, ...defaultValue })
  const [focused, setFocused] = React.useState<keyof Address>()
  const [noNumberOk, setNoNumberOk] = React.useState(false)
  const [places, setPlaces] = React.useState<Record<string, PostcodePlace | null>>({})
  const [loading, setLoading] = React.useState(false)
  const rootRef = React.useRef<HTMLFieldSetElement>(null)
  const id = React.useId()
  const address = value ?? inner
  const rule = COUNTRIES[address.country]
  const key = `${address.country}:${address.postcode.trim()}`
  const postcodeOk = checkPostcode(address.country, address.postcode).status === "ok"

  React.useEffect(() => {
    if (!lookupPostcode || !postcodeOk || key in places) return
    const controller = new AbortController()
    const timer = setTimeout(() => {
      setLoading(true)
      lookupPostcode(address.country, address.postcode.trim(), controller.signal)
        .then((place) => setPlaces((all) => ({ ...all, [key]: place })))
        .catch(() => {})
        .finally(() => !controller.signal.aborted && setLoading(false))
    }, 300)
    return () => {
      clearTimeout(timer)
      controller.abort()
      setLoading(false)
    }
  }, [key, postcodeOk, lookupPostcode, places, address.country, address.postcode])

  const update = (patch: Partial<Address>) => {
    const next = { ...address, ...patch }
    if (value === undefined) setInner(next)
    onValueChange?.(next)
  }

  /** Applies a one-tap fix and flashes the field and label line it changed. */
  const apply = (patch: Partial<Address>) => {
    update(patch)
    requestAnimationFrame(() => {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return
      for (const field of Object.keys(patch)) {
        rootRef.current?.querySelectorAll(`[data-flash~="${field}"]`).forEach((el) =>
          el.animate([{ backgroundColor: "rgb(245 158 11 / 0.3)" }, { backgroundColor: "transparent" }], { duration: 400, easing: "ease-out" }),
        )
      }
    })
  }

  const place = postcodeOk ? places[key] : undefined
  const issues = findAddressIssues(address, place).filter((issue) => !(issue.kind === "no-number" && noNumberOk))
  const visible = (field: AddressField) =>
    issues.filter((issue) => issue.field === field && (issue.kind === "po-box" || focused !== field) && !(issue.kind === "no-number" && focused === "line2"))
  const values = (extra: Record<string, string> = {}) => ({
    postcode: address.postcode.trim(), typed: address.city.trim(), label: rule?.postcodeLabel ?? "postcode", example: rule?.example ?? "", ...extra,
  })

  const message = (issue: AddressIssue): [React.ReactNode, React.ReactNode?] => {
    if (issue.kind === "po-box") return [poBoxMessage]
    if (issue.kind === "no-number") return [noNumberMessage, <button type="button" className={fixClass} onClick={() => setNoNumberOk(true)}>{noNumberDismissLabel}</button>]
    if (issue.kind === "city") {
      const { city, region } = issue.place
      const patch = { city, ...(region && region !== address.region ? { region } : {}) }
      return [fill(address.city.trim() ? cityMismatchMessage : cityMissingMessage, values({ city })), <button type="button" className={fixClass} onClick={() => apply(patch)}>Use {city}</button>]
    }
    const { check } = issue
    if (check.status === "fixable") return [fill(postcodeFixMessage, values({ fixed: check.fixed })), <button type="button" className={fixClass} onClick={() => apply({ postcode: check.fixed })}>Use {check.fixed}</button>]
    if (check.status === "other-country") {
      const other = COUNTRIES[check.country]
      const fixed = other.normalize ? other.normalize(address.postcode) : address.postcode
      return [fill(otherCountryMessage, values({ country: other.name })), <button type="button" className={fixClass} onClick={() => apply({ country: check.country, postcode: fixed })}>Switch to {other.name}</button>]
    }
    return [fill(invalidPostcodeMessage, values())]
  }

  const warnings = (field: AddressField) => (
    <div id={`${id}-${field}-hint`} aria-live="polite" className="text-xs empty:hidden">
      {visible(field).map((issue) => {
        const [text, fix] = message(issue)
        const Icon = issue.kind === "po-box" ? PackageX : MapPinOff
        return (
          <p key={issue.kind} className="flex gap-1.5 text-amber-700 motion-safe:animate-[cui-address-check-in_200ms_ease-out] dark:text-amber-400">
            <span className="flex h-6 shrink-0 items-center"><Icon aria-hidden className="size-3.5" /></span>
            <span className="flex min-w-0 flex-wrap items-center gap-x-2"><span className="py-1">{text}</span>{fix}</span>
          </p>
        )
      })}
    </div>
  )

  const input = (field: AddressField, label: string, extra: React.ComponentProps<"input"> = {}) => (
    <div className="grid min-w-0 content-start gap-1.5">
      <label htmlFor={`${id}-${field}`} className="w-fit text-sm font-medium">{label}</label>
      <input
        id={`${id}-${field}`}
        value={address[field]}
        onChange={(e) => update({ [field]: e.target.value })}
        onFocus={() => setFocused(field)}
        onBlur={() => setFocused(undefined)}
        aria-describedby={`${id}-${field}-hint`}
        data-warning={visible(field).length ? "" : undefined}
        data-flash={field}
        className={fieldClass}
        {...extra}
      />
      {field !== "city" && field !== "postcode" && warnings(field)}
    </div>
  )

  const label = formatLabel(address)
  const flagged = new Set<string>(issues.filter((issue) => issue.kind !== "no-number").map((issue) => issue.field))

  return (
    <fieldset ref={rootRef} data-slot="address-check" className={cn("grid w-full max-w-sm min-w-0 gap-3", className)} {...props}>
      <style>{"@keyframes cui-address-check-in{from{opacity:0;transform:translateY(-3px)}}"}</style>
      <div className="grid gap-1.5">
        <label htmlFor={`${id}-country`} className="w-fit text-sm font-medium">Country</label>
        <select id={`${id}-country`} value={address.country} onChange={(e) => update({ country: e.target.value })} data-flash="country" className={cn(fieldClass, "bg-background pr-8")}>
          {countries.map((code) => <option key={code} value={code}>{COUNTRIES[code]?.name ?? code}</option>)}
        </select>
      </div>
      {input("line1", line1Label, { placeholder: line1Placeholder, autoComplete: "address-line1" })}
      {input("line2", line2Label, { placeholder: line2Placeholder, autoComplete: "address-line2" })}
      <div className="grid grid-cols-2 gap-3">
        {input("city", cityLabel, { autoComplete: "address-level2" })}
        {input("region", rule?.regionLabel ?? "Region", { autoComplete: "address-level1" })}
        {rule?.postcodeLabel !== null && (
          <div className="relative">
            {input("postcode", rule?.postcodeLabel ?? "Postcode", { autoComplete: "postal-code", autoCapitalize: "characters", spellCheck: false })}
            {loading && <LoaderCircle aria-label="Checking postcode" className="absolute right-2.5 bottom-2.5 size-4 animate-spin text-muted-foreground" />}
          </div>
        )}
      </div>
      {(visible("postcode").length > 0 || visible("city").length > 0) && (
        <div className="-mt-1.5">{warnings("postcode")}{warnings("city")}</div>
      )}
      <figure className="rounded-lg border border-dashed bg-muted/40 p-3">
        <figcaption className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <Tag aria-hidden className="size-3.5" /> {labelHeading}
        </figcaption>
        <address className="grid gap-0.5 font-mono text-xs leading-5 not-italic">
          {label.length < 2 ? <span className="text-muted-foreground">—</span> : label.map((line, index) => (
            <span key={index} data-flash={line.fields.join(" ")} className={cn("w-fit rounded-sm px-1 -mx-1 break-words", line.fields.some((field) => flagged.has(field)) && "underline decoration-amber-500 decoration-wavy underline-offset-4")}>
              {line.fields[0] === "line1" && issues.some((i) => i.kind === "no-number") && (
                <span className="mr-1 rounded-sm bg-amber-500/20 px-1 text-amber-800 dark:text-amber-300">No.?</span>
              )}
              {line.text}
            </span>
          ))}
        </address>
      </figure>
    </fieldset>
  )
}
