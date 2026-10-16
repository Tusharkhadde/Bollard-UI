"use client"

import { RegexField } from "@/registry/default/regex-field/regex-field"

export function Demo() {
  return (
    <RegexField
      label="Username rule"
      defaultValue="[a-z]+\d+"
      defaultTests={[
        { text: "abc123", expect: "match" },
        { text: "abc123x", expect: "no-match" },
        { text: "ABC", expect: "no-match" },
      ]}
    />
  )
}
