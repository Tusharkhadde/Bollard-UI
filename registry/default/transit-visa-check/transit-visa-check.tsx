"use client"

import * as React from "react"
import { CircleCheck, CircleHelp, CircleX, ExternalLink, Luggage, PlaneLanding, TriangleAlert } from "lucide-react"

import { cn } from "@/lib/utils"
import { checkTransit, SCHENGEN, TRANSIT_RULES, type Layover, type TransitDocument, type TransitReason, type TransitRule } from "./transit-rules"

export { checkTransit, SCHENGEN, TRANSIT_RULES, type Layover, type TransitCheck, type TransitDocument, type TransitReason, type TransitRule } from "./transit-rules"

/** Every visible string. `{…}` placeholders are filled in. */
export const TRANSIT_VISA_MESSAGES = {
  heading: "Transit check",
  nationality: "Passport",
  airport: "Layover at",
  onward: "Flying on to",
  elsewhere: "Somewhere else",
  hours: "Layover (hours)",
  plan: "How you connect",
  selfTransfer: "Self-transfer",
  separateTickets: "Separate tickets",
  terminalChange: "Change terminals",
  landside: "Leave the airport",
  documents: "Visas or permits you hold",
  docs: {
    "us-visa": "US visa", "us-residence": "US green card", "ca-visa": "Canada visa", "ca-residence": "Canada PR",
    "au-visa": "Australia visa", "nz-visa": "New Zealand visa", "uk-visa": "UK visa", "schengen-visa": "Schengen visa",
    "eea-residence": "EU/EEA residence permit", "jp-visa": "Japan visa", "uk-residence": "UK residence permit",
  } as Record<TransitDocument, string>,
  verdict: { visa: "You'll likely need a visa for this layover", check: "Check before you book", clear: "No transit visa listed for this layover", unknown: "Pick your passport and layover airport" },
  citizen: "You're a citizen here: no visa needed.",
  freeMovement: "Your passport lets you pass the border in {country}: no visa needed.",
  noAirside: "{country} has no airside transit: everyone clears immigration, even to change planes.",
  selfTransferWhy: "Self-transfer means collecting your bags and checking in again, so you have to enter {country}.",
  separateTicketsWhy: "On separate tickets the airline usually won't check bags through, so you'll likely enter {country} to re-check them.",
  terminalMaybe: "Some terminal changes go through immigration. Check that yours stays airside.",
  terminalCertain: "This terminal change goes through immigration, so you enter {country}.",
  leaving: "Leaving the airport means entering {country}.",
  tooLong: "Airside waits here are limited to {max} hours.",
  onwardZone: "Your next flight is to {onward}, inside Schengen, so you enter Schengen here in {country}.",
  onwardLandside: "Flights to {onward} leave from the landside, so you enter {country}.",
  airsideVisa: "{nationality} passports need a {visa} even to stay airside in {country}.",
  exempt: "Your {documents} usually exempts you from the {visa}. {note}",
  conditional: "{note} Otherwise no {visa} is needed.",
  entryExempt: "Your {documents} lets you pass the border here, if it's valid for these dates (a residence permit must be from a Schengen state).",
  landsideTransit: "You hold a {documents}. {note}",
  airsideClear: "{nationality} passports aren't on {country}'s airport transit visa list, if you stay airside.",
  hoursNote: "Airside transit here only runs {hours}.",
  verify: "Rules change and airlines can be stricter. Rules checked {date}: verify with Timatic or the official source.",
  official: "Official source",
  timatic: "Timatic (IATA)",
}
export type TransitVisaMessages = typeof TRANSIT_VISA_MESSAGES

const fill = (s: string, v: Record<string, string | number | undefined>) => s.replace(/\{(\w+)\}/g, (m, k: string) => String(v[k] ?? m))
const field = "h-9 w-full min-w-0 rounded-md border bg-transparent px-3 text-base shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 md:text-sm dark:bg-input/30 [&>option]:bg-popover"
const TIMATIC = "https://www.iatatravelcentre.com/"
const COMMON = ["IN", "US", "GB", "CA", "AU", "NZ", "AE", "SG", "JP", "IE", "BR", "MX", "ZA"]
const TONES = { visa: "border-red-500/40 bg-red-500/5 text-red-700 dark:text-red-400", check: "border-amber-500/40 bg-amber-500/5 text-amber-800 dark:text-amber-300", clear: "border-emerald-500/40 bg-emerald-500/5 text-emerald-700 dark:text-emerald-400", unknown: "text-muted-foreground" }
const ICONS = { visa: CircleX, check: TriangleAlert, clear: CircleCheck, unknown: CircleHelp }

