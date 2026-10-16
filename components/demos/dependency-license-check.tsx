"use client"

import * as React from "react"

import { DependencyLicenseCheck, type DependencyInfo } from "@/registry/default/dependency-license-check/dependency-license-check"

const incoming: DependencyInfo[] = [
  { name: "pdf-render-kit", version: "2.4.1", license: "AGPL-3.0-or-later" },
  { name: "fast-kv-cache", version: "8.0.0", license: "SSPL-1.0", previousVersion: "7.4.2", previousLicense: "BSD-3-Clause" },
  { name: "tiny-slug", version: "1.0.3" },
  { name: "date-grid", version: "3.6.0", license: "(MIT OR GPL-3.0-only)" },
  { name: "eslint-plugin-house", version: "0.9.0", license: "GPL-3.0-only", dev: true },
]

export function Demo() {
  const [added, setAdded] = React.useState<string>()
  return (
    <div className="w-full max-w-md space-y-2">
      <DependencyLicenseCheck
        defaultValue={incoming}
        policy={{ project: "proprietary", distribution: "distributed" }}
        onAdd={(deps) => setAdded(deps.map((d) => `${d.name}@${d.version}`).join(", "))}
      />
      {added && <p className="text-xs break-words text-muted-foreground">npm install {added}</p>}
    </div>
  )
}
