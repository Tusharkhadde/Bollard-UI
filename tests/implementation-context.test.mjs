import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { after, test } from "node:test"
import { fileURLToPath, pathToFileURL } from "node:url"
import { transform } from "esbuild"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const bundle = path.join(path.dirname(fileURLToPath(import.meta.url)), `.implementation-context-${process.pid}.mjs`)
const source = fs.readFileSync(path.join(root, "lib/implementation-context.ts"), "utf8")
const compiled = await transform(source, { loader: "ts", format: "esm", target: "node20" })
fs.writeFileSync(bundle, compiled.code)
const { buildImplementationContext } = await import(`${pathToFileURL(bundle).href}?${Date.now()}`)
after(async () => (await import("node:fs/promises")).rm(bundle, { force: true }))

test("implementation context gives an agent install, actual targets, dependencies, usage, and server boundary", () => {
  const context = buildImplementationContext({
    name: "amount-input",
    title: "Amount Input",
    targets: ["@ui/amount-input.tsx", "@components/amount-input/amount-words.ts"],
    dependencies: ["lucide-react", "motion"],
    registryDependencies: ["@bollard/amount-in-words"],
    usage: 'import { AmountInput } from "@/components/ui/amount-input"\n<AmountInput label="Amount" />',
    propNames: ["label", "value", "typical", "onValueChange"],
    limitations: ["Client-side warning can be bypassed."],
    serverGuidance: "Validate and authorize the payment on the server.",
  })

  for (const expected of [
    "Implementation context: Amount Input (amount-input)",
    "npx shadcn@4.21.0 add @bollard/amount-input",
    "@ui/amount-input.tsx",
    "@components/amount-input/amount-words.ts",
    "lucide-react, motion",
    "@bollard/amount-in-words",
    "AmountInput label=",
    "value, typical",
    "Client-side warning can be bypassed.",
    "Validate and authorize the payment on the server.",
  ]) assert.ok(context.includes(expected), `missing ${expected}`)
})

test("implementation context never includes arbitrary visitor-provided field values", () => {
  const context = buildImplementationContext({ name: "email-input", title: "Email Input", targets: [], dependencies: [], registryDependencies: [], usage: "<EmailInput />", propNames: [] })
  assert.doesNotMatch(context, /api[_-]?key|secret|token/i)
})
