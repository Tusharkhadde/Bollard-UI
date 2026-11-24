// ⚠️  SYNC WARNING: The FAQ-generation logic below mirrors lib/component-faq.ts.
// If you change question templates, category branches, or answer structure in
// component-faq.ts, update the corresponding section here.
import fs from "node:fs"
import path from "node:path"

const registry = JSON.parse(fs.readFileSync(path.resolve("registry.json"), "utf8"))
const props = JSON.parse(fs.readFileSync(path.resolve("lib/props.json"), "utf8"))
const catalog = registry.items.filter((item) => fs.existsSync(path.resolve("components", "demos", `${item.name}.tsx`)))
const categories = [...new Set(catalog.map((item) => item.categories?.[0] ?? "More"))]
const FLOWS_COUNT = 9

const CANONICAL_TOTAL_COMPONENTS = 341
const CANONICAL_TOTAL_CATEGORIES = 11
const CANONICAL_TOTAL_FLOWS = 9

console.log("==================================================")
console.log("  BOLLARD UI: SEO / AEO / GEO VERIFICATION SUITE  ")
console.log("==================================================\n")

let totalErrors = 0

// ==========================================================
// Check 1: Canonical Facts & Count Consistency
// ==========================================================
console.log("▶ [1/6] Auditing Canonical Facts & Counts...")
if (catalog.length !== CANONICAL_TOTAL_COMPONENTS) {
  console.error(`❌ Facts Mismatch: Catalog has ${catalog.length} items, but CANONICAL_TOTAL_COMPONENTS is ${CANONICAL_TOTAL_COMPONENTS}`)
  totalErrors++
}
if (categories.length !== CANONICAL_TOTAL_CATEGORIES) {
  console.error(`❌ Facts Mismatch: Categories count is ${categories.length}, but CANONICAL_TOTAL_CATEGORIES is ${CANONICAL_TOTAL_CATEGORIES}`)
  totalErrors++
}
if (FLOWS_COUNT !== CANONICAL_TOTAL_FLOWS) {
  console.error(`❌ Facts Mismatch: FLOWS count is ${FLOWS_COUNT}, but CANONICAL_TOTAL_FLOWS is ${CANONICAL_TOTAL_FLOWS}`)
  totalErrors++
}
if (totalErrors === 0) {
  console.log(`  ✓ Canonical counts verified (${catalog.length} components, ${categories.length} categories, ${FLOWS_COUNT} flows)`)
}

// ==========================================================
// Check 2: FAQ Diversity & Uniqueness (< 50% text overlap)
// ==========================================================
console.log("\n▶ [2/6] Auditing FAQ Uniqueness Across 341 Components...")

function cleanPhrase(text) {
  if (!text) return "accidental form input errors"
  const cleaned = text
    .replace(/^helps prevent\s+/i, "")
    .replace(/^stops\s+/i, "")
    .replace(/^prevents\s+/i, "")
    .trim()
  return cleaned.charAt(0).toLowerCase() + cleaned.slice(1)
}

