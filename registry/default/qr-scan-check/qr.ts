// Bollard UI — qr-scan-check · MIT licence · https://bollard-ui.vercel.app/components/qr-scan-check

/** What a scanned QR code contains. */
export type QrPayload =
  | { type: "url"; raw: string; url: URL; registrable: string }
  | { type: "upi"; raw: string; payee: string; name?: string; amount?: string; note?: string; currency?: string; mandate?: boolean; recur?: string }
  | { type: "script"; raw: string }
  | { type: "tel" | "sms" | "email" | "wifi" | "text"; raw: string; value: string; body?: string }
  | { type: "empty"; raw: string }

/** One reason to pause before opening. `danger` ones are classic quishing tells. */
export type QrIssue =
  | { kind: "notPrinted"; printed: string; actual: string; lookalike: boolean }
  | { kind: "lookalike"; twin: string; actual: string }
  | { kind: "brandInName"; brand: string; actual: string }
  | { kind: "loginTrick"; shown: string; actual: string }
  | { kind: "script" }
  | { kind: "apk" }
  | { kind: "shortener"; host: string }
  | { kind: "punycode"; host: string }
  | { kind: "rawIp" }
  | { kind: "http" }
  | { kind: "upiReceive" }
  | { kind: "upiNameMismatch"; printed: string; name: string }
  | { kind: "upiAmount"; amount: string; currency: string }
  | { kind: "upiMandate"; recur?: string }
  | { kind: "smsBody" }

export const DANGER_ISSUES: QrIssue["kind"][] = ["notPrinted", "lookalike", "brandInName", "loginTrick", "script", "apk", "upiReceive", "upiNameMismatch"]

/** Hosts that hide the real destination behind a redirect. */
export const URL_SHORTENERS = [
  "bit.ly", "tinyurl.com", "t.co", "goo.gl", "is.gd", "ow.ly", "buff.ly", "rebrand.ly", "cutt.ly", "shorturl.at", "rb.gy", "t.ly", "s.id",
  "tiny.cc", "bl.ink", "short.io", "qrco.de", "qr.codes", "me-qr.com", "linktr.ee", "surl.li", "u.to", "v.gd", "lnkd.in", "shorturl.gg",
]

/** Brands quishing pages most often imitate. Pass your own via `trusted`. */
export const QR_TRUSTED_DOMAINS = [
  "paybyphone.com", "parkmobile.io", "ringgo.co.uk", "paytm.com", "phonepe.com", "google.com", "paypal.com", "amazon.in", "amazon.com",
  "flipkart.com", "irctc.co.in", "onlinesbi.sbi", "hdfcbank.com", "icicibank.com", "axisbank.com", "incometax.gov.in", "uidai.gov.in",
  "apple.com", "microsoft.com", "whatsapp.com", "instagram.com", "facebook.com", "netflix.com", "usps.com", "dhl.com", "fedex.com",
]

/**
 * Shared-hosting suffixes where anyone can register a subdomain, so "you.github.io" and
 * "scammer.github.io" are different owners (a slice of the Public Suffix List's private section).
 */
export const SHARED_HOST_SUFFIXES = [
  "github.io", "gitlab.io", "vercel.app", "netlify.app", "pages.dev", "workers.dev", "web.app", "firebaseapp.com", "herokuapp.com",
  "onrender.com", "fly.dev", "glitch.me", "replit.app", "repl.co", "ngrok.io", "ngrok-free.app", "trycloudflare.com", "azurewebsites.net",
  "blogspot.com", "wixsite.com", "weebly.com", "webflow.io", "framer.website", "carrd.co", "square.site", "myshopify.com", "s3.amazonaws.com",
  "cloudfront.net", "appspot.com", "translate.goog", "000webhostapp.com", "duckdns.org", "surge.sh",
]

const MULTI_PART = new Set(["co.uk", "org.uk", "ac.uk", "gov.uk", "co.in", "net.in", "org.in", "gov.in", "ac.in", "com.au", "co.jp", "com.br", "co.nz", "com.sg", "com.mx", "co.za", "com.my", "ae.org"])
const CONFUSABLES: Record<string, string> = { "0": "o", "1": "l", "3": "e", "5": "s", "7": "t", "8": "b", "|": "l", i: "l" }
const RECEIVE_WORDS = /\b(refund|receive|cashback|cash back|prize|reward|lottery|winning|won|claim|kyc|bonus|credit(?:ed)?|return(?:ed)?|paise wapas|प्राप्त|रिफंड)\b/i
const SAFE_SCHEMES = /^(https?:)$/

