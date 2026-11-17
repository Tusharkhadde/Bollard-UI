import fs from "node:fs"

const reg = JSON.parse(fs.readFileSync("registry.json", "utf8"))
const man = JSON.parse(fs.readFileSync("components.manifest.json", "utf8"))
const items = reg.items.filter((i) => man.components.some((c) => c.name === i.name))

const usedPrimaryQueries = new Set()

function cleanQuery(str) {
  return str.toLowerCase().replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, " ").trim()
}

function deriveQueries(item) {
  const name = item.name
  const title = item.title
  const stops = item.meta?.stops || item.description || ""
  const mistakes = Array.isArray(item.meta?.mistakes) ? item.meta.mistakes : []
  const aliases = Array.isArray(item.meta?.aliases) ? item.meta.aliases : []
  
  let primaryCandidate = ""
  
  // Specific overrides for top components to guarantee exact winnable targets
  const OVERRIDES = {
    "amount-input": "react amount input component",
    "type-to-confirm": "react type to confirm dialog",
    "email-input": "react email typo detection",
    "safe-submit": "react duplicate submit prevention",
    "unsaved-changes-bar": "react unsaved changes warning",
    "upi-id-input": "react upi id validation",
    "aadhaar-input": "aadhaar input react",
    "ifsc-input": "ifsc validation react",
    "agent-action-approve": "human in the loop approval component for ai agents react",
    "duplicate-payment-guard": "react prevent duplicate payment",
    "secret-paste-guard": "react prevent pasting secrets into form",
    "otp-paste-input": "react otp paste input",
    "draft-restore": "react auto restore form draft",
    "environment-badge": "react environment badge staging production",
    "unambiguous-date": "react unambiguous date format component",
    "hold-to-confirm": "react hold to confirm button",
    "undo-toast": "react undo toast notification",
    "pincode-input": "react india pincode validation input",
    "phone-input": "react phone input with country code",
    "password-input": "react password input with strength indicator",
    "danger-zone": "react danger zone settings component",
    "use-bollard-field": "headless react form validation hook",
    "card-expiry-input": "react card expiry date input",
    "session-list": "react active sessions management component",
    "account-deletion-readback": "react account deletion confirmation readback",
    "reauth-gate": "react reauthentication gate modal",
    "reply-all-guard": "react reply all warning guard",
    "recipient-check": "react email recipient check component",
    "force-push-confirm": "react force push confirmation component",
    "kube-context-guard": "react kubernetes context warning guard",
  }

  if (OVERRIDES[name]) {
    primaryCandidate = OVERRIDES[name]
  } else if (mistakes.length > 0) {
    const candidate = `react ${mistakes[0]}`
    if (!usedPrimaryQueries.has(cleanQuery(candidate))) {
      primaryCandidate = candidate
    }
  }

  if (!primaryCandidate || usedPrimaryQueries.has(cleanQuery(primaryCandidate))) {
    const candidate = `react ${title.toLowerCase()} component`
    if (!usedPrimaryQueries.has(cleanQuery(candidate))) {
      primaryCandidate = candidate
    } else {
      primaryCandidate = `react ${title.toLowerCase()} ${cleanQuery(stops).slice(0, 30)}`
    }
  }

  primaryCandidate = cleanQuery(primaryCandidate)
  let count = 2
  while (usedPrimaryQueries.has(primaryCandidate)) {
    primaryCandidate = `${cleanQuery(primaryCandidate)} ${count++}`
  }
  usedPrimaryQueries.add(primaryCandidate)

  // Secondary queries
  const secondaries = []
  if (mistakes.length > 1) secondaries.push(`shadcn ${cleanQuery(mistakes[1])}`)
  if (mistakes.length > 2) secondaries.push(`how to prevent ${cleanQuery(mistakes[2])} in react`)
  if (aliases.length > 0) secondaries.push(`react ${cleanQuery(aliases[0])} validation`)
  secondaries.push(`shadcn ${cleanQuery(title)}`)
  secondaries.push(`${cleanQuery(name)} react component`)

  const uniqueSecondaries = Array.from(new Set(secondaries.map(cleanQuery)))
    .filter((q) => q !== primaryCandidate)
    .slice(0, 3)

  let intent = "how-to"
  if (name.includes("guard") || name.includes("check") || name.includes("prevent")) {
    intent = "how-to"
  } else if (name.includes("input") || name.includes("dialog") || name.includes("toast") || name.includes("badge")) {
    intent = "install"
  } else if (name.startsWith("use-")) {
    intent = "how-to"
  } else {
    intent = "informational"
  }

  return {
    name,
    title,
    url: `/components/${name}`,
    primaryQuery: primaryCandidate,
    secondaryQueries: uniqueSecondaries,
    intent,
    flow: (item.meta?.flows && item.meta.flows[0]) || "forms",
    mistake: stops,
  }
}

const mappedComponents = items.map(deriveQueries)

