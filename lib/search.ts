// Client-safe search over the catalog, shared by /components, the sidebar and ⌘K.
//
// Any-word matching with ranking: a word in the title counts most, then the
// `stops` headline, the mistakes and the aliases, then the flows, field types
// and category, then the description. Query words are expanded with a small
// synonym map ("signup" → sign up / register / email), loosely stemmed
// ("deleting" = "delete" = "deletion"), and essentials get a fixed boost.
// A search never comes back empty: with no match it returns the closest few.
import { ESSENTIALS, FLOWS, KITS } from "./kits"

export interface SearchItem {
  name: string
  title: string
  description: string
  category: string
  /** One-line incident: the `stops` field, or a line derived from the description. */
  headline?: string
  stops?: string
  mistakes?: string[]
  aliases?: string[]
  flows?: string[]
  fields?: string[]
  essential?: boolean
  integration?: "headless" | "styled"
  hasDependencies?: boolean
  hasA11yGuidance?: boolean
}

// ---------------------------------------------------------------------------
// Tokens

const STOPWORDS = new Set(
  "a an the to of on in for with and or is are was were be it its into by at from as my our your their his her them they we i you me user users people someone somebody customer customers when after before while how what why get gets got can cant could should would will did does do too very this that these those so if not no just accidentally accidental by mistake mistakes wrong component components ui react".split(
    " ",
  ),
)
// "wrong" and "mistake" describe every component here, so they carry no signal.

const SUFFIXES = ["ations", "ation", "ings", "ing", "ions", "ion", "ers", "er", "ies", "ied", "ed", "es", "s", "e", "y"]

/** A loose stem: enough to make delete/deleting/deletion and key/keys meet. */
export function stem(word: string) {
  if (/^\d|^plus\d/.test(word) || word.length <= 3) return word
  for (const suffix of SUFFIXES) {
    if (word.endsWith(suffix) && word.length - suffix.length >= 3) return word.slice(0, -suffix.length)
  }
  return word
}

