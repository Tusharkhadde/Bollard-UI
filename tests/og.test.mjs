import assert from "node:assert/strict"
import { after, test } from "node:test"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"
import { transform } from "esbuild"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const bundlePath = path.join(path.dirname(fileURLToPath(import.meta.url)), `.og-${process.pid}.mjs`)
const source = fs.readFileSync(path.join(root, "lib/og.tsx"), "utf8")
const compiled = await transform(source, { loader: "tsx", format: "esm", target: "node20" })
fs.writeFileSync(bundlePath, compiled.code)
const { clampWords } = await import(`${pathToFileURL(bundlePath).href}?${Date.now()}`)
after(() => fs.rmSync(bundlePath, { force: true }))

test("makes keyboard shortcuts readable in generated OG images without font downloads", () => {
  assert.equal(clampWords("Press ⌘⌫ again to delete", 80), "Press Cmd+Backspace again to delete")
})

test("keeps word-boundary truncation after normalizing unsupported glyphs", () => {
  assert.equal(clampWords("Press ⌘+Z to undo this action", 13), "Press Cmd+Z…")
})
