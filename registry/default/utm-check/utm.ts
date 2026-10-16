/** UTM parsing, GA4 channel prediction and the checks utm-check runs. Pure, so it runs on the server too. */

export const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "utm_id"] as const
export type UtmKey = (typeof UTM_KEYS)[number]

/** Short versions of GA4's source lists. Pass your own to `checkUtm` for wider coverage. */
export const GA4_SOURCES = {
  social: ["facebook", "fb", "instagram", "ig", "linkedin", "lnkd.in", "twitter", "t.co", "x", "pinterest", "reddit", "snapchat", "threads", "quora", "whatsapp", "tiktok"],
  search: ["google", "bing", "yahoo", "duckduckgo", "baidu", "yandex", "ecosia", "naver"],
  video: ["youtube", "vimeo", "twitch", "dailymotion"],
  shopping: ["amazon", "ebay", "etsy", "walmart", "flipkart", "shopify"],
}
export type SourceLists = typeof GA4_SOURCES

const PAID = /^(.*cp.*|ppc|retargeting|paid.*)$/
const SHOP_CAMPAIGN = /^(.*(([^a-df-z]|^)shop|shopping).*)$/
const EMAIL = /^(email|e-mail|e_mail|e mail)$/
const ORGANIC_SOCIAL = ["social", "social-network", "social-media", "sm", "social network", "social media"]
const DISPLAY = ["display", "banner", "expandable", "interstitial", "cpm"]

const inList = (source: string, list: string[]) => {
  const host = source.replace(/^(www|m|l|lm)\./, "")
  return list.some((name) => host === name || host.startsWith(`${name}.`))
}

/**
 * The GA4 default channel a manually tagged visit lands in, following Google's published rules in
 * order (support.google.com/analytics/answer/9756891). Channel rules ignore case; reports don't.
 */
export function ga4Channel(source = "", medium = "", campaign = "", lists: SourceLists = GA4_SOURCES) {
  const [s, m, c] = [source, medium, campaign].map((v) => v.trim().toLowerCase())
  const paid = PAID.test(m)
  const shopping = inList(s, lists.shopping) || SHOP_CAMPAIGN.test(c)
  if (c.includes("cross-network")) return "Cross-network"
  if (shopping && paid) return "Paid Shopping"
  if (inList(s, lists.search) && paid) return "Paid Search"
  if (inList(s, lists.social) && paid) return "Paid Social"
  if (inList(s, lists.video) && paid) return "Paid Video"
  if (DISPLAY.includes(m)) return "Display"
  if (paid) return "Paid Other"
  if (shopping) return "Organic Shopping"
  if (inList(s, lists.social) || ORGANIC_SOCIAL.includes(m)) return "Organic Social"
  if (inList(s, lists.video) || m.includes("video")) return "Organic Video"
  if (inList(s, lists.search) || m === "organic") return "Organic Search"
  if (["referral", "app", "link"].includes(m)) return "Referral"
  if (EMAIL.test(s) || EMAIL.test(m)) return "Email"
  if (m === "affiliate") return "Affiliates"
  if (m === "audio") return "Audio"
  if (s === "sms" || m === "sms") return "SMS"
  if (m.endsWith("push") || m.includes("mobile") || m.includes("notification") || s === "firebase") return "Mobile Push Notifications"
  return "Unassigned"
}

const decode = (v: string) => {
  try {
    return decodeURIComponent(v.replace(/\+/g, " "))
  } catch {
    return v
  }
}

/** Splits a URL by hand, so a second "?" or tags after "#" can be seen and fixed (the URL parser hides both). */
export function splitUrl(url: string) {
  const hashAt = url.indexOf("#")
  const beforeHash = hashAt < 0 ? url : url.slice(0, hashAt)
  const hash = hashAt < 0 ? "" : url.slice(hashAt + 1)
  const q = beforeHash.indexOf("?")
  const base = q < 0 ? beforeHash : beforeHash.slice(0, q)
  const query = q < 0 ? "" : beforeHash.slice(q + 1)
  const params = query
    .split(/[&?]/)
    .filter(Boolean)
    .map((pair): [string, string] => {
      const eq = pair.indexOf("=")
      return eq < 0 ? [decode(pair), ""] : [decode(pair.slice(0, eq)), decode(pair.slice(eq + 1))]
    })
  return { base, query, hash, params }
}

/** Joins a base, its params and a hash back into a URL. */
export function joinUrl(base: string, params: [string, string][], hash = "") {
  const query = params.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join("&")
  return `${base}${query ? `?${query}` : ""}${hash ? `#${hash}` : ""}`
}

