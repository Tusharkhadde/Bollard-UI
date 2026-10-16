"use client"

import * as React from "react"
import NumberFlow from "@number-flow/react"
import { CircleAlert, CircleCheck } from "lucide-react"
import { animate, motion, useReducedMotion } from "motion/react"

import { cn } from "@/lib/utils"

type Field = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
type Values = Record<string, string>

export interface SummaryItem {
  /** Field name, as passed to `register`. */
  name: string
  /** id of the control the link focuses. */
  targetId: string
  /** The error text, which is also the link text. */
  message: string
  /** True once the user has fixed this error since the last submit. */
  fixed: boolean
}

export interface ErrorSummaryProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "title" | "children"> {
  /** Errors from the last failed submit, in field order. Renders nothing when empty. */
  items: SummaryItem[]
  /** Increment on every failed submit; each change moves focus to the summary. */
  focusSignal: number
  /** Heading while errors remain. */
  title?: string
  /** Heading once every error is fixed. */
  fixedTitle?: string
  /** Prefix `document.title` with "Error: " while errors remain, as GOV.UK recommends. */
  prefixTitle?: boolean
}

/** Scroll the field's label (or fieldset legend) into view, then focus the field without a second jump. */
export function focusField(id: string) {
  const input = document.getElementById(id)
  if (!input) return
  const legend = input.closest("fieldset")?.querySelector("legend")
  const label = document.querySelector(`label[for="${CSS.escape(id)}"]`)
  ;(legend ?? label ?? input).scrollIntoView({ block: "center", behavior: "smooth" })
  input.focus({ preventScroll: true })
}

/**
 * GOV.UK-style error summary. After a failed submit it takes focus, lists
 * every problem as a link that scrolls to and focuses its field, and keeps
 * up as the user works: fixed items tick off in place instead of vanishing,
 * so the list never shifts under the cursor, and it says when everything is
 * ready to send again. Motion carries the meaning: a fixed item gets a check
 * that draws itself and a strike that sweeps across, the "2 of 4 fixed"
 * count rolls, the box eases from red to green when the last one is done,
 * and submitting again with errors left gives the box a small nudge so a
 * repeat press is never silent. Reduced motion keeps the states, not the motion.
 */
export function ErrorSummary({
  items,
  focusSignal,
  title = "There is a problem",
  fixedTitle = "All fixed. You can submit again.",
  prefixTitle = true,
  className,
  ...props
}: ErrorSummaryProps) {
  const ref = React.useRef<HTMLDivElement>(null)
  const titleId = React.useId()
  const done = items.filter((item) => item.fixed).length
  const hasOpen = done < items.length
  const reduce = useReducedMotion()

  React.useEffect(() => {
    if (focusSignal <= 0 || !ref.current) return
    ref.current.focus()
    // Every repeat submit with errors nudges the box, so a second press never looks like nothing happened.
    if (focusSignal > 1 && !reduce) animate(ref.current, { x: [0, -6, 6, -3, 0] }, { duration: 0.35 })
  }, [focusSignal, reduce])

  React.useEffect(() => {
    if (!prefixTitle || !hasOpen) return
    const original = document.title
    document.title = `Error: ${original}`
    return () => {
      document.title = original
    }
  }, [prefixTitle, hasOpen])

  if (items.length === 0) return null

  return (
    <div
      ref={ref}
      tabIndex={-1}
      data-slot="error-summary"
      data-state={hasOpen ? "open" : "fixed"}
      aria-labelledby={titleId}
      className={cn(
        "w-full rounded-lg border p-3 text-sm outline-none transition-colors duration-500 focus-visible:ring-[3px] focus-visible:ring-ring/50 motion-reduce:transition-none",
        hasOpen
          ? "border-red-300 bg-red-50 text-red-950 dark:border-red-900 dark:bg-red-950/40 dark:text-red-50"
          : "border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-50",
        className
      )}
      {...props}
    >
      <h2 id={titleId} className="flex items-center gap-2 font-semibold">
        {hasOpen ? (
          <CircleAlert aria-hidden className="size-4 shrink-0 text-red-600 dark:text-red-400" />
        ) : (
          <CircleCheck aria-hidden className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
        )}
        {hasOpen ? title : fixedTitle}
        {hasOpen && done > 0 && (
          <span className="ml-auto shrink-0 text-xs font-normal text-muted-foreground tabular-nums">
            <NumberFlow aria-hidden value={done} /> of {items.length} fixed
          </span>
        )}
      </h2>
      <ul className="mt-2 space-y-1.5 pl-6">
        {items.map((item) =>
          item.fixed ? (
            <li key={item.name} className="relative text-muted-foreground">
              <svg
                aria-hidden
                viewBox="0 0 16 16"
                className="absolute top-0.5 -left-5 size-4 text-emerald-600 dark:text-emerald-400"
              >
                <motion.path
                  d="M3.5 8.5l3 3 6-7"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  initial={reduce ? false : { pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 0.3, ease: "easeOut" }}
                />
              </svg>
              <span className="sr-only">Fixed: </span>
              {/* The strike sweeps across, left to right and line by line, like ticking it off by hand. */}
              <motion.span
                className="bg-[linear-gradient(currentColor,currentColor)] bg-[position:0_55%] bg-no-repeat"
                initial={reduce ? false : { backgroundSize: "0% 1px" }}
                animate={{ backgroundSize: "100% 1px" }}
                transition={{ duration: 0.4, ease: "easeOut", delay: reduce ? 0 : 0.1 }}
              >
                {item.message}
              </motion.span>
            </li>
          ) : (
            <li key={item.name}>
              <a
                href={`#${item.targetId}`}
                onClick={(event) => {
                  event.preventDefault()
                  focusField(item.targetId)
                }}
                className="rounded-sm font-medium text-red-700 underline underline-offset-2 outline-none hover:no-underline focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:text-red-300"
              >
                {item.message}
              </a>
            </li>
          )
        )}
      </ul>
      <span aria-live="polite" className="sr-only">
        {done > 0 ? (hasOpen ? `${done} of ${items.length} fixed.` : fixedTitle) : ""}
      </span>
    </div>
  )
}

