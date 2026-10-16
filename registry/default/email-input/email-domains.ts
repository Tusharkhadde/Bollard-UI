/**
 * Pure, server-safe email helpers shared by EmailInput and other components (no React, no DOM).
 */

/** Popular mailbox providers, most common first so ties go to the likelier one. */
export const COMMON_EMAIL_DOMAINS = [
  "gmail.com", "yahoo.com", "outlook.com", "hotmail.com", "icloud.com", "yahoo.co.in",
  "rediffmail.com", "live.com", "aol.com", "protonmail.com", "proton.me", "zoho.com",
  "zohomail.in", "yahoo.in", "ymail.com", "msn.com", "me.com", "gmx.com", "mail.com",
  "hotmail.co.uk", "yahoo.co.uk", "outlook.in", "hey.com", "fastmail.com",
]

const TLD_TYPOS: Record<string, string> = {
  con: "com", cmo: "com", ocm: "com", vom: "com", xom: "com", cpm: "com", comm: "com",
  coom: "com", ccom: "com", cm: "com", om: "com", nte: "net", ner: "net", ogr: "org", rog: "org",
}

/** Damerau-Levenshtein (optimal string alignment): a swapped pair costs 1, not 2. */
function distance(a: string, b: string) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array<number>(b.length).fill(0)])
  for (let j = 1; j <= b.length; j++) d[0][j] = j
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1)
    }
  }
  return d[a.length][b.length]
}

/**
 * Returns the corrected domain when the address's domain looks like a typo of a
 * common provider (gmial.con → gmail.com, yaho.com → yahoo.com), or null.
 */
export function suggestEmailDomain(email: string, domains: string[] = COMMON_EMAIL_DOMAINS): string | null {
  const at = email.lastIndexOf("@")
  if (at < 1) return null
  const typed = email.slice(at + 1).toLowerCase()
  if (!typed || domains.includes(typed)) return null

  // Fix an obviously mistyped ending first, so "hotmial.con" only needs one more edit.
  const parts = typed.split(".")
  const last = parts[parts.length - 1]
  if (parts.length > 1 && TLD_TYPOS[last]) parts[parts.length - 1] = TLD_TYPOS[last]
  const domain = parts.join(".")
  if (domains.includes(domain)) return domain

  // "user@gmail" with no ending at all.
  if (!domain.includes(".")) return domains.find((d) => distance(domain, d.split(".")[0]) <= 1) ?? null

  let best: string | null = null
  let bestScore = Infinity
  for (const candidate of domains) {
    const score = distance(domain, candidate)
    if (score < bestScore) [best, bestScore] = [candidate, score]
  }
  if (best && bestScore <= (domain.length >= 12 ? 2 : 1)) return best
  return domain !== typed ? domain : null
}

/** Structural slips in an address, each with the fixed address and a short fix label. */
export function findEmailProblem(email: string): { message: string; fix?: string; fixLabel?: string } | null {
  const ats = email.match(/@+/g) ?? []
  if (ats.join("").length > 1) {
    return ats.length === 1
      ? { message: "This address has more than one @.", fix: email.replace(/@+/, "@"), fixLabel: "Remove the extra @" }
      : { message: "This address has more than one @." }
  }
  if (/\.$/.test(email)) return { message: "The address ends with a dot.", fix: email.replace(/\.+$/, ""), fixLabel: "Remove the dot" }
  if (email.includes("..")) return { message: "The address has two dots in a row.", fix: email.replace(/\.{2,}/g, "."), fixLabel: "Remove the extra dot" }
  if (/@\./.test(email)) return { message: "The domain starts with a dot.", fix: email.replace(/@\.+/, "@"), fixLabel: "Remove the dot" }
  return null
}