const normalize = (text: string) =>
  text
    .toLowerCase()
    .replace(/\+\s?(\d{1,4})\b/g, " plus$1 ")
    .replace(/₹/g, " rupee ")
    .replace(/\$/g, " dollar ")
    .replace(/[’']/g, "")

/** Lower-cased words of a text, split on anything that isn't a letter or digit. "+91" becomes "plus91". */
export const words = (text: string) => normalize(text).split(/[^\p{L}\p{N}]+/u).filter(Boolean)

const stems = (text: string) => words(text).map(stem)

// ---------------------------------------------------------------------------
// Synonyms: query word (stemmed) → extra words to look for, at a discount.

const SYNONYM_GROUPS: Record<string, string[]> = {
  signup: ["sign up", "register", "registration", "onboarding", "email", "password", "username", "create account", "join"],
  register: ["signup", "sign up", "registration"],
  login: ["log in", "sign in", "signin", "auth", "password", "otp", "session"],
  signin: ["login", "sign in", "auth"],
  auth: ["login", "sign in", "authentication", "otp", "mfa", "passkey"],
  checkout: ["payment", "pay", "card", "amount", "charge", "cart", "order", "purchase"],
  cart: ["checkout", "order", "quantity", "coupon"],
  pay: ["payment", "amount", "charge", "transfer", "checkout"],
  payment: ["pay", "amount", "charge", "transfer", "checkout", "money"],
  money: ["amount", "payment", "currency", "price"],
  price: ["amount", "currency", "money"],
  amount: ["money", "payment", "currency", "price", "sum"],
  currency: ["amount", "money"],
  transfer: ["payment", "send money", "amount", "bank"],
  charge: ["payment", "billing", "double charge"],
  billing: ["charge", "subscription", "invoice", "payment"],
  card: ["credit card", "card number", "expiry", "payment"],
  zero: ["amount", "extra zero", "digits"],
  digit: ["amount", "number", "zero"],
  phone: ["mobile", "mobile number", "phone number", "telephone", "sms", "plus91"],
  mobile: ["phone", "phone number"],
  number: ["digits", "phone", "amount"],
  india: ["indian", "plus91", "aadhaar", "upi", "ifsc", "gst", "pan", "lakh", "rupee", "pincode"],
  indian: ["india", "plus91"],
  plus91: ["india", "phone", "mobile", "indian phone"],
  email: ["e-mail", "mail", "address"],
  mail: ["email"],
  newsletter: ["email", "signup", "subscribe"],
  delete: ["remove", "destroy", "deletion", "drop", "erase", "trash", "close"],
  remove: ["delete", "revoke"],
  destroy: ["delete", "drop"],
  close: ["delete", "deletion", "cancel"],
  cancel: ["undo", "close", "cancellation"],
  undo: ["revert", "rollback", "restore", "cancel"],
  twice: ["duplicate", "double", "again", "repeat", "second"],
  double: ["duplicate", "twice", "repeat"],
  duplicate: ["double", "twice", "dedupe"],
  again: ["duplicate", "twice", "repeat"],
  sent: ["send", "sending"],
  send: ["sent", "sending", "deliver"],
  paste: ["pasted", "clipboard", "copy"],
  key: ["secret", "token", "credential", "api key"],
  api: ["key", "token", "secret"],
  token: ["secret", "key", "credential"],
  secret: ["key", "token", "credential", "password"],
  password: ["passphrase", "secret", "credential"],
  otp: ["one time code", "verification code", "2fa", "code"],
  code: ["otp", "snippet"],
  date: ["day", "calendar", "time", "deadline"],
  time: ["date", "timezone", "clock", "schedule"],
  timezone: ["time zone", "tz", "utc"],
  schedule: ["calendar", "date", "time", "booking"],
  calendar: ["date", "schedule", "event"],
  form: ["field", "input", "submit", "fields"],
  field: ["input", "form"],
  input: ["field"],
  typo: ["misspell", "misspelled", "typos"],
  prod: ["production"],
  production: ["prod", "environment", "live"],
  deploy: ["release", "production", "rollout"],
  git: ["commit", "branch", "push"],
  chat: ["message", "messaging", "slack"],
  message: ["chat", "send", "email"],
  share: ["link", "sharing", "access"],
  upload: ["file", "attachment"],
  file: ["upload", "attachment"],
  setting: ["settings", "preferences", "account"],
  account: ["profile", "settings"],
  leak: ["leaked", "exposed", "secret"],
}

const SYNONYMS = new Map<string, string[][]>()
for (const [word, list] of Object.entries(SYNONYM_GROUPS)) {
  SYNONYMS.set(
    stem(word),
    list.map((phrase) => stems(phrase)),
  )
}

/** Query words that point at a flow; items in that flow get a boost, items in its kit a bigger one. */
const FLOW_INTENT: Record<string, string> = {
  checkout: "checkout", cart: "checkout", pay: "checkout", payment: "checkout", card: "checkout", billing: "checkout", purchase: "checkout",
  signup: "signup-login", register: "signup-login", login: "signup-login", signin: "signup-login", auth: "signup-login", onboarding: "signup-login", newsletter: "signup-login",
  setting: "account-settings", settings: "account-settings", profile: "account-settings", account: "account-settings",
  danger: "danger-zone", delete: "danger-zone", destroy: "danger-zone",
  form: "forms", forms: "forms", submit: "forms",
  chat: "messaging", message: "messaging", share: "messaging", reply: "messaging", send: "messaging",
  deploy: "devtools", git: "devtools", infra: "devtools", kubernetes: "devtools", terraform: "devtools", devops: "devtools", prod: "devtools", production: "devtools",
  date: "scheduling", calendar: "scheduling", schedule: "scheduling", timezone: "scheduling", meeting: "scheduling",
  india: "india", indian: "india", plus91: "india", upi: "india", aadhaar: "india", gst: "india", rupee: "india",
}
const FLOW_INTENT_STEMMED = new Map(Object.entries(FLOW_INTENT).map(([k, v]) => [stem(k), v]))

const FIELD_INTENT: Record<string, string> = {
  email: "email", mail: "email",
  phone: "phone", mobile: "phone", plus91: "phone",
  amount: "amount", money: "amount", price: "amount", currency: "amount", zero: "amount",
  date: "datetime", time: "datetime", timezone: "datetime",
  key: "secret", secret: "secret", token: "secret", password: "secret", api: "secret",
  file: "file", upload: "file", attachment: "file",
  url: "url", link: "url",
}
const FIELD_INTENT_STEMMED = new Map(Object.entries(FIELD_INTENT).map(([k, v]) => [stem(k), v]))

// ---------------------------------------------------------------------------
// Index

const W = {
  title: 10,
  titlePrefix: 7,
  incident: 6, // stops, mistakes, aliases
  incidentPrefix: 4,
  tag: 3, // flows, fields
  category: 2,
  description: 1.5,
  descriptionPrefix: 1,
  synonym: 0.6,
  phrase: 8,
  titleCovered: 5,
  essential: 3,
  flowIntent: 3,
  kitIntent: 3,
  fieldIntent: 3,
}

// Words too generic to make a title "covered" by a query.
const GENERIC_TITLE = new Set(["input", "guard", "check", "picker", "button", "field", "readback", "confirm", "preview", "notice", "badge", "banner", "bar", "list"].map(stem))

interface Indexed {
  title: Set<string>
  titleList: string[]
  incident: Set<string>
  tags: Set<string>
  category: Set<string>
  description: Set<string>
  phrases: string[]
  kitFlows: string[]
}

const cache = new WeakMap<SearchItem, Indexed>()

function index(item: SearchItem): Indexed {
  const hit = cache.get(item)
  if (hit) return hit
  const titleList = [...new Set([...stems(item.title), ...stems(item.name.replace(/-/g, " "))])]
  const incidentText = [item.stops ?? "", ...(item.mistakes ?? []), ...(item.aliases ?? [])]
  const flowLabels = (item.flows ?? []).flatMap((id) => {
    const flow = FLOWS.find((f) => f.id === id)
    return flow ? [flow.label, id.replace(/-/g, " ")] : [id]
  })
  const built: Indexed = {
    title: new Set(titleList),
    titleList,
    incident: new Set(incidentText.flatMap(stems)),
    tags: new Set([...flowLabels, ...(item.fields ?? []).map((f) => f.replace(/-/g, " "))].flatMap(stems)),
    category: new Set(stems(item.category)),
    description: new Set(stems(item.description)),
    phrases: [item.title, item.stops ?? "", ...(item.mistakes ?? []), ...(item.aliases ?? [])].map((p) => stems(p).join(" ")).filter(Boolean),
    kitFlows: KITS.filter((kit) => kit.components.includes(item.name)).map((kit) => kit.flow),
  }
  cache.set(item, built)
  return built
}

const hasPrefix = (set: Set<string>, term: string) => {
  if (term.length < 3) return false
  for (const word of set) if (word.length > term.length && word.startsWith(term)) return true
  return false
}

/** How well one stemmed word (or a multi-word synonym) matches one item, before the synonym discount. */
function matchTerm(ix: Indexed, term: string[]): number {
  if (term.length > 1) {
    // A multi-word synonym ("sign up") counts only if every word is in one field.
    const fields: [Set<string>, number][] = [
      [ix.title, W.title],
      [ix.incident, W.incident],
      [ix.tags, W.tag],
      [ix.description, W.description],
    ]
    for (const [set, weight] of fields) if (term.every((t) => set.has(t))) return weight
    return 0
  }
  const t = term[0]
  if (ix.title.has(t)) return W.title
  if (ix.incident.has(t)) return W.incident
  if (hasPrefix(ix.title, t)) return W.titlePrefix
  if (hasPrefix(ix.incident, t)) return W.incidentPrefix
  if (ix.tags.has(t)) return W.tag
  if (ix.category.has(t)) return W.category
  if (ix.description.has(t)) return W.description
  if (hasPrefix(ix.description, t)) return W.descriptionPrefix
  return 0
}

export interface ParsedQuery {
  raw: string
  terms: string[]
  phrase: string
  expansions: Map<string, string[][]>
  flows: Set<string>
  fields: Set<string>
}

export function parseQuery(query: string): ParsedQuery {
  const all = words(query).filter((w) => !STOPWORDS.has(w))
  const terms = [...new Set(all.map(stem))]
  const expansions = new Map<string, string[][]>()
  const flows = new Set<string>()
  const fields = new Set<string>()
  for (const term of terms) {
    expansions.set(term, SYNONYMS.get(term) ?? [])
    const flow = FLOW_INTENT_STEMMED.get(term)
    if (flow) flows.add(flow)
    const field = FIELD_INTENT_STEMMED.get(term)
    if (field) fields.add(field)
  }
  return { raw: query, terms, phrase: terms.join(" "), expansions, flows, fields }
}

export function score(item: SearchItem, parsed: ParsedQuery | string[]): number {
  const q = Array.isArray(parsed) ? parseQuery(parsed.join(" ")) : parsed
  if (!q.terms.length) return 1
  const ix = index(item)
  let total = 0
  let matched = 0
  const covered = new Set<string>()
  for (const term of q.terms) {
    let best = matchTerm(ix, [term])
    if (best > 0 && ix.title.has(term)) covered.add(term)
    for (const syn of q.expansions.get(term) ?? []) {
      const s = matchTerm(ix, syn) * W.synonym
      if (s > best) best = s
      if (syn.length === 1 && ix.title.has(syn[0])) covered.add(syn[0])
    }
    if (best > 0) matched += 1
    total += best
  }
  if (total === 0) return 0

  // Reward matching more of the query, not just one loud word.
  const coverage = matched / q.terms.length
  total *= 0.4 + 0.6 * coverage
  if (q.terms.length > 1 && ix.phrases.some((p) => p.includes(q.phrase))) total += W.phrase
  // "email" → Email Input over Email Change Guard: the query names the whole title.
  const meaningful = ix.titleList.filter((w) => !GENERIC_TITLE.has(w) && !/^\d/.test(w))
  const titleWords = stems(item.title).filter((w) => !GENERIC_TITLE.has(w))
  if (titleWords.length && titleWords.every((w) => covered.has(w))) total += W.titleCovered
  else if (meaningful.length && meaningful.every((w) => covered.has(w))) total += W.titleCovered / 2
  if (item.essential || ESSENTIALS.includes(item.name)) total += W.essential
  for (const flow of q.flows) {
    if (item.flows?.includes(flow)) total += W.flowIntent
    if (ix.kitFlows.includes(flow)) total += W.kitIntent
  }
  for (const field of q.fields) if (item.fields?.includes(field)) total += W.fieldIntent
  return total
}

export interface SearchResult<T> {
  items: T[]
  /** True when nothing matched and `items` holds the closest few instead. */
  fallback: boolean
  /** Flows the query points at, for showing their kits. */
  flows: string[]
}

/** Ranked, never-empty search. `fallbackSize` closest items come back when nothing matches. */
export function search<T extends SearchItem>(items: T[], query: string, fallbackSize = 3): SearchResult<T> {
  const q = parseQuery(query)
  if (!q.terms.length) return { items, fallback: false, flows: [] }
  const hits = items
    .map((item, i) => ({ item, i, s: score(item, q) }))
    .filter((hit) => hit.s > 0)
    .sort((a, b) => b.s - a.s || a.i - b.i)
  if (hits.length) return { items: hits.map((h) => h.item), fallback: false, flows: [...q.flows] }
  return { items: closest(items, q, fallbackSize), fallback: true, flows: [...q.flows] }
}

/** Back-compat helper: just the ranked list (may be the fallback). */
export function searchItems<T extends SearchItem>(items: T[], query: string) {
  return search(items, query).items
}

// ---------------------------------------------------------------------------
// Fallback: correct typos against the catalog's vocabulary, else show essentials.

function distance(a: string, b: string) {
  if (Math.abs(a.length - b.length) > 2) return 3
  const row = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0]
    row[0] = i
    for (let j = 1; j <= b.length; j++) {
      const tmp = row[j]
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1))
      prev = tmp
    }
  }
  return row[b.length]
}

