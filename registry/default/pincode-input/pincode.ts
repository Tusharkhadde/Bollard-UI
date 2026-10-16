/** Pure Indian PIN and postcode checks. No React. Prefix table from India Post via Wikipedia "Postal Index Number". */

/** First digits of a PIN → state or UT. Longer prefixes win (403 is Goa inside Maharashtra's 40–44). */
const PREFIXES: [string, string][] = [
  ["11", "Delhi"], ["12", "Haryana"], ["13", "Haryana"], ["14", "Punjab"], ["15", "Punjab"], ["16", "Chandigarh"],
  ["17", "Himachal Pradesh"], ["18", "Jammu and Kashmir"], ["19", "Jammu and Kashmir|Ladakh"],
  ...["20", "21", "22", "23", "24", "25", "26", "27", "28"].map((p): [string, string] => [p, "Uttar Pradesh|Uttarakhand"]),
  ...["30", "31", "32", "33", "34"].map((p): [string, string] => [p, "Rajasthan"]),
  ...["36", "37", "38", "39"].map((p): [string, string] => [p, "Gujarat"]),
  ["396", "Gujarat|Dadra and Nagar Haveli and Daman and Diu"],
  ...["40", "41", "42", "43", "44"].map((p): [string, string] => [p, "Maharashtra"]), ["403", "Goa"],
  ...["45", "46", "47", "48"].map((p): [string, string] => [p, "Madhya Pradesh"]), ["49", "Chhattisgarh"],
  ["50", "Telangana"], ["51", "Andhra Pradesh"], ["52", "Andhra Pradesh"], ["53", "Andhra Pradesh"],
  ...["56", "57", "58", "59"].map((p): [string, string] => [p, "Karnataka"]),
  ...["60", "61", "62", "63", "64", "65", "66"].map((p): [string, string] => [p, "Tamil Nadu"]), ["605", "Puducherry|Tamil Nadu"],
  ...["67", "68", "69"].map((p): [string, string] => [p, "Kerala"]), ["682", "Kerala|Lakshadweep"],
  ...["70", "71", "72", "73", "74"].map((p): [string, string] => [p, "West Bengal"]), ["737", "Sikkim"], ["744", "Andaman and Nicobar Islands"],
  ...["75", "76", "77"].map((p): [string, string] => [p, "Odisha"]), ["78", "Assam"],
  ["790", "Arunachal Pradesh"], ["791", "Arunachal Pradesh"], ["792", "Arunachal Pradesh"], ["793", "Meghalaya"], ["794", "Meghalaya"],
  ["795", "Manipur"], ["796", "Mizoram"], ["797", "Nagaland"], ["798", "Nagaland"], ["799", "Tripura"],
  ...["80", "81", "82", "83", "84", "85"].map((p): [string, string] => [p, "Bihar|Jharkhand"]),
]
const BY_PREFIX = new Map(PREFIXES)

export type PinRegion = { kind: "state"; states: string[] } | { kind: "army" } | { kind: "unassigned"; prefix: string }

/** Where a PIN (or its first 2–3 digits) belongs, from its prefix alone, with no network call. */
export function pinRegion(pin: string): PinRegion | null {
  if (!/^\d{2,}/.test(pin)) return null
  if (pin[0] === "9") return { kind: "army" }
  if (pin.length === 2) {
    // Two digits can't tell Goa (403) from Maharashtra (40) or Sikkim (737) from West Bengal (73), so name every candidate.
    const states = PREFIXES.filter(([p]) => p.startsWith(pin)).flatMap(([, s]) => s.split("|"))
    return states.length ? { kind: "state", states: [...new Set(states)] } : { kind: "unassigned", prefix: pin }
  }
  const hit = BY_PREFIX.get(pin.slice(0, 3)) ?? BY_PREFIX.get(pin.slice(0, 2))
  return hit ? { kind: "state", states: hit.split("|") } : { kind: "unassigned", prefix: pin.slice(0, 2) }
}

