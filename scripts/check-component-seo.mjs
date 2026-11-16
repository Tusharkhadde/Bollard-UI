import fs from "node:fs"
import path from "node:path"

const registry = JSON.parse(fs.readFileSync("registry.json", "utf8"))
const components = registry.items.filter((item) =>
  fs.existsSync(path.join("components", "demos", `${item.name}.tsx`)),
)

const pages = components.map((item) => {
  const mistake = (item.meta?.stops || item.description).replace(/[.!?]+$/, "")
  return {
    path: `/components/${item.name}`,
    title: `${item.title} for React: ${mistake}`,
    description: `${mistake}. Install ${item.name} with shadcn; MIT licensed shadcn component.`,
  }
})

function duplicatesBy(field) {
  const occurrences = new Map()
  for (const page of pages) {
    const urls = occurrences.get(page[field]) ?? []
    urls.push(page.path)
    occurrences.set(page[field], urls)
  }
  return [...occurrences].filter(([, urls]) => urls.length > 1)
}

let failed = false
for (const field of ["title", "description"]) {
  const duplicates = duplicatesBy(field)
  if (duplicates.length) {
    failed = true
    console.error(`Duplicate component ${field}s:`)
    for (const [value, urls] of duplicates) console.error(`  ${urls.join(", ")}: ${value}`)
  } else {
    console.log(`No duplicate component ${field}s across ${pages.length} pages.`)
  }
}

if (failed) process.exitCode = 1
