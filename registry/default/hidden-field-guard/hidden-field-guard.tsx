"use client"

import * as React from "react"
import { EyeOff, Undo2 } from "lucide-react"

import { cn } from "@/lib/utils"

/** Banner layout shared by every Bollard UI banner: one height, padding, icon size and action style. */
const bar = "flex min-h-11 flex-wrap items-center gap-x-3 gap-y-1.5 px-3 py-1.5 text-sm"
const action =
  "inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-md px-3 text-sm font-medium whitespace-nowrap outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50"
const warning = {
  surface: "border-amber-500/30 bg-background bg-linear-to-r from-amber-500/10 to-amber-500/10 text-amber-950 dark:text-amber-50",
  icon: "text-amber-600 dark:text-amber-400",
  muted: "text-amber-900/75 dark:text-amber-100/75",
  solid: "bg-amber-700 text-white hover:bg-amber-800 dark:bg-amber-400 dark:text-amber-950 dark:hover:bg-amber-300",
  outline: "border border-amber-700/25 hover:bg-amber-500/15 dark:border-amber-300/25",
}

type Field = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
type FieldValue = string | boolean
type Saved = { el: Field; value: FieldValue }

const SKIPPED = new Set(["hidden", "submit", "button", "reset", "image", "file"])
const isToggle = (el: Field): el is HTMLInputElement => el.type === "checkbox" || el.type === "radio"
const read = (el: Field): FieldValue => (isToggle(el) ? el.checked : el.value)

/** Sets a field the way a user would, so React `onChange` handlers and controlled state see it. */
function write(el: Field, value: FieldValue) {
  const proto = Object.getPrototypeOf(el) as object
  if (isToggle(el)) {
    Object.getOwnPropertyDescriptor(proto, "checked")?.set?.call(el, value)
    el.dispatchEvent(new Event("click", { bubbles: true }))
  } else {
    Object.getOwnPropertyDescriptor(proto, "value")?.set?.call(el, value)
    el.dispatchEvent(new Event("input", { bubbles: true }))
  }
  el.dispatchEvent(new Event("change", { bubbles: true }))
}

/** A field's human name: its label, aria-label, placeholder, then name. */
export function fieldName(el: Field) {
  const text = el.labels?.[0]?.textContent ?? el.getAttribute("aria-label") ?? el.getAttribute("placeholder") ?? el.name
  return (text ?? "").replace(/\s*\*\s*$/, "").trim() || "Untitled field"
}

/** "Street", "Street and City", "Street, City and 2 more". */
export function listNames(names: string[], max = 2) {
  if (names.length <= max + 1) return names.length > 1 ? `${names.slice(0, -1).join(", ")} and ${names.at(-1)}` : (names[0] ?? "")
  return `${names.slice(0, max).join(", ")} and ${names.length - max} more`
}

const fill = (template: string, values: Record<string, string | number>) =>
  template.replace(/\{(\w+)\}/g, (match, key: string) => String(values[key] ?? match))

export interface HiddenFieldGuardProps extends Omit<React.ComponentProps<"div">, "hidden"> {
  /** Whether the section is currently hidden (toggle off, another tab or step selected). */
  hidden: boolean
  /** The section's name, e.g. "Shipping address". */
  label: string
  /**
   * What happens to hidden values on submit. `submitted`: they're still sent.
   * `discarded`: the section is disabled, so the browser leaves them out.
   */
  hiddenValues?: "submitted" | "discarded"
  /** Called after Clear with the names of the fields that were emptied. */
  onClear?: (names: string[]) => void
  /** Templates: `{label}`, `{count}` and `{fields}` ("3 filled fields") are filled in. */
  message?: string
  /** Detail line. `{names}` is filled in. */
  submittedText?: string
  /** Shown when hidden values will be dropped on submit. */
  discardedText?: string
  /** Shown after the values are cleared. */
  clearedText?: string
  /** Clear button text. */
  clearLabel?: string
  /** Keep button text. */
  keepLabel?: string
  /** Undo button text. */
  undoLabel?: string
}

/**
 * Catches values that ride along unseen. When a conditional section is
 * hidden, its fields stay mounted (so nothing is silently lost) and, if any
 * still differ from how they started, a notice names them and says whether
 * they'll be submitted or dropped. Keep is remembered until those values
 * change; Clear resets each field through real input events, so controlled
 * React state follows, and can be undone.
 */
