"use client"

import { HashtagInput } from "@/registry/default/hashtag-input/hashtag-input"

export function Demo() {
  return (
    <HashtagInput
      label="Tags for your launch post"
      defaultValue={["opensource", "BuildInPublic", "women's day", "OpenSource", "followforfollow", "WebDev"]}
      banned={["followforfollow", "like4like", "f4f"]}
    />
  )
}