// Group by flow
const flows = [
  { id: "checkout", title: "Checkout & Payments", url: "/flows/checkout", primary: "react checkout components for preventing payment mistakes" },
  { id: "signup-login", title: "Sign-up & Login", url: "/flows/signup-login", primary: "react signup and login validation components" },
  { id: "account-settings", title: "Account Settings", url: "/flows/account-settings", primary: "react account settings components and guardrails" },
  { id: "danger-zone", title: "Danger Zone", url: "/flows/danger-zone", primary: "react danger zone components for destructive actions" },
  { id: "forms", title: "Forms & Data Entry", url: "/flows/forms", primary: "react form guardrails and validation components" },
  { id: "messaging", title: "Messaging & Sharing", url: "/flows/messaging", primary: "react messaging and sharing guardrails" },
  { id: "devtools", title: "Dev Tools & Infra", url: "/flows/devtools", primary: "react dev tools and infrastructure safety components" },
  { id: "scheduling", title: "Dates & Scheduling", url: "/flows/scheduling", primary: "react date and scheduling validation components" },
  { id: "india", title: "India Specific Forms", url: "/india", primary: "react form validation components for india" },
]

const guides = [
  { url: "/guides/react-india-form-validation", primary: "react india form validation", intent: "how-to", title: "React India Form Validation Guide" },
  { url: "/guides/react-type-to-confirm-dialog", primary: "react type to confirm dialog", intent: "how-to", title: "React Type to Confirm Dialog Guide" },
  { url: "/guides/react-email-typo-detection", primary: "react email typo detection", intent: "how-to", title: "React Email Typo Detection Guide" },
  { url: "/guides/react-prevent-duplicate-form-submit", primary: "react duplicate submit prevention", intent: "how-to", title: "React Duplicate Submit Prevention Guide" },
  { url: "/guides/human-in-the-loop-ai-agent-approvals", primary: "human in the loop approval component for ai agents react", intent: "how-to", title: "Human in the Loop AI Agent Approvals" },
  { url: "/guides/bollard-ui-vs-zod-validation", primary: "bollard ui vs zod validation", intent: "comparison", title: "Bollard UI vs Zod Validation" },
  { url: "/guides/bollard-ui-vs-react-hook-form", primary: "bollard ui vs react hook form", intent: "comparison", title: "Bollard UI vs React Hook Form" },
  { url: "/guides/bollard-ui-vs-confirm-dialogs", primary: "bollard ui vs confirm dialogs", intent: "comparison", title: "Bollard UI vs Confirm Dialogs" },
  { url: "/guides/react-upi-id-input-validation", primary: "react upi id validation", intent: "how-to", title: "React UPI ID Input Validation" },
  { url: "/guides/react-field-validation-without-changing-ui-library", primary: "headless react form validation hook", intent: "how-to", title: "Headless React Field Validation" },
]

let markdown = `# Bollard UI Search & AI Answer Engine Keyword Map

**Version:** 1.0.0  
**Generated:** November 17, 2026  
**Scope:** 341 Registry Components, 9 Flow Hubs, 10 Topic & Comparison Guides.  
**Strategy:** Capture specific, high-intent long-tail developer queries where Bollard UI offers the single best runnable answer.

---

## Top 30 Target Queries for Immediate Review

These 30 queries represent Bollard UI's highest-priority search and AEO targets across Google Search, Google AI Overviews, Perplexity, and ChatGPT search.

| # | Target Query | Primary URL | Intent | Mistake Prevented / Topic |
|---|:---|:---|:---:|:---|
`

