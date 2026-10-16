"use client"

import * as React from "react"
import { FileArchive, Link2, Paperclip } from "lucide-react"

import { cn } from "@/lib/utils"

export interface AttachmentFile {
  name: string
  /** Size on disk, in bytes. */
  size: number
}

export interface SendLimit {
  id: string
  label: string
  /** Largest message the service accepts, in bytes. */
  limit: number
  /** Email counts the Base64-encoded message, about 37% bigger than the files on disk. */
  encoded?: boolean
}

const MB = 1024 * 1024
/** Base64 (4/3) plus a CRLF every 76 characters: what mail servers actually measure. */
export const ENCODING_OVERHEAD = 1.37

export const DEFAULT_LIMITS: SendLimit[] = [
  { id: "gmail", label: "Gmail", limit: 25 * MB, encoded: true },
  { id: "outlook", label: "Outlook.com", limit: 20 * MB, encoded: true },
  { id: "discord", label: "Discord (free)", limit: 10 * MB },
]

/** Size the service will measure for these bytes. */
export const sentSize = (bytes: number, limit: SendLimit) => Math.ceil(limit.encoded ? bytes * ENCODING_OVERHEAD : bytes)

const total = (files: AttachmentFile[]) => files.reduce((sum, file) => sum + file.size, 0)

/** Fewest files to take out (largest first) so the rest fits. Empty when everything fits. */
export function filesOverLimit(files: AttachmentFile[], limit: SendLimit) {
  const rest = [...files].sort((a, b) => b.size - a.size)
  const over: AttachmentFile[] = []
  while (rest.length && sentSize(total(rest), limit) > limit.limit) over.push(rest.shift()!)
  return over
}

/**
 * Honest size after compression. Photos shrink a lot when resized; text and raw formats
 * zip well; JPEG video, MP4, ZIP and Office files (already ZIPs) barely change at all.
 */
export function estimateCompressed(file: AttachmentFile) {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? ""
  if (/^(jpe?g|png|heic|webp)$/.test(ext)) return Math.round(file.size * 0.3)
  if (/^(txt|csv|log|json|xml|svg|bmp|tiff?|wav|psd)$/.test(ext)) return Math.round(file.size * 0.35)
  if (ext === "pdf") return Math.round(file.size * 0.8)
  return file.size
}

