import { ImageResponse } from "next/og"

export const size = { width: 180, height: 180 }
export const contentType = "image/png"

export default function AppleIcon() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 38,
        background: "#09090b",
      }}
    >
      <svg width="112" height="112" viewBox="4 4.5 24 24">
        <circle cx="18" cy="19.4" r="5.1" fill="none" stroke="white" strokeWidth="4.3" />
        <path d="M8 26.6V8.4a2.4 2.4 0 0 1 4.8 0v18.2z" fill="white" />
        <rect x="8" y="9.6" width="4.8" height="4.4" fill="#f59e0b" />
      </svg>
    </div>,
    size,
  )
}
