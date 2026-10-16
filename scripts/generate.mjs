// Builds registry.json and components/demo-index.tsx from registry/default/*/meta.json.
// Run with `npm run generate` after adding or renaming a component.
import fs from "node:fs"
import path from "node:path"

const CATEGORIES = [
  ["Destructive actions", ["agent-action-approve", "mcp-tool-review", "reset-hard-readback", "account-deletion-readback", "force-push-confirm", "infra-plan-readback", "recovery-contact-cooldown", "migration-preview", "feature-flag-rollout", "branch-target", "session-list", "sign-in-approve", "hold-to-confirm", "two-step-button", "slide-to-confirm", "type-to-confirm", "undo-toast", "impact-preview", "bulk-scope-confirm", "cooldown-button", "safe-submit", "drop-confirm", "danger-zone", "click-shield", "shortcut-confirm", "guarded-switch", "swipe-delete-row", "grace-send", "bulk-runner", "two-person-approve", "trash-countdown", "range-select-guard", "reauth-gate", "rollback-preview", "edit-lock", "spend-cap-button", "scheduled-queue", "archive-or-delete", "revoke-access-preview", "transfer-ownership", "cancel-readback", "merge-records", "move-readback", "reset-preview", "replace-file", "dns-record-guard", "key-rotate", "retention-change", "seat-reduce"]],
  ["Inputs that catch typos", ["fx-send-receive", "leftover-text-check", "ai-citation-check", "commit-combobox", "relative-date-input", "namesake-select", "k8s-resource-input", "connection-string-input", "epoch-input", "package-name-check", "cheque-check", "kyc-name-match", "aadhaar-input", "cache-control-input", "password-policy-input", "mrz-paste-input", "notice-period-check", "tax-regime-compare", "curl-pipe-guard", "port-expose-guard", "passenger-name-input", "emi-readback", "leave-request-check", "photo-spec-check", "doc-upload-match", "ai-paste-guard", "ssh-key-input", "jwt-inspect", "cert-paste-check", "chmod-input", "email-change-guard", "redirect-uri-input", "csp-input", "public-env-guard", "robots-txt-guard", "image-tag-input", "invoice-number-check", "ctc-breakdown-input", "column-mapper", "guest-count-picker", "pin-drop-check", "boolean-query-input", "salary-input", "pincode-input", "password-hint-guard", "cors-origin-input", "webhook-url-input", "coupon-input", "size-fit-picker", "paste-target-guard", "email-input", "password-input", "match-field", "amount-input", "date-sanity-input", "clean-paste-input", "otp-paste-input", "url-input", "phone-input", "char-budget", "code-input", "unit-input", "time-confirm", "quantity-stepper", "inline-edit", "checksum-input", "name-input", "percent-input", "range-pair", "schedule-readback", "near-duplicate-input", "list-paste", "slug-input", "env-paste", "split-allocator", "homoglyph-guard", "json-field", "regex-field", "contrast-picker", "address-check", "tax-id-input", "duration-input", "filename-input", "coordinate-input", "cidr-input", "version-range-input", "zero-result-rescue", "mixed-value-field", "card-expiry-input", "username-input", "billing-period-input", "glob-input", "replace-preview", "i18n-string-field", "sql-guard", "ifsc-input", "upi-id-input", "shift-time-input", "dimension-input", "markdown-check", "yaml-field", "shortcut-recorder", "webhook-test", "hashtag-input", "tax-inclusive-input", "timezone-picker", "scope-picker", "brand-color-input", "version-bump", "dose-input", "wrong-layout-input", "utm-check"]],
  ["Forms and saving", ["reorder-readback", "nominee-check", "passport-validity-check", "seat-gap-check", "formula-overwrite-guard", "passkey-name-prompt", "irreversible-diff-badge", "stale-attachment-check", "dependency-license-check", "heading-outline", "link-text-check", "reading-level", "backup-codes", "recovery-check", "unsaved-changes-bar", "save-status", "error-summary", "form-progress", "preflight-checklist", "attachment-nudge", "file-guard", "draft-restore", "tab-collision", "review-step", "dependent-reset", "version-scrubber", "autofill-check", "field-history", "terms-changes", "hidden-field-guard", "upload-wait", "consent-group", "dob-input", "recurrence-scope", "tree-select-readback", "repeat-rows", "step-invalidation", "import-preview", "crop-guard", "stay-length", "event-overlap", "unanswered-check", "cutoff-picker"]],
  ["Context and awareness", ["trip-date-chain", "meeting-time-spread", "bnpl-schedule-check", "transit-visa-check", "llm-cost-estimate", "kube-context-guard", "security-event-log", "dst-shift-notice", "environment-badge", "acting-as-banner", "offline-banner", "stale-data-notice", "conflict-banner", "session-timeout", "do-not-close", "timezone-mismatch", "update-available", "revision-banner", "filter-notice", "disabled-reason", "quota-forecast", "resume-marker", "new-content-pill", "presence-lock", "unsent-marker", "presenter-mode", "locale-notice", "progress-heartbeat", "account-switch-guard", "maintenance-window", "permission-pre-ask", "clock-skew", "private-mode-notice", "experimental-badge", "retry-after", "low-battery-guard", "data-cost-notice", "sunset-notice", "print-guard"]],
  ["Sharing, sending and paying", ["bcc-guard", "hidden-content-check", "prompt-data-guard", "bill-split-check", "callback-number-check", "quote-lock", "calendar-external-guest-guard", "chat-audience-check", "out-of-office-check", "retract-window", "card-bill-pay", "otp-share-guard", "bank-transfer-timing", "gift-card-scam-guard", "commit-secret-guard", "publish-preview", "upi-autopay-review", "upi-collect-guard", "tds-invoice-total", "link-access-check", "reply-all-guard", "duplicate-payment-guard", "bulk-send-guard", "pii-post-guard", "recurring-charge-readback", "gst-invoice-check", "role-preview", "visibility-picker", "recipient-check", "secret-paste-guard", "external-link", "charge-summary", "send-time-check", "fill-before-copy", "photo-location-guard", "currency-hint", "mention-guard", "share-link", "merge-field-check", "forward-guard", "payee-check", "csv-export-guard", "link-unfurl-check", "qr-share", "redact-image", "sms-segments", "export-scope", "invite-check", "large-attachment", "embed-code", "alt-text-check", "stale-reply", "tip-picker", "refund-picker", "plan-change-readback", "payment-reference", "truncation-preview"]],
  ["Reading without mistakes", ["dockerfile-check", "gitignore-check", "workflow-yaml-guard", "iam-policy-check", "hreflang-check", "redirect-rule-input", "set-cookie-check", "qr-scan-check", "env-diff", "join-preview", "dedupe-key-picker", "dual-axis-guard", "secret-field", "text-diff", "readback", "copy-confirm", "middle-truncate", "precise-number", "unambiguous-date", "deadline", "change-highlight", "spell-out", "honest-bar", "change-readout", "size-context", "sum-check", "status-chip", "sort-indicator", "diff-table", "amount-in-words", "overflow-list", "honest-rating", "unit-price", "abbr-hint", "error-explainer", "partial-period", "gap-aware-line", "fair-rank", "eta-range", "palette-guard"]],
]

