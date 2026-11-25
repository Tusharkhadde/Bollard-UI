import assert from "node:assert/strict"
import fs from "node:fs"
import test from "node:test"
import { buildSync } from "esbuild"

async function loadComponent(entryPoint) {
  const result = buildSync({
    entryPoints: [entryPoint],
    bundle: true,
    write: false,
    format: "esm",
    platform: "node",
  })
  return import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString("base64")}`)
}

test("connection strings tolerate regex metacharacters in unknown query keys", async () => {
  const mod = await loadComponent("registry/default/connection-string-input/connection-string.ts")
  assert.doesNotThrow(() => mod.checkConnectionString("postgresql://user:pass@db.example.com/app?sslmo[de=require"))
})

test("amount words escape unknown words before creating suggestion regexes", async () => {
  const source = fs.readFileSync("registry/default/amount-in-words/amount-in-words.tsx", "utf8")
  assert.doesNotMatch(source, /unknown\.word}\}/)
  assert.match(source, /unknown\.word\.replace/)
  const escaped = "l(kh".replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  assert.doesNotThrow(() => new RegExp(`(?<![\\p{L}\\p{N}_])${escaped}(?![\\p{L}\\p{N}_])`, "iu"))
})

test("text diff is a client component", () => {
  const source = fs.readFileSync("registry/default/text-diff/text-diff.tsx", "utf8")
  assert.match(source, /^["']use client["']/)
})

test("the guide uses Article JSON-LD with an author name", () => {
  const source = fs.readFileSync("lib/article-metadata.ts", "utf8")
  assert.match(source, /"@type": "Article"/)
  assert.match(source, /name: "Bollard UI"/)
})
