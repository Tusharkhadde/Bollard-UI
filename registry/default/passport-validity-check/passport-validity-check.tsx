"use client"

import * as React from "react"
import { CircleCheck, CircleHelp, CircleX, ExternalLink, Stamp } from "lucide-react"

import { cn } from "@/lib/utils"
import { checkPassport, PASSPORT_RULES, toDay, type PassportCheck, type PassportDetails, type PassportRule, type Trip } from "./passport-rules"

export { addMonths, checkPassport, PASSPORT_RULES, toDay, type CheckStatus, type PassportCheck, type PassportDetails, type PassportResult, type PassportRule, type Trip } from "./passport-rules"

/** Every visible string. Templates fill in `{date}`, `{days}`, `{pages}`, `{years}`, `{rule}`, `{name}` and `{when}`. */
export const PASSPORT_VALIDITY_MESSAGES = {
  heading: "Passport check · {name}",
  expiry: "Passport expiry date",
  issued: "Date of issue",
  pages: "Blank visa pages left",
  mustLast: "Your passport must be valid until",
  ruleLine: "{rule} after the day you {when}.",
  arrive: "arrive",
  leave: "leave",
  months: "{n} months",
  days: "{n} days",
  and: " and ",
  verdict: { pass: "Your passport works for this trip", fail: "Your passport won't work for this trip", unknown: "Add your passport details to check" },
  checks: {
    validity: { pass: "Valid long enough", fail: "Expires {days} days too early", unknown: "Expiry date needed" },
    expired: { pass: "", fail: "Expired {days} days before you arrive", unknown: "" },
    issued: { pass: "Issued within {years} years", fail: "Over {years} years old by {days} days when you arrive (it turned {years} on {date})", unknown: "Issue date needed" },
    pages: { pass: "{pages} blank pages", fail: "Needs {pages} blank pages", unknown: "Check you have {pages} blank pages" },
  } as Record<PassportCheck["kind"], Record<"pass" | "fail" | "unknown", string>>,
  facing: "{pages} facing blank pages",
  shorten: "Come back by {date}",
  shortenHint: "That's the latest return this passport allows.",
  renew: "Renew it before you travel. Airlines check this at check-in and can refuse boarding.",
  tripInvalid: "Add arrival and departure dates to check.",
  tripReversed: "The departure date is before the arrival date. Check the trip dates.",
  issuedTypo: "The issue date is after you arrive. Check it against your passport.",
  official: "Check the official source",
  officialNote: "Rules change and airlines can be stricter.",
}

export type PassportValidityMessages = typeof PASSPORT_VALIDITY_MESSAGES

const fill = (template: string, values: Record<string, unknown>) => template.replace(/\{(\w+)\}/g, (m, k: string) => (values[k] === undefined ? m : String(values[k])))
const toInput = (d?: string | Date | null) => {
  const day = toDay(d)
  return day ? `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}` : ""
}
const field =
  "h-9 w-full min-w-0 rounded-md border bg-transparent px-3 text-base shadow-xs transition-[color,box-shadow] outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 md:text-sm dark:bg-input/30 aria-invalid:border-destructive"
const tones = { pass: "text-emerald-700 dark:text-emerald-400", fail: "text-red-700 dark:text-red-400", unknown: "text-muted-foreground" }
const ICONS = { pass: CircleCheck, fail: CircleX, unknown: CircleHelp }

export interface PassportValidityCheckProps extends Omit<React.ComponentProps<"section">, "defaultValue" | "onChange"> {
  /** The trip: the day you arrive and the day you leave the destination. */
  trip: Trip
  /** Key into `rules`, e.g. "schengen". */
  destination: string
  /** Destination rules. Defaults to a small, sourced starter set. */
  rules?: Record<string, PassportRule>
  /** Controlled passport details. */
  value?: PassportDetails
  /** Initial passport details when uncontrolled. */
  defaultValue?: PassportDetails
  /** Called when the traveller edits the passport details. */
  onValueChange?: (value: PassportDetails) => void
  /** Offers "Come back by {date}" when an earlier return would make the passport pass. */
  onTripChange?: (trip: Trip) => void
  /** Locale for dates. */
  locale?: string
  /** Pause in ms before the verdict is announced to screen readers after an edit. */
  delay?: number
  /** Any visible string; `verdict` and `checks` may be partial. */
  messages?: Partial<Omit<PassportValidityMessages, "verdict" | "checks">> & { verdict?: Partial<PassportValidityMessages["verdict"]>; checks?: Partial<PassportValidityMessages["checks"]> }
}

