/** Frameworks that send prefixed env vars to the browser: inlined at build time, or (Nuxt) sent in the page payload for declared public runtime config. */
export type EnvFramework = "next" | "vite" | "cra" | "expo" | "sveltekit" | "astro" | "nuxt" | "auto"

export const PUBLIC_PREFIXES: Record<Exclude<EnvFramework, "auto">, string> = {
  next: "NEXT_PUBLIC_",
  vite: "VITE_",
  cra: "REACT_APP_",
  expo: "EXPO_PUBLIC_",
  sveltekit: "PUBLIC_",
  astro: "PUBLIC_",
  nuxt: "NUXT_PUBLIC_",
}

export type PublicEnvIssueKind = "secret-value" | "secret-name" | "service-role" | "url-credentials" | "high-entropy" | "dead-prefix" | "misleading-prefix" | "google-key"

export interface PublicEnvIssue {
  kind: PublicEnvIssueKind
  severity: "error" | "warning" | "info"
  /** What the value looked like, e.g. "Stripe secret key". */
  shape?: string
  /** The new key name for a one-tap rename, or null when the fix is to delete this public copy. Undefined: no fix. */
  fix?: string | null
}

export interface PublicEnvEntry {
  key: string
  value: string
  /** First and last source line (0-based) the entry spans. */
  line: number
  endLine: number
  /** The client-exposed prefix this key carries, or "" when it stays on the server. */
  prefix: string
  /** A public prefix from another framework that this one ignores, or "". */
  deadPrefix: string
  /** The key without either prefix: the server-only name. */
  bare: string
  issue?: PublicEnvIssue
}

const SECRET_SHAPES: [RegExp, string][] = [
  [/^(sk|rk)_(live|test)_\w{8,}/, "Stripe or Clerk secret key"],
  [/^whsec_\w{8,}/, "Stripe webhook secret"],
  [/^sk-ant-[\w-]{12,}/, "Anthropic API key"],
  [/^sk-(proj-)?[\w-]{16,}/, "OpenAI API key"],
  [/^(ghp|gho|ghu|ghs|ghr)_\w{20,}|^github_pat_\w{20,}/, "GitHub token"],
  [/^glpat-[\w-]{16,}/, "GitLab token"],
  [/^xox[abposr]-[\w-]{10,}/, "Slack token"],
  [/^(AKIA|ASIA)[0-9A-Z]{16}$/, "AWS access key"],
  [/^sk\.eyJ/, "Mapbox secret token"],
  [/^SG\.[\w-]{16,}\.[\w-]{16,}/, "SendGrid API key"],
  [/^npm_\w{30,}/, "npm token"],
  [/^sb_secret_[\w-]{16,}/, "Supabase secret key"],
  [/^hf_[A-Za-z0-9]{30,}/, "Hugging Face token"],
  [/^gsk_[A-Za-z0-9]{40,}/, "Groq API key"],
  [/^xai-[A-Za-z0-9]{40,}/, "xAI API key"],
  [/^SK[0-9a-f]{32}$/, "Twilio API key"],
  [/^sk_[a-f0-9]{32,}$|^re_\w{20,}/, "API secret key"],
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, "private key"],
]
/** Shapes that are designed to ship to browsers, so a secret-sounding name doesn't matter. */
const PUBLIC_SHAPES = [/^pk_(live|test)_/, /^sb_publishable_/, /^pk\.eyJ/, /^https:\/\/[\w]+@[\w.-]*sentry\.io\//, /^phc_\w+/, /^G-[A-Z0-9]{6,}$/, /^UA-\d+-\d+$/]
const SECRET_NAME = /SECRET|PRIVATE|PASSWORD|PASSWD|SERVICE_ROLE|SERVICE_KEY|ADMIN_KEY|(^|_)TOKEN$|AUTH_TOKEN|ACCESS_KEY|SIGNING_KEY|ENCRYPTION_KEY|DATABASE_URL|DB_URL|(^|_)DB_PASS/

/** Decodes a JWT payload without verifying it, or returns null. Never throws. */
export function jwtClaims(value: string): Record<string, unknown> | null {
  const part = value.split(".")[1]
  if (!/^eyJ[\w-]+\.eyJ[\w-]+\.[\w-]*$/.test(value) || !part) return null
  try {
    const claims: unknown = JSON.parse(atob(part.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(part.length / 4) * 4, "=")))
    return claims && typeof claims === "object" ? (claims as Record<string, unknown>) : null
  } catch {
    return null
  }
}

/** Shannon entropy in bits per character. */
function entropy(value: string) {
  const counts = new Map<string, number>()
  for (const char of value) counts.set(char, (counts.get(char) ?? 0) + 1)
  return [...counts.values()].reduce((sum, n) => sum - (n / value.length) * Math.log2(n / value.length), 0)
}