export interface TransitVisaCheckProps extends Omit<React.ComponentProps<"section">, "defaultValue" | "onChange"> {
  /** Controlled layover. */
  value?: Partial<Layover>
  /** Initial layover when uncontrolled. */
  defaultValue?: Partial<Layover>
  /** Called on every change. */
  onValueChange?: (value: Partial<Layover>) => void
  /** Rules by airport IATA code. Defaults to a small, sourced starter set; replace with your own data. */
  rules?: Record<string, TransitRule & { airport?: string; hours?: string }>
  /** Countries offered for passport and onward flight, ISO alpha-2. Defaults to every country the rules mention. */
  countries?: string[]
  /** Locale for country names and dates. */
  locale?: string
  /** Pause in ms before the verdict is read out after a change. */
  delay?: number
  /** Any visible string; `verdict` and `docs` may be partial. */
  messages?: Partial<Omit<TransitVisaMessages, "verdict" | "docs">> & { verdict?: Partial<TransitVisaMessages["verdict"]>; docs?: Partial<TransitVisaMessages["docs"]> }
}

/**
 * Flags a layover that may need a transit or entry visa before the ticket is bought: nationalities on an airport
 * transit visa list, airports with no airside transit, and the traps people miss — self-transfer and separate
 * tickets (you must enter to re-check bags), terminal changes, an onward flight inside Schengen and leaving the
 * airport. Rules come from props, with a small sourced default set and a link to verify.
 */
