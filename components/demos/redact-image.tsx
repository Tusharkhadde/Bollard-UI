"use client"

import * as React from "react"

import { findSensitiveText, RedactImage, type DetectedWord } from "@/registry/default/redact-image/redact-image"

const LINES: [string, string][] = [
  ["Customer", "Priya Menon"],
  ["Email", "priya.menon@example.com"],
  ["Card", "4111 1111 1111 1111"],
  ["API key", "sk_live_51Hx9QaZ2kT8wV"],
  ["Plan", "Team · ₹799/mo"],
]

/** Draws a fake billing screenshot and records where each word landed, like an OCR engine would. */
function makeScreenshot() {
  const canvas = document.createElement("canvas")
  canvas.width = 640
  canvas.height = 300
  const ctx = canvas.getContext("2d")
  if (!ctx) return null
  ctx.fillStyle = "#f8fafc"
  ctx.fillRect(0, 0, 640, 300)
  ctx.fillStyle = "#0f172a"
  ctx.fillRect(0, 0, 640, 44)
  ctx.font = "600 18px system-ui, sans-serif"
  ctx.fillStyle = "#fff"
  ctx.fillText("Billing · Support ticket #4821", 24, 28)
  const words: DetectedWord[] = []
  LINES.forEach(([key, text], row) => {
    const y = 90 + row * 44
    ctx.font = "15px system-ui, sans-serif"
    ctx.fillStyle = "#64748b"
    ctx.fillText(key, 24, y)
    ctx.font = "500 17px ui-monospace, monospace"
    ctx.fillStyle = "#0f172a"
    let x = 150
    for (const word of text.split(" ")) {
      const width = ctx.measureText(word).width
      ctx.fillText(word, x, y)
      words.push({ text: word, x, y: y - 14, width, height: 18 })
      x += width + ctx.measureText(" ").width
    }
  })
  return { url: canvas.toDataURL("image/png"), words }
}

export function Demo() {
  const [shot, setShot] = React.useState<{ url: string; words: DetectedWord[] } | null>(null)
  React.useEffect(() => setShot(makeScreenshot()), [])
  if (!shot) return <div className="aspect-[32/15] w-full max-w-xl animate-pulse rounded-lg bg-muted" />

  // The email is already covered by hand; the detector catches the card and the live key.
  const email = findSensitiveText(shot.words).find((r) => r.kind === "email")
  return (
    <RedactImage
      src={shot.url}
      alt="Billing screenshot with a customer's email, card number and API key"
      defaultValue={email ? [email] : []}
      detect={() => findSensitiveText(shot.words)}
    />
  )
}