/** "pay.secure.paybyphone.co.uk" → "paybyphone.co.uk". */
export function registrableDomain(host: string) {
  const clean = host.toLowerCase().replace(/\.$/, "")
  if (/^[\d.]+$/.test(clean) || clean.startsWith("[")) return clean
  const labels = clean.split(".")
  const shared = SHARED_HOST_SUFFIXES.find((suffix) => clean === suffix || clean.endsWith(`.${suffix}`))
  if (shared) return labels.slice(-(shared.split(".").length + 1)).join(".")
  const [second, top] = labels.slice(-2)
  // co.uk, com.au, gov.in… plus the same pattern under any two-letter country code (co.kr, com.tr).
  const ccSld = MULTI_PART.has(`${second}.${top}`) || (labels.length > 2 && top?.length === 2 && /^(co|com|net|org|gov|edu|ac|ne|or|go|gob|mil|nic|res)$/.test(second ?? ""))
  return labels.slice(ccSld ? -3 : -2).join(".")
}

const label = (domain: string) => registrableDomain(domain).split(".")[0] ?? ""
const skeleton = (s: string) => Array.from(s.toLowerCase(), (ch) => CONFUSABLES[ch] ?? ch).join("").replace(/rn/g, "m").replace(/vv/g, "w").replace(/-/g, "")
const squash = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "")

/** Damerau-Levenshtein (optimal string alignment): a swapped pair counts as one edit. */
function distance(a: string, b: string) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array<number>(b.length).fill(0)])
  for (let j = 1; j <= b.length; j++) d[0][j] = j
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++) {
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1)
    }
  return d[a.length][b.length]
}

/** Two names one or two keystrokes apart, or identical once look-alike characters are folded. */
function nearMiss(a: string, b: string) {
  if (!a || !b || a === b) return false
  if (skeleton(a) === skeleton(b)) return true
  return Math.min(a.length, b.length) >= 5 && distance(a, b) <= (b.length >= 10 ? 2 : 1)
}

/** Is `candidate` posing as `real` (poybyphone.com vs paybyphone.com, paypa1.com, paybyphone.co)? */
export function isLookalike(candidate: string, real: string) {
  if (registrableDomain(candidate) === registrableDomain(real)) return false
  const [a, b] = [label(candidate), label(real)]
  return a === b || nearMiss(a, b)
}

/** The domain written in printed text ("Pay at PayByPhone.com, zone 4021"), if any. */
export const domainIn = (text = "") => text.match(/(?:[a-z0-9-]+\.)+[a-z]{2,}(?![a-z0-9-])/i)?.[0].toLowerCase() ?? null

/** Reads a QR payload: web links, UPI payment requests, tel/sms/mailto, Wi-Fi, or plain text. Never throws. */
export function parseQr(raw: unknown): QrPayload {
  const text = typeof raw === "string" ? raw.trim() : ""
  if (!text) return { type: "empty", raw: "" }
  // Browsers drop tabs, newlines and leading control characters from URLs, so "java\tscript:" still runs.
  const lower = text.replace(/[\t\n\r]/g, "").replace(/^[\u0000-\u0020]+/, "").toLowerCase()
  if (/^(javascript|data|vbscript|file|intent|blob):/.test(lower)) return { type: "script", raw: text }
  if (lower.startsWith("upi://")) {
    const query = new URLSearchParams(text.slice(text.indexOf("?") + 1 || text.length))
    const get = (key: string) => query.get(key)?.trim() || undefined
    const mandate = lower.startsWith("upi://mandate")
    return { type: "upi", raw: text, payee: get("pa") ?? "", name: get("pn"), amount: get("am"), note: get("tn"), currency: get("cu"), mandate: mandate || undefined, recur: mandate ? get("recur") : undefined }
  }
  if (/^tel:/i.test(text)) return { type: "tel", raw: text, value: decodeSafe(text.slice(4)) }
  if (/^(sms|smsto|mms):/i.test(text)) {
    const [, rest = ""] = text.split(/:(.*)/s)
    const [number, body] = rest.includes("?body=") ? rest.split("?body=") : rest.split(":")
    return { type: "sms", raw: text, value: decodeSafe(number ?? ""), body: body ? decodeSafe(body) : undefined }
  }
  if (/^mailto:/i.test(text)) return { type: "email", raw: text, value: decodeSafe(text.slice(7).split("?")[0]) }
  if (/^wifi:/i.test(text)) return { type: "wifi", raw: text, value: text.match(/S:((?:\\.|[^;])*)/i)?.[1]?.replace(/\\(.)/g, "$1") ?? "" }
  const candidate = /^[a-z][a-z\d+.-]*:\/\//i.test(text) ? text : /^(?:[\w-]+\.)+[a-z]{2,}(?:[/:?#]|$)/i.test(text) ? `https://${text}` : null
  if (candidate) {
    try {
      const url = new URL(candidate)
      if (SAFE_SCHEMES.test(url.protocol)) return { type: "url", raw: text, url, registrable: registrableDomain(url.hostname) }
      return { type: "script", raw: text }
    } catch {
      // Not a URL after all: fall through to text.
    }
  }
  return { type: "text", raw: text, value: text }
}

