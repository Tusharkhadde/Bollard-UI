import assert from "node:assert/strict"
import { test } from "node:test"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const read = (file) => fs.readFileSync(path.join(root, file), "utf8")

test("hero headline is server-rendered and the demo uses real registry components", () => {
  const hero = read("components/site/landing/home-hero.tsx")
  assert.doesNotMatch(hero, /^"use client"/)
  assert.match(hero, /Catch the mistake before your users make it\./)
  assert.match(hero, /InstallPill name="amount-input"/)
  assert.doesNotMatch(hero, /DISAMBIGUATING_DESCRIPTION|COMPAT|shadcn@4\.21\.0/)

  const demo = read("components/site/landing/hero-demo.tsx")
  for (const component of ["AmountInput", "EmailInput", "AgentActionApprove"]) {
    assert.match(demo, new RegExp(`@/registry/default/.+${component}|${component}.*from "@/registry/default/`))
  }
  assert.match(demo, /locale="en-IN"/)
  assert.match(demo, /currency="INR"/)
  assert.match(demo, /alex@gmial\.con/)
  assert.match(demo, /environment: "prod"/)
})

test("hero demo is calm for assistive tech and reduced motion", () => {
  const demo = read("components/site/landing/hero-demo.tsx")
  // The moving stage is hidden from assistive tech and never announces.
  assert.match(demo, /inert\s+aria-hidden/)
  assert.match(demo, /role="tablist"/)
  assert.match(demo, /tabIndex=\{selected \? 0 : -1\}/)
  assert.match(demo, /useReducedMotion/)
  assert.match(demo, /if \(reduce\) setPlaying\(false\)/)
  assert.match(demo, /visibilitychange/)
})
