import assert from "node:assert/strict"
import fs from "node:fs"
import http from "node:http"
import os from "node:os"
import path from "node:path"
import { spawn } from "node:child_process"
import { fileURLToPath } from "node:url"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const fixture = fs.mkdtempSync(path.join(os.tmpdir(), "bollard-consumer-"))
const payload = fs.readFileSync(path.join(root, "public/r/file-guard.json"))
const server = http.createServer((request, response) => {
  if (request.url === "/r/file-guard.json") {
    response.writeHead(200, { "content-type": "application/json" })
    response.end(payload)
    return
  }
  response.writeHead(404).end()
})

const run = (exe, args) => new Promise((resolve, reject) => {
  const child = spawn(exe, args, { cwd: fixture })
  let stdout = ""
  let stderr = ""
  child.stdout.setEncoding("utf8").on("data", (chunk) => { stdout += chunk })
  child.stderr.setEncoding("utf8").on("data", (chunk) => { stderr += chunk })
  child.once("error", reject)
  child.once("exit", (code) => code === 0 ? resolve() : reject(new Error(`${exe} ${args.join(" ")} failed:\n${stdout}\n${stderr}`)))
})

try {
  await new Promise((resolve, reject) => server.listen(0, "127.0.0.1", (error) => error ? reject(error) : resolve()))
  const { port } = server.address()
  fs.writeFileSync(path.join(fixture, "package.json"), JSON.stringify({
    name: "bollard-consumer-smoke",
    private: true,
    dependencies: { react: "^19.3.0", "react-dom": "^19.3.0", "lucide-react": "^1.55.0", clsx: "^2.1.1", "tailwind-merge": "^3.7.0" },
    devDependencies: { typescript: "^5.9.3", "@types/react": "^19.3.0", "@types/react-dom": "^19.3.0" },
  }, null, 2))
  fs.writeFileSync(path.join(fixture, "components.json"), JSON.stringify({
    $schema: "https://ui.shadcn.com/schema.json",
    style: "new-york",
    rsc: true,
    tsx: true,
    tailwind: { config: "", css: "src/app/globals.css", baseColor: "neutral", cssVariables: true },
    aliases: { components: "@/components", utils: "@/lib/utils", ui: "@/components/ui", lib: "@/lib", hooks: "@/hooks" },
    registries: { "@bollard": `http://127.0.0.1:${port}/r/{name}.json` },
  }, null, 2))
  fs.mkdirSync(path.join(fixture, "src/app"), { recursive: true })
  fs.writeFileSync(path.join(fixture, "src/app/globals.css"), '@import "tailwindcss";\n')
  fs.writeFileSync(path.join(fixture, "tsconfig.json"), JSON.stringify({
    compilerOptions: { target: "ES2020", lib: ["dom", "dom.iterable", "es2020"], jsx: "react-jsx", module: "esnext", moduleResolution: "bundler", strict: true, skipLibCheck: true, baseUrl: ".", paths: { "@/*": ["./*"] }, noEmit: true },
    include: ["components/**/*.ts", "components/**/*.tsx", "lib/**/*.ts", "smoke.tsx"],
  }, null, 2))
  fs.mkdirSync(path.join(fixture, "lib"), { recursive: true })
  fs.writeFileSync(path.join(fixture, "lib/utils.ts"), 'import { clsx, type ClassValue } from "clsx"\nimport { twMerge } from "tailwind-merge"\nexport function cn(...inputs: ClassValue[]) { return twMerge(clsx(inputs)) }\n')
  fs.writeFileSync(path.join(fixture, "smoke.tsx"), 'import { FileGuard } from "@/components/ui/file-guard"\nexport const Smoke = () => <FileGuard />\n')
  fs.symlinkSync(path.join(root, "node_modules"), path.join(fixture, "node_modules"), "junction")

  await run(process.execPath, [path.join(root, "node_modules/shadcn/dist/index.js"), "add", "@bollard/file-guard", "--yes", "--cwd", fixture])
  assert.ok(fs.existsSync(path.join(fixture, "components/ui/file-guard.tsx")), "component wasn't installed at the configured ui alias")
  assert.ok(fs.existsSync(path.join(fixture, "components/file-guard/file-check.ts")), "helper wasn't installed at its component-scoped target")
  await run(process.execPath, [path.join(root, "node_modules/typescript/bin/tsc"), "--noEmit", "--project", path.join(fixture, "tsconfig.json")])
  console.log("Consumer smoke passed: shadcn install, helper targets and strict TypeScript resolution in a temporary app.")
} finally {
  await new Promise((resolve) => server.close(resolve))
  fs.rmSync(fixture, { recursive: true, force: true })
}
