"use client"

import * as React from "react"

import { DnsRecordGuard, type DnsChange, type DnsRecord } from "@/registry/default/dns-record-guard/dns-record-guard"

const ZONE: DnsRecord[] = [
  { id: "a1", type: "A", name: "@", value: "76.76.21.21", ttl: 3600 },
  { id: "c1", type: "CNAME", name: "www", value: "cname.vercel-dns.com", ttl: 3600 },
  { id: "m1", type: "MX", name: "@", value: "mx.zoho.in", priority: 10, ttl: 86_400 },
  { id: "t1", type: "TXT", name: "@", value: "v=spf1 include:zoho.in include:sendgrid.net ~all", ttl: 3600 },
  { id: "t2", type: "TXT", name: "zoho._domainkey", value: "v=DKIM1; k=rsa; p=MIGfMA0GCSqGSIb3DQEB", ttl: 3600 },
  { id: "t3", type: "TXT", name: "_dmarc", value: "v=DMARC1; p=quarantine; rua=mailto:dmarc@acme.in", ttl: 3600 },
]

const SCENARIOS: { label: string; change: DnsChange }[] = [
  { label: "Delete MX", change: { kind: "delete", id: "m1" } },
  { label: "Edit SPF", change: { kind: "edit", id: "t1", next: { value: "v=spf1 include:zoho.in include:mailgun.org ~all" } } },
  { label: "Root CNAME", change: { kind: "edit", id: "a1", next: { type: "CNAME", value: "cname.vercel-dns.com" } } },
]

export function Demo() {
  const [scenario, setScenario] = React.useState(0)
  const [records, setRecords] = React.useState(ZONE)
  const [done, setDone] = React.useState("")
  const [run, setRun] = React.useState(0)

  if (done)
    return (
      <div className="space-y-2 text-center text-sm">
        <p>{done}</p>
        <button
          type="button"
          onClick={() => {
            setDone("")
            setRecords(ZONE)
            setRun((n) => n + 1)
          }}
          className="inline-flex h-8 items-center rounded-md border bg-background px-3 font-medium shadow-xs outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:border-input dark:bg-input/30"
        >
          Run the demo again
        </button>
      </div>
    )

  return (
    <div className="w-full max-w-md space-y-3">
      <div role="group" aria-label="Example change" className="flex gap-1 rounded-lg bg-muted p-1">
        {SCENARIOS.map((s, i) => (
          <button
            key={s.label}
            type="button"
            aria-pressed={scenario === i}
            onClick={() => setScenario(i)}
            className="h-7 flex-1 rounded-md px-1 text-xs whitespace-nowrap font-medium text-muted-foreground outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-pressed:bg-background aria-pressed:text-foreground aria-pressed:shadow-xs"
          >
            {s.label}
          </button>
        ))}
      </div>
      <DnsRecordGuard
        key={`${scenario}-${run}`}
        zone="acme.in"
        records={records}
        change={SCENARIOS[scenario].change}
        onLowerTtl={(record, ttl) =>
          new Promise<void>((resolve) =>
            setTimeout(() => {
              setRecords((rs) => rs.map((r) => (r.id === record.id ? { ...r, ttl } : r)))
              resolve()
            }, 500),
          )
        }
        onConfirm={(change) => new Promise<void>((resolve) => setTimeout(() => {
          setDone(change.kind === "delete" ? "Record deleted." : "Record saved.")
          resolve()
        }, 600))}
        onCancel={() => setRun((n) => n + 1)}
      />
    </div>
  )
}
