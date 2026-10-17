// Bollard UI — calendar-external-guest-guard · MIT licence · https://bollard-ui.vercel.app/components/calendar-external-guest-guard

/** Who can open an attached file. Mirrors Google Drive's link settings. */
export type FileAccess = "restricted" | "organization" | "guests" | "anyone"

export interface GuestAttachment {
  id: string
  name: string
  access: FileAccess
}

export interface CalendarGuest {
  email: string
  name?: string
}

export interface GuardedEvent {
  title: string
  /** The agenda or notes guests read in the invite. */
  description?: string
  guests: CalendarGuest[]
  attachments?: GuestAttachment[]
  /** Google Calendar "See guest list". On by default. */
  guestsCanSeeList?: boolean
  /** Google Calendar "Invite others". On by default. */
  guestsCanInvite?: boolean
  /** Google Calendar "Modify event". Off by default. */
  guestsCanModify?: boolean
  /** Part of a series: an outside guest gets every future occurrence. */
  recurring?: boolean
}

export interface DirectoryPerson {
  name: string
  email: string
}

export type ExposureFinding =
  | { kind: "personal"; guest: CalendarGuest; work: DirectoryPerson }
  | { kind: "description"; terms: string[]; lines: string[] }
  | { kind: "file-open"; file: GuestAttachment }
  | { kind: "file-name"; file: GuestAttachment; terms: string[] }
  | { kind: "guest-list"; internal: number; others: number }
  | { kind: "can-invite" }
  | { kind: "can-modify" }

export interface ExternalGuest {
  guest: CalendarGuest
  domain: string
  /** gmail.com, outlook.com and other personal mail providers. */
  personal: boolean
}

export interface Exposure {
  external: ExternalGuest[]
  internal: number
  findings: ExposureFinding[]
}

/** Words that usually mean "not for outside eyes". Override with `sensitiveTerms`. */
export const DEFAULT_SENSITIVE_TERMS = [
  "internal only", "internal use", "confidential", "do not share", "don't share", "not for external", "salary", "salaries",
  "compensation", "payroll", "layoff", "layoffs", "redundancy", "redundancies", "headcount", "performance review",
  "acquisition", "M&A", "pricing floor", "unreleased", "password", "legal hold",
]

/** Curly and modifier apostrophes typed by Docs, Word and phones, read as a plain one. */
export const plainApostrophes = (s: string) => s.replace(/[\u2018\u2019\u02BC]/g, "'")

const PERSONAL_DOMAINS = new Set([
  "gmail.com", "googlemail.com", "outlook.com", "hotmail.com", "live.com", "msn.com", "yahoo.com", "yahoo.co.in",
  "yahoo.co.uk", "ymail.com", "icloud.com", "me.com", "mac.com", "proton.me", "protonmail.com", "aol.com", "rediffmail.com", "gmx.com",
])

export const domainOf = (email: string) => {
  const at = String(email ?? "").trim().toLowerCase().lastIndexOf("@")
  return at > 0 ? String(email).trim().toLowerCase().slice(at + 1).replace(/[>.\s]+$/, "") : ""
}

export const isInternal = (email: string, domains: string[]) => {
  const d = domainOf(email)
  return !!d && domains.some((own) => d === own.toLowerCase() || d.endsWith("." + own.toLowerCase()))
}

const letters = (s: string) => s.normalize("NFKD").replace(/[^\p{L}]/gu, "").toLowerCase()

/** The colleague a personal address probably belongs to: same name, or a local part spelling their name. */
export function findWorkAddress(guest: CalendarGuest, directory: DirectoryPerson[]) {
  const local = letters(String(guest.email ?? "").split("@")[0] ?? "")
  const name = letters(guest.name ?? "")
  const matches = directory.filter((p) => {
    const parts = p.name.trim().split(/\s+/).map(letters).filter(Boolean)
    if (parts.length < 2) return name !== "" && name === letters(p.name)
    const full = parts.join("")
    const flipped = [parts[parts.length - 1], ...parts.slice(0, -1)].join("")
    return (name !== "" && name === full) || local === full || local === flipped || local === parts[0][0] + parts[parts.length - 1]
  })
  // "jsmith@gmail.com" with both John and Jane Smith at work: don't guess, a wrong swap is worse than none.
  return matches.length === 1 ? matches[0] : undefined
}

/** The sensitive terms found in `text`, matched as whole words, case-insensitive; ’ counts as '. */
export function findTerms(text: string, terms: string[]) {
  const found: string[] = []
  const plain = plainApostrophes(String(text ?? ""))
  for (const term of terms) {
    const escaped = plainApostrophes(term).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    if (new RegExp(`(?<![\\p{L}\\d])${escaped}(?![\\p{L}\\d])`, "iu").test(plain)) found.push(term)
  }
  // "internal only" already covers "internal".
  return found.filter((t) => !found.some((o) => o !== t && o.toLowerCase().includes(t.toLowerCase())))
}

/** Removes every description line that mentions a sensitive term. CRLF-safe. */
export function stripSensitiveLines(description: string, terms: string[]) {
  return description
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .filter((line) => findTerms(line, terms).length === 0)
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

/**
 * What outside guests will see or be able to do if this invite goes out, as defined by
 * Google Calendar: the title, description and file names are visible to every guest, an
 * "anyone with the link" or guest-shared file opens for them, and the guest list and
 * invite/modify permissions apply to them too.
 */
export function analyzeExposure(event: GuardedEvent, domains: string[], directory: DirectoryPerson[] = [], terms = DEFAULT_SENSITIVE_TERMS): Exposure {
  const guests = (event.guests ?? []).filter((g) => g && typeof g.email === "string" && g.email.includes("@"))
  const external: ExternalGuest[] = []
  for (const guest of guests) {
    if (isInternal(guest.email, domains)) continue
    const domain = domainOf(guest.email)
    external.push({ guest, domain, personal: PERSONAL_DOMAINS.has(domain) })
  }
  const internal = guests.length - external.length
  const findings: ExposureFinding[] = []
  if (!external.length) return { external, internal, findings }

  for (const e of external) {
    const work = e.personal ? findWorkAddress(e.guest, directory) : undefined
    if (work && !guests.some((g) => g.email.toLowerCase() === work.email.toLowerCase())) findings.push({ kind: "personal", guest: e.guest, work })
  }
  const text = `${event.title ?? ""}\n${event.description ?? ""}`.replace(/^\uFEFF/, "")
  const descTerms = findTerms(text, terms)
  if (descTerms.length) {
    const lines = (event.description ?? "").split(/\r?\n/).filter((l) => findTerms(l, terms).length)
    findings.push({ kind: "description", terms: descTerms, lines })
  }
  for (const file of event.attachments ?? []) {
    if (file.access === "anyone" || file.access === "guests") findings.push({ kind: "file-open", file })
    else {
      const fileTerms = findTerms(file.name, terms)
      if (fileTerms.length) findings.push({ kind: "file-name", file, terms: fileTerms })
    }
  }
  if (event.guestsCanModify) findings.push({ kind: "can-modify" })
  if (event.guestsCanSeeList !== false && guests.length > 1) findings.push({ kind: "guest-list", internal, others: guests.length - 1 })
  if (event.guestsCanInvite !== false) findings.push({ kind: "can-invite" })
  return { external, internal, findings }
}
