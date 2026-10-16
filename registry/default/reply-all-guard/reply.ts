/** Pure helpers for ReplyAllGuard: address parsing and the reply-all recipient set (RFC 5322 §3.6.3). */

export interface Mailbox {
  name?: string
  email: string
}

/** A header value ("Priya <p@acme.com>, b@x.io"), an array of those, or mailbox objects. */
export type AddressInput = string | Mailbox | (string | Mailbox)[] | null | undefined

export interface ReplySource {
  from: AddressInput
  replyTo?: AddressInput
  to?: AddressInput
  cc?: AddressInput
}

export interface ReplyAllOptions {
  /** Your own addresses, aliases included. */
  me: string | string[]
  /** Domains that count as internal. Subdomains match too. */
  orgDomains?: string[]
  /** Member counts for list addresses, e.g. { "all-staff@acme.com": 1240 }. */
  listSizes?: Record<string, number>
  /** Lists you belong to: receiving through one of them is not a BCC. */
  myLists?: string[]
}

export interface ReplyAllPlan {
  /** Where a plain reply goes: Reply-To when set, else From. */
  sender: Mailbox[]
  to: Mailbox[]
  cc: Mailbox[]
  /** People reached, with lists expanded by their member count. */
  reach: number
  external: Mailbox[]
  lists: { mailbox: Mailbox; size: number }[]
  /** You are on neither To nor Cc (nor a list you're in), so you were BCC'd. */
  bcc: boolean
  /** Sent to "undisclosed-recipients:;" — everyone was BCC'd. */
  undisclosed: boolean
  /** Reply-To points at a different domain from From (a subdomain of it, like mail.acme.com, counts as the same). */
  replyToElsewhere: boolean
}

const EMAIL = /^[^\s@<>(),;:"]+@[^\s@<>(),;:"]+\.[^\s@<>(),;:"]+$/

/** Splits on commas outside quotes, angle brackets and comments; handles CRLF folding, a BOM and group syntax. */
export function parseAddressList(input: AddressInput): Mailbox[] {
  if (input == null) return []
  if (Array.isArray(input)) return input.flatMap((item) => parseAddressList(item))
  if (typeof input === "object") {
    const email = typeof input.email === "string" ? input.email.trim() : ""
    return EMAIL.test(email) ? [{ name: typeof input.name === "string" && input.name.trim() ? input.name.trim() : undefined, email }] : []
  }
  if (typeof input !== "string") return []
  const text = input.replace(/^\uFEFF/, "").replace(/\r?\n[ \t]+/g, " ").replace(/\r\n?/g, "\n").slice(0, 100_000)
  const parts: string[] = []
  let depth = 0
  let quoted = false
  let angle = false
  let current = ""
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (ch === "\\" && quoted) {
      current += ch + (text[++i] ?? "")
      continue
    }
    if (ch === '"') quoted = !quoted
    else if (!quoted && ch === "(") depth++
    else if (!quoted && ch === ")") depth = Math.max(0, depth - 1)
    else if (!quoted && !depth && ch === "<") angle = true
    else if (!quoted && !depth && ch === ">") angle = false
    // Group syntax: "Team: a@x, b@y;" — the label is dropped, members kept.
    if (!quoted && !depth && !angle && ch === ":" && !current.includes("@")) {
      current = ""
      continue
    }
    if (!quoted && !depth && !angle && (ch === "," || ch === ";" || ch === "\n")) {
      parts.push(current)
      current = ""
      continue
    }
    current += ch
  }
  parts.push(current)
  return parts.flatMap((raw): Mailbox[] => {
    const part = raw.replace(/\([^)]*\)/g, " ").trim()
    if (!part) return []
    const angled = /<([^<>]+)>/.exec(part)
    const email = (angled ? angled[1] : part).trim().replace(/^mailto:/i, "")
    if (!EMAIL.test(email)) return []
    const name = angled ? part.slice(0, angled.index).trim().replace(/^"(.*)"$/s, "$1").replace(/\\(.)/g, "$1").trim() : ""
    return [{ name: name || undefined, email }]
  })
}

/** Lower-cases, drops +tags, and drops dots for Gmail, so aliases of one inbox compare equal. */
export function addressKey(email: string) {
  const [local = "", domain = ""] = email.trim().toLowerCase().split(/@(?=[^@]*$)/)
  const bare = local.split("+")[0]
  const gmail = domain === "gmail.com" || domain === "googlemail.com"
  return `${gmail ? bare.replace(/\./g, "") : bare}@${gmail ? "gmail.com" : domain}`
}

/** acme.com and mail.acme.com are one site for Reply-To purposes. */
const sameSite = (a: string, b: string) => a === b || a.endsWith("." + b) || b.endsWith("." + a)

export const domainOf = (email: string) => email.slice(email.lastIndexOf("@") + 1).toLowerCase()

export function isInternal(email: string, orgDomains: string[] = []) {
  const domain = domainOf(email)
  return orgDomains.some((d) => {
    const org = d.trim().toLowerCase().replace(/^@/, "")
    return !!org && (domain === org || domain.endsWith("." + org))
  })
}

/** Builds the reply-all recipients the way mail clients do and says what is risky about them. */
export function planReplyAll(source: ReplySource, options: ReplyAllOptions): ReplyAllPlan {
  const mine = new Set((Array.isArray(options.me) ? options.me : [options.me]).filter((e): e is string => typeof e === "string").map(addressKey))
  const lists = new Set((options.myLists ?? []).map(addressKey))
  const sizes = new Map(Object.entries(options.listSizes ?? {}).map(([k, v]) => [addressKey(k), Math.max(1, Math.floor(Number(v)) || 1)]))
  const from = parseAddressList(source?.from)
  const replyTo = parseAddressList(source?.replyTo)
  const to = parseAddressList(source?.to)
  const cc = parseAddressList(source?.cc)
  const rawTo = typeof source?.to === "string" ? source.to : ""
  const undisclosed = !to.length && !cc.length && /undisclosed|recipients\s*:\s*;/i.test(rawTo)

  const seen = new Set<string>()
  const take = (list: Mailbox[]) =>
    list.filter((m) => {
      const key = addressKey(m.email)
      if (mine.has(key) || seen.has(key)) return false
      seen.add(key)
      return true
    })
  const sentByMe = from.some((m) => mine.has(addressKey(m.email)))
  const sender = (replyTo.length ? replyTo : from).filter((m) => !mine.has(addressKey(m.email)))
  // Replying to your own message: the original To becomes the To again.
  const replyTo_ = take(sentByMe ? to : sender)
  const replyCc = take(sentByMe ? cc : [...to, ...cc])
  const everyone = [...replyTo_, ...replyCc]
  const onVisible = [...from, ...to, ...cc].some((m) => mine.has(addressKey(m.email)) || lists.has(addressKey(m.email)))
  const fromDomain = from[0] ? domainOf(from[0].email) : ""

  return {
    sender,
    to: replyTo_,
    cc: replyCc,
    reach: everyone.reduce((sum, m) => sum + (sizes.get(addressKey(m.email)) ?? 1), 0),
    external: options.orgDomains?.length ? everyone.filter((m) => !isInternal(m.email, options.orgDomains)) : [],
    lists: everyone.filter((m) => sizes.has(addressKey(m.email))).map((m) => ({ mailbox: m, size: sizes.get(addressKey(m.email)) as number })),
    bcc: !onVisible && (from.length > 0 || undisclosed),
    undisclosed,
    replyToElsewhere: replyTo.length > 0 && !!fromDomain && replyTo.some((m) => !sameSite(domainOf(m.email), fromDomain)),
  }
}
