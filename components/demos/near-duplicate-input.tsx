"use client"

import * as React from "react"
import { Tag } from "lucide-react"

import { NearDuplicateInput } from "@/registry/default/near-duplicate-input/near-duplicate-input"

export function Demo() {
  const [tags, setTags] = React.useState(["Marketing", "Q4-Plan", "Design system", "Bugs", "Customer research", "Onboarding"])
  const [picked, setPicked] = React.useState<string>()

  return (
    <div className="grid w-full max-w-sm gap-3">
      <NearDuplicateInput
        label="New tag"
        items={tags}
        defaultValue="marketing "
        onCreate={(name) => {
          setTags((current) => [...current, name])
          setPicked(name)
        }}
        onUseExisting={setPicked}
      />
      <ul aria-label="Tags" className="flex flex-wrap gap-1.5">
        {tags.map((tag) => (
          <li
            key={tag}
            data-picked={tag === picked || undefined}
            className="inline-flex h-6 items-center gap-1 rounded-full border px-2 text-xs text-muted-foreground transition-colors data-picked:border-primary data-picked:bg-primary data-picked:text-primary-foreground"
          >
            <Tag aria-hidden className="size-3" />
            {tag}
          </li>
        ))}
      </ul>
      <p aria-live="polite" className="text-xs text-muted-foreground">
        {picked ? `Tagged with “${picked}”.` : "Try Q4 plan, bug, Desing system or Q3-Plan."}
      </p>
    </div>
  )
}
