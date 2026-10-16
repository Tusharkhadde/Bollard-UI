"use client"

import * as React from "react"
import { LoaderCircle, Pencil, TriangleAlert, Undo2 } from "lucide-react"

import { cn } from "@/lib/utils"

export interface InlineEditProps
  extends Omit<React.ComponentProps<"input">, "value" | "defaultValue" | "onChange" | "onSubmit"> {
  /** Accessible name of the field, e.g. "Project name". */
  label: string
  /** Controlled saved value. */
  value?: string
  /** Initial saved value when uncontrolled. */
  defaultValue?: string
  /** Called with the new value once it is saved. */
  onValueChange?: (value: string) => void
  /** Persists the value. Return a promise to show a saving state; throw to keep editing with your draft. */
  onSave?: (value: string) => void | Promise<void>
  /** Return an error message to block saving, or nothing when the value is fine. */
  validate?: (value: string) => string | undefined
  /** Extra classes for the input while editing. */
  inputClassName?: string
  /** Hint shown while editing. */
  hint?: string
  /** Notice shown after Escape threw away an edit. */
  discardedMessage?: string
  /** Label of the button that brings a discarded edit back. */
  restoreLabel?: string
  /** Label of the button that takes the value someone else saved meanwhile. */
  useTheirsLabel?: string
  /** Fallback error when `onSave` rejects without a message. */
  saveErrorMessage?: string
  /** Shown when someone else saved while you were editing. `{value}` is their value. */
  conflictMessage?: string
}

const fill = (template: string, value: string) => template.replace("{value}", value)

const fixClass =
  "inline-flex h-6 items-center gap-1 rounded-md border border-amber-500/40 px-2 font-medium text-amber-900 transition-colors hover:bg-amber-500/10 dark:text-amber-200 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"

/**
 * Click-to-edit text that doesn't lose work. Enter or blur saves and Escape cancels, but a
 * cancelled edit can be restored for a few seconds, a failed save keeps your draft, and if the
 * value changes underneath you (another tab, a teammate) it says so instead of silently overwriting:
 * clicking away then keeps the editor open rather than saving over their change.
 */
