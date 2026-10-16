"use client"

import * as React from "react"

import { VersionScrubber, type Version } from "@/registry/default/version-scrubber/version-scrubber"

const start = Date.UTC(2026, 9, 12, 4, 30)
const hour = 3_600_000

const initial: Version[] = [
  { id: "a", author: "Priya", savedAt: start, text: "Refunds are available within 30 days of purchase. Contact support with your order number." },
  { id: "b", author: "Priya", savedAt: start + 2 * hour, label: "Sent to legal", text: "Refunds are available within 30 days of purchase for unused items. Contact support with your order number and a photo of the item." },
  { id: "c", author: "Arjun", savedAt: start + 5 * hour, text: "Refunds are available within 14 days of purchase for unused items. Contact support with your order number." },
  { id: "d", author: "Arjun", savedAt: start + 9 * hour, text: "Refunds are available within 14 days of delivery for unused items in their original packaging. Contact support with your order number." },
  { id: "e", author: "You", savedAt: start + 24 * hour, text: "Refunds are available within 14 days of delivery for unused items in their original packaging. Email support@example.com with your order number." },
]

export function Demo() {
  const [versions, setVersions] = React.useState(initial)
  const current = versions[versions.length - 1]

  const restore = (version: Version) =>
    new Promise<void>((resolve) =>
      setTimeout(() => {
        setVersions((all) => [
          ...all,
          { id: `r${all.length}`, author: "You", savedAt: Number(all[all.length - 1].savedAt) + hour, label: `Restored ${version.label ?? "v" + (all.indexOf(version) + 1)}`, text: version.text },
        ])
        resolve()
      }, 600),
    )

  return <VersionScrubber versions={versions} currentId={current.id} defaultSelectedId="b" onRestore={restore} className="max-w-md" />
}
