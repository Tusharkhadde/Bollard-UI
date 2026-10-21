// Builds registry.json and components/demo-index.tsx from registry/default/*/meta.json.
// Run with `npm run generate` after adding or renaming a component.
import fs from "node:fs"
import path from "node:path"

import { extractProps } from "./props.mjs"

const HOMEPAGE = "https://bollard-ui.vercel.app"

const CATEGORIES = [
// Each component sits in exactly one category; the generator warns when one is missing or listed twice.
  ["Starter packs", ["fintech-pack", "agent-pack", "danger-zone-pack", "india-pack", "checkout-pack", "signup-login-pack", "account-settings-pack", "forms-pack", "messaging-pack", "devtools-pack", "scheduling-pack"]],
  ["Agent / Human-in-the-loop", ["agent-action-approve", "ai-paste-guard", "undo-toast"]],
  ["Destructive actions", ["agent-action-approve", "mcp-tool-review", "reset-hard-readback", "account-deletion-readback", "force-push-confirm", "infra-plan-readback", "recovery-contact-cooldown", "migration-preview", "feature-flag-rollout", "branch-target", "session-list", "sign-in-approve", "hold-to-confirm", "two-step-button", "slide-to-confirm", "type-to-confirm", "undo-toast", "impact-preview", "bulk-scope-confirm", "drop-confirm", "danger-zone", "click-shield", "shortcut-confirm", "guarded-switch", "swipe-delete-row", "grace-send", "two-person-approve", "trash-countdown", "range-select-guard", "reauth-gate", "rollback-preview", "edit-lock", "archive-or-delete", "revoke-access-preview", "transfer-ownership", "cancel-readback", "merge-records", "move-readback", "reset-preview", "replace-file", "dns-record-guard", "key-rotate", "retention-change", "seat-reduce"]],
  ["Submits and rate limits", ["cooldown-button", "safe-submit", "bulk-runner", "spend-cap-button", "scheduled-queue"]],
  ["Validators", ["commit-combobox", "relative-date-input", "namesake-select", "cheque-check", "kyc-name-match", "aadhaar-input", "password-policy-input", "passenger-name-input", "email-change-guard", "invoice-number-check", "pin-drop-check", "pincode-input", "password-hint-guard", "coupon-input", "paste-target-guard", "email-input", "password-input", "match-field", "amount-input", "date-sanity-input", "clean-paste-input", "otp-paste-input", "url-input", "phone-input", "char-budget", "code-input", "inline-edit", "checksum-input", "name-input", "near-duplicate-input", "slug-input", "homoglyph-guard", "contrast-picker", "address-check", "tax-id-input", "filename-input", "coordinate-input", "zero-result-rescue", "mixed-value-field", "card-expiry-input", "username-input", "ifsc-input", "upi-id-input", "shortcut-recorder", "hashtag-input", "timezone-picker", "scope-picker", "brand-color-input", "wrong-layout-input"]],
  ["Readbacks and calculators", ["fx-send-receive", "epoch-input", "notice-period-check", "tax-regime-compare", "emi-readback", "leave-request-check", "ctc-breakdown-input", "guest-count-picker", "salary-input", "size-fit-picker", "unit-input", "time-confirm", "quantity-stepper", "percent-input", "range-pair", "schedule-readback", "split-allocator", "duration-input", "billing-period-input", "replace-preview", "shift-time-input", "dimension-input", "tax-inclusive-input", "version-bump", "dose-input"]],
  ["Parsers and analyzers", ["leftover-text-check", "ai-citation-check", "k8s-resource-input", "connection-string-input", "package-name-check", "cache-control-input", "mrz-paste-input", "curl-pipe-guard", "port-expose-guard", "photo-spec-check", "doc-upload-match", "ai-paste-guard", "ssh-key-input", "jwt-inspect", "cert-paste-check", "chmod-input", "redirect-uri-input", "csp-input", "public-env-guard", "robots-txt-guard", "image-tag-input", "column-mapper", "boolean-query-input", "cors-origin-input", "webhook-url-input", "list-paste", "env-paste", "json-field", "regex-field", "cidr-input", "version-range-input", "glob-input", "i18n-string-field", "sql-guard", "markdown-check", "yaml-field", "webhook-test", "utm-check"]],
  ["Forms and saving", ["reorder-readback", "nominee-check", "passport-validity-check", "seat-gap-check", "formula-overwrite-guard", "passkey-name-prompt", "irreversible-diff-badge", "stale-attachment-check", "dependency-license-check", "heading-outline", "link-text-check", "reading-level", "backup-codes", "recovery-check", "unsaved-changes-bar", "save-status", "error-summary", "form-progress", "preflight-checklist", "attachment-nudge", "file-guard", "draft-restore", "tab-collision", "review-step", "dependent-reset", "version-scrubber", "autofill-check", "field-history", "terms-changes", "hidden-field-guard", "upload-wait", "consent-group", "dob-input", "recurrence-scope", "tree-select-readback", "repeat-rows", "step-invalidation", "import-preview", "crop-guard", "stay-length", "event-overlap", "unanswered-check", "cutoff-picker"]],
  ["Context and awareness", ["trip-date-chain", "meeting-time-spread", "bnpl-schedule-check", "transit-visa-check", "llm-cost-estimate", "kube-context-guard", "security-event-log", "dst-shift-notice", "environment-badge", "acting-as-banner", "offline-banner", "stale-data-notice", "conflict-banner", "session-timeout", "do-not-close", "timezone-mismatch", "update-available", "revision-banner", "filter-notice", "disabled-reason", "quota-forecast", "resume-marker", "new-content-pill", "presence-lock", "unsent-marker", "presenter-mode", "locale-notice", "progress-heartbeat", "account-switch-guard", "maintenance-window", "permission-pre-ask", "clock-skew", "private-mode-notice", "experimental-badge", "retry-after", "low-battery-guard", "data-cost-notice", "sunset-notice", "print-guard"]],
  ["Sharing, sending and paying", ["bcc-guard", "hidden-content-check", "prompt-data-guard", "bill-split-check", "callback-number-check", "quote-lock", "calendar-external-guest-guard", "chat-audience-check", "out-of-office-check", "retract-window", "card-bill-pay", "otp-share-guard", "bank-transfer-timing", "gift-card-scam-guard", "commit-secret-guard", "publish-preview", "upi-autopay-review", "upi-collect-guard", "tds-invoice-total", "link-access-check", "reply-all-guard", "duplicate-payment-guard", "bulk-send-guard", "pii-post-guard", "recurring-charge-readback", "gst-invoice-check", "role-preview", "visibility-picker", "recipient-check", "secret-paste-guard", "external-link", "charge-summary", "send-time-check", "fill-before-copy", "photo-location-guard", "currency-hint", "mention-guard", "share-link", "merge-field-check", "forward-guard", "payee-check", "csv-export-guard", "link-unfurl-check", "qr-share", "redact-image", "sms-segments", "export-scope", "invite-check", "large-attachment", "embed-code", "alt-text-check", "stale-reply", "tip-picker", "refund-picker", "plan-change-readback", "payment-reference", "truncation-preview"]],
  ["Reading without mistakes", ["dockerfile-check", "gitignore-check", "workflow-yaml-guard", "iam-policy-check", "hreflang-check", "redirect-rule-input", "set-cookie-check", "qr-scan-check", "env-diff", "join-preview", "dedupe-key-picker", "dual-axis-guard", "secret-field", "text-diff", "readback", "copy-confirm", "middle-truncate", "precise-number", "unambiguous-date", "deadline", "change-highlight", "spell-out", "honest-bar", "change-readout", "size-context", "sum-check", "status-chip", "sort-indicator", "diff-table", "amount-in-words", "overflow-list", "honest-rating", "unit-price", "abbr-hint", "error-explainer", "partial-period", "gap-aware-line", "fair-rank", "eta-range", "palette-guard"]],
]

