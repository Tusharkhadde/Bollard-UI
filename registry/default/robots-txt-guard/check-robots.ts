// Bollard UI — robots-txt-guard · MIT licence · https://bollard-ui.vercel.app/components/robots-txt-guard

export type RobotsIssueKind =
  | "block-all" | "staging-rule" | "blocks-assets" | "sitemap-relative" | "sitemap-host" | "sitemap-http" | "sitemap-invalid"
  | "typo" | "no-colon" | "unknown-field" | "noindex" | "crawl-delay" | "no-group" | "path-no-slash" | "full-url-path"

export interface RobotsIssue {
  /** 0-based source line. */
  line: number
  kind: RobotsIssueKind
  severity: "error" | "warning" | "info"
  /** Replacement text for the line ("\n" allowed), or null to delete it. Undefined: no safe fix. */
  fix?: string | null
  /** Filled into the message: the corrected field, the blocked asset, the sitemap host. */
  detail?: string
}

export interface RobotsRule {
  line: number
  type: "allow" | "disallow"
  path: string
}

export interface RobotsGroup {
  /** Lowercased product tokens from the User-agent lines. */
  agents: string[]
  rules: RobotsRule[]
}

export interface RobotsContext {
  /** The file is for production: Disallow: / and staging leftovers become errors. */
  production?: boolean
  /** The live origin, e.g. https://acme.com. Used for sitemap checks and fixes. */
  siteUrl?: string
  /** Extra asset paths that must stay crawlable so Google can render pages. */
  assetPaths?: string[]
}

const FIELDS = ["user-agent", "allow", "disallow", "sitemap", "crawl-delay", "noindex", "host", "clean-param"]
const SPELLED: Record<string, string> = { "user-agent": "User-agent", allow: "Allow", disallow: "Disallow", sitemap: "Sitemap" }
const STAGING_PATH = /\b(staging|stage|preprod|pre-prod|uat)\b/i
const STAGING_HOST = /\b(staging|stage|preprod|pre-prod|uat|qa|dev|development|preview|test)\b/i
const ASSETS = [
  "/_next/static/chunks/main.js", "/_next/static/css/app.css", "/assets/index.js", "/assets/index.css",
  "/static/js/main.js", "/static/css/main.css", "/wp-content/themes/site/style.css", "/wp-includes/js/jquery.js",
  "/js/app.js", "/css/site.css",
]

/** Crawlers Google documents as also obeying another token when they have no group of their own. */
const FALLBACK: Record<string, string> = { "google-inspectiontool": "googlebot", "google-cloudvertexbot": "googlebot" }
/** Google ignores a leading byte order mark and accepts CR, LF or CRLF. */
const toLines = (text: string) => text.replace(/^\uFEFF/, "").split(/\r\n|\r|\n/)
/** Google compares rules and URLs in their percent-encoded form, so /über and /%C3%BCber are the same path. */
const encodePath = (path: string) => path.replace(/[^\x21-\x7e]+/gu, (run) => encodeURIComponent(run)).replace(/%[0-9a-f]{2}/gi, (hex) => hex.toUpperCase())

function distance(a: string, b: string) {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0]
    row[0] = i
    for (let j = 1; j <= b.length; j++) {
      const temp = row[j]
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1))
      prev = temp
    }
  }
  return row[b.length]
}

