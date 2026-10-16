"use client"

import * as React from "react"
import { CircleAlert, LoaderCircle, TriangleAlert } from "lucide-react"

import { cn } from "@/lib/utils"

/** How many leading characters of `typed` match `phrase` exactly. */
export function matchedLength(typed: string, phrase: string) {
  let i = 0
  while (i < typed.length && i < phrase.length && typed[i] === phrase[i]) i++
  return i
}

export interface TypeToConfirmProps extends Omit<React.ComponentProps<"dialog">, "open" | "title"> {
  /** Controlled open state. */
  open?: boolean
  /** Initial open state when uncontrolled. */
  defaultOpen?: boolean
  onOpenChange?: (open: boolean) => void
  /** The exact phrase the user has to type, e.g. the repository name. */
  phrase: string
  title?: React.ReactNode
  description?: React.ReactNode
  /** Runs when the user confirms. Return a promise to show a pending state; a rejection keeps the dialog open with its message. */
  onConfirm: () => void | Promise<void>
  /** Label for the input. Receives the phrase, already styled. */
  instruction?: (phrase: React.ReactNode) => React.ReactNode
  /** Shown under the input once the typing stops matching. */
  mismatchHint?: string
  confirmLabel?: React.ReactNode
  pendingLabel?: React.ReactNode
  cancelLabel?: React.ReactNode
  /** Fallback when `onConfirm` rejects without an Error message. */
  errorMessage?: string
}

const button =
  "inline-flex h-9 items-center justify-center gap-2 rounded-md px-4 text-sm font-medium whitespace-nowrap shadow-xs outline-none transition-[color,background-color,box-shadow] focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50"

/**
 * GitHub-style "danger zone" dialog: the confirm button stays locked until
 * the user types the exact phrase, so a reflexive Enter can't delete the
 * wrong thing. The phrase lights up character by character as it matches and
 * a typo is flagged the moment it happens. Built on the native <dialog>, so
 * focus trapping, Escape and the top layer come from the browser.
 */
export function TypeToConfirm({
  open: openProp,
  defaultOpen = false,
  onOpenChange,
  phrase,
  title = "Are you absolutely sure?",
  description = "This action cannot be undone.",
  onConfirm,
  instruction = (p) => <>Type {p} to confirm.</>,
  mismatchHint = "That doesn't match yet. Check for typos.",
  confirmLabel = "Delete",
  pendingLabel = "Deleting…",
  cancelLabel = "Cancel",
  errorMessage = "That didn't go through. Try again.",
  className,
  ...props
}: TypeToConfirmProps) {
  const dialogRef = React.useRef<HTMLDialogElement>(null)
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(defaultOpen)
  const open = openProp ?? uncontrolledOpen
  const [typed, setTyped] = React.useState("")
  const [pending, setPending] = React.useState(false)
  const [error, setError] = React.useState<string>()
  const id = React.useId()

  const setOpen = (next: boolean) => {
    if (openProp === undefined) setUncontrolledOpen(next)
    onOpenChange?.(next)
  }

  React.useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open && !dialog.open) {
      setTyped("")
      setError(undefined)
      dialog.showModal()
    } else if (!open && dialog.open) {
      dialog.close()
    }
  }, [open])

  const value = typed.trim()
  const matches = value === phrase
  const matched = matchedLength(value, phrase)
  const mismatch = value.length > 0 && matched < value.length

  const handleConfirm = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!matches || pending) return
    setPending(true)
    setError(undefined)
    try {
      await onConfirm()
      setOpen(false)
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : errorMessage)
    } finally {
      setPending(false)
    }
  }

  return (
    <dialog
      ref={dialogRef}
      data-slot="type-to-confirm"
      aria-labelledby={`${id}-title`}
      aria-describedby={`${id}-description`}
      onClose={() => open && setOpen(false)}
      onCancel={(event) => pending && event.preventDefault()}
      // Clicking the backdrop (the dialog element itself) closes it.
      onClick={(event) => event.target === event.currentTarget && !pending && setOpen(false)}
      className={cn(
        "m-auto w-[calc(100%-2rem)] max-w-md rounded-xl border bg-background p-0 text-foreground shadow-xl backdrop:bg-black/50 backdrop:backdrop-blur-[2px]",
        className,
      )}
      {...props}
    >
      <form onSubmit={handleConfirm} className="flex flex-col gap-4 p-6">
        <div className="flex gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-destructive/10 text-destructive">
            <TriangleAlert className="size-4.5" aria-hidden />
          </span>
          <div className="min-w-0 space-y-1">
            <h2 id={`${id}-title`} className="text-base font-semibold">
              {title}
            </h2>
            <div id={`${id}-description`} className="text-sm text-muted-foreground">
              {description}
            </div>
          </div>
        </div>

        <div>
          <label htmlFor={`${id}-input`} className="block text-sm">
            {instruction(
              <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[13px] font-semibold break-all">
                <span className="text-emerald-700 dark:text-emerald-400">{phrase.slice(0, matched)}</span>
                {phrase.slice(matched)}
              </code>,
            )}
          </label>
          <input
            id={`${id}-input`}
            autoFocus
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            value={typed}
            disabled={pending}
            aria-invalid={mismatch || undefined}
            aria-describedby={`${id}-hint`}
            onChange={(event) => setTyped(event.target.value)}
            className="mt-2 h-9 w-full rounded-md border bg-transparent px-3 font-mono text-sm shadow-xs outline-none transition-[color,box-shadow] focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-50 aria-invalid:border-destructive dark:bg-input/30"
          />
          <p id={`${id}-hint`} aria-live="polite" className="mt-1.5 min-h-4 text-xs text-destructive">
            {mismatch && (
              <span className="inline-flex items-center gap-1.5">
                <CircleAlert aria-hidden className="size-3.5" /> {mismatchHint}
              </span>
            )}
          </p>
        </div>

        {error && (
          <p role="alert" className="-mt-2 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            disabled={pending}
            onClick={() => setOpen(false)}
            className={cn(
              button,
              "border bg-background hover:bg-accent dark:border-input dark:bg-input/30 dark:hover:bg-input/50",
            )}
          >
            {cancelLabel}
          </button>
          <button
            type="submit"
            // aria-disabled keeps the button discoverable; the submit handler ignores it until the phrase matches.
            aria-disabled={!matches || pending || undefined}
            aria-busy={pending || undefined}
            className={cn(
              button,
              "bg-destructive text-white hover:bg-destructive/90 dark:bg-destructive/60 dark:hover:bg-destructive/70 aria-busy:cursor-progress",
              !matches && "cursor-not-allowed opacity-50 hover:bg-destructive dark:hover:bg-destructive/60",
            )}
          >
            {pending && <LoaderCircle className="size-4 animate-spin" aria-hidden />}
            {pending ? pendingLabel : confirmLabel}
          </button>
        </div>
      </form>
    </dialog>
  )
}