/**
 * Checks a passport against a destination's entry rule before the trip is booked: the 6-month rule,
 * Schengen's 3 months after you leave and 10 years since issue, and blank pages. It names the exact
 * date the passport must last until and, when an earlier return would pass, offers it in one tap.
 */
export function PassportValidityCheck({
  trip,
  destination,
  rules = PASSPORT_RULES,
  value,
  defaultValue = {},
  onValueChange,
  onTripChange,
  locale = "en-IN",
  delay = 700,
  messages,
  className,
  ...props
}: PassportValidityCheckProps) {
  const t = { ...PASSPORT_VALIDITY_MESSAGES, ...messages, verdict: { ...PASSPORT_VALIDITY_MESSAGES.verdict, ...messages?.verdict }, checks: { ...PASSPORT_VALIDITY_MESSAGES.checks, ...messages?.checks } }
  const [inner, setInner] = React.useState(defaultValue)
  const passport = value ?? inner
  const rule = rules?.[destination]
  const result = checkPassport(passport, trip, rule as PassportRule)
  const [announcement, setAnnouncement] = React.useState("")
  const expiryRef = React.useRef<HTMLInputElement>(null)
  const id = React.useId()
  const fmt = (d?: Date) => (d ? new Intl.DateTimeFormat(locale, { weekday: "short", day: "numeric", month: "short", year: "numeric" }).format(d) : "")
  const verdict = t.verdict[result.status]

  const checkText = (check: PassportCheck) => {
    const pages = rule?.blankPages ?? 0
    if (check.invalid) return t.issuedTypo
    if (check.kind === "pages" && rule?.facingPages && check.status !== "fail") return fill(t.facing, { pages })
    return fill(t.checks[check.kind][check.status], { days: check.days, years: rule?.issuedWithinYears, pages, date: fmt(check.needed) })
  }
  // Announce changes, not the first render: a page load shouldn't talk over the rest of the form.
  const spoken = [verdict, ...result.checks.filter((c) => c.status === "fail").map(checkText)].join(". ")
  const firstSpoken = React.useRef(spoken)
  React.useEffect(() => {
    if (spoken === firstSpoken.current && !announcement) return
    const timer = setTimeout(() => setAnnouncement(spoken), delay)
    return () => clearTimeout(timer)
  }, [spoken, delay]) // eslint-disable-line react-hooks/exhaustive-deps

  const update = (patch: Partial<PassportDetails>) => {
    const next = { ...passport, ...patch }
    if (value === undefined) setInner(next)
    onValueChange?.(next)
  }

  if (!rule) return null
  const span = [rule.validFor?.months && fill(t.months, { n: rule.validFor.months }), rule.validFor?.days && fill(t.days, { n: rule.validFor.days })].filter(Boolean).join(t.and)
  const VerdictIcon = ICONS[result.status]
  const failing = result.status === "fail"

  return (
    <section
      aria-labelledby={`${id}-h`}
      data-slot="passport-validity-check"
      data-state={result.status}
      className={cn("@container grid w-full max-w-md min-w-0 gap-3 rounded-lg border bg-card p-4 text-sm text-card-foreground shadow-xs", failing && "border-red-500/40", className)}
      {...props}
    >
      <h3 id={`${id}-h`} className="flex items-center gap-2 font-medium">
        <Stamp aria-hidden className="size-4 shrink-0 text-muted-foreground" />
        <span className="min-w-0">{fill(t.heading, { name: rule.name })}</span>
      </h3>

      <div className="grid min-w-0 gap-3 @sm:grid-cols-2">
        <div className="grid min-w-0 gap-1.5">
          <label htmlFor={`${id}-exp`} className="text-xs font-medium">{t.expiry}</label>
          <input ref={expiryRef} id={`${id}-exp`} type="date" value={toInput(passport?.expiry)} onChange={(e) => update({ expiry: e.target.value || null })} aria-invalid={result.checks.some((c) => (c.kind === "validity" || c.kind === "expired") && c.status === "fail") || undefined} aria-describedby={`${id}-res`} className={field} />
        </div>
        {rule.issuedWithinYears ? (
          <div className="grid min-w-0 gap-1.5">
            <label htmlFor={`${id}-iss`} className="text-xs font-medium">{t.issued}</label>
            <input id={`${id}-iss`} type="date" value={toInput(passport?.issued)} onChange={(e) => update({ issued: e.target.value || null })} aria-invalid={result.checks.some((c) => c.kind === "issued" && c.status === "fail") || undefined} aria-describedby={`${id}-res`} className={field} />
          </div>
        ) : null}
        {rule.blankPages ? (
          <div className="grid min-w-0 gap-1.5">
            <label htmlFor={`${id}-pg`} className="text-xs font-medium">{t.pages}</label>
            <input id={`${id}-pg`} type="number" inputMode="numeric" min={0} max={99} value={passport?.blankPages ?? ""} onChange={(e) => update({ blankPages: e.target.value === "" ? null : Math.max(0, Math.min(99, Math.floor(Number(e.target.value)) || 0)) })} aria-describedby={`${id}-res`} className={field} />
          </div>
        ) : null}
      </div>

      {result.tripInvalid ? (
        <p id={`${id}-res`} className={cn(result.tripReversed ? tones.fail : "text-muted-foreground")}>{result.tripReversed ? t.tripReversed : t.tripInvalid}</p>
      ) : (
        <div id={`${id}-res`} className="grid gap-3">
          <div className="grid gap-0.5 rounded-md bg-muted/50 px-3 py-2">
            <span className="text-xs text-muted-foreground">{t.mustLast}</span>
            <span className="text-base font-semibold">{fmt(result.validUntil)}</span>
            <span className="text-xs text-muted-foreground">{fill(t.ruleLine, { rule: span, when: rule.from === "departure" ? t.leave : t.arrive })}</span>
          </div>
          <p className={cn("flex items-center gap-1.5 font-medium", tones[result.status])}>
            <VerdictIcon aria-hidden className="size-4 shrink-0" />
            {verdict}
          </p>
          <ul className="grid gap-1 text-xs">
            {result.checks.map((check) => {
              const Icon = ICONS[check.status]
              const text = checkText(check)
              return (
                <li key={check.kind} className={cn("flex gap-1.5", tones[check.status])}>
                  <Icon aria-hidden className="mt-px size-3.5 shrink-0" />
                  <span className="min-w-0">{text}</span>
                </li>
              )
            })}
          </ul>
          {failing && result.latestDeparture && onTripChange && (
            <div className="grid gap-1">
              <button
                type="button"
                onClick={() => {
                  onTripChange({ ...trip, departure: toInput(result.latestDeparture) })
                  expiryRef.current?.focus()
                }}
                className="inline-flex min-h-9 w-full items-center justify-center rounded-md border border-amber-500/40 px-4 py-1.5 text-center text-sm font-medium text-amber-900 transition-colors outline-none hover:bg-amber-500/10 focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:text-amber-200"
              >
                {fill(t.shorten, { date: fmt(result.latestDeparture) })}
              </button>
              <span className="text-xs text-muted-foreground">{t.shortenHint}</span>
            </div>
          )}
          {failing && !result.latestDeparture && <p className="text-xs text-muted-foreground">{t.renew}</p>}
        </div>
      )}

      <p className="border-t pt-3 text-xs text-muted-foreground">
        {rule.note && <span className="block">{rule.note}</span>}
        {t.officialNote}{" "}
        {rule.source && (
          <a href={rule.source} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1 rounded-sm font-medium text-foreground underline underline-offset-2 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50">
            {t.official}
            <ExternalLink aria-hidden className="size-3" />
          </a>
        )}
      </p>
      <span aria-live="polite" className="sr-only">{announcement}</span>
    </section>
  )
}
