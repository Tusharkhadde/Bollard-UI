"use client"

import * as React from "react"

import { AltTextCheck, type AltImage } from "@/registry/default/alt-text-check/alt-text-check"

const svg = (body: string) => `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 56 56">${body}</svg>`)}`

const images: AltImage[] = [
  {
    id: "fort",
    filename: "IMG_2041.jpg",
    alt: "IMG_2041.jpg",
    src: svg('<rect width="56" height="56" fill="#7dd3fc"/><path d="M0 44 18 24l10 10 8-8 20 18v12H0z" fill="#166534"/><circle cx="42" cy="14" r="6" fill="#fde047"/>'),
  },
  {
    id: "shot",
    filename: "Screenshot 2026-10-13 at 09.41.png",
    alt: "",
    src: svg('<rect width="56" height="56" fill="#f4f4f5"/><rect x="6" y="8" width="44" height="6" rx="2" fill="#a1a1aa"/><rect x="6" y="20" width="32" height="4" rx="2" fill="#d4d4d8"/><rect x="6" y="28" width="38" height="4" rx="2" fill="#d4d4d8"/><rect x="6" y="40" width="18" height="8" rx="2" fill="#3b82f6"/>'),
  },
  {
    id: "team",
    filename: "team-offsite.jpg",
    alt: "Image of the team at the top of Sinhagad fort at sunrise",
    src: svg('<rect width="56" height="56" fill="#fdba74"/><circle cx="28" cy="40" r="18" fill="#fb923c"/><g fill="#3f3f46"><circle cx="16" cy="30" r="4"/><circle cx="28" cy="28" r="4"/><circle cx="40" cy="30" r="4"/><rect x="12" y="34" width="8" height="22"/><rect x="24" y="32" width="8" height="24"/><rect x="36" y="34" width="8" height="22"/></g>'),
  },
  {
    id: "wave",
    filename: "divider-wave.svg",
    alt: "",
    decorative: true,
    src: svg('<rect width="56" height="56" fill="#ede9fe"/><path d="M0 30q14-12 28 0t28 0v26H0z" fill="#8b5cf6"/>'),
  },
]

export function Demo() {
  const [posted, setPosted] = React.useState(false)
  return (
    <div className="w-full max-w-md space-y-2">
      <AltTextCheck defaultValue={images} onPost={() => setPosted(true)} />
      {posted && <p className="text-xs text-muted-foreground">Posted.</p>}
    </div>
  )
}
