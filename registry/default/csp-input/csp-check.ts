// Pure Content-Security-Policy parsing and checks (CSP Level 3, the CSP Evaluator and MDN's guidance).

export interface CspDirective {
  name: string
  sources: string[]
}

export interface ParsedCsp {
  directives: CspDirective[]
  /** What the pasted text looked like, when it carried more than the policy value. */
  pasted?: "header" | "report-only-header" | "meta"
  /** The text around the policy value (header name, meta tag), so fixes can keep it. */
  wrapper?: [before: string, after: string]
}

/** Where the policy will be delivered. A <meta> tag ignores some directives and can't be report-only. */
export type CspDelivery = "header" | "meta"
/** Enforced (Content-Security-Policy) or Content-Security-Policy-Report-Only. */
export type CspMode = "enforce" | "report-only"

export type CspFindingKind =
  | "report-only-pasted" | "report-only-no-endpoint" | "report-only-meta" | "report-only-ignored" | "header-name" | "meta-ignored"
  | "unquoted" | "missing-semicolon" | "comma" | "duplicate" | "unknown" | "none-mixed" | "strict-dynamic-alone"
  | "unsafe-inline" | "unsafe-eval" | "wildcard" | "scheme-only" | "data-script" | "bypass-host"
  | "no-default-src" | "no-object-src" | "no-base-uri" | "no-frame-ancestors"

/** A one-tap edit to the policy. */
export type CspFix =
  | { op: "remove-source"; directive: string; source: string }
  | { op: "replace-source"; directive: string; source: string; with: string }
  | { op: "add"; directive: string; sources: string[] }
  | { op: "remove-directive"; directive: string; index?: number }
  | { op: "split"; directive: string; at: string }
  | { op: "rename"; directive: string; to: string }
  | { op: "unwrap" }

export interface CspFinding {
  kind: CspFindingKind
  severity: "error" | "warning" | "hint"
  directive?: string
  source?: string
  fix?: CspFix
}

export const CSP_DIRECTIVES = [
  "default-src", "script-src", "script-src-elem", "script-src-attr", "style-src", "style-src-elem", "style-src-attr",
  "img-src", "font-src", "connect-src", "media-src", "object-src", "frame-src", "child-src", "worker-src",
  "manifest-src", "fenced-frame-src", "webrtc", "base-uri", "form-action", "frame-ancestors", "sandbox", "report-uri",
  "report-to", "upgrade-insecure-requests", "block-all-mixed-content", "require-trusted-types-for", "trusted-types",
]
const KNOWN = new Set(CSP_DIRECTIVES)
const KEYWORDS = new Set(["self", "none", "unsafe-inline", "unsafe-eval", "strict-dynamic", "unsafe-hashes", "wasm-unsafe-eval", "report-sample", "inline-speculation-rules"])
const NONCE_OR_HASH = /^'(nonce-|sha(256|384|512)-)/i
const SCRIPT = ["script-src", "default-src"]

// Commonly allowlisted hosts that serve JSONP or AngularJS, so any script can run from them
// (a short pick from google/csp-evaluator's allowlist_bypasses). The second set only needs 'unsafe-eval'.
const BYPASS_HOSTS = ["www.google.com", "accounts.google.com", "ajax.googleapis.com", "maps.googleapis.com", "translate.googleapis.com", "storage.googleapis.com", "gstatic.com", "www.gstatic.com", "cdnjs.cloudflare.com", "cdn.jsdelivr.net", "www.youtube.com", "www.facebook.com", "graph.facebook.com", "cdn.shopify.com", "www.googleadservices.com"]
const BYPASS_WITH_EVAL = ["www.googletagmanager.com", "googletagmanager.com", "www.google-analytics.com", "google-analytics.com", "ssl.google-analytics.com"]

