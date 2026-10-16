"use client"

import { CHAR_TARGETS, CharBudget } from "@/registry/default/char-budget/char-budget"

export function Demo() {
  return (
    <CharBudget
      label="Launch announcement"
      defaultValue={"Bollard UI is live! Components that stop users from making mistakes — undo toasts, hold-to-confirm, and more. It’s free & open source… try it today 🚀 https://bollard-ui.dev"}
      targets={[
        CHAR_TARGETS.x,
        CHAR_TARGETS.sms,
        CHAR_TARGETS.meta,
        { kind: "graphemes", label: "Push notification", limit: 110 },
      ]}
    />
  )
}
