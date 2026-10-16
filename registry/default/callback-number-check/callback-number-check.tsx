"use client"

import * as React from "react"
import type { CountryCode } from "libphonenumber-js/max"
import { Ban, Globe, Phone, PhoneMissed, ShieldAlert, TriangleAlert } from "lucide-react"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"

import { cn } from "@/lib/utils"
import { checkCallback, countryName, type CallbackFindingKind } from "./callback"

export { checkCallback, countryName } from "./callback"
export type { CallbackCheck, CallbackCheckOptions, CallbackFinding, CallbackFindingKind } from "./callback"

/** Every visible string. Placeholders: {country} {home} {code} {area} {name}. */
export const CALLBACK_NUMBER_CHECK_MESSAGES = {
  findings: {
    unreadable: "This doesn't read as a phone number.",
    "not-assigned": "No phone company has been given this range. It may be spoofed or mistyped.",
    "lookalike-domestic": "{area} looks like a {home} area code, but it's {country}. You'd pay international rates.",
    international: "Calling {country} (+{code}) is an international call.",
    "one-ring": "It rang once and hung up. One-ring scams use foreign numbers to bill you for calling back.",
    premium: "Premium rate: the line itself charges per minute, on top of your normal call cost.",
    "shared-cost": "Shared-cost line: often charged above a normal call and not covered by bundled minutes.",
    "foreign-toll-free": "Toll-free only inside {country}. From {home} it's an international call that may be charged.",
    voip: "An internet (VoIP) number. Anyone can get one anywhere, so the country says little about who it is.",
    "not-official": "Not one of {name}'s published numbers. Call the number on their website or card instead.",
  } satisfies Record<CallbackFindingKind, string>,
  types: {
    MOBILE: "Mobile",
    FIXED_LINE: "Landline",
    FIXED_LINE_OR_MOBILE: "Phone",
    TOLL_FREE: "Toll-free",
    PREMIUM_RATE: "Premium rate",
    SHARED_COST: "Shared cost",
    UAN: "Business number",
    VOIP: "Internet number",
    PERSONAL_NUMBER: "Personal number",
    PAGER: "Pager",
    VOICEMAIL: "Voicemail",
  } as Record<string, string>,
  call: "Call",
  callAnyway: "Call anyway",
  confirmHint: "Press again to call. Check the cost first.",
  dontCall: "Don't call",
  nonGeographic: "Worldwide number",
  worldwide: "a worldwide number",
  safe: "Nothing unusual about this number.",
  findingsLabel: "Before you call",
}

export type CallbackNumberCheckMessages = typeof CALLBACK_NUMBER_CHECK_MESSAGES

export interface CallbackNumberCheckProps extends Omit<React.ComponentProps<"div">, "children"> {
  /** The number as you received it: "+1 876 555 0142", "0909 879 0000", "1800-266-0123". */
  number: string
  /** Country the caller's phone is in. Defaults to the browser language's region, then "US". */
  homeCountry?: CountryCode
  /** Country to read a number without + in. Defaults to `homeCountry`. */
  defaultCountry?: CountryCode
  /** Rings before a missed call hung up; 1 flags the one-ring pattern. */
  rings?: number
  /** Who the number claims to be ("HDFC Bank"); used with `officialNumbers`. */
  officialName?: string
  /** That organisation's published numbers. A number not on the list must be confirmed. */
  officialNumbers?: string[]
  /** Where it came from: "Missed call · 2:13 AM". */
  caption?: React.ReactNode
  /** Called with the E.164 number when the call actually starts. The link still dials `tel:`. */
  onCall?: (e164: string) => void
  /** Called when the user picks "Don't call" on a risky number. */
  onDismiss?: () => void
  /** Language for country names. */
  locale?: string
  /** Override any visible text. */
  messages?: Partial<Omit<CallbackNumberCheckMessages, "findings" | "types">> & {
    findings?: Partial<CallbackNumberCheckMessages["findings"]>
    types?: Partial<CallbackNumberCheckMessages["types"]>
  }
}

const fill = (template: string, values: Record<string, string>) => template.replace(/\{(\w+)\}/g, (m, k: string) => values[k] ?? m)

/**
 * Stops expensive and scam callbacks. Next to a number you're about to call back it says what
 * the number really is (country, line type) from Google's libphonenumber data, and flags the
 * traps: a Caribbean +1 876 number that passes for a US area code, a one-ring missed call from
 * abroad, premium-rate and shared-cost lines, a toll-free number that is only free in its own
 * country, unassigned ranges and a "bank" number that isn't on the bank's own list. Risky calls
 * need a second, deliberate press: the Call button morphs into "Call anyway" in place, so focus
 * never moves and nobody dials by reflex.
 */
