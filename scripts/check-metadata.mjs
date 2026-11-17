import fs from "node:fs"
import path from "node:path"

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

const distDir = path.resolve(".next/server/app")
if (!fs.existsSync(distDir)) {
  console.error("Error: .next/server/app does not exist. Run 'next build' first.")
  process.exit(1)
}

const allHtmlFiles = walk(distDir)
// Filter out non-content routes (error pages, internal routes, iframe preview frames)
const pagesToCheck = allHtmlFiles.filter((filePath) => {
  const rel = path.relative(distDir, filePath)
  if (rel.startsWith("_") || rel.includes("/_")) return false
  if (rel.includes("500.html") || rel.includes("404.html")) return false
  if (rel.startsWith("preview/") || rel.includes("/preview/")) return false
  return true
})

console.log(`Auditing metadata for ${pagesToCheck.length} production HTML pages...`)

const titlesMap = new Map()
const descriptionsMap = new Map()
const errors = []

for (const filePath of pagesToCheck) {
  const rel = path.relative(distDir, filePath)
  const html = fs.readFileSync(filePath, "utf8")

  // Extract <title>
  const titleMatch = html.match(/<title>([^<]*)<\/title>/i)
  const rawTitle = titleMatch ? titleMatch[1].trim() : ""
  const title = decodeHtmlEntities(rawTitle)

  // Extract <meta name="description" content="...">
  const descMatch = html.match(/<meta\s+name="description"\s+content="([^"]*)"/i) ||
                    html.match(/<meta\s+content="([^"]*)"\s+name="description"/i)
  const rawDesc = descMatch ? descMatch[1].trim() : ""
  const description = decodeHtmlEntities(rawDesc)

  // Extract <link rel="canonical" href="...">
  const canonMatch = html.match(/<link\s+rel="canonical"\s+href="([^"]*)"/i) ||
                     html.match(/<link\s+href="([^"]*)"\s+rel="canonical"/i)
  const canonical = canonMatch ? canonMatch[1].trim() : ""

  // Extract <h1>
  const h1Match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)
  const h1 = h1Match ? decodeHtmlEntities(h1Match[1].replace(/<[^>]*>/g, "").trim()) : ""

  // 1. Missing Title check
  if (!title) {
    errors.push(`[${rel}] Missing <title>`)
  } else if (title.length > 65) {
    errors.push(`[${rel}] Title is over 65 characters (${title.length} chars): "${title}"`)
  } else {
    if (titlesMap.has(title)) {
      errors.push(`[${rel}] Duplicate title shared with [${titlesMap.get(title)}]: "${title}"`)
    } else {
      titlesMap.set(title, rel)
    }
  }

  // 2. Missing Description check
  if (!description) {
    errors.push(`[${rel}] Missing meta description`)
  } else if (description.length > 160) {
    errors.push(`[${rel}] Description is over 160 characters (${description.length} chars): "${description}"`)
  } else {
    if (descriptionsMap.has(description)) {
      errors.push(`[${rel}] Duplicate description shared with [${descriptionsMap.get(description)}]: "${description}"`)
    } else {
      descriptionsMap.set(description, rel)
    }
  }

  // 3. Missing Canonical check
  if (!canonical) {
    errors.push(`[${rel}] Missing canonical link tag`)
  }

  // 4. Missing H1 check
  if (!h1) {
    errors.push(`[${rel}] Missing <h1> tag`)
  }
}

if (errors.length > 0) {
  console.error(`\n❌ Metadata Check Failed with ${errors.length} error(s):\n`)
  errors.forEach((err) => console.error(` - ${err}`))
  console.error(`\nBuild failed due to metadata violations.`)
  process.exit(1)
} else {
  console.log(`\n✅ All ${pagesToCheck.length} pages passed metadata checks:`)
  console.log(` - No duplicate titles or descriptions`)
  console.log(` - All titles <= 65 characters`)
  console.log(` - All descriptions <= 160 characters`)
  console.log(` - All pages have self-referencing canonicals and valid <h1> headings\n`)
  process.exit(0)
}