export function HiddenFieldGuard({
  hidden,
  label,
  hiddenValues = "submitted",
  onClear,
  message = "{label} is hidden but still has {fields}.",
  submittedText = "{names} will still be submitted.",
  discardedText = "{names} won't be sent while it's hidden.",
  clearedText = "Cleared {fields} from {label}.",
  clearLabel = "Clear them",
  keepLabel = "Keep",
  undoLabel = "Undo",
  className,
  children,
  ...props
}: HiddenFieldGuardProps) {
  const sectionRef = React.useRef<HTMLFieldSetElement>(null)
  const baseline = React.useRef(new WeakMap<Field, FieldValue>())
  const [filled, setFilled] = React.useState<Saved[]>([])
  const [keptSignature, setKeptSignature] = React.useState<string>()
  const [cleared, setCleared] = React.useState<Saved[]>([])

  const scan = React.useCallback(() => {
    const fields = [...(sectionRef.current?.querySelectorAll<Field>("input, select, textarea") ?? [])]
    return fields.filter((el) => {
      if (SKIPPED.has(el.type)) return false
      if (!baseline.current.has(el)) baseline.current.set(el, isToggle(el) ? false : "")
      const value = read(el)
      return value !== baseline.current.get(el) && value !== ""
    }).map((el) => ({ el, value: read(el) }))
  }, [])

  // Choices always have a value, so their starting option (a preselected country) is the empty state.
  React.useEffect(() => {
    sectionRef.current?.querySelectorAll<Field>("select, input[type=radio]").forEach((el) => baseline.current.set(el, read(el)))
  }, [])

  React.useEffect(() => {
    setFilled(hidden ? scan() : [])
    if (!hidden) setCleared([])
  }, [hidden, scan])

  const signature = JSON.stringify(filled.map((field) => field.value))
  const names = filled.map((field) => fieldName(field.el))
  const count = (list: unknown[]) => `${list.length} filled ${list.length === 1 ? "field" : "fields"}`
  const showWarning = hidden && filled.length > 0 && keptSignature !== signature

  const clear = () => {
    filled.forEach(({ el }) => write(el, baseline.current.get(el) ?? ""))
    setCleared(filled)
    setFilled([])
    onClear?.(names)
  }
  const undo = () => {
    cleared.forEach(({ el, value }) => write(el, value))
    setFilled(cleared)
    setKeptSignature(JSON.stringify(cleared.map((field) => field.value)))
    setCleared([])
  }

  return (
    <div data-slot="hidden-field-guard" data-state={showWarning ? "warning" : hidden ? "hidden" : "shown"} className={cn("grid gap-2", className)} {...props}>
      <style>{`@keyframes cui-hidden-field-guard-in{from{opacity:0;transform:translateY(-4px)}}`}</style>
      <fieldset ref={sectionRef} hidden={hidden} disabled={hidden && hiddenValues === "discarded"} className="m-0 min-w-0 border-0 p-0">
        {children}
      </fieldset>
      <div aria-live="polite">
        {showWarning && (
          <div
            role="region"
            aria-label={`Hidden values in ${label}`}
            className={cn("rounded-lg border motion-safe:animate-[cui-hidden-field-guard-in_220ms_ease-out]", warning.surface)}
          >
            <div className={bar}>
              <div className="flex min-w-0 flex-1 basis-56 items-start gap-3 py-1">
                <EyeOff aria-hidden className={cn("mt-0.5 size-4 shrink-0", warning.icon)} />
                <p className="min-w-0">
                  <span className="font-medium">{fill(message, { label, fields: count(filled), count: filled.length })}</span>{" "}
                  <span className={warning.muted}>{fill(hiddenValues === "submitted" ? submittedText : discardedText, { names: listNames(names) })}</span>
                </p>
              </div>
              <div className="ml-auto flex gap-2">
                <button type="button" onClick={() => setKeptSignature(signature)} className={cn(action, warning.outline)}>
                  {keepLabel}
                </button>
                <button type="button" onClick={clear} className={cn(action, warning.solid)}>
                  {clearLabel}
                </button>
              </div>
            </div>
          </div>
        )}
        {hidden && cleared.length > 0 && (
          <p className="flex items-center gap-2 text-sm text-muted-foreground motion-safe:animate-[cui-hidden-field-guard-in_220ms_ease-out]">
            <span>{fill(clearedText, { label, fields: count(cleared), count: cleared.length })}</span>
            <button type="button" onClick={undo} className={cn(action, "h-7 px-2 text-foreground hover:bg-accent")}>
              <Undo2 aria-hidden className="size-3.5" />
              {undoLabel}
            </button>
          </p>
        )}
      </div>
    </div>
  )
}
