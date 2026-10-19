import assert from "node:assert/strict"
import { after, test } from "node:test"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"
import { transform } from "esbuild"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const bundlePath = path.join(path.dirname(fileURLToPath(import.meta.url)), `.finder-${process.pid}.mjs`)
const source = fs.readFileSync(path.join(root, "lib/finder-filters.ts"), "utf8")
const compiled = await transform(source, { loader: "ts", format: "esm", target: "node20" })
fs.writeFileSync(bundlePath, compiled.code)
const { filterFinderItems, shouldUseUnfilteredFallback } = await import(`${pathToFileURL(bundlePath).href}?${Date.now()}`)
after(async () => (await import("node:fs/promises")).rm(bundlePath, { force: true }))

const items = [
  { name: "amount-input", title: "Amount Input", description: "Review an amount", category: "Fields", integration: "styled", hasDependencies: true, flows: ["checkout"], fields: ["amount"] },
  { name: "use-bollard-field", title: "useBollardField", description: "Validate any control", category: "More", integration: "headless", hasDependencies: false, flows: ["forms"], fields: ["email"] },
  { name: "email-input", title: "Email Input", description: "Validate email", category: "Fields", integration: "styled", hasDependencies: false, flows: ["forms"], fields: ["email"] },
]

test("keeps the full catalog when integration and dependency filters are clear", () => {
  const result = filterFinderItems(items, { flow: null, field: null, category: null, integration: null, dependencies: null })
  assert.deepEqual(result, items)
})

test("combines headless integration and dependency filters", () => {
  const result = filterFinderItems(items, { flow: null, field: null, category: null, integration: "headless", dependencies: "without" })
  assert.deepEqual(result.map((item) => item.name), ["use-bollard-field"])
})

test("filters for styled UI components with extra packages", () => {
  const result = filterFinderItems(items, { flow: null, field: null, category: null, integration: "styled", dependencies: "with" })
  assert.deepEqual(result.map((item) => item.name), ["amount-input"])
})

test("keeps non-empty facets applied when text search has no exact match", () => {
  assert.equal(shouldUseUnfilteredFallback(3, items.length), false)
})

test("falls back to catalog-wide suggestions only when facets match nothing", () => {
  assert.equal(shouldUseUnfilteredFallback(0, items.length), true)
})
