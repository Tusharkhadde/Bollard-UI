// Bollard UI — transit-visa-check · MIT licence · https://bollard-ui.vercel.app/components/transit-visa-check

/** Transit visa rules and the pure check. Countries are ISO 3166-1 alpha-2 codes ("IN", "GB"). */

/** Documents that commonly exempt a traveller from an airport transit visa. */
export type TransitDocument = "us-visa" | "us-residence" | "ca-visa" | "ca-residence" | "au-visa" | "nz-visa" | "uk-visa" | "uk-residence" | "schengen-visa" | "eea-residence" | "jp-visa"

export interface TransitRule {
  /** Country name for display. */
  country: string
  /** ISO alpha-2 of the country. Its own citizens never need a visa. */
  code: string
  /** "schengen": the next flight to another Schengen country means entering here. */
  zone?: "schengen"
  /** Nationalities who can always pass the border (EU/EEA/Swiss in Schengen, Irish in the UK). */
  freeMovement?: string[]
  /** No airside transit at all: every passenger clears immigration (the United States). */
  noAirside?: boolean
  /** Nationalities that need a visa even to stay airside. */
  airsideVisa: string[]
  /** Nationalities that need it only in some cases, with the condition in words. Gives "check". */
  airsideVisaIf?: Record<string, string>
  /** Name of that visa. */
  airsideVisaName: string
  /** Documents that exempt those nationalities from the airside visa. Conditions apply; `exemptionNote` says which. */
  exemptWith?: TransitDocument[]
  exemptionNote?: string
  /** What passing the border needs, in words. */
  entryNote: string
  /** Nationalities that need a visa to enter (pass the border), if you have the list. Without it, entering is "check". */
  entryVisa?: string[]
  /** Documents that let a visa national pass the border here (a Schengen visa in Schengen). Gives "clear". */
  entryExemptWith?: TransitDocument[]
  /** Documents that may let a visa national pass the border for a short landside transit, with conditions. Gives "check". */
  landsideTransitWith?: TransitDocument[]
  landsideTransitNote?: string
  /** Onward countries that force a landside transit (the UK for Ireland). */
  landsideOnward?: string[]
  /** Whether a terminal change keeps you airside: true = always landside, false = always airside, undefined = it depends. */
  terminalChangeLandside?: boolean
  /** Hours you can wait airside, if limited. */
  maxAirsideHours?: number
  /** Official page the rule comes from, and when it was checked (YYYY-MM-DD). */
  source: string
  checked: string
}

/** The 29 Schengen states (Bulgaria and Romania fully since 1 Jan 2025). */
export const SCHENGEN = ["AT", "BE", "BG", "HR", "CZ", "DK", "EE", "FI", "FR", "DE", "GR", "HU", "IS", "IT", "LV", "LI", "LT", "LU", "MT", "NL", "NO", "PL", "PT", "RO", "SK", "SI", "ES", "SE", "CH"]
/** EU/EEA/Swiss citizens move freely in Schengen: Schengen states plus the EU members outside it. */
const FREE_IN_SCHENGEN = [...SCHENGEN, "IE", "CY"]

