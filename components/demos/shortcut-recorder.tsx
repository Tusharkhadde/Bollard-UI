"use client"

import { ShortcutRecorder } from "@/registry/default/shortcut-recorder/shortcut-recorder"

const bindings = [
  { keys: "Mod+K", action: "Open search" },
  { keys: "Mod+Shift+P", action: "Command palette" },
]

export function Demo() {
  // Recorded as Ctrl+Q on Windows: harmless there, but ⌘Q quits the browser on a Mac.
  return <ShortcutRecorder label="Quick add" defaultValue="Mod+Q" bindings={bindings} platform="windows" />
}
