"use client"

import * as React from "react"
import { Check, Download, EyeOff, HardDrive, ShieldOff } from "lucide-react"

import { cn } from "@/lib/utils"
import { probeStorage, type StorageReport, type StorageRisk } from "./storage-probe"

export * from "./storage-probe"

/** Banner layout and tone shared by every Bollard UI banner. */
const bar = "flex min-h-11 flex-wrap items-center gap-x-3 gap-y-1.5 px-3 py-1.5 text-sm"
const action =
  "inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-md px-3 text-sm font-medium whitespace-nowrap outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-60"
const tone = {
  surface:
    "border-amber-500/30 bg-background bg-linear-to-r from-amber-500/10 to-amber-500/10 text-amber-950 dark:text-amber-50",
  icon: "text-amber-600 dark:text-amber-400",
  muted: "text-amber-900/75 dark:text-amber-100/75",
  solid: "bg-amber-700 text-white hover:bg-amber-800 dark:bg-amber-400 dark:text-amber-950 dark:hover:bg-amber-300",
  outline: "border border-amber-700/25 hover:bg-amber-500/15 dark:border-amber-300/25",
}
const icons = { private: EyeOff, blocked: ShieldOff, full: HardDrive } as const

/** Runs `probeStorage` once after mount. Null until it resolves, or when `override` is given. */
export function useStorageReport(override?: StorageReport) {
  const [report, setReport] = React.useState<StorageReport | null>(null)
  React.useEffect(() => {
    if (override) return
    let live = true
    void probeStorage().then((result) => live && setReport(result))
    return () => {
      live = false
    }
  }, [override])
  return override ?? report
}

export interface PrivateModeNoticeProps extends Omit<React.ComponentProps<"div">, "children"> {
  /** Skip detection and use this report (tests, or your own server-side signal). */
  report?: StorageReport
  /** `banner` above a form or editor; `inline` as a one-line hint under a "Remember me" box. */
  variant?: "banner" | "inline"
  /** The user has work that only exists in this window. Strengthens the message and guards closing the tab. */
  hasUnsavedWork?: boolean
  /** Returns the unsaved work to download. Without it there's no Export button. */
  exportData?: () => string | Blob
  /** File name for the export. */
  exportFilename?: string
  /** Called once detection finishes. */
  onReport?: (report: StorageReport) => void
  /** Banner messages per risk. */
  privateText?: string
  blockedText?: string
  fullText?: string
  /** Appended when work is at stake. */
  unsavedText?: string
  /** Shown when the risk is inferred, not proven. */
  likelyText?: string
  /** One-line messages for the inline variant. */
  inlinePrivateText?: string
  inlineBlockedText?: string
  inlineFullText?: string
  exportLabel?: string
  exportedLabel?: string
  dismissLabel?: string
}

/**
 * Warns before someone trusts drafts or "Remember me" in a browser that won't
 * keep them: a private window (erased on close), blocked site data (not kept
 * even across a reload) or a full quota (new saves fail). A real write test
 * runs first, so it only says "probably" when it's inferring; it offers to
 * export unsaved work and guards closing the tab while work is at stake.
 */
