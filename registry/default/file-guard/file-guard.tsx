"use client"

import * as React from "react"
import { FileCheck2, FileWarning, Upload, Wand2, X } from "lucide-react"

import { cn } from "@/lib/utils"
import { checkFile, fingerprint, formatBytes, type FileVerdict } from "@/registry/default/file-guard/file-check"

export { checkFile, formatBytes, sniffFileType, type FileCheckOptions, type FileVerdict, type SniffedType } from "@/registry/default/file-guard/file-check"

interface Entry extends FileVerdict {
  id: number
}

export interface FileGuardHandle {
  /** Validate and add files programmatically (paste handlers, tests, demos). */
  addFiles: (files: File[]) => Promise<void>
}

export interface FileGuardProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "children"> {
  /** Allowed extensions, e.g. [".pdf", ".png"]. Omit to allow any type. */
  accept?: string[]
  /** Largest allowed file in bytes. */
  maxSize?: number
  /** Most files that can be accepted at once. */
  maxFiles?: number
  /** Called with only the files that passed every check, whenever that list changes. */
  onFilesChange?: (files: File[]) => void
  /** Visible label for the drop zone's browse button. */
  label?: string
  /** Text before the limits under the label. */
  hint?: string
  /** Imperative handle exposing `addFiles`. */
  ref?: React.Ref<FileGuardHandle>
}

/**
 * A dropzone that checks files before anything uploads: size, type, count,
 * empty files and duplicates, and it reads the first bytes to catch a renamed
 * extension ("This .pdf is actually a PNG"), with a one-tap rename fix.
 */
