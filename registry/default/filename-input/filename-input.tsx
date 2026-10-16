"use client"

// Bollard UI — filename-input · MIT licence · https://bollard-ui.vercel.app/components/filename-input

import * as React from "react"
import { CircleAlert, FileWarning } from "lucide-react"

import { cn } from "@/lib/utils"
import { checkFilename, splitFilename, type FilenameIssue } from "@/registry/default/filename-input/filename"

export * from "@/registry/default/filename-input/filename"

/** Default messages. `{chars}`, `{stem}`, `{bytes}`, `{max}`, `{other}`, `{ext}` and `{fix}` are filled in. */
export const FILENAME_MESSAGES = {
  empty: "Give the file a name.",
  illegal: "{chars} can't be used in file names.",
  illegalFix: "Replace them",
  reserved: "{stem} is reserved by Windows, even with an extension.",
  edge: "Windows drops spaces at the start and dots or spaces at the end.",
  edgeFix: "Remove them",
  long: "Too long: {bytes} of {max} bytes.",
  longFix: "Shorten to fit",
  duplicate: "This folder already has a file with this name.",
  caseDuplicate: "Only the capitals differ from {other}, which Windows and macOS treat as the same file.",
  extRemoved: "Without {other} the file may not open in the right app.",
  extChanged: "Changing {other} to {ext} doesn't convert the file, so it may not open.",
  keep: "Keep {other}",
  use: "Use {fix}",
}

export interface FilenameInputProps
  extends Omit<React.ComponentProps<"input">, "value" | "defaultValue" | "onChange" | "type"> {
  /** Visible label. */
  label?: string
  /** Controlled file name. */
  value?: string
  /** Initial file name when uncontrolled. */
  defaultValue?: string
  /** Called with the new name and whether it has no errors (extension warnings don't count). */
  onValueChange?: (name: string, valid: boolean) => void
  /** The name before renaming. Defaults to the first value. Escape restores it. */
  originalName?: string
  /** Other names already in the folder, compared without regard to case. */
  existingNames?: string[]
  /** Longest name in UTF-8 bytes. */
  maxBytes?: number
  /** Override any of the default messages. */
  messages?: Partial<typeof FILENAME_MESSAGES>
}

const fieldClass =
  "h-9 w-full min-w-0 rounded-md border bg-transparent px-3 text-base shadow-xs transition-[color,box-shadow] outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm dark:bg-input/30 aria-invalid:border-destructive data-warning:border-amber-500 dark:data-warning:border-amber-400"
const fixBase =
  "inline-flex h-6 max-w-full items-center gap-1 rounded-md border px-2 font-medium transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
const tones = {
  error: { text: "text-destructive", fix: "border-destructive/40 hover:bg-destructive/10" },
  warning: { text: "text-amber-700 dark:text-amber-400", fix: "border-amber-500/40 text-amber-900 hover:bg-amber-500/10 dark:text-amber-200" },
}
const keyframes = `@keyframes cui-filename-input-in{0%{opacity:0;transform:translateY(-3px)}100%{opacity:1;transform:none}}`
const NO_NAMES: string[] = []

const fill = (template: string, values: Record<string, string | number | undefined>) =>
  template.replace(/\{(\w+)\}/g, (match, key: string) => String(values[key] ?? match))

/**
 * A rename field that keeps the file's extension safe: focus selects only the base name, as Finder and
 * Explorer do, and changing or dropping the extension gets a warning with a one-tap "Keep .pdf". It also
 * catches what makes a rename fail or a sync break later: characters Windows forbids, reserved device names
 * like CON or NUL.txt, trailing dots and spaces, names over the byte limit, and a name already in the
 * folder, including one that differs only in capitals. Escape restores the original name.
 */
