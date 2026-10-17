"use client"

// Bollard UI — unsaved-changes-bar · MIT licence · https://bollard-ui.vercel.app/components/unsaved-changes-bar

import * as React from "react"
import { CircleAlert, LoaderCircle, PencilLine, Undo2 } from "lucide-react"

import { cn } from "@/lib/utils"

/** Structural equality for plain data: primitives, arrays, plain objects and Dates. */
export function isEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true
  if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime()
  if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) return false
  if (Array.isArray(a) !== Array.isArray(b)) return false
  const keysA = Object.keys(a)
  if (keysA.length !== Object.keys(b).length) return false
  return keysA.every((key) => isEqual((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key]))
}

/** Top-level keys whose values differ between two snapshots (deep compare). */
export function changedKeys<T extends Record<string, unknown>>(initial: T, current: T) {
  const keys = new Set([...Object.keys(initial), ...Object.keys(current)])
  return [...keys].filter((key) => !isEqual(initial[key], current[key])) as (keyof T & string)[]
}

/** Memoized `changedKeys`: editing a field back to its saved value makes it clean again. */
export function useUnsavedChanges<T extends Record<string, unknown>>(initial: T, current: T) {
  return React.useMemo(() => changedKeys(initial, current), [initial, current])
}

export interface UnsavedChangesBarProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "children"> {
  /** Dirty field keys, usually from `useUnsavedChanges`. The bar hides when empty. */
  fields: string[]
  /** Human labels per key, e.g. `{ email: "Email" }`. Falls back to the key itself. */
  labels?: Record<string, string>
  /** Persist the changes. Return a promise to show a saving state; throw to keep the bar. */
  onSave: () => void | Promise<void>
  /** Throw away every change. Only called after the inline confirm. */
  onDiscard: () => void
  /** Revert one field. When given, each field chip becomes a one-tap undo. */
  onRevertField?: (field: string) => void
  /** Warn before closing or reloading the tab while there are changes. */
  guardUnload?: boolean
  /** Headline. Defaults to "3 unsaved changes". */
  summary?: string
  /** Question shown with the discard confirm. Defaults to "Discard all 3?". */
  confirmDiscardLabel?: string
  /** Save button text. */
  saveLabel?: string
  /** Save button text while saving. */
  savingLabel?: string
  /** Discard button text. */
  discardLabel?: string
  /** Text of the button that cancels a discard. */
  keepLabel?: string
  /** Shown when `onSave` throws something that isn't an `Error`. */
  errorLabel?: string
  /** Accessible name of the bar. */
  regionLabel?: string
  /** Accessible name of the changed-fields list. */
  changedFieldsLabel?: string
  /** Accessible label and tooltip of a field's revert button. */
  revertLabel?: (field: string) => string
  /** Accessible name of the discard confirmation group. */
  confirmGroupLabel?: string
}

const button =
  "inline-flex h-8 items-center gap-2 rounded-md px-3 text-sm font-medium outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-50"

/**
 * Says exactly which fields are unsaved, so nobody leaves a page thinking
 * their edits stuck. Discard needs an inline second tap, Ctrl/⌘+S saves, and
 * the browser warns before the tab is closed with changes still pending.
 */
