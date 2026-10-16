/** A site's password rules, as an admin configures them. */
export interface PasswordPolicy {
  /** Shortest password accepted. */
  minLength: number
  /** Longest password accepted. */
  maxLength: number
  requireUppercase: boolean
  requireLowercase: boolean
  requireDigit: boolean
  requireSymbol: boolean
  /** Force a change every N days; 0 means never. */
  expiryDays: number
  /** Allow pasting into the password field. NIST: SHOULD permit paste; SHALL allow password managers and autofill (not configurable here). */
  allowPaste: boolean
  /** Reject passwords found in breach corpuses and common-password lists. */
  breachCheck: boolean
  /** Ask security questions ("first pet?") at sign-up or recovery. */
  securityQuestions: boolean
  /** Let users store a password hint. */
  passwordHints: boolean
  /** A second factor is always required, so the password is never used alone. */
  mfaRequired: boolean
  /** Consecutive failed sign-ins before the account is locked or throttled; 0 means no limit. */
  maxFailedAttempts: number
}

/** NIST SP 800-63B-4 (final, July 2025) defaults: 15 minimum (8 only with MFA), 64 maximum, no composition rules or expiry. */
export const NIST_POLICY: PasswordPolicy = {
  minLength: 15, maxLength: 64, requireUppercase: false, requireLowercase: false, requireDigit: false, requireSymbol: false,
  expiryDays: 0, allowPaste: true, breachCheck: true, securityQuestions: false, passwordHints: false, mfaRequired: false, maxFailedAttempts: 100,
}

export type FindingId = "composition" | "expiry" | "min-length" | "max-length" | "max-below-min" | "paste" | "breach" | "questions" | "hints" | "rate-limit"

export interface PolicyFinding {
  id: FindingId
  /** SHALL / SHALL NOT breaks the standard; SHOULD is a recommendation. */
  level: "shall" | "should"
  /** The settings that make this finding go away. */
  fix: Partial<PasswordPolicy>
  /** Where NIST says it: section of SP 800-63B-4. */
  section: string
}

const num = (value: unknown, fallback: number) => {
  const n = Math.floor(Number(value))
  return Number.isFinite(n) && n >= 0 ? Math.min(n, 100000) : fallback
}

/** Repairs null, NaN, negative and missing values so the audit never crashes on a half-filled form. */
export function sanitizePolicy(policy: Partial<PasswordPolicy> | null | undefined): PasswordPolicy {
  const p = policy && typeof policy === "object" ? policy : {}
  const flag = (key: keyof PasswordPolicy) => (typeof p[key] === "boolean" ? (p[key] as boolean) : (NIST_POLICY[key] as boolean))
  return {
    minLength: num(p.minLength, NIST_POLICY.minLength), maxLength: num(p.maxLength, NIST_POLICY.maxLength),
    requireUppercase: flag("requireUppercase"), requireLowercase: flag("requireLowercase"), requireDigit: flag("requireDigit"), requireSymbol: flag("requireSymbol"),
    expiryDays: num(p.expiryDays, 0), allowPaste: flag("allowPaste"), breachCheck: flag("breachCheck"), securityQuestions: flag("securityQuestions"),
    passwordHints: flag("passwordHints"), mfaRequired: flag("mfaRequired"), maxFailedAttempts: num(p.maxFailedAttempts, NIST_POLICY.maxFailedAttempts),
  }
}

/** Reads the policy against NIST SP 800-63B-4 §3.1.1.2 and §3.2.2. SHALL findings come first. */
export function auditPasswordPolicy(input: Partial<PasswordPolicy> | null | undefined): PolicyFinding[] {
  const p = sanitizePolicy(input)
  const min = p.mfaRequired ? 8 : 15
  const findings: PolicyFinding[] = []
  if (p.requireUppercase || p.requireLowercase || p.requireDigit || p.requireSymbol)
    findings.push({ id: "composition", level: "shall", section: "3.1.1.2", fix: { requireUppercase: false, requireLowercase: false, requireDigit: false, requireSymbol: false } })
  if (p.expiryDays > 0) findings.push({ id: "expiry", level: "shall", section: "3.1.1.2", fix: { expiryDays: 0 } })
  if (p.minLength < min) findings.push({ id: "min-length", level: "shall", section: "3.1.1.2", fix: { minLength: min, maxLength: Math.max(p.maxLength, 64) } })
  if (!p.breachCheck) findings.push({ id: "breach", level: "shall", section: "3.1.1.2", fix: { breachCheck: true } })
  if (p.securityQuestions) findings.push({ id: "questions", level: "shall", section: "3.1.1.2", fix: { securityQuestions: false } })
  if (p.passwordHints) findings.push({ id: "hints", level: "shall", section: "3.1.1.2", fix: { passwordHints: false } })
  if (p.maxFailedAttempts === 0 || p.maxFailedAttempts > 100) findings.push({ id: "rate-limit", level: "shall", section: "3.2.2", fix: { maxFailedAttempts: 100 } })
  if (p.maxLength < Math.max(p.minLength, min)) findings.push({ id: "max-below-min", level: "shall", section: "3.1.1.2", fix: { maxLength: Math.max(64, p.minLength) } })
  else if (p.maxLength < 64) findings.push({ id: "max-length", level: "should", section: "3.1.1.2", fix: { maxLength: 64 } })
  if (!p.allowPaste) findings.push({ id: "paste", level: "should", section: "3.1.1.2", fix: { allowPaste: true } })
  return findings
}

/** Common passwords that composition rules happily accept. A real deployment uses a breach list (e.g. Have I Been Pwned's k-anonymity API). */
const BLOCKED = new Set(["password1!", "p@ssw0rd123", "welcome@123", "qwerty@123", "summer2026!", "india@123", "admin@1234"])

export interface SampleResult {
  password: string
  /** Accepted by the configured rules. */
  accepted: boolean
  /** Why the configured rules reject it. */
  reasons: ("short" | "long" | "upper" | "lower" | "digit" | "symbol" | "blocked")[]
  /** On a common-password list: an attacker tries it first. */
  common: boolean
}

/** What the configured rules do to real passwords: "Password1!" may pass while a long passphrase fails. */
export function trySamples(input: Partial<PasswordPolicy> | null | undefined, samples: string[]): SampleResult[] {
  const p = sanitizePolicy(input)
  return samples.map((password) => {
    const length = [...password].length
    const reasons: SampleResult["reasons"] = []
    if (length < p.minLength) reasons.push("short")
    if (p.maxLength > 0 && length > p.maxLength) reasons.push("long")
    if (p.requireUppercase && !/\p{Lu}/u.test(password)) reasons.push("upper")
    if (p.requireLowercase && !/\p{Ll}/u.test(password)) reasons.push("lower")
    if (p.requireDigit && !/\p{Nd}/u.test(password)) reasons.push("digit")
    if (p.requireSymbol && !/[^\p{L}\p{Nd}\s]/u.test(password)) reasons.push("symbol")
    const common = BLOCKED.has(password.toLowerCase())
    if (common && p.breachCheck) reasons.push("blocked")
    return { password, accepted: reasons.length === 0, reasons, common }
  })
}
