"use client"

// Bollard UI — shortcut-recorder · MIT licence · https://bollard-ui.vercel.app/components/shortcut-recorder

import * as React from "react"
import { CircleX, TriangleAlert, X } from "lucide-react"

import { cn } from "@/lib/utils"
import {
  checkShortcut,
  detectPlatform,
  formatShortcut,
  isModifierKey,
  shortcutFromEvent,
  type Platform,
  type ShortcutBinding,
  type ShortcutIssue,
} from "./shortcut-rules"

export { checkShortcut, detectPlatform, formatShortcut, resolveShortcut, shortcutFromEvent } from "./shortcut-rules"
export type { Platform, ShortcutBinding, ShortcutIssue, ShortcutProblem } from "./shortcut-rules"

export interface ShortcutRecorderProps
  extends Omit<React.ComponentProps<"div">, "defaultValue" | "onChange"> {
  /** Visible label. */
  label?: string
  /** Controlled shortcut in canonical form ("Mod+Shift+K"), or null for none. */
  value?: string | null
  /** Initial shortcut when uncontrolled. */
  defaultValue?: string | null
  /** Called with the saved shortcut, or null when cleared. */
  onValueChange?: (value: string | null) => void
  /** The app's existing shortcuts; a clash names the action. Leave out the one being edited. */
  bindings?: ShortcutBinding[]
  /** Platform to read back first. Detected from the browser when left out. */
  platform?: Platform
  /** Shown while empty. */
  placeholder?: string
  /** Shown while recording with nothing held. */
  recordingLabel?: string
  /** Hint while recording. */
  recordingHint?: string
  /** Saves a shortcut that only has warnings. */
  useAnywayLabel?: string
  /** Label of the try-again button after a blocked combo. */
  tryAgainLabel?: string
  /** Accessible label of the clear button. */
  clearLabel?: string
  /** Platform names in the readback. */
  macLabel?: string
  /** Label for the Windows/Linux read-back. */
  pcLabel?: string
  /** Rewrites an issue's text, e.g. to translate it. `issue.problem` says which check fired; `keys` is the canonical shortcut. */
  formatIssue?: (issue: ShortcutIssue, keys: string) => string
}

const fixClass =
  "inline-flex h-6 items-center gap-1 rounded-md border border-amber-500/40 px-2 font-medium text-amber-900 transition-colors hover:bg-amber-500/10 dark:text-amber-200 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
const linkClass = "h-6 rounded-md px-1.5 font-medium underline-offset-2 hover:underline outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
const keyframes = `@keyframes cui-shortcut-recorder-pop{0%{transform:scale(.88);opacity:.4}100%{transform:none;opacity:1}}`

function Kbd({ children, className }: { children: React.ReactNode; className?: string }) {
  return <kbd className={cn("inline-flex h-6 items-center rounded border bg-muted px-1.5 font-sans text-xs font-medium text-foreground shadow-[inset_0_-1px_0] shadow-border", className)}>{children}</kbd>
}

/**
 * Records a keyboard shortcut and catches the ones that will never fire or will hurt someone:
 * combos the browser keeps (Ctrl+W, ⌘Q, Ctrl+T) on any platform, not just the one you're on,
 * clashes with the app's own bindings, Ctrl+Alt (AltGr on European layouts), punctuation that
 * needs AltGr elsewhere, and plain keys that fire while typing. It reads the result back for
 * Mac and Windows/Linux, so ⌘ and Ctrl are never confused. Tab still leaves; Esc cancels.
 */