// Agent controls are deliberately discoverable as their own category instead of
// being buried among the broader destructive-action and parser families.
const AGENT_ITEMS = new Set(["agent-action-approve", "ai-paste-guard", "undo-toast"])
for (const [category, items] of CATEGORIES) {
  if (category !== "Agent / Human-in-the-loop") {
    for (let index = items.length - 1; index >= 0; index--) if (AGENT_ITEMS.has(items[index])) items.splice(index, 1)
  }
}

const root = path.resolve(import.meta.dirname, "..")
const dir = path.join(root, "registry/default")
const names = fs.readdirSync(dir).filter((name) => fs.existsSync(path.join(dir, name, "meta.json"))).sort()

const categoryWarnings = []
{
  const listed = CATEGORIES.flatMap(([, list]) => list)
  const twice = [...new Set(listed.filter((n, i) => listed.indexOf(n) !== i))]
  if (twice.length) categoryWarnings.push(`in more than one category: ${twice.join(", ")}`)
  const none = names.filter((n) => !listed.includes(n))
  if (none.length) categoryWarnings.push(`in no category (shown under "More"): ${none.join(", ")}`)
}

const categoryOf = (name) => CATEGORIES.find(([, list]) => list.includes(name))?.[0] ?? "More"
const order = (name) => {
  const ci = CATEGORIES.findIndex(([, list]) => list.includes(name))
  return ci === -1 ? [99, 0] : [ci, CATEGORIES[ci][1].indexOf(name)]
}
names.sort((a, b) => {
  const [ca, ia] = order(a)
  const [cb, ib] = order(b)
  return ca - cb || ia - ib || a.localeCompare(b)
})