export function UnsavedChangesBar({
  fields,
  labels = {},
  onSave,
  onDiscard,
  onRevertField,
  guardUnload = true,
  summary,
  confirmDiscardLabel,
  saveLabel = "Save",
  savingLabel = "Saving…",
  discardLabel = "Discard",
  keepLabel = "Keep editing",
  errorLabel = "Couldn't save. Your changes are still here.",
  regionLabel = "Unsaved changes",
  changedFieldsLabel = "Changed fields",
  revertLabel = (field) => `Revert ${field}`,
  confirmGroupLabel = "Confirm discard",
  className,
  ...props
}: UnsavedChangesBarProps) {
  const [confirming, setConfirming] = React.useState(false)
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string>()
  const [modKey, setModKey] = React.useState("Ctrl+")
  const keepRef = React.useRef<HTMLButtonElement>(null)
  const discardRef = React.useRef<HTMLButtonElement>(null)
  const count = fields.length
  const dirty = count > 0
  const names = fields.map((field) => labels[field] ?? field)
  const headline = summary ?? `${count} unsaved ${count === 1 ? "change" : "changes"}`

  const save = async () => {
    if (saving || !dirty) return
    setConfirming(false)
    setError(undefined)
    setSaving(true)
    try {
      await onSave()
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : errorLabel)
    } finally {
      setSaving(false)
    }
  }

  // The latest save, without re-binding the shortcut on every render.
  const saveRef = React.useRef(save)
  React.useEffect(() => {
    saveRef.current = save
  })

  React.useEffect(() => {
    if (!dirty) return
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && !event.altKey && event.key.toLowerCase() === "s") {
        event.preventDefault()
        void saveRef.current()
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [dirty])

  React.useEffect(() => {
    if (!dirty || !guardUnload) return
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ""
    }
    window.addEventListener("beforeunload", onBeforeUnload)
    return () => window.removeEventListener("beforeunload", onBeforeUnload)
  }, [dirty, guardUnload])

  React.useEffect(() => {
    if (/Mac|iPhone|iPad/.test(navigator.userAgent)) setModKey("⌘")
  }, [])

  React.useEffect(() => {
    if (!dirty) {
      setConfirming(false)
      setError(undefined)
    }
  }, [dirty])

  React.useEffect(() => {
    if (confirming) keepRef.current?.focus()
  }, [confirming])

  const cancelDiscard = () => {
    setConfirming(false)
    requestAnimationFrame(() => discardRef.current?.focus())
  }

  return (
    <div
      data-slot="unsaved-changes-bar"
      role="region"
      aria-label={regionLabel}
      hidden={!dirty}
      className={cn(
        "sticky bottom-4 z-40 mx-auto w-full max-w-2xl rounded-lg border bg-popover p-3 text-sm text-popover-foreground shadow-lg",
        className
      )}
      {...props}
    >
      {/* Always mounted, so the first change is announced even though the bar was hidden. */}
      <span className="sr-only" aria-live="polite">
        {dirty ? `${headline}: ${names.join(", ")}` : ""}
      </span>
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-48 flex-1">
          <p className="flex items-center gap-2 font-medium">
            <PencilLine aria-hidden className="size-4 shrink-0 text-amber-600 dark:text-amber-400" />
            {headline}
          </p>
          <ul className="mt-2 flex flex-wrap gap-1.5" aria-label={changedFieldsLabel}>
            {fields.map((field, index) => (
              <li key={field}>
                {onRevertField ? (
                  <button
                    type="button"
                    onClick={() => onRevertField(field)}
                    aria-label={revertLabel(names[index])}
                    title={revertLabel(names[index])}
                    className="group inline-flex h-6 items-center gap-1 rounded-md bg-muted px-2 text-xs text-muted-foreground outline-none hover:bg-accent hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
                  >
                    {names[index]}
                    <Undo2 aria-hidden className="size-3 opacity-60 group-hover:opacity-100" />
                  </button>
                ) : (
                  <span className="inline-flex h-6 items-center rounded-md bg-muted px-2 text-xs text-muted-foreground">
                    {names[index]}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>

        {confirming ? (
          <div
            className="flex flex-wrap items-center gap-2"
            role="group"
            aria-label={confirmGroupLabel}
            onKeyDown={(event) => event.key === "Escape" && cancelDiscard()}
          >
            <span className="text-muted-foreground">
              {confirmDiscardLabel ?? `Discard ${count === 1 ? "it" : `all ${count}`}?`}
            </span>
            <button ref={keepRef} type="button" onClick={cancelDiscard} className={cn(button, "border bg-background hover:bg-accent")}>
              {keepLabel}
            </button>
            <button
              type="button"
              onClick={() => {
                setConfirming(false)
                onDiscard()
              }}
              className={cn(button, "bg-destructive text-white hover:bg-destructive/90")}
            >
              {discardLabel}
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <button
              ref={discardRef}
              type="button"
              disabled={saving}
              onClick={() => setConfirming(true)}
              className={cn(button, "text-muted-foreground hover:bg-accent hover:text-foreground")}
            >
              {discardLabel}
            </button>
            <button
              type="button"
              disabled={saving}
              aria-keyshortcuts="Control+S Meta+S"
              onClick={() => void save()}
              className={cn(button, "bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-70")}
            >
              {saving && <LoaderCircle aria-hidden className="size-4 animate-spin" />}
              {saving ? savingLabel : saveLabel}
              {!saving && (
                <kbd aria-hidden className="hidden rounded border border-primary-foreground/30 px-1 font-sans text-[10px] opacity-80 sm:inline">
                  {modKey}S
                </kbd>
              )}
            </button>
          </div>
        )}
      </div>
      {error && (
        <p role="alert" className="mt-2 flex items-center gap-1.5 text-xs text-red-700 dark:text-red-400">
          <CircleAlert aria-hidden className="size-3.5 shrink-0" />
          {error}
        </p>
      )}
    </div>
  )
}
