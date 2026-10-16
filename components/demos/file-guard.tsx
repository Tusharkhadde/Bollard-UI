"use client"

import * as React from "react"

import { FileGuard, type FileGuardHandle } from "@/registry/default/file-guard/file-guard"

// Fixed timestamp so the duplicate sample really is the same file.
const MODIFIED = 1_760_000_000_000

const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
const PDF = [0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37]
const JPEG = [0xff, 0xd8, 0xff, 0xe0]

function sample(name: string, header: number[], size = 2048) {
  const bytes = new Uint8Array(size)
  bytes.set(header)
  return new File([bytes], name, { lastModified: MODIFIED })
}

const samples: { label: string; make: () => File }[] = [
  { label: "invoice.pdf", make: () => sample("invoice.pdf", PDF) },
  { label: "contract.pdf (really a PNG)", make: () => sample("contract.pdf", PNG) },
  { label: "notes.pdf (0 bytes)", make: () => new File([], "notes.pdf", { lastModified: MODIFIED }) },
  { label: "scan.jpg (3 MB)", make: () => sample("scan.jpg", JPEG, 3_000_000) },
  { label: "report.docx (really a PDF)", make: () => sample("report.docx", PDF) },
  { label: "setup.exe", make: () => sample("setup.exe", [0x4d, 0x5a]) },
]

export function Demo() {
  const guard = React.useRef<FileGuardHandle>(null)
  const [ready, setReady] = React.useState<string[]>([])

  // Start with a real catch on screen: a "PDF" that is really a PNG, next to a genuine one.
  const seeded = React.useRef(false)
  React.useEffect(() => {
    if (seeded.current) return
    seeded.current = true
    void guard.current?.addFiles([samples[0].make(), samples[1].make()])
  }, [])

  return (
    <div className="flex w-full max-w-md flex-col gap-3">
      <FileGuard
        ref={guard}
        label="Upload documents"
        accept={[".pdf", ".png", ".jpg", ".docx"]}
        maxSize={2 * 1024 * 1024}
        maxFiles={4}
        onFilesChange={(files) => setReady(files.map((file) => file.name))}
      />
      <div className="flex flex-wrap gap-1.5" aria-label="Sample files">
        {samples.map((s) => (
          <button
            key={s.label}
            type="button"
            onClick={() => void guard.current?.addFiles([s.make()])}
            className="inline-flex h-6 items-center rounded-md border bg-background px-2 text-xs text-muted-foreground outline-none hover:bg-accent hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            + {s.label}
          </button>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        Will upload: {ready.length ? ready.join(", ") : "nothing yet"}
      </p>
    </div>
  )
}
