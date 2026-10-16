"use client"

import { CropGuard, type DetectedBox } from "@/registry/default/crop-guard/crop-guard"

const person = (cx: number, cy: number, skin: string, shirt: string) =>
  `<path d="M${cx - 150} 900 Q${cx - 140} ${cy + 110} ${cx} ${cy + 100} Q${cx + 140} ${cy + 110} ${cx + 150} 900Z" fill="${shirt}"/><circle cx="${cx}" cy="${cy}" r="60" fill="${skin}"/><circle cx="${cx - 20}" cy="${cy - 8}" r="6" fill="#2b1d16"/><circle cx="${cx + 20}" cy="${cy - 8}" r="6" fill="#2b1d16"/><path d="M${cx - 18} ${cy + 22} Q${cx} ${cy + 36} ${cx + 18} ${cy + 22}" stroke="#2b1d16" stroke-width="5" fill="none" stroke-linecap="round"/>`

// A self-contained team photo: two people and a caption, 1200 × 900.
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="900" viewBox="0 0 1200 900"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9cc9e8"/><stop offset="1" stop-color="#f3d9b1"/></linearGradient></defs><rect width="1200" height="900" fill="url(#g)"/><circle cx="1010" cy="150" r="70" fill="#fff3c4"/><path d="M0 640 Q300 560 600 620 T1200 600 V900 H0Z" fill="#7fa77a"/>${person(620, 300, "#c98f6b", "#3d5a80")}${person(840, 330, "#8d5b3e", "#e07a5f")}<text x="630" y="642" font-family="Arial, sans-serif" font-size="40" font-weight="700" fill="#fff" text-anchor="middle">Meet the team</text></svg>`
const src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`

const boxes: DetectedBox[] = [
  { kind: "face", x: 560, y: 240, w: 120, h: 120 },
  { kind: "face", x: 780, y: 270, w: 120, h: 120 },
  { kind: "text", x: 492, y: 610, w: 276, h: 42, label: "Meet the team" },
]

export function Demo() {
  return (
    <CropGuard
      src={src}
      alt="Two teammates smiling outdoors above the caption Meet the team"
      imageWidth={1200}
      imageHeight={900}
      boxes={boxes}
      defaultPreset="story"
      defaultValue={{ x: 420, y: 60, w: 400, h: 711 }}
    />
  )
}
