import assert from "node:assert/strict"
import { after, test } from "node:test"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"
import { transform } from "esbuild"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const bundles = []
const loadTypeScript = async (relativePath, prefix) => {
  const bundlePath = path.join(path.dirname(fileURLToPath(import.meta.url)), `.${prefix}-${process.pid}.mjs`)
  const source = fs.readFileSync(path.join(root, relativePath), "utf8")
  const compiled = await transform(source, { loader: "ts", format: "esm", target: "node20" })
  fs.writeFileSync(bundlePath, compiled.code)
  bundles.push(bundlePath)
  return import(`${pathToFileURL(bundlePath).href}?${Date.now()}`)
}

const pincode = await loadTypeScript("components/demos/pincode-input-directory.ts", "pin-demo")
const address = await loadTypeScript("components/demos/address-check-directory.ts", "address-demo")
after(() => bundles.forEach((bundle) => fs.rmSync(bundle, { force: true })))

test("the PIN preview returns an area only for its seeded example", async () => {
  assert.deepEqual(await pincode.lookupDemoPin("411039"), {
    district: "Pune", state: "Maharashtra", areas: ["Bhosari", "Bhosari Gaon", "Dighi Camp"],
  })
  assert.equal(await pincode.lookupDemoPin("411001"), undefined)
})

test("the address preview does not claim an unseeded postcode is invalid", async () => {
  assert.deepEqual(await address.lookupDemoPostcode("IN", "411045"), { city: "Pune", region: "Maharashtra" })
  assert.equal(await address.lookupDemoPostcode("IN", "411001"), undefined)
})
