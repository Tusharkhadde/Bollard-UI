"use client"

// Bollard UI — replace-file · MIT licence · https://bollard-ui.vercel.app/components/replace-file

import * as React from "react"
import { FileText, LoaderCircle, TriangleAlert, Upload } from "lucide-react"

import { cn } from "@/lib/utils"

export interface UploadFileInfo {
  name: string
  /** Bytes. */
  size: number
  modified: Date | number | string
  /** Image URL for a thumbnail. Without it, the extension is shown. */
  preview?: string
}

export interface FileConflict {
  incoming: UploadFileInfo
  existing: UploadFileInfo
}

export type ConflictAction = "replace" | "keep-both" | "skip"
/** File name → chosen action. */
export type ConflictChoices = Record<string, ConflictAction>

const time = (d: UploadFileInfo["modified"]) => new Date(d).getTime()

/** Which copy is newer and larger, whether they look identical, and whether replacing would put an older file over a newer one. */
export function compareFiles({ incoming, existing }: FileConflict) {
  const dt = time(incoming.modified) - time(existing.modified)
  return {
    identical: dt === 0 && incoming.size === existing.size,
    olderOverNewer: dt < 0,
    newer: dt > 0 ? "incoming" : dt < 0 ? "existing" : null,
    larger: incoming.size > existing.size ? "incoming" : incoming.size < existing.size ? "existing" : null,
  }
}

/** "report.pdf" → "report (1).pdf", skipping names already taken. */
export function keepBothName(name: string, taken: string[]) {
  const dot = name.lastIndexOf(".")
  const [base, ext] = dot > 0 ? [name.slice(0, dot), name.slice(dot)] : [name, ""]
  let n = 1
  while (taken.includes(`${base} (${n})${ext}`)) n++
  return `${base} (${n})${ext}`
}

export function formatBytes(bytes: number) {
  const units = ["B", "KB", "MB", "GB"]
  let i = 0
  while (bytes >= 1024 && i < units.length - 1) (bytes /= 1024), i++
  return `${bytes.toFixed(i && bytes < 10 ? 1 : 0)} ${units[i]}`
}

const fixClass =
  "inline-flex h-6 shrink-0 items-center gap-1 rounded-md border border-amber-500/40 px-2 font-medium text-amber-900 transition-colors hover:bg-amber-500/10 dark:text-amber-200 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
const segment =
  "flex h-8 flex-1 cursor-pointer items-center justify-center rounded-md px-2 text-xs font-medium whitespace-nowrap text-muted-foreground transition-colors has-[:checked]:bg-background has-[:checked]:text-foreground has-[:checked]:shadow-xs has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-ring/50"

export interface ReplaceFileProps extends Omit<React.ComponentProps<"form">, "onSubmit" | "defaultValue" | "title"> {
  /** Each name clash: the existing and incoming file. */
  conflicts: FileConflict[]
  /** Files in the same upload that don't clash; said out loud so "apply to all" never seems to touch them. */
  otherCount?: number
  /** Every name already in the folder, so "Keep both" never picks a taken name. */
  existingNames?: string[]
  /** Chosen action per file name (controlled). */
  value?: ConflictChoices
  /** Starting choices when uncontrolled. */
  defaultValue?: ConflictChoices
  /** Called with every choice change. */
  onValueChange?: (choices: ConflictChoices) => void
  /** Runs with every decision. Return a promise to show a pending state; a rejection is caught. */
  onContinue: (result: { name: string; action: ConflictAction; savedAs?: string }[]) => void | Promise<void>
  /** Formats file dates. */
  formatDate?: (date: Date) => string
  /** Labels of the replace, keep-both and skip options. */
  labels?: { replace: string; "keep-both": string; skip: string }
  /** Heading for the given number of clashes. */
  title?: (count: number) => string
  /** Says how many non-clashing files upload as normal. */
  othersText?: (count: number) => string
  /** Label of an apply-to-all button. */
  applyAllLabel?: (count: number) => string
  /** Warning when an older file would replace a newer one. */
  olderText?: string
  /** Label of the one-tap Keep both fix. */
  keepBothFix?: string
  /** Warning when apply-to-all would put older files over newer ones. */
  bulkOlderText?: (count: number) => string
  /** Label of the bulk Keep both fix. */
  bulkOlderFix?: (count: number) => string
  /** Shown when both copies look identical. */
  identicalText?: string
  /** Label of the one-tap Skip for identical copies. */
  skipFix?: string
  /** Preview of the renamed copy's name. */
  savedAsText?: (name: string) => string
  /** Label above the existing copy. */
  existingLabel?: string
  /** Label above the incoming copy. */
  incomingLabel?: string
  /** Label of the Continue button. */
  continueLabel?: string
  /** Shown while clashes are undecided. */
  undecidedLabel?: (count: number) => string
  /** Continue label while onContinue runs. */
  pendingLabel?: string
}

