// Bollard UI — email-change-guard · MIT licence · https://bollard-ui.vercel.app/components/email-change-guard

import { COMMON_EMAIL_DOMAINS, suggestEmailDomain } from "@/registry/default/email-input/email-domains"

export type EmailChangeIssue =
  | { kind: "invalid" }
  | { kind: "same" }
  | { kind: "sameMailbox"; reason: "dots" | "plus" }
  | { kind: "typo"; fixed: string; domain: string }
  | { kind: "mismatch"; at: number }

/** Trim, drop a BOM, zero-width characters and line breaks a paste can carry; lower-case the domain. */
export function cleanEmail(text: unknown): string {
  if (typeof text !== "string") return ""
  const clean = text.replace(/[\uFEFF\u200B-\u200D\u2060\r\n\t ]/g, "").slice(0, 320)
  const at = clean.lastIndexOf("@")
  return at < 0 ? clean : clean.slice(0, at) + "@" + clean.slice(at + 1).toLowerCase()
}

/** A complete address: one @, a dotted domain and a real ending (letters, or an "xn--" IDN ending). */
export const isEmail = (email: string) =>
  /^[^\s@"(),:;<>[\]\\]+@[a-z0-9-]+(\.[a-z0-9-]+)*\.([a-z]{2,}|xn--[a-z0-9-]{2,})$/i.test(email) && email.length <= 254

/** Gmail ignores dots and anything after "+"; most providers ignore "+tag". Returns the mailbox key. */
export function mailboxKey(email: string) {
  const [local = "", domain = ""] = cleanEmail(email).toLowerCase().split(/@(?=[^@]*$)/)
  const gmail = domain === "gmail.com" || domain === "googlemail.com"
  const base = local.split("+")[0]
  return `${gmail ? base.replace(/\./g, "") : base}@${gmail ? "gmail.com" : domain}`
}

/** Index of the first character where two strings differ, or -1 when equal. */
export function firstDifference(a: string, b: string) {
  if (a === b) return -1
  let i = 0
  while (i < a.length && i < b.length && a[i] === b[i]) i++
  return i
}

/**
 * Problems with a new account email: invalid, the same address, the same mailbox by Gmail dots or a
 * +tag, a typo'd provider (gmial.con), and a confirmation that doesn't match.
 */
export function checkEmailChange(current: string, next: string, confirm?: string, domains: string[] = COMMON_EMAIL_DOMAINS): EmailChangeIssue[] {
  const now = cleanEmail(current)
  const email = cleanEmail(next)
  const issues: EmailChangeIssue[] = []
  if (!email) return issues
  if (!isEmail(email)) issues.push({ kind: "invalid" })
  if (now && email.toLowerCase() === now.toLowerCase()) issues.push({ kind: "same" })
  else if (now && isEmail(email) && mailboxKey(email) === mailboxKey(now)) issues.push({ kind: "sameMailbox", reason: email.includes("+") || now.includes("+") ? "plus" : "dots" })
  const domain = suggestEmailDomain(email, domains)
  if (domain) issues.push({ kind: "typo", fixed: `${email.slice(0, email.lastIndexOf("@") + 1)}${domain}`, domain })
  if (confirm !== undefined && cleanEmail(confirm)) {
    const at = firstDifference(email.toLowerCase(), cleanEmail(confirm).toLowerCase())
    if (at >= 0) issues.push({ kind: "mismatch", at })
  }
  return issues
}
