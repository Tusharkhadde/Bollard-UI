"use client"

import * as React from "react"

import { DocUploadMatch, type DocGuess, type DocKind } from "@/registry/default/doc-upload-match/doc-upload-match"

const LOCKED_PDF = [
  "%PDF-1.7",
  "1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj",
  "2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj",
  "3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] >> endobj",
  "4 0 obj << /Filter /Standard /V 2 /R 3 /Length 128 /P -1068 >> endobj",
  "trailer << /Root 1 0 R /Encrypt 4 0 R /Size 5 >>",
  "%%EOF",
].join("\n")
const LOCKED = new File([LOCKED_PDF], "EAadhaar_xxxxxxxx1234_14102026.pdf", { type: "application/pdf", lastModified: 0 })

/** Stand-in for an OCR/model call: knows what the demo drew. */
const truth = new WeakMap<File, DocKind>()
const classify = (file: File, _signals: unknown, signal: AbortSignal) =>
  new Promise<DocGuess | null>((resolve) => {
    const timer = setTimeout(() => resolve(truth.has(file) ? { kind: truth.get(file)!, confidence: 0.93 } : null), 700)
    signal.addEventListener("abort", () => clearTimeout(timer))
  })

type Scene = "back" | "blurry" | "screenshot" | "front"
function draw(scene: Scene): Promise<File> {
  const shot = scene === "screenshot"
  const canvas = document.createElement("canvas")
  canvas.width = shot ? 1080 : 1200
  canvas.height = shot ? 2340 : 760
  const ctx = canvas.getContext("2d")!
  ctx.fillStyle = shot ? "#111" : "#f4f1ea"
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  const x = shot ? 240 : 40, y = shot ? 980 : 40, w = shot ? 600 : 1120, h = shot ? 380 : 680, k = w / 1120
  if (scene === "blurry") ctx.filter = "blur(7px)"
  ctx.fillStyle = "#fff"
  ctx.fillRect(x, y, w, h)
  ctx.fillStyle = "#e8792b"
  ctx.fillRect(x, y, w, 90 * k)
  ctx.fillStyle = "#1a1a1a"
  ctx.font = `${44 * k}px sans-serif`
  if (scene === "back") {
    ctx.fillText("Address:", x + 60 * k, y + 200 * k)
    ;["Flat 12, Shree Ram Colony", "Bhosari, Pune 411039", "Maharashtra"].forEach((line, i) => ctx.fillText(line, x + 60 * k, y + (270 + i * 70) * k))
  } else {
    ctx.fillStyle = "#9aa3ad"
    ctx.fillRect(x + 60 * k, y + 150 * k, 240 * k, 300 * k)
    ctx.fillStyle = "#1a1a1a"
    ;["Asha Patil", "DOB: 19/07/1996", "FEMALE"].forEach((line, i) => ctx.fillText(line, x + 360 * k, y + (210 + i * 70) * k))
  }
  ctx.font = `bold ${64 * k}px sans-serif`
  ctx.fillText("XXXX XXXX 1234", x + 300 * k, y + 600 * k)
  const name = shot ? "Screenshot_20261014-101522.png" : "IMG_20261014_101522.jpg"
  return new Promise((resolve) =>
    canvas.toBlob((blob) => {
      const file = new File([blob!], name, { type: shot ? "image/png" : "image/jpeg", lastModified: 0 })
      truth.set(file, scene === "back" ? "aadhaar-back" : "aadhaar-front")
      resolve(file)
    }, shot ? "image/png" : "image/jpeg", 0.9),
  )
}

export function Demo() {
  const [file, setFile] = React.useState<File | null>(LOCKED)
  const [accepted, setAccepted] = React.useState("")
  const scenes: [string, () => void][] = [
    ["Locked e-Aadhaar", () => setFile(LOCKED)],
    ["Back side", () => draw("back").then(setFile)],
    ["Blurry", () => draw("blurry").then(setFile)],
    ["Screenshot", () => draw("screenshot").then(setFile)],
    ["Right one", () => draw("front").then(setFile)],
  ]
  return (
    <div className="grid w-full max-w-md gap-4">
      <DocUploadMatch label="Aadhaar (front)" spec={{ kind: "aadhaar-front" }} value={file} onValueChange={setFile} classify={classify} onAccept={(f) => setAccepted(f.name)} />
      <div className="flex flex-wrap items-center gap-1.5 text-xs">
        <span className="text-muted-foreground">Try:</span>
        {scenes.map(([label, go]) => (
          <button key={label} type="button" onClick={go} className="h-6 rounded-md border px-2 font-medium outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50">
            {label}
          </button>
        ))}
      </div>
      {accepted && <p className="text-xs text-muted-foreground">Submitted {accepted}.</p>}
    </div>
  )
}
