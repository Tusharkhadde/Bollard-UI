import fs from "node:fs"
import path from "node:path"

const datesFile = path.resolve("lib/component-dates.json")
if (!fs.existsSync(datesFile)) {
  console.error("Error: lib/component-dates.json does not exist.")
  process.exit(1)
}

const dates = JSON.parse(fs.readFileSync(datesFile, "utf8"))
const now = new Date()
// Allow up to end of today UTC
const maxAllowedTime = now.getTime() + 24 * 60 * 60 * 1000

let errors = 0

for (const [name, dateStr] of Object.entries(dates)) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    console.error(`❌ [${name}] Invalid date format: "${dateStr}" (expected YYYY-MM-DD)`)
    errors++
    continue
  }

  const d = new Date(`${dateStr}T00:00:00Z`)
  if (isNaN(d.getTime())) {
    console.error(`❌ [${name}] Unparseable date: "${dateStr}"`)
    errors++
    continue
  }

  if (d.getTime() > maxAllowedTime) {
    console.error(`❌ [${name}] Future date detected: "${dateStr}" is in the future`)
    errors++
  }
}

// Also check article metadata dates
const articleFile = path.resolve("lib/article-metadata.ts")
if (fs.existsSync(articleFile)) {
  const content = fs.readFileSync(articleFile, "utf8")
  const match = content.match(/ARTICLE_DATE_MODIFIED\s*=\s*["']([^"']+)["']/)
  if (match) {
    const modDateStr = match[1]
    const d = new Date(`${modDateStr}T00:00:00Z`)
    if (d.getTime() > maxAllowedTime) {
      console.error(`❌ [article-metadata.ts] Future date detected: "${modDateStr}" is in the future`)
      errors++
    }
  }
}

if (errors > 0) {
  console.error(`\nBuild failed: ${errors} freshness/future date error(s) detected.`)
  process.exit(1)
}

console.log(`✅ Freshness check passed: verified ${Object.keys(dates).length} component dates. None are in the future.`)
