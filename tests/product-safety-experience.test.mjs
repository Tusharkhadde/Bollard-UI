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

test("keeps the comparison, packs, playground and moved proof discoverable", () => {
  const home = read("app/(site)/page.tsx")
  for (const section of ["HomeHero", "TrustStrip", "PlaygroundSection", "WithoutWith", "FlowCards", "StarterPacks", "HowItWorks", "Faq", "Cta"]) {
    assert.match(home, new RegExp(`<${section}\\b`))
  }
  // The homepage no longer shows a screenshot of itself.
  assert.doesNotMatch(home, /SitePreview|website-preview/)
  const comparison = read("components/site/landing/without-with.tsx")
  assert.match(comparison, /Without Bollard/)
  assert.match(comparison, /With Bollard/)
  // The fictional scenarios, comparison, facts and About paragraph moved to /about.
  const about = read("app/(site)/(docs)/about/page.tsx")
  for (const part of ["DisastersList", "WhyNotList", "FactsTable", "AboutPage"]) assert.match(about, new RegExp(part))
  assert.ok(fs.existsSync(path.join(root, "app/(site)/playground/page.tsx")))
  assert.match(read("components/site/landing/playground-section.tsx"), /href|BreakIt/)
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