/** Splits a line into field and value, dropping the # comment. Returns null for blank and comment-only lines. */
export function splitRobotsLine(raw: string) {
  const body = raw.replace(/#.*$/, "").trim()
  if (!body) return null
  const colon = body.indexOf(":")
  if (colon < 0) return { field: "", rawField: "", value: body, colon: false }
  const rawField = body.slice(0, colon).trim()
  return { field: rawField.toLowerCase(), rawField, value: body.slice(colon + 1).trim(), colon: true }
}

/** Groups the file the way Google does: consecutive User-agent lines share the rules that follow them. */
export function parseRobots(text: string) {
  const groups: RobotsGroup[] = []
  const sitemaps: { line: number; url: string }[] = []
  let current: RobotsGroup | null = null
  let collecting = false
  toLines(text).forEach((raw, line) => {
    const part = splitRobotsLine(raw)
    if (!part) return
    if (part.field === "user-agent") {
      const agent = part.value.split("/")[0].trim().toLowerCase()
      if (!current || !collecting) groups.push((current = { agents: [], rules: [] }))
      current.agents.push(agent)
      collecting = true
    } else if (part.field === "allow" || part.field === "disallow") {
      collecting = false
      current?.rules.push({ line, type: part.field, path: part.value })
    } else if (part.field === "sitemap") sitemaps.push({ line, url: part.value })
  })
  return { groups, sitemaps }
}

/** Does a robots.txt path pattern (with * and a trailing $) match this path? */
export function robotsPatternMatches(pattern: string, path: string) {
  if (!pattern) return false
  const anchored = pattern.endsWith("$")
  const body = encodePath(anchored ? pattern.slice(0, -1) : pattern).replace(/[.+?^{}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*")
  try {
    return new RegExp(`^${body}${anchored ? "$" : ""}`).test(encodePath(path))
  } catch {
    return false
  }
}

/** Longest matching rule wins; on a tie Allow wins. No match means allowed. */
export function decide(rules: RobotsRule[], path: string) {
  let best: RobotsRule | undefined
  for (const rule of rules) {
    if (!rule.path || !robotsPatternMatches(rule.path, path)) continue
    if (!best || rule.path.length > best.path.length || (rule.path.length === best.path.length && rule.type === "allow")) best = rule
  }
  return { allowed: !best || best.type === "allow", rule: best }
}

/** The merged rules that apply to a crawler: its own group, else the closest family name (googlebot for googlebot-image), else *. */
export function rulesFor(groups: RobotsGroup[], agent: string) {
  const name = agent.toLowerCase()
  const tokens = [...new Set(groups.flatMap((group) => group.agents))].filter((token) => token !== "*")
  const match = tokens.filter((token) => name === token || name.startsWith(`${token}-`) || FALLBACK[name] === token).sort((a, b) => b.length - a.length)[0] ?? "*"
  return { agent: match, rules: groups.filter((group) => group.agents.includes(match)).flatMap((group) => group.rules) }
}

export type RobotsTestCode = "allowed" | "allowed-by" | "blocked-by" | "robots-itself" | "other-host" | "invalid"

/** Would `agent` be allowed to crawl `url` (a path or a full URL)? */
export function testRobots(text: string, url: string, agent = "Googlebot", siteUrl?: string) {
  let path = url.trim()
  let host = ""
  if (/^[a-z][\w+.-]*:\/\//i.test(path)) {
    try {
      const parsed = new URL(path)
      host = parsed.host
      path = parsed.pathname + parsed.search
    } catch {
      return { code: "invalid" as RobotsTestCode }
    }
  } else if (!path.startsWith("/")) path = `/${path}`
  if (host && siteUrl) {
    try {
      if (new URL(siteUrl).host !== host) return { code: "other-host" as RobotsTestCode, host }
    } catch {
      // A malformed siteUrl just skips the host check.
    }
  }
  if (path === "/robots.txt") return { code: "robots-itself" as RobotsTestCode }
  const { groups } = parseRobots(text)
  const scope = rulesFor(groups, agent)
  const { allowed, rule } = decide(scope.rules, path)
  return { code: (rule ? (allowed ? "allowed-by" : "blocked-by") : "allowed") as RobotsTestCode, rule, agent: scope.agent, path }
}

/** Finds the robots.txt mistakes that silently de-index a site or don't do what they say. */
export function checkRobots(text: string, { production = false, siteUrl, assetPaths = [] }: RobotsContext = {}): RobotsIssue[] {
  const issues: RobotsIssue[] = []
  const lines = toLines(text)
  const { groups } = parseRobots(text)
  let site: URL | null = null
  try {
    site = siteUrl ? new URL(siteUrl) : null
  } catch {
    site = null
  }
  let seenAgent = false
  lines.forEach((raw, line) => {
    const part = splitRobotsLine(raw)
    if (!part) {
      if (production && /#.*\b(staging|preprod|uat)\b/i.test(raw)) issues.push({ line, kind: "staging-rule", severity: "warning", fix: null })
      return
    }
    if (!part.colon) {
      const word = part.value.match(/^([a-z-]+)\s+(\S.*)$/i)
      const field = word && FIELDS.find((name) => distance(name, word[1].toLowerCase()) <= 1)
      issues.push({ line, kind: "no-colon", severity: "warning", fix: field && word ? `${SPELLED[field] ?? word[1]}: ${word[2]}` : undefined })
      return
    }
    let field = part.field
    if (!FIELDS.includes(field)) {
      const squashed = field.replace(/[\s_-]/g, "")
      const near = FIELDS.find((name) => name.replace("-", "") === squashed) ?? FIELDS.find((name) => distance(name, field) <= 2 && field.length > 3)
      if (near) {
        issues.push({ line, kind: "typo", severity: "warning", detail: SPELLED[near] ?? near, fix: raw.replace(part.rawField, SPELLED[near] ?? near) })
        field = near
      } else {
        issues.push({ line, kind: "unknown-field", severity: "info", detail: part.rawField })
        return
      }
    }
    if (field === "user-agent") seenAgent = true
    if (field === "noindex") issues.push({ line, kind: "noindex", severity: "warning", fix: null })
    if (field === "crawl-delay") issues.push({ line, kind: "crawl-delay", severity: "info" })
    if (field === "allow" || field === "disallow") {
      if (!seenAgent) issues.push({ line, kind: "no-group", severity: "warning", fix: `User-agent: *\n${raw}` })
      const value = part.value
      if (/^https?:\/\//i.test(value)) {
        let path = "/"
        try {
          path = new URL(value).pathname
        } catch {
          // Keep "/" for an unparsable URL.
        }
        issues.push({ line, kind: "full-url-path", severity: "warning", fix: raw.replace(value, path) })
      } else if (value && !/^[/*]/.test(value)) issues.push({ line, kind: "path-no-slash", severity: "warning", fix: raw.replace(value, `/${value}`) })
      else if (production && field === "disallow" && STAGING_PATH.test(value.replace(/[/*$]/g, " "))) issues.push({ line, kind: "staging-rule", severity: "warning", fix: null })
    }
    if (field === "sitemap") {
      const value = part.value
      if (!/^https?:\/\//i.test(value)) {
        issues.push({ line, kind: "sitemap-relative", severity: "error", fix: site ? raw.replace(value, new URL(value.replace(/^\/?/, "/"), site).href) : undefined })
        return
      }
      let url: URL
      try {
        url = new URL(value)
      } catch {
        issues.push({ line, kind: "sitemap-invalid", severity: "error" })
        return
      }
      if (site && url.hostname !== site.hostname) {
        const leftover = STAGING_HOST.test(url.hostname.replace(/[.-]/g, " ")) || /^(localhost|127\.)/.test(url.hostname)
        const fixed = new URL(url.pathname + url.search, site).href
        // Google allows sitemaps on another host (a CDN, say), so only a staging or localhost leftover is an error.
        issues.push({ line, kind: "sitemap-host", severity: leftover ? "error" : "info", detail: url.host, fix: raw.replace(value, fixed) })
      } else if (site?.protocol === "https:" && url.protocol === "http:") issues.push({ line, kind: "sitemap-http", severity: "warning", fix: raw.replace(value, value.replace(/^http:/i, "https:")) })
    }
  })
  // Rules for every crawler (or Googlebot itself): block-all, then any asset Google needs to render.
  const scopes = ["googlebot", "bingbot"].map((agent) => rulesFor(groups, agent).rules)
  const flagged = new Set<number>()
  for (const rules of scopes) {
    for (const rule of rules) {
      if (rule.type === "disallow" && (rule.path === "/" || rule.path === "/*") && production && !flagged.has(rule.line)) {
        flagged.add(rule.line)
        issues.push({ line: rule.line, kind: "block-all", severity: "error", fix: lines[rule.line].replace(/:\s*\/\*?/, ":") })
      }
    }
    for (const asset of [...ASSETS, ...assetPaths]) {
      const { allowed, rule } = decide(rules, asset)
      if (allowed || !rule || flagged.has(rule.line) || rule.path === "/" || rule.path === "/*") continue
      flagged.add(rule.line)
      const assetOnly = /css|js|assets|static|_next|wp-content|wp-includes|build|dist/i.test(rule.path)
      issues.push({ line: rule.line, kind: "blocks-assets", severity: "warning", detail: asset, fix: assetOnly ? null : undefined })
    }
  }
  return issues
    .filter((issue, index, all) => !(issue.kind === "staging-rule" && all.some((other) => other.line === issue.line && other.kind === "blocks-assets")))
    .sort((a, b) => a.line - b.line)
}

/** Applies one fix: replaces the line, or deletes it when `fix` is null. */
export function applyRobotsFix(text: string, line: number, fix: string | null) {
  const lines = text.split(/\r\n|\r|\n/)
  if (line < 0 || line >= lines.length) return text
  if (fix === null) lines.splice(line, 1)
  else lines[line] = fix
  return lines.join("\n")
}
