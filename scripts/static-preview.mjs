// Lightweight alternative to `next dev` for visual checks (next dev gets OOM-killed when several run at once).
// Usage: node scripts/static-preview.mjs <port> <name> [name...]
// Bundles those demos with esbuild + the app's Tailwind CSS and serves /preview/<name>?theme=dark|light
// with the same frame markup as app/preview. Point scripts/check.mjs at the same port.
import fs from "node:fs"
import http from "node:http"
import path from "node:path"
import * as esbuild from "esbuild"
import postcss from "postcss"
import tailwind from "@tailwindcss/postcss"

const [port, ...names] = process.argv.slice(2)
const root = path.resolve(import.meta.dirname, "..")
const out = path.join(root, ".checks", `static-${port}`)
fs.mkdirSync(out, { recursive: true })

const id = (n) => "D" + n.replace(/[^a-z0-9]/gi, "_")
const entry = `import * as React from "react"
import { createRoot } from "react-dom/client"
${names.map((n) => `import { Demo as ${id(n)} } from "@/components/demos/${n}"`).join("\n")}
const demos = { ${names.map((n) => `"${n}": ${id(n)}`).join(", ")} }
const name = location.pathname.split("/").pop()
document.documentElement.classList.toggle("dark", new URLSearchParams(location.search).get("theme") === "dark")
const Demo = demos[name]
createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <main className="flex min-h-dvh items-center justify-center bg-background p-8 text-foreground">
      <div data-preview={name} className="flex w-full max-w-xl justify-center rounded-2xl border bg-card p-8">
        {Demo ? <Demo /> : "unknown demo"}
      </div>
    </main>
  </React.StrictMode>
)`
fs.writeFileSync(path.join(out, "entry.tsx"), entry)

async function build() {
  await esbuild.build({
    entryPoints: [path.join(out, "entry.tsx")], bundle: true, outfile: path.join(out, "app.js"), jsx: "automatic",
    tsconfig: path.join(root, "tsconfig.json"), nodePaths: [path.join(root, "node_modules")],
    define: { "process.env.NODE_ENV": '"development"' }, logLevel: "warning",
  })
  const cssPath = path.join(root, "app/globals.css")
  const css = await postcss([tailwind({ base: root })]).process(fs.readFileSync(cssPath, "utf8"), { from: cssPath })
  fs.writeFileSync(path.join(out, "app.css"), css.css)
}
await build()
const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/app.css"></head><body class="min-h-dvh font-sans"><div id="root"></div><script src="/app.js"></script></body></html>`

http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://x")
  if (url.pathname === "/__rebuild") { try { await build(); res.end("ok") } catch (e) { res.statusCode = 500; res.end(String(e)) } return }
  if (url.pathname === "/app.js" || url.pathname === "/app.css") {
    res.setHeader("content-type", url.pathname.endsWith(".js") ? "text/javascript" : "text/css")
    return res.end(fs.readFileSync(path.join(out, url.pathname.slice(1))))
  }
  if (url.pathname.startsWith("/preview/")) { res.setHeader("content-type", "text/html"); return res.end(html) }
  res.statusCode = 404; res.end()
}).listen(Number(port), () => console.log(`static preview on :${port} for ${names.join(", ")}. GET /__rebuild after edits.`))
