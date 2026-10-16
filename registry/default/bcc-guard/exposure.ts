/**
 * Pure helpers for bcc-guard: who can see whom on an email, how much that gives away, and whether being
 * on the list is itself sensitive. Safe to run on the server.
 */

export interface Recipients {
  to: string[]
  cc: string[]
  bcc: string[]
}

export interface ParsedRecipient {
  /** The entry as given, e.g. "Alex Morgan <alex.morgan@gmail.com>". */
  raw: string
  /** Lower-cased address, or "" when the entry has none. */
  address: string
  /** Domain part, lower-cased. */
  domain: string
  /** The display name, when the entry has one. */
  name?: string
  /** True when the address or display name gives away a person's name (alex.morgan@, jsmith@, "Alex Morgan"). */
  named: boolean
}

export interface Exposure {
  /** People in To and Cc who aren't inside your domains: each of them sees all the others. */
  outside: ParsedRecipient[]
  /** Distinct organisations those outsiders reveal; each personal mailbox (gmail, outlook…) counts as its own. */
  organisations: number
  /** Distinct company domains among them. */
  companies: number
  /** Outsiders on personal mailboxes (gmail, outlook…): private individuals. */
  personal: number
  /** Outsiders whose address or display name carries their name. */
  names: number
  /** Sensitive terms found in the subject or body, exactly as written there. */
  sensitive: string[]
  /** True when outsiders from `exposeAt` or more organisations see each other, or any two do on a sensitive email. */
  exposed: boolean
}

/** Mailbox providers whose users are individuals, so each address is a separate person, not one company. */
export const PERSONAL_DOMAINS = [
  "gmail.com", "googlemail.com", "outlook.com", "hotmail.com", "hotmail.co.uk", "live.com", "msn.com", "yahoo.com", "yahoo.co.uk",
  "yahoo.co.in", "icloud.com", "me.com", "mac.com", "aol.com", "proton.me", "protonmail.com", "gmx.com", "gmx.de", "web.de", "mail.com",
  "btinternet.com", "sky.com", "virginmedia.com", "rediffmail.com", "zoho.com", "yandex.ru", "qq.com", "163.com",
]

/** Shared mailboxes that don't name a person. */
const ROLE = /^(info|admin|sales|support|hello|hi|contact|office|team|noreply|no-reply|accounts?|billing|hr|jobs|careers|enquiries|inquiries|help|mail|marketing|press|media|reception|finance|legal|privacy|security|webmaster|postmaster|orders|bookings?|service|customerservice|newsletter)$/

/**
 * Being on a list with any of these says something about you. Matched as whole words, case-insensitive.
 * "patient" alone is deliberately absent: a dentist's reminder list isn't sensitive.
 */
export const DEFAULT_SENSITIVE_TERMS = [
  "HIV", "PrEP", "sexual health", "STI", "hepatitis", "cancer", "oncology", "chemotherapy", "dementia", "mental health", "psychiatric",
  "counselling", "counseling", "therapy group", "rehab", "addiction", "alcoholics", "IVF", "fertility", "abortion",
  "miscarriage", "pregnancy", "arrears", "debt advice", "overdue", "eviction", "bankruptcy", "insolvency", "food bank", "benefits claim",
  "domestic abuse", "domestic violence", "asylum", "refugee", "immigration status", "probation", "parole", "redundancy",
  "disciplinary", "grievance", "whistleblow", "gender identity", "transgender", "LGBT",
]

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
const EMAIL = /[^\s<>"',;]+@[^\s<>"',;]+\.[^\s<>"',;]+/

