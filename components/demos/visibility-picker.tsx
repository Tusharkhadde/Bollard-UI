"use client"

import { VisibilityPicker, type VisibilityOption } from "@/registry/default/visibility-picker/visibility-picker"

const options: VisibilityOption[] = [
  { value: "private", label: "Private", risk: 0, reach: 1, audience: "only you" },
  { value: "team", label: "Design team", risk: 1, reach: 12, audience: "12 people in Design" },
  { value: "company", label: "Everyone at Acme", risk: 1, reach: 59, audience: "59 people at Acme" },
  {
    value: "link",
    label: "Anyone with the link",
    risk: 2,
    audience: "anyone who gets the link",
    description: "No sign-in needed",
    consequence: "Links get forwarded, pasted in chats and screenshotted.",
  },
  {
    value: "public",
    label: "Public on the web",
    risk: 3,
    audience: "anyone on the internet",
    consequence: "Search engines can index it and copies may outlive a later change.",
    disabledReason: "Your admin turned off public sharing",
  },
]

// Pretend save: the link level is refused by the server once, to show the rollback.
let refusedOnce = false
const save = (value: string) =>
  new Promise<void>((resolve, reject) =>
    setTimeout(() => {
      if (value === "link" && !refusedOnce) {
        refusedOnce = true
        reject(new Error("Sharing service unavailable"))
      } else resolve()
    }, 700),
  )

export function Demo() {
  return <VisibilityPicker options={options} defaultValue="team" resourceName="Q3 roadmap" onValueChange={save} />
}
