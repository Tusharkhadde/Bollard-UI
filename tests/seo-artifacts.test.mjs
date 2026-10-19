import assert from "node:assert/strict"
import { test } from "node:test"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8")

test("publishes crawler and coding-agent discovery artifacts", () => {
  assert.match(read("app/llms.txt/route.ts"), /text\/plain/)
  assert.match(read("app/sitemap.ts"), /GUIDES/)
  assert.match(read("app/layout.tsx"), /application\/ld\+json/)
})

test("makes guides reachable from the site navigation", () => {
  assert.match(read("components/site/top-bar.tsx"), /href: "\/guides"/)
  const sidebar = read("components/site/sidebar.tsx")
  assert.match(sidebar, /href: "\/guides"/)
  assert.equal([...sidebar.matchAll(/href: "\/guides"/g)].length, 1)
})
