/** Handles no user should get: staff and system words that make phishing easy, and route names. */
export const RESERVED_USERNAMES = [
  "admin", "administrator", "root", "support", "help", "helpdesk", "staff", "team", "official", "security",
  "moderator", "mod", "system", "billing", "payments", "verify", "verified", "api", "www", "mail", "email",
  "settings", "login", "signup", "account", "about", "null", "undefined", "me", "everyone", "here",
]

/**
 * Look-alikes folded to one Latin letter: the common Cyrillic/Greek homoglyphs from Unicode's
 * confusables.txt (UTS #39), plus the digit swaps impersonators use (0→o, 1→l, 3→e, 5→s).
 */
const LOOKALIKE: Record<string, string> = {
  а: "a", е: "e", о: "o", р: "p", с: "c", у: "y", х: "x", і: "i", ј: "j", ѕ: "s", ԁ: "d", ɡ: "g", һ: "h", ӏ: "l",
  α: "a", ο: "o", ν: "v", ρ: "p", ι: "i", κ: "k", τ: "t", υ: "u", χ: "x", ɩ: "i", "ı": "i",
}
const DIGITS: Record<string, string> = { "0": "o", "1": "l", "3": "e", "5": "s", "4": "a", "7": "t" }

/** Strips a typed "@", spaces at the ends and compatibility forms (ｐｒｉｙａ → priya). Case is kept. */
export function cleanUsername(raw: string) {
  return raw.normalize("NFKC").trim().replace(/^@+/, "")
}

/** The handle as it is compared and stored: lower case. */
export const canonicalUsername = (name: string) => cleanUsername(name).toLowerCase()

/** Replaces look-alike letters with the plain Latin letter they imitate (pаypal with a Cyrillic а → paypal). */
export function plainLetters(name: string) {
  return [...name].map((char) => LOOKALIKE[char] ?? LOOKALIKE[char.toLowerCase()] ?? char).join("")
}

/**
 * Visual skeleton for impersonation checks: case, accents, look-alike letters, digit swaps,
 * rn→m, vv→w, i/l and the separators . _ - all collapse, so "Pr1ya_Sharma" ≈ "priya.sharma".
 */
export function usernameSkeleton(name: string) {
  return plainLetters(canonicalUsername(name))
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .replace(/[013457]/g, (d) => DIGITS[d] ?? d)
    .replace(/[._-]+/g, "")
    .replace(/rn/g, "m")
    .replace(/vv/g, "w")
    .replace(/i/g, "l")
}

export type UsernameIssue =
  | { kind: "lookalike-letters"; fix: string }
  | { kind: "characters"; chars: string; fix: string }
  | { kind: "edge"; fix: string }
  | { kind: "reserved"; name: string; exact: boolean }
  | { kind: "case-duplicate"; name: string }
  | { kind: "taken"; name: string }
  | { kind: "impersonation"; name: string }

/**
 * Finds the first local problem with a handle: look-alike letters, disallowed characters, a dot or
 * underscore at either end, a reserved word (or a disguised one like adm1n), and a clash with an
 * existing handle, whether identical, different only in case, or merely confusable.
 */
export function checkUsername(raw: string, { reserved = RESERVED_USERNAMES, existing = [] as string[] } = {}): UsernameIssue | null {
  const name = cleanUsername(raw)
  if (!name) return null
  const plain = plainLetters(name)
  if (plain !== name && /^[a-z0-9._]+$/i.test(plain)) return { kind: "lookalike-letters", fix: plain }
  const bad = [...new Set(name.match(/[^a-z0-9._]/gi) ?? [])]
  if (bad.length) {
    const fix = name.replace(/\s+/g, "_").replace(/-/g, "_").replace(/[^a-z0-9._]/gi, "").replace(/_{2,}/g, "_")
    return { kind: "characters", chars: bad.map((c) => (c === " " ? "spaces" : c)).join(" "), fix }
  }
  if (/^[._]|[._]$|\.\./.test(name)) return { kind: "edge", fix: name.replace(/^[._]+|[._]+$/g, "").replace(/\.{2,}/g, ".") }

  const lower = name.toLowerCase()
  const skeleton = usernameSkeleton(name)
  for (const word of reserved) {
    if (lower === word) return { kind: "reserved", name: word, exact: true }
    if (skeleton === usernameSkeleton(word)) return { kind: "reserved", name: word, exact: false }
  }
  for (const other of existing) {
    if (other === name) return { kind: "taken", name: other }
    if (other.toLowerCase() === lower) return { kind: "case-duplicate", name: other }
    if (usernameSkeleton(other) === skeleton) return { kind: "impersonation", name: other }
  }
  return null
}

/** Free-form alternatives to try when a handle is taken: priya.sharma → priya.sharma_, priyasharma, priya.sharma2… */
export function usernameCandidates(name: string, max = 8) {
  const base = canonicalUsername(name)
  const joined = base.replace(/[._]/g, "")
  const list = [`${base}_`, joined !== base ? joined : `${base}.hq`, `${base}.in`, `the.${base}`, ...[2, 3, 7, 24].map((n) => `${base}${n}`)]
  return [...new Set(list)].slice(0, max)
}