export function FilenameInput({
  label = "Name",
  value,
  defaultValue = "",
  onValueChange,
  originalName,
  existingNames = NO_NAMES,
  maxBytes = 255,
  messages,
  id,
  className,
  onFocus,
  onMouseDown,
  onKeyDown,
  ref,
  ...props
}: FilenameInputProps) {
  const [inner, setInner] = React.useState(defaultValue)
  const [initial] = React.useState(value ?? defaultValue)
  const inputRef = React.useRef<HTMLInputElement>(null)
  const autoId = React.useId()
  const inputId = id ?? autoId
  const name = value ?? inner
  const original = originalName ?? initial
  const t = { ...FILENAME_MESSAGES, ...messages }
  const options = { original, existing: existingNames, maxBytes }
  const issues = checkFilename(name, options)
  const hasError = issues.some((issue) => issue.severity === "error")
  const size = new TextEncoder().encode(name).length

  React.useImperativeHandle(ref, () => inputRef.current as HTMLInputElement)

  const update = (next: string) => {
    if (value === undefined) setInner(next)
    onValueChange?.(next, !checkFilename(next, options).some((issue) => issue.severity === "error"))
  }
  const selectBase = () => {
    const input = inputRef.current
    if (input) input.setSelectionRange(0, splitFilename(input.value).base.length)
  }
  const apply = (fix: string) => {
    update(fix)
    requestAnimationFrame(() => inputRef.current?.focus())
  }

  const chars = [...name]
  const marked = issues.flatMap((issue) => issue.at ?? [])
  const text = (issue: FilenameIssue) =>
    fill(t[issue.code], {
      chars: [...new Set((issue.at ?? []).map((i) => chars[i]))].join(" "),
      stem: name.split(".")[0].trim(),
      bytes: size,
      max: maxBytes,
      other: issue.other,
      ext: splitFilename(name.trimStart().replace(/[. ]+$/, "")).ext,
    })
  const fixLabel = (issue: FilenameIssue) =>
    issue.code === "illegal" ? t.illegalFix
      : issue.code === "edge" ? t.edgeFix
        : issue.code === "long" ? t.longFix
          : issue.code.startsWith("ext") ? fill(t.keep, { other: issue.other })
            : fill(t.use, { fix: issue.fix })

  return (
    <div data-slot="filename-input" className={cn("grid w-full max-w-sm gap-1.5", className)}>
      <style>{keyframes}</style>
      <label htmlFor={inputId} className="w-fit text-sm font-medium">
        {label}
      </label>
      <input
        ref={inputRef}
        id={inputId}
        type="text"
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        value={name}
        onChange={(event) => update(event.target.value)}
        onFocus={(event) => {
          requestAnimationFrame(selectBase)
          onFocus?.(event)
        }}
        onMouseDown={(event) => {
          // The first click selects the base name instead of dropping a caret.
          if (document.activeElement !== event.currentTarget) {
            event.preventDefault()
            event.currentTarget.focus()
          }
          onMouseDown?.(event)
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape" && name !== original) {
            event.preventDefault()
            update(original)
            requestAnimationFrame(selectBase)
          }
          onKeyDown?.(event)
        }}
        aria-invalid={hasError || undefined}
        aria-describedby={`${inputId}-status`}
        data-warning={!hasError && issues.length ? "" : undefined}
        className={fieldClass}
        {...props}
      />
      <div id={`${inputId}-status`} aria-live="polite" className="grid min-h-6 gap-1 text-xs">
        {marked.length > 0 && (
          <p aria-hidden className="w-fit max-w-full rounded-md bg-muted px-2 py-1 font-mono break-all whitespace-pre-wrap">
            {chars.map((ch, i) =>
              marked.includes(i) ? (
                <mark key={i} className="rounded-sm bg-red-500/20 px-px text-red-700 dark:bg-red-400/25 dark:text-red-300">
                  {ch === " " ? "␣" : ch}
                </mark>
              ) : (
                <React.Fragment key={i}>{ch}</React.Fragment>
              ),
            )}
          </p>
        )}
        {issues.map((issue) => (
          <p
            key={issue.code}
            className={cn("flex gap-1.5 motion-safe:animate-[cui-filename-input-in_200ms_ease-out]", tones[issue.severity].text)}
          >
            <span className="flex h-6 shrink-0 items-center">
              {issue.severity === "error" ? <CircleAlert aria-hidden className="size-3.5" /> : <FileWarning aria-hidden className="size-3.5" />}
            </span>
            <span className="flex min-w-0 flex-wrap items-center gap-x-2">
              <span className="min-w-0 py-1 break-words">{text(issue)}</span>
              {issue.fix !== undefined && (
                <button type="button" onClick={() => apply(issue.fix as string)} className={cn(fixBase, tones[issue.severity].fix)}>
                  <span className="truncate">{fixLabel(issue)}</span>
                </button>
              )}
            </span>
          </p>
        ))}
        {!issues.length && size > maxBytes * 0.8 && (
          <p className="py-1 text-muted-foreground tabular-nums">{size}/{maxBytes} bytes</p>
        )}
      </div>
    </div>
  )
}
