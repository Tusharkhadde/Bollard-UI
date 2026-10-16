"use client"

import * as React from "react"

import { ResetPreview, type ResetSetting } from "@/registry/default/reset-preview/reset-preview"

const DEFAULTS: ResetSetting[] = [
  { key: "editor.fontSize", label: "Font size", group: "Editor", value: 15, defaultValue: 14 },
  { key: "editor.tabSize", label: "Tab size", group: "Editor", value: 2, defaultValue: 4 },
  { key: "editor.wordWrap", label: "Word wrap", group: "Editor", value: true, defaultValue: false },
  { key: "editor.minimap", label: "Minimap", group: "Editor", value: true, defaultValue: true },
  { key: "editor.cursor", label: "Cursor style", group: "Editor", value: "line", defaultValue: "line" },
  { key: "theme", label: "Color theme", group: "Appearance", value: "Solarized Dark", defaultValue: "Default Dark" },
  { key: "zoom", label: "Zoom", group: "Appearance", value: "110%", defaultValue: "100%" },
  { key: "sidebar", label: "Sidebar position", group: "Appearance", value: "left", defaultValue: "left" },
]

export function Demo() {
  const [settings, setSettings] = React.useState(DEFAULTS)
  const [exported, setExported] = React.useState<string | null>(null)
  const [run, setRun] = React.useState(0)

  return (
    <div className="w-full max-w-lg space-y-2">
      <ResetPreview
        key={run}
        settings={settings}
        undoFor={8000}
        onExport={(data) => setExported(`Saved ${Object.keys(data).length} customizations to settings-backup.json`)}
        onReset={(keys) =>
          new Promise<void>((resolve) =>
            setTimeout(() => {
              setSettings((all) => all.map((s) => (keys.includes(s.key) ? { ...s, value: s.defaultValue } : s)))
              resolve()
            }, 500),
          )
        }
        onUndo={(previous) => setSettings((all) => all.map((s) => (s.key in previous ? { ...s, value: previous[s.key] } : s)))}
      />
      {exported && <p className="text-center text-xs text-muted-foreground">{exported}</p>}
      <p className="text-center">
        <button
          type="button"
          onClick={() => {
            setSettings(DEFAULTS)
            setExported(null)
            setRun((n) => n + 1)
          }}
          className="inline-flex h-8 items-center rounded-md px-3 text-xs font-medium text-muted-foreground outline-none hover:bg-accent hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          Restore the demo
        </button>
      </p>
    </div>
  )
}
