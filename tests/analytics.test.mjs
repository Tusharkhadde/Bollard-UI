import assert from "node:assert/strict"
import { test } from "node:test"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { transform } from "esbuild"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const source = fs.readFileSync(path.join(root, "lib/analytics.ts"), "utf8")
const compiled = await transform(source, { loader: "ts", format: "esm", target: "node20" })
const analytics = await import(`data:text/javascript;base64,${Buffer.from(compiled.code).toString("base64")}`)

test("extracts registry item names without retaining arbitrary command content", () => {
  assert.deepEqual(
    analytics.registryItemsFromArgs("https://bollard-ui.vercel.app/r/email-input.json https://bollard-ui.vercel.app/r/safe-submit.json"),
    ["email-input", "safe-submit"],
  )
  assert.deepEqual(analytics.registryItemsFromArgs("--overwrite"), [])
  assert.deepEqual(analytics.registryItemsFromArgs("@bollard/agent-pack @bollard/undo-toast"), ["agent-pack", "undo-toast"])
})

test("component feedback reports only a public slug and a binary response", () => {
  const events = []
  globalThis.window = { gtag: (...args) => events.push(args) }
  try {
    analytics.trackComponentFeedback({ component: "amount-input", helpful: true })
    assert.deepEqual(events, [["event", "bollard_component_feedback", { component: "amount-input", helpful: "yes" }]])
    assert.doesNotMatch(JSON.stringify(events), /secret|token|api[_-]?key/i)
  } finally {
    delete globalThis.window
  }
})
