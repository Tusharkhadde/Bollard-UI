"use client"

import { PackageNameCheck, type PackageInfo } from "@/registry/default/package-name-check/package-name-check"

// A stand-in for a registry call (registry.npmjs.org/<name>), so the demo is deterministic.
const REGISTRY: Record<string, PackageInfo> = {
  react: { exists: true, downloads: 40_000_000, created: "2011-10-26" },
  "express-session-redis-store": { exists: false },
}
const lookup = (name: string) => new Promise<PackageInfo | null>((resolve) => setTimeout(() => resolve(REGISTRY[name] ?? null), 400))

export function Demo() {
  return <PackageNameCheck defaultValue="npm install loadsh crossenv react@^19 express-session-redis-store" lookup={lookup} now={Date.UTC(2026, 9, 14)} />
}
