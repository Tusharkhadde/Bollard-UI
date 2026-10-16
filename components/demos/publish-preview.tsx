"use client"

import * as React from "react"

import { PublishPreview, type PublishFix } from "@/registry/default/publish-preview/publish-preview"

const PKG = {
  name: "@acme/upi-sdk",
  version: "1.4.2",
  main: "./dist/index.js",
  types: "./dist/index.d.ts",
  exports: { ".": { types: "./dist/index.d.ts", import: "./dist/index.mjs", require: "./dist/index.js" } },
  scripts: { build: "tsup src/index.ts --dts --sourcemap" },
}
const SOURCE = [
  { path: "package.json", size: 1180 },
  { path: "README.md", size: 6420 },
  { path: "LICENSE", size: 1071 },
  { path: "src/index.ts", size: 8840 },
  { path: "src/collect.ts", size: 5310 },
  { path: "src/__tests__/collect.test.ts", size: 4120 },
  { path: ".env.production", size: 214 },
  { path: ".github/workflows/release.yml", size: 912 },
  { path: "tsconfig.json", size: 402 },
]
const BUILT = [
  { path: "package.json", size: 1180 },
  { path: "README.md", size: 6420 },
  { path: "LICENSE", size: 1071 },
  { path: "dist/index.js", size: 21430 },
  { path: "dist/index.mjs", size: 20980 },
  { path: "dist/index.d.ts", size: 3120 },
  { path: "dist/index.js.map", size: 61240 },
  { path: "dist/index.mjs.map", size: 60870 },
]

export function Demo() {
  const [state, setState] = React.useState({ version: "1.4.2", files: false, noMaps: false })
  const [log, setLog] = React.useState("")
  const list = state.files ? BUILT.filter((f) => !(state.noMaps && f.path.endsWith(".map"))) : SOURCE
  const pack = JSON.stringify([{ name: PKG.name, version: state.version, size: Math.round(list.reduce((n, f) => n + f.size, 0) * 0.31), unpackedSize: list.reduce((n, f) => n + f.size, 0), files: list }])
  const pkg = { ...PKG, version: state.version, ...(state.files && { files: state.noMaps ? ["dist", "!**/*.map"] : ["dist"] }) }

  // Stands in for editing package.json and running `npm pack --dry-run --json` again.
  const onFix = (fix: PublishFix) => {
    setLog(fix.kind === "version" ? `npm version ${fix.to}` : fix.kind === "files" ? `Added "files": ${JSON.stringify(fix.files)}, ran the build` : `Excluded ${fix.patterns.join(", ")}`)
    setTimeout(() => setState((s) => (fix.kind === "version" ? { ...s, version: fix.to } : fix.kind === "files" ? { ...s, files: true } : { ...s, noMaps: true })), 900)
  }

  return (
    <div className="grid w-full max-w-lg gap-2">
      <PublishPreview
        pack={pack}
        pkg={pkg}
        published={["1.4.0", "1.4.1", "1.4.2"]}
        gitignore={"node_modules\n/dist\ncoverage\n"}
        hasNpmignore={false}
        onFix={onFix}
        onPublish={() => new Promise<void>((resolve) => setTimeout(() => (setLog(`+ ${PKG.name}@${state.version}`), resolve()), 900))}
      />
      <p aria-live="polite" className="min-h-4 font-mono text-xs text-muted-foreground [overflow-wrap:anywhere]">{log}</p>
    </div>
  )
}