const UK: TransitRule = {
  country: "United Kingdom",
  code: "GB",
  freeMovement: ["IE"],
  // The Immigration (Passenger Transit Visa) Order 2014, Schedule 1, as amended to 6 Mar 2026 (70 nationalities).
  airsideVisa: ["AF", "AL", "DZ", "AO", "BD", "BY", "BW", "MM", "BI", "CM", "CO", "CG", "CD", "DM", "EG", "SV", "ER", "ET", "MK", "GM", "GE", "GH", "GN", "GW", "HN", "IN", "IR", "IQ", "CI", "JM", "JO", "KE", "XK", "LB", "LS", "LR", "LY", "MW", "MD", "MN", "NA", "NR", "NP", "NI", "NG", "PK", "PS", "CN", "RU", "RW", "SN", "RS", "SL", "SO", "ZA", "SS", "LK", "LC", "SD", "SZ", "SY", "TZ", "TL", "TT", "TR", "UG", "VU", "VN", "YE", "ZW"],
  airsideVisaName: "Direct Airside Transit Visa (DATV)",
  // Article 4: valid AU/CA/NZ/US visa (or one used to enter within 6 months), their permanent residence, an EEA/Swiss
  // residence permit; gov.uk: a UK Standard Visitor visa also does.
  exemptWith: ["uk-visa", "us-visa", "us-residence", "ca-visa", "ca-residence", "au-visa", "nz-visa", "eea-residence"],
  exemptionNote: "Paper documents only, unless the airline can verify an e-visa. Syrians with a US B1/B2 visa still need a DATV.",
  entryNote: "Passing UK border control needs a Visitor in Transit visa (leave within 48 hours) for visa nationals, or an ETA for most others.",
  landsideTransitWith: ["us-visa", "us-residence", "ca-visa", "ca-residence", "au-visa", "nz-visa", "eea-residence"],
  landsideTransitNote: "With it you may get Transit Without Visa at the border if you leave by 23:59 the next day. Conditions apply, so check before you rely on it.",
  landsideOnward: ["IE"],
  source: "https://www.legislation.gov.uk/uksi/2014/2702/article/4",
  checked: "2026-10-14",
}
/** Regulation (EC) 810/2009 Art. 3(5): exemptions every Schengen state applies. */
const SCHENGEN_EXEMPT: TransitDocument[] = ["schengen-visa", "eea-residence", "us-visa", "us-residence", "ca-visa", "ca-residence", "jp-visa"]
const SCHENGEN_ENTRY = {
  entryNote: "Leaving the transit area means entering Schengen: you need a Schengen visa unless your passport is visa-free (then an ETIAS once it starts).",
  entryExemptWith: ["schengen-visa", "eea-residence"] as TransitDocument[],
}
const DE: TransitRule = {
  country: "Germany",
  code: "DE",
  zone: "schengen",
  freeMovement: FREE_IN_SCHENGEN,
  // Federal Foreign Office list, June 2026 (India removed 3 June 2026).
  airsideVisa: ["AF", "BD", "ML", "SD", "ET", "GH", "LK", "ER", "JO", "LB", "CD", "IQ", "SO", "SS", "IR", "PK", "TR", "CU", "NG", "SY"],
  airsideVisaName: "airport transit visa (Schengen type A)",
  exemptWith: SCHENGEN_EXEMPT,
  exemptionNote: "Germany lists the exact permits that count; an I-797 or advance parole does not. Jordanians flying to or from Australia, Israel or New Zealand on that country's visa are exempt for up to 12 hours.",
  ...SCHENGEN_ENTRY,
  source: "https://www.germany.info/us-en/service/visa/airport-transit-visa-924624",
  checked: "2026-10-14",
}
const FR: TransitRule = {
  country: "France",
  code: "FR",
  zone: "schengen",
  freeMovement: FREE_IN_SCHENGEN,
  // France-Visas, airport transit visa page (India removed 10 April 2026). National additions apply to ordinary passports.
  airsideVisa: ["AF", "BD", "CD", "ER", "ET", "GH", "IR", "IQ", "NG", "PK", "SO", "LK", "AO", "BO", "CM", "CF", "TD", "CI", "CU", "DO", "HT", "ML", "MR", "NP", "PH", "GN", "CG", "SN", "SL", "SS", "SD", "SY", "TG", "TR", "UZ"],
  airsideVisaIf: { RU: "Russians need it only when flying in from Armenia, Azerbaijan, Georgia, Ukraine, Belarus, Moldova, Turkey or Egypt." },
  airsideVisaName: "airport transit visa (Schengen type A)",
  exemptWith: [...SCHENGEN_EXEMPT, "uk-residence"],
  exemptionNote: "Residence permits must guarantee your return. Diplomatic passports and Philippine seafarers are exempt too.",
  ...SCHENGEN_ENTRY,
  source: "https://france-visas.gouv.fr/en/web/france-visas/visa-de-transit-aeroportuaire",
  checked: "2026-10-14",
}
const NL: TransitRule = {
  country: "Netherlands",
  code: "NL",
  zone: "schengen",
  freeMovement: FREE_IN_SCHENGEN,
  // EU common list (Reg. 810/2009 Annex IV) plus the Dutch additions in the Dutch AIP GEN 1.3 (AIRAC 07-2026).
  airsideVisa: ["AF", "BD", "CD", "ER", "ET", "GH", "IR", "IQ", "NG", "PK", "SO", "LK", "AO", "IN", "LB", "SY", "TR"],
  airsideVisaName: "airport transit visa (Schengen type A)",
  exemptWith: SCHENGEN_EXEMPT,
  exemptionNote: "Lawful residence in the EU, Canada, Norway, Switzerland or the US also counts.",
  ...SCHENGEN_ENTRY,
  source: "https://eaip.lvnl.nl/web/eaip/AIRAC%20AMDT%2007-2026_2026_07_09/eAIP/EH-GEN%201.3-en-GB.html",
  checked: "2026-10-14",
}
const US: TransitRule = {
  country: "United States",
  code: "US",
  noAirside: true,
  airsideVisa: [],
  airsideVisaName: "transit (C-1) visa",
  entryNote: "Even to change planes you need an ESTA (Visa Waiver countries) or a US visa such as B or C-1.",
  source: "https://travel.state.gov/content/travel/en/us-visas/other-visa-categories/transit.html",
  checked: "2026-10-14",
}

