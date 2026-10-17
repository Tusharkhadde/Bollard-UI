"use client"

// Bollard UI — stale-attachment-check · MIT licence · https://bollard-ui.vercel.app/components/stale-attachment-check

import * as React from "react"
import { CircleCheck, FileClock, FileText, Loader2, Undo2 } from "lucide-react"

import { cn } from "@/lib/utils"
import { checkAttachment, toTime, type StaleFile, type StaleIssue } from "./stale"

export { checkAttachment, dateInName, documentKey, subjectDate, toTime, versionOf, type StaleFile, type StaleIssue } from "./stale"

/** Every visible string. `{name}`, `{when}`, `{word}`, `{fileDate}`, `{subjectDate}`, `{count}` and `{total}` are filled in. */
export const STALE_ATTACHMENT_MESSAGES = {
  heading: "Attachments",
  summaryIssues: "{count} of {total} may be an old copy",
  summaryOk: "Latest versions attached",
  edited: "Edited {when}",
  changedSince: "You saved this file again {when}, after attaching it. The attached copy is the older one.",
  newerTime: "{name} is in the same folder and was edited {when}.",
  newerVersion: "{name} has a later version number.",
  lockFile: "This is Office's temporary lock file, not the document.",
  nameHint: "The name says “{word}”. Is this the copy you mean to send?",
  beforeSubjectName: "The file name says {fileDate}, but the subject says {subjectDate}.",
  beforeSubjectModified: "Last edited {fileDate}, before the {subjectDate} in the subject.",
  reattach: "Attach saved version",
  swap: "Attach newer one",
  removeOld: "Remove this copy",
  removed: "Removed {name}; the newer copy is still attached.",
  keep: "Keep",
  swapped: "Swapped in for {name}.",
  undo: "Undo",
  send: "Send",
  sendAnyway: "Send anyway",
}

export type StaleAttachmentMessages = typeof STALE_ATTACHMENT_MESSAGES

const fill = (template: string, values: Record<string, string | number>) =>
  template.replace(/\{(\w+)\}/g, (match, key: string) => String(values[key] ?? match))

const fixClass =
  "inline-flex h-6 items-center gap-1 rounded-md border border-amber-500/40 px-2 font-medium text-amber-900 transition-colors hover:bg-amber-500/10 dark:text-amber-200 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
const ghostClass =
  "inline-flex h-6 items-center rounded-md px-2 font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"

export interface StaleAttachmentCheckProps extends Omit<React.ComponentProps<"div">, "defaultValue" | "onChange"> {
  /** Controlled attachments. */
  value?: StaleFile[]
  /** Initial attachments when uncontrolled. */
  defaultValue?: StaleFile[]
  /** Called with the new list after a swap or undo. */
  onValueChange?: (files: StaleFile[]) => void
  /** Files beside the attachments: the same folder, drive or recent files. */
  nearby?: StaleFile[]
  /** The email subject, for "Minutes 14 Oct" style dates. */
  subject?: string
  /** "Now" in epoch ms, for deterministic rendering. Read from the clock after mount when omitted. */
  now?: number
  /** Days an edit may come before the subject's date without a warning ("deck for today's meeting"). */
  graceDays?: number
  /** Locale for dates. */
  locale?: string
  /** Called on Send. With warnings left, the first click jumps to them and the second sends. May return a Promise. */
  onSend?: (files: StaleFile[]) => void | Promise<void>
  /** Any visible string. */
  messages?: Partial<StaleAttachmentMessages>
}

/**
 * Catches the old copy before it goes out: report_v2.pdf attached while report_v3_final.pdf was
 * edited today, a file saved again after it was attached (so the older copy would be sent), names
 * that say draft, old, copy or (1), and a file older than the date in the subject. Each warning
 * offers a one-tap swap to the newer file, with Undo.
 */
