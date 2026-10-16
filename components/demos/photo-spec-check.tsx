"use client"

import * as React from "react"

import { cn } from "@/lib/utils"
import { PhotoSpecCheck, type FaceBox } from "@/registry/default/photo-spec-check/photo-spec-check"

const PRESETS = [
  { id: "upsc", label: "UPSC" },
  { id: "nta", label: "JEE Main" },
  { id: "us-visa", label: "US visa" },
]
// Where the demo draws the head, in the original photo's pixels (a real app passes its face detector's box).
const FACE: FaceBox = { x: 500, y: 300, width: 300, height: 390 }

/** Draws a phone-style 1600 × 1200 portrait on a grey wall and saves it as a PNG named .jpg, like a renamed screenshot. */
async function makePhoto(): Promise<File> {
  const c = document.createElement("canvas")
  c.width = 1600
  c.height = 1200
  const ctx = c.getContext("2d") as CanvasRenderingContext2D
  ctx.fillStyle = "#c9ced6"
  ctx.fillRect(0, 0, 1600, 1200)
  ctx.fillStyle = "#3b4a6b"
  ctx.beginPath()
  ctx.ellipse(650, 1150, 380, 300, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = "#c58c62"
  ctx.fillRect(605, 640, 90, 140)
  ctx.beginPath()
  ctx.ellipse(650, 495, 150, 195, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = "#2a1c14"
  ctx.beginPath()
  ctx.ellipse(650, 360, 155, 80, 0, Math.PI, 0)
  ctx.fill()
  // Deterministic sensor grain so the file has a realistic size.
  const img = ctx.getImageData(0, 0, 1600, 1200)
  let seed = 7
  for (let i = 0; i < img.data.length; i += 4) {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff
    const n = (seed % 13) - 6
    img.data[i] += n
    img.data[i + 1] += n
    img.data[i + 2] += n
  }
  ctx.putImageData(img, 0, 0)
  const blob = await new Promise<Blob>((resolve) => c.toBlob((b) => resolve(b as Blob), "image/png"))
  return new File([blob], "IMG_2041.jpg", { type: "image/jpeg" })
}

export function Demo() {
  const [preset, setPreset] = React.useState(PRESETS[0].id)
  const [original, setOriginal] = React.useState<File | null>(null)
  const [file, setFile] = React.useState<File | null>(null)
  React.useEffect(() => {
    let live = true
    makePhoto().then((f) => {
      if (!live) return
      setOriginal(f)
      setFile(f)
    })
    return () => {
      live = false
    }
  }, [])
  const face = React.useCallback((f: File) => (f === original ? FACE : null), [original])
  return (
    <div className="grid w-full max-w-md gap-3">
      <div role="group" aria-label="Photo rules" className="flex flex-wrap gap-1.5">
        {PRESETS.map((p) => (
          <button
            key={p.id}
            type="button"
            aria-pressed={preset === p.id}
            onClick={() => {
              setPreset(p.id)
              setFile(original)
            }}
            className={cn(
              "h-8 rounded-md border px-3 text-xs font-medium outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50",
              preset === p.id ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-accent",
            )}
          >
            {p.label}
          </button>
        ))}
      </div>
      <PhotoSpecCheck key={preset} spec={preset} value={file} onValueChange={setFile} face={face} />
    </div>
  )
}