export function ShortcutRecorder({
  label = "Shortcut",
  value,
  defaultValue = null,
  onValueChange,
  bindings = [],
  platform: platformProp,
  placeholder = "Click to record",
  recordingLabel = "Press a shortcut…",
  recordingHint = "Esc cancels · Backspace clears",
  useAnywayLabel = "Use anyway",
  tryAgainLabel = "Try again",
  clearLabel = "Clear shortcut",
  macLabel = "Mac",
  pcLabel = "Windows/Linux",
  formatIssue,
  className,
  ...props
}: ShortcutRecorderProps) {
  const [inner, setInner] = React.useState(defaultValue)
  const [detected, setDetected] = React.useState<Platform>("windows")
  const [recording, setRecording] = React.useState(false)
  const [held, setHeld] = React.useState("")
  const [candidate, setCandidate] = React.useState<{ keys: string; issues: ShortcutIssue[] } | null>(null)
  const recorderRef = React.useRef<HTMLButtonElement>(null)
  const labelId = React.useId()
  const current = value === undefined ? inner : value
  const platform = platformProp ?? detected
  const pcPlatform = platform === "mac" ? "windows" : platform

  React.useEffect(() => setDetected(detectPlatform()), [])

  const commit = (next: string | null) => {
    if (value === undefined) setInner(next)
    onValueChange?.(next)
    setCandidate(null)
  }
  const start = () => {
    setCandidate(null)
    setHeld("")
    setRecording(true)
    recorderRef.current?.focus()
  }

  const onKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (!recording || event.repeat) return
    const bare = !event.ctrlKey && !event.metaKey && !event.altKey
    if (event.key === "Tab" && bare) return setRecording(false)
    event.preventDefault()
    if (bare && !event.shiftKey && event.key === "Escape") return setRecording(false)
    if (bare && !event.shiftKey && (event.key === "Backspace" || event.key === "Delete")) {
      setRecording(false)
      return commit(null)
    }
    if (isModifierKey(event.key)) {
      const mods = platform === "mac"
        ? [event.ctrlKey && "⌃", event.altKey && "⌥", event.shiftKey && "⇧", event.metaKey && "⌘"].filter(Boolean).join("")
        : [event.ctrlKey && "Ctrl", event.metaKey && "Win", event.altKey && "Alt", event.shiftKey && "Shift", ""].filter((m) => m !== false).join("+")
      return setHeld(mods === "+" ? "" : mods)
    }
    const keys = shortcutFromEvent(event, platform)
    if (!keys) return
    setRecording(false)
    const issues = checkShortcut(keys, bindings, event.getModifierState?.("AltGraph"))
    if (issues.length) setCandidate({ keys, issues })
    else commit(keys)
  }

  const savedIssues = React.useMemo(() => (current ? checkShortcut(current, bindings) : []), [current, bindings])
  const shownKeys = candidate?.keys ?? current
  const issues = (candidate?.issues ?? savedIssues).map((issue) =>
    formatIssue && shownKeys ? { ...issue, message: formatIssue(issue, shownKeys) } : issue,
  )
  const blocking = issues.filter((issue) => issue.blocking)

  return (
    <div data-slot="shortcut-recorder" className={cn("grid w-full max-w-xs gap-1.5", className)} {...props}>
      <style>{keyframes}</style>
      <span id={labelId} className="w-fit text-sm font-medium">{label}</span>
      <div className="flex gap-2">
        <button
          ref={recorderRef}
          type="button"
          aria-labelledby={labelId}
          aria-pressed={recording}
          aria-describedby={`${labelId}-status`}
          data-recording={recording ? "" : undefined}
          data-warning={issues.length && !blocking.length ? "" : undefined}
          data-danger={blocking.length ? "" : undefined}
          onClick={() => (recording ? setRecording(false) : start())}
          onKeyDown={onKeyDown}
          onKeyUp={(event) => recording && isModifierKey(event.key) && setHeld("")}
          onBlur={() => setRecording(false)}
          className="flex h-9 min-w-0 flex-1 items-center gap-2 rounded-md border bg-transparent px-3 text-left text-sm shadow-xs transition-[color,box-shadow,border-color] outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30 data-recording:border-ring data-recording:ring-[3px] data-recording:ring-ring/50 data-warning:border-amber-500 dark:data-warning:border-amber-400 data-danger:border-red-500 dark:data-danger:border-red-400"
        >
          {recording ? (
            <>
              <span aria-hidden className="size-2 shrink-0 rounded-full bg-red-500 motion-safe:animate-pulse" />
              {held ? <Kbd>{held}</Kbd> : <span className="text-muted-foreground">{recordingLabel}</span>}
            </>
          ) : shownKeys ? (
            <Kbd key={shownKeys} className={cn("motion-safe:animate-[cui-shortcut-recorder-pop_200ms_ease-out]", blocking.length && "line-through decoration-red-500")}>
              {formatShortcut(shownKeys, platform)}
            </Kbd>
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
        </button>
        {current && !recording && !candidate && !issues.length ? (
          <button type="button" aria-label={clearLabel} onClick={() => commit(null)} className="inline-flex size-9 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50">
            <X aria-hidden className="size-4" />
          </button>
        ) : null}
      </div>
      <div id={`${labelId}-status`} aria-live="polite" className="grid gap-1.5 text-xs">
        {recording ? (
          <p className="mt-1.5 text-muted-foreground">{recordingHint}</p>
        ) : shownKeys ? (
          <p className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-muted-foreground">
            {(platform === "mac" ? (["mac", pcPlatform] as const) : ([pcPlatform, "mac"] as const)).map((p, i) => (
              <span key={p} className={cn(i === 0 && "text-foreground")}>
                {p === "mac" ? macLabel : pcLabel} <span className="font-medium">{formatShortcut(shownKeys, p)}</span>
              </span>
            ))}
          </p>
        ) : null}
        {recording ? null : blocking.length ? (
          <div role="alert" className="flex gap-1.5 text-red-700 dark:text-red-400">
            <span className="flex h-6 shrink-0 items-center"><CircleX aria-hidden className="size-3.5" /></span>
            <span className="flex min-w-0 flex-wrap items-center gap-x-2">
              <span className="py-1">{blocking[0].message}</span>
              <button type="button" onClick={start} className={linkClass}>{tryAgainLabel}</button>
            </span>
          </div>
        ) : issues.length ? (
          <div className="grid gap-1 text-amber-700 dark:text-amber-400">
            {issues.map((issue, index) => (
              <p key={`${issue.problem}-${index}`} className="flex gap-1.5">
                <span className="flex h-5 shrink-0 items-center"><TriangleAlert aria-hidden className="size-3.5" /></span>
                <span className="py-0.5">{issue.message}</span>
              </p>
            ))}
            <span className="flex flex-wrap items-center gap-2 pl-5">
              {candidate ? <button type="button" onClick={() => commit(candidate.keys)} className={fixClass}>{useAnywayLabel}</button> : null}
              <button type="button" onClick={start} className={linkClass}>{tryAgainLabel}</button>
            </span>
          </div>
        ) : null}
      </div>
    </div>
  )
}