/** Lowercase and trimmed, with spaces, hyphens, underscores and plus signs collapsed to one `separator`. */
export const normaliseValue = (value: string, separator = "_") =>
  value
    .trim()
    .toLowerCase()
    .replace(/[\s_\-+]+/g, separator)
    .split(separator)
    .filter(Boolean)
    .join(separator)

function distance(a: string, b: string) {
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j)
  for (let i = 1; i <= a.length; i++) {
    const row = [i]
    for (let j = 1; j <= b.length; j++) row[j] = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
    prev = row
  }
  return prev[b.length]
}

/** Values GA4 reads as a medium, to spot source and medium entered the wrong way round. */
const MEDIUM_WORDS = /^(cpc|ppc|cpm|cpv|paid.*|email|e-mail|social|social[-_ ]?media|organic|referral|display|banner|affiliate|sms|push|audio|video|retargeting)$/
const PAID_HINT = /(^|[_\-\s])(ads?|paid|sponsored|boost(ed)?|promoted|cpc|ppc)([_\-\s]|$)/
const EMAIL_HINT = /^(newsletter|mail|e?mailer|edm|mailchimp|klaviyo|sendgrid|brevo)$/
const isUtm = (key: string) => /^utm[_-]/i.test(key)

export interface UtmIssue {
  id: string
  /** The parameter the issue is about, when there is one. */
  param?: string
  message: string
  /** `harmful` breaks attribution outright; `warning` splits or misfiles reports. */
  severity: "harmful" | "warning"
  /** The whole URL with this one issue fixed. */
  fix?: string
  fixLabel?: string
}

export interface UtmCheckOptions {
  /** Hosts of the pages this link will be published on, e.g. your blog while editing a post. A tagged link back to one of them is internal and overwrites the visitor's real source. */
  placedOn?: string[]
  /** Values already in your reports, so "Spring-Sale" is pointed at the existing "spring_sale". */
  knownValues?: Partial<Record<UtmKey, string[]>>
  /** Separator used when normalising values. */
  separator?: string
  sources?: SourceLists
}