export function PrivateModeNotice({
  report: reportProp,
  variant = "banner",
  hasUnsavedWork = false,
  exportData,
  exportFilename = "unsaved-work.txt",
  onReport,
  privateText = "This is a private window. Drafts and “Remember me” are erased when you close it.",
  blockedText = "Your browser is blocking site storage. Drafts and “Remember me” won’t survive a reload.",
  fullText = "Storage for this site is nearly full. New drafts may not save.",
  unsavedText = "Your unsaved work only exists in this window.",
  likelyText = "Detected from how your browser stores data, so it may be wrong.",
  inlinePrivateText = "Private window: you’ll be signed out when you close it.",
  inlineBlockedText = "Your browser blocks site storage, so this can’t be remembered.",
  inlineFullText = "Browser storage is full, so this may not be remembered.",
  exportLabel = "Export",
  exportedLabel = "Downloaded",
  dismissLabel = "Got it",
  className,
  ...props
}: PrivateModeNoticeProps) {
  const report = useStorageReport(reportProp)
  const [dismissed, setDismissed] = React.useState(false)
  const [exported, setExported] = React.useState(false)
  const risk: StorageRisk = report?.risk ?? "ok"
  const atRisk = risk !== "ok"

  const onReportRef = React.useRef(onReport)
  React.useEffect(() => {
    onReportRef.current = onReport
  })
  React.useEffect(() => {
    if (report) onReportRef.current?.(report)
  }, [report])

  // Closing a private (or storage-blocked) window throws the work away for good.
  React.useEffect(() => {
    if (!hasUnsavedWork || (risk !== "private" && risk !== "blocked")) return
    const guard = (event: BeforeUnloadEvent) => event.preventDefault()
    window.addEventListener("beforeunload", guard)
    return () => window.removeEventListener("beforeunload", guard)
  }, [hasUnsavedWork, risk])

  React.useEffect(() => {
    if (!exported) return
    const timer = setTimeout(() => setExported(false), 2000)
    return () => clearTimeout(timer)
  }, [exported])

  const download = () => {
    if (!exportData) return
    const data = exportData()
    const url = URL.createObjectURL(
      data instanceof Blob ? data : new Blob([data], { type: "text/plain;charset=utf-8" }),
    )
    const link = Object.assign(document.createElement("a"), { href: url, download: exportFilename })
    link.click()
    setTimeout(() => URL.revokeObjectURL(url), 0)
    setExported(true)
  }

  const Icon = atRisk ? icons[risk as Exclude<StorageRisk, "ok">] : EyeOff

  if (variant === "inline") {
    const text = { ok: "", private: inlinePrivateText, blocked: inlineBlockedText, full: inlineFullText }[risk]
    return (
      <div
        data-slot="private-mode-notice"
        data-risk={risk}
        aria-live="polite"
        className={cn("text-xs empty:hidden", className)}
        {...props}
      >
        {atRisk && (
          <p className="mt-1.5 flex items-start gap-1.5 text-amber-700 dark:text-amber-400">
            <Icon aria-hidden className="mt-px size-3.5 shrink-0" />
            {text}
          </p>
        )}
      </div>
    )
  }

  const message = { ok: "", private: privateText, blocked: blockedText, full: fullText }[risk]
  const visible = atRisk && !dismissed

  return (
    <div
      data-slot="private-mode-notice"
      data-risk={risk}
      aria-live="polite"
      className={cn(!visible && "hidden", className)}
      {...props}
    >
      {visible && (
        <div
          role="region"
          aria-label={message}
          className={cn(
            "overflow-hidden rounded-lg border motion-safe:animate-[cui-private-mode-notice-in_250ms_ease-out]",
            tone.surface,
          )}
        >
          <style>{"@keyframes cui-private-mode-notice-in{from{opacity:0;transform:translateY(-4px)}}"}</style>
          <div className={bar}>
            <div className="flex min-w-0 flex-1 basis-56 gap-3">
              <Icon aria-hidden className={cn("mt-0.5 size-4 shrink-0", tone.icon)} />
              <div className="min-w-0 flex-1 py-0.5">
                <p className="font-medium">{message}</p>
                {(hasUnsavedWork || report?.confidence === "likely") && (
                  <p className={cn("text-xs", tone.muted)}>
                    {[hasUnsavedWork && unsavedText, report?.confidence === "likely" && likelyText]
                      .filter(Boolean)
                      .join(" ")}
                  </p>
                )}
              </div>
            </div>
            <div className="ml-auto flex gap-2">
              <button type="button" onClick={() => setDismissed(true)} className={cn(action, tone.outline)}>
                {dismissLabel}
              </button>
              {exportData && (
                <button type="button" onClick={download} className={cn(action, tone.solid)}>
                  {exported ? <Check aria-hidden className="size-4" /> : <Download aria-hidden className="size-4" />}
                  {exported ? exportedLabel : exportLabel}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
