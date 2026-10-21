import assert from "node:assert/strict"
import { test } from "node:test"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { transform } from "esbuild"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const source = fs.readFileSync(path.join(root, "lib/guides.ts"), "utf8")
const compiled = await transform(source, { loader: "ts", format: "esm", target: "node20" })
const guides = await import(`data:text/javascript;base64,${Buffer.from(compiled.code).toString("base64")}`)

test("publishes five distinct developer-intent guides with actionable components", () => {
  assert.equal(guides.GUIDES.length, 5)
  assert.equal(new Set(guides.GUIDES.map((guide) => guide.slug)).size, 5)
  for (const guide of guides.GUIDES) {
    assert.match(guide.title, /\S/)
    assert.match(guide.description, /\S/)
    assert.match(guide.component, /^[a-z0-9-]+$/)
    assert.match(guide.mistake, /\S/)
    assert.match(guide.installCommand, /^npx shadcn@4\.21\.0 add @bollard\/[a-z0-9-]+$/)
  }
})

test("looks up an intent guide by its stable URL slug", () => {
  assert.equal(guides.guideFor("prevent-duplicate-form-submissions-react")?.component, "safe-submit")
  assert.equal(guides.guideFor("does-not-exist"), undefined)
})
