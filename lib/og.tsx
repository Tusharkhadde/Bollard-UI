// Shared pieces for the generated Open Graph images (next/og). Server only: reads the
// Geist TTFs from assets/og at build time.
import { readFile } from "node:fs/promises"
import { join } from "node:path"

export const OG = { AMBER: "#f59e0b", BG: "#09090b", CARD: "#18181b", LINE: "#27272a", MUTED: "#a1a1aa" }
export const ogSize = { width: 1200, height: 630 }

/** The site's logo mark (a b whose stem is a bollard), drawn on a white tile. */
export function OgMark({ size: s = 44 }: { size?: number }) {
  return (
    <div style={{ width: s, height: s, borderRadius: s * 0.24, background: "white", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <svg width={s * 0.82} height={s * 0.82} viewBox="4 4.5 24 24">
        <circle cx="18" cy="19.4" r="5.1" fill="none" stroke={OG.BG} strokeWidth="4.3" />
        <path d="M8 26.6V8.4a2.4 2.4 0 0 1 4.8 0v18.2z" fill={OG.BG} />
        <rect x="8" y="9.6" width="4.8" height="4.4" fill={OG.AMBER} />
        <path d="M8 12.4l2.6-2.8h1.6L8 14zM10.6 14l2.2-2.4v1.7L12.2 14z" fill={OG.BG} />
      </svg>
    </div>
  )
}

/** The amber hazard band along the top edge. */
export function OgHazard({ width, height }: { width: number; height: number }) {
  const stripe = 18
  const count = Math.ceil(width / stripe) + 4
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <rect width={width} height={height} fill={OG.BG} />
      {Array.from({ length: count }, (_, i) => {
        const x = i * stripe * 2 - height * 2
        return <polygon key={i} points={`${x},${height} ${x + stripe},${height} ${x + stripe + height},0 ${x + height},0`} fill={OG.AMBER} />
      })}
    </svg>
  )
}

export async function ogFonts() {
  const dir = join(process.cwd(), "assets/og")
  const [regular, semibold, bold, mono] = await Promise.all([
    readFile(join(dir, "Geist-Regular.ttf")),
    readFile(join(dir, "Geist-SemiBold.ttf")),
    readFile(join(dir, "Geist-Bold.ttf")),
    readFile(join(dir, "GeistMono-Regular.ttf")),
  ])
  return [
    { name: "Geist", data: regular, weight: 400 as const, style: "normal" as const },
    { name: "Geist", data: semibold, weight: 600 as const, style: "normal" as const },
    { name: "Geist", data: bold, weight: 700 as const, style: "normal" as const },
    { name: "Geist Mono", data: mono, weight: 400 as const, style: "normal" as const },
  ]
}

/** Shortens at a word boundary (for image text, where nothing can wrap forever). */
export function clampWords(text: string, max: number) {
  const clean = text.replace(/\s+/g, " ").trim()
  return clean.length <= max ? clean : clean.slice(0, max - 1).replace(/\s+\S*$/, "").replace(/[,;:]$/, "") + "…"
}
