import assert from "node:assert/strict"
import test from "node:test"
import { buildManifest } from "../scripts/build-manifest.mjs"

test("manifest inventories all 341 registry components and the headless hook", () => {
  const manifest = buildManifest(process.cwd())

  assert.equal(manifest.components.length, 341)
  assert.ok(manifest.components.some((component) => component.name === "use-bollard-field"))
  assert.ok(manifest.components.every((component) => component.fields && component.name))
})

test("manifest distinguishes present, missing, and not-applicable fields", () => {
  const manifest = buildManifest(process.cwd())
  const allowed = new Set(["present", "missing", "not-applicable"])

  for (const component of manifest.components) {
    for (const field of Object.values(component.fields)) {
      assert.ok(allowed.has(field.status), `${component.name} has invalid status ${field.status}`)
      if (field.status === "not-applicable") assert.ok(field.reason, `${component.name} must explain N/A`)
    }
  }
})

test("manifest carries coverage totals derived from component records", () => {
  const manifest = buildManifest(process.cwd())

  for (const [field, total] of Object.entries(manifest.totals)) {
    assert.equal(total.present + total.missing + total.notApplicable, manifest.components.length, field)
  }
})