/**
 * The "file already exists" step for uploads. Each clash shows both copies
 * side by side with thumbnail, size and date (the newer and larger values in
 * bold), flags an older file about to replace a newer one, spots identical
 * copies, previews the "Keep both" name, and applies one choice to all with
 * counts, saying plainly that the other files upload as normal.
 */
export function ReplaceFile({
  conflicts,
  otherCount = 0,
  existingNames = [],
  value,
  defaultValue = {},
  onValueChange,
  onContinue,
  formatDate = (d) => d.toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }),
  labels = { replace: "Replace", "keep-both": "Keep both", skip: "Skip" },
  title = (n) => (n === 1 ? "This file already exists" : `${n} files already exist`),
  othersText = (n) => `${n} other ${n === 1 ? "file uploads" : "files upload"} as normal.`,
  applyAllLabel = (n) => `Apply to all ${n}:`,
  olderText = "The upload is older than the copy it would replace.",
  keepBothFix = "Keep both instead",
  bulkOlderText = (n) => `${n} of these would replace a newer file.`,
  bulkOlderFix = (n) => `Keep both for ${n === 1 ? "that one" : `those ${n}`}`,
  identicalText = "Same size and date. Probably the same file.",
  skipFix = "Skip it",
  savedAsText = (name) => `Saved as ${name}`,
  existingLabel = "In folder",
  incomingLabel = "Uploading",
  continueLabel = "Upload",
  undecidedLabel = (n) => `Choose for ${n} more`,
  pendingLabel = "Uploading…",
  className,
  ...props
}: ReplaceFileProps) {
  const [inner, setInner] = React.useState(defaultValue)
  const [pending, setPending] = React.useState(false)
  const listRef = React.useRef<HTMLUListElement>(null)
  const baseId = React.useId()
  const choices = value ?? inner
  const facts = conflicts.map((c) => ({ ...c, ...compareFiles(c) }))
  const taken = [...existingNames, ...conflicts.map((c) => c.existing.name)]
  const undecided = conflicts.filter((c) => !choices[c.incoming.name]).length
  const riskyReplace = facts.filter((f) => f.olderOverNewer && choices[f.incoming.name] === "replace")
  const counts = (["replace", "keep-both", "skip"] as const).map((a) => [a, conflicts.filter((c) => choices[c.incoming.name] === a).length] as const)

  const set = (next: ConflictChoices, flash: string[] = []) => {
    if (value === undefined) setInner(next)
    onValueChange?.(next)
    requestAnimationFrame(() => {
      if (matchMedia("(prefers-reduced-motion: reduce)").matches) return
      flash.forEach((name) =>
        listRef.current?.querySelector(`[data-name="${CSS.escape(name)}"]`)?.animate([{ backgroundColor: "rgb(245 158 11 / 0.22)" }, { backgroundColor: "transparent" }], { duration: 400, easing: "ease-out" }),
      )
    })
  }
  const applyAll = (action: ConflictAction) =>
    set(Object.fromEntries(conflicts.map((c) => [c.incoming.name, action])), action === "replace" ? facts.filter((f) => f.olderOverNewer).map((f) => f.incoming.name) : [])

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (pending || undecided) return
    setPending(true)
    try {
      await onContinue(conflicts.map(({ incoming: { name } }) => ({ name, action: choices[name], savedAs: choices[name] === "keep-both" ? keepBothName(name, taken) : undefined })))
    } catch {
      // The caller reports the error; the choices stay to retry.
    } finally {
      setPending(false)
    }
  }

  const side = (file: UploadFileInfo, label: string, newer: boolean, larger: boolean) => (
    <div className="flex min-w-0 flex-1 flex-col gap-1.5 @xs:flex-row @xs:gap-2">
      {file.preview ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={file.preview} alt="" className="size-10 shrink-0 rounded border object-cover" />
      ) : (
        <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded border bg-muted text-[10px] font-medium text-muted-foreground uppercase">
          <FileText className="size-4" />
          {file.name.split(".").pop()?.slice(0, 4)}
        </span>
      )}
      <dl className="min-w-0 text-xs">
        <dt className="text-muted-foreground">{label}</dt>
        <dd className={cn(larger && "font-semibold")}>{formatBytes(file.size)}</dd>
        <dd className={cn("whitespace-nowrap", newer && "font-semibold")}>{formatDate(new Date(file.modified))}</dd>
      </dl>
    </div>
  )

  return (
    <form data-slot="replace-file" aria-labelledby={`${baseId}-title`} onSubmit={submit} className={cn("w-full max-w-lg space-y-3 rounded-xl border bg-card p-4 text-card-foreground sm:p-5", className)} {...props}>
      <div>
        <h3 id={`${baseId}-title`} className="font-medium">{title(conflicts.length)}</h3>
        {otherCount > 0 && <p className="text-xs text-muted-foreground">{othersText(otherCount)}</p>}
      </div>

      {conflicts.length > 1 && (
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-muted-foreground">{applyAllLabel(conflicts.length)}</span>
          {(["replace", "keep-both", "skip"] as const).map((action) => (
            <button key={action} type="button" onClick={() => applyAll(action)} className="inline-flex h-8 items-center rounded-md border bg-background px-2.5 font-medium shadow-xs outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:border-input dark:bg-input/30">
              {labels[action]}
            </button>
          ))}
        </div>
      )}

      {riskyReplace.length > 1 && (
        <p aria-live="polite" className="flex flex-wrap items-center gap-x-2 gap-y-1.5 text-xs text-amber-900 dark:text-amber-100">
          <span className="flex min-w-0 flex-1 basis-40 gap-1.5">
            <TriangleAlert aria-hidden className="mt-px size-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
            {bulkOlderText(riskyReplace.length)}
          </span>
          <button type="button" className={fixClass} onClick={() => set({ ...choices, ...Object.fromEntries(riskyReplace.map((f) => [f.incoming.name, "keep-both"])) })}>
            {bulkOlderFix(riskyReplace.length)}
          </button>
        </p>
      )}

      <ul ref={listRef} className="divide-y rounded-lg border">
        {facts.map((f) => {
          const name = f.incoming.name
          const action = choices[name]
          return (
            <li key={name} data-name={name} className="@container space-y-2 p-3">
              <p className="truncate text-sm font-medium" title={name}>{name}</p>
              <div className="flex gap-3">
                {side(f.existing, existingLabel, f.newer === "existing", f.larger === "existing")}
                {side(f.incoming, incomingLabel, f.newer === "incoming", f.larger === "incoming")}
              </div>
              <div role="radiogroup" aria-label={`${name}: what to do`} className="flex gap-1 rounded-lg bg-muted p-1">
                {(["replace", "keep-both", "skip"] as const).map((a) => (
                  <label key={a} className={segment}>
                    <input type="radio" name={`${baseId}-${name}`} checked={action === a} onChange={() => set({ ...choices, [name]: a })} className="sr-only" />
                    {labels[a]}
                  </label>
                ))}
              </div>
              <div aria-live="polite" className="text-xs empty:hidden">
                {f.olderOverNewer && action !== "keep-both" && action !== "skip" ? (
                  <p className="flex flex-wrap items-center gap-x-2 gap-y-1.5 text-amber-900 dark:text-amber-100">
                    <span className="flex min-w-0 flex-1 basis-40 gap-1.5">
                      <TriangleAlert aria-hidden className="mt-px size-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
                      {olderText}
                    </span>
                    <button type="button" className={fixClass} onClick={() => set({ ...choices, [name]: "keep-both" })}>{keepBothFix}</button>
                  </p>
                ) : f.identical && action !== "skip" ? (
                  <p className="flex flex-wrap items-center gap-x-2 gap-y-1.5 text-muted-foreground">
                    <span className="min-w-0 flex-1 basis-40">{identicalText}</span>
                    <button type="button" className={cn(fixClass, "border-border text-foreground hover:bg-accent dark:text-foreground")} onClick={() => set({ ...choices, [name]: "skip" })}>{skipFix}</button>
                  </p>
                ) : action === "keep-both" ? (
                  <p className="truncate text-muted-foreground">{savedAsText(keepBothName(name, taken))}</p>
                ) : null}
              </div>
            </li>
          )
        })}
      </ul>

      <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-2">
        <p aria-live="polite" className="mr-auto text-xs text-muted-foreground">
          {counts.filter(([, n]) => n).map(([a, n]) => `${labels[a]} ${n}`).join(" · ")}
        </p>
        <button type="submit" disabled={undecided > 0} aria-busy={pending || undefined} className="inline-flex h-9 items-center justify-center gap-2 rounded-md [&_svg]:shrink-0 bg-primary px-4 text-sm font-medium whitespace-nowrap text-primary-foreground shadow-xs outline-none transition-colors hover:bg-primary/90 focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 aria-busy:cursor-progress">
          {pending ? <LoaderCircle aria-hidden className="size-4 animate-spin" /> : <Upload aria-hidden className="size-4" />}
          {pending ? pendingLabel : undecided ? undecidedLabel(undecided) : continueLabel}
        </button>
      </div>
    </form>
  )
}