/** Parses "Name <addr>" or a bare address. Never throws. */
export function parseRecipient(raw: unknown): ParsedRecipient {
  const text = typeof raw === "string" ? raw.replace(/^\uFEFF/, "").trim() : ""
  const address = (EMAIL.exec(text)?.[0] ?? "").toLowerCase()
  // The address is lower-cased above, so strip it case-insensitively or a bare "Alex.Morgan@Gmail.com" becomes its own "name".
  const name = address
    ? text.replace(/<[^>]*>/, "").replace(new RegExp(escapeRe(address), "i"), "").replace(/["']/g, "").trim() || undefined
    : undefined
  const [local = "", domain = ""] = address.split("@")
  const parts = local.replace(/\+.*$/, "").split(/[._-]+/).filter((p) => /^[a-z]+\d*$/.test(p))
  const namedLocal = !ROLE.test(local) && ((parts.length >= 2 && parts.some((p) => /^[a-z]{2,}/.test(p))) || /^[a-z][a-z]{3,}\d*$/.test(local))
  const namedDisplay = !!name && /\p{L}{2,}\s+\p{L}{2,}/u.test(name)
  return { raw: text, address, domain, name, named: !!address && (namedLocal || namedDisplay) }
}

const domainOf = (r: ParsedRecipient) => r.domain
const isInside = (domain: string, internal: string[]) => internal.some((d) => domain === d || domain.endsWith(`.${d}`))

/**
 * Every sensitive term found in the text, as it is written there (first spelling wins). Matching is
 * case-insensitive, except for a term written in mixed case with a capital after a lower-case letter
 * ("PrEP"), which must match exactly so "board prep" isn't read as HIV prevention.
 */
export function findSensitiveTerms(text: string, terms: string[] = DEFAULT_SENSITIVE_TERMS): string[] {
  const found = new Map<string, string>()
  for (const term of terms) {
    if (!term.trim()) continue
    const exact = /\p{Ll}\p{Lu}/u.test(term)
    const m = new RegExp(`(?<![\\p{L}\\p{N}])${escapeRe(term.trim())}(?![\\p{L}\\p{N}])`, exact ? "u" : "iu").exec(text)
    if (m) found.set(term.toLowerCase(), m[0])
  }
  return [...found.values()]
}

/** Works out what each recipient of this email can see about the others. */
export function analyseExposure(
  value: Partial<Recipients> | null | undefined,
  opts: { internalDomains?: string[]; subject?: string; body?: string; sensitiveTerms?: string[]; exposeAt?: number; from?: string } = {},
): Exposure {
  const internal = (opts.internalDomains ?? []).map((d) => d.toLowerCase().replace(/^@/, ""))
  // The sender sees the list anyway; putting yourself in To (and everyone else in Bcc) is the safe pattern.
  const seen = new Set<string>(opts.from ? [parseRecipient(opts.from).address].filter(Boolean) : [])
  const outside: ParsedRecipient[] = []
  for (const raw of [...(value?.to ?? []), ...(value?.cc ?? [])]) {
    const r = parseRecipient(raw)
    if (!r.address || seen.has(r.address) || isInside(r.domain, internal)) continue
    seen.add(r.address)
    outside.push(r)
  }
  const orgs = new Set(outside.map((r) => (PERSONAL_DOMAINS.includes(domainOf(r)) ? r.address : domainOf(r))))
  const sensitive = findSensitiveTerms(`${opts.subject ?? ""}\n${opts.body ?? ""}`, opts.sensitiveTerms)
  const exposeAt = Math.max(2, opts.exposeAt ?? 3)
  return {
    outside,
    organisations: orgs.size,
    companies: new Set(outside.filter((r) => !PERSONAL_DOMAINS.includes(r.domain)).map(domainOf)).size,
    personal: outside.filter((r) => PERSONAL_DOMAINS.includes(r.domain)).length,
    names: outside.filter((r) => r.named).length,
    sensitive,
    exposed: outside.length >= 2 && (orgs.size >= exposeAt || (sensitive.length > 0 && orgs.size >= 2)),
  }
}

/** Moves every outside To/Cc recipient to Bcc, keeping insiders where they are. `from` fills an emptied To line. */
export function moveOutsideToBcc(value: Recipients, internalDomains: string[] = [], from?: string): Recipients {
  const internal = internalDomains.map((d) => d.toLowerCase().replace(/^@/, ""))
  const self = from ? parseRecipient(from).address : ""
  const stays = (raw: string) => {
    const r = parseRecipient(raw)
    return !r.address || r.address === self || isInside(r.domain, internal)
  }
  const moved = [...value.to, ...value.cc].filter((r) => !stays(r))
  const to = value.to.filter(stays)
  return { to: to.length || !from ? to : [from], cc: value.cc.filter(stays), bcc: [...value.bcc, ...moved] }
}
