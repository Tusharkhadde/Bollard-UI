// Stamps a one-line provenance header on every component (.tsx) and helper (.ts) file in
// registry/default, so a copied file still says where it came from. Idempotent: an existing
// header is rewritten in place, never duplicated. A leading "use client" directive stays first.
//
//   node scripts/stamp-headers.mjs          stamp files
//   node scripts/stamp-headers.mjs --check  exit 1 if any file is missing its header
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..")
const dir = path.join(root, "registry/default")
const SITE = "https://bollard-ui.vercel.app"
const check = process.argv.includes("--check")

const header = (name) => `// Bollard UI — ${name} · MIT licence · ${SITE}/components/${name}`
const isDirective = (line) => /^\s*(["'])use client\1;?\s*$/.test(line)
const isHeader = (line) => line.startsWith("// Bollard UI — ")

let changed = 0
let missing = 0
let total = 0
for (const name of fs.readdirSync(dir).sort()) {
  const folder = path.join(dir, name)
  if (!fs.statSync(folder).isDirectory()) continue
  for (const file of fs.readdirSync(folder).filter((f) => /\.(tsx|ts)$/.test(f)).sort()) {
    total++
    const full = path.join(folder, file)
    const text = fs.readFileSync(full, "utf8")
    const lines = text.split("\n")
    const want = header(name)
    const at = lines.slice(0, 5).findIndex(isHeader)
    let next
    if (at >= 0) {
      if (lines[at] === want) continue
      lines[at] = want
      next = lines.join("\n")
    } else if (isDirective(lines[0] ?? "")) {
      // "use client" must stay the first statement in the file.
      next = [lines[0], "", want, ...lines.slice(1)].join("\n")
    } else {
      next = [want, "", ...lines].join("\n")
    }
    missing++
    if (!check) {
      fs.writeFileSync(full, next)
      changed++
    }
  }
}

if (check) {
  console.log(missing ? `${missing} of ${total} files need a header; run node scripts/stamp-headers.mjs` : `headers ok (${total} files)`)
  process.exit(missing ? 1 : 0)
}
console.log(`stamped ${changed} of ${total} files`)
