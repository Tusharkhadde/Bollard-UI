"use client"

// Bollard UI — upload-wait · MIT licence · https://bollard-ui.vercel.app/components/upload-wait

import * as React from "react"
import { Check, CircleAlert, LoaderCircle, Paperclip, RotateCcw } from "lucide-react"

import { cn } from "@/lib/utils"

export type UploadStatus = "uploading" | "done" | "error"

export interface UploadItem {
  id: string
  /** File name shown in the list. */
  name: string
  status: UploadStatus
  /** 0 to 1 while uploading. */
  progress?: number
}

type Phase = "idle" | "queued" | "submitting" | "sent"

/** Counts and combined 0–1 progress of what is still uploading. */
export function uploadSummary(uploads: UploadItem[]) {
  const active = uploads.filter((upload) => upload.status === "uploading")
  const failed = uploads.filter((upload) => upload.status === "error")
  const progress = active.length ? active.reduce((sum, upload) => sum + (upload.progress ?? 0), 0) / active.length : 1
  return { active, failed, progress }
}

const fill = (template: string, values: Record<string, string | number>) =>
  template.replace(/\{(\w+)\}/g, (match, key: string) => String(values[key] ?? match))
const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`

export interface UploadWaitProps extends Omit<React.ComponentProps<"form">, "onSubmit"> {
  /** Every upload attached to this form, with its live status. */
  uploads: UploadItem[]
  /** Runs once every upload is done. Gets the form's data as it is at that moment. Return a promise for a pending state. */
  onSubmit: (data: FormData) => void | Promise<void>
  /** Retries a failed upload. */
  onRetry: (id: string) => void
  /** Label of the submit button. */
  submitLabel?: string
  /** `{count}` is "2 uploads". */
  waitingLabel?: string
  /** Label when an upload failed. */
  failedLabel?: string
  /** Label while onSubmit runs. */
  submittingLabel?: string
  /** Label after sending. */
  sentLabel?: string
  /** Label of the cancel-queued-send button. */
  cancelLabel?: string
  /** Label prefix of each retry button. */
  retryLabel?: string
  /** Hint while uploads run and nothing is queued. `{count}` and `{submit}` are filled in. */
  idleHint?: string
  /** Hint while the send is queued. */
  queuedHint?: string
  /** Hint when an upload failed. */
  failedHint?: string
  /** Accessible name of the upload list. */
  listLabel?: string
  /** Accessible label of the done tick. */
  uploadedLabel?: string
}

/**
 * Stops a form from being sent before its attachments exist. Pressing submit
 * while files are still uploading validates the form, then queues the send:
 * the button fills with combined progress and reads "Waiting for 2 uploads…",
 * and the form submits by itself (with the data as it is then) once they
 * finish. A failed upload pauses the queue until it's retried, and closing
 * the tab mid-upload asks first.
 */
export function UploadWait({
  uploads,
  onSubmit,
  onRetry,
  submitLabel = "Submit",
  waitingLabel = "Waiting for {count}…",
  failedLabel = "{count} failed",
  submittingLabel = "Sending…",
  sentLabel = "Sent",
  cancelLabel = "Don't send yet",
  retryLabel = "Retry",
  idleHint = "{count} still uploading. You can press {submit} now; it sends when they finish.",
  queuedHint = "Sends automatically when they finish.",
  failedHint = "Retry the failed upload to send.",
  listLabel = "Uploads",
  uploadedLabel = "Uploaded",
  className,
  children,
  ref,
  ...props
}: UploadWaitProps) {
  const formRef = React.useRef<HTMLFormElement>(null)
  const retryRef = React.useRef<HTMLButtonElement>(null)
  const [phase, setPhaseState] = React.useState<Phase>("idle")
  // Mirrors `phase` synchronously, so two presses in one tick can't both send.
  const phaseRef = React.useRef<Phase>("idle")
  const setPhase = React.useCallback((next: Phase) => {
    phaseRef.current = next
    setPhaseState(next)
  }, [])
  const { active, failed, progress } = uploadSummary(uploads)
  const busy = active.length > 0 || phase === "queued" || phase === "submitting"

  const send = React.useCallback(async () => {
    if (!formRef.current) return
    setPhase("submitting")
    try {
      await onSubmit(new FormData(formRef.current))
      setPhase("sent")
    } catch {
      setPhase("idle")
    }
  }, [onSubmit, setPhase])

  React.useEffect(() => {
    if (phaseRef.current === "queued" && active.length === 0 && failed.length === 0) void send()
  }, [phase, active.length, failed.length, send])

  React.useEffect(() => {
    if (!busy) return
    const warn = (event: BeforeUnloadEvent) => event.preventDefault()
    window.addEventListener("beforeunload", warn)
    return () => window.removeEventListener("beforeunload", warn)
  }, [busy])

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (phaseRef.current !== "idle") return
    if (failed.length) retryRef.current?.focus()
    if (active.length || failed.length) setPhase("queued")
    else void send()
  }

  const paused = phase === "queued" && failed.length > 0
  const label =
    phase === "submitting" ? submittingLabel
    : phase === "sent" ? sentLabel
    : paused || (phase === "idle" && failed.length) ? fill(failedLabel, { count: plural(failed.length, "upload", "uploads") })
    : phase === "queued" ? fill(waitingLabel, { count: plural(active.length, "upload", "uploads") })
    : submitLabel
  const hint = paused || failed.length ? failedHint
    : phase === "queued" ? queuedHint
    : active.length && phase === "idle" ? fill(idleHint, { count: plural(active.length, "upload", "uploads"), submit: submitLabel })
    : ""

  const setRefs = (node: HTMLFormElement | null) => {
    formRef.current = node
    if (typeof ref === "function") ref(node)
    else if (ref) ref.current = node
  }

  return (
    <form ref={setRefs} data-slot="upload-wait" data-state={paused ? "paused" : phase} onSubmit={handleSubmit} className={cn("grid w-full gap-3", className)} {...props}>
      {children}
      {uploads.length > 0 && (
        <ul aria-label={listLabel} className="grid gap-1.5">
          {uploads.map((upload) => (
            <li key={upload.id} className="flex h-9 items-center gap-2 rounded-md border px-3 text-sm dark:bg-input/30">
              <Paperclip aria-hidden className="size-3.5 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1 truncate">{upload.name}</span>
              {upload.status === "uploading" && (
                <span className="flex items-center gap-2 text-xs text-muted-foreground tabular-nums">
                  <span className="h-1 w-14 overflow-hidden rounded-full bg-muted">
                    <span className="block h-full origin-left bg-primary transition-transform duration-300 ease-out motion-reduce:transition-none" style={{ transform: `scaleX(${upload.progress ?? 0})` }} />
                  </span>
                  {Math.round((upload.progress ?? 0) * 100)}%
                </span>
              )}
              {upload.status === "done" && <Check aria-label={uploadedLabel} className="size-4 text-emerald-600 dark:text-emerald-400" />}
              {upload.status === "error" && (
                <button
                  ref={upload.id === failed[0]?.id ? retryRef : undefined}
                  type="button"
                  onClick={() => onRetry(upload.id)}
                  aria-label={`${retryLabel} ${upload.name}`}
                  className="inline-flex h-6 items-center gap-1 rounded-md border border-red-500/40 px-2 text-xs font-medium text-red-700 transition-colors outline-none hover:bg-red-500/10 focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:text-red-300"
                >
                  <RotateCcw aria-hidden className="size-3" />
                  {retryLabel}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-2">
        <p aria-live="polite" className={cn("mr-auto flex min-w-44 basis-44 flex-1 items-start gap-1.5 text-xs", failed.length ? "text-red-700 dark:text-red-400" : "text-muted-foreground")}>
          {failed.length > 0 && <CircleAlert aria-hidden className="mt-px size-3.5 shrink-0" />}
          {hint}
        </p>
        {phase === "queued" && (
          <button type="button" onClick={() => setPhase("idle")} className="inline-flex h-9 items-center rounded-md px-3 text-sm font-medium outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50">
            {cancelLabel}
          </button>
        )}
        <button
          type="submit"
          aria-busy={phase === "queued" || phase === "submitting" || undefined}
          aria-disabled={phase === "sent" || undefined}
          className={cn(
            "relative inline-flex h-9 shrink-0 items-center justify-center gap-2 overflow-hidden rounded-md px-4 text-sm font-medium whitespace-nowrap shadow-xs transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
            failed.length ? "bg-destructive text-white hover:bg-destructive/90 dark:bg-destructive/60" : "bg-primary text-primary-foreground hover:bg-primary/90",
          )}
        >
          {phase === "queued" && !paused && (
            <span aria-hidden className="absolute inset-0 origin-left bg-white/20 transition-transform duration-300 ease-out motion-reduce:transition-none dark:bg-black/15" style={{ transform: `scaleX(${progress})` }} />
          )}
          {(phase === "queued" && !paused) || phase === "submitting" ? <LoaderCircle aria-hidden className="relative size-4 animate-spin motion-reduce:animate-none" /> : null}
          {phase === "sent" && <Check aria-hidden className="size-4" />}
          <span className="relative">{label}</span>
        </button>
      </div>
    </form>
  )
}
