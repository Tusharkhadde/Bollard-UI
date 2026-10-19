import assert from "node:assert/strict"
import { after, test } from "node:test"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"
import { transform } from "esbuild"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const bundlePath = path.join(path.dirname(fileURLToPath(import.meta.url)), `.ifsc-demo-${process.pid}.mjs`)
const source = fs.readFileSync(path.join(root, "components/demos/ifsc-input-directory.ts"), "utf8")
const compiled = await transform(source, { loader: "ts", format: "esm", target: "node20" })
fs.writeFileSync(bundlePath, compiled.code)
const { lookupDemoIfsc } = await import(`${pathToFileURL(bundlePath).href}?${Date.now()}`)
after(() => fs.rmSync(bundlePath, { force: true }))

test("recognizes the valid Union Bank Kasarwadi IFSC shown in the report", async () => {
  assert.deepEqual(await lookupDemoIfsc("UBIN0532207"), {
    bank: "Union Bank of India",
    bankCode: "UBIN",
    branch: "Kasarwadi - Pune",
    city: "Pune",
    state: "Maharashtra",
  })
})

test("does not claim an unseeded IFSC is invalid in the offline demo", async () => {
  assert.equal(await lookupDemoIfsc("UBIN0532208"), undefined)
})
