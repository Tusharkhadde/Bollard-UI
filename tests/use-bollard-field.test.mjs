import assert from "node:assert/strict"
import { after, test } from "node:test"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"
import { transform } from "esbuild"

// Transpile the registry TypeScript into a temporary ESM file so tests run on the
// project's Node 20 baseline without requiring a TS runtime or a new dependency.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const bundlePath = path.join(path.dirname(fileURLToPath(import.meta.url)), `.validation-${process.pid}.mjs`)
const source = fs.readFileSync(path.join(root, "registry/default/use-bollard-field/validation.ts"), "utf8")
const compiled = await transform(source, { loader: "ts", format: "esm", target: "node20" })
fs.writeFileSync(bundlePath, compiled.code)
const validation = await import(`${pathToFileURL(bundlePath).href}?${Date.now()}`)
const { createValidationRunner, runBollardValidation } = validation
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

test("keeps the newest async result when earlier validation resolves last", async () => {
  const resolvers = new Map()
  const states = []
  const runner = createValidationRunner((value) => new Promise((resolve) => resolvers.set(value, resolve)), (state) => states.push(state))

  const older = runner.validate("old")
  const newer = runner.validate("new")
  resolvers.get("new")(undefined)
  await newer
  resolvers.get("old")("Stale error")
  await older

  assert.deepEqual(states.at(-1), { error: undefined, isValidating: false })
})

test("ignores an async result after the field changes", async () => {
  let resolve
  const states = []
  const runner = createValidationRunner(() => new Promise((done) => { resolve = done }), (state) => states.push(state))
  const pending = runner.validate("old")
  runner.invalidate()
  resolve("Stale server error")
  await pending

  assert.deepEqual(states.at(-1), { isValidating: false })
})

test("ignores an async result after validation rules change", async () => {
  let resolve
  const states = []
  const runner = createValidationRunner(() => new Promise((done) => { resolve = done }), (state) => states.push(state))
  const pending = runner.validate("value")
  runner.setValidator(() => undefined)
  resolve("Stale validation error")
  await pending

  assert.deepEqual(states.at(-1), { isValidating: false })
})

test("turns a thrown async validator into a recoverable field error", async () => {
  const states = []
  const runner = createValidationRunner(async () => { throw new Error("offline") }, (state) => states.push(state))

  assert.equal(await runner.validate("value"), "Unable to validate this value. Try again.")
  assert.deepEqual(states.at(-1), { error: "Unable to validate this value. Try again.", isValidating: false })
})

test("preserves existing described-by IDs and adds the field error ID", () => {
  assert.deepEqual(validation.getBollardAriaProps("email-error", undefined, "email-hint"), {
    "aria-invalid": undefined,
    "aria-describedby": "email-hint",
  })
  assert.deepEqual(validation.getBollardAriaProps("email-error", "Invalid email", "email-hint email-error"), {
    "aria-invalid": true,
    "aria-describedby": "email-hint email-error",
  })
})