export function InlineEdit({
  label,
  value,
  defaultValue = "",
  onValueChange,
  onSave,
  validate,
  placeholder = "Untitled",
  className,
  inputClassName,
  hint = "Enter to save · Esc to cancel",
  discardedMessage = "Edit discarded.",
  restoreLabel = "Restore",
  useTheirsLabel = "Use theirs",
  saveErrorMessage = "Couldn't save. Try again.",
  conflictMessage = "Changed to “{value}” while you were editing. Enter keeps yours.",
  onKeyDown,
  ...props
}: InlineEditProps) {
  const [inner, setInner] = React.useState(defaultValue)
  const saved = value ?? inner
  const [editing, setEditing] = React.useState(false)
  const [draft, setDraft] = React.useState(saved)
  const [base, setBase] = React.useState(saved)
  const [error, setError] = React.useState<string>()
  const [saving, setSaving] = React.useState(false)
  const [discarded, setDiscarded] = React.useState<string | null>(null)
  const inputRef = React.useRef<HTMLInputElement>(null)
  const triggerRef = React.useRef<HTMLButtonElement>(null)
  const rootRef = React.useRef<HTMLSpanElement>(null)
  const hintId = React.useId()

  React.useEffect(() => {
    if (editing) inputRef.current?.select()
  }, [editing])

  // Someone else saved while the draft is untouched: just follow along.
  React.useEffect(() => {
    if (editing && saved !== base && draft === base) {
      setDraft(saved)
      setBase(saved)
    }
  }, [editing, saved, base, draft])

  React.useEffect(() => {
    if (discarded === null) return
    const timer = setTimeout(() => setDiscarded(null), 8000)
    return () => clearTimeout(timer)
  }, [discarded])

  const open = (text = saved) => {
    setDraft(text)
    setBase(saved)
    setDiscarded(null)
    setEditing(true)
  }

  const close = () => {
    setEditing(false)
    setError(undefined)
    requestAnimationFrame(() => triggerRef.current?.focus())
  }

  const cancel = () => {
    if (draft.trim() !== saved) setDiscarded(draft)
    close()
  }

  const commit = async () => {
    if (saving) return
    const next = draft.trim()
    if (next === saved) return close()
    const problem = validate?.(next)
    if (problem) {
      setError(problem)
      return inputRef.current?.focus()
    }
    try {
      setSaving(true)
      await onSave?.(next)
      if (value === undefined) setInner(next)
      onValueChange?.(next)
      close()
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : saveErrorMessage)
      requestAnimationFrame(() => inputRef.current?.focus())
    } finally {
      setSaving(false)
    }
  }

  // The saved value moved while this edit was open: someone else changed it.
  const conflict = editing && saved !== base && saved !== draft.trim()

  if (!editing) {
    return (
      <span data-slot="inline-edit" className={cn("-mx-1.5 inline-grid max-w-[calc(100%+0.75rem)] gap-1", className)}>
        <button
          ref={triggerRef}
          type="button"
          aria-label={`${label}: ${saved || placeholder}. Edit`}
          onClick={() => open()}
          className="group inline-flex max-w-full items-center gap-2 rounded-md px-1.5 py-0.5 text-left transition-colors hover:bg-accent outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          <span className={cn("truncate", !saved && "text-muted-foreground")}>{saved || placeholder}</span>
          {/* Faint at rest so touch users (no hover) can still tell the text is editable. */}
          <Pencil aria-hidden className="size-3.5 shrink-0 text-muted-foreground opacity-40 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100" />
        </button>
        <span aria-live="polite" className="px-1.5 text-xs font-normal">
          {discarded !== null && (
            <span className="flex items-center gap-2 text-muted-foreground">
              <span className="py-1">{discardedMessage}</span>
              <button type="button" onClick={() => open(discarded)} className={fixClass}>
                <Undo2 aria-hidden className="size-3.5" />
                {restoreLabel} “{discarded.length > 24 ? `${discarded.slice(0, 23)}…` : discarded}”
              </button>
            </span>
          )}
        </span>
      </span>
    )
  }

  return (
    <span ref={rootRef} data-slot="inline-edit" className={cn("-mx-1.5 inline-grid max-w-[calc(100%+0.75rem)] gap-1", className)}>
      <span className="relative inline-flex items-center">
        <input
          ref={inputRef}
          aria-label={label}
          aria-invalid={!!error || undefined}
          aria-describedby={hintId}
          value={draft}
          readOnly={saving}
          placeholder={placeholder}
          onChange={(event) => {
            setDraft(event.target.value)
            setError(undefined)
          }}
          onKeyDown={(event) => {
            onKeyDown?.(event)
            if (event.key === "Enter") {
              event.preventDefault()
              void commit()
            } else if (event.key === "Escape") {
              event.preventDefault()
              cancel()
            }
          }}
          onBlur={(event) => {
            // Clicking away saves, except over a teammate's change: that needs an explicit Enter or Use theirs.
            if (!rootRef.current?.contains(event.relatedTarget) && !conflict) void commit()
          }}
          data-warning={conflict || error ? "" : undefined}
          className={cn(
            "h-9 w-full min-w-40 rounded-md border bg-transparent px-1.5 pr-7 shadow-xs transition-[color,box-shadow] outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30 data-warning:border-amber-500 dark:data-warning:border-amber-400",
            inputClassName,
          )}
          {...props}
        />
        {saving && <LoaderCircle aria-label="Saving" className="absolute right-0.5 size-4 animate-spin text-muted-foreground" />}
      </span>
      <span id={hintId} aria-live="polite" className="px-1.5 text-xs font-normal">
        {error || conflict ? (
          <span className="flex gap-1.5 text-amber-700 dark:text-amber-400">
            <span className="flex h-6 shrink-0 items-center"><TriangleAlert aria-hidden className="size-3.5" /></span>
            <span className="flex min-w-0 flex-wrap items-center gap-x-2">
              <span className="py-1">{error ?? fill(conflictMessage, saved)}</span>
              {!error && (
                <button
                  type="button"
                  onPointerDown={(event) => event.preventDefault()}
                  onClick={() => {
                    setDraft(saved)
                    setBase(saved)
                    inputRef.current?.focus()
                  }}
                  className={fixClass}
                >
                  {useTheirsLabel}
                </button>
              )}
            </span>
          </span>
        ) : (
          <span className="block py-1 text-muted-foreground">{hint}</span>
        )}
      </span>
    </span>
  )
}