export const formatSize = (bytes: number) =>
  bytes < MB ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / MB).toFixed(bytes < 10 * MB ? 1 : 0)} MB`

const fill = (template: string, values: Record<string, string | number>) =>
  template.replace(/\{(\w+)\}/g, (match, key: string) => String(values[key] ?? match))

const btn =
  "inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-md px-3 text-sm font-medium whitespace-nowrap outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50"

export interface LargeAttachmentProps extends Omit<React.ComponentProps<"div">, "defaultValue"> {
  /** Files currently attached. */
  files: AttachmentFile[]
  /** Services to check against. The selected one drives the fixes. */
  limits?: SendLimit[]
  /** Controlled id of the service you are sending through. */
  value?: string
  /** Initial service id when uncontrolled. */
  defaultValue?: string
  onValueChange?: (id: string) => void
  /** Upload these files and send a link instead. */
  onSendAsLink?: (files: AttachmentFile[]) => void
  /** Compress the attachments. Receives the estimated result size. */
  onCompress?: (estimatedBytes: number) => void
  /** Override the compression estimate per file. */
  estimate?: (file: AttachmentFile) => number
  /** Templates: `{size}`, `{limit}`, `{over}`, `{raw}`, `{count}` are filled in. */
  overText?: string
  encodedText?: string
  fitsText?: string
  culpritLabel?: string
  linkLabel?: string
  compressLabel?: string
  noGainText?: string
  fitsLabel?: string
  tooBigLabel?: string
  groupLabel?: string
}

/**
 * Catches the email that bounces for being too big. It checks the attachments against each
 * service's real limit (email counts the Base64-encoded size, so 20 MB of files is ~27 MB sent),
 * marks the fewest files that push it over, and shows what "send as link" or compressing would
 * leave, with an honest estimate that admits when files are already compressed.
 */
export function LargeAttachment({
  files,
  limits = DEFAULT_LIMITS,
  value,
  defaultValue,
  onValueChange,
  onSendAsLink,
  onCompress,
  estimate = estimateCompressed,
  overText = "{size} won't send: {over} over the {limit} limit.",
  encodedText = "Your files are {raw}, but email encoding adds about 37%.",
  fitsText = "{size} fits the {limit} limit.",
  culpritLabel = "Pushes it over",
  linkLabel = "Send {count} as a link",
  compressLabel = "Compress",
  noGainText = "already compressed",
  fitsLabel = "fits",
  tooBigLabel = "still too big",
  groupLabel = "Send through",
  className,
  ...props
}: LargeAttachmentProps) {
  const [inner, setInner] = React.useState(defaultValue ?? limits[0]?.id)
  const selectedId = value ?? inner
  const selected = limits.find((l) => l.id === selectedId) ?? limits[0]
  const raw = total(files)
  const culprits = filesOverLimit(files, selected)
  const keptAfterLink = sentSize(raw - total(culprits), selected)
  const compressedRaw = files.reduce((sum, file) => sum + Math.min(file.size, estimate(file)), 0)
  const compressed = sentSize(compressedRaw, selected)
  const sent = sentSize(raw, selected)
  const over = sent > selected.limit
  const values = { size: formatSize(sent), limit: formatSize(selected.limit), over: formatSize(sent - selected.limit), raw: formatSize(raw), count: culprits.length === 1 ? "1 file" : `${culprits.length} files` }

  const choose = (id: string) => {
    if (value === undefined) setInner(id)
    onValueChange?.(id)
  }

  return (
    <div data-slot="large-attachment" data-state={over ? "over" : "fits"} className={cn("w-full max-w-md space-y-3 text-sm", className)} {...props}>
      <div role="radiogroup" aria-label={groupLabel} className="grid gap-1.5">
        {limits.map((limit) => {
          const size = sentSize(raw, limit)
          const isOver = size > limit.limit
          const checked = limit.id === selected.id
          return (
            <button
              key={limit.id}
              type="button"
              role="radio"
              aria-checked={checked}
              onClick={() => choose(limit.id)}
              onKeyDown={(event) => {
                const step = event.key === "ArrowDown" || event.key === "ArrowRight" ? 1 : event.key === "ArrowUp" || event.key === "ArrowLeft" ? -1 : 0
                if (!step) return
                event.preventDefault()
                const next = limits[(limits.indexOf(limit) + step + limits.length) % limits.length]
                choose(next.id)
                ;(event.currentTarget.parentElement?.querySelector(`[data-id="${next.id}"]`) as HTMLElement | null)?.focus()
              }}
              tabIndex={checked ? 0 : -1}
              data-id={limit.id}
              className={cn(
                "grid gap-1.5 rounded-md border px-3 py-2 text-left outline-none transition-colors hover:bg-accent/50 focus-visible:ring-[3px] focus-visible:ring-ring/50",
                checked && "border-foreground/30 bg-accent/40",
              )}
            >
              <span className="flex items-baseline justify-between gap-2">
                <span className="font-medium">{limit.label}</span>
                <span className={cn("text-xs tabular-nums", isOver ? "font-medium text-amber-700 dark:text-amber-400" : "text-muted-foreground")}>
                  {formatSize(size)} / {formatSize(limit.limit)}
                </span>
              </span>
              <span className="relative h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
                <span
                  className={cn("absolute inset-y-0 left-0 rounded-full transition-[width] duration-300 ease-out motion-reduce:transition-none", isOver ? "bg-amber-500" : "bg-emerald-500")}
                  style={{ width: `${Math.min(100, (size / limit.limit) * 100)}%` }}
                />
              </span>
            </button>
          )
        })}
      </div>

      <div aria-live="polite" className="space-y-1">
        <p className={cn("font-medium", over ? "text-amber-800 dark:text-amber-300" : "text-emerald-700 dark:text-emerald-400")}>
          {fill(over ? overText : fitsText, values)}
        </p>
        {over && selected.encoded && raw <= selected.limit && <p className="text-xs text-muted-foreground">{fill(encodedText, values)}</p>}
      </div>

      <ul className="divide-y rounded-md border" aria-label="Attachments">
        {files.map((file, index) => {
          const culprit = culprits.includes(file)
          return (
            <li key={`${file.name}-${index}`} className="flex items-center gap-2 px-3 py-2">
              <Paperclip aria-hidden className="size-3.5 shrink-0 text-muted-foreground" />
              <span className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1">
                <span className="max-w-full truncate" title={file.name}>{file.name}</span>
                {culprit && (
                  <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-800 dark:text-amber-300">{culpritLabel}</span>
                )}
              </span>
              <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{formatSize(file.size)}</span>
            </li>
          )
        })}
      </ul>

      {over && (
        <div className="grid gap-2 sm:grid-cols-2">
          <FixOption
            icon={<Link2 aria-hidden className="size-4" />}
            label={fill(linkLabel, values)}
            result={keptAfterLink}
            limit={selected.limit}
            status={[fitsLabel, tooBigLabel]}
            onClick={onSendAsLink && (() => onSendAsLink(culprits))}
          />
          <FixOption
            icon={<FileArchive aria-hidden className="size-4" />}
            label={compressLabel}
            result={compressed}
            limit={selected.limit}
            status={[fitsLabel, tooBigLabel]}
            note={compressed > sent * 0.95 ? noGainText : undefined}
            onClick={onCompress && (() => onCompress(compressedRaw))}
          />
        </div>
      )}
    </div>
  )
}

function FixOption({ icon, label, result, limit, status, note, onClick }: { icon: React.ReactNode; label: string; result: number; limit: number; status: [string, string]; note?: string; onClick?: () => void }) {
  const fits = result <= limit
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={cn(btn, "h-auto flex-col items-start gap-0.5 border py-2 text-left hover:bg-accent disabled:opacity-60", fits && "border-emerald-500/40")}
    >
      <span className="flex items-center gap-1.5">{icon}{label}</span>
      <span className={cn("text-xs font-normal", fits ? "text-emerald-700 dark:text-emerald-400" : "text-muted-foreground")}>
        → {formatSize(result)} · {fits ? status[0] : status[1]}
        {note && ` (${note})`}
      </span>
    </button>
  )
}