export function FileGuard({
  accept,
  maxSize,
  maxFiles,
  onFilesChange,
  label = "Upload files",
  hint = "Drop files here or browse",
  ref,
  className,
  ...props
}: FileGuardProps) {
  const [entries, setEntries] = React.useState<Entry[]>([])
  const [dragging, setDragging] = React.useState(false)
  const [announcement, setAnnouncement] = React.useState("")
  const entriesRef = React.useRef(entries)
  const queue = React.useRef(Promise.resolve())
  const nextId = React.useRef(0)
  const inputRef = React.useRef<HTMLInputElement>(null)
  const onChangeRef = React.useRef(onFilesChange)
  const hintId = React.useId()
  const allowed = accept?.map((a) => a.replace(/^\./, "").toLowerCase())
  const options = { allowed, maxSize, maxFiles }

  React.useEffect(() => {
    onChangeRef.current = onFilesChange
  })

  const commit = (next: Entry[]) => {
    const before = entriesRef.current.filter((e) => !e.reason).map((e) => e.file)
    const after = next.filter((e) => !e.reason).map((e) => e.file)
    entriesRef.current = next
    setEntries(next)
    if (before.length !== after.length || before.some((f, i) => f !== after[i])) onChangeRef.current?.(after)
  }

  // Batches run one after another, so two quick drops can't both slip under maxFiles or add the same file twice.
  const addFiles = (files: File[]) =>
    (queue.current = queue.current.then(async () => {
      const seen = new Set(entriesRef.current.filter((e) => !e.reason).map((e) => fingerprint(e.file)))
      const added: Entry[] = []
      for (const file of files) {
        const verdict = await checkFile(file, options, seen)
        if (!verdict.reason) seen.add(fingerprint(file))
        added.push({ ...verdict, id: nextId.current++ })
      }
      commit([...entriesRef.current, ...added])
      const bad = added.filter((e) => e.reason)
      setAnnouncement(
        bad.length
          ? bad.map((e) => `${e.file.name}: ${e.reason}`).join(" ")
          : `${added.length} ${added.length === 1 ? "file" : "files"} ready.`
      )
    }))

  React.useImperativeHandle(ref, () => ({ addFiles }))

  const remove = (id: number) => commit(entriesRef.current.filter((e) => e.id !== id))
  const applyFix = (id: number) =>
    commit(entriesRef.current.map((e) => (e.id === id && e.fix ? { id, file: e.fix.file } : e)))

  const okCount = entries.filter((e) => !e.reason).length
  const badCount = entries.length - okCount
  const limits = [
    allowed?.map((a) => a.toUpperCase()).join(", "),
    maxSize !== undefined && `up to ${formatBytes(maxSize)}`,
    maxFiles !== undefined && `max ${maxFiles} files`,
  ].filter(Boolean)

  return (
    <div data-slot="file-guard" className={cn("w-full max-w-md space-y-3 text-sm", className)} {...props}>
      <div
        onDragOver={(event) => {
          event.preventDefault()
          setDragging(true)
        }}
        onDragLeave={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node)) setDragging(false)
        }}
        onDrop={(event) => {
          event.preventDefault()
          setDragging(false)
          void addFiles(Array.from(event.dataTransfer.files))
        }}
        data-dragging={dragging || undefined}
        className="flex flex-col items-center gap-2 rounded-lg border border-dashed bg-muted/30 p-6 text-center transition-colors data-dragging:border-primary data-dragging:bg-accent"
      >
        <Upload className="size-5 text-muted-foreground" aria-hidden />
        <button
          type="button"
          aria-describedby={hintId}
          onClick={() => inputRef.current?.click()}
          className="rounded-md font-medium underline-offset-4 outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          {label}
        </button>
        <p id={hintId} className="text-xs text-muted-foreground">
          {hint}
          {limits.length > 0 && ` · ${limits.join(" · ")}`}
        </p>
        <input
          ref={inputRef}
          type="file"
          multiple={maxFiles !== 1}
          accept={allowed?.map((a) => `.${a}`).join(",")}
          className="sr-only"
          tabIndex={-1}
          aria-hidden
          onChange={(event) => {
            void addFiles(Array.from(event.target.files ?? []))
            event.target.value = ""
          }}
        />
      </div>

      {entries.length > 0 && (
        <ul className="space-y-2" aria-label="Selected files">
          {entries.map((entry) => (
            <li
              key={entry.id}
              className={cn(
                "flex items-start gap-2 rounded-lg border bg-card p-3",
                entry.reason && "border-red-300 bg-red-50 text-red-950 dark:border-red-900 dark:bg-red-950/40 dark:text-red-50"
              )}
            >
              {entry.reason ? (
                <FileWarning className="mt-0.5 size-4 shrink-0 text-red-600 dark:text-red-400" aria-hidden />
              ) : (
                <FileCheck2 className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
              )}
              <div className="min-w-0 flex-1">
                <p className="flex min-w-0 items-baseline gap-1.5">
                  <span className="truncate font-medium" title={entry.file.name}>
                    {entry.file.name}
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">{formatBytes(entry.file.size)}</span>
                </p>
                {entry.reason && <p className="mt-0.5 text-xs text-red-700 dark:text-red-300">{entry.reason}</p>}
                {entry.fix && (
                  <button
                    type="button"
                    onClick={() => applyFix(entry.id)}
                    className="mt-2 inline-flex h-8 items-center gap-2 rounded-md border bg-background px-3 text-sm font-medium text-foreground outline-none transition-colors hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50"
                  >
                    <Wand2 aria-hidden className="size-4" />
                    {entry.fix.label}
                  </button>
                )}
              </div>
              <button
                type="button"
                onClick={() => remove(entry.id)}
                aria-label={`Remove ${entry.file.name}`}
                className="-my-1 grid size-8 shrink-0 place-items-center rounded-md text-muted-foreground outline-none hover:bg-accent hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                <X className="size-4" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
      {entries.length > 0 && (
        <p className="text-xs text-muted-foreground">
          {okCount} ready{badCount > 0 && ` · ${badCount} need${badCount === 1 ? "s" : ""} attention`}
        </p>
      )}
      <span aria-live="polite" className="sr-only">
        {announcement}
      </span>
    </div>
  )
}