/** Every UTM problem in a URL, most harmful first, each with a one-step fix when there is a safe one. */
export function checkUtm(url: string, { placedOn = [], knownValues = {}, separator = "_", sources = GA4_SOURCES }: UtmCheckOptions = {}) {
  const issues: UtmIssue[] = []
  const { base, query, hash, params } = splitUrl(url.trim())
  const rebuild = (next: [string, string][], nextHash = hash) => joinUrl(base, next, nextHash)
  const done = (channel?: string) => ({ issues: issues.sort((a, b) => Number(a.severity === "warning") - Number(b.severity === "warning")), params, channel })

  if (query.includes("?")) {
    issues.push({ id: "second-?", severity: "harmful", message: "A second “?” glues the tags onto the value before it, so analytics never sees them.", fix: rebuild(params), fixLabel: "Use & instead" })
  }
  if (/(^|[&?])utm_/i.test(hash)) {
    // Keep a single-page-app route ("#/home") and any of its own params; move only the tags.
    const at = hash.indexOf("?")
    const route = at < 0 ? (hash.includes("=") ? "" : hash) : hash.slice(0, at)
    const inner = splitUrl(`x?${at < 0 ? (route ? "" : hash) : hash.slice(at + 1)}`).params
    const rest = inner.filter(([k]) => !isUtm(k))
    const nextHash = joinUrl(route, rest).replace(/^\?$/, "")
    issues.push({ id: "in-hash", severity: "harmful", message: "Tags after “#” never reach the server or GA4.", fix: rebuild([...params, ...inner.filter(([k]) => isUtm(k))], nextHash), fixLabel: "Move before #" })
  }
  let host = ""
  try {
    host = new URL(base).hostname.replace(/^www\./, "")
  } catch {
    issues.push({ id: "not-url", severity: "harmful", message: "This isn't a full web address.", fix: /^[\w-]+\.\w/.test(base) ? `https://${url.trim()}` : undefined, fixLabel: "Add https://" })
  }
  const tagged = params.some(([k]) => isUtm(k))
  if (host && tagged && placedOn.some((h) => host === h.replace(/^www\./, "") || host.endsWith(`.${h}`))) {
    issues.push({ id: "internal", severity: "harmful", message: "This links to your own site. Tags here start a new session and replace how the visitor really arrived.", fix: rebuild(params.filter(([k]) => !isUtm(k))), fixLabel: "Remove the tags" })
    return done()
  }

  // UTM_Source, utm-medium and utm_campain are not read.
  params.forEach(([key, value], index) => {
    if (!isUtm(key) || (UTM_KEYS as readonly string[]).includes(key)) return
    const lower = key.toLowerCase().replace(/^utm-/, "utm_")
    const match = UTM_KEYS.find((k) => k === lower) ?? UTM_KEYS.find((k) => distance(lower, k) <= 2)
    if (match) issues.push({ id: `key-${index}`, param: key, severity: "harmful", message: `“${key}” isn't read as ${match}.`, fix: rebuild(params.map((p, j) => (j === index ? [match, value] : p))), fixLabel: `Rename to ${match}` })
  })
  const seen = new Set<string>()
  params.forEach(([key], index) => {
    if (seen.has(key) && key.startsWith("utm_")) issues.push({ id: `dup-${index}`, param: key, severity: "warning", message: `${key} appears twice; reports keep only one.`, fix: rebuild(params.filter((_, j) => j !== index)), fixLabel: "Remove the second" })
    seen.add(key)
  })

  const get = (k: UtmKey) => params.find(([key]) => key === k)?.[1]
  const set = (k: UtmKey, v: string) => rebuild(params.map((p): [string, string] => (p[0] === k ? [k, v] : p)))
  const missing = (["utm_source", "utm_medium", "utm_campaign"] as const).filter((k) => !get(k)?.trim())
  if (tagged && missing.length && !issues.some((i) => i.id.startsWith("key-"))) issues.push({ id: "missing", severity: "warning", message: `Add ${missing.join(" and ")}: reports group every visit by source, medium and campaign.` })

  const source = get("utm_source") ?? ""
  const medium = get("utm_medium") ?? ""
  const [s, m] = [source, medium].map((v) => normaliseValue(v, "_"))
  const platform = (v: string) => inList(v, sources.social) || inList(v, sources.search) || inList(v, sources.video) || EMAIL_HINT.test(v)
  const swapped = Boolean(s && m && MEDIUM_WORDS.test(s) && !MEDIUM_WORDS.test(m) && platform(m))
  if (swapped) {
    issues.push({
      id: "swapped",
      severity: "warning",
      message: `Source and medium look swapped: “${source}” is a medium, “${medium}” is where the link was posted.`,
      fix: rebuild(params.map((p): [string, string] => (p[0] === "utm_source" ? ["utm_source", medium] : p[0] === "utm_medium" ? ["utm_medium", source] : p))),
      fixLabel: "Swap them",
    })
  }

  for (const key of UTM_KEYS) {
    const value = get(key)
    if (!value) continue
    const clean = normaliseValue(value, separator)
    const known = knownValues[key]?.find((k) => k !== value && normaliseValue(k, separator) === clean)
    if (known) issues.push({ id: `known-${key}`, param: key, severity: "warning", message: `Your reports already have “${known}”; “${value}” would start a separate row.`, fix: set(key, known), fixLabel: `Use ${known}` })
    else if (clean !== value && !knownValues[key]?.includes(value))
      issues.push({ id: `case-${key}`, param: key, severity: "warning", message: `“${value}” and “${clean}” are separate rows in reports.`, fix: set(key, clean), fixLabel: `Use ${clean}` })
  }

  const channel = tagged ? ga4Channel(source, medium, get("utm_campaign"), sources) : undefined
  if (m && !swapped) {
    const suggestion =
      channel === "Organic Social" && inList(s, sources.social) && PAID_HINT.test(m) ? "paid_social"
      : channel === "Organic Search" && PAID_HINT.test(m) ? "cpc"
      : channel === "Unassigned" && EMAIL_HINT.test(m) ? "email"
      : undefined
    if (suggestion) {
      const what = channel === "Unassigned" ? "Unassigned" : `${channel}, so paid visits count as free ones`
      // The channel fix also settles the medium's spelling, so drop the plain case warning for it.
      const spelling = issues.findIndex((i) => i.id === "case-utm_medium" || i.id === "known-utm_medium")
      if (spelling >= 0) issues.splice(spelling, 1)
      issues.push({ id: "medium", param: "utm_medium", severity: "warning", message: `GA4 files “${medium}” from ${source || "this source"} as ${what}.`, fix: set("utm_medium", suggestion), fixLabel: `Use ${suggestion}` })
    } else if (channel === "Unassigned") {
      issues.push({ id: "medium", param: "utm_medium", severity: "warning", message: `“${medium}” matches no GA4 channel, so these visits show as Unassigned.` })
    }
  }
  return done(channel)
}

/** Applies every available fix until none is left, for a one-tap "Normalise all". */
export function normaliseUtm(url: string, options?: UtmCheckOptions) {
  let next = url
  for (let i = 0; i < 12; i++) {
    const fix = checkUtm(next, options).issues.find((issue) => issue.fix)?.fix
    if (!fix || fix === next) break
    next = fix
  }
  return next
}
