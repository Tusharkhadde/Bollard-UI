import assert from "node:assert/strict"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { spawnSync } from "node:child_process"
import { afterEach, test } from "node:test"

const cli = path.resolve("packages/cli/bin/bollard-ui.mjs")
const fixtures = []
function fixture(config) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "bollard-cli-"))
  fixtures.push(dir)
  if (config !== undefined) fs.writeFileSync(path.join(dir, "components.json"), typeof config === "string" ? config : JSON.stringify(config, null, 2))
  return dir
}
function run(command, dir) {
  return spawnSync(process.execPath, [cli, command, "--cwd", dir], { encoding: "utf8" })
}

afterEach(() => {
  for (const dir of fixtures.splice(0)) fs.rmSync(dir, { recursive: true, force: true })
})

test("init adds namespace and preserves unrelated config; repeated init is idempotent", () => {
  const dir = fixture({ style: "new-york", aliases: { ui: "@/components/ui", components: "@/components" }, registries: { "@other": "https://example.com/r/{name}.json" } })
  assert.equal(run("init", dir).status, 0)
  const file = path.join(dir, "components.json")
  const result = JSON.parse(fs.readFileSync(file, "utf8"))
  assert.equal(result.style, "new-york")
  assert.equal(result.registries["@other"], "https://example.com/r/{name}.json")
  assert.equal(result.registries["@bollard"], "https://bollard-ui.vercel.app/r/{name}.json")
  const afterFirst = fs.readFileSync(file, "utf8")
  assert.equal(run("init", dir).status, 0)
  assert.equal(fs.readFileSync(file, "utf8"), afterFirst)
})

test("init refuses to replace a conflicting namespace", () => {
  const dir = fixture({ registries: { "@bollard": "https://other.invalid/r/{name}.json" } })
  assert.equal(run("init", dir).status, 1)
  assert.match(run("init", dir).stderr, /different URL/)
  assert.equal(JSON.parse(fs.readFileSync(path.join(dir, "components.json"), "utf8")).registries["@bollard"], "https://other.invalid/r/{name}.json")
})

test("init gives a shadcn setup hint when components.json is absent", () => {
  const result = run("init", fixture())
  assert.equal(result.status, 1)
  assert.match(result.stderr, /shadcn@4\.21\.0 init/)
})

test("doctor distinguishes missing, valid, conflicting, and malformed configuration", () => {
  assert.match(run("doctor", fixture()).stderr, /No components\.json/)
  const valid = fixture({ aliases: { ui: "@/components/ui", components: "@/components" }, registries: { "@bollard": "https://bollard-ui.vercel.app/r/{name}.json" } })
  assert.equal(run("doctor", valid).status, 0)
  const conflict = fixture({ registries: { "@bollard": "https://other.invalid" } })
  assert.match(run("doctor", conflict).stderr, /different URL/)
  const malformed = fixture("{")
  assert.match(run("doctor", malformed).stderr, /Could not read/)
})
