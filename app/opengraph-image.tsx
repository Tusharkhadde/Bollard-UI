import { ImageResponse } from "next/og"

import registry from "@/registry.json"

export const alt = "Bollard UI: build interfaces your users can't break. Copy-paste React components for shadcn/ui."
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"

const AMBER = "#f59e0b"
const INK = "#0a0a0a"

/** The hazard band as plain polygons (no patterns, so the renderer draws it exactly). */
function Hazard({ width, height }: { width: number; height: number }) {
  const stripe = 28
  const count = Math.ceil(width / stripe) + 4
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <rect width={width} height={height} fill={INK} />
      {Array.from({ length: count }, (_, i) => {
        const x = i * stripe * 2 - height * 2
        return <polygon key={i} points={`${x},${height} ${x + stripe},${height} ${x + stripe + height},0 ${x + height},0`} fill={AMBER} />
      })}
    </svg>
  )
}

function Bollard({ scale = 1, glow = false }: { scale?: number; glow?: boolean }) {
  const w = 64 * scale
  const h = 150 * scale
  return (
    <svg width={w} height={h} viewBox="0 0 64 150">
      {glow && <circle cx="32" cy="52" r="40" fill={AMBER} fillOpacity="0.18" />}
      <ellipse cx="32" cy="142" rx="30" ry="5" fill="#ffffff" fillOpacity="0.08" />
      <path d="M14 138V30a18 18 0 0 1 36 0v108z" fill="#d4d4d4" />
      <path d="M14 138V30a18 18 0 0 1 9 -15.6V138z" fill="#ffffff" fillOpacity="0.25" />
      <path d="M41 138V14.4A18 18 0 0 1 50 30v108z" fill="#000000" fillOpacity="0.3" />
      <rect x="14" y="42" width="36" height="20" fill={AMBER} />
      <rect x="14" y="68" width="36" height="5" fill={AMBER} />
      <rect x="6" y="134" width="52" height="8" rx="3" fill="#a3a3a3" />
    </svg>
  )
}

export default function OpengraphImage() {
  const total = registry.items.length
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: INK, color: "white" }}>
        <Hazard width={1200} height={22} />
        <div style={{ flex: 1, display: "flex", padding: "64px 72px 56px", position: "relative" }}>
          <div
            style={{
              position: "absolute",
              right: -120,
              bottom: -220,
              width: 760,
              height: 520,
              borderRadius: 9999,
              background: "radial-gradient(closest-side, rgba(245,158,11,0.28), rgba(245,158,11,0))",
            }}
          />
          <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 30, color: "#a3a3a3" }}>
              <Bollard scale={0.26} />
              <span style={{ color: "white", fontWeight: 700 }}>Bollard UI</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", marginTop: 40, fontSize: 84, lineHeight: 0.98, fontWeight: 700, letterSpacing: -3 }}>
              <span>Build interfaces</span>
              <span>your users</span>
              <span>can&apos;t break.</span>
            </div>
            <div style={{ display: "flex", marginTop: "auto", fontSize: 30, color: "#a3a3a3", maxWidth: 720, lineHeight: 1.3 }}>
              {`${total} copy-paste React components that catch wrong amounts, leaked secrets and accidental deletes. For shadcn/ui.`}
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 34, paddingBottom: 4 }}>
            <Bollard scale={1.3} />
            <Bollard scale={1.75} />
            <Bollard scale={2.35} glow />
          </div>
        </div>
      </div>
    ),
    size,
  )
}
