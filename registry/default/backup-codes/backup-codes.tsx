"use client"

// Bollard UI — backup-codes · MIT licence · https://bollard-ui.vercel.app/components/backup-codes

import * as React from "react"
import { Check, Copy, Download, KeyRound, LoaderCircle, Printer } from "lucide-react"

import { cn } from "@/lib/utils"

type SaveMethod = "download" | "print" | "copy"
const METHODS: SaveMethod[] = ["download", "print", "copy"]
const ICONS = { download: Download, print: Printer, copy: Copy } as const

const button =
  "inline-flex h-9 items-center justify-center gap-2 rounded-md px-4 text-sm font-medium whitespace-nowrap outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50"
const outline = "border bg-background shadow-xs hover:bg-accent dark:border-input dark:bg-input/30 dark:hover:bg-input/50"

/** Folds case, spaces, dashes and look-alikes (O→0, I/L→1) so "4f9k 2m7q" matches "4F9K-2M7Q". */
export function normalizeCode(code: string) {
  return code.toUpperCase().replace(/[\s-]/g, "").replace(/O/g, "0").replace(/[IL]/g, "1")
}

/** A stable index for the code to check, so the same set always asks for the same one (no Math.random in render). */
export function pickCheckIndex(codes: string[]) {
  let hash = 0
  for (const char of codes.join("")) hash = (hash * 31 + char.charCodeAt(0)) >>> 0
  return codes.length ? hash % codes.length : 0
}

/** The plain-text file body used for download, print and copy. */
export function formatCodesFile(codes: string[], account: string, note: string) {
  return [`${account}`, note, "", ...codes.map((code, i) => `${String(i + 1).padStart(2, " ")}. ${code}`), ""].join("\n")
}

const escapeHtml = (text: string) => text.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]!)
const fill = (template: string, values: Record<string, string | number>) =>
  template.replace(/\{(\w+)\}/g, (match, key: string) => String(values[key] ?? match))

export interface BackupCodesProps extends Omit<React.ComponentProps<"section">, "onCopy"> {
  /** The one-time recovery codes, shown once. */
  codes: string[]
  /** Who the codes belong to, written at the top of the file, e.g. "Acme · tushar@example.com". */
  account: string
  /** Called after every required save and the spot check. May return a promise. */
  onContinue: () => void | Promise<void>
  /**
   * Which saves unlock the check: any one of them (default), or every method.
   * One real copy is enough to recover; "all" also forces a printer most people don't have.
   */
  require?: "all" | "any"
  /** Zero-based code the user must type back. Defaults to a stable pick from the set. */
  checkIndex?: number
  /**
   * Let the user paste into the spot check (off by default, so it can't be passed from the clipboard).
   * Turn it on when your users rely on paste, e.g. for motor or cognitive access needs (WCAG 2.2 SC 3.3.8).
   */
  allowPaste?: boolean
  /** Warn before the tab closes until the user continues. */
  warnOnLeave?: boolean
  /** Download file name. */
  fileName?: string
  /** Templates: `{n}` is the 1-based code number, `{count}` the number of codes, `{left}` the saves still to do. */
  title?: string
  /** Text under the title. */
  description?: string
  /** Note written into the downloaded file. */
  fileNote?: string
  /** Download button text. */
  downloadLabel?: string
  /** Print button text. */
  printLabel?: string
  /** Copy button text. */
  copyLabel?: string
  /** Shown when copying to the clipboard fails. */
  copyFailedText?: string
  /** Shown while more save methods are needed ({left} is filled in). */
  saveFirstText?: string
  /** Shown before any save method was used. */
  saveAnyText?: string
  /** Announced once the check unlocks, so screen reader users know the next step appeared. */
  unlockedText?: string
  /** Label of the type-back field ({n} is the code's number). */
  checkLabel?: string
  /** Hint under the type-back field. */
  checkHint?: string
  /** Shown when a paste into the check field is refused. */
  pasteBlockedText?: string
  /** Shown when the typed code does not match. */
  mismatchText?: string
  /** Shown when the typed code matches. */
  matchText?: string
  /** Continue button text. */
  continueLabel?: string
}

/**
 * Stops users locking themselves out by skipping past recovery codes they never
 * saved. Continue stays locked until the codes are downloaded, printed or copied
 * (any one by default, or all three with `require="all"`), then the user types one code back from
 * wherever they saved it. Paste is refused there, so it can't be satisfied from
 * the clipboard, and look-alike characters are forgiven so a correct code never fails.
 */