/** Starter rules by airport (IATA). Small on purpose: replace or extend them from Timatic or the official source. */
export const TRANSIT_RULES: Record<string, TransitRule & { airport: string; hours?: string }> = {
  LHR: { ...UK, airport: "London Heathrow" },
  LGW: { ...UK, airport: "London Gatwick" },
  MAN: { ...UK, airport: "Manchester" },
  FRA: { ...DE, airport: "Frankfurt" },
  MUC: { ...DE, airport: "Munich" },
  BER: { ...DE, airport: "Berlin Brandenburg" },
  DUS: { ...DE, airport: "Düsseldorf", hours: "06:00–21:00" },
  HAM: { ...DE, airport: "Hamburg", hours: "04:30–23:30" },
  CDG: { ...FR, airport: "Paris Charles de Gaulle" },
  ORY: { ...FR, airport: "Paris Orly" },
  AMS: { ...NL, airport: "Amsterdam Schiphol" },
  JFK: { ...US, airport: "New York JFK" },
  EWR: { ...US, airport: "Newark" },
  SFO: { ...US, airport: "San Francisco" },
  LAX: { ...US, airport: "Los Angeles" },
}

export interface Layover {
  /** Passport nationality, ISO alpha-2. */
  nationality: string
  /** Airport, IATA code (a key in the rules). */
  airport: string
  /** Where the next flight goes, ISO alpha-2. */
  onward?: string
  /** Planning to leave the airport during the layover. */
  landside?: boolean
  /** Booked as a self-transfer (you rebook and re-check bags yourself). */
  selfTransfer?: boolean
  /** The two flights are on separate tickets. */
  separateTickets?: boolean
  /** The connection changes terminals. */
  terminalChange?: boolean
  /** Layover length in hours. */
  hours?: number
  /** Visas and permits the traveller holds. */
  documents?: TransitDocument[]
}

export type TransitReason =
  | { kind: "citizen" }
  | { kind: "freeMovement" }
  | { kind: "noAirside" }
  | { kind: "selfTransfer" }
  | { kind: "separateTickets" }
  | { kind: "terminal"; certain: boolean }
  | { kind: "leaving" }
  | { kind: "tooLong"; max: number }
  | { kind: "onwardZone"; onward: string }
  | { kind: "onwardLandside"; onward: string }
  | { kind: "airsideVisa"; name: string }
  | { kind: "exempt"; documents: TransitDocument[]; note?: string }
  | { kind: "conditional"; note: string }
  | { kind: "entryExempt"; documents: TransitDocument[] }
  | { kind: "landsideTransit"; documents: TransitDocument[]; note?: string }
  | { kind: "airsideClear" }
  | { kind: "entry"; note: string }
  | { kind: "hours"; hours: string }

