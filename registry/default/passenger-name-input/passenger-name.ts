import { looksSwapped } from "@/registry/default/name-input/name-case"

/** A passenger name as entered on a booking form. */
export interface PassengerName {
  title: string
  given: string
  surname: string
  /** The ID shows a single name only (no surname, or no given name). */
  singleName?: boolean
}

/** The name exactly as the ID shows it, when the form already knows it (a saved passport, a scanned MRZ). */
export interface IdName {
  given: string
  surname: string
}

export interface PassengerNameOptions {
  /** How a single-name passenger is ticketed: "repeat" (IndiGo, and Air India's own page: JONES/JONES) or "fnu" (IATA AIRIMP, required for US and Canada: JONES/FNU). */
  singleNameFormat?: "repeat" | "fnu"
  /** Whether a middle name on the ID must be on the booking. Air India: optional, except to or from the US and Canada. Default "required". */
  middleNames?: "required" | "optional"
  /** Longest printed name the airline takes, title included. Air India allows 59. */
  maxLength?: number
  /** Titles the airline accepts in its title box. */
  titles?: string[]
  /** The name as on the ID, to compare against. */
  id?: IdName | null
}

export type PassengerIssue =
  | { kind: "swapped"; fix: PassengerName }
  | { kind: "title"; word: string; fix: PassengerName }
  | { kind: "suffix"; word: string; fix: PassengerName }
  | { kind: "nickname"; typed: string; full: string; fix?: PassengerName }
  | { kind: "missingName"; missing: string; fix: PassengerName }
  | { kind: "extraName"; extra: string; fix: PassengerName }
  | { kind: "wholeName"; word: string; fix: PassengerName }
  | { kind: "singleName"; fix: PassengerName }
  | { kind: "diacritics"; options: string[]; fixes: PassengerName[] }
  | { kind: "characters"; chars: string }
  | { kind: "tooLong"; length: number; max: number; fix?: PassengerName }

export const PASSENGER_TITLES = ["MR", "MRS", "MS", "MISS", "MSTR"]

/** Honorifics and titles people type into the name itself. Values are the title box to use, if any. */
const TYPED_TITLES: Record<string, string | null> = {
  mr: "MR", mister: "MR", shri: "MR", sri: "MR", mrs: "MRS", smt: "MRS", shrimati: "MRS", ms: "MS", miss: "MISS",
  kumari: "MISS", kum: "MISS", master: "MSTR", mstr: "MSTR", dr: null, doctor: null, prof: null, capt: null, er: null, adv: null, sir: null,
}

/** Short forms that are rarely the name on an ID. Kept small on purpose: only clear-cut pairs. */
export const NICKNAMES: Record<string, string> = {
  bob: "Robert", rob: "Robert", bill: "William", will: "William", mike: "Michael", tom: "Thomas", jim: "James",
  dave: "David", chris: "Christopher", nick: "Nicholas", matt: "Matthew", andy: "Andrew", tony: "Anthony",
  joe: "Joseph", dan: "Daniel", ben: "Benjamin", sam: "Samuel", alex: "Alexander", liz: "Elizabeth",
  beth: "Elizabeth", kate: "Katherine", jen: "Jennifer", jenny: "Jennifer", sue: "Susan", mohd: "Mohammed", md: "Mohammed",
}

/** ICAO Doc 9303 Part 3, section 6.A: characters with two allowed spellings in the passport's machine-readable lines. */
const TWO_WAY: Record<string, [string, string]> = { Ä: ["AE", "A"], Ö: ["OE", "O"], Ü: ["UE", "U"], Å: ["AA", "A"] }
const ONE_WAY: Record<string, string> = { ß: "SS", ẞ: "SS", Æ: "AE", Ø: "OE", Œ: "OE", Þ: "TH", Ĳ: "IJ", Ð: "D", Ł: "L", Đ: "D", Ħ: "H", ı: "I" }

/** Name suffixes. Air India puts them after the surname: OLSEN JR/JOHN MR. */
const SUFFIX = /^(jr|sr|ii|iii|iv)\.?$/i

const clean = (s: unknown) => (typeof s === "string" ? s.replace(/^\uFEFF/, "").replace(/[\r\n\t]+/g, " ").replace(/\s+/g, " ").trim() : "")
const words = (s: string) => clean(s).split(" ").filter(Boolean)
const same = (a: string, b: string) => toTicket(a) === toTicket(b)