function getComponentFaqs(item) {
  const meta = item.meta || {}
  const stopPhrase = cleanPhrase(meta.stops || item.description)
  const componentProps = props[item.name]?.props || []
  const propNames = componentProps.slice(0, 5).map((p) => `\`${p.name}\``)
  const category = (item.categories?.[0] || "").toLowerCase()
  const name = item.name
  const mistakes = meta.mistakes || []
  const catches = meta.catches || []
  const limits = meta.limits || []
  const a11y = meta.a11y || []
  const server = meta.server || ""
  const flows = meta.flows || []
  const aliases = meta.aliases || []
  const summary = meta.summary || ""
  const deps = item.dependencies || []
  const files = (item.files || []).map((f) => f.path || f)

  const faqs = []

  // Q1: Specialized problem solved
  if (category.includes("agent") || name.includes("agent") || name.includes("tool")) {
    faqs.push({
      question: `How does ${item.title} protect AI agent operations?`,
      answer: `${item.title} stops ${stopPhrase}. ${summary} It validates autonomous actions against ${catches.join(", ") || mistakes.join(", ") || name}. Limitation: verify ${name} policies at server boundary.`,
    })
  } else if (flows.includes("india") || name.includes("ifsc") || name.includes("upi") || name.includes("gst") || name.includes("aadhaar")) {
    faqs.push({
      question: `How does ${item.title} validate Indian financial identifiers?`,
      answer: `${item.title} stops ${stopPhrase}. Complies with national formats for ${catches.join(", ") || mistakes.join(", ") || aliases.join(", ")}. Limitation: verify ${name} with issuer gateway.`,
    })
  } else if (category.includes("destructive") || name.includes("delete") || name.includes("confirm")) {
    faqs.push({
      question: `How does ${item.title} protect destructive mutations?`,
      answer: `${item.title} prevents ${stopPhrase}. Enforces deliberate friction against ${catches.join(", ") || mistakes.join(", ") || name}. Limitation: authorize ${name} mutations on the server.`,
    })
  } else if (flows.includes("checkout") || category.includes("payment") || name.includes("amount") || name.includes("price")) {
    faqs.push({
      question: `How does ${item.title} prevent financial transaction errors?`,
      answer: `${item.title} prevents ${stopPhrase}. Blocks ${catches.join(", ") || mistakes.join(", ") || "billing errors"} before processing. Limitation: apply idempotency keys for ${name}.`,
    })
  } else if (flows.includes("scheduling") || name.includes("date") || name.includes("time")) {
    faqs.push({
      question: `How does ${item.title} handle date and time accuracy?`,
      answer: `${item.title} catches ${stopPhrase}. Validates calendar constraints: ${catches.join(", ") || mistakes.join(", ") || name}. Limitation: match ${name} with server timezone.`,
    })
  } else {
    faqs.push({
      question: `What form validation mistake does ${item.title} catch?`,
      answer: `${item.title} prevents ${stopPhrase}. ${summary} Catches: ${catches.join(", ") || mistakes.join(", ") || item.description}. Limitation: validate ${name} schemas on backend.`,
    })
  }

  // Q2: Installation
  faqs.push({
    question: `How do I install ${item.name} with shadcn?`,
    answer: `Run \`npx shadcn@4.21.0 add @bollard/${item.name}\`. Sources added: ${files.join(", ") || item.name}. Package requirements: ${deps.join(", ") || `zero dependencies for ${name}`}.`,
  })

  // Q3: Props or Hook usage
  if (item.type === "registry:hook" || name.startsWith("use-")) {
    faqs.push({
      question: `How do I consume the ${item.name} hook?`,
      answer: `Import { ${item.title.replace(/\s+/g, "")} } from "@/components/ui/${item.name}". Returns form bindings and error states. Supports props: ${propNames.join(", ") || "default options"}. Limitation: headless hook requires connecting your own UI components.`,
    })
  } else {
    faqs.push({
      question: `What props customize ${item.title}?`,
      answer: `${item.title} accepts ${propNames.join(", ") || "custom UI props"}. Configures ${aliases.slice(0, 3).join(", ") || item.name} behavior. Limitation: invalid prop values fallback to safe default options.`,
    })
  }

  // Q4: Operational boundaries
  faqs.push({
    question: `What are the limits of ${item.name}?`,
    answer: `${limits.join(". ") || `${item.title} operates in browser client.`} Server requirement: ${server || `backend verification for ${name}.`}`,
  })

  // Q5: Accessibility or Error recovery
  if (a11y.length > 0) {
    faqs.push({
      question: `How does ${item.title} meet accessibility guidelines?`,
      answer: `${a11y.join(". ")}. Minimizes errors: ${mistakes.slice(0, 2).join(", ") || stopPhrase}. Limitation: custom themes must preserve WCAG AA contrast.`,
    })
  } else {
    faqs.push({
      question: `What user errors does ${item.title} flag?`,
      answer: `${item.title} flags ${mistakes.slice(0, 3).join(", ") || stopPhrase} during user interaction.`,
    })
  }

  return faqs
}

