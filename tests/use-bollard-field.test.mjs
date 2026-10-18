import assert from "node:assert/strict"
import { after, test } from "node:test"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"
import { transform } from "esbuild"

// Transpile the registry TypeScript into a temporary ESM file so tests run on the
// project's Node 20 baseline without requiring a TS runtime or a new dependency.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const bundlePath = path.join(path.dirname(fileURLToPath(import.meta.url)), `.use-bollard-field-${process.pid}.mjs`)
const source = fs.readFileSync(path.join(root, "registry/default/use-bollard-field/use-bollard-field.ts"), "utf8")
const compiled = await transform(source, { loader: "ts", format: "esm", target: "node20" })
fs.writeFileSync(bundlePath, compiled.code)
const { runBollardValidation } = await import(`${pathToFileURL(bundlePath).href}?${Date.now()}`)
after(() => fs.rmSync(bundlePath, { force: true }))

test("accepts synchronous valid and invalid results", async () => {
  const validate = (value) => value.length < 3 ? "Use at least three characters." : undefined
  assert.equal(await runBollardValidation(validate, "ab"), "Use at least three characters.")
  assert.equal(await runBollardValidation(validate, "abc"), undefined)
})

test("supports asynchronous validators", async () => {
  const validate = async (value) => value === "taken" ? "That name is already in use." : undefined
  assert.equal(await runBollardValidation(validate, "taken"), "That name is already in use.")
  assert.equal(await runBollardValidation(validate, "available"), undefined)
})

test("treats empty or whitespace-only messages as valid", async () => {
  assert.equal(await runBollardValidation(() => undefined, ""), undefined)
  assert.equal(await runBollardValidation(() => "  ", ""), undefined)
})