export interface UseFormErrorsOptions {
  /** Return a message for each failing field, keyed by name. Receives the current field values. */
  validate: (values: Values) => Record<string, string | undefined>
}

function readValue(nodes: Set<Field>) {
  for (const node of nodes) {
    if (node instanceof HTMLInputElement && (node.type === "checkbox" || node.type === "radio")) {
      if (node.checked) return node.value
    } else return node.value
  }
  return ""
}

/**
 * Wires a form to `<ErrorSummary>`: register fields by ref, validate on
 * submit, then revalidate as the user types so the summary and inline errors
 * update live. Items are listed in the fields' DOM order.
 */
export function useFormErrors({ validate }: UseFormErrorsOptions) {
  const fields = React.useRef(new Map<string, Set<Field>>())
  // First id registered per name: the summary links there (the first radio of a group, say).
  const targetIds = React.useRef(new Map<string, string>())
  const validateRef = React.useRef(validate)
  const submitted = React.useRef(false)
  const baseId = React.useId()
  const [errors, setErrors] = React.useState<Record<string, string>>({})
  // Snapshot of the last failed submit, so fixed items keep their place and wording.
  const [reported, setReported] = React.useState<{ name: string; message: string }[]>([])
  const [submitCount, setSubmitCount] = React.useState(0)
  const [hasSubmitted, setHasSubmitted] = React.useState(false)

  React.useEffect(() => {
    validateRef.current = validate
  })

  const readAll = () => {
    const values: Values = {}
    fields.current.forEach((nodes, name) => (values[name] = readValue(nodes)))
    return values
  }

  const run = () => {
    const next: Record<string, string> = {}
    for (const [name, message] of Object.entries(validateRef.current(readAll()))) if (message) next[name] = message
    setErrors(next)
    return next
  }

  const fieldId = (name: string) => `${baseId}-${name}`
  const errorId = (name: string) => `${baseId}-${name}-error`
  const errorFor = (name: string) => (hasSubmitted ? errors[name] : undefined)

  /** Validate now and list every failing field. Returns true when the form is valid. */
  const report = () => {
    submitted.current = true
    setHasSubmitted(true)
    const next = run()
    const failing = Object.keys(next).filter((name) => fields.current.has(name))
    const first = (name: string) => fields.current.get(name)!.values().next().value as Node
    failing.sort((a, b) => (first(a).compareDocumentPosition(first(b)) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1))
    setReported(failing.map((name) => ({ name, message: next[name] })))
    return failing.length === 0
  }

  const register = (name: string, options: { id?: string } = {}) => {
    const id = options.id ?? fieldId(name)
    if (!targetIds.current.has(name)) targetIds.current.set(name, id)
    const error = errorFor(name)
    return {
      name,
      id,
      "aria-invalid": error ? true : undefined,
      "aria-describedby": error ? errorId(name) : undefined,
      ref: (node: Field | null) => {
        if (!node) return
        const group = fields.current.get(name) ?? new Set<Field>()
        group.add(node)
        fields.current.set(name, group)
        const onEdit = () => submitted.current && run()
        node.addEventListener("input", onEdit)
        node.addEventListener("change", onEdit)
        return () => {
          node.removeEventListener("input", onEdit)
          node.removeEventListener("change", onEdit)
          group.delete(node)
          if (group.size === 0) fields.current.delete(name)
        }
      },
    }
  }

  /** Submit handler: calls `onValid` with the values, or shows the summary and moves focus to it. */
  const handleSubmit = (onValid: (values: Values) => void) => (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (report()) return onValid(readAll())
    setSubmitCount((count) => count + 1)
  }

  const items: SummaryItem[] = reported.map(({ name, message }) => ({
    name,
    targetId: targetIds.current.get(name) ?? fieldId(name),
    message: errors[name] ?? message,
    fixed: !errors[name],
  }))

  return {
    register,
    handleSubmit,
    report,
    errorFor,
    errorId,
    fieldId,
    summaryProps: { items, focusSignal: submitCount },
  }
}
