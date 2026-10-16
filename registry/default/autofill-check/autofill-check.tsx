"use client"

import * as React from "react"
import { Check, ScanSearch, TriangleAlert } from "lucide-react"

import { cn } from "@/lib/utils"
import { checkFilled, fieldKind, type FilledField, type FilledIssue } from "./autofill-rules"

export * from "./autofill-rules"

type Field = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement

const fill = (template: string, values: Record<string, string | number>) =>
  template.replace(/\{(\w+)\}/g, (m, k: string) => String(values[k] ?? m))
const keyOf = (el: Field) => el.name || el.id
const labelOf = (el: Field) => (el.labels?.[0]?.textContent ?? el.getAttribute("aria-label") ?? keyOf(el)).trim()
const isField = (t: EventTarget | null): t is Field =>
  t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement || t instanceof HTMLSelectElement

/** Sets a value the way a user would, so React and other listeners see the change. */
function setFieldValue(el: Field, value: string) {
  const proto = Object.getPrototypeOf(el) as object
  Object.getOwnPropertyDescriptor(proto, "value")?.set?.call(el, value)
  el.dispatchEvent(new Event("input", { bubbles: true }))
}

const STYLE = `@keyframes cui-autofill-check-start{from{}to{}}@keyframes cui-autofill-check-cancel{from{}to{}}
[data-slot=autofill-check] :is(input,select,textarea):not(:-webkit-autofill){animation:cui-autofill-check-cancel 1ms}
[data-slot=autofill-check] :is(input,select,textarea):-webkit-autofill{animation:cui-autofill-check-start 1ms}
[data-slot=autofill-check] :is(input,select,textarea):autofill{animation:cui-autofill-check-start 1ms}
[data-slot=autofill-check] [data-autofill]{outline:2px solid rgb(245 158 11/.6);outline-offset:1px}
[data-slot=autofill-check] [data-autofill=suspect]{outline-color:rgb(220 38 38/.7)}`

export interface AutofillCheckProps extends React.ComponentProps<"div"> {
  /** What the account already holds, by field name. An autofilled value that differs (an old address) is flagged. */
  reference?: Record<string, string>
  /** Stop the first submit while a filled value looks wrong, and move focus to it. The second submit goes through. */
  holdSubmit?: boolean
  /** Fields set without typing within this many ms of each other count as one fill (password managers, Firefox). */
  batchWindow?: number
  /** Called with the field names each time a fill is detected. */
  onAutofill?: (fields: string[]) => void
  /** Text. `{count}` is filled in; `{value}` and `{other}` in the reasons. */
  message?: string
  /** Banner text when a filled value looks wrong. */
  suspectText?: string
  /** Banner text when the first submit was held. */
  heldText?: string
  /** Text for the button that marks all filled fields as reviewed. */
  reviewedLabel?: string
  /** Text for the button that clears a suspect value. */
  clearLabel?: string
  /** Text for the button that uses the account's value instead. */
  useLabel?: string
  /** Override the explanation shown for each kind of issue. */
  reasons?: Partial<Record<FilledIssue["reason"], string>>
}

const REASONS: Record<FilledIssue["reason"], string> = {
  "email-in-name": "That's an email address, not a name.",
  "phone-in-name": "That looks like a phone number.",
  "not-email": "That isn't an email address.",
  "not-phone": "That isn't a phone number.",
  "not-postcode": "That doesn't look like a postcode.",
  differs: "Not the one on your account.",
  duplicate: "Same as {other}.",
}

const small =
  "inline-flex h-6 shrink-0 items-center gap-1 rounded-md border px-2 text-xs font-medium transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"

/**
 * Catches browser autofill putting the wrong thing in the wrong field. It spots
 * fills through `:autofill` (via an animationstart hook) and, for password
 * managers that don't trigger it, through several fields changing at once with
 * no typing. Filled fields are outlined and listed for review, values that look
 * wrong (an email in Name, an old address) are called out with a fix, and the
 * first submit is held until someone has looked.
 */