function getWords(str) {
  return new Set(str.toLowerCase().replace(/[^a-z0-9\s]/g, "").split(/\s+/).filter((w) => w.length > 2))
}

function jaccard(setA, setB) {
  let intersection = 0
  for (const item of setA) {
    if (setB.has(item)) intersection++
  }
  const union = setA.size + setB.size - intersection
  return union === 0 ? 0 : intersection / union
}

const componentFaqWords = catalog.map((item) => {
  const faqs = getComponentFaqs(item)
  const allText = faqs.map((f) => `${f.question} ${f.answer}`).join(" ")
  return {
    name: item.name,
    words: getWords(allText),
  }
})

let maxSimilarity = 0
let mostSimilarPair = []
let duplicateFaqCount = 0

// Check pairwise similarity across components
for (let i = 0; i < componentFaqWords.length; i++) {
  for (let j = i + 1; j < componentFaqWords.length; j++) {
    const sim = jaccard(componentFaqWords[i].words, componentFaqWords[j].words)
    if (sim > maxSimilarity) {
      maxSimilarity = sim
      mostSimilarPair = [componentFaqWords[i].name, componentFaqWords[j].name]
    }
    if (sim > 0.50) {
      console.error(`❌ FAQ Overlap > 50%: ${componentFaqWords[i].name} and ${componentFaqWords[j].name} share ${(sim * 100).toFixed(1)}% FAQ words`)
      duplicateFaqCount++
      totalErrors++
      if (duplicateFaqCount > 5) break
    }
  }
  if (duplicateFaqCount > 5) break
}

if (duplicateFaqCount === 0) {
  console.log(`  ✓ All 341 component FAQs have distinct phrasing (max overlap: ${(maxSimilarity * 100).toFixed(1)}% between ${mostSimilarPair.join(" and ")})`)
}

// ==========================================================
// Check 3: Date Freshness (No Future Dates)
// ==========================================================
console.log("\n▶ [3/6] Auditing Date Freshness & Future Dates...")
const datesFile = path.resolve("lib/component-dates.json")
const dates = JSON.parse(fs.readFileSync(datesFile, "utf8"))
const now = new Date()
const maxAllowedTime = now.getTime() + 24 * 60 * 60 * 1000

let dateErrors = 0
for (const [name, dateStr] of Object.entries(dates)) {
  const d = new Date(`${dateStr}T00:00:00Z`)
  if (isNaN(d.getTime()) || d.getTime() > maxAllowedTime) {
    console.error(`❌ [${name}] Date is invalid or in future: "${dateStr}"`)
    dateErrors++
    totalErrors++
  }
}
if (dateErrors === 0) {
  console.log(`  ✓ Verified ${Object.keys(dates).length} dates. Zero future dates detected.`)
}

// ==========================================================
// Check 4: Prerendered HTML Audit (No-JS Crawlability)
// ==========================================================
console.log("\n▶ [4/6] Auditing No-JS Server-Rendered HTML...")

const distDir = path.resolve(".next/server/app")
if (!fs.existsSync(distDir)) {
  console.error("❌ .next/server/app does not exist. Run 'next build' first.")
  process.exit(1)
}

function walk(dir) {
  let results = []
  if (!fs.existsSync(dir)) return results
  const list = fs.readdirSync(dir)
  for (const file of list) {
    const full = path.join(dir, file)
    const stat = fs.statSync(full)
    if (stat.isDirectory()) {
      results = results.concat(walk(full))
    } else if (file.endsWith(".html")) {
      results.push(full)
    }
  }
  return results
}

const allHtmlFiles = walk(distDir)
const pagesToCheck = allHtmlFiles.filter((filePath) => {
  const rel = path.relative(distDir, filePath)
  if (rel.startsWith("_") || rel.includes("/_")) return false
  if (rel.includes("500.html") || rel.includes("404.html")) return false
  if (rel.startsWith("preview/") || rel.includes("/preview/")) return false
  return true
})