// Zero of every Indic script plus Arabic-Indic and fullwidth digits.
const ZEROS = [0x0966, 0x09e6, 0x0a66, 0x0ae6, 0x0b66, 0x0be6, 0x0c66, 0x0ce6, 0x0d66, 0x0660, 0x06f0, 0xff10]

/** Converts other-script digits to 0–9 and drops spaces, dashes and a leading "PIN"/"Pincode" label. Letters stay. */
export function normalizePostcode(raw: string) {
  const ascii = [...raw]
    .map((c) => {
      const code = c.codePointAt(0)!
      const zero = ZEROS.find((z) => code >= z && code <= z + 9)
      return zero === undefined ? c : String(code - zero)
    })
    .join("")
  return ascii.replace(/^\s*(pin\s*code|pincode|pin|zip)\s*[:\-]?\s*/i, "")
}

/** Postcode shapes used to notice a code from another country. India is checked separately. */
export const POSTCODE_SHAPES: Record<string, { name: string; label: string; pattern: RegExp | null }> = {
  US: { name: "US", label: "ZIP code", pattern: /^\d{5}(-\d{4})?$/ },
  GB: { name: "UK", label: "postcode", pattern: /^[A-PR-UWYZ][A-HK-Y]?\d[A-Z\d]? ?\d[ABD-HJLNP-UW-Z]{2}$/i },
  CA: { name: "Canadian", label: "postal code", pattern: /^[ABCEGHJ-NPRSTVXY]\d[A-Z] ?\d[A-Z]\d$/i },
  NL: { name: "Dutch", label: "postcode", pattern: /^[1-9]\d{3} ?[A-RT-Z]{2}$/i },
  JP: { name: "Japanese", label: "postal code", pattern: /^\d{3}-\d{4}$/ },
  AU: { name: "Australian", label: "postcode", pattern: /^\d{4}$/ },
  SG: { name: "Singapore", label: "postal code", pattern: /^\d{6}$/ },
  DE: { name: "German", label: "postcode", pattern: /^\d{5}$/ },
  AE: { name: "UAE", label: "postcode", pattern: null },
}

export type PostcodeProblem =
  | { kind: "letter-digit"; fixed: string }
  /** A PIN pasted with other text around it ("Pune - 411039"). `fixed` is the PIN alone. */
  | { kind: "extra-text"; fixed: string }
  | { kind: "length"; length: number; expected: number }
  | { kind: "leading-zero" }
  | { kind: "unassigned"; prefix: string }
  | { kind: "army" }
  | { kind: "other-country"; country: string }
  | { kind: "invalid" }
  | { kind: "no-postcodes" }

/** The first problem with a postcode for a country (ISO code), or null. `complete` is false while still typing. */
export function findPostcodeProblem(code: string, country = "IN", complete = true): PostcodeProblem | null {
  if (!code) return null
  if (country === "IN") {
    const compact = code.replace(/[\s-]/g, "")
    const fixed = compact.replace(/[oO]/g, "0").replace(/[lIi|]/g, "1")
    if (fixed !== compact && /^\d+$/.test(fixed)) return { kind: "letter-digit", fixed }
    const runs = code.match(/(?<!\d)[1-8]\d{5}(?!\d)/g)
    if (runs?.length === 1 && /[a-z]/i.test(compact)) return { kind: "extra-text", fixed: runs[0] }
    if (/[a-z]/i.test(compact) || /^\d{5}(-\d{4})?$/.test(code) || /^\d{3}-\d{4}$/.test(code)) {
      const other = Object.keys(POSTCODE_SHAPES).find((c) => c !== "SG" && c !== "AU" && POSTCODE_SHAPES[c].pattern?.test(code.trim()))
      if (other && (complete || /[a-z]/i.test(compact))) return { kind: "other-country", country: other }
      if (/[a-z]/i.test(compact)) return { kind: "invalid" }
    }
    if (compact[0] === "0") return { kind: "leading-zero" }
    const region = pinRegion(compact)
    if (region?.kind === "unassigned") return region
    if (compact.length > 6 || (complete && compact.length !== 6)) return { kind: "length", length: compact.length, expected: 6 }
    if (region?.kind === "army" && compact.length === 6) return { kind: "army" }
    return null
  }
  const shape = POSTCODE_SHAPES[country]
  if (!shape) return null
  if (!shape.pattern) return { kind: "no-postcodes" }
  if (!complete || shape.pattern.test(code.trim())) return null
  if (/^[1-8]\d{5}$/.test(code.replace(/\s/g, ""))) return { kind: "other-country", country: "IN" }
  return { kind: "invalid" }
}

