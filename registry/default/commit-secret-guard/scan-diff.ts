// Pure unified-diff parsing and secret scanning of added lines only. Safe on the server.

export interface DiffFile {
  path: string
  isNew: boolean
  deleted: boolean
  binary: boolean
  /** Renamed or copied here from another path (`rename to`). */
  renamed: boolean
  /** Added lines with their line number in the new file. */
  added: { line: number; text: string }[]
}

export type FindingKind = "provider" | "generic" | "entropy" | "file"

export interface SecretFinding {
  /** Stable across re-scans: file + rule + a hash of the value (never the value itself). */
  id: string
  file: string
  /** Line in the new file; 0 for whole-file findings. */
  line: number
  /** Last line of a multi-line secret (a PEM private key block). Equal to `line` otherwise. */
  endLine: number
  rule: string
  /** e.g. "Stripe live secret key", ".env file". */
  label: string
  kind: FindingKind
  severity: "high" | "medium"
  /** The matched secret. Show `masked` instead. */
  value: string
  masked: string
  /** The added line with the secret masked. */
  preview: string
  /** The added line as written (contains the secret). Use it to build a patch, never to display. */
  source: string
  /** Suggested environment variable name. */
  envName: string
  /** Matched a fixture pattern; generic and entropy hits there are ignored, live provider keys are not. */
  fixture: boolean
  /** The line carries an allow marker (gitleaks:allow, pragma: allowlist secret). */
  allowed: boolean
  /** Where to revoke it, when known. */
  rotateUrl?: string
}

export const DEFAULT_FIXTURE_PATTERNS = ["**/__tests__/**", "**/*.test.*", "**/*.spec.*", "**/fixtures/**", "**/testdata/**", "**/__mocks__/**", "**/*.snap"]