/** The client-exposed prefix on `key` for this framework ("" when none). Longest prefix wins, so NEXT_PUBLIC_ beats PUBLIC_. */
export function publicPrefix(key: string, framework: EnvFramework = "auto") {
  const all = [...new Set(Object.values(PUBLIC_PREFIXES))].sort((a, b) => b.length - a.length)
  const own = framework === "auto" ? all : [PUBLIC_PREFIXES[framework]]
  const found = all.find((prefix) => key.startsWith(prefix) && key.length > prefix.length) ?? ""
  return { prefix: own.includes(found) ? found : "", dead: own.includes(found) ? "" : found }
}

/** Reads KEY=VALUE text (export, quotes, # comments, quoted multi-line values, CRLF line endings, a BOM). Never throws. */
export function parseEnvText(text: string) {
  // Windows editors save CRLF; a stray \r would stop every line from matching and the file would look clean.
  const lines = text.replace(/^\uFEFF/, "").split("\n").map((line) => line.replace(/\r$/, ""))
  const entries: { key: string; value: string; line: number; endLine: number }[] = []
  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(/^\s*(?:export\s+)?([A-Za-z_][\w.-]*)\s*=\s*(.*)$/)
    if (!match) continue
    const start = i
    let value = match[2].trim()
    const quote = value[0]
    if ((quote === '"' || quote === "'") && !(value.length > 1 && value.endsWith(quote))) {
      while (i + 1 < lines.length && !lines[i].trimEnd().endsWith(quote)) value += "\n" + lines[++i]
    }
    value = value.trim()
    if ((quote === '"' || quote === "'") && value.length > 1 && value.endsWith(quote)) value = value.slice(1, -1)
    else value = value.replace(/\s+#.*$/, "")
    entries.push({ key: match[1], value, line: start, endLine: i })
  }
  return entries
}

/** Finds secrets that a client-exposed prefix would inline into the browser bundle. */
export function scanPublicEnv(text: string, framework: EnvFramework = "auto", publicKeys: string[] = []): PublicEnvEntry[] {
  const parsed = parseEnvText(text)
  const names = new Set(parsed.map((entry) => entry.key))
  return parsed.map((entry) => {
    const { prefix, dead } = publicPrefix(entry.key, framework)
    const bare = entry.key.slice((prefix || dead).length)
    const base = { ...entry, prefix, deadPrefix: dead, bare }
    // When the server-only name already exists, the fix is to drop this public copy instead of renaming over it.
    const serverFix = names.has(bare) ? null : bare
    const value = entry.value
    const shape = SECRET_SHAPES.find(([pattern]) => pattern.test(value))?.[1]
    const claims = jwtClaims(value)
    const looksPublic = PUBLIC_SHAPES.some((pattern) => pattern.test(value)) || claims?.role === "anon"
    const secret: PublicEnvIssue | undefined = shape
      ? { kind: "secret-value", severity: "error", shape, fix: serverFix }
      : claims?.role === "service_role"
        ? { kind: "service-role", severity: "error", fix: serverFix }
        : /^[a-z][\w+.-]*:\/\/[^/\s:@]+:[^/\s@]+@/i.test(value)
          ? { kind: "url-credentials", severity: "error", fix: serverFix }
          : !looksPublic && SECRET_NAME.test(bare)
            ? { kind: "secret-name", severity: "error", fix: serverFix }
            : undefined
    if (dead) {
      if (secret) return { ...base, issue: { kind: "misleading-prefix", severity: "warning", shape: secret.shape, fix: serverFix } }
      return { ...base, issue: { kind: "dead-prefix", severity: "warning", fix: framework === "auto" ? undefined : PUBLIC_PREFIXES[framework] + bare } }
    }
    if (!prefix || publicKeys.includes(entry.key)) return base
    if (secret) return { ...base, issue: secret }
    if (/^AIza[\w-]{35}$/.test(value)) return { ...base, issue: { kind: "google-key", severity: "info" } }
    if (!looksPublic && !claims && value.length >= 24 && !/[\s/:]/.test(value) && entropy(value) >= 4)
      return { ...base, issue: { kind: "high-entropy", severity: "warning", fix: serverFix } }
    return base
  })
}

/** Renames the key on an entry's line, or deletes the entry when `to` is null. */
export function renameEnvKey(text: string, entry: Pick<PublicEnvEntry, "key" | "line" | "endLine">, to: string | null) {
  const lines = text.split("\n")
  if (to === null) lines.splice(entry.line, entry.endLine - entry.line + 1)
  // Anchor on the key itself so a value that happens to contain the key's text is never touched.
  else lines[entry.line] = lines[entry.line].replace(/^(\uFEFF?\s*(?:export\s+)?)([A-Za-z_][\w.-]*)/, (match, lead: string, key: string) => (key === entry.key ? lead + to : match))
  return lines.join("\n")
}
