// Bollard UI — callback-number-check · MIT licence · https://bollard-ui.vercel.app/components/callback-number-check

/** Pure helpers for CallbackNumberCheck. Line types and ranges come from Google's libphonenumber ("max" metadata). */
import { isSupportedCountry, parsePhoneNumberFromString, type CountryCode, type NumberType } from "libphonenumber-js/max"

export type CallbackFindingKind =
  | "unreadable"
  | "not-assigned"
  | "lookalike-domestic"
  | "international"
  | "one-ring"
  | "premium"
  | "shared-cost"
  | "foreign-toll-free"
  | "voip"
  | "not-official"

export interface CallbackFinding {
  kind: CallbackFindingKind
  /** "stop" means don't call without a deliberate second tap; "caution" is worth knowing. */
  severity: "stop" | "caution"
}

export interface CallbackCheckOptions {
  /** Country the caller's phone is in; decides what counts as international. */
  homeCountry: CountryCode
  /** Country to read a number without a + in. Defaults to `homeCountry`. */
  defaultCountry?: CountryCode
  /** Rings before a missed call hung up. 1 (or 0) is the one-ring / wangiri pattern. */
  rings?: number
  /** Numbers the organisation really publishes, when the number claims to be theirs. Any format. */
  officialNumbers?: string[]
}

export interface CallbackCheck {
  /** E.164, e.g. "+18765550142". Null when the text isn't a phone number at all. */
  e164: string | null
  /** Country the number belongs to, e.g. "JM". Undefined for non-geographic (+882, +800) numbers. */
  country?: CountryCode
  /** Shared calling code, e.g. "1" for the whole NANP. */
  callingCode?: string
  /** libphonenumber line type. */
  type?: NumberType
  /** As the caller should dial it from `homeCountry`. */
  display: string
  findings: CallbackFinding[]
}

/** NANP members share +1, so a Caribbean number looks like a US or Canadian area code. */
const NANP_HOMES = new Set<CountryCode>(["US", "CA"])

const digitsOnly = (value: string) => value.replace(/\D/g, "")

/** The part of a number that identifies it: E.164 when parseable, otherwise its digits. */
function key(value: string, country: CountryCode) {
  return parsePhoneNumberFromString(value, country)?.number ?? `+${digitsOnly(value)}`
}

/**
 * Reads a number someone wants you to call back and lists what could cost or catch you:
 * a Caribbean +1 number that passes for a US area code, an international callback after a
 * one-ring missed call, premium-rate and shared-cost lines, a toll-free number that is only
 * free inside its own country, internet (VoIP) numbers, ranges that aren't assigned to anyone,
 * and a number that isn't on the organisation's own published list.
 */
export function checkCallback(raw: string | null | undefined, options: CallbackCheckOptions): CallbackCheck {
  const home = isSupportedCountry(options.homeCountry) ? options.homeCountry : "US"
  const fallback = options.defaultCountry && isSupportedCountry(options.defaultCountry) ? options.defaultCountry : home
  const text = String(raw ?? "")
    .replace(/^\uFEFF/, "")
    .trim()
    .slice(0, 64)
  const parsed = text ? parsePhoneNumberFromString(text.replace(/^00/, "+"), fallback) : undefined
  if (!parsed) return { e164: null, display: text, findings: [{ kind: "unreadable", severity: "caution" }] }

  const findings: CallbackFinding[] = []
  const country = parsed.country
  const type = parsed.getType()
  const foreign = country ? country !== home : true
  const valid = parsed.isValid()

  if (!valid) findings.push({ kind: "not-assigned", severity: "caution" })
  if (foreign && parsed.countryCallingCode === "1" && NANP_HOMES.has(home) && country && !NANP_HOMES.has(country)) {
    findings.push({ kind: "lookalike-domestic", severity: "stop" })
  } else if (foreign) {
    findings.push({ kind: "international", severity: "caution" })
  }
  if (foreign && options.rings !== undefined && options.rings <= 1) findings.push({ kind: "one-ring", severity: "stop" })
  if (type === "PREMIUM_RATE") findings.push({ kind: "premium", severity: "stop" })
  if (type === "SHARED_COST" || type === "UAN") findings.push({ kind: "shared-cost", severity: "caution" })
  if (type === "TOLL_FREE" && foreign) findings.push({ kind: "foreign-toll-free", severity: "caution" })
  if (type === "VOIP") findings.push({ kind: "voip", severity: "caution" })
  if (options.officialNumbers?.length) {
    // Published numbers are usually written nationally, so read them in the claimed number's own country.
    const official = new Set(options.officialNumbers.map((n) => key(n, country ?? fallback)))
    if (!official.has(parsed.number)) findings.push({ kind: "not-official", severity: "stop" })
  }

  return {
    e164: parsed.number,
    country,
    callingCode: parsed.countryCallingCode,
    type,
    display: foreign ? parsed.formatInternational() : parsed.formatNational(),
    findings,
  }
}

/** "Jamaica" for "JM", in the reader's language. */
export function countryName(country: string | undefined, locale?: string) {
  if (!country) return undefined
  try {
    return new Intl.DisplayNames(locale ? [locale] : undefined, { type: "region" }).of(country) ?? country
  } catch {
    return country
  }
}