/** True when a host source ("https://ajax.googleapis.com/ajax/", "*.googleapis.com") covers a known bypass host. */
export function isBypassHost(source: string, unsafeEval = false): boolean {
  const host = source.toLowerCase().replace(/^[a-z][a-z\d+.-]*:\/\//, "").replace(/[/:].*$/, "")
  if (!host || host.startsWith("'")) return false
  const list = unsafeEval ? [...BYPASS_HOSTS, ...BYPASS_WITH_EVAL] : BYPASS_HOSTS
  return list.some((known) => (host.startsWith("*.") ? known.endsWith(host.slice(1)) : known === host))
}

/** Parses a policy value, a full header line or a <meta http-equiv> tag. Never throws. */
export function parseCsp(text: string): ParsedCsp {
  let body = text.trim()
  let pasted: ParsedCsp["pasted"]
  let before = ""
  let after = ""
  const meta = body.match(/^(<meta\b[^>]*\bcontent\s*=\s*(["']))([\s\S]*?)(\2[\s\S]*)$/i)
  if (meta) {
    before = meta[1]
    body = meta[3]
    after = meta[4]
    pasted = "meta"
  }
  const header = body.match(/^content-security-policy(-report-only)?\s*:\s*/i)
  if (header) {
    before += header[0]
    body = body.slice(header[0].length)
    pasted = header[1] ? "report-only-header" : "header"
  }
  const directives = body
    .split(";")
    .map((part) => part.trim().split(/\s+/).filter(Boolean))
    .filter((tokens) => tokens.length)
    .map(([name, ...sources]) => ({ name: name.toLowerCase(), sources }))
  return { directives, pasted, wrapper: pasted ? [before, after] : undefined }
}

/** Joins directives back into a policy, one per line when `multiline`. */
export function serializeCsp(directives: CspDirective[], multiline = false): string {
  return directives.map((d) => [d.name, ...d.sources].join(" ")).join(multiline ? ";\n" : "; ")
}

/** Applies a fix and returns the new directive list. */
export function applyCspFix(directives: CspDirective[], fix: CspFix): CspDirective[] {
  const map = (fn: (d: CspDirective) => CspDirective[]) => directives.flatMap((d) => (fix.op !== "unwrap" && d.name === fix.directive ? fn(d) : [d]))
  switch (fix.op) {
    case "unwrap":
      return directives
    case "remove-source":
      return map((d) => [{ ...d, sources: d.sources.filter((s) => s !== fix.source) }])
    case "replace-source":
      return map((d) => [{ ...d, sources: [...new Set(d.sources.map((s) => (s === fix.source ? fix.with : s)))] }])
    case "add":
      return fix.directive === "default-src" ? [{ name: fix.directive, sources: fix.sources }, ...directives] : [...directives, { name: fix.directive, sources: fix.sources }]
    case "remove-directive": {
      let seen = -1
      return directives.filter((d) => d.name !== fix.directive || (fix.index !== undefined && ++seen !== fix.index))
    }
    case "rename":
      return map((d) => [{ ...d, name: fix.to }])
    case "split":
      return map((d) => {
        const at = d.sources.indexOf(fix.at)
        return at < 0 ? [d] : [{ ...d, sources: d.sources.slice(0, at) }, { name: fix.at.toLowerCase(), sources: d.sources.slice(at + 1) }]
      })
  }
}

/** The sources a directive effectively uses, following the fallback to default-src. */
export function effectiveSources(directives: CspDirective[], name: string): string[] | undefined {
  const own = directives.find((d) => d.name === name)
  return own ? own.sources : directives.find((d) => d.name === "default-src")?.sources
}

/** Checks a parsed policy. Findings are ordered errors first. */
export function checkCsp({ directives, pasted }: ParsedCsp, { mode = "enforce", delivery = "header" }: { mode?: CspMode; delivery?: CspDelivery } = {}): CspFinding[] {
  const f: CspFinding[] = []
  if (!directives.length) return f
  const has = (name: string) => directives.some((d) => d.name === name)
  const reportOnly = mode === "report-only" || pasted === "report-only-header"

  if (pasted === "report-only-header" && mode === "enforce") f.push({ kind: "report-only-pasted", severity: "error", fix: { op: "unwrap" } })
  else if (pasted === "header" || pasted === "meta") f.push({ kind: "header-name", severity: "hint", fix: { op: "unwrap" } })
  if (reportOnly && delivery === "meta") f.push({ kind: "report-only-meta", severity: "error" })
  else if (reportOnly && !has("report-uri") && !has("report-to")) f.push({ kind: "report-only-no-endpoint", severity: "error" })
  // Both are ignored when monitored (Upgrade Insecure Requests §3.1, CSP3 §6.3.2).
  if (reportOnly && delivery === "header")
    for (const name of ["upgrade-insecure-requests", "sandbox"])
      if (has(name)) f.push({ kind: "report-only-ignored", severity: "warning", directive: name, fix: { op: "remove-directive", directive: name } })
  if (delivery === "meta")
    for (const name of ["frame-ancestors", "report-uri", "sandbox"])
      if (has(name)) f.push({ kind: "meta-ignored", severity: "warning", directive: name, fix: { op: "remove-directive", directive: name } })

  const counts = new Map<string, number>()
  for (const d of directives) {
    const n = counts.get(d.name) ?? 0
    counts.set(d.name, n + 1)
    if (n) f.push({ kind: "duplicate", severity: "warning", directive: d.name, fix: { op: "remove-directive", directive: d.name, index: n } })
    else if (!KNOWN.has(d.name)) {
      const near = closestDirective(d.name)
      f.push({ kind: "unknown", severity: "warning", directive: d.name, fix: near ? { op: "rename", directive: d.name, to: near } : undefined })
    }
    for (const s of d.sources) {
      const bare = s.toLowerCase()
      // A header value is a comma-separated list of policies, so a comma silently starts a new one.
      if (s.includes(",")) {
        const clean = s.replace(/,/g, "")
        f.push({ kind: "comma", severity: "error", directive: d.name, source: s, fix: clean ? { op: "replace-source", directive: d.name, source: s, with: clean } : { op: "remove-source", directive: d.name, source: s } })
      } else if (KNOWN.has(bare)) f.push({ kind: "missing-semicolon", severity: "error", directive: d.name, source: s, fix: { op: "split", directive: d.name, at: s } })
      else if (KEYWORDS.has(bare) || /^(nonce|sha(256|384|512))-/.test(bare))
        f.push({ kind: "unquoted", severity: "error", directive: d.name, source: s, fix: { op: "replace-source", directive: d.name, source: s, with: `'${s}'` } })
    }
    if (d.sources.length > 1 && d.sources.some((s) => s.toLowerCase() === "'none'")) f.push({ kind: "none-mixed", severity: "warning", directive: d.name, source: "'none'", fix: { op: "remove-source", directive: d.name, source: "'none'" } })
  }

  // Script checks follow the fallback: with no script-src, default-src decides what runs.
  const scriptName = SCRIPT.find(has)
  const script = scriptName ? effectiveSources(directives, "script-src") ?? [] : undefined
  if (scriptName && script) {
    const lower = script.map((s) => s.toLowerCase())
    const nonce = script.some((s) => NONCE_OR_HASH.test(s))
    const dynamic = lower.includes("'strict-dynamic'")
    const at = (source: string) => ({ directive: scriptName, source })
    if (dynamic && !nonce) f.push({ kind: "strict-dynamic-alone", severity: "error", ...at("'strict-dynamic'") })
    // Browsers ignore 'unsafe-inline' next to a nonce or hash, so then it is a safe fallback for old browsers.
    if (lower.includes("'unsafe-inline'") && !nonce) f.push({ kind: "unsafe-inline", severity: "error", ...at("'unsafe-inline'"), fix: { op: "remove-source", ...at("'unsafe-inline'") } })
    if (lower.includes("'unsafe-eval'")) f.push({ kind: "unsafe-eval", severity: "warning", ...at("'unsafe-eval'"), fix: { op: "remove-source", ...at("'unsafe-eval'") } })
    if (lower.includes("*")) f.push({ kind: "wildcard", severity: "error", ...at("*"), fix: { op: "replace-source", ...at("*"), with: "'self'" } })
    if (!dynamic) for (const s of ["https:", "http:"]) if (lower.includes(s)) f.push({ kind: "scheme-only", severity: "warning", ...at(s), fix: { op: "remove-source", ...at(s) } })
    if (lower.includes("data:")) f.push({ kind: "data-script", severity: "error", ...at("data:"), fix: { op: "remove-source", ...at("data:") } })
    if (!dynamic) for (const s of script) if (isBypassHost(s, lower.includes("'unsafe-eval'"))) f.push({ kind: "bypass-host", severity: "warning", ...at(s) })
  }
  const object = effectiveSources(directives, "object-src")?.map((s) => s.toLowerCase())
  if (!has("object-src") && !(object?.length === 1 && object[0] === "'none'")) f.push({ kind: "no-object-src", severity: "warning", directive: "object-src", fix: { op: "add", directive: "object-src", sources: ["'none'"] } })
  else if (object?.includes("*")) f.push({ kind: "wildcard", severity: "error", directive: "object-src", source: "*", fix: { op: "replace-source", directive: "object-src", source: "*", with: "'none'" } })
  if (!has("default-src")) f.push({ kind: "no-default-src", severity: "warning", directive: "default-src", fix: { op: "add", directive: "default-src", sources: ["'self'"] } })
  if (!has("base-uri")) f.push({ kind: "no-base-uri", severity: script?.some((s) => NONCE_OR_HASH.test(s)) ? "warning" : "hint", directive: "base-uri", fix: { op: "add", directive: "base-uri", sources: ["'self'"] } })
  if (delivery === "header" && !has("frame-ancestors")) f.push({ kind: "no-frame-ancestors", severity: "hint", directive: "frame-ancestors", fix: { op: "add", directive: "frame-ancestors", sources: ["'self'"] } })

  const order = { error: 0, warning: 1, hint: 2 }
  return f.sort((a, b) => order[a.severity] - order[b.severity])
}

/** The known directive within two edits of a typo ("scirpt-src" → "script-src"), if any. */
export function closestDirective(name: string): string | undefined {
  let best: { name: string; cost: number } | undefined
  for (const known of CSP_DIRECTIVES) {
    const row = Array.from({ length: known.length + 1 }, (_, i) => i)
    for (let i = 1; i <= name.length; i++) {
      let prev = row[0]
      row[0] = i
      for (let j = 1; j <= known.length; j++) {
        const next = Math.min(row[j] + 1, row[j - 1] + 1, prev + (name[i - 1] === known[j - 1] ? 0 : 1))
        prev = row[j]
        row[j] = next
      }
    }
    const cost = row[known.length]
    if (cost <= 2 && (!best || cost < best.cost)) best = { name: known, cost }
  }
  return best?.name
}