// Check key representative templates
const templatesToVerify = [
  // The homepage specs table moved to /about with the landing redesign; /about is checked for it instead.
  { name: "Homepage", rel: "index.html", mustHave: ["h1", "faq", "install", "json-ld"] },
  { name: "About", rel: "about.html", mustHave: ["h1", "facts", "json-ld"] },
  { name: "Component Page", rel: "components/amount-input.html", mustHave: ["h1", "answer", "facts", "faq", "install", "json-ld"] },
  { name: "Flow Hub", rel: "flows/checkout.html", mustHave: ["h1", "answer", "faq", "install", "json-ld"] },
  { name: "Guide", rel: "guides/react-prevent-duplicate-form-submit.html", mustHave: ["h1", "faq-or-sections", "install", "json-ld"] },
]

for (const tmpl of templatesToVerify) {
  const targetFile = path.join(distDir, tmpl.rel)
  if (!fs.existsSync(targetFile)) {
    console.error(`❌ Template file missing: ${tmpl.rel}`)
    totalErrors++
    continue
  }
  const html = fs.readFileSync(targetFile, "utf8")
  const hasH1 = /<h1[^>]*>[\s\S]*?<\/h1>/i.test(html)
  const hasJsonLd = /<script\s+type="application\/ld\+json">/i.test(html)
  // Pinned (shadcn@4.21.0 add) or short (shadcn add @bollard/…) commands both count.
  const hasInstall = /(npx|pnpm dlx|bunx)\s+(--bun\s+)?shadcn(@4\.21\.0)?(<!-- -->)?\s*[\s\S]{0,80}?add/i.test(html)
  const hasFacts = /facts\s+(&amp;|&)\s+(technical\s+)?specifications/i.test(html) || /id="facts"/i.test(html) || /aria-labelledby="facts-heading"/i.test(html)
  const hasFaq = /Frequently Asked Questions/i.test(html) || /<details/i.test(html)

  if (!hasH1) {
    console.error(`❌ [${tmpl.name}] Missing <h1> in server HTML`)
    totalErrors++
  }
  if (!hasJsonLd) {
    console.error(`❌ [${tmpl.name}] Missing JSON-LD script in server HTML`)
    totalErrors++
  }
  if (tmpl.mustHave.includes("install") && !hasInstall) {
    console.error(`❌ [${tmpl.name}] Missing shadcn install command in server HTML`)
    totalErrors++
  }
  if (tmpl.mustHave.includes("facts") && !hasFacts) {
    console.error(`❌ [${tmpl.name}] Missing visible Facts table in server HTML`)
    totalErrors++
  }
  if (tmpl.mustHave.includes("faq") && !hasFaq) {
    console.error(`❌ [${tmpl.name}] Missing visible FAQ in server HTML`)
    totalErrors++
  }
  console.log(`  ✓ [${tmpl.name}] No-JS SSR complete (H1, install command, JSON-LD, visible facts/FAQ)`)
}

// ==========================================================
// Check 5: Hidden Content Scanner (No Cloaking)
// ==========================================================
console.log("\n▶ [5/6] Scanning for Hidden Links & Content...")