export function AutofillCheck({
  reference = {},
  holdSubmit = true,
  batchWindow = 120,
  onAutofill,
  message = "{count} fields were filled by your browser. Check them.",
  suspectText = "{count} look wrong",
  heldText = "Check the outlined fields first, then send again.",
  reviewedLabel = "Looks right",
  clearLabel = "Clear",
  useLabel = "Use {value}",
  reasons,
  className,
  children,
  ...props
}: AutofillCheckProps) {
  const rootRef = React.useRef<HTMLDivElement>(null)
  const bannerRef = React.useRef<HTMLDivElement>(null)
  const elements = React.useRef(new Map<string, Field>())
  const [filled, setFilled] = React.useState<FilledField[]>([])
  const [held, setHeld] = React.useState(false)
  const fixRef = React.useRef<(el: Field, value: string) => void>(() => {})
  const latest = React.useRef({ suspects: 0, held: false, holdSubmit, onAutofill })
  const sync = React.useCallback(() => {
    setFilled([...elements.current.values()].map((el) => ({ key: keyOf(el), label: labelOf(el), value: el.value, kind: fieldKind(el) })))
  }, [])

  const issues = checkFilled(filled, reference)
  const reasonText = { ...REASONS, ...reasons }
  React.useEffect(() => {
    latest.current = { suspects: issues.size, held, holdSubmit, onAutofill }
    for (const [key, el] of elements.current) el.setAttribute("data-autofill", issues.has(key) ? "suspect" : "filled")
  })

  React.useEffect(() => {
    const root = rootRef.current
    if (!root) return
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)")
    let lastUserAction = -Infinity
    let batch: { el: Field; at: number }[] = []
    let fixing = false

    const mark = (els: Field[]) => {
      const fresh = els.filter((el) => keyOf(el) && !elements.current.has(keyOf(el)))
      if (!fresh.length) return
      for (const el of fresh) {
        elements.current.set(keyOf(el), el)
        el.setAttribute("data-autofill", "filled")
        if (!reduced.matches) el.animate([{ outlineOffset: "6px", outlineColor: "transparent" }, {}], { duration: 300, easing: "ease-out" })
      }
      setHeld(false)
      sync()
      latest.current.onAutofill?.([...elements.current.keys()])
    }
    const unmark = (el: Field) => {
      if (!elements.current.delete(keyOf(el))) return
      el.removeAttribute("data-autofill")
      sync()
    }

    const onUser = () => (lastUserAction = performance.now())
    const onAnimation = (e: AnimationEvent) => {
      if (!isField(e.target)) return
      if (e.animationName === "cui-autofill-check-start") mark([e.target])
      else if (e.animationName === "cui-autofill-check-cancel") unmark(e.target)
    }
    const onInput = (e: Event) => {
      const el = e.target
      if (!isField(el) || fixing) return
      const now = performance.now()
      const typed = now - lastUserAction < 300 || /^(insertFrom|delete|history|format|insertText|insertComposition)/.test((e as InputEvent).inputType ?? "")
      if (typed) return unmark(el)
      if (elements.current.has(keyOf(el))) return sync()
      batch = [...batch.filter((b) => now - b.at < batchWindow && b.el !== el), { el, at: now }]
      if (batch.length >= 2) mark(batch.map((b) => b.el))
    }
    const onSubmit = (e: SubmitEvent) => {
      const { suspects, held: wasHeld, holdSubmit: hold } = latest.current
      if (!hold || !suspects || wasHeld) return
      e.preventDefault()
      e.stopPropagation()
      setHeld(true)
      root.querySelector<HTMLElement>("[data-autofill=suspect]")?.focus()
      if (!reduced.matches) bannerRef.current?.animate([{ transform: "translateX(0)" }, { transform: "translateX(-4px)" }, { transform: "translateX(4px)" }, { transform: "translateX(0)" }], { duration: 300, easing: "ease-out" })
    }

    const events: [string, EventListener][] = [["keydown", onUser], ["paste", onUser], ["drop", onUser], ["animationstart", onAnimation as EventListener], ["input", onInput]]
    for (const [type, fn] of events) root.addEventListener(type, fn, true)
    const form = root.closest("form")
    form?.addEventListener("submit", onSubmit)
    // Fills that happened before hydration don't fire animationstart.
    const initial = setTimeout(() => {
      mark([...root.querySelectorAll<Field>("input, select, textarea")].filter((el) => {
        try { return el.matches(":autofill") } catch { return el.matches(":-webkit-autofill") }
      }))
    }, 500)

    fixRef.current = (el, value) => {
      fixing = true
      setFieldValue(el, value)
      fixing = false
      unmark(el)
      el.focus()
    }
    return () => {
      for (const [type, fn] of events) root.removeEventListener(type, fn, true)
      form?.removeEventListener("submit", onSubmit)
      clearTimeout(initial)
    }
  }, [batchWindow, sync])

  const reviewAll = () => {
    for (const el of elements.current.values()) el.removeAttribute("data-autofill")
    elements.current.clear()
    setHeld(false)
    sync()
  }

  const suspect = issues.size > 0
  return (
    <div ref={rootRef} data-slot="autofill-check" className={cn("grid w-full gap-3", className)} {...props}>
      <style>{STYLE}</style>
      <div ref={bannerRef} aria-live="polite" className="empty:hidden">
        {filled.length > 0 && (
          <div
            role={held ? "alert" : undefined}
            className={cn(
              "rounded-lg border text-sm",
              suspect ? "border-amber-500/30 bg-linear-to-r from-amber-500/10 to-amber-500/10 text-amber-950 dark:text-amber-50" : "bg-muted/50",
            )}
          >
            <div className="flex min-h-11 items-center gap-3 px-3 py-1.5">
              {suspect ? <TriangleAlert aria-hidden className="size-4 shrink-0 text-amber-600 dark:text-amber-400" /> : <ScanSearch aria-hidden className="size-4 shrink-0 text-muted-foreground" />}
              <p className="min-w-0 flex-1 font-medium">
                {fill(message, { count: filled.length })}
                {suspect && <span className="font-normal"> {fill(suspectText, { count: issues.size })}.</span>}
              </p>
            </div>
            {held && <p className="px-3 pb-1.5 text-xs font-medium text-red-700 dark:text-red-400">{heldText}</p>}
            <ul className={cn("grid gap-1 border-t px-3 py-2", suspect && "border-amber-500/20")}>
              {filled.map((field) => {
                const issue = issues.get(field.key)
                const el = elements.current.get(field.key)
                return (
                  <li key={field.key} className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                    <button type="button" onClick={() => el?.focus()} className="min-w-0 truncate rounded-sm text-left outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50">
                      <span className="opacity-70">{field.label}:</span> <span className={cn("font-medium", issue && "text-red-700 dark:text-red-400")}>{field.value || "—"}</span>
                    </button>
                    {issue && (
                      <>
                        <span className="text-amber-800 dark:text-amber-300">{fill(reasonText[issue.reason], { other: issue.other ?? "" })}</span>
                        <button
                          type="button"
                          onClick={() => el && fixRef.current(el, issue.suggestion ?? "")}
                          className={cn(small, "max-w-full border-amber-500/40 text-amber-900 hover:bg-amber-500/10 dark:text-amber-200")}
                        >
                          <span className="truncate">{issue.suggestion ? fill(useLabel, { value: issue.suggestion }) : clearLabel}</span>
                        </button>
                      </>
                    )}
                  </li>
                )
              })}
            </ul>
            <div className={cn("flex justify-end border-t px-3 py-2", suspect && "border-amber-500/20")}>
              <button type="button" onClick={reviewAll} className={cn(small, "h-8 px-3 text-sm", suspect ? "border-amber-700/25 hover:bg-amber-500/15 dark:border-amber-300/25" : "bg-background hover:bg-accent")}>
                <Check aria-hidden className="size-4" />
                {reviewedLabel}
              </button>
            </div>
          </div>
        )}
      </div>
      {children}
    </div>
  )
}