export function StaleAttachmentCheck({
  value,
  defaultValue = [],
  onValueChange,
  nearby = [],
  subject = "",
  now: nowProp,
  graceDays = 1,
  locale,
  onSend,
  messages,
  className,
  ...props
}: StaleAttachmentCheckProps) {
  const t = { ...STALE_ATTACHMENT_MESSAGES, ...messages }
  const [inner, setInner] = React.useState(defaultValue)
  const [clock, setClock] = React.useState<number>()
  const [kept, setKept] = React.useState<Set<string>>(() => new Set())
  const [swaps, setSwaps] = React.useState<Record<string, StaleFile>>({})
  const [removed, setRemoved] = React.useState<{ file: StaleFile; index: number }>()
  const baseId = React.useId()
  const [asked, setAsked] = React.useState(false)
  const [pending, setPending] = React.useState(false)
  const rootRef = React.useRef<HTMLDivElement>(null)
  const sendRef = React.useRef<HTMLButtonElement>(null)
  const files = (Array.isArray(value ?? inner) ? (value ?? inner) : []).filter((f): f is StaleFile => !!f && typeof f.name === "string")
  const now = nowProp ?? clock

  React.useEffect(() => {
    if (nowProp === undefined) setClock(Date.now())
  }, [nowProp])

  const checks = files.map((file) => checkAttachment(file, nearby, { subject, now, graceDays }).filter((issue) => !kept.has(`${file.id}:${issue.kind}`)))
  const flagged = checks.filter((issues) => issues.length).length

  const when = (time: number | null) => {
    if (time === null) return ""
    if (now === undefined) return new Intl.DateTimeFormat(locale, { day: "numeric", month: "short" }).format(time)
    const days = Math.round((new Date(now).setHours(0, 0, 0, 0) - new Date(time).setHours(0, 0, 0, 0)) / 86_400_000)
    if (days >= 0 && days < 7) return new Intl.RelativeTimeFormat(locale, { numeric: "auto" }).format(-days, "day")
    return day(time)
  }
  const day = (time: number, period: "day" | "month" = "day") =>
    new Intl.DateTimeFormat(locale, period === "month" ? { month: "long" } : { day: "numeric", month: "short", year: now !== undefined && new Date(time).getFullYear() !== new Date(now).getFullYear() ? "numeric" : undefined }).format(time)

  const describe = (issue: StaleIssue) => {
    switch (issue.kind) {
      case "changedSince": return fill(t.changedSince, { when: when(toTime(issue.replacement.modified)) })
      case "newer": return fill(issue.by === "version" ? t.newerVersion : t.newerTime, { name: issue.replacement.name, when: when(toTime(issue.replacement.modified)) })
      case "lockFile": return t.lockFile
      case "nameHint": return fill(t.nameHint, { word: issue.word })
      case "beforeSubject":
        return fill(issue.source === "name" ? t.beforeSubjectName : t.beforeSubjectModified, { fileDate: day(issue.fileDate), subjectDate: day(issue.subjectDate, issue.period) })
    }
  }

  const commit = (next: StaleFile[]) => {
    if (value === undefined) setInner(next)
    onValueChange?.(next)
    setAsked(false)
  }

  /** After a fix, go to the next warning's first button, else Send, else the list itself. */
  const focusNext = (afterIndex: number) =>
    requestAnimationFrame(() => {
      const root = rootRef.current
      const next = Array.from(root?.querySelectorAll<HTMLElement>("[data-row]") ?? []).find((row, i) => i > afterIndex && row.querySelector("[data-fix]"))
      ;(next?.querySelector<HTMLElement>("[data-fix]") ?? sendRef.current ?? root)?.focus()
    })

  const swap = (index: number, replacement: StaleFile) => {
    const old = files[index]
    // Both copies attached: drop the old one instead of attaching the newer one twice.
    if (files.some((file) => file.id === replacement.id)) {
      commit(files.filter((_, i) => i !== index))
      setRemoved({ file: old, index })
      requestAnimationFrame(() => rootRef.current?.querySelector<HTMLElement>("[data-undo-remove]")?.focus())
      return
    }
    commit(files.map((file, i) => (i === index ? replacement : file)))
    setSwaps((s) => ({ ...s, [replacement.id]: old }))
    requestAnimationFrame(() => rootRef.current?.querySelector<HTMLElement>(`[data-undo="${CSS.escape(replacement.id)}"]`)?.focus())
  }

  const undo = (index: number) => {
    const current = files[index]
    const old = swaps[current.id]
    if (!old) return
    commit(files.map((file, i) => (i === index ? old : file)))
    setSwaps(({ [current.id]: _, ...rest }) => rest)
    requestAnimationFrame(() => rootRef.current?.querySelectorAll<HTMLElement>("[data-row]")[index]?.querySelector<HTMLElement>("[data-fix]")?.focus())
  }

  const undoRemove = () => {
    if (!removed) return
    const next = [...files]
    next.splice(Math.min(removed.index, next.length), 0, removed.file)
    commit(next)
    setRemoved(undefined)
    requestAnimationFrame(() => rootRef.current?.querySelectorAll<HTMLElement>("[data-row]")[removed.index]?.querySelector<HTMLElement>("[data-fix]")?.focus())
  }

  const send = async () => {
    if (flagged && !asked) {
      setAsked(true)
      rootRef.current?.querySelector<HTMLElement>("[data-fix]")?.focus()
      return
    }
    if (!onSend || pending) return
    setPending(true)
    try {
      await onSend(files)
    } catch {
      // The caller reports send failures; the button simply becomes usable again.
    } finally {
      setPending(false)
    }
  }

  return (
    <div ref={rootRef} tabIndex={-1} data-slot="stale-attachment-check" data-state={flagged ? "issues" : "ok"} className={cn("w-full max-w-md space-y-3 text-sm outline-none", className)} {...props}>
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <h3 className="font-medium">{t.heading}</h3>
        <p aria-live="polite" className={cn("flex items-center gap-1.5 text-xs", flagged ? "text-amber-700 dark:text-amber-400" : "text-emerald-700 dark:text-emerald-400")}>
          {flagged ? <FileClock aria-hidden className="size-3.5" /> : <CircleCheck aria-hidden className="size-3.5" />}
          {flagged ? fill(t.summaryIssues, { count: flagged, total: files.length }) : t.summaryOk}
        </p>
      </div>
      {removed && (
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-emerald-700 dark:text-emerald-400">
          <CircleCheck aria-hidden className="size-3.5 shrink-0" />
          <span className="min-w-0 break-words">{fill(t.removed, { name: removed.file.name })}</span>
          <button type="button" data-undo-remove onClick={undoRemove} className={ghostClass}>
            <Undo2 aria-hidden className="mr-1 size-3.5" />
            {t.undo}
          </button>
        </p>
      )}
      <ul className="space-y-2">
        {files.map((file, index) => {
          const issues = checks[index]
          const swappedFrom = swaps[file.id]
          const fix = issues.find((issue): issue is Extract<StaleIssue, { replacement: StaleFile }> => "replacement" in issue)
          const duplicate = !!fix && files.some((f) => f.id === fix.replacement.id)
          const nameId = `${baseId}-${index}`
          return (
            <li key={file.id} data-row className={cn("rounded-md border p-3", issues.length && "border-amber-500/40")}>
              <div className="flex min-w-0 items-start gap-2 sm:items-center">
                <FileText aria-hidden className="mt-0.5 size-4 shrink-0 text-muted-foreground sm:mt-0" />
                <span id={nameId} className="min-w-0 flex-1 font-medium [overflow-wrap:anywhere] sm:truncate" title={file.name}>{file.name}</span>
                {toTime(file.modified) !== null && <span className="shrink-0 text-xs text-muted-foreground">{fill(t.edited, { when: when(toTime(file.modified)) })}</span>}
              </div>
              {swappedFrom && (
                <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-emerald-700 dark:text-emerald-400">
                  <CircleCheck aria-hidden className="size-3.5 shrink-0" />
                  <span className="min-w-0 break-words">{fill(t.swapped, { name: swappedFrom.name })}</span>
                  <button type="button" data-undo={file.id} aria-describedby={nameId} onClick={() => undo(index)} className={ghostClass}>
                    <Undo2 aria-hidden className="mr-1 size-3.5" />
                    {t.undo}
                  </button>
                </p>
              )}
              {issues.length > 0 && (
                <div className="mt-1.5 flex gap-1.5 text-xs text-amber-700 dark:text-amber-400">
                  <FileClock aria-hidden className="mt-0.5 size-3.5 shrink-0" />
                  <div className="min-w-0 space-y-1">
                    {issues.map((issue) => (
                      <p key={issue.kind} className="break-words">{describe(issue)}</p>
                    ))}
                    <div className="flex flex-wrap gap-2 pt-0.5">
                      {fix && (
                        <button type="button" data-fix aria-describedby={nameId} onClick={() => swap(index, fix.replacement)} className={fixClass} title={fix.replacement.name}>
                          {duplicate ? t.removeOld : fix.kind === "changedSince" ? t.reattach : t.swap}
                        </button>
                      )}
                      <button
                        type="button"
                        data-fix={fix ? undefined : ""}
                        aria-describedby={nameId}
                        onClick={() => {
                          setKept((k) => new Set([...k, ...issues.map((issue) => `${file.id}:${issue.kind}`)]))
                          focusNext(index)
                        }}
                        className={ghostClass}
                      >
                        {t.keep}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </li>
          )
        })}
      </ul>
      {onSend && (
        <div className="flex justify-end">
          <button
            ref={sendRef}
            type="button"
            onClick={send}
            disabled={pending}
            className={cn(
              "inline-flex h-9 items-center gap-2 rounded-md px-4 text-sm font-medium outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-60",
              asked && flagged ? "bg-amber-700 text-white hover:bg-amber-800 dark:bg-amber-400 dark:text-amber-950" : "bg-primary text-primary-foreground hover:bg-primary/90",
            )}
          >
            {pending && <Loader2 aria-hidden className="size-4 animate-spin" />}
            {asked && flagged ? t.sendAnyway : t.send}
          </button>
        </div>
      )}
    </div>
  )
}
