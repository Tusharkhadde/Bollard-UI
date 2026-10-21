import assert from "node:assert/strict"
import { test } from "node:test"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8")

test("publishes focused use-case routes for the three highest-intent safety jobs", () => {
  const useCases = read("lib/use-cases.ts")
  const page = read("app/(site)/use-cases/[slug]/page.tsx")

  for (const slug of ["safe-payments", "danger-zone", "agent-approvals"]) {
    assert.match(useCases, new RegExp(`slug: "${slug}"`))
  }
  assert.match(page, /generateStaticParams/)
  assert.match(page, /InstallCommand/)
})

test("gives users the shadcn namespace setup and tracks pack and use-case intent", () => {
  const setup = read("components/site/registry-setup.tsx")
  const analytics = read("lib/analytics.ts")
  const packs = read("components/site/landing/starter-packs.tsx")
  const paths = read("components/site/landing/use-case-paths.tsx")

  assert.match(setup, /"@bollard"/)
  assert.match(setup, /components\.json/)
  assert.match(setup, /https:\/\/bollard-ui\.vercel\.app\/r\/\{name\}\.json/)
  assert.match(setup, /shadcn@4\.21\.0 list/)
  assert.match(analytics, /bollard_starter_pack_copied/)
  assert.match(analytics, /bollard_use_case_selected/)
  assert.match(packs, /trackStarterPackCopy/)
  assert.match(paths, /trackUseCaseSelected/)
})

test("ships an agent-safety quickstart that documents the approval lifecycle", () => {
  const quickstart = read("app/(site)/(docs)/agent-safety/page.tsx")
  assert.match(quickstart, /Tool request/)
  assert.match(quickstart, /Policy check/)
  assert.match(quickstart, /Human approval/)
  assert.match(quickstart, /Execute and record/)
  assert.match(quickstart, /agent-action-approve/)
})

test("keeps all use-case pages discoverable to crawlers", () => {
  const sitemap = read("app/sitemap.ts")
  assert.match(sitemap, /USE_CASES/)
})

test("includes an explicit trigger for the destructive-action dialog in the runnable example", () => {
  const example = read("examples/safe-saas-flow/safe-transfer-form.tsx")
  assert.match(example, /setDeleteOpen\(true\)/)
  assert.match(example, /open=\{deleteOpen\}/)
})
