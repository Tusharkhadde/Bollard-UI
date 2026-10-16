"use client"

import * as React from "react"

import { cn } from "@/lib/utils"
import { QrScanCheck } from "@/registry/default/qr-scan-check/qr-scan-check"

const SCANS = [
  { id: "meter", label: "Parking meter", payload: "https://pay.poybyphone.com/zone/4021", printed: "Pay by phone at paybyphone.com · Zone 4021" },
  {
    id: "upi",
    label: "“Refund” QR",
    payload: "upi://pay?pa=refund.desk42@ybl&pn=QuickKart%20Refunds&am=4999&tn=Refund%20for%20order%2048213&cu=INR",
    printed: "QuickKart",
  },
  { id: "short", label: "Flyer", payload: "https://bit.ly/3kFq9Zp", printed: "" },
]

/** Stands in for a server call that follows the redirect. */
const resolveRedirect = () => new Promise<string>((resolve) => setTimeout(() => resolve("https://amaz0n-refunds.in/claim?id=48213"), 700))

export function Demo() {
  const [scan, setScan] = React.useState(SCANS[0])
  const [result, setResult] = React.useState<string>()
  return (
    <div className="w-full max-w-md space-y-3">
      <div role="group" aria-label="Example scan" className="flex flex-wrap gap-1.5">
        {SCANS.map((s) => (
          <button
            key={s.id}
            type="button"
            aria-pressed={scan.id === s.id}
            onClick={() => {
              setScan(s)
              setResult(undefined)
            }}
            className={cn(
              "h-8 rounded-md border px-3 text-xs font-medium outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50",
              scan.id === s.id ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-accent",
            )}
          >
            {s.label}
          </button>
        ))}
      </div>
      <QrScanCheck
        key={scan.id}
        payload={scan.payload}
        printed={scan.printed}
        resolveRedirect={resolveRedirect}
        onOpen={(target) => setResult(`Opening ${target}`)}
        onCancel={() => setResult("Not opened. Good call.")}
      />
      {result && <p className="text-xs break-all text-muted-foreground">{result}</p>}
    </div>
  )
}
