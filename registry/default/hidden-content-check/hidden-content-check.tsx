"use client"

import * as React from "react"
import { Check, ChevronDown, EyeOff, FileWarning, Loader2, ShieldCheck, Trash2 } from "lucide-react"
import { AnimatePresence, animate, motion, useReducedMotion } from "motion/react"

import { cn } from "@/lib/utils"

import { inspectHiddenContent, type HiddenFinding, type HiddenKind, type HiddenReport } from "./inspect"

export { inspectHiddenContent, isInternalLink, readZip, type HiddenFinding, type HiddenKind, type HiddenReport, type HiddenSeverity } from "./inspect"

export const HIDDEN_CONTENT_CHECK_MESSAGES = {
  checking: "Looking inside {file}…",
  clean: "Nothing hidden in {file}. What you see is what they get.",
  found: "{file} carries one thing you can't see on screen.|{file} carries {count} things you can't see on screen.",
  foundAudience: "{file} carries one thing you can't see on screen, and {audience} will get it.|{file} carries {count} things you can't see on screen, and {audience} will get all of them.",
  locked: "Can't look inside {file}: it's an old .xls/.doc format or password-protected. Save it as .xlsx/.docx, or share a PDF.",
  unreadable: "Couldn't read {file}. Check it before sharing.",
  tooLarge: "{file} is too large to check here.",
  kind: {
    "hidden-sheet": "Hidden sheet “{where}” with {count} row|Hidden sheet “{where}” with {count} rows",
    "hidden-rows": "{count} hidden row in “{where}”|{count} hidden rows in “{where}”",
    "hidden-columns": "{count} hidden column in “{where}”|{count} hidden columns in “{where}”",
    "tracked-changes": "{count} tracked change, deleted text still readable|{count} tracked changes, deleted text still readable",
    "hidden-text": "{count} passage of hidden text|{count} passages of hidden text",
    comments: "{count} comment|{count} comments",
    "speaker-notes": "Speaker notes on {count} slide|Speaker notes on {count} slides",
    "hidden-slides": "{count} hidden slide|{count} hidden slides",
    "embedded-files": "{count} embedded file|{count} embedded files",
    "external-links": "A link to a file on an internal drive|Links to {count} files on internal drives",
    author: "Author and company details",
  } satisfies Record<HiddenKind, string>,
  veryHidden: "Very hidden: Excel's Unhide menu doesn't list it.",
  show: "Show what's in it",
  hide: "Hide preview",
  keep: "Meant to be there",
  kept: "Kept",
  remove: "Remove",
  removing: "Removing…",
  stillThere: "Still in the file after removing. Check it by hand.",
  removeFailed: "Couldn't remove it. Try again or fix it in the app.",
  advice: "Safest for a public reply: share a PDF or CSV with only the answer, not the working file.",
  share: "Share {file}",
  shareAnyway: "Share with {count} hidden item|Share with {count} hidden items",
  blocked: "Check the hidden item above first, or press again to share anyway.|Check the {count} hidden items above first, or press again to share anyway.",
  shareUnchecked: "Share without checking",
  blockedUnchecked: "Nothing inside could be checked. Press again to share it anyway.",
  sharing: "Sharing…",
}

// Plural strings are written "one|other".
type Messages = Omit<typeof HIDDEN_CONTENT_CHECK_MESSAGES, "kind"> & { kind: Record<HiddenKind, string> }

export interface HiddenContentCheckProps extends Omit<React.ComponentProps<"section">, "children"> {
  /** The .xlsx, .docx or .pptx about to be shared. `null` clears the check. */
  file: File | Blob | null | undefined
  /** Name to show when `file` is a Blob without one. */
  fileName?: string
  /** Who will receive it, e.g. "the public". Named in the summary when set. */
  audience?: string
  /** Shares the file. May return a Promise; the button shows a pending state and can't fire twice. */
  onShare?: (report: HiddenReport) => void | Promise<void>
  /** Removes one finding and returns the cleaned file. The result is re-checked before it counts. */
  onRemove?: (finding: HiddenFinding, file: File | Blob) => Promise<File | Blob>
  /** Fires with each report, including after a removal. */
  onReportChange?: (report: HiddenReport) => void
  messages?: Partial<Omit<Messages, "kind">> & { kind?: Partial<Record<HiddenKind, string>> }
}

