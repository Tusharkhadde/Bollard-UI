"use client"

import { CacheControlInput } from "@/registry/default/cache-control-input/cache-control-input"

const accountPage = [
  "Cache-Control: private, max-age=0",
  "CDN-Cache-Control: public, max-age=600",
  "Content-Type: text/html; charset=utf-8",
  "Content-Encoding: br",
].join("\n")

export function Demo() {
  return <CacheControlInput defaultValue={accountPage} defaultPath="/account" defaultPersonalized now={Date.UTC(2026, 9, 14)} />
}