/** Old and new names for the same city, so "Bombay" matches "Mumbai". */
const CITY_ALIASES: Record<string, string> = {
  bombay: "mumbai", poona: "pune", bangalore: "bengaluru", calcutta: "kolkata", madras: "chennai", gurgaon: "gurugram",
  trivandrum: "thiruvananthapuram", baroda: "vadodara", mysore: "mysuru", cochin: "kochi", benares: "varanasi", pondicherry: "puducherry",
}
const cityKey = (s: string) => {
  const k = s.toLowerCase().replace(/\b(city|district|urban|rural|east|west|north|south|central|new)\b/g, "").replace(/[^a-z]/g, "")
  return CITY_ALIASES[k] ?? k
}
/** True when a typed city matches the looked-up district or any area name. */
export function sameCity(typed: string, place: { district: string; areas?: string[] }) {
  const key = cityKey(typed)
  const names = [place.district, ...(place.areas ?? [])]
  // Any shared word of 4+ letters also counts: "Pimpri Chinchwad" vs the "Pimpri Colony" post office.
  const words = (s: string) => s.toLowerCase().split(/[^a-z]+/).filter((w) => w.length >= 4).map((w) => CITY_ALIASES[w] ?? w)
  const typedWords = words(typed)
  return (
    !key ||
    names.some((n) => {
      const other = cityKey(n)
      return (!!other && (other.includes(key) || key.includes(other))) || words(n).some((w) => typedWords.includes(w))
    })
  )
}
const STATE_ALIASES: Record<string, string> = { orissa: "odisha", uttaranchal: "uttarakhand", pondicherry: "puducherry", nctdelhi: "delhi" }
const stateKey = (s: string) => {
  // "Jammu & Kashmir" = "Jammu and Kashmir", "NCT of Delhi" = "Delhi", "Orissa" = "Odisha".
  const k = s.toLowerCase().replace(/&/g, " and ").replace(/\b(and|of|the|state|ut)\b/g, "").replace(/[^a-z]/g, "")
  return STATE_ALIASES[k] ?? k
}
/** True when two state names mean the same state, allowing "&" for "and" and old names. */
export const sameState = (a: string, b: string) => stateKey(a) === stateKey(b)

/** Where a PIN is, as your lookup returns it. */
export interface PinPlace {
  /** District or city, e.g. "Pune". */
  district: string
  state: string
  /** Post office or locality names sharing the PIN, e.g. ["Bhosari", "Dighi Camp"]. */
  areas?: string[]
}

/** A lookup for India Post's public API (api.postalpincode.in). Resolves null when no post office has the PIN. */
export function createIndiaPostLookup(base = "https://api.postalpincode.in/pincode/") {
  return async (pin: string, signal: AbortSignal): Promise<PinPlace | null> => {
    const res = await fetch(base + pin, { signal })
    if (!res.ok) throw new Error(`PIN lookup failed: ${res.status}`)
    const [data] = (await res.json()) as { Status: string; PostOffice: { Name: string; District: string; State: string }[] | null }[]
    const offices = data?.Status === "Success" ? data.PostOffice ?? [] : []
    if (!offices.length) return null
    return { district: offices[0].District, state: offices[0].State, areas: offices.map((o) => o.Name) }
  }
}
