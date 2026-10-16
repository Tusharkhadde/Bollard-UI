"use client"

import * as React from "react"
import { Play } from "lucide-react"

import { EmbedCode } from "@/registry/default/embed-code/embed-code"

const resource = {
  url: "https://media.acme.dev/embed/v/launch-teaser?token=sk_8f2c41e9&autoplay=0",
  privacyUrl: "https://media-nocookie.acme.dev/embed/v/launch-teaser?token=sk_8f2c41e9&autoplay=0",
  title: "Launch teaser (0:42)",
  visibility: "draft" as const,
  exposes: ["Video", "Title", "Channel name", "View count"],
  tracking: ["Sets cookies on load", "Logs the page URL"],
}

export function Demo() {
  return (
    <EmbedCode
      resource={resource}
      defaultValue={{ allowedDomains: ["acme.dev"] }}
      renderPreview={() => (
        <div className="relative grid size-full place-items-center bg-linear-to-br from-zinc-800 to-zinc-950 text-white">
          <span className="grid size-10 place-items-center rounded-full bg-white/15">
            <Play aria-hidden className="size-4 fill-current" />
          </span>
          <span className="absolute bottom-2 left-3 text-xs font-medium text-white/80">{resource.title}</span>
        </div>
      )}
    />
  )
}
