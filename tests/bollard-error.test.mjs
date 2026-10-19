import assert from "node:assert/strict"
import { test } from "node:test"
import fs from "node:fs"
import path from "node:path"
import { transform } from "esbuild"
import { fileURLToPath } from "node:url"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const source = fs.readFileSync(path.join(root, "registry/default/use-bollard-field/error.ts"), "utf8")
const compiled = await transform(source, { loader: "ts", format: "esm", target: "node20" })
const errorModule = await import(`data:text/javascript;base64,${Buffer.from(compiled.code).toString("base64")}`)

test("normalizes unknown failures without exposing them as inline copy", () => {
  const cause = new Error("internal request URL contains private details")
  const error = errorModule.toBollardError(cause)

  assert.ok(error instanceof Error)
  assert.equal(error.name, "BollardError")
  assert.equal(error.code, "VALIDATION_FAILED")
  assert.equal(error.retryable, true)
  assert.equal(error.message, "Field validation failed. Try again.")
  assert.equal(error.cause, cause)
})

test("allows an application-safe message and keeps an existing BollardError", () => {
  const cause = new Error("offline")
  const expected = new errorModule.BollardError("Could not check this email.", {
    code: "EMAIL_CHECK_FAILED",
    retryable: true,
    cause,
  })

  assert.equal(errorModule.toBollardError(expected), expected)
  assert.equal(errorModule.toBollardError(cause, "Could not check this email.").message, "Could not check this email.")
})
