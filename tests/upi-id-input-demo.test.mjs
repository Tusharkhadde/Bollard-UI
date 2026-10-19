import assert from "node:assert/strict"
import { after, test } from "node:test"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"
import { transform } from "esbuild"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const bundlePath = path.join(path.dirname(fileURLToPath(import.meta.url)), `.upi-demo-${process.pid}.mjs`)
const source = fs.readFileSync(path.join(root, "components/demos/upi-id-input-directory.ts"), "utf8")
const compiled = await transform(source, { loader: "ts", format: "esm", target: "node20" })
fs.writeFileSync(bundlePath, compiled.code)
const { verifyDemoUpi } = await import(`${pathToFileURL(bundlePath).href}?${Date.now()}`)
after(() => fs.rmSync(bundlePath, { force: true }))

test("verifies only seeded UPI IDs in the demo directory", async () => {
  assert.deepEqual(await verifyDemoUpi("rohan.sharma@okaxis"), { valid: true, name: "ROHAN SHARMA" })
})

test("does not mark an unseeded but well-formed real ID as invalid", async () => {
  assert.equal(await verifyDemoUpi("myname@okaxis"), null)
})
