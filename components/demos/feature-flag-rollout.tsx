"use client"

import { FeatureFlagRollout, type RolloutValue } from "@/registry/default/feature-flag-rollout/feature-flag-rollout"

const environments = [
  { id: "staging", name: "Staging", users: 180 },
  { id: "production", name: "Production", users: 12_400, production: true },
]
const segments = [
  { id: "staff", label: "Internal staff", users: 42 },
  { id: "beta", label: "Beta testers", users: 310 },
]
const saved: RolloutValue = {
  staging: { percent: 25, segments: ["staff"] },
  production: { percent: 10, segments: ["staff"] },
}
const draft: RolloutValue = { ...saved, production: { percent: 100, segments: ["staff"] } }

export function Demo() {
  return <FeatureFlagRollout environments={environments} segments={segments} defaultValue={saved} defaultDraft={draft} />
}
