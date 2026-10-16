"use client"

import * as React from "react"
import { CircleCheck, Globe, LoaderCircle, OctagonX, Timer, TriangleAlert } from "lucide-react"

import { cn } from "@/lib/utils"
import { checkDnsChange, formatTtl, shortName, type DnsChange, type DnsFinding, type DnsRecord } from "@/registry/default/dns-record-guard/dns-checks"

export { checkDnsChange, zoneIssues, applyDnsChange, spfLookups, fqdn, shortName, formatTtl } from "@/registry/default/dns-record-guard/dns-checks"
export type { DnsChange, DnsFinding, DnsRecord } from "@/registry/default/dns-record-guard/dns-checks"

const button =
  "inline-flex h-9 items-center justify-center gap-2 rounded-md px-4 text-sm font-medium whitespace-nowrap shadow-xs outline-none transition-[color,background-color,box-shadow] focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 aria-busy:cursor-progress"
const outline = "border bg-background hover:bg-accent dark:border-input dark:bg-input/30 dark:hover:bg-input/50"
const fix =
  "inline-flex h-6 items-center gap-1 rounded-md border border-amber-500/40 px-2 font-medium text-amber-900 outline-none transition-colors hover:bg-amber-500/10 focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-60 dark:text-amber-200"

export interface DnsRecordGuardProps extends Omit<React.ComponentProps<"section">, "title"> {
  /** The zone's root domain, e.g. "acme.com". */
  zone: string
  /** Every record in the zone as it is now, so the guard can see what depends on the change. */
  records: DnsRecord[]
  /** The edit or delete being confirmed. */
  change: DnsChange
  /** Applies the change. Return a promise to show a pending state; a rejection is caught. */
  onConfirm: (change: DnsChange) => void | Promise<void>
  /** Called when the user cancels. */
  onCancel?: () => void
  /** Saves a lower TTL on the record now, so the real change later spreads in minutes. Hides the fix when omitted. */
  onLowerTtl?: (record: DnsRecord, ttl: number) => void | Promise<void>
  /** TTL (seconds) the one-tap fix sets. */
  safeTtl?: number
  /** Records cached longer than this (seconds) get the "lower TTL first" suggestion. */
  slowTtl?: number
  /** Heading; receives the change and record. */
  title?: (change: DnsChange, record: DnsRecord) => React.ReactNode
  /** Confirm button text. */
  confirmLabel?: (change: DnsChange, breaking: number) => string
  /** Confirm button text while onConfirm runs. */
  pendingLabel?: string
  /** Cancel button text. */
  cancelLabel?: string
  /** Shown when no problems are found. */
  safeText?: string
  /** Text estimating how long the change takes to spread. */
  spreadText?: (ttl: string) => string
  /** Text for the lower-TTL-first button. */
  lowerLabel?: (ttl: string) => string
  /** Text shown while waiting for old caches to expire. */
  waitText?: (oldTtl: string, time: string) => string
  /** Shown once old caches have expired. */
  clearedText?: (ttl: string) => string
}

/**
 * The DNS edit or delete confirmation that says what will break before it
 * does: email that stops (MX, SPF, DKIM and DMARC, escalated when a DMARC
 * policy enforces it), a CNAME at the root or beside other records, names left
 * pointing at nothing. It also says how long the change takes to reach
 * everyone, with a one-tap "lower TTL first" that then counts down until old
 * caches have cleared.
 */