/** Fills {placeholders}. A "one|other" template picks its form from `count`. */
const fill = (t: string, v: Record<string, string | number>) => (t.includes("|") ? t.split("|")[Number(String(v.count).replace(/\D/g, "")) === 1 ? 0 : 1] : t).replace(/\{(\w+)\}/g, (k, key: string) => String(v[key] ?? k))
const fmt = (n: number) => n.toLocaleString("en-US")
const chip =
  "inline-flex h-7 items-center gap-1 rounded-md border bg-background px-2.5 text-xs font-medium outline-none transition-colors hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-60 dark:bg-input/30"
const tone = {
  high: "border-red-500/40 bg-red-500/5 dark:bg-red-500/10",
  medium: "border-amber-500/40 bg-amber-500/5 dark:bg-amber-500/10",
  low: "border-border bg-muted/40",
}

/**
 * Stops a shared spreadsheet, document or deck leaking what's hidden in it (the PSNI FOI reply whose
 * hidden tab named all 9,483 officers and staff; the UN report whose tracked changes kept the names it
 * deleted). Before sharing, it opens the file in the browser and lists what isn't on screen: hidden and
 * very hidden sheets, hidden rows and columns, tracked deletions, hidden text, comments, speaker notes,
 * hidden slides, embedded workbooks, links to internal drives and author details. Each one can be
 * previewed (the hidden tab's real first rows), kept on purpose or removed through `onRemove`, whose
 * result is re-checked. Sharing with high-risk items open takes a second, deliberate press.
 */
