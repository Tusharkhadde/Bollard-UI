"use client"

// Bollard UI — form-progress · MIT licence · https://bollard-ui.vercel.app/components/form-progress

import * as React from "react"
import { ArrowDownToLine, CircleCheck } from "lucide-react"

import { cn } from "@/lib/utils"

type Control = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement

export interface FormProgressState {
  /** Required fields (a radio group counts once). */
  total: number
  /** Required fields that are empty or invalid, in DOM order. */
  missing: Control[]
  /** How many of `missing` have a value that fails validation (wrong format, too short...). */
  invalid: number
}

const EMPTY: FormProgressState = { total: 0, missing: [], invalid: 0 }

/** Counts a form's visible, enabled required fields and which of them fail native validity. */
export function scanRequiredFields(form: HTMLFormElement): FormProgressState {
  const seenRadios = new Set<string>()
  const missing: Control[] = []
  let total = 0
  let invalid = 0
  for (const el of form.querySelectorAll<Control>("input, select, textarea")) {
    if (!el.required || el.disabled || el.type === "hidden" || el.closest("[hidden], [inert]")) continue
    if (el.type === "radio") {
      if (seenRadios.has(el.name)) continue
      seenRadios.add(el.name)
    }
    total++
    if (el.validity.valid) continue
    missing.push(el)
    if (!el.validity.valueMissing) invalid++
  }
  return { total, missing, invalid }
}

/** A short name for a control: its label without the trailing "*", else aria-label or name. */
export function describeField(el: Control) {
  const text = el.labels?.[0]?.textContent || el.getAttribute("aria-label") || el.name
  return text.replace(/\s*\*\s*$/, "").trim() || "Field"
}

const fields = (n: number) => `${n} required ${n === 1 ? "field" : "fields"}`

/** Every other user-visible string, as functions so each language can pluralise its own way. */
export const FORM_PROGRESS_LABELS = {
  left: (count: number) => `${fields(count)} left`,
  invalid: (count: number) => `${count} filled in but ${count === 1 ? "needs" : "need"} fixing`,
  progress: "Required fields completed",
  progressText: (done: number, total: number) => `${done} of ${total} required fields complete`,
  /** Read after "Next missing" moves focus. */
  jumped: (field: string, empty: boolean, left: number) => `${field} ${empty ? "is empty" : "needs fixing"}. ${fields(left)} left.`,
}

/**
 * Tracks a form's required fields by watching the DOM: input and change
 * events, the `required` attribute and native validity. Fields added,
 * removed, disabled or hidden later are picked up by a MutationObserver.
 */
export function useFormProgress(formRef: React.RefObject<HTMLFormElement | null>) {
  const [state, setState] = React.useState<FormProgressState>(EMPTY)

  // A passive effect on purpose: the form's ref is attached after a child's layout effects run.
  React.useEffect(() => {
    const form = formRef.current
    if (!form) return
    const update = () => setState(scanRequiredFields(form))
    // Reset fires before the values change, so measure on the next tick.
    const onReset = () => setTimeout(update, 0)
    update()
    form.addEventListener("input", update)
    form.addEventListener("change", update)
    form.addEventListener("reset", onReset)
    const observer = new MutationObserver(update)
    observer.observe(form, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["required", "disabled", "hidden", "inert", "type", "pattern", "minlength", "maxlength", "min", "max"],
    })
    return () => {
      form.removeEventListener("input", update)
      form.removeEventListener("change", update)
      form.removeEventListener("reset", onReset)
      observer.disconnect()
    }
  }, [formRef])

  return state
}

export interface FormProgressProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "children"> {
  /** The form to watch. */
  formRef: React.RefObject<HTMLFormElement | null>
  /** Button text. */
  nextLabel?: string
  /** Shown once every required field is valid. */
  doneLabel?: string
  /** Override any other string. */
  labels?: Partial<typeof FORM_PROGRESS_LABELS>
}

/**
 * Stops "why won't it submit?" on long forms. Shows how many required fields
 * are left (and how many are filled in but invalid), with a "Next missing"
 * button that jumps to the next one after wherever focus is now, in DOM
 * order, wrapping at the end, so repeated presses walk through every gap.
 */
export function FormProgress({
  formRef,
  nextLabel = "Next missing",
  doneLabel = "All required fields done",
  labels,
  className,
  ...props
}: FormProgressProps) {
  const { total, missing, invalid } = useFormProgress(formRef)
  const [announcement, setAnnouncement] = React.useState("")
  const t = { ...FORM_PROGRESS_LABELS, ...labels }
  // The last control the user was in. Clicking the button moves focus onto it,
  // so "next" is measured from here, not from document.activeElement.
  const lastControl = React.useRef<Element | null>(null)

  React.useEffect(() => {
    const form = formRef.current
    if (!form) return
    const onFocusIn = (event: FocusEvent) => {
      if (event.target instanceof Element && event.target.matches("input, select, textarea"))
        lastControl.current = event.target
    }
    form.addEventListener("focusin", onFocusIn)
    return () => form.removeEventListener("focusin", onFocusIn)
  }, [formRef])

  const left = missing.length
  const done = total - left
  const percent = total === 0 ? 0 : Math.round((done / total) * 100)

  const jump = () => {
    if (left === 0) return
    const from = lastControl.current?.isConnected ? lastControl.current : null
    const next =
      missing.find((el) => from && from !== el && from.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING) ??
      missing[0]
    next.scrollIntoView({ block: "center", behavior: "smooth" })
    next.focus({ preventScroll: true })
    setAnnouncement(t.jumped(describeField(next), next.validity.valueMissing, left))
  }

  if (total === 0) return null

  return (
    <div
      data-slot="form-progress"
      data-state={left === 0 ? "complete" : "incomplete"}
      className={cn("flex w-full flex-wrap items-center gap-3 rounded-lg border bg-card p-3 text-sm text-card-foreground", className)}
      {...props}
    >
      <div className="min-w-0 flex-1 basis-40 space-y-2">
        <p className="flex items-center gap-1.5 font-medium">
          {left === 0 ? (
            <>
              <CircleCheck aria-hidden className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
              {doneLabel}
            </>
          ) : (
            t.left(left)
          )}
        </p>
        <div
          role="progressbar"
          aria-label={t.progress}
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={done}
          aria-valuetext={t.progressText(done, total)}
          className="h-1.5 overflow-hidden rounded-full bg-muted"
        >
          <div
            className={cn("h-full rounded-full transition-[width] duration-300", left === 0 ? "bg-emerald-600" : "bg-primary")}
            style={{ width: `${percent}%` }}
          />
        </div>
        {invalid > 0 && (
          <p className="text-xs text-amber-700 dark:text-amber-400">
            {t.invalid(invalid)}
          </p>
        )}
      </div>
      {left > 0 && (
        <button
          type="button"
          onClick={jump}
          className="ml-auto inline-flex h-8 shrink-0 items-center gap-2 rounded-md border bg-background px-3 text-sm font-medium outline-none transition-colors hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          <ArrowDownToLine aria-hidden className="size-4" />
          {nextLabel}
        </button>
      )}
      <span aria-live="polite" className="sr-only">
        {announcement}
      </span>
    </div>
  )
}