const vocabCache = new WeakMap<object, string[]>()

function closest<T extends SearchItem>(items: T[], q: ParsedQuery, size: number): T[] {
  let vocab = vocabCache.get(items)
  if (!vocab) {
    const set = new Set<string>()
    for (const item of items) {
      const ix = index(item)
      for (const w of [...ix.title, ...ix.incident]) if (w.length > 3) set.add(w)
    }
    vocab = [...set]
    vocabCache.set(items, vocab)
  }
  const fixed = q.terms.map((term) => {
    if (term.length < 4) return term
    let best = term
    let bestD = term.length > 6 ? 3 : 2
    for (const w of vocab!) {
      const d = distance(term, w)
      if (d < bestD) {
        bestD = d
        best = w
      }
    }
    return best
  })
  if (fixed.some((w, i) => w !== q.terms[i])) {
    const retry = parseQuery(fixed.join(" "))
    const hits = items
      .map((item, i) => ({ item, i, s: score(item, retry) }))
      .filter((h) => h.s > 0)
      .sort((a, b) => b.s - a.s || a.i - b.i)
      .slice(0, size)
      .map((h) => h.item)
    if (hits.length) return hits
  }
  const essentials = ESSENTIALS.map((name) => items.find((item) => item.name === name)).filter((item): item is T => !!item)
  return essentials.slice(0, size)
}

/** Words the catalog knows, for "did you mean" suggestions. */
export function vocabularyOf(items: SearchItem[]) {
  const set = new Set<string>()
  for (const item of items)
    for (const w of words(`${item.name} ${item.title} ${item.category} ${item.stops ?? ""} ${(item.aliases ?? []).join(" ")}`)) if (w.length > 2) set.add(w)
  return [...set]
}