let hiddenContentErrors = 0
for (const filePath of pagesToCheck) {
  const rel = path.relative(distDir, filePath)
  const html = fs.readFileSync(filePath, "utf8")

  // Check for hidden link patterns (e.g. <a style="display:none"> or a hidden container containing links)
  const hiddenLinkMatches =
    html.match(/<a[^>]*style=["'][^"']*(display:\s*none|visibility:\s*hidden)[^"']*["']/gi) ||
    html.match(/<(div|p|span|section)[^>]*style=["'][^"']*(display:\s*none|visibility:\s*hidden)[^"']*["'][^>]*>(?:(?!<\/\1>)[\s\S])*?<a\s+/gi) ||
    html.match(/style=["'][^"']*(text-indent:\s*-[0-9]{3,}|left:\s*-[0-9]{4,}px)[^"']*["']/gi)
  if (hiddenLinkMatches) {
    console.error(`❌ [${rel}] Potential cloaked or hidden links detected:`, hiddenLinkMatches.slice(0, 2))
    hiddenContentErrors++
    totalErrors++
  }
}
if (hiddenContentErrors === 0) {
  console.log(`  ✓ Scanned ${pagesToCheck.length} pages. Zero hidden links or cloaked text detected.`)
}

// ==========================================================
// Check 6: Title, Description, Canonical & H1 Strictness
// ==========================================================
console.log(`\n▶ [6/6] Auditing Titles, Descriptions, Canonicals & H1s across ${pagesToCheck.length} pages...`)

const titlesMap = new Map()
const descriptionsMap = new Map()
let metaErrors = 0

function decodeHtmlEntities(str) {
  return str
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&rsquo;/g, "’")
    .replace(/&lsquo;/g, "‘")
    .replace(/&rdquo;/g, "”")
    .replace(/&ldquo;/g, "“")
}

for (const filePath of pagesToCheck) {
  const rel = path.relative(distDir, filePath)
  const html = fs.readFileSync(filePath, "utf8")

  // Extract <title>
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i)
  if (!titleMatch) {
    console.error(`❌ [${rel}] Missing <title> tag`)
    metaErrors++
    totalErrors++
  } else {
    const rawTitle = decodeHtmlEntities(titleMatch[1].trim())
    if (rawTitle.length > 65) {
      console.error(`❌ [${rel}] Title is over 65 characters (${rawTitle.length} chars): "${rawTitle}"`)
      metaErrors++
      totalErrors++
    }
    if (titlesMap.has(rawTitle)) {
      console.error(`❌ [${rel}] Duplicate title shared with ${titlesMap.get(rawTitle)}: "${rawTitle}"`)
      metaErrors++
      totalErrors++
    } else {
      titlesMap.set(rawTitle, rel)
    }
  }

  // Extract <meta name="description">
  const descMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']*)["']/i)
  if (!descMatch) {
    console.error(`❌ [${rel}] Missing meta description`)
    metaErrors++
    totalErrors++
  } else {
    const rawDesc = decodeHtmlEntities(descMatch[1].trim())
    if (rawDesc.length > 160) {
      console.error(`❌ [${rel}] Description is over 160 characters (${rawDesc.length} chars): "${rawDesc}"`)
      metaErrors++
      totalErrors++
    }
    if (descriptionsMap.has(rawDesc)) {
      console.error(`❌ [${rel}] Duplicate description shared with ${descriptionsMap.get(rawDesc)}: "${rawDesc}"`)
      metaErrors++
      totalErrors++
    } else {
      descriptionsMap.set(rawDesc, rel)
    }
  }

  // Extract canonical
  const canonicalMatch = html.match(/<link[^>]*rel=["']canonical["'][^>]*href=["']([^"']*)["']/i)
  if (!canonicalMatch) {
    console.error(`❌ [${rel}] Missing canonical link`)
    metaErrors++
    totalErrors++
  }

  // Extract H1
  const h1Match = html.match(/<h1[^>]*>([^<]+)<\/h1>/i)
  if (!h1Match) {
    console.error(`❌ [${rel}] Missing <h1> heading`)
    metaErrors++
    totalErrors++
  }
}

if (metaErrors === 0) {
  console.log(`  ✓ All ${pagesToCheck.length} pages passed title (<= 65), description (<= 160), canonical & H1 validation`)
}

// ==========================================================
// Final Result
// ==========================================================
console.log("\n==================================================")
if (totalErrors > 0) {
  console.error(`❌ Verification FAILED with ${totalErrors} error(s).`)
  process.exit(1)
} else {
  console.log("✅ ALL VERIFICATION CHECKS PASSED (100% compliant)")
  console.log("==================================================")
  process.exit(0)
}
