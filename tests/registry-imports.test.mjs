import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"
import { transform } from "esbuild"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const source = fs.readFileSync(path.join(root, "lib/registry-imports.ts"), "utf8")
const compiled = await transform(source, { loader: "ts", format: "esm", target: "node20" })
const helper = await import(`data:text/javascript;base64,${Buffer.from(compiled.code).toString("base64")}`)

test("maps registry component and helper imports to their configured install paths", () => {
  assert.equal(helper.toInstalledImport("@/registry/default/file-guard/file-guard"), "@/components/ui/file-guard")
  assert.equal(helper.toInstalledImport("@/registry/default/file-guard/file-check"), "@/components/file-guard/file-check")
})
