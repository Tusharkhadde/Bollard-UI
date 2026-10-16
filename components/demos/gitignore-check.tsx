"use client"

import { GitignoreCheck } from "@/registry/default/gitignore-check/gitignore-check"

const GITIGNORE = ["node_modules # dependencies", "/dist", "logs/", "!logs/.gitkeep", ".env", ""].join("\n")

const FILES = ["src/index.ts", ".env", ".env.local", "packages/web/dist/app.js", "logs/.gitkeep", "logs/today.log", "node_modules/react/index.js"].join("\n")

export function Demo() {
  return <GitignoreCheck defaultValue={GITIGNORE} defaultFiles={FILES} trackedFiles={[".env"]} />
}
