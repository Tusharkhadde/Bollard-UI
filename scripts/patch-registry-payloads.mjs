// Rewrites repository-only helper imports in generated registry payloads. Source
// files keep their local imports for this repo; installed files use the paths
// emitted by scripts/generate.mjs (`@/components/<item>/<helper>`).
import fs from "node:fs"
import path from "node:path"

const output = path.resolve(import.meta.dirname, "../public/r")
const registry = JSON.parse(fs.readFileSync(path.resolve(import.meta.dirname, "../registry.json"), "utf8"))
let changed = 0

for (const item of registry.items) {
  const file = path.join(output, `${item.name}.json`)
  if (!fs.existsSync(file)) continue
  const payload = JSON.parse(fs.readFileSync(file, "utf8"))
  for (const entry of payload.files ?? []) {
    if (typeof entry.content !== "string") continue
    const next = entry.content.replace(
      /@\/registry\/default\/([a-z0-9-]+)\/([a-z0-9-]+)(\.(?:tsx?|jsx?))?/g,
      (_match, name, base, extension = "") => base === name
        ? `@/components/ui/${name}`
        : `@/components/${name}/${base}${extension}`,
    )
    if (next !== entry.content) {
      entry.content = next
      changed++
    }
  }
  fs.writeFileSync(file, `${JSON.stringify(payload, null, 2)}\n`)
}
console.log(`registry payload imports: normalized ${changed} file(s)`)