const root = path.resolve(import.meta.dirname, "..")
const dir = path.join(root, "registry/default")
const names = fs.readdirSync(dir).filter((name) => fs.existsSync(path.join(dir, name, "meta.json"))).sort()

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

const items = names.map((name) => {
  const meta = JSON.parse(fs.readFileSync(path.join(dir, name, "meta.json"), "utf8"))
  const files = fs
    .readdirSync(path.join(dir, name))
    .filter((file) => /\.(tsx|ts)$/.test(file))
    .map((file) => ({ path: `registry/default/${name}/${file}`, type: "registry:ui" }))
  const item = {
    name,
    type: "registry:ui",
    title: meta.title,
    description: meta.description,
    categories: [categoryOf(name)],
    files,
  }
  if (meta.dependencies?.length) item.dependencies = meta.dependencies
  if (meta.registryDependencies?.length) item.registryDependencies = meta.registryDependencies
  // Discovery fields (shadcn's free-form `meta`). Every one is optional; bad values are dropped, never fatal.
  const discovery = discoveryOf(name, meta)
  if (Object.keys(discovery).length) item.meta = discovery
  return item
})

fs.writeFileSync(
  path.join(root, "registry.json"),
  JSON.stringify(
    {
      $schema: "https://ui.shadcn.com/schema/registry.json",
      name: "bollard-ui",
      homepage: "https://github.com/Tusharkhadde/CraftedUI",
      items,
    }
    // minified: the GitHub contents API push caps one file's argument at ~128 KB
  ) + "\n"
)

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
if (warnings.length) console.log("meta warnings:\n  " + warnings.join("\n  "))
const missing = items.filter((item) => !withDemo.includes(item)).map((item) => item.name)
if (missing.length) console.log("missing demos:", missing.join(", "))