export function CallbackNumberCheck({
  number,
  homeCountry,
  defaultCountry,
  rings,
  officialName,
  officialNumbers,
  caption,
  onCall,
  onDismiss,
  locale,
  messages,
  className,
  ...props
}: CallbackNumberCheckProps) {
  const [detected, setDetected] = React.useState<CountryCode>()
  const [armed, setArmed] = React.useState(false)
  const reduceMotion = useReducedMotion()
  const statusId = React.useId()
  const m = {
    ...CALLBACK_NUMBER_CHECK_MESSAGES,
    ...messages,
    findings: { ...CALLBACK_NUMBER_CHECK_MESSAGES.findings, ...messages?.findings },
    types: { ...CALLBACK_NUMBER_CHECK_MESSAGES.types, ...messages?.types },
  }

  React.useEffect(() => {
    if (homeCountry) return
    const region = new Intl.Locale(navigator.language).maximize().region
    setDetected(region && /^[A-Z]{2}$/.test(region) ? (region as CountryCode) : "US")
  }, [homeCountry])

  const home = homeCountry ?? detected ?? "US"
  const check = React.useMemo(
    () => checkCallback(number, { homeCountry: home, defaultCountry, rings, officialNumbers }),
    [number, home, defaultCountry, rings, officialNumbers],
  )
  React.useEffect(() => setArmed(false), [check.e164])

  const risk = check.findings.some((f) => f.severity === "stop") ? "stop" : check.findings.length ? "caution" : "ok"
  const national = check.e164 && check.callingCode ? check.e164.slice(check.callingCode.length + 1) : ""
  const values = {
    country: countryName(check.country, locale) ?? m.worldwide,
    home: countryName(home, locale) ?? home,
    code: check.callingCode ?? "",
    area: national.slice(0, 3),
    name: officialName ?? "the organisation",
  }
  const spring = reduceMotion ? { duration: 0.12 } : { type: "spring" as const, stiffness: 420, damping: 32 }

  return (
    <div
      data-slot="callback-number-check"
      data-risk={risk}
      className={cn(
        "grid w-full min-w-0 gap-3 rounded-xl border bg-card p-4 text-sm text-card-foreground",
        risk === "stop" && "border-red-500/40 dark:border-red-400/40",
        className,
      )}
      {...props}
    >
      <div className="flex min-w-0 items-start gap-3">
        {/* The ISO code, not a flag emoji: Windows has no flag glyphs and would show the same letters anyway. */}
        <span
          aria-hidden
          className={cn(
            "flex size-10 shrink-0 items-center justify-center rounded-full bg-muted font-mono text-xs font-semibold text-muted-foreground",
            check.country && check.country !== home && "bg-amber-500/15 text-amber-800 dark:text-amber-300",
          )}
        >
          {check.e164 ? (check.country ?? <Globe className="size-4" />) : <PhoneMissed className="size-4" />}
        </span>
        <div className="min-w-0 flex-1">
          {caption && <p className="text-xs text-muted-foreground">{caption}</p>}
          <p className="truncate font-mono text-base font-semibold tabular-nums" title={check.display}>
            {check.display || number}
          </p>
          {check.e164 && (
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <Globe aria-hidden className="size-3" />
                {countryName(check.country, locale) ?? m.nonGeographic}
              </span>
              {check.type && (
                <span
                  className={cn(
                    "rounded-full border px-1.5 py-px font-medium",
                    check.type === "PREMIUM_RATE" && "border-red-500/40 text-red-700 dark:text-red-400",
                  )}
                >
                  {m.types[check.type] ?? check.type}
                </span>
              )}
            </p>
          )}
        </div>
      </div>

      {check.findings.length > 0 ? (
        <ul aria-label={m.findingsLabel} className="grid gap-1.5">
          <AnimatePresence initial={false}>
            {check.findings.map((finding, index) => {
              const Icon = finding.kind === "not-official" ? ShieldAlert : finding.severity === "stop" ? Ban : TriangleAlert
              return (
                <motion.li
                  key={finding.kind}
                  layout={!reduceMotion}
                  initial={reduceMotion ? { opacity: 0 } : { opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, transition: { duration: 0.12 } }}
                  transition={{ ...spring, delay: reduceMotion ? 0 : index * 0.05 }}
                  className={cn(
                    "flex gap-2 rounded-md px-2.5 py-1.5 text-xs",
                    finding.severity === "stop"
                      ? "bg-red-500/10 text-red-900 dark:text-red-200"
                      : "bg-amber-500/10 text-amber-900 dark:text-amber-200",
                  )}
                >
                  <Icon aria-hidden className="mt-px size-3.5 shrink-0" />
                  <span>{fill(m.findings[finding.kind], values)}</span>
                </motion.li>
              )
            })}
          </AnimatePresence>
        </ul>
      ) : (
        <p className="text-xs text-muted-foreground">{m.safe}</p>
      )}

      {check.e164 && (
        <div className="flex flex-wrap items-center justify-end gap-2">
          {risk === "stop" && armed && onDismiss && (
            <button
              type="button"
              onClick={onDismiss}
              className="inline-flex h-9 items-center rounded-md px-3 text-sm font-medium text-muted-foreground outline-none hover:bg-accent hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
            >
              {m.dontCall}
            </button>
          )}
          <motion.a
            layout={!reduceMotion}
            transition={spring}
            href={`tel:${check.e164}`}
            aria-describedby={armed ? statusId : undefined}
            onClick={(event) => {
              if (risk === "stop" && !armed) {
                event.preventDefault()
                setArmed(true)
                return
              }
              onCall?.(check.e164!)
            }}
            className={cn(
              "inline-flex h-9 items-center gap-1.5 overflow-hidden rounded-md px-4 text-sm font-medium whitespace-nowrap outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
              armed ? "bg-destructive text-white hover:bg-destructive/90" : "bg-primary text-primary-foreground hover:bg-primary/90",
            )}
          >
            <Phone aria-hidden className="size-4" />
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.span
                key={armed ? "armed" : "idle"}
                initial={{ opacity: 0, y: reduceMotion ? 0 : 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: reduceMotion ? 0 : -10 }}
                transition={spring}
              >
                {armed ? m.callAnyway : m.call}
              </motion.span>
            </AnimatePresence>
          </motion.a>
        </div>
      )}
      <p id={statusId} role="status" className={cn("text-right text-xs text-muted-foreground", !armed && "sr-only")}>
        {armed ? m.confirmHint : ""}
      </p>
    </div>
  )
}
