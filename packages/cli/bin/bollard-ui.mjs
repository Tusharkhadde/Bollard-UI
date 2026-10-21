#!/usr/bin/env node
import path from "node:path"
import process from "node:process"
import fs from "node:fs"
import os from "node:os"
import { spawnSync } from "node:child_process"
import { readConfig, REGISTRY_URL, withBollardRegistry, writeConfig } from "../lib/components-json.mjs"

const [command, ...args] = process.argv.slice(2)
let cwd = process.cwd()
for (let index = 0; index < args.length; index++) {
  if (args[index] === "--cwd" && args[index + 1]) cwd = path.resolve(args[++index])
}

try {
  if (command === "init") {
    const { file, config } = readConfig(cwd)
    if (!config) throw new Error(`No components.json found in ${cwd}. Run npx shadcn@4.21.0 init first, then run npx bollard-ui init.`)
    const updated = withBollardRegistry(config)
    if (JSON.stringify(config.registries?.["@bollard"]) === JSON.stringify(REGISTRY_URL)) {
      console.log("Bollard registry is already configured.")
    } else {
      writeConfig(file, updated)
      console.log(`Added @bollard registry to ${path.relative(cwd, file)}.`)
    }
    console.log("Install with: npx shadcn@4.21.0 add @bollard/amount-input")
  } else if (command === "doctor") {
    const { config } = readConfig(cwd)
    if (!config) throw new Error(`No components.json found in ${cwd}. Run npx shadcn@4.21.0 init first.`)
    if (config.registries?.["@bollard"] !== REGISTRY_URL) {
      if (config.registries?.["@bollard"]) throw new Error(`@bollard points to a different URL. Expected ${REGISTRY_URL}.`)
      throw new Error(`@bollard is not configured. Run npx bollard-ui init --cwd "${cwd}".`)
    }
    if (typeof config.aliases?.ui !== "string" || typeof config.aliases?.components !== "string") {
      throw new Error("components.json is missing aliases.ui or aliases.components; run shadcn init and check the aliases.")
    }
    const tsconfigPath = path.join(cwd, "tsconfig.json")
    if (fs.existsSync(tsconfigPath)) {
      const tsconfig = fs.readFileSync(tsconfigPath, "utf8")
      const target = tsconfig.match(/\"target\"\s*:\s*\"([^\"]+)\"/i)?.[1]?.toLowerCase()
      const modernTargets = new Set(["es2020", "es2021", "es2022", "es2023", "es2024", "esnext"])
      if (!target || !modernTargets.has(target)) console.warn("Compatibility note: amount-input, cidr-input and epoch-input require TypeScript target ES2020 or newer. See docs/registry-compatibility.md.")
    }
    console.log("Bollard registry configuration looks good.")
    if (args.includes("--smoke")) {
      const temp = fs.mkdtempSync(path.join(os.tmpdir(), "bollard-doctor-"))
      try {
        for (const file of ["components.json", "package.json", "package-lock.json", "tsconfig.json"]) {
          const source = path.join(cwd, file)
          if (fs.existsSync(source)) fs.copyFileSync(source, path.join(temp, file))
        }
        const run = (bin, commandArgs, label) => {
          const result = spawnSync(bin, commandArgs, { cwd: temp, encoding: "utf8", shell: process.platform === "win32", stdio: "inherit" })
          if (result.error || result.status !== 0) throw new Error(`${label} failed${result.error ? `: ${result.error.message}` : ` (exit ${result.status})`}`)
        }
        run(process.platform === "win32" ? "npx.cmd" : "npx", ["shadcn@4.21.0", "add", "@bollard/amount-input", "--yes"], "Smoke install")
        if (fs.existsSync(path.join(temp, "package.json"))) {
          const manifest = JSON.parse(fs.readFileSync(path.join(temp, "package.json"), "utf8"))
          if (manifest.scripts?.typecheck) run(process.platform === "win32" ? "npm.cmd" : "npm", ["run", "typecheck"], "Typecheck")
          else if (manifest.devDependencies?.typescript || manifest.dependencies?.typescript) run(process.platform === "win32" ? "npx.cmd" : "npx", ["--yes", "tsc", "--noEmit"], "Typecheck")
          else console.warn("Typecheck skipped: no TypeScript dependency or typecheck script in package.json.")
          if (manifest.scripts?.lint) run(process.platform === "win32" ? "npm.cmd" : "npm", ["run", "lint"], "Lint")
          else console.warn("Lint skipped: no lint script in package.json.")
        } else {
          console.warn("Typecheck and lint skipped: no package.json was copied from the project.")
        }
        console.log("Bollard smoke install completed in a temporary copy of the project configuration.")
      } finally {
        fs.rmSync(temp, { recursive: true, force: true })
      }
    } else {
      console.log("For a networked install + typecheck/lint smoke test in a temporary directory, run: npx bollard-ui doctor --smoke")
    }
  } else {
    console.log("Usage: npx bollard-ui <init|doctor> [--cwd <project-directory>]")
    if (command) process.exitCode = 2
  }
} catch (error) {
  console.error(error.message)
  process.exitCode = 1
}
