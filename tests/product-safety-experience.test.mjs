import assert from "node:assert/strict"
import { test } from "node:test"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8")
const registry = () => JSON.parse(read("registry.json"))

test("ships installable starter packs for every flow", () => {
  const items = registry().items
  for (const name of ["fintech-pack", "agent-pack", "danger-zone-pack", "india-pack", "checkout-pack", "signup-login-pack", "account-settings-pack", "forms-pack", "messaging-pack", "devtools-pack", "scheduling-pack"]) {
    const pack = items.find((item) => item.name === name)
    assert.ok(pack, `${name} is missing`)
    assert.ok(pack.registryDependencies?.length, `${name} has no registry dependencies`)
    assert.ok(pack.registryDependencies.every((dependency) => dependency.startsWith("@bollard/")), `${name} must resolve dependencies through the Bollard namespace`)
  }
})

test("keeps the hero comparison, prevention proof, packs, and playground discoverable", () => {
  const home = read("app/(site)/page.tsx")
  assert.match(home, /StarterPacks/)
  assert.match(home, /DisastersPrevented/)
  assert.match(read("components/site/landing/hero-preview.tsx"), /Without Bollard/)
  assert.match(read("components/site/landing/hero-preview.tsx"), /With Bollard/)
  assert.ok(fs.existsSync(path.join(root, "app/(site)/playground/page.tsx")))
})

test("offers prompt copying and all four theme accents", () => {
  const preview = read("components/site/preview-panel.tsx")
  const theme = read("components/site/theme.tsx")
  assert.match(preview, /Copy prompt for v0\/Cursor/)
  assert.match(theme, /AccentMenu/)
  assert.match(theme, /aria-haspopup="menu"/)
  assert.match(theme, /return "indigo"/)
  for (const accent of ["Amber", "Indigo", "Emerald", "Rose"]) assert.match(theme, new RegExp(accent))
})

test("lets developers assemble a custom registry pack with keyboard-operable selection", () => {
  const finder = read("components/site/finder.tsx")
  assert.match(finder, /data-custom-pack/)
  assert.match(finder, /type="checkbox" checked=\{selected\}/)
  assert.match(finder, /@bollard\/\$\{name\}/)
  assert.match(finder, /surface: "custom-pack"/)
})
