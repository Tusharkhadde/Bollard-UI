"use client"

import * as React from "react"
import { Check } from "lucide-react"

import { HiddenContentCheck, type HiddenFinding } from "@/registry/default/hidden-content-check/hidden-content-check"

// A freedom-of-information reply built the way the PSNI one was (ICO fine, 2024): a summary table on
// screen, the raw HR export it was made from still sitting in a hidden tab. Everything is fictional.
const SURNAMES = ["Adair", "Boyle", "Campbell", "Doherty", "Ellis", "Fitzpatrick", "Graham", "Hughes", "Irvine", "Kerr", "Lynch", "McCann", "Nolan", "O'Neill", "Quinn", "Reid"]
const RANKS = ["Constable", "Sergeant", "Inspector", "Staff officer"]
const UNITS = ["Response", "Neighbourhood", "Intelligence", "Surveillance", "Custody"]
const STATIONS = ["Lisburn", "Newry", "Omagh", "Coleraine", "Armagh"]

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;")
const cell = (v: string) => `<c t="inlineStr"><is><t>${esc(v)}</t></is></c>`
const row = (cells: string[]) => `<row>${cells.map(cell).join("")}</row>`
const sheet = (rows: string) => `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${rows}</sheetData></worksheet>`

function staffExport() {
  const rows = [row(["Surname", "Initial", "Rank", "Unit", "Station", "Service no."])]
  for (let i = 0; i < 9482; i++) {
    rows.push(row([SURNAMES[i % 16], String.fromCharCode(65 + ((i * 7) % 26)), RANKS[i % 4], UNITS[(i >> 2) % 5], STATIONS[(i >> 3) % 5], String(10200 + i * 3)]))
  }
  return rows.join("")
}

const CRC = Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})
const crc32 = (b: Uint8Array) => {
  let c = 0xffffffff
  for (const x of b) c = CRC[(c ^ x) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

/** A stored (uncompressed) zip: enough to make a real .xlsx Excel opens. */
function zip(files: Record<string, string>) {
  const enc = new TextEncoder()
  const local: Uint8Array[] = []
  const central: Uint8Array[] = []
  let offset = 0
  for (const [name, body] of Object.entries(files)) {
    const n = enc.encode(name)
    const data = enc.encode(body)
    const crc = crc32(data)
    const head = new Uint8Array(30 + n.length)
    const h = new DataView(head.buffer)
    h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint32(14, crc, true)
    h.setUint32(18, data.length, true); h.setUint32(22, data.length, true); h.setUint16(26, n.length, true); head.set(n, 30)
    const dir = new Uint8Array(46 + n.length)
    const d = new DataView(dir.buffer)
    d.setUint32(0, 0x02014b50, true); d.setUint16(4, 20, true); d.setUint16(6, 20, true); d.setUint32(16, crc, true)
    d.setUint32(20, data.length, true); d.setUint32(24, data.length, true); d.setUint16(28, n.length, true); d.setUint32(42, offset, true); dir.set(n, 46)
    local.push(head, data)
    central.push(dir)
    offset += head.length + data.length
  }
  const size = central.reduce((a, b) => a + b.length, 0)
  const end = new Uint8Array(22)
  const e = new DataView(end.buffer)
  const count = Object.keys(files).length
  e.setUint32(0, 0x06054b50, true); e.setUint16(8, count, true); e.setUint16(10, count, true); e.setUint32(12, size, true); e.setUint32(16, offset, true)
  return new Blob([...local, ...central, end] as BlobPart[], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" })
}

type Parts = { exportTab: boolean; comment: boolean; author: boolean }
const NAME = "FOI-2023-0841 reply.xlsx"

function build({ exportTab, comment, author }: Parts) {
  const ns = 'xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"'
  const files: Record<string, string> = {
    "[Content_Types].xml": '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/></Types>',
    "_rels/.rels": '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
    "xl/workbook.xml": `<workbook ${ns}><sheets><sheet name="Summary" sheetId="1" r:id="rId1"/>${exportTab ? '<sheet name="SAP export" sheetId="2" state="hidden" r:id="rId2"/>' : ""}</sheets></workbook>`,
    "xl/_rels/workbook.xml.rels": `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>${exportTab ? '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/>' : ""}</Relationships>`,
    "xl/worksheets/sheet1.xml": sheet([row(["Rank", "Headcount"]), row(["Constable", "6,914"]), row(["Sergeant", "1,412"]), row(["Inspector and above", "1,157"])].join("")),
  }
  if (exportTab) files["xl/worksheets/sheet2.xml"] = sheet(staffExport())
  if (comment) files["xl/comments1.xml"] = '<comments xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><commentList><comment ref="B2" authorId="0"><text><t>Pulled from SAP, delete the export tab before it goes out. J</t></text></comment></commentList></comments>'
  if (author) files["docProps/core.xml"] = '<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:creator>J. Morrow</dc:creator><cp:lastModifiedBy>FOI Unit</cp:lastModifiedBy></cp:coreProperties>'
  return new File([zip(files)], NAME, { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" })
}

export function Demo() {
  const [file, setFile] = React.useState<File | null>(null)
  const parts = React.useRef<Parts>({ exportTab: true, comment: true, author: true })
  const [shared, setShared] = React.useState(false)

  // Built after mount: a real 9,483-row workbook, made in the browser.
  React.useEffect(() => setFile(build(parts.current)), [])

  const remove = async (f: HiddenFinding) => {
    await new Promise((r) => setTimeout(r, 500))
    const key = f.kind === "hidden-sheet" ? "exportTab" : f.kind === "comments" ? "comment" : f.kind === "author" ? "author" : null
    if (key) parts.current = { ...parts.current, [key]: false }
    return build(parts.current)
  }

  return (
    <div className="grid w-full max-w-md gap-3">
      <div className="grid gap-0.5">
        <p className="text-sm font-medium">Reply to FOI request #0841</p>
        <p className="text-xs text-muted-foreground">“How many officers hold each rank?” · published on WhatDoTheyKnow</p>
      </div>
      {shared ? (
        <p role="status" className="flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-400">
          <Check aria-hidden className="size-4" />
          Reply sent with {NAME}
        </p>
      ) : (
        <HiddenContentCheck
          file={file}
          audience="anyone on the internet"
          onRemove={remove}
          onShare={async () => {
            await new Promise((r) => setTimeout(r, 600))
            setShared(true)
          }}
        />
      )}
    </div>
  )
}