/** One spelling of a name in ticket letters: upper case A–Z, hyphens and apostrophes become spaces. */
export function toTicket(name: unknown, variant: 0 | 1 = 0): string {
  return clean(name)
    .toUpperCase()
    .replace(/[ÄÖÜÅ]/g, (c) => TWO_WAY[c][variant])
    .replace(/[ßẞÆØŒÞĲÐŁĐĦı]/gi, (c) => ONE_WAY[c] ?? ONE_WAY[c.toUpperCase()] ?? c)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[-‐‑'’`.]/g, " ")
    .replace(/[^A-Z ]/g, "")
    .replace(/\s+/g, " ")
    .trim()
}

/** The name the way it prints on the ticket and in the airline record: SURNAME/GIVEN NAMES TITLE. */
export function printedName(name: PassengerName, { singleNameFormat = "repeat" }: PassengerNameOptions = {}): string {
  const given = toTicket(name?.given)
  const surname = toTicket(name?.surname)
  const title = toTicket(name?.title)
  if (!given && !surname) return ""
  const [last, first] = name?.singleName
    ? [given || surname, singleNameFormat === "fnu" ? "FNU" : given || surname]
    : [surname, given]
  return `${last}/${[first, title].filter(Boolean).join(" ")}`
}

const withGiven = (n: PassengerName, given: string): PassengerName => ({ ...n, given })

/** Everything about a passenger name that would stop boarding or cost a name-change fee, worst first. */
export function checkPassengerName(name: PassengerName, options: PassengerNameOptions = {}): PassengerIssue[] {
  const { maxLength = 59, titles = PASSENGER_TITLES, id, middleNames = "required" } = options
  const n: PassengerName = { title: clean(name?.title), given: clean(name?.given), surname: clean(name?.surname), singleName: !!name?.singleName }
  const issues: PassengerIssue[] = []
  if (!n.given && !n.surname) return issues

  // A title typed into the name: "Dr Priya", "Mr. Tushar", "Kumari Sneha".
  const g = words(n.given)
  const lead = g[0]?.toLowerCase().replace(/\.$/, "")
  if (g.length > 1 && lead && lead in TYPED_TITLES) {
    const box = TYPED_TITLES[lead]
    const fix = { ...n, given: g.slice(1).join(" "), title: box && titles.includes(box) ? box : n.title }
    issues.push({ kind: "title", word: g[0], fix })
    Object.assign(n, fix)
  }

  // A suffix typed after the first name: "John Jr" + "Olsen" prints as OLSEN JR/JOHN.
  const tail = words(n.given)
  if (!n.singleName && n.surname && tail.length > 1 && SUFFIX.test(tail[tail.length - 1])) {
    const word = tail[tail.length - 1]
    const fix = { ...n, given: tail.slice(0, -1).join(" "), surname: `${n.surname} ${word.replace(/\.$/, "")}` }
    issues.push({ kind: "suffix", word, fix })
    Object.assign(n, fix)
  }

  const idGiven = id ? words(id.given) : []
  const idSurname = id ? words(id.surname) : []
  const typed = words(n.given)
  if (id && (idGiven.length || idSurname.length)) {
    if (!n.singleName && same(n.given, id.surname) && same(n.surname, id.given) && !same(n.given, n.surname)) {
      issues.push({ kind: "swapped", fix: { ...n, given: n.surname, surname: n.given } })
    } else {
      const nick = typed.find((w) => NICKNAMES[w.toLowerCase()] && idGiven.some((x) => same(x, NICKNAMES[w.toLowerCase()])))
      if (nick) {
        const full = idGiven.find((x) => same(x, NICKNAMES[nick.toLowerCase()])) as string
        issues.push({ kind: "nickname", typed: nick, full, fix: withGiven(n, typed.map((w) => (w === nick ? full : w)).join(" ")) })
      } else if (!n.singleName) {
        const missing = idGiven.filter((x) => !typed.some((w) => same(w, x)))
        const extra = typed.filter((w) => !idGiven.some((x) => same(w, x)) && !idSurname.some((x) => same(w, x)))
        if (missing.length && !extra.length && middleNames === "required") issues.push({ kind: "missingName", missing: missing.join(" "), fix: withGiven(n, id.given) })
        else if (extra.length && !missing.length) issues.push({ kind: "extraName", extra: extra.join(" "), fix: withGiven(n, id.given) })
      }
    }
  } else if (!n.singleName && looksSwapped(n.given, n.surname)) {
    issues.push({ kind: "swapped", fix: { ...n, given: n.surname, surname: n.given } })
  } else {
    const nick = typed.find((w) => NICKNAMES[w.toLowerCase()])
    if (nick) issues.push({ kind: "nickname", typed: nick, full: NICKNAMES[nick.toLowerCase()] })
  }

  // Whole name in one box, or a single name with nothing to repeat.
  if (!n.singleName && n.given && !n.surname) {
    const parts = words(n.given)
    if (parts.length > 1) {
      const word = parts[parts.length - 1]
      issues.push({ kind: "wholeName", word, fix: { ...n, given: parts.slice(0, -1).join(" "), surname: word } })
    } else issues.push({ kind: "singleName", fix: { ...n, singleName: true } })
  } else if (!n.singleName && !n.given && n.surname) {
    // Only a last name: printing "KHADDE/" is not a valid ticket name.
    issues.push({ kind: "singleName", fix: { ...n, given: n.surname, surname: "", singleName: true } })
  }

  const raw = `${n.given} ${n.surname}`
  if (/[ÄÖÜÅ]/i.test(raw)) {
    const spell = (s: string, v: 0 | 1) => s.replace(/[ÄÖÜÅ]/gi, (c) => {
      const out = TWO_WAY[c.toUpperCase()][v]
      return c === c.toUpperCase() ? out[0] + out.slice(1).toLowerCase() : out.toLowerCase()
    })
    const fixes = ([0, 1] as const).map((v) => ({ ...n, given: spell(n.given, v), surname: spell(n.surname, v) }))
    issues.push({ kind: "diacritics", options: fixes.map((f) => printedName(f, options)), fixes })
  }
  const bad = [...new Set(raw.normalize("NFD").replace(/[\u0300-\u036f]/g, "").match(/[^\p{L}\s\-‐‑'’`.]/gu) ?? [])]
  if (bad.length) issues.push({ kind: "characters", chars: bad.join(" ") })

  const printed = printedName(n, options)
  if (printed.length > maxLength) {
    // Air India's own advice: keep the first given name and the surname, shorten the rest to initials.
    const parts = words(n.given)
    const short = [parts[0], ...parts.slice(1).map((w) => w[0])].join(" ")
    const fix = withGiven(n, short)
    issues.push({ kind: "tooLong", length: printed.length, max: maxLength, fix: printedName(fix, options).length < printed.length ? fix : undefined })
  }
  return issues
}
