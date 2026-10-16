"use client"

import { VersionBump } from "@/registry/default/version-bump/version-bump"

export function Demo() {
  return (
    <VersionBump
      current="1.4.2"
      defaultValue="minor"
      changes={["feat!: drop Node 16 support", "feat(cli): add --json output", "fix: retry uploads on 429", "docs: fix typo in README"]}
    />
  )
}
