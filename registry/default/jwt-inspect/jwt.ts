// Pure JWT decoding and checks (RFC 7519, RFC 7515, RFC 8725 best practices).
// Decodes only: the signature is never verified here, and nothing leaves the page.

export type JwtIssueCode =
  | "not-jwt"
  | "bad-part"
  | "encrypted"
  | "alg-none"
  | "alg-missing"
  | "alg-unexpected"
  | "alg-confusion"
  | "key-in-header"
  | "expired"
  | "not-yet"
  | "iat-future"
  | "milliseconds"
  | "no-exp"
  | "bad-time"
  | "long-life"
  | "no-aud"
  | "aud-mismatch"
  | "no-iss"
  | "iss-mismatch"
  | "secret-claim"
  | "personal-claim"
  | "wrapped"
  | "extracted"
  | "no-signature"
  | "crit"
  | "kid-suspicious"
  | "typ-mismatch"
  | "nested"

export interface JwtIssue {
  code: JwtIssueCode
  severity: "danger" | "error" | "warning" | "info"
  /** The claim or header field it is about. */
  claim?: string
  /** Detail for the message: an algorithm, a duration, a value. */
  detail?: string
  /** Seconds from now (negative = in the past) for time issues. */
  seconds?: number
}

export interface DecodedJwt {
  header: Record<string, unknown>
  /** The payload as JSON, or null if it isn't JSON. */
  payload: Record<string, unknown> | null
  /** The payload as text, when it isn't a JSON object. */
  payloadText?: string
  signature: string
  /** The token as it was read, after stripping "Bearer ", quotes and whitespace. */
  token: string
}

export interface JwtOptions {
  /** Algorithms your verifier allows, e.g. ["RS256"]. Anything else is flagged. */
  algorithms?: string[]
  /** The audience this token should be for. */
  audience?: string
  /** The issuer this token should come from. */
  issuer?: string
  /** The explicit type the header's typ must carry, e.g. "at+jwt" (RFC 8725 §3.11). Compared without case or an "application/" prefix. */
  type?: string
  /** "Now" in ms. */
  now: number
  /** Clock skew allowed, in seconds. Default 60. */
  leeway?: number
  /** Lifetimes longer than this many seconds are flagged. Default 86 400 (one day). */
  maxLifetime?: number
}

export interface JwtAnalysis {
  decoded: DecodedJwt | null
  issues: JwtIssue[]
}

/** Base64url (or plain base64) to UTF-8 text. Null when the characters or length can't be base64. */
export function decodeBase64Url(part: string): string | null {
  const clean = part.replace(/-/g, "+").replace(/_/g, "/").replace(/=+$/, "")
  if (!/^[A-Za-z0-9+/]*$/.test(clean) || clean.length % 4 === 1) return null
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"
  const bytes = new Uint8Array(Math.floor((clean.length * 3) / 4))
  let buffer = 0
  let bits = 0
  let index = 0
  for (const char of clean) {
    buffer = ((buffer << 6) | alphabet.indexOf(char)) & 0xffffff
    bits += 6
    if (bits >= 8) {
      bits -= 8
      bytes[index++] = (buffer >> bits) & 0xff
    }
  }
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes)
  } catch {
    return null
  }
}

const parseObject = (text: string | null): Record<string, unknown> | null => {
  if (text === null) return null
  try {
    const value: unknown = JSON.parse(text)
    return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null
  } catch {
    return null
  }
}

// A JWS or JWE in compact form: its header is JSON, so it always starts "eyJ" ('{"').
const EMBEDDED = /eyJ[\w-]*\.[\w-]*\.[\w-]*(?:\.[\w-]+\.[\w-]+)?/

/**
 * Pulls a token out of what people actually paste: "Bearer …", an Authorization header, quotes,
 * line wraps, and a token sitting inside JSON, a curl command or a cookie (`extracted`).
 */