export function DnsRecordGuard({
  zone,
  records,
  change,
  onConfirm,
  onCancel,
  onLowerTtl,
  safeTtl = 300,
  slowTtl = 3600,
  title = (c, r) => `${c.kind === "delete" ? "Delete" : "Save"} ${r.type} record for ${shortName(r.name, zone)}?`,
  confirmLabel = (c, breaking) => (breaking ? `${c.kind === "delete" ? "Delete" : "Save"} anyway, breaks ${breaking} ${breaking === 1 ? "thing" : "things"}` : c.kind === "delete" ? "Delete record" : "Save record"),
  pendingLabel = "Saving…",
  cancelLabel = "Cancel",
  safeText = "Nothing else in this zone depends on this record.",
  spreadText = (ttl) => `Takes up to ${ttl} to reach everyone: resolvers keep the old answer that long.`,
  lowerLabel = (ttl) => `Lower TTL to ${ttl} first`,
  waitText = (oldTtl, time) => `TTL lowered. Caches holding the ${oldTtl} answer clear by ${time}; change it after that.`,
  clearedText = (ttl) => `Old caches have cleared. This change now spreads within ${ttl}.`,
  className,
  ...props
}: DnsRecordGuardProps) {
  const record = records.find((r) => r.id === change.id)
  const findings = React.useMemo(() => (record ? checkDnsChange(zone, records, change) : []), [zone, records, change, record])
  const [lowered, setLowered] = React.useState<{ at: number; from: number } | null>(null)
  const [lowering, setLowering] = React.useState(false)
  const [pending, setPending] = React.useState(false)
  const [now, setNow] = React.useState(0)
  const baseId = React.useId()

  React.useEffect(() => {
    if (!lowered) return
    setNow(Date.now())
    const tick = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(tick)
  }, [lowered])

  if (!record) return null
  const breaking = findings.filter((f) => f.severity === "breaks").length
  const next = change.kind === "edit" ? { ...record, ...change.next } : null
  const remaining = lowered ? Math.max(0, lowered.at + lowered.from * 1000 - now) : 0

  const lower = async () => {
    setLowering(true)
    try {
      await onLowerTtl?.(record, safeTtl)
      setLowered({ at: Date.now(), from: record.ttl })
    } catch {
      // The caller reports the error; the suggestion stays.
    } finally {
      setLowering(false)
    }
  }
  const confirm = async () => {
    if (pending) return
    setPending(true)
    try {
      await onConfirm(change)
    } catch {
      // The caller reports the error; the dialog stays open.
    } finally {
      setPending(false)
    }
  }

  return (
    <section
      data-slot="dns-record-guard"
      aria-labelledby={`${baseId}-title`}
      className={cn("w-full max-w-md space-y-4 rounded-xl border bg-card p-4 text-card-foreground sm:p-5", className)}
      {...props}
    >
      <h3 id={`${baseId}-title`} className="flex items-center gap-2 font-medium">
        <Globe aria-hidden className="size-4 shrink-0 text-muted-foreground" /> {title(change, record)}
      </h3>

      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 rounded-md border bg-muted/40 px-3 py-2 font-mono text-xs">
        {(["type", "name", "value", "ttl"] as const).map((field) => {
          const shown = (r: DnsRecord) => (field === "name" ? shortName(r.name, zone) : field === "ttl" ? formatTtl(r.ttl) : `${r.priority != null && field === "value" ? `${r.priority} ` : ""}${r[field]}`)
          const changed = next && shown(next) !== shown(record)
          return (
            <React.Fragment key={field}>
              <dt className="text-muted-foreground uppercase">{field}</dt>
              <dd className="min-w-0 break-all">
                <span className={cn((change.kind === "delete" || changed) && "text-red-700 line-through decoration-red-500/60 dark:text-red-400")}>{shown(record)}</span>
                {changed && <span className="block text-emerald-700 dark:text-emerald-400">{shown(next)}</span>}
              </dd>
            </React.Fragment>
          )
        })}
      </dl>

      <div aria-live="polite">
        {findings.length ? (
          <ul className="space-y-2.5">
            {findings.map((f: DnsFinding) => (
              <li key={f.key} className="flex gap-2 text-sm">
                {f.severity === "breaks" ? (
                  <OctagonX aria-hidden className="mt-0.5 size-4 shrink-0 text-red-600 dark:text-red-400" />
                ) : (
                  <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
                )}
                <span className="min-w-0">
                  <span className="sr-only">{f.severity === "breaks" ? "Breaks: " : "Risk: "}</span>
                  <span className="font-medium">{f.title}</span>
                  <span className="block text-muted-foreground">{f.detail}</span>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-400">
            <CircleCheck aria-hidden className="size-4 shrink-0" /> {safeText}
          </p>
        )}
      </div>

      <div aria-live="polite" className="text-xs">
        {lowered ? (
          remaining > 0 ? (
            <div className="space-y-1.5 text-amber-700 dark:text-amber-400">
              <p className="flex gap-1.5">
                <Timer aria-hidden className="mt-px size-3.5 shrink-0" />
                {waitText(formatTtl(lowered.from), new Date(lowered.at + lowered.from * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }))}
              </p>
              <div aria-hidden className="h-1 overflow-hidden rounded-full bg-amber-500/15">
                <div className="h-full rounded-full bg-amber-500 motion-safe:transition-[width] motion-safe:duration-1000 motion-safe:ease-linear" style={{ width: `${(remaining / (lowered.from * 1000)) * 100}%` }} />
              </div>
            </div>
          ) : (
            <p className="flex gap-1.5 text-emerald-700 dark:text-emerald-400">
              <CircleCheck aria-hidden className="mt-px size-3.5 shrink-0" /> {clearedText(formatTtl(safeTtl))}
            </p>
          )
        ) : record.ttl > slowTtl ? (
          <p className="flex gap-1.5 text-amber-700 dark:text-amber-400">
            <span className="flex h-6 shrink-0 items-center"><Timer aria-hidden className="size-3.5" /></span>
            <span className="flex min-w-0 flex-wrap items-center gap-x-2">
              <span className="py-1">{spreadText(formatTtl(record.ttl))}</span>
              {onLowerTtl && (
                <button type="button" disabled={lowering} aria-busy={lowering || undefined} onClick={() => void lower()} className={fix}>
                  {lowering && <LoaderCircle aria-hidden className="size-3 animate-spin" />}
                  {lowerLabel(formatTtl(safeTtl))}
                </button>
              )}
            </span>
          </p>
        ) : (
          <p className="flex gap-1.5 text-muted-foreground">
            <Timer aria-hidden className="mt-px size-3.5 shrink-0" /> {spreadText(formatTtl(record.ttl))}
          </p>
        )}
      </div>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        {onCancel && (
          <button type="button" disabled={pending} onClick={onCancel} className={cn(button, outline)}>
            {cancelLabel}
          </button>
        )}
        <button
          type="button"
          aria-busy={pending || undefined}
          onClick={() => void confirm()}
          className={cn(
            button,
            breaking || change.kind === "delete"
              ? "bg-destructive text-white hover:bg-destructive/90 dark:bg-destructive/60 dark:hover:bg-destructive/70"
              : "bg-primary text-primary-foreground hover:bg-primary/90",
          )}
        >
          {pending && <LoaderCircle aria-hidden className="size-4 animate-spin" />}
          {pending ? pendingLabel : confirmLabel(change, breaking)}
        </button>
      </div>
    </section>
  )
}
