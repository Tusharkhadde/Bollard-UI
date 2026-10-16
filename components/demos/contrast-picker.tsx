"use client"

import { ContrastPicker } from "@/registry/default/contrast-picker/contrast-picker"

// #777 on white is 4.478:1. Tools that round print "4.5:1, passes"; WCAG says it fails.
export function Demo() {
  return <ContrastPicker defaultValue={{ foreground: "#777777", background: "#ffffff" }} />
}
