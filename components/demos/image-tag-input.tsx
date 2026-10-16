"use client"

import * as React from "react"

import { ImageTagInput } from "@/registry/default/image-tag-input/image-tag-input"

// Stands in for a registry lookup (e.g. HEAD /v2/<name>/manifests/<tag>).
const resolveDigest = () => new Promise<string>((resolve) => setTimeout(() => resolve("sha256:3f1a9c0e7b2d4a6f8e1c5b9d0a7e3f2c4b6d8a0e1f3c5b7d9a2e4f6c8b0d1a3e"), 600))

export function Demo() {
  return (
    <div className="grid w-full max-w-md gap-6">
      <ImageTagInput label="API image" production platform="linux/amd64" privateRegistry="ghcr.io/acme" defaultValue="acme/api:latest" tags={["1.4.2", "1.4.1"]} resolveDigest={resolveDigest} />
      <ImageTagInput label="Sidecar image" production platform="linux/amd64" defaultValue="gchr.io/acme/proxy:2.1.0-arm64" />
    </div>
  )
}
