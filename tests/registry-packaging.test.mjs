import assert from "node:assert/strict"
import fs from "node:fs"
import { test } from "node:test"

const readItem = (name) => JSON.parse(fs.readFileSync(`public/r/${name}.json`, "utf8"))

test("registry payload installs helpers into component-scoped paths and rewrites repository imports", () => {
  for (const [name, helper] of [["file-guard", "file-check.ts"], ["glob-input", "glob.ts"], ["dns-record-guard", "dns-checks.ts"], ["epoch-input", "epoch.ts"]]) {
    const item = readItem(name)
    const helperFile = item.files.find((file) => file.path.endsWith(helper))
    const componentFile = item.files.find((file) => file.path.endsWith(`${name}.tsx`))
    assert.equal(helperFile.target, `@components/${name}/${helper}`)
    assert.equal(componentFile.target, `@ui/${name}.tsx`)
    assert.doesNotMatch(componentFile.content, /@\/registry\/default\//)
    assert.match(componentFile.content, new RegExp(`@/components/${name}/`))
  }
})

test("registry docs include an installable usage snippet and dependency guidance", () => {
  const item = readItem("amount-input")
  assert.equal(item.docs, "https://bollard-ui.vercel.app/components/amount-input")
  assert.match(item.meta.usage, /import \{ AmountInput \}/)
  assert.deepEqual(item.meta.runtimeDependencies, ["@number-flow/react", "lucide-react", "motion"])
  assert.equal(item.meta.zeroRuntimeDependencies, false)
  assert.equal(readItem("file-guard").meta.zeroRuntimeDependencies, false)
  assert.equal(readItem("slug-input").meta.zeroRuntimeDependencies, false)
  assert.equal(readItem("agent-pack").meta.usage, "npx shadcn@4.21.0 add @bollard/agent-pack")
})

test("cross-component imports point at the installed UI target", () => {
  const item = readItem("conflict-banner")
  const component = item.files.find((file) => file.path.endsWith("conflict-banner.tsx"))
  assert.match(component.content, /@\/components\/ui\/text-diff/)
  assert.doesNotMatch(component.content, /@\/registry\/default\//)
})