type Rule = { id: string; label: string; re: RegExp; env: string; rotate?: string; severity?: "high" | "medium"; group?: number }
const RULES: Rule[] = [
  { id: "private-key", label: "Private key", re: /-----BEGIN (?:[A-Z0-9]+ )*PRIVATE KEY(?: BLOCK)?-----/, env: "PRIVATE_KEY" },
  { id: "aws-access-key", label: "AWS access key ID", re: /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/, env: "AWS_ACCESS_KEY_ID", rotate: "https://console.aws.amazon.com/iam/home#/security_credentials" },
  { id: "aws-secret", label: "AWS secret access key", re: /aws_?secret_?access_?key["']?\s*[:=]\s*["']?([A-Za-z0-9/+=]{40})\b/i, group: 1, env: "AWS_SECRET_ACCESS_KEY", rotate: "https://console.aws.amazon.com/iam/home#/security_credentials" },
  { id: "github-token", label: "GitHub token", re: /\bgh[pousr]_[A-Za-z0-9]{36,}\b|\bgithub_pat_[A-Za-z0-9_]{22,}/, env: "GITHUB_TOKEN", rotate: "https://github.com/settings/tokens" },
  { id: "gitlab-token", label: "GitLab token", re: /\bglpat-[A-Za-z0-9_-]{20,}/, env: "GITLAB_TOKEN", rotate: "https://gitlab.com/-/user_settings/personal_access_tokens" },
  { id: "stripe-live", label: "Stripe live secret key", re: /\b[sr]k_live_[A-Za-z0-9]{16,}/, env: "STRIPE_SECRET_KEY", rotate: "https://dashboard.stripe.com/apikeys" },
  { id: "stripe-test", label: "Stripe test key", re: /\b[sr]k_test_[A-Za-z0-9]{16,}/, env: "STRIPE_SECRET_KEY", severity: "medium" },
  { id: "stripe-webhook", label: "Stripe webhook secret", re: /\bwhsec_[A-Za-z0-9]{24,}/, env: "STRIPE_WEBHOOK_SECRET", rotate: "https://dashboard.stripe.com/webhooks" },
  { id: "slack-token", label: "Slack token", re: /\bxox[abprs]-[A-Za-z0-9-]{10,}/, env: "SLACK_TOKEN", rotate: "https://api.slack.com/apps" },
  { id: "slack-webhook", label: "Slack webhook URL", re: /https:\/\/hooks\.slack\.com\/services\/T[A-Z0-9]+\/B[A-Z0-9]+\/[A-Za-z0-9]{20,}/, env: "SLACK_WEBHOOK_URL" },
  { id: "anthropic", label: "Anthropic API key", re: /\bsk-ant-[A-Za-z0-9_-]{20,}/, env: "ANTHROPIC_API_KEY", rotate: "https://platform.claude.com/settings/keys" },
  { id: "openai", label: "OpenAI API key", re: /\bsk-(?:proj-|svcacct-|admin-)?[A-Za-z0-9_-]{20,}/, env: "OPENAI_API_KEY", rotate: "https://platform.openai.com/api-keys" },
  { id: "google-api", label: "Google API key", re: /\bAIza[0-9A-Za-z_-]{35}/, env: "GOOGLE_API_KEY", rotate: "https://console.cloud.google.com/apis/credentials" },
  { id: "google-oauth", label: "Google OAuth client secret", re: /\bGOCSPX-[A-Za-z0-9_-]{20,}/, env: "GOOGLE_CLIENT_SECRET", rotate: "https://console.cloud.google.com/apis/credentials" },
  { id: "npm-token", label: "npm token", re: /\bnpm_[A-Za-z0-9]{36}\b/, env: "NPM_TOKEN", rotate: "https://www.npmjs.com/settings/~/tokens" },
  { id: "npmrc-auth", label: "npm auth token", re: /_authToken\s*=\s*(?!\$\{)([^\s"']{8,})/, group: 1, env: "NPM_TOKEN" },
  { id: "sendgrid", label: "SendGrid API key", re: /\bSG\.[A-Za-z0-9_-]{22}\.[A-Za-z0-9_-]{43}\b/, env: "SENDGRID_API_KEY", rotate: "https://app.sendgrid.com/settings/api_keys" },
  { id: "jwt", label: "JSON Web Token", re: /\beyJ[A-Za-z0-9_-]{8,}\.eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{10,}/, env: "AUTH_TOKEN", severity: "medium" },
  { id: "url-password", label: "Password in a connection URL", re: /\b[a-z][a-z0-9+.-]*:\/\/[^\s:@/'"]+:([^\s@/'"]{3,})@[^\s'"]+/i, group: 1, env: "DATABASE_URL" },
]
const GENERIC = /([A-Za-z0-9_.-]*(?:secret|token|passw(?:or)?d|pwd|api[_-]?key|apikey|auth[_-]?key|credential|private[_-]?key|access[_-]?key|client[_-]?secret)[A-Za-z0-9_.-]*)["']?\s*(?:[:=]|=>|:=)\s*(["'`])([^"'`\s]{8,})\2/i
const ENV_LINE = /^\s*(?:export\s+)?([A-Z0-9_]*(?:SECRET|TOKEN|PASSWORD|PASSWD|API_KEY|APIKEY|PRIVATE_KEY|ACCESS_KEY|CREDENTIALS?)[A-Z0-9_]*)\s*=\s*["']?([^\s"'#]{8,})/
const PLACEHOLDER = /^(?:x+|\*+|\.+|-+|<.*>|\$\{.*\}|\$[A-Z_]+|\{\{.*\}\}|%[\w]+%|your[\w-]*|changeme|change[_-]?me|placeholder|dummy|fake|redacted|null|undefined|none|todo|secret|password|token|test[\w-]*|example[\w-]*|.*EXAMPLE.*|.*x{6,}.*|(process\.env|os\.environ|import\.meta\.env|ENV\[|getenv|System\.getenv).*)$/i
const ALLOW = /gitleaks:allow|pragma:\s*allowlist secret|secret-guard:allow/i
const SKIP_ENTROPY = /(^|\/)(package-lock\.json|yarn\.lock|pnpm-lock\.yaml|bun\.lockb?|go\.sum|Cargo\.lock|composer\.lock|poetry\.lock|Gemfile\.lock)$|\.(min\.js|map|svg|snap)$/i
const ENV_FILE = /(^|\/)\.env(\.[\w.-]+)?$/i
const ENV_EXAMPLE = /\.env\.(example|sample|template|dist|defaults)$/i
const KEY_FILE = /(^|\/)(id_(rsa|dsa|ecdsa|ed25519)|[^/]+\.(pem|key|p12|pfx|jks|keystore|ppk)|\.git-credentials|credentials\.json|service[-_]?account[^/]*\.json)$/i

export function shannonEntropy(text: string) {
  const counts = new Map<string, number>()
  for (const ch of text) counts.set(ch, (counts.get(ch) ?? 0) + 1)
  let bits = 0
  for (const n of counts.values()) bits -= (n / text.length) * Math.log2(n / text.length)
  return bits
}

const hash = (text: string) => {
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193)
  return (h >>> 0).toString(16).padStart(8, "0")
}
export const maskSecret = (value: string) => (value.length <= 10 ? "•".repeat(Math.max(4, value.length)) : `${value.slice(0, 4)}${"•".repeat(Math.min(12, value.length - 8))}${value.slice(-4)}`)
/** Undo git's C-style path quoting, octal UTF-8 bytes included: "caf\303\251.env" → café.env */
const unquote = (p: string) => {
  if (!p.startsWith('"') || !p.endsWith('"') || p.length < 2) return p
  const map: Record<string, number> = { n: 10, t: 9, r: 13, b: 8, f: 12, v: 11, a: 7 }
  const bytes: number[] = []
  const body = p.slice(1, -1)
  for (let i = 0; i < body.length; i++) {
    if (body[i] === "\\" && /^[0-7]{3}$/.test(body.slice(i + 1, i + 4))) bytes.push(parseInt(body.slice(i + 1, (i += 3) + 1), 8))
    else if (body[i] === "\\" && i + 1 < body.length) bytes.push(map[body[++i]] ?? body.charCodeAt(i))
    else bytes.push(...new TextEncoder().encode(body[i]))
  }
  return new TextDecoder().decode(new Uint8Array(bytes))
}

/** "**\/fixtures/**", "*.test.*" style globs. A pattern without a slash matches the file name anywhere. */
export function globToRegExp(glob: string) {
  const body = glob.replace(/^\.\//, "").replace(/[.+^$()|[\]\\]/g, "\\$&").replace(/\*\*\//g, "\u0000").replace(/\*\*/g, "\u0001").replace(/\*/g, "[^/]*").replace(/\?/g, "[^/]").replace(/\u0000/g, "(?:.*/)?").replace(/\u0001/g, ".*")
  return new RegExp(glob.includes("/") ? `^${body}$` : `(?:^|/)${body}$`)
}

/** Reads a unified diff (git diff --cached, a PR .diff). CRLF and BOM tolerated; garbage gives no files. */
export function parseUnifiedDiff(input: unknown): DiffFile[] {
  if (typeof input !== "string") return []
  const files: DiffFile[] = []
  let file: DiffFile | null = null
  let header = false // between "diff --git" and the first hunk
  let next = 0
  let prev = ""
  // Lines left in the current hunk, from its @@ header. Inside a hunk "--- x" / "+++ y" are content, not headers.
  let oldLeft = 0
  let newLeft = 0
  for (const raw of input.replace(/^\uFEFF/, "").slice(0, 5_000_000).split("\n")) {
    const before = prev
    const line = raw.endsWith("\r") ? raw.slice(0, -1) : raw
    prev = line
    if (oldLeft > 0 || newLeft > 0) {
      if (line.startsWith("+")) {
        file!.added.push({ line: next++, text: line.slice(1) })
        newLeft--
        continue
      }
      if (line.startsWith("-")) {
        oldLeft--
        continue
      }
      if (line.startsWith(" ") || line === "") {
        next++
        oldLeft--
        newLeft--
        continue
      }
      if (line.startsWith("\\")) continue
      oldLeft = newLeft = 0 // A hand-trimmed hunk ended early.
    }
    if (line.startsWith("diff --git ")) {
      const m = line.match(/^diff --git "?a\/(.+?)"? "?b\/(.+?)"?$/)
      file = { path: unquote(m?.[2] ?? ""), isNew: false, deleted: false, binary: false, renamed: false, added: [] }
      files.push(file)
      header = true
    } else if (line.startsWith("+++ ") && (header || !file || before.startsWith("--- "))) {
      // Plain `diff -u` output has no "diff --git" line, so a +++ outside a header starts a new file.
      if (!header) {
        file = { path: "", isNew: false, deleted: false, binary: false, renamed: false, added: [] }
        files.push(file)
      }
      const p = line.slice(4).replace(/\t.*$/, "")
      if (p === "/dev/null") file!.deleted = true
      else file!.path = unquote(p).replace(/^b\//, "")
      header = true
    } else if (file && header && line.startsWith("new file mode")) file.isNew = true
    else if (file && header && line.startsWith("deleted file mode")) file.deleted = true
    else if (file && header && /^(rename|copy) to /.test(line)) {
      file.renamed = true
      file.path = unquote(line.replace(/^(rename|copy) to /, ""))
    } else if (file && /^(Binary files .* differ|GIT binary patch)$/.test(line)) file.binary = true
    else if (line.startsWith("@@")) {
      const h = line.match(/^@@+ -\d+(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/)
      next = Number(h?.[2] ?? line.match(/\+(\d+)/)?.[1] ?? 1)
      if (h && file) {
        oldLeft = Number(h[1] ?? 1)
        newLeft = Number(h[3] ?? 1)
      }
      header = false
    } else if (file && !header && line.startsWith("+")) file.added.push({ line: next++, text: line.slice(1) })
    else if (file && !header && (line.startsWith(" ") || line === "")) next++
  }
  return files.filter((f) => f.path)
}

const screaming = (name: string) => name.replace(/([a-z0-9])([A-Z])/g, "$1_$2").replace(/[^A-Za-z0-9]+/g, "_").replace(/^_+|_+$/g, "").toUpperCase()

/** Scans only what the diff adds. Fixture files skip generic and entropy hits; live provider keys are flagged anywhere. */
export function scanDiffForSecrets(input: unknown, fixturePatterns: string[] = DEFAULT_FIXTURE_PATTERNS): SecretFinding[] {
  const fixtures = fixturePatterns.map(globToRegExp)
  const out: SecretFinding[] = []
  for (const f of parseUnifiedDiff(input)) {
    if (f.deleted) continue
    const fixture = fixtures.some((re) => re.test(f.path))
    const push = (partial: Omit<SecretFinding, "id" | "file" | "masked" | "fixture" | "preview" | "source" | "endLine"> & { preview?: string; endLine?: number }) => {
      const masked = maskSecret(partial.value)
      const id = `${f.path}:${partial.rule}:${hash(partial.value)}`
      if (out.some((o) => o.id === id && o.line === partial.line)) return
      out.push({ ...partial, endLine: partial.endLine ?? partial.line, id: out.some((o) => o.id === id) ? `${id}:${partial.line}` : id, file: f.path, masked, fixture, source: partial.preview ?? "", preview: (partial.preview ?? "").split(partial.value).join(masked).slice(0, 240) })
    }
    if (ENV_FILE.test(f.path) && !ENV_EXAMPLE.test(f.path) && (f.isNew || f.renamed || f.added.length)) push({ line: 0, rule: "env-file", label: ".env file", kind: "file", severity: "high", value: f.path, envName: "", allowed: false })
    else if (KEY_FILE.test(f.path)) push({ line: 0, rule: "key-file", label: "Key or credentials file", kind: "file", severity: "high", value: f.path, envName: "", allowed: false })
    const added = f.added.slice(0, 20_000)
    for (let k = 0; k < added.length; k++) {
      const { line, text } = added[k]
      const src = text.slice(0, 4000)
      // A PEM block is one finding spanning BEGIN…END; its base64 body lines aren't scanned on their own.
      if (/-----BEGIN (?:[A-Z0-9]+ )*PRIVATE KEY(?: BLOCK)?-----/.test(src) && !/-----END [A-Z0-9 ]*PRIVATE KEY/.test(src)) {
        let end = k
        while (end + 1 < added.length && end - k < 200 && added[end + 1].line === added[end].line + 1 && !/-----END [A-Z0-9 ]*PRIVATE KEY/.test(added[end].text)) end++
        if (/-----END [A-Z0-9 ]*PRIVATE KEY/.test(added[end].text)) {
          const value = src.match(/-----BEGIN (?:[A-Z0-9]+ )*PRIVATE KEY(?: BLOCK)?-----/)![0]
          push({ line, endLine: added[end].line, rule: "private-key", label: "Private key", kind: "provider", severity: "high", value: value + added.slice(k + 1, end + 1).map((a) => a.text).join(""), envName: "PRIVATE_KEY", allowed: ALLOW.test(src), preview: src })
          k = end
          continue
        }
      }
      const allowed = ALLOW.test(src)
      const taken: string[] = []
      for (const rule of RULES) {
        const m = src.match(rule.re)
        const value = m?.[rule.group ?? 0]
        if (!value || PLACEHOLDER.test(value) || taken.some((t) => t.includes(value) || value.includes(t))) continue
        taken.push(value)
        push({ line, rule: rule.id, label: rule.label, kind: "provider", severity: rule.severity ?? "high", value, envName: rule.env, allowed, rotateUrl: rule.rotate, preview: src })
      }
      const g = src.match(GENERIC)
      const e = g || ENV_FILE.test(f.path) ? null : src.match(ENV_LINE)
      const gName = g?.[1] ?? e?.[1] ?? ""
      const gValue = g?.[3] ?? e?.[2] ?? ""
      if (gValue && !taken.some((t) => t.includes(gValue) || gValue.includes(t)) && !PLACEHOLDER.test(gValue) && shannonEntropy(gValue) >= 3) {
        taken.push(gValue)
        push({ line, rule: "generic", label: `Hard-coded ${gName.replace(/^[._-]+/, "")}`, kind: "generic", severity: "medium", value: gValue, envName: screaming(gName), allowed, preview: src })
      }
      if (fixture || SKIP_ENTROPY.test(f.path) || ENV_FILE.test(f.path)) continue
      for (const m of src.matchAll(/[A-Za-z0-9+/_-]{32,}={0,2}/g)) {
        const token = m[0]
        const mixed = /[a-z]/.test(token) && /[A-Z]/.test(token) && /\d/.test(token)
        if (!mixed || taken.some((t) => t.includes(token) || token.includes(t)) || /^sha\d+-/.test(token) || src.includes(`/${token}`) || shannonEntropy(token) < 4.3) continue
        taken.push(token)
        push({ line, rule: "entropy", label: "High-entropy string", kind: "entropy", severity: "medium", value: token, envName: "SECRET", allowed, preview: src })
      }
    }
  }
  return out
}

/** How code in this file reads an environment variable. */
export function envReference(file: string, name: string) {
  const ext = file.split(".").pop()?.toLowerCase() ?? ""
  if (/^(js|jsx|ts|tsx|mjs|cjs|vue|svelte|astro)$/.test(ext)) return `process.env.${name}`
  if (ext === "py") return `os.environ["${name}"]`
  if (ext === "go") return `os.Getenv("${name}")`
  if (ext === "rb") return `ENV["${name}"]`
  if (ext === "php") return `getenv('${name}')`
  if (ext === "java" || ext === "kt") return `System.getenv("${name}")`
  if (ext === "cs") return `Environment.GetEnvironmentVariable("${name}")`
  if (ext === "rs") return `std::env::var("${name}")`
  return `\${${name}}`
}

/** The added line with the secret (and its quotes, in code) swapped for an env lookup. */
export function moveToEnvPatch(finding: SecretFinding, line: string) {
  const ref = envReference(finding.file, finding.envName)
  const quoted = new RegExp(`(["'\`])${finding.value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\1`)
  const code = !ref.startsWith("${")
  return code && quoted.test(line) ? line.replace(quoted, ref) : line.split(finding.value).join(ref)
}