export function cleanToken(raw: unknown): { token: string; wrapped: boolean; extracted?: boolean } {
  let text = (typeof raw === "string" ? raw : "").replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n").trim().slice(0, 100_000)
  text = text.replace(/^authorization\s*:\s*/i, "").replace(/^bearer\s+/i, "").replace(/^(["'`])([\s\S]*)\1$/, "$2").trim()
  if (/[{}"'=;:,&]/.test(text)) {
    const found = text.match(EMBEDDED)
    if (found) return { token: found[0], wrapped: false, extracted: true }
  }
  const wrapped = /\s/.test(text)
  return { token: text.replace(/\s+/g, ""), wrapped }
}

const SECRET_KEYS = /^(pass(word|wd)?|pwd|secret|client_?secret|api_?key|private_?key|access_?key|card(_?number)?|pan|cvv|cvc|ssn|aadhaa?r|otp|pin)$/i
const PERSONAL_KEYS = /^(email|phone(_number)?|mobile|address|dob|birth_?date|birthdate|date_of_birth)$/i
const luhn = (digits: string) => {
  let sum = 0
  for (let i = 0; i < digits.length; i++) {
    let digit = Number(digits[digits.length - 1 - i])
    if (i % 2) digit = digit * 2 > 9 ? digit * 2 - 9 : digit * 2
    sum += digit
  }
  return sum % 10 === 0
}

/** Walks the payload for values that anyone holding the token can read. */
function scanSensitive(payload: Record<string, unknown>): JwtIssue[] {
  const found: JwtIssue[] = []
  const seen = new Set<string>()
  const add = (issue: JwtIssue) => {
    const key = `${issue.code}:${issue.claim}`
    if (seen.has(key)) return
    seen.add(key)
    found.push(issue)
  }
  const walk = (value: unknown, path: string, key: string, depth: number) => {
    if (depth > 6 || found.length > 12) return
    if (value && typeof value === "object") {
      for (const [childKey, child] of Object.entries(value as Record<string, unknown>).slice(0, 200)) walk(child, path ? `${path}.${childKey}` : childKey, childKey, depth + 1)
      return
    }
    const text = typeof value === "string" || typeof value === "number" ? String(value) : ""
    if (!text) return
    const digits = text.replace(/[\s-]/g, "")
    if (SECRET_KEYS.test(key)) add({ code: "secret-claim", severity: "danger", claim: path })
    else if (/^\d{13,19}$/.test(digits) && luhn(digits)) add({ code: "secret-claim", severity: "danger", claim: path, detail: "card" })
    else if (PERSONAL_KEYS.test(key) || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text)) add({ code: "personal-claim", severity: "warning", claim: path })
  }
  walk(payload, "", "", 0)
  return found
}

const ASYMMETRIC = /^(RS|PS|ES|EdDSA|Ed25519|Ed448)/i
const TIME_CLAIMS = ["exp", "nbf", "iat"] as const

/** Decodes a JWT locally and lists what a careful reviewer would flag. */
export function inspectJwt(raw: unknown, options: JwtOptions): JwtAnalysis {
  const { algorithms, audience, issuer, type, now, leeway = 60, maxLifetime = 86_400 } = options
  const { token, wrapped, extracted } = cleanToken(raw)
  const issues: JwtIssue[] = []
  if (!token) return { decoded: null, issues }
  const parts = token.split(".")
  if (parts.length === 5) {
    const header = parseObject(decodeBase64Url(parts[0]))
    return { decoded: header ? { header, payload: null, signature: "", token } : null, issues: [{ code: "encrypted", severity: "info", detail: String(header?.enc ?? "") }] }
  }
  if (parts.length !== 3) return { decoded: null, issues: [{ code: "not-jwt", severity: "error", detail: String(parts.length) }] }
  const header = parseObject(decodeBase64Url(parts[0]))
  if (!header) return { decoded: null, issues: [{ code: "bad-part", severity: "error", detail: "header" }] }
  const payloadText = decodeBase64Url(parts[1])
  if (payloadText === null) return { decoded: null, issues: [{ code: "bad-part", severity: "error", detail: "payload" }] }
  const payload = parseObject(payloadText)
  const decoded: DecodedJwt = { header, payload, payloadText: payload ? undefined : payloadText, signature: parts[2], token }
  if (wrapped) issues.push({ code: "wrapped", severity: "info" })
  if (extracted) issues.push({ code: "extracted", severity: "info" })

  const alg = typeof header.alg === "string" ? header.alg : ""
  if (!alg) issues.push({ code: "alg-missing", severity: "error", claim: "alg" })
  else if (alg.toLowerCase() === "none") issues.push({ code: "alg-none", severity: "danger", claim: "alg", detail: alg })
  else if (algorithms?.length && !algorithms.includes(alg)) {
    const expectsAsymmetric = algorithms.every((name) => ASYMMETRIC.test(name))
    issues.push({ code: expectsAsymmetric && /^HS/i.test(alg) ? "alg-confusion" : "alg-unexpected", severity: "danger", claim: "alg", detail: alg })
  }
  // An alg that promises a signature, with the signature cut off: only a verifier that skips empty signatures accepts it.
  if (alg && alg.toLowerCase() !== "none" && !parts[2]) issues.push({ code: "no-signature", severity: "danger", claim: "alg", detail: alg })
  // RFC 8725 §3.10: key URLs the token picks (jku, x5u) invite SSRF; embedded keys (jwk, x5c) let it vouch for itself.
  for (const field of ["jku", "x5u", "jwk", "x5c"]) if (field in header) issues.push({ code: "key-in-header", severity: "warning", claim: field })
  // RFC 8725 §3.10: kid is used for a key lookup, so quotes, slashes or dots in it are an injection attempt.
  if (typeof header.kid === "string" && /\.\.|['"`;\\/<>\s]|\$\{|--/.test(header.kid)) issues.push({ code: "kid-suspicious", severity: "warning", claim: "kid", detail: header.kid.slice(0, 60) })
  // RFC 7515 §4.1.11: a verifier that doesn't understand every critical parameter must reject the token.
  if ("crit" in header) issues.push({ code: "crit", severity: "warning", claim: "crit", detail: Array.isArray(header.crit) ? header.crit.join(", ") : String(header.crit) })
  if (type) {
    const strip = (value: unknown) => String(value ?? "").toLowerCase().replace(/^application\//, "")
    if (strip(header.typ) !== strip(type)) issues.push({ code: "typ-mismatch", severity: "error", claim: "typ", detail: header.typ === undefined ? "none" : String(header.typ) })
  }
  // RFC 8725 §3.3: in a nested JWT the inner token has to be verified too.
  if (String(header.cty ?? "").toUpperCase() === "JWT" || (!payload && /^eyJ[\w-]*\.[\w-]*\./.test(payloadText))) issues.push({ code: "nested", severity: "info" })

  if (payload) {
    const nowSeconds = now / 1000
    const times: Partial<Record<(typeof TIME_CLAIMS)[number], number>> = {}
    for (const claim of TIME_CLAIMS) {
      if (!(claim in payload)) continue
      const value = payload[claim]
      if (typeof value !== "number" || !Number.isFinite(value)) issues.push({ code: "bad-time", severity: "error", claim })
      else if (value > 1e11) issues.push({ code: "milliseconds", severity: "error", claim })
      else times[claim] = value
    }
    if (times.exp !== undefined && times.exp + leeway <= nowSeconds) issues.push({ code: "expired", severity: "error", claim: "exp", seconds: times.exp - nowSeconds })
    if (times.nbf !== undefined && times.nbf - leeway > nowSeconds) issues.push({ code: "not-yet", severity: "error", claim: "nbf", seconds: times.nbf - nowSeconds })
    if (times.iat !== undefined && times.iat - leeway > nowSeconds) issues.push({ code: "iat-future", severity: "warning", claim: "iat", seconds: times.iat - nowSeconds })
    if (!("exp" in payload)) issues.push({ code: "no-exp", severity: "warning", claim: "exp" })
    const start = times.nbf ?? times.iat
    if (times.exp !== undefined && start !== undefined && times.exp - start > maxLifetime) issues.push({ code: "long-life", severity: "warning", claim: "exp", seconds: times.exp - start })

    const aud = payload.aud
    const audiences = Array.isArray(aud) ? aud.map(String) : aud === undefined ? [] : [String(aud)]
    if (!audiences.length) issues.push({ code: "no-aud", severity: "warning", claim: "aud" })
    else if (audience && !audiences.includes(audience)) issues.push({ code: "aud-mismatch", severity: "error", claim: "aud", detail: audiences.join(", ") })
    if (payload.iss === undefined) issues.push({ code: "no-iss", severity: "warning", claim: "iss" })
    else if (issuer && String(payload.iss) !== issuer) issues.push({ code: "iss-mismatch", severity: "error", claim: "iss", detail: String(payload.iss) })
    issues.push(...scanSensitive(payload))
  }
  return { decoded, issues }
}

/** "3 h 20 min", "12 days", "45 s": a short human span for a number of seconds. */
export function formatSpan(seconds: number): string {
  const s = Math.abs(Math.round(seconds))
  if (s < 90) return `${s} s`
  if (s < 5400) return `${Math.round(s / 60)} min`
  if (s < 172_800) {
    const hours = Math.floor(s / 3600)
    const minutes = Math.round((s % 3600) / 60)
    return minutes ? `${hours} h ${minutes} min` : `${hours} h`
  }
  if (s < 63_072_000) return `${Math.round(s / 86_400)} days`
  return `${Math.round(s / 31_557_600)} years`
}
