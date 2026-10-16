/** Pure helpers for LinkAccessCheck: finding cloud doc links in a message and working out who can't open them. */

export type DocProvider = "google" | "microsoft" | "dropbox" | "notion" | "figma" | "box"

export interface DocLink {
  url: string
  /** Same document, same key: ?usp=sharing, /edit and /view variants collapse. */
  key: string
  provider: DocProvider
}

export type AccessRole = "view" | "comment" | "edit"
export type GeneralAccess = "restricted" | "organization" | "anyone"

/** What your storage API says about one link. */
export interface LinkAccess {
  /** Shown instead of the URL. */
  title?: string
  general: GeneralAccess
  /** Role that general access gives. */
  generalRole?: AccessRole
  /** You can change sharing on it (owner, or editor allowed to share). */
  canManage: boolean
  /** Who to ask when you can't manage it. */
  ownerName?: string
  /** Per-recipient access by lower-case email. Missing means no direct access; "unknown" means it couldn't be verified. */
  people?: Record<string, AccessRole | "none" | "unknown">
}

export interface Recipient {
  email: string
  name?: string
}

export type LinkIssue =
  | { kind: "noAccess"; recipients: Recipient[]; allInternal: boolean }
  | { kind: "unverified"; recipients: Recipient[] }
  | { kind: "publicExternal"; recipients: Recipient[]; role: AccessRole }

export type LinkFix =
  | { type: "grantView"; link: DocLink; emails: string[] }
  | { type: "requestAccess"; link: DocLink; emails: string[] }
  | { type: "companyOnly"; link: DocLink; alsoGrant: string[] }

const HOSTS: [RegExp, DocProvider][] = [
  [/^(docs|drive|sheets|slides)\.google\.com$/, "google"],
  [/(^|\.)sharepoint\.com$|^onedrive\.live\.com$|^1drv\.ms$/, "microsoft"],
  [/(^|\.)dropbox\.com$/, "dropbox"],
  [/(^|\.)notion\.(so|site)$/, "notion"],
  [/(^|\.)figma\.com$/, "figma"],
  [/(^|\.)box\.com$/, "box"],
]

/** Keys a link by its document, so two pastes of one doc are checked once. */
function keyFor(url: URL, provider: DocProvider) {
  if (provider === "google") {
    const id = /\/d\/([\w-]{10,})/.exec(url.pathname)?.[1] ?? url.searchParams.get("id")
    if (id) return `google:${id}`
  }
  if (provider === "figma") {
    const id = /\/(?:file|design|proto|board)\/([\w-]+)/.exec(url.pathname)?.[1]
    if (id) return `figma:${id}`
  }
  return `${provider}:${url.hostname}${url.pathname.replace(/\/+$/, "")}`
}

/** Finds cloud document links in message text. Handles CRLF, a BOM, angle-bracketed and trailing-punctuation URLs. */
export function findDocLinks(text: unknown, extraHosts: Record<string, DocProvider> = {}): DocLink[] {
  if (typeof text !== "string" || !text) return []
  const clean = text.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n").slice(0, 200_000)
  const seen = new Set<string>()
  const out: DocLink[] = []
  for (const match of clean.matchAll(/\bhttps?:\/\/[^\s<>"'`]+/gi)) {
    const raw = match[0].replace(/[).,;:!?\]}>]+$/, (tail) => {
      // Keep a closing paren that belongs to the URL itself.
      const opens = (match[0].match(/\(/g) ?? []).length
      return opens && tail.startsWith(")") ? tail.slice(1) : tail
    })
    let url: URL
    try {
      url = new URL(raw)
    } catch {
      continue
    }
    const host = url.hostname.toLowerCase()
    const provider = extraHosts[host] ?? HOSTS.find(([re]) => re.test(host))?.[1]
    if (!provider) continue
    const key = keyFor(url, provider)
    if (seen.has(key)) continue
    seen.add(key)
    out.push({ url: raw, key, provider })
    if (out.length >= 50) break
  }
  return out
}

const domainOf = (email: string) => email.slice(email.lastIndexOf("@") + 1).toLowerCase()

export function isInternal(email: string, orgDomains: string[] = []) {
  const domain = domainOf(email)
  return orgDomains.some((d) => {
    const org = d.trim().toLowerCase().replace(/^@/, "")
    return !!org && (domain === org || domain.endsWith("." + org))
  })
}

/** Who can't open the link, who couldn't be checked, and whether a public link is going outside. */
export function linkIssues(access: LinkAccess, recipients: Recipient[], orgDomains: string[] = []): LinkIssue[] {
  const people = access.people ?? {}
  const issues: LinkIssue[] = []
  const missing: Recipient[] = []
  const unknown: Recipient[] = []
  for (const r of recipients) {
    const direct = people[r.email.toLowerCase()]
    const viaGeneral = access.general === "anyone" || (access.general === "organization" && isInternal(r.email, orgDomains))
    if (viaGeneral || (direct && direct !== "none" && direct !== "unknown")) continue
    ;(direct === "unknown" ? unknown : missing).push(r)
  }
  if (missing.length) issues.push({ kind: "noAccess", recipients: missing, allInternal: missing.every((r) => isInternal(r.email, orgDomains)) })
  if (unknown.length) issues.push({ kind: "unverified", recipients: unknown })
  const outside = orgDomains.length ? recipients.filter((r) => !isInternal(r.email, orgDomains)) : []
  if (access.general === "anyone" && outside.length) issues.push({ kind: "publicExternal", recipients: outside, role: access.generalRole ?? "view" })
  return issues
}

/** The one-tap fixes that make sense for an issue. */
export function fixesFor(issue: LinkIssue, link: DocLink, access: LinkAccess, orgDomains: string[] = []): LinkFix[] {
  const emails = issue.recipients.map((r) => r.email)
  if (issue.kind === "noAccess") {
    if (!access.canManage) return [{ type: "requestAccess", link, emails }]
    const fixes: LinkFix[] = [{ type: "grantView", link, emails }]
    if (issue.allInternal && access.general === "restricted" && orgDomains.length) fixes.push({ type: "companyOnly", link, alsoGrant: [] })
    return fixes
  }
  if (issue.kind === "publicExternal" && access.canManage && orgDomains.length) {
    const people = access.people ?? {}
    const alsoGrant = emails.filter((e) => {
      const role = people[e.toLowerCase()]
      return !role || role === "none" || role === "unknown"
    })
    return [{ type: "companyOnly", link, alsoGrant }]
  }
  return []
}