const top30 = [
  { q: "react amount input component", url: "/components/amount-input", intent: "install", note: "Prevents extra zeros on money transfers & financial inputs" },
  { q: "react currency input extra zero", url: "/components/amount-input", intent: "how-to", note: "Flags 10x deviation and provides 1-tap zero slip fix" },
  { q: "react type to confirm dialog", url: "/components/type-to-confirm", intent: "install", note: "Prevents autopilot deletion of critical resources" },
  { q: "react email typo detection", url: "/components/email-input", intent: "how-to", note: "Catches domain typos (e.g. gmial.com) before sign-up submit" },
  { q: "react duplicate submit prevention", url: "/components/safe-submit", intent: "how-to", note: "Blocks multiple form submissions while async call is pending" },
  { q: "react unsaved changes warning", url: "/components/unsaved-changes-bar", intent: "how-to", note: "Prevents accidental navigation away from dirty forms" },
  { q: "react upi id validation", url: "/components/upi-id-input", intent: "how-to", note: "Validates Indian UPI VPA syntax without rejecting valid handles" },
  { q: "aadhaar input react", url: "/components/aadhaar-input", intent: "install", note: "Format and checksum verification for 12-digit Indian Aadhaar" },
  { q: "ifsc validation react", url: "/components/ifsc-input", intent: "how-to", note: "Validates 11-character Indian financial system codes" },
  { q: "human in the loop approval component for ai agents react", url: "/components/agent-action-approve", intent: "how-to", note: "Requires explicit user confirmation before AI agent executes tool calls" },
  { q: "react prevent duplicate payment", url: "/components/duplicate-payment-guard", intent: "how-to", note: "Stops duplicate checkout charges on slow networks" },
  { q: "react prevent pasting secrets into form", url: "/components/secret-paste-guard", intent: "how-to", note: "Warns when API keys, passwords, or tokens are pasted into public inputs" },
  { q: "react otp paste input", url: "/components/otp-paste-input", intent: "install", note: "Handles cross-field SMS/authenticator code pasting reliably" },
  { q: "react auto restore form draft", url: "/components/draft-restore", intent: "how-to", note: "Recovers unsubmitted form content after accidental tab close" },
  { q: "react environment badge staging production", url: "/components/environment-badge", intent: "install", note: "Prevents developers executing destructive actions in production by mistake" },
  { q: "react unambiguous date format component", url: "/components/unambiguous-date", intent: "install", note: "Eliminates MM/DD vs DD/MM date confusion" },
  { q: "react hold to confirm button", url: "/components/hold-to-confirm", intent: "install", note: "Replaces modal dialogs with press-and-hold confirmation" },
  { q: "react undo toast notification", url: "/components/undo-toast", intent: "install", note: "Provides an immediate grace window to cancel reversible actions" },
  { q: "react india pincode validation input", url: "/components/pincode-input", intent: "how-to", note: "Validates 6-digit Indian postal PIN codes" },
  { q: "react phone input with country code", url: "/components/phone-input", intent: "install", note: "International phone formatting with E.164 normalization" },
  { q: "react password input with strength indicator", url: "/components/password-input", intent: "install", note: "Live password policy feedback before form submission" },
  { q: "react danger zone settings component", url: "/components/danger-zone", intent: "install", note: "Structured danger zone UI for irreversible workspace operations" },
  { q: "headless react form validation hook", url: "/components/use-bollard-field", intent: "how-to", note: "Field validation hook without replacing existing UI controls" },
  { q: "react card expiry date input", url: "/components/card-expiry-input", intent: "install", note: "Auto-formats MM/YY and prevents past expiry dates" },
  { q: "react active sessions management component", url: "/components/session-list", intent: "install", note: "Allows revoking suspicious logins and active sessions" },
  { q: "react account deletion confirmation readback", url: "/components/account-deletion-readback", intent: "how-to", note: "Displays exact data lost before permanent account deletion" },
  { q: "react reauthentication gate modal", url: "/components/reauth-gate", intent: "how-to", note: "Prompts for password/passkey before updating security settings" },
  { q: "react reply all warning guard", url: "/components/reply-all-guard", intent: "how-to", note: "Warns before accidental reply-all on large email distribution lists" },
  { q: "react email recipient check component", url: "/components/recipient-check", intent: "how-to", note: "Flags external domain recipients on internal messages" },
  { q: "react force push confirmation component", url: "/components/force-push-confirm", intent: "install", note: "Guards git force push actions in cloud developer dashboards" },
]

top30.forEach((item, index) => {
  markdown += `| ${index + 1} | **${item.q}** | [\`${item.url}\`](${item.url}) | \`${item.intent}\` | ${item.note} |\n`
})

markdown += `\n---\n\n## Flow Hub Queries\n\n| Flow Hub | URL | Primary Target Query | Intent |\n|---|:---|:---|:---:|\n`
flows.forEach((f) => {
  markdown += `| **${f.title}** | [\`${f.url}\`](${f.url}) | **${f.primary}** | \`informational\` |\n`
})

markdown += `\n---\n\n## Guides & Comparison Hub Queries\n\n| Guide Title | URL | Primary Target Query | Intent |\n|---|:---|:---|:---:|\n`
guides.forEach((g) => {
  markdown += `| **${g.title}** | [\`${g.url}\`](${g.url}) | **${g.primary}** | \`${g.intent}\` |\n`
})

markdown += `\n---\n\n## Full Catalog Mapping (341 Components)\n\n`

const groupedByFlow = {}
mappedComponents.forEach((c) => {
  if (!groupedByFlow[c.flow]) groupedByFlow[c.flow] = []
  groupedByFlow[c.flow].push(c)
})

Object.keys(groupedByFlow).sort().forEach((flowKey) => {
  const compList = groupedByFlow[flowKey]
  markdown += `### Flow: \`${flowKey}\` (${compList.length} components)\n\n`
  markdown += `| Component | URL | Primary Query | Secondary Queries | Intent | Mistake Prevented |\n`
  markdown += `|---|---|---|---|:---:|---|\n`
  compList.forEach((c) => {
    const secondaries = c.secondaryQueries.map((q) => `\`${q}\``).join("<br/>")
    markdown += `| **${c.title}** | [\`${c.url}\`](${c.url}) | **${c.primaryQuery}** | ${secondaries} | \`${c.intent}\` | ${c.mistake.replace(/\|/g, "/")} |\n`
  })
  markdown += `\n`
})

fs.writeFileSync("docs/keyword-map.md", markdown)
console.log("Successfully wrote docs/keyword-map.md with", mappedComponents.length, "components!");
