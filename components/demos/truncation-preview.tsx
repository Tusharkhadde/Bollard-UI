"use client"

import { TruncationPreview } from "@/registry/default/truncation-preview/truncation-preview"

const POST = `We just shipped something we've been building for 8 months.

It started as a weekend hack.

Today it's the fastest way to turn a Figma file into a working React app. Free for students until 31 Oct.

Built with @priya_codes and the whole team, who argued about every pixel so you don't have to. Thank you all. Tell us what breaks, we're listening.

Try it: https://bollard-ui.dev/launch`

export function Demo() {
  return <TruncationPreview label="LinkedIn post" defaultValue={POST} defaultKeyPoint="Free for students" />
}