export function BackupCodes({
  codes,
  account,
  onContinue,
  require = "any",
  checkIndex,
  allowPaste = false,
  warnOnLeave = true,
  fileName = "recovery-codes.txt",
  title = "Save your recovery codes",
  description = "If you lose your phone, each code gets you in once. You won't see them again.",
  fileNote = "Recovery codes. Each code works once. Keep them somewhere safe.",
  downloadLabel = "Download",
  printLabel = "Print",
  copyLabel = "Copy",
  copyFailedText = "Copy was blocked. Select the codes and press Ctrl+C.",
  saveFirstText = "Still to do before you continue: {left}.",
  saveAnyText = "Download, print or copy the codes to continue.",
  unlockedText = "Saved. One last step: type code #{n} below.",
  checkLabel = "Type code #{n} from where you saved it",
  checkHint = "This proves your copy is readable. The code stays valid.",
  pasteBlockedText = "Type it rather than paste, so we know your saved copy works.",
  mismatchText = "That isn't code #{n}. Check your saved copy.",
  matchText = "Code #{n} matches.",
  continueLabel = "Continue",
  className,
  ...props
}: BackupCodesProps) {
  const id = React.useId()
  const [saved, setSaved] = React.useState<SaveMethod[]>([])
  const [typed, setTyped] = React.useState("")
  const [notice, setNotice] = React.useState("")
  const [pasted, setPasted] = React.useState(false)
  const [nudged, setNudged] = React.useState(false)
  const [pending, setPending] = React.useState(false)
  const [done, setDone] = React.useState(false)
  const index = Math.min(checkIndex ?? pickCheckIndex(codes), Math.max(0, codes.length - 1))
  const n = index + 1
  const body = formatCodesFile(codes, account, fileNote)

  const unlocked = require === "all" ? METHODS.every((m) => saved.includes(m)) : saved.length > 0
  const matches = typed.trim() !== "" && normalizeCode(typed) === normalizeCode(codes[index] ?? "")
  const wrongLength = normalizeCode(typed).length >= normalizeCode(codes[index] ?? "").length && !matches
  const names = { download: downloadLabel, print: printLabel, copy: copyLabel }
  const left = METHODS.filter((m) => !saved.includes(m)).map((m) => names[m]).join(", ")
  const mark = (method: SaveMethod) => setSaved((list) => (list.includes(method) ? list : [...list, method]))
  // A manual copy counts only when it holds every code, not one stray line.
  const onManualCopy = () => {
    const copied = normalizeCode(window.getSelection()?.toString() ?? "")
    if (codes.every((code) => copied.includes(normalizeCode(code)))) mark("copy")
  }

  React.useEffect(() => {
    if (!warnOnLeave || done) return
    const onLeave = (event: BeforeUnloadEvent) => event.preventDefault()
    window.addEventListener("beforeunload", onLeave)
    return () => window.removeEventListener("beforeunload", onLeave)
  }, [warnOnLeave, done])

  const save = async (method: SaveMethod) => {
    setNotice("")
    if (method === "download") {
      const url = URL.createObjectURL(new Blob([body], { type: "text/plain" }))
      const link = Object.assign(document.createElement("a"), { href: url, download: fileName })
      link.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    } else if (method === "print") {
      const frame = Object.assign(document.createElement("iframe"), { title: printLabel })
      frame.style.cssText = "position:fixed;width:0;height:0;border:0;opacity:0"
      frame.srcdoc = `<pre style="font:16px/1.8 ui-monospace,monospace;padding:24px">${escapeHtml(body)}</pre>`
      frame.onload = () => {
        frame.contentWindow?.print()
        setTimeout(() => frame.remove(), 1000)
      }
      document.body.append(frame)
    } else {
      try {
        await navigator.clipboard.writeText(body)
      } catch {
        setNotice(copyFailedText)
        return
      }
    }
    mark(method)
  }

  const finish = async () => {
    if (!unlocked || !matches || pending) return
    setPending(true)
    try {
      await onContinue()
      setDone(true)
    } catch {
      // The caller shows the error; the user can try again.
    } finally {
      setPending(false)
    }
  }

  return (
    <section data-slot="backup-codes" data-state={done ? "done" : unlocked ? "checking" : "saving"} aria-labelledby={`${id}-title`} className={cn("grid w-full max-w-md grid-cols-[minmax(0,1fr)] gap-3 rounded-lg border bg-card p-4 text-card-foreground shadow-xs", className)} {...props}>
      <div className="flex gap-3">
        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-muted"><KeyRound aria-hidden className="size-4" /></span>
        <div className="min-w-0 text-sm">
          <h3 id={`${id}-title`} className="font-medium">{title}</h3>
          <p className="text-xs text-muted-foreground">{fill(description, { count: codes.length })}</p>
        </div>
      </div>

      {/* Manual select-and-copy counts as a copy too, so a blocked clipboard is never a dead end. */}
      <ol aria-label={title} onCopy={onManualCopy} className="grid grid-cols-[repeat(auto-fill,minmax(8.5rem,1fr))] gap-x-4 gap-y-1 rounded-md border bg-muted/40 px-3 py-2.5 font-mono text-sm tabular-nums">
        {codes.map((code, i) => (
          <li key={i} className={cn("flex gap-2 rounded-sm px-1 transition-colors", unlocked && i === index && "bg-amber-500/15")}>
            <span aria-hidden className="w-5 shrink-0 text-right text-muted-foreground select-none">{i + 1}.</span>
            <span className="tracking-wide whitespace-nowrap">{code}</span>
          </li>
        ))}
      </ol>

      <div className="flex flex-wrap gap-2">
        {METHODS.map((method) => {
          const Icon = saved.includes(method) ? Check : ICONS[method]
          return (
            <button key={method} type="button" onClick={() => void save(method)} aria-pressed={saved.includes(method)} className={cn(button, "flex-1 basis-24 px-2", outline, saved.includes(method) && "border-emerald-600/40 text-emerald-800 dark:border-emerald-400/40 dark:text-emerald-300")}>
              <Icon aria-hidden className="size-4" /> {names[method]}
            </button>
          )
        })}
      </div>
      <p id={`${id}-todo`} aria-live="polite" className={cn("-mt-1.5 text-xs empty:hidden", notice ? "text-muted-foreground" : unlocked ? "text-emerald-700 dark:text-emerald-400" : nudged ? "font-medium text-amber-700 dark:text-amber-400" : "text-muted-foreground")}>{notice || (unlocked ? (done ? "" : fill(unlockedText, { n })) : require === "all" ? fill(saveFirstText, { left }) : saveAnyText)}</p>

      {!unlocked ? (
        <button type="button" aria-disabled aria-describedby={`${id}-todo`} onClick={() => setNudged(true)} className={cn(button, "cursor-not-allowed justify-self-end bg-primary text-primary-foreground opacity-50")}>{continueLabel}</button>
      ) : (
        <form onSubmit={(event) => { event.preventDefault(); void finish() }} className="grid grid-cols-[minmax(0,1fr)] gap-1.5 border-t pt-3">
          <label htmlFor={`${id}-check`} className="text-sm font-medium">{fill(checkLabel, { n })}</label>
          <div className="flex gap-2">
            <input
              id={`${id}-check`}
              value={typed}
              autoComplete="off"
              spellCheck={false}
              aria-invalid={wrongLength || undefined}
              aria-describedby={`${id}-hint`}
              onChange={(event) => { setTyped(event.target.value); setPasted(false) }}
              onPaste={(event) => {
                if (allowPaste) return
                event.preventDefault()
                setPasted(true)
              }}
              className="h-9 min-w-0 flex-1 rounded-md border bg-transparent px-3 font-mono text-base tracking-wide shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-destructive md:text-sm dark:bg-input/30"
            />
            <button type="submit" disabled={!matches || pending || done} className={cn(button, "bg-primary text-primary-foreground hover:bg-primary/90")}>
              {pending ? <LoaderCircle aria-hidden className="size-4 animate-spin" /> : done ? <Check aria-hidden className="size-4" /> : null}
              {continueLabel}
            </button>
          </div>
          <p id={`${id}-hint`} aria-live="polite" className={cn("text-xs", matches ? "text-emerald-700 dark:text-emerald-400" : wrongLength ? "text-red-700 dark:text-red-400" : pasted ? "text-amber-700 dark:text-amber-400" : "text-muted-foreground")}>
            {matches ? fill(matchText, { n }) : wrongLength ? fill(mismatchText, { n }) : pasted ? pasteBlockedText : checkHint}
          </p>
        </form>
      )}
    </section>
  )
}