const FLOWS = ["checkout", "signup-login", "account-settings", "danger-zone", "forms", "messaging", "devtools", "scheduling", "india"]
const FIELDS = ["email", "phone", "amount", "datetime", "secret", "file", "id-number", "url", "code", "text", "address", "name", "number"]
const warnings = []
const strings = (value, name, key) => {
  if (value === undefined) return undefined
  if (!Array.isArray(value)) {
    warnings.push(`${name}: "${key}" is not an array`)
    return undefined
  }
  const list = [...new Set(value.filter((v) => typeof v === "string").map((v) => v.trim()).filter(Boolean))]
  return list
}
function discoveryOf(name, meta) {
  const out = {}
  if (typeof meta.stops === "string" && meta.stops.trim()) out.stops = meta.stops.trim().replace(/\.$/, "")
  const mistakes = strings(meta.mistakes, name, "mistakes")
  if (mistakes?.length) out.mistakes = mistakes
  const aliases = strings(meta.aliases, name, "aliases")
  if (aliases?.length) out.aliases = aliases
  const flows = strings(meta.flows, name, "flows")
  if (flows) {
    const bad = flows.filter((f) => !FLOWS.includes(f))
    if (bad.length) warnings.push(`${name}: unknown flows ${bad.join(", ")}`)
    const good = flows.filter((f) => FLOWS.includes(f))
    if (good.length) out.flows = good
  }
  const fields = strings(meta.fields, name, "fields")
  if (fields) {
    const bad = fields.filter((f) => !FIELDS.includes(f))
    if (bad.length) warnings.push(`${name}: unknown fields ${bad.join(", ")}`)
    // An explicit empty list means "no field type", which differs from "not tagged yet".
    out.fields = fields.filter((f) => FIELDS.includes(f))
  }
  return out
}

