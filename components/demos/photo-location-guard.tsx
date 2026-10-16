"use client"

import * as React from "react"

import { PhotoLocationGuard } from "@/registry/default/photo-location-guard/photo-location-guard"

// A tiny little-endian EXIF writer, so the demo can build a real phone-style JPEG
// (GPS, capture time, serial number, embedded preview) without shipping a binary file.
type Value = { type: 1 | 2 | 3 | 4 | 5; data: number[] }
const ascii = (s: string): Value => ({ type: 2, data: [...Array.from(s, (c) => c.charCodeAt(0)), 0] })
const short = (n: number): Value => ({ type: 3, data: [n] })
const long = (n: number): Value => ({ type: 4, data: [n] })
const byte = (n: number): Value => ({ type: 1, data: [n] })
const rational = (...parts: number[]): Value => ({ type: 5, data: parts })
const width = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 4 } as const
const bytesOf = (v: Value) => v.data.length * width[v.type]
const countOf = (v: Value) => (v.type === 5 ? v.data.length / 2 : v.data.length)

function buildExif(ifds: Map<number, Value>[], links: [from: number, tag: number, to: number][], thumbnail: Uint8Array) {
  const sizeOf = (ifd: Map<number, Value>) =>
    6 + ifd.size * 12 + [...ifd.values()].reduce((sum, v) => sum + (bytesOf(v) > 4 ? bytesOf(v) + (bytesOf(v) % 2) : 0), 0)
  for (const [from, tag] of links) ifds[from].set(tag, long(0))
  const offsets = ifds.reduce<number[]>((list, ifd, i) => [...list, i ? list[i - 1] + sizeOf(ifds[i - 1]) : 8], [])
  const thumbAt = offsets[offsets.length - 1] + sizeOf(ifds[ifds.length - 1])
  for (const [from, tag, to] of links) ifds[from].set(tag, long(to < 0 ? thumbAt : offsets[to]))
  const out = new DataView(new ArrayBuffer(thumbAt + thumbnail.length))
  out.setUint16(0, 0x4949)
  out.setUint16(2, 42, true)
  out.setUint32(4, 8, true)
  ifds.forEach((ifd, i) => {
    let at = offsets[i]
    let data = at + 6 + ifd.size * 12
    out.setUint16(at, ifd.size, true)
    at += 2
    for (const [tag, v] of [...ifd.entries()].sort((a, b) => a[0] - b[0])) {
      out.setUint16(at, tag, true)
      out.setUint16(at + 2, v.type, true)
      out.setUint32(at + 4, countOf(v), true)
      let to = at + 8
      if (bytesOf(v) > 4) {
        out.setUint32(at + 8, data, true)
        to = data
        data += bytesOf(v) + (bytesOf(v) % 2)
      }
      v.data.forEach((n, j) => {
        const w = width[v.type]
        if (w === 1) out.setUint8(to + j, n)
        else if (w === 2) out.setUint16(to + j * 2, n, true)
        else out.setUint32(to + j * 4, n, true)
      })
      at += 12
    }
    out.setUint32(at, i === 0 ? offsets[3] : 0, true) // IFD0 → IFD1 (the preview)
  })
  new Uint8Array(out.buffer).set(thumbnail, thumbAt)
  return new Uint8Array(out.buffer)
}

function scene(size: number) {
  const canvas = document.createElement("canvas")
  canvas.width = size
  canvas.height = Math.round(size * 0.75)
  const ctx = canvas.getContext("2d")!
  const { width: w, height: h } = canvas
  const sky = ctx.createLinearGradient(0, 0, 0, h)
  sky.addColorStop(0, "#f59e0b")
  sky.addColorStop(1, "#fde68a")
  ctx.fillStyle = sky
  ctx.fillRect(0, 0, w, h)
  ctx.fillStyle = "#fff7ed"
  ctx.beginPath()
  ctx.arc(w * 0.7, h * 0.45, h * 0.14, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = "#78350f"
  for (const [x, bw, bh] of [[0, 0.18, 0.42], [0.16, 0.14, 0.58], [0.31, 0.2, 0.35], [0.52, 0.12, 0.5], [0.66, 0.2, 0.3], [0.84, 0.16, 0.46]]) {
    ctx.fillRect(x * w, h - bh * h, bw * w, bh * h)
  }
  return new Promise<Uint8Array>((resolve) =>
    canvas.toBlob((blob) => void blob!.arrayBuffer().then((b) => resolve(new Uint8Array(b))), "image/jpeg", 0.85),
  )
}

/** Builds IMG_2041.jpg: a JPEG with GPS (Shivajinagar, Pune), capture time, serial and preview. */
async function makeSamplePhoto() {
  const [photo, thumbnail] = await Promise.all([scene(480), scene(64)])
  const ifd0 = new Map([[0x010f, ascii("Apple")], [0x0110, ascii("iPhone 15 Pro")], [0x0112, short(1)]])
  const exif = new Map([[0x9003, ascii("2026:10:11 07:42:15")], [0x9011, ascii("+05:30")], [0xa431, ascii("F2LXK8Q7MN")]])
  const gps = new Map([
    [1, ascii("N")], [2, rational(18, 1, 31, 1, 5088, 100)],
    [3, ascii("E")], [4, rational(73, 1, 50, 1, 5100, 100)],
    [5, byte(0)], [6, rational(56200, 100)],
  ])
  const ifd1 = new Map([[0x0202, long(thumbnail.length)]])
  const tiff = buildExif([ifd0, exif, gps, ifd1], [[0, 0x8769, 1], [0, 0x8825, 2], [3, 0x0201, -1]], thumbnail)
  const app1 = new Uint8Array(10 + tiff.length)
  app1.set([0xff, 0xe1, (tiff.length + 8) >> 8, (tiff.length + 8) & 0xff, 0x45, 0x78, 0x69, 0x66, 0, 0])
  app1.set(tiff, 10)
  return new File([photo.slice(0, 2), app1, photo.slice(2)], "IMG_2041.jpg", { type: "image/jpeg", lastModified: 1_760_000_000_000 })
}

// Stand-in for a real reverse geocoder: only knows the sample photo's spot.
const placeName = (lat: number, lon: number) => (Math.abs(lat - 18.53) < 0.01 && Math.abs(lon - 73.85) < 0.01 ? "Shivajinagar, Pune" : "")

export function Demo() {
  const [photo, setPhoto] = React.useState<File | null>(null)
  const loaded = React.useRef(false)
  const load = () => void makeSamplePhoto().then(setPhoto)

  React.useEffect(() => {
    if (loaded.current) return
    loaded.current = true
    load()
  }, [])

  return (
    <div className="grid w-full max-w-md gap-3">
      <PhotoLocationGuard label="Add a photo to your post" value={photo} onValueChange={setPhoto} describeLocation={placeName} />
      <button
        type="button"
        onClick={load}
        className="inline-flex h-6 w-fit items-center rounded-md border bg-background px-2 text-xs text-muted-foreground outline-none hover:bg-accent hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        Reload the sample phone photo
      </button>
    </div>
  )
}
