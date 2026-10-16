import { readFile } from "node:fs/promises"
import { join } from "node:path"
import { ImageResponse } from "next/og"

import registry from "@/registry.json"

export const alt = "Bollard UI: build interfaces your users can't break. Copy-paste React components for shadcn/ui."
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"

const AMBER = "#f59e0b"
const BG = "#09090b"
const CARD = "#18181b"
const LINE = "#27272a"
const MUTED = "#a1a1aa"

/** The site's logo mark (a b whose stem is a bollard), drawn on a white tile. */
function Mark({ size: s = 44 }: { size?: number }) {
  return (
    <div style={{ width: s, height: s, borderRadius: s * 0.24, background: "white", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <svg width={s * 0.82} height={s * 0.82} viewBox="4 4.5 24 24">
        <circle cx="18" cy="19.4" r="5.1" fill="none" stroke={BG} strokeWidth="4.3" />
        <path d="M8 26.6V8.4a2.4 2.4 0 0 1 4.8 0v18.2z" fill={BG} />
        <rect x="8" y="9.6" width="4.8" height="4.4" fill={AMBER} />
        <path d="M8 12.4l2.6-2.8h1.6L8 14zM10.6 14l2.2-2.4v1.7L12.2 14z" fill={BG} />
      </svg>
    </div>
  )
}

function Hazard({ width, height }: { width: number; height: number }) {
  const stripe = 18
  const count = Math.ceil(width / stripe) + 4
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <rect width={width} height={height} fill={BG} />
      {Array.from({ length: count }, (_, i) => {
        const x = i * stripe * 2 - height * 2
        return <polygon key={i} points={`${x},${height} ${x + stripe},${height} ${x + stripe + height},0 ${x + height},0`} fill={AMBER} />
      })}
    </svg>
  )
}

function Warn() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={AMBER} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
      <path d="M12 9v4M12 17h.01" />
    </svg>
  )
}

export default async function OpengraphImage() {
  const total = registry.items.length
  const dir = join(process.cwd(), "assets/og")
  const [regular, semibold, bold, mono] = await Promise.all([
    readFile(join(dir, "Geist-Regular.ttf")),
    readFile(join(dir, "Geist-SemiBold.ttf")),
    readFile(join(dir, "Geist-Bold.ttf")),
    readFile(join(dir, "GeistMono-Regular.ttf")),
  ])

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: BG,
          color: "white",
          fontFamily: "Geist",
          backgroundImage: "linear-gradient(rgba(255,255,255,0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.035) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      >
        <Hazard width={1200} height={10} />
        <div style={{ flex: 1, display: "flex", padding: "56px 64px 52px 72px" }}>
          {/* Left: brand, promise, install line */}
          <div style={{ display: "flex", flexDirection: "column", width: 560 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <Mark />
              <span style={{ fontSize: 32, fontWeight: 600, letterSpacing: -0.5 }}>Bollard UI</span>
              <span style={{ marginLeft: 6, fontSize: 18, color: MUTED, border: `1px solid ${LINE}`, borderRadius: 999, padding: "5px 14px" }}>for shadcn/ui</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", marginTop: 44, fontSize: 70, lineHeight: 1.02, fontWeight: 700, letterSpacing: -2.6 }}>
              <span>Build interfaces</span>
              <span>your users</span>
              <span style={{ color: AMBER }}>can&apos;t break.</span>
            </div>
            <div style={{ display: "flex", marginTop: 26, fontSize: 25, color: MUTED, lineHeight: 1.38 }}>
              {`${total} React components that catch wrong amounts, leaked secrets and accidental deletes.`}
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: "auto" }}>
              {["Open source", "MIT", "React 19", "Tailwind v4"].map((t) => (
                <span key={t} style={{ fontSize: 18, color: MUTED, background: CARD, border: `1px solid ${LINE}`, borderRadius: 999, padding: "7px 16px" }}>
                  {t}
                </span>
              ))}
            </div>
          </div>

          {/* Right: two real-looking components catching a mistake */}
          <div style={{ flex: 1, display: "flex", position: "relative" }}>
            {/* back card: email typo */}
            <div
              style={{
                position: "absolute",
                top: 10,
                right: 0,
                width: 400,
                display: "flex",
                flexDirection: "column",
                background: CARD,
                border: `1px solid ${LINE}`,
                borderRadius: 18,
                padding: "22px 24px",
                transform: "rotate(3deg)",
                opacity: 0.92,
              }}
            >
              <span style={{ fontSize: 17, color: MUTED }}>Email</span>
              <div style={{ display: "flex", marginTop: 10, fontSize: 22, border: `1px solid ${LINE}`, borderRadius: 10, padding: "11px 14px", background: BG }}>
                alex@gmial.com
              </div>
              <div style={{ display: "flex", marginTop: 12, fontSize: 19, color: MUTED }}>
                Did you mean<span style={{ color: "white", fontWeight: 600, marginLeft: 7, textDecoration: "underline" }}>gmail.com</span>?
              </div>
            </div>

            {/* front card: amount 10x too big */}
            <div
              style={{
                position: "absolute",
                left: 24,
                bottom: 0,
                width: 450,
                display: "flex",
                flexDirection: "column",
                background: CARD,
                border: `1px solid ${LINE}`,
                borderRadius: 20,
                padding: "26px 28px",
                boxShadow: "0 30px 60px rgba(0,0,0,0.6)",
                transform: "rotate(-2deg)",
              }}
            >
              <span style={{ fontSize: 18, color: MUTED }}>Send to Rahul</span>
              <div
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  marginTop: 12,
                  border: `2px solid ${AMBER}`,
                  borderRadius: 12,
                  padding: "12px 16px",
                  background: BG,
                }}
              >
                <span style={{ fontSize: 26, color: MUTED }}>₹</span>
                <span style={{ fontSize: 38, fontWeight: 600, marginLeft: 10, letterSpacing: -1 }}>5,00,000</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 14, fontSize: 19, color: "#fcd34d" }}>
                <Warn />
                <span>10× what you usually send. Extra zero?</span>
              </div>
              <div style={{ display: "flex", gap: 12, marginTop: 20 }}>
                <div style={{ display: "flex", flex: 1, justifyContent: "center", background: "white", color: BG, fontSize: 19, fontWeight: 600, borderRadius: 10, padding: "11px 0" }}>
                  Fix to ₹50,000
                </div>
                <div style={{ display: "flex", flex: 1, justifyContent: "center", border: `1px solid ${LINE}`, color: MUTED, fontSize: 19, borderRadius: 10, padding: "11px 0" }}>
                  Send anyway
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Geist", data: regular, weight: 400, style: "normal" },
        { name: "Geist", data: semibold, weight: 600, style: "normal" },
        { name: "Geist", data: bold, weight: 700, style: "normal" },
        { name: "Geist Mono", data: mono, weight: 400, style: "normal" },
      ],
    },
  )
}
