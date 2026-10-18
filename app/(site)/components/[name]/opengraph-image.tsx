import { ImageResponse } from "next/og"

import { catalog } from "@/lib/catalog"
import { OG, OgHazard, OgMark, clampWords, ogFonts, ogSize } from "@/lib/og"

export const size = ogSize
export const contentType = "image/png"
export const alt = "A Bollard UI component and the mistake it stops"

export function generateStaticParams() {
  return catalog.filter((item) => item.essential).map((item) => ({ name: item.name }))
}

/** Per-component card: brand, component name, its "Stops" line, the summary, and where it lives. */
export default async function ComponentOgImage({ params }: { params: Promise<{ name: string }> }) {
  const { name } = await params
  const item = catalog.find((entry) => entry.name === name)
  const title = item?.title ?? "Bollard UI"
  const stops = clampWords(item?.stops ?? item?.headline ?? "Catches the mistake before your users make it", 120)
  const summary = item?.summary ? clampWords(item.summary, 150) : null
  const titleSize = title.length > 26 ? 66 : title.length > 18 ? 78 : 92

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: OG.BG,
          color: "white",
          fontFamily: "Geist",
          backgroundImage: "linear-gradient(rgba(255,255,255,0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.035) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      >
        <OgHazard width={1200} height={10} />
        <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "56px 72px 52px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <OgMark />
            <span style={{ fontSize: 30, fontWeight: 600, letterSpacing: -0.5 }}>Bollard UI</span>
            {item && (
              <span style={{ marginLeft: 6, fontSize: 18, color: OG.MUTED, border: `1px solid ${OG.LINE}`, borderRadius: 999, padding: "5px 14px" }}>
                {item.category}
              </span>
            )}
          </div>
          <div style={{ display: "flex", marginTop: 64, fontSize: titleSize, lineHeight: 1.02, fontWeight: 700, letterSpacing: -2.6 }}>{title}</div>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 18, marginTop: 34 }}>
            <span
              style={{
                display: "flex",
                flexShrink: 0,
                marginTop: 6,
                fontFamily: "Geist Mono",
                fontSize: 17,
                letterSpacing: 2,
                color: "#fcd34d",
                border: `1px solid rgba(245,158,11,0.5)`,
                background: "rgba(245,158,11,0.12)",
                borderRadius: 8,
                padding: "4px 10px",
              }}
            >
              STOPS
            </span>
            <span style={{ display: "flex", fontSize: 34, lineHeight: 1.3, color: "#e4e4e7", maxWidth: 920 }}>{stops}</span>
          </div>
          {summary && <div style={{ display: "flex", marginTop: 26, fontSize: 25, lineHeight: 1.45, color: OG.MUTED, maxWidth: 980 }}>{summary}</div>}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "auto" }}>
            <span style={{ fontFamily: "Geist Mono", fontSize: 21, color: OG.MUTED }}>{`bollard-ui.vercel.app/components/${name}`}</span>
            <span style={{ fontSize: 19, color: OG.MUTED }}>Copy-paste React · shadcn/ui · MIT</span>
          </div>
        </div>
      </div>
    ),
    { ...size, fonts: await ogFonts() },
  )
}