export function HiddenContentCheck({ file, fileName, audience, onShare, onRemove, onReportChange, messages, className, ...props }: HiddenContentCheckProps) {
  const m: Messages = { ...HIDDEN_CONTENT_CHECK_MESSAGES, ...messages, kind: { ...HIDDEN_CONTENT_CHECK_MESSAGES.kind, ...messages?.kind } }
  const [current, setCurrent] = React.useState<File | Blob | null>(file ?? null)
  const [report, setReport] = React.useState<HiddenReport | null>(null)
  const [open, setOpen] = React.useState<string | null>(null)
  const [kept, setKept] = React.useState<Set<string>>(new Set())
  const [busy, setBusy] = React.useState<string | null>(null)
  const [notes, setNotes] = React.useState<Record<string, string>>({})
  const [armed, setArmed] = React.useState(false)
  const [sharing, setSharing] = React.useState(false)
  const [status, setStatus] = React.useState("")
  const run = React.useRef(0)
  const checked = React.useRef<File | Blob | null>(null)
  const rootRef = React.useRef<HTMLElement>(null)
  const shareRef = React.useRef<HTMLButtonElement>(null)
  const reportRef = React.useRef(onReportChange)
  reportRef.current = onReportChange
  const reduce = useReducedMotion()
  const id = React.useId()
  const name = fileName ?? (file instanceof File ? file.name : "This file")

  React.useEffect(() => setCurrent(file ?? null), [file])
  React.useEffect(() => {
    if (current && current === checked.current) return // a cleaned file we have already re-checked
    const token = ++run.current
    setReport(null)
    setArmed(false)
    if (!current) return
    inspectHiddenContent(current).then((r) => {
      if (token !== run.current) return // a newer file arrived while this one was being read
      setReport(r)
      // Open on the worst finding, so the hidden tab's real rows are the first thing seen.
      setOpen(r.findings.find((f) => f.preview.length)?.id ?? null)
      reportRef.current?.(r)
    })
  }, [current])
  React.useEffect(() => {
    setKept(new Set())
    setNotes({})
    setOpen(null)
  }, [file])

  const findings = report?.findings ?? []
  const open_ = findings.filter((f) => f.severity !== "low" && !kept.has(f.id))
  // A file we couldn't look inside (old format, password, too big) may hide anything, so it also takes a second press.
  const unchecked = !!report?.error
  // The warning only stands while something is still open; clearing the last item disarms it.
  const warn = armed && (open_.length > 0 || unchecked)
  const summary = !current
    ? ""
    : !report
      ? fill(m.checking, { file: name })
      : report.error
        ? fill({ locked: m.locked, unreadable: m.unreadable, "too-large": m.tooLarge }[report.error], { file: name })
        : findings.length
          ? fill(audience ? m.foundAudience : m.found, { file: name, count: findings.length, audience: audience ?? "" })
          : fill(m.clean, { file: name })

  // One status line, said once per report rather than on every render.
  React.useEffect(() => {
    const t = setTimeout(() => setStatus(report ? summary : ""), 400)
    return () => clearTimeout(t)
  }, [report, summary])

  const focusNext = (after: string) => {
    requestAnimationFrame(() => {
      const ids = open_.map((f) => f.id).filter((x) => x !== after)
      const next = ids.length ? rootRef.current?.querySelector<HTMLElement>(`[data-finding="${CSS.escape(ids[0])}"] button`) : null
      ;(next ?? shareRef.current)?.focus()
    })
  }

  const keep = (f: HiddenFinding) => {
    setKept((s) => new Set(s).add(f.id))
    focusNext(f.id)
  }

  const remove = async (f: HiddenFinding) => {
    if (!onRemove || !current || busy) return
    setBusy(f.id)
    const token = run.current
    try {
      const cleaned = await onRemove(f, current)
      const again = await inspectHiddenContent(cleaned)
      if (token !== run.current) return // the file was swapped while removing
      checked.current = cleaned
      setCurrent(cleaned)
      setReport(again)
      reportRef.current?.(again)
      const still = again.findings.some((x) => x.id === f.id)
      setNotes((n) => ({ ...n, [f.id]: still ? m.stillThere : "" }))
      if (!still) focusNext(f.id)
    } catch {
      setNotes((n) => ({ ...n, [f.id]: m.removeFailed }))
    } finally {
      setBusy(null)
    }
  }

  const share = async () => {
    if (!report || sharing) return
    if ((open_.length || unchecked) && !armed) {
      setArmed(true)
      if (!reduce && rootRef.current) animate(rootRef.current, { x: [0, -6, 6, -3, 0] }, { duration: 0.3 })
      if (open_.length) rootRef.current?.querySelector<HTMLElement>(`[data-finding="${CSS.escape(open_[0].id)}"] button`)?.focus()
      return
    }
    setSharing(true)
    try {
      await onShare?.(report)
    } catch {
      // The caller reports its own failure; the button just becomes usable again.
    } finally {
      setSharing(false)
      setArmed(false)
    }
  }

  return (
    <section
      ref={rootRef}
      data-slot="hidden-content-check"
      data-state={!report ? "checking" : report.error ? "error" : open_.length ? "found" : "clear"}
      aria-labelledby={`${id}-summary`}
      className={cn("grid w-full min-w-0 gap-3 text-sm", className)}
      {...props}
    >
      {current && (
        <p id={`${id}-summary`} className={cn("flex gap-2", report?.error || findings.length ? "text-foreground" : "text-muted-foreground")}>
          {!report ? (
            <Loader2 aria-hidden className="mt-0.5 size-4 shrink-0 animate-spin" />
          ) : report.error || findings.length ? (
            <FileWarning aria-hidden className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
          ) : (
            <ShieldCheck aria-hidden className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
          )}
          <span className="min-w-0 break-words">{summary}</span>
        </p>
      )}

      {findings.length > 0 && (
        <ul className="grid gap-2">
          <AnimatePresence initial={false}>
            {findings.map((f, i) => {
              const isKept = kept.has(f.id)
              const showing = open === f.id
              const table = f.kind.startsWith("hidden-sheet") || f.kind === "hidden-rows" || f.kind === "hidden-columns"
              return (
                <motion.li
                  key={f.id}
                  layout={!reduce}
                  data-finding={f.id}
                  initial={reduce ? { opacity: 0 } : { opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0, transition: { delay: reduce ? 0 : i * 0.05 } }}
                  exit={{ opacity: 0, transition: { duration: 0.15 } }}
                  className={cn("grid min-w-0 gap-2 rounded-md border p-2.5", isKept ? tone.low : tone[f.severity])}
                >
                  <div className="flex min-w-0 items-start gap-2">
                    <EyeOff aria-hidden className={cn("mt-0.5 size-4 shrink-0", f.severity === "high" && !isKept ? "text-red-600 dark:text-red-400" : "text-muted-foreground")} />
                    <div className="grid min-w-0 flex-1 gap-0.5">
                      <span className="font-medium break-words">{fill(m.kind[f.kind], { count: fmt(f.count), where: f.where ?? "" })}</span>
                      {f.veryHidden && <span className="text-xs text-muted-foreground">{m.veryHidden}</span>}
                    </div>
                  </div>
                  <AnimatePresence initial={false}>
                    {showing && f.preview.length > 0 && (
                      <motion.div
                        id={`${id}-${i}`}
                        initial={reduce ? { opacity: 0 } : { opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={reduce ? { opacity: 0 } : { opacity: 0, height: 0 }}
                        transition={{ duration: 0.2, ease: "easeOut" }}
                        className="overflow-hidden"
                      >
                        {table ? (
                          <div tabIndex={0} role="region" aria-label={fill(m.kind[f.kind], { count: fmt(f.count), where: f.where ?? "" })} className="overflow-x-auto rounded-sm border bg-background outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50">
                            <table className="w-full font-mono text-[11px]">
                              <tbody>
                                {f.preview.map((row, r) => (
                                  <tr key={r} className={cn("border-b last:border-0", r === 0 && "font-semibold")}>
                                    {row.map((cell, c) => (
                                      <td key={c} className="border-r px-1.5 py-1 whitespace-nowrap last:border-r-0">
                                        {cell}
                                      </td>
                                    ))}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        ) : (
                          <ul className="grid gap-1 text-xs">
                            {f.preview.map((row, r) => (
                              <li key={r} className="rounded-sm bg-background px-2 py-1 break-words [overflow-wrap:anywhere]">
                                {f.kind === "tracked-changes" ? <del>{row[0]}</del> : row[0]}
                              </li>
                            ))}
                          </ul>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {f.preview.length > 0 && (
                      <button type="button" aria-expanded={showing} aria-controls={showing ? `${id}-${i}` : undefined} onClick={() => setOpen(showing ? null : f.id)} className={chip}>
                        <ChevronDown aria-hidden className={cn("size-3.5 transition-transform", showing && "rotate-180")} />
                        {showing ? m.hide : m.show}
                      </button>
                    )}
                    {f.severity !== "low" &&
                      (isKept ? (
                        <span className="inline-flex h-7 items-center gap-1 px-1 text-xs text-muted-foreground">
                          <Check aria-hidden className="size-3.5" />
                          {m.kept}
                        </span>
                      ) : (
                        <button type="button" onClick={() => keep(f)} className={chip}>
                          {m.keep}
                        </button>
                      ))}
                    {onRemove && !isKept && (
                      <button type="button" disabled={busy !== null} aria-busy={busy === f.id} onClick={() => remove(f)} className={chip}>
                        {busy === f.id ? <Loader2 aria-hidden className="size-3.5 animate-spin" /> : <Trash2 aria-hidden className="size-3.5" />}
                        {busy === f.id ? m.removing : m.remove}
                      </button>
                    )}
                  </div>
                  {notes[f.id] && <p role="alert" className="text-xs text-red-700 dark:text-red-400">{notes[f.id]}</p>}
                </motion.li>
              )
            })}
          </AnimatePresence>
        </ul>
      )}

      {findings.some((f) => f.kind === "hidden-sheet" || f.kind === "hidden-rows" || f.kind === "hidden-columns") && <p className="text-xs text-muted-foreground">{m.advice}</p>}

      {onShare && current && (
        <div className="grid gap-1.5">
          <button
            ref={shareRef}
            type="button"
            disabled={!report || sharing}
            aria-describedby={warn ? `${id}-blocked` : undefined}
            onClick={share}
            className={cn(
              "inline-flex h-9 w-fit max-w-full items-center gap-2 rounded-md px-4 text-sm font-medium shadow-xs outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-60",
              warn ? "bg-destructive text-white hover:bg-destructive/90" : "bg-primary text-primary-foreground hover:bg-primary/90",
            )}
          >
            {sharing && <Loader2 aria-hidden className="size-4 animate-spin" />}
            <span className="truncate">{sharing ? m.sharing : warn ? (open_.length ? fill(m.shareAnyway, { count: open_.length }) : m.shareUnchecked) : fill(m.share, { file: name })}</span>
          </button>
          {warn && (
            <p id={`${id}-blocked`} role="alert" className="text-xs text-amber-700 dark:text-amber-400">
              {open_.length ? fill(m.blocked, { count: open_.length }) : m.blockedUnchecked}
            </p>
          )}
        </div>
      )}
      <span role="status" className="sr-only">
        {status}
      </span>
    </section>
  )
}
