// Checks registry.json against the source tree. Run after `node scripts/generate.mjs`.
//
// Errors (exit 1): invalid JSON or shape, duplicate names, missing files, an npm package that a
// component imports but does not declare in `dependencies`, a relative import that is not one of
// the item's own files, missing page fields (summary, catches, limits, a11y).
// Warnings (exit 0): imports of other Bollard UI components not listed in `registryDependencies`,
// declared dependencies that are never imported, dependencies missing from package.json, and
// `@/` imports other than `@/lib/utils`.
import fs from "node:fs"
import path from "node:path"
import { builtinModules } from "node:module"
import { fileURLToPath } from "node:url"

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..")
const errors = []
const warnings = []

// Provided by the user's React app, so never listed per component.
const PEERS = new Set(["react", "react-dom"])
const BUILTINS = new Set(builtinModules)
const PAGE_FIELDS = ["summary", "catches", "limits", "a11y"]

let registry
try {
  // Optional argument: another registry file to check (paths inside it stay relative to the repo root).
  registry = JSON.parse(fs.readFileSync(process.argv[2] ? path.resolve(process.argv[2]) : path.join(root, "registry.json"), "utf8"))
} catch (error) {
  console.error(`registry.json is not valid JSON: ${error.message}`)
  process.exit(1)
}
if (!registry || typeof registry.name !== "string" || !Array.isArray(registry.items)) {
  console.error('registry.json needs a string "name" and an "items" array')
  process.exit(1)
}

const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"))
const installed = new Set([...Object.keys(pkg.dependencies ?? {}), ...Object.keys(pkg.devDependencies ?? {})])
const names = new Set()
const allNames = new Set(registry.items.map((item) => item?.name))

/** "motion/react" → "motion", "@date-fns/tz/x" → "@date-fns/tz". */
const packageOf = (spec) => (spec.startsWith("@") ? spec.split("/").slice(0, 2).join("/") : spec.split("/")[0])

/** Module specifiers in import/export statements, dynamic import() and require(). */
function importsOf(source) {
  const specs = new Set()
  const patterns = [
    /\bimport\s+(?:type\s+)?(?:[\w*{}\s,$]+?\s+from\s+)?["']([^"']+)["']/g,
    /\bexport\s+(?:type\s+)?(?:\*|\{[^}]*\})(?:\s+as\s+\w+)?\s+from\s+["']([^"']+)["']/g,
    /\bimport\(\s*["']([^"']+)["']\s*\)/g,
    /\brequire\(\s*["']([^"']+)["']\s*\)/g,
  ]
  // Comments can mention imports in examples; drop them first.
  const code = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1")
  for (const re of patterns) for (const m of code.matchAll(re)) specs.add(m[1])
  return [...specs]
}

for (const [index, item] of registry.items.entries()) {
  const where = item?.name ?? `items[${index}]`
  if (!item || typeof item.name !== "string" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(item.name)) {
    errors.push(`${where}: missing or non-kebab-case name`)
    continue
  }
  if (names.has(item.name)) errors.push(`${item.name}: duplicate name`)
  names.add(item.name)
  for (const key of ["type", "title", "description"]) if (typeof item[key] !== "string" || !item[key].trim()) errors.push(`${item.name}: missing "${key}"`)
  if (!Array.isArray(item.files) || !item.files.length) {
    errors.push(`${item.name}: no files`)
    continue
  }

  const deps = new Set(item.dependencies ?? [])
  const regDeps = new Set((item.registryDependencies ?? []).map((d) => d.replace(/^.*\/r\/([^/]+)\.json$/, "$1")))
  const filePaths = new Set(item.files.map((f) => f?.path))
  const used = new Set()

  for (const file of item.files) {
    if (!file || typeof file.path !== "string" || typeof file.type !== "string") {
      errors.push(`${item.name}: a file entry needs "path" and "type"`)
      continue
    }
    const full = path.join(root, file.path)
    if (!fs.existsSync(full)) {
      errors.push(`${item.name}: file not found: ${file.path}`)
      continue
    }
    for (const spec of importsOf(fs.readFileSync(full, "utf8"))) {
      if (spec.startsWith(".")) {
        const base = path.posix.normalize(path.posix.join(path.posix.dirname(file.path), spec))
        if (![base, `${base}.ts`, `${base}.tsx`, `${base}/index.ts`, `${base}/index.tsx`].some((p) => filePaths.has(p)))
          errors.push(`${item.name}: ${file.path} imports "${spec}", which is not one of this item's files`)
      } else if (spec.startsWith("@/registry/default/")) {
        const other = spec.split("/")[3]
        if (other !== item.name && !regDeps.has(other))
          warnings.push(`${item.name}: imports ${other}${allNames.has(other) ? "" : " (not in the registry)"} but registryDependencies does not list it`)
      } else if (spec.startsWith("@/")) {
        if (spec !== "@/lib/utils") warnings.push(`${item.name}: imports "${spec}", which a user's project may not have`)
      } else if (!spec.startsWith("node:") && !BUILTINS.has(spec)) {
        const name = packageOf(spec)
        used.add(name)
        if (!PEERS.has(name) && !deps.has(name)) errors.push(`${item.name}: imports "${name}" but does not declare it in dependencies (meta.json)`)
      }
    }
  }

  for (const dep of deps) {
    const name = packageOf(dep.replace(/(?!^)@.*$/, ""))
    if (!used.has(name)) warnings.push(`${item.name}: declares "${dep}" but never imports it`)
    if (!installed.has(name)) warnings.push(`${item.name}: "${dep}" is not in package.json`)
  }

  const meta = item.meta ?? {}
  for (const key of PAGE_FIELDS) {
    const value = meta[key]
    if (value === undefined || (Array.isArray(value) && !value.length) || (typeof value === "string" && !value.trim()))
      errors.push(`${item.name}: meta.json is missing "${key}"`)
  }
}

for (const w of new Set(warnings)) console.log(`warning: ${w}`)
for (const e of errors) console.log(`error: ${e}`)
console.log(`${registry.items.length} items checked: ${errors.length} error(s), ${new Set(warnings).size} warning(s)`)
process.exit(errors.length ? 1 : 0)