export function TransitVisaCheck({
  value, defaultValue = {}, onValueChange, rules = TRANSIT_RULES, countries, locale = "en-IN", delay = 700, messages, className, ...props
}: TransitVisaCheckProps) {
  const t = { ...TRANSIT_VISA_MESSAGES, ...messages, verdict: { ...TRANSIT_VISA_MESSAGES.verdict, ...messages?.verdict }, docs: { ...TRANSIT_VISA_MESSAGES.docs, ...messages?.docs } }
  const [inner, setInner] = React.useState<Partial<Layover>>(defaultValue)
  const layover = value ?? inner
  const result = checkTransit(layover, rules)
  const rule = result.rule
  const [status, setStatus] = React.useState("")
  const id = React.useId()

  const names = React.useMemo(() => {
    try { return new Intl.DisplayNames([locale], { type: "region" }) } catch { return null }
  }, [locale])
  const name = (c?: string) => (c ? (names?.of(c) ?? c) : "")
  const list = React.useMemo(() => {
    const all = countries ?? [...new Set([...COMMON, ...SCHENGEN, ...Object.values(rules ?? {}).flatMap((r) => [r.code, ...r.airsideVisa])])]
    return all.filter((c) => /^[A-Z]{2}$/.test(c)).map((c) => [c, names?.of(c) ?? c] as const).sort((a, b) => a[1].localeCompare(b[1], locale))
  }, [countries, rules, names, locale])

  const commit = (patch: Partial<Layover>) => {
    const next = { ...layover, ...patch }
    if (value === undefined) setInner(next)
    onValueChange?.(next)
  }

  const docsText = (docs: TransitDocument[]) => (typeof Intl.ListFormat === "function" ? new Intl.ListFormat(locale, { type: "disjunction" }).format(docs.map((d) => t.docs[d] ?? d)) : docs.map((d) => t.docs[d] ?? d).join(", "))
  const text = (r: TransitReason) => {
    const v = { country: rule?.country, nationality: name(layover.nationality), visa: rule?.airsideVisaName }
    switch (r.kind) {
      case "citizen": return t.citizen
      case "freeMovement": return fill(t.freeMovement, v)
      case "conditional": return fill(t.conditional, { ...v, note: r.note })
      case "entryExempt": return fill(t.entryExempt, { documents: docsText(r.documents) })
      case "landsideTransit": return fill(t.landsideTransit, { documents: docsText(r.documents), note: r.note ?? "" }).trim()
      case "noAirside": return fill(t.noAirside, v)
      case "selfTransfer": return fill(t.selfTransferWhy, v)
      case "separateTickets": return fill(t.separateTicketsWhy, v)
      case "terminal": return fill(r.certain ? t.terminalCertain : t.terminalMaybe, v)
      case "leaving": return fill(t.leaving, v)
      case "tooLong": return fill(t.tooLong, { max: r.max })
      case "onwardZone": return fill(t.onwardZone, { ...v, onward: name(r.onward) })
      case "onwardLandside": return fill(t.onwardLandside, { ...v, onward: name(r.onward) })
      case "airsideVisa": return fill(t.airsideVisa, v)
      case "exempt": return fill(t.exempt, { ...v, documents: docsText(r.documents), note: r.note ?? "" }).trim()
      case "airsideClear": return fill(t.airsideClear, v)
      case "entry": return r.note
      case "hours": return fill(t.hoursNote, { hours: r.hours })
    }
  }
  const verdict = t.verdict[result.verdict]
  const spoken = [verdict, ...result.reasons.map(text)].join(" ")
  React.useEffect(() => {
    const timer = setTimeout(() => setStatus(spoken), delay)
    return () => clearTimeout(timer)
  }, [spoken, delay])

  const toggle = (key: "selfTransfer" | "separateTickets" | "terminalChange" | "landside", label: string) => (
    <label className="inline-flex h-8 cursor-pointer items-center gap-2 rounded-md border px-3 text-xs font-medium transition-colors has-[:checked]:border-primary/50 has-[:checked]:bg-accent has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-ring/50">
      <input type="checkbox" checked={!!layover[key]} onChange={(e) => commit({ [key]: e.target.checked })} className="size-3.5 accent-primary outline-none" />
      {label}
    </label>
  )
  // Offer the documents that can change the answer: airside exemptions for listed passports, and the entry or
  // landside-transit documents once the plan means passing the border.
  const nat = String(layover.nationality ?? "").toUpperCase()
  const free = !rule || nat === rule.code || !!rule.freeMovement?.includes(nat)
  const needsAirside = !!rule && (rule.airsideVisa.includes(nat) || !!rule.airsideVisaIf?.[nat])
  const exemptDocs = free ? [] : [...new Set([
    ...(needsAirside && !result.entering ? rule?.exemptWith ?? [] : []),
    ...(result.entering ? [...(rule?.entryExemptWith ?? []), ...(needsAirside ? rule?.landsideTransitWith ?? [] : [])] : []),
  ])]
  const Icon = ICONS[result.verdict]

  return (
    <section aria-labelledby={`${id}-h`} data-slot="transit-visa-check" data-state={result.verdict}
      className={cn("@container grid w-full max-w-md min-w-0 gap-3 rounded-lg border bg-card p-4 text-sm text-card-foreground shadow-xs", className)} {...props}>
      <h3 id={`${id}-h`} className="flex items-center gap-2 font-medium">
        <PlaneLanding aria-hidden className="size-4 shrink-0 text-muted-foreground" />
        {t.heading}
      </h3>

      <div className="grid min-w-0 gap-3 @sm:grid-cols-2">
        <div className="grid min-w-0 gap-1.5">
          <label htmlFor={`${id}-nat`} className="text-xs font-medium">{t.nationality}</label>
          <select id={`${id}-nat`} value={layover.nationality ?? ""} onChange={(e) => commit({ nationality: e.target.value })} className={field}>
            <option value="" disabled>—</option>
            {list.map(([c, n]) => <option key={c} value={c}>{n}</option>)}
          </select>
        </div>
        <div className="grid min-w-0 gap-1.5">
          <label htmlFor={`${id}-apt`} className="text-xs font-medium">{t.airport}</label>
          <select id={`${id}-apt`} value={layover.airport ?? ""} onChange={(e) => commit({ airport: e.target.value })} className={field}>
            <option value="" disabled>—</option>
            {Object.entries(rules ?? {}).map(([iata, r]) => <option key={iata} value={iata}>{iata} · {r.airport ?? r.country}</option>)}
          </select>
        </div>
        <div className="grid min-w-0 gap-1.5">
          <label htmlFor={`${id}-on`} className="text-xs font-medium">{t.onward}</label>
          <select id={`${id}-on`} value={layover.onward ?? ""} onChange={(e) => commit({ onward: e.target.value })} className={field}>
            <option value="">{t.elsewhere}</option>
            {list.map(([c, n]) => <option key={c} value={c}>{n}</option>)}
          </select>
        </div>
        <div className="grid min-w-0 gap-1.5">
          <label htmlFor={`${id}-hrs`} className="text-xs font-medium">{t.hours}</label>
          <input id={`${id}-hrs`} type="number" inputMode="decimal" min={0} max={240} value={layover.hours ?? ""}
            onChange={(e) => commit({ hours: e.target.value === "" ? undefined : Math.max(0, Math.min(240, Number(e.target.value) || 0)) })} className={field} />
        </div>
      </div>

      <fieldset className="grid gap-1.5">
        <legend className="mb-1.5 text-xs font-medium">{t.plan}</legend>
        <div className="flex flex-wrap gap-1.5">
          {toggle("selfTransfer", t.selfTransfer)}
          {toggle("separateTickets", t.separateTickets)}
          {toggle("terminalChange", t.terminalChange)}
          {toggle("landside", t.landside)}
        </div>
      </fieldset>

      {exemptDocs.length > 0 && (
        <fieldset className="grid gap-1.5">
          <legend className="mb-1.5 text-xs font-medium">{t.documents}</legend>
          <div className="flex flex-wrap gap-1.5">
            {exemptDocs.map((d) => (
              <label key={d} className="inline-flex h-8 cursor-pointer items-center gap-2 rounded-md border px-3 text-xs transition-colors has-[:checked]:bg-accent has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-ring/50">
                <input type="checkbox" checked={!!layover.documents?.includes(d)} className="size-3.5 accent-primary outline-none"
                  onChange={(e) => commit({ documents: e.target.checked ? [...(layover.documents ?? []), d] : (layover.documents ?? []).filter((x) => x !== d) })} />
                {t.docs[d] ?? d}
              </label>
            ))}
          </div>
        </fieldset>
      )}

      <div className={cn("grid gap-2 rounded-md border px-3 py-2", TONES[result.verdict])}>
        <p className="flex items-center gap-1.5 font-medium">
          <Icon aria-hidden className="size-4 shrink-0" />
          {verdict}
        </p>
        {result.reasons.length > 0 && (
          <ul className="grid gap-1.5 text-xs text-foreground">
            {result.reasons.map((r, i) => (
              <li key={`${r.kind}-${i}`} className="flex gap-1.5">
                {r.kind === "selfTransfer" || r.kind === "separateTickets" ? <Luggage aria-hidden className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" /> : <span aria-hidden className="mt-1.5 size-1.5 shrink-0 rounded-full bg-current opacity-50" />}
                <span className="min-w-0 break-words">{text(r)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="border-t pt-3 text-xs text-muted-foreground">
        {fill(t.verify, { date: rule?.checked ? new Intl.DateTimeFormat(locale, { timeZone: "UTC", day: "numeric", month: "short", year: "numeric" }).format(Date.parse(rule.checked) || 0) : "—" })}{" "}
        <span className="inline-flex flex-wrap gap-x-3">
          {rule?.source && (
            <a href={rule.source} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1 rounded-sm font-medium text-foreground underline underline-offset-2 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50">
              {t.official}<ExternalLink aria-hidden className="size-3" />
            </a>
          )}
          <a href={TIMATIC} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1 rounded-sm font-medium text-foreground underline underline-offset-2 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50">
            {t.timatic}<ExternalLink aria-hidden className="size-3" />
          </a>
        </span>
      </p>
      <span aria-live="polite" className="sr-only">{status}</span>
    </section>
  )
}
