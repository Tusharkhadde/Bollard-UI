import assert from "node:assert/strict"
import { test } from "node:test"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const read = (file) => fs.readFileSync(path.join(root, file), "utf8")

test("hero starts without Bollard and uses Indian lakh formatting", () => {
  const preview = read("components/site/landing/hero-preview.tsx")
  assert.match(preview, /useState\(false\)/)
  assert.match(preview, /1,00,000/)
  assert.match(preview, /disabled=\{!confirmed\}/)
  assert.doesNotMatch(preview, /label: "Transfer"/)
  assert.match(read("components/site/landing/hero.tsx"), /line-clamp-3/)
})