/** Page-standard fields (summary, catches, limits, a11y, server, rules). All optional; bad values are dropped with a warning. */
function docsOf(name, meta) {
  const out = {}
  const text = (key) => {
    const v = meta[key]
    if (v === undefined || v === null) return
    if (typeof v !== "string") return void warnings.push(`${name}: "${key}" is not a string`)
    if (v.trim()) out[key] = v.trim()
  }
  text("summary")
  text("server")
  for (const key of ["catches", "limits", "a11y"]) {
    const list = strings(meta[key], name, key)
    if (list?.length) out[key] = list
  }
  const r = meta.rules
  if (r !== undefined && r !== null) {
    if (typeof r !== "object" || Array.isArray(r)) warnings.push(`${name}: "rules" is not an object`)
    else {
      const rules = { verified: typeof r.verified === "string" && /^\d{4}-\d{2}-\d{2}$/.test(r.verified) ? r.verified : null }
      const sources = Array.isArray(r.sources)
        ? r.sources.filter((s) => s && typeof s.url === "string" && /^https?:\/\//.test(s.url)).map((s) => ({ label: typeof s.label === "string" && s.label.trim() ? s.label.trim() : s.url, url: s.url }))
        : []
      if (sources.length) rules.sources = sources
      if (typeof r.note === "string" && r.note.trim()) rules.note = r.note.trim()
      if (rules.verified && !sources.length) warnings.push(`${name}: rules.verified is set but there are no sources`)
      out.rules = rules
    }
  }
  return out
}

function usageOf(name, files, meta) {
  if (name.endsWith("-pack")) return `npx shadcn@4.21.0 add @bollard/${name}`
  const entry = files.find((file) => file.endsWith(`${name}.tsx`)) ?? files.find((file) => meta.registryType === "registry:hook" && file.includes("use-bollard-field.ts"))
  if (!entry) return `See the examples at ${HOMEPAGE}/components/${name}`
  const source = fs.readFileSync(path.join(dir, name, entry), "utf8")
  const exported = [...source.matchAll(/export\s+(?:declare\s+)?(?:function|const|class)\s+([A-Za-z_$][\w$]*)/g)]
    .map((match) => match[1])
    .find((identifier) => meta.registryType === "registry:hook" ? /^use[A-Z]/.test(identifier) : /^[A-Z]/.test(identifier))
  if (!exported) return `See the examples at ${HOMEPAGE}/components/${name}`
  const importPath = meta.registryType === "registry:hook" ? `@/components/${name}/${path.basename(entry)}` : `@/components/ui/${name}`
  return `import { ${exported} } from "${importPath}"`
}

const props = {}
const items = names.map((name) => {
  const meta = JSON.parse(fs.readFileSync(path.join(dir, name, "meta.json"), "utf8"))
  const type = meta.registryType ?? "registry:ui"
  const files = fs
    .readdirSync(path.join(dir, name))
    .filter((file) => /\.(tsx|ts)$/.test(file))
    .map((file) => ({
      path: `registry/default/${name}/${file}`,
      type,
      // Keep the public component entry in the configured ui directory. Helpers
      // live in a component-scoped folder so generic names cannot collide.
      ...((file === `${name}.tsx`)
        ? { target: `@ui/${name}.tsx` }
        : { target: `@components/${name}/${file}` }),
    }))
  const item = {
    name,
    type,
    title: meta.title,
    description: meta.description,
    categories: [categoryOf(name)],
    files,
    docs: `${HOMEPAGE}/components/${name}`,
  }
  if (meta.dependencies?.length) item.dependencies = meta.dependencies
  if (meta.registryDependencies?.length) item.registryDependencies = meta.registryDependencies
  // Discovery fields (shadcn's free-form `meta`). Every one is optional; bad values are dropped, never fatal.
  const discovery = {
    ...discoveryOf(name, meta),
    ...docsOf(name, meta),
    usage: usageOf(name, fs.readdirSync(path.join(dir, name)).filter((file) => /\.(tsx|ts)$/.test(file)), meta),
    runtimeDependencies: meta.dependencies?.length ? [...meta.dependencies] : [],
    zeroRuntimeDependencies: !meta.dependencies?.length,
  }
  if (Object.keys(discovery).length) item.meta = discovery
  // Props come from the source itself (scripts/props.mjs). Never fatal.
  try {
    const extracted = extractProps(path.join(dir, name, `${name}.tsx`), name)
    if (extracted) props[name] = extracted
  } catch (error) {
    warnings.push(`${name}: props extraction failed (${error.message})`)
  }
  return item
})

fs.writeFileSync(
  path.join(root, "registry.json"),
  JSON.stringify(
    {
      $schema: "https://ui.shadcn.com/schema/registry.json",
      name: "bollard-ui",
      homepage: HOMEPAGE,
      items,
    }
    // minified: the GitHub contents API push caps one file's argument at ~128 KB
  ) + "\n"
)

// Props tables, read server-side by the component pages (never imported by client code).
fs.writeFileSync(path.join(root, "lib/props.json"), JSON.stringify(props) + "\n")

const withDemo = items.filter((item) => fs.existsSync(path.join(root, "components/demos", `${item.name}.tsx`)))
const ident = (name) => name.replace(/-(\w)/g, (_, c) => c.toUpperCase()).replace(/^\w/, (c) => c.toUpperCase()) + "Demo"
const index = `// Generated by scripts/generate.mjs. Do not edit by hand.
import type { ComponentType } from "react"

${withDemo.map((item) => `import { Demo as ${ident(item.name)} } from "@/components/demos/${item.name}"`).join("\n")}

export interface DemoEntry {
  name: string
  title: string
  description: string
  category: string
  Demo: ComponentType
}

export const demos: DemoEntry[] = [
${withDemo
  .map((item) => `  { name: ${JSON.stringify(item.name)}, title: ${JSON.stringify(item.title)}, description: ${JSON.stringify(item.description)}, category: ${JSON.stringify(item.categories[0])}, Demo: ${ident(item.name)} },`)
  .join("\n")}
]
`
fs.writeFileSync(path.join(root, "components/demo-index.tsx"), index)
console.log(`registry.json: ${items.length} items, demos: ${withDemo.length}`)
const tagged = (key) => items.filter((item) => item.meta?.[key] !== undefined).length
console.log(`discovery fields: stops ${tagged("stops")}, mistakes ${tagged("mistakes")}, aliases ${tagged("aliases")}, flows ${tagged("flows")}, fields ${tagged("fields")} of ${items.length}`)
console.log(
  `page fields: summary ${tagged("summary")}, catches ${tagged("catches")}, limits ${tagged("limits")}, a11y ${tagged("a11y")}, server ${tagged("server")}, rules ${tagged("rules")}; props ${Object.keys(props).length}`,
)
if (categoryWarnings.length) console.log("category warnings:\n  " + categoryWarnings.join("\n  "))
if (warnings.length) console.log("meta warnings:\n  " + warnings.join("\n  "))
const missing = items.filter((item) => !withDemo.includes(item)).map((item) => item.name)
if (missing.length) console.log("missing demos:", missing.join(", "))
