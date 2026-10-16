"use client"

import { GlobInput } from "@/registry/default/glob-input/glob-input"

const files = [
  "package.json",
  "README.md",
  "src/index.ts",
  "src/app.tsx",
  "src/app.test.tsx",
  "src/utils/date.ts",
  "src/utils/date.test.ts",
  "src/components/Button.tsx",
  "src/components/Avatar.tsx",
  "assets/Logo.PNG",
  ".github/workflows/ci.yml",
]

export function Demo() {
  return <GlobInput label="Lint these files" files={files} defaultValue="src/*.{ts,tsx} !**/*.test.*" />
}