export interface TransitCheck {
  /** "visa": a visa is very likely needed; "check": it depends on something only an official source can settle; "clear": no visa listed. */
  verdict: "visa" | "check" | "clear" | "unknown"
  /** True when the plan means passing the border. */
  entering: boolean
  reasons: TransitReason[]
  rule?: TransitRule
}

const code = (s: unknown) => String(s ?? "").trim().toUpperCase().slice(0, 3)

/** Says whether a layover may need a transit or entry visa, and why. Never throws. */
export function checkTransit(layover: Partial<Layover> | null | undefined, rules: Record<string, TransitRule & { hours?: string }> = TRANSIT_RULES): TransitCheck {
  const l = layover ?? {}
  const rule = rules?.[code(l.airport)]
  const nat = code(l.nationality)
  if (!rule || !nat) return { verdict: "unknown", entering: false, reasons: [] }
  if (nat === rule.code) return { verdict: "clear", entering: true, reasons: [{ kind: "citizen" }], rule }
  if (rule.freeMovement?.includes(nat)) return { verdict: "clear", entering: true, reasons: [{ kind: "freeMovement" }], rule }

  const reasons: TransitReason[] = []
  let certain = false
  let maybe = false
  const onward = code(l.onward)
  if (rule.noAirside) { reasons.push({ kind: "noAirside" }); certain = true }
  if (l.selfTransfer) { reasons.push({ kind: "selfTransfer" }); certain = true }
  // Separate tickets without checked bags can stay airside at some hubs, so this is "check", not certain.
  if (l.separateTickets && !l.selfTransfer) { reasons.push({ kind: "separateTickets" }); maybe = true }
  if (l.landside) { reasons.push({ kind: "leaving" }); certain = true }
  if (onward && rule.zone === "schengen" && SCHENGEN.includes(onward)) { reasons.push({ kind: "onwardZone", onward }); certain = true }
  if (onward && rule.landsideOnward?.includes(onward)) { reasons.push({ kind: "onwardLandside", onward }); certain = true }
  if (l.terminalChange && rule.terminalChangeLandside !== false) {
    reasons.push({ kind: "terminal", certain: rule.terminalChangeLandside === true })
    if (rule.terminalChangeLandside) certain = true
    else maybe = true
  }
  const hours = Number(l.hours)
  if (rule.maxAirsideHours && Number.isFinite(hours) && hours > rule.maxAirsideHours) { reasons.push({ kind: "tooLong", max: rule.maxAirsideHours }); certain = true }

  const held = Array.isArray(l.documents) ? l.documents : []
  const among = (list?: TransitDocument[]) => held.filter((d) => list?.includes(d))
  const docs = among(rule.exemptWith)
  const listed = rule.airsideVisa.includes(nat)
  const condition = rule.airsideVisaIf?.[nat]
  if (certain) {
    reasons.push({ kind: "entry", note: rule.entryNote })
    const entryDocs = among(rule.entryExemptWith)
    if (entryDocs.length) {
      reasons.push({ kind: "entryExempt", documents: entryDocs })
      return { verdict: "clear", entering: true, reasons, rule }
    }
    const needsVisa = listed || !!condition || !!rule.entryVisa?.includes(nat)
    const landDocs = among(rule.landsideTransitWith)
    if (needsVisa && landDocs.length) {
      reasons.push({ kind: "landsideTransit", documents: landDocs, note: rule.landsideTransitNote })
      return { verdict: "check", entering: true, reasons, rule }
    }
    return { verdict: needsVisa ? "visa" : "check", entering: true, reasons, rule }
  }
  if ((listed || condition) && docs.length) reasons.push({ kind: "exempt", documents: docs, note: rule.exemptionNote })
  else if (listed) reasons.push({ kind: "airsideVisa", name: rule.airsideVisaName })
  else if (condition) reasons.push({ kind: "conditional", note: condition })
  else reasons.push({ kind: "airsideClear" })
  if (rule.hours) reasons.push({ kind: "hours", hours: rule.hours })
  if (maybe) reasons.push({ kind: "entry", note: rule.entryNote })
  const verdict = listed && !docs.length ? "visa" : listed || condition || maybe ? "check" : "clear"
  return { verdict, entering: false, reasons, rule }
}