function decodeSafe(value: string) {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

/** Formats a UPI amount, or returns null when it isn't a positive number. */
export function upiAmount(amount: string | undefined, currency = "INR", locale = "en-IN") {
  // UPI amounts are plain decimals ("499.00"); "1e3" or "0x10" would show a number the app may read differently.
  if (!amount || !/^\d+(?:\.\d{1,2})?$/.test(amount.trim())) return null
  const n = Number(amount)
  if (n <= 0) return null
  try {
    return new Intl.NumberFormat(locale, { style: "currency", currency }).format(n)
  } catch {
    return `${currency} ${n}`
  }
}

/**
 * Every reason to pause before acting on a scanned code. `printed` is whatever is printed or shown
 * beside the code (a domain like "paybyphone.com" or a merchant name), and `trusted` are brands to
 * test for lookalikes. Pure, so it can run on a server.
 */
export function checkQr(payload: QrPayload, printed = "", trusted: string[] = QR_TRUSTED_DOMAINS, shorteners: string[] = URL_SHORTENERS): QrIssue[] {
  const issues: QrIssue[] = []
  if (payload.type === "script") return [{ kind: "script" }]
  if (payload.type === "url") {
    const { url, registrable: actual } = payload
    const host = url.hostname.toLowerCase()
    const printedDomain = domainIn(printed)
    const printedName = printedDomain ? "" : squash(printed)
    if (url.username) issues.push({ kind: "loginTrick", shown: decodeSafe(url.username), actual })
    if (printedDomain && registrableDomain(printedDomain) !== actual)
      issues.push({ kind: "notPrinted", printed: registrableDomain(printedDomain), actual, lookalike: isLookalike(actual, printedDomain) })
    else {
      const twin = printedName.length >= 5 && nearMiss(label(actual), printedName) ? printed.trim() : trusted.find((brand) => isLookalike(actual, brand))
      if (twin) issues.push({ kind: "lookalike", twin: twin === printed.trim() ? twin : registrableDomain(twin), actual })
      else {
        const names = [...(printedName.length >= 5 ? [printedName] : []), ...trusted.map(label)]
        const brand = names.find((name) => name.length >= 5 && label(actual) !== name && skeleton(host).includes(skeleton(name)))
        if (brand) issues.push({ kind: "brandInName", brand: trusted.find((t) => label(t) === brand) ?? printed.trim(), actual })
      }
    }
    if (/\/[^/?#]+\.apk(?:$|[?#])/i.test(url.pathname)) issues.push({ kind: "apk" })
    if (shorteners.includes(actual) || shorteners.includes(host)) issues.push({ kind: "shortener", host })
    if (host.includes("xn--")) issues.push({ kind: "punycode", host })
    if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.startsWith("[")) issues.push({ kind: "rawIp" })
    if (url.protocol === "http:") issues.push({ kind: "http" })
  }
  if (payload.type === "upi") {
    if (payload.note && RECEIVE_WORDS.test(payload.note)) issues.push({ kind: "upiReceive" })
    const said = printed.trim()
    if (said && payload.name && !domainIn(said)) {
      const words = (s: string) => s.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((w) => w.length >= 3 && !["the", "and", "store", "shop", "stores", "pvt", "ltd"].includes(w))
      const theirs = words(payload.name)
      if (theirs.length && !words(said).some((w) => theirs.some((n) => n === w || (w.length >= 5 && distance(n, w) <= 1))))
        issues.push({ kind: "upiNameMismatch", printed: said, name: payload.name })
    }
    if (payload.mandate) issues.push({ kind: "upiMandate", recur: payload.recur })
    const amount = upiAmount(payload.amount, payload.currency || "INR")
    if (amount) issues.push({ kind: "upiAmount", amount, currency: payload.currency || "INR" })
  }
  if (payload.type === "sms" && payload.body) issues.push({ kind: "smsBody" })
  return issues
}
