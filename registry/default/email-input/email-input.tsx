"use client"

import * as React from "react"
import { autoUpdate, flip, offset, shift, size, useFloating } from "@floating-ui/react"
import { Check, MailWarning, X } from "lucide-react"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"

import { cn } from "@/lib/utils"
import { COMMON_EMAIL_DOMAINS, findEmailProblem, suggestEmailDomain } from "./email-domains"

export { COMMON_EMAIL_DOMAINS, findEmailProblem, suggestEmailDomain } from "./email-domains"

/** Highlights the part of the suggested domain that differs from what was typed. */
function Highlighted({ typed, suggestion }: { typed: string; suggestion: string }) {
  let start = 0
  while (start < typed.length && typed[start] === suggestion[start]) start++
  let end = 0
  while (end < Math.min(typed.length, suggestion.length) - start && typed[typed.length - 1 - end] === suggestion[suggestion.length - 1 - end]) end++
  return (
    <>
      {suggestion.slice(0, start)}
      <mark className="rounded-sm bg-amber-300/50 px-px text-inherit dark:bg-amber-400/25">{suggestion.slice(start, suggestion.length - end)}</mark>
      {suggestion.slice(suggestion.length - end)}
    </>
  )
}

/**
 * Domains to offer while the part after @ is still being typed: providers starting with what's
 * there, so "priya@gm" offers gmail.com before a typo can happen. Empty once the domain is complete.
 */
export function completeEmailDomain(email: string, domains: string[] = COMMON_EMAIL_DOMAINS, limit = 5): string[] {
  const at = email.lastIndexOf("@")
  if (at < 1 || email.indexOf("@") !== at) return []
  const typed = email.slice(at + 1).toLowerCase()
  if (domains.includes(typed)) return []
  return domains.filter((domain) => domain.startsWith(typed)).slice(0, limit)
}

/** Every visible string. `{email}`, `{from}` and `{to}` are filled in where noted. */
export const EMAIL_INPUT_MESSAGES = {
  typoMessage: "Looks like a typo.",
  keepLabel: "Keep it as typed",
  /** Accessible label of the fix button. */
  useLabel: "Use {email}",
  /** Visible prefix inside the fix button, before the highlighted domain. */
  useShort: "Use",
  /** Accessible name of the domain list. */
  suggestionsLabel: "Email providers",
  /** Shown for a few seconds after a fix: `{from}` → `{to}`. */
  fixedText: "Changed {from} to {to}",
}
export type EmailInputMessages = typeof EMAIL_INPUT_MESSAGES

export interface EmailInputProps
  extends Omit<React.ComponentProps<"input">, "value" | "defaultValue" | "onChange" | "type"> {
  /** Visible label. */
  label?: string
  /** Helper text shown under the field while there is nothing to warn about. */
  hint?: string
  /** Controlled value. */
  value?: string
  /** Initial value when uncontrolled. */
  defaultValue?: string
  /** Called with the cleaned value (spaces removed) on every change. */
  onValueChange?: (value: string) => void
  /** Domains to compare against. Defaults to common global and Indian providers. */
  domains?: string[]
  /** Pause in ms before warnings appear while typing. Leaving the field shows them at once. */
  delay?: number
  /** Text shown before the suggested domain. */
  typoMessage?: string
  /** Accessible label of the button that keeps the address as typed. */
  keepLabel?: string
  /** Offer matching providers in a list while the domain is being typed. Default true. */
  completeDomains?: boolean
  /** Override any text (see `EMAIL_INPUT_MESSAGES`). `typoMessage` and `keepLabel` props still win. */
  messages?: Partial<EmailInputMessages>
}

const fieldClass =
  "h-9 w-full min-w-0 rounded-md border bg-transparent px-3 text-base shadow-xs transition-[color,box-shadow] outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm dark:bg-input/30 data-warning:border-amber-500 dark:data-warning:border-amber-400"
const fixClass =
  "inline-flex h-6 items-center gap-1 rounded-md border border-amber-500/40 px-2 font-medium text-amber-900 transition-colors hover:bg-amber-500/10 dark:text-amber-200 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"

/**
 * An email field that catches typo'd domains (gmial.con, hotmial, yaho, rediffmal)
 * before the confirmation email bounces. It strips stray spaces, flags a double @
 * or stray dot, and offers a one-tap fix, but never rewrites the address on its own. While the
 * domain is still being typed it offers matching providers (gmail.com for "@gm") in a Floating UI
 * list, so the typo never gets typed in the first place.
 */
export function EmailInput({
  label = "Email",
  hint,
  value,
  defaultValue = "",
  onValueChange,
  domains = COMMON_EMAIL_DOMAINS,
  delay = 700,
  typoMessage,
  keepLabel,
  completeDomains = true,
  messages,
  id,
  className,
  onBlur,
  onFocus,
  onKeyDown,
  ref,
  "aria-describedby": describedBy,
  ...props
}: EmailInputProps) {
  const say = { ...EMAIL_INPUT_MESSAGES, ...messages, ...(typoMessage !== undefined && { typoMessage }), ...(keepLabel !== undefined && { keepLabel }) }
  const fill = (text: string, values: Record<string, string>) => text.replace(/\{(\w+)\}/g, (m, k: string) => values[k] ?? m)
  const reduce = useReducedMotion()
  const [focused, setFocused] = React.useState(false)
  const [closedFor, setClosedFor] = React.useState<string>()
  const [active, setActive] = React.useState(-1)
  const [fixed, setFixed] = React.useState<{ from: string; to: string }>()
  const [inner, setInner] = React.useState(defaultValue)
  const [settled, setSettled] = React.useState(defaultValue)
  const [dismissed, setDismissed] = React.useState<string>()
  const inputRef = React.useRef<HTMLInputElement>(null)
  const autoId = React.useId()
  const inputId = id ?? autoId
  const hintId = `${inputId}-hint`
  const email = value ?? inner

  React.useImperativeHandle(ref, () => inputRef.current as HTMLInputElement)

  React.useEffect(() => {
    const timer = setTimeout(() => setSettled(email), delay)
    return () => clearTimeout(timer)
  }, [email, delay])

  const update = (next: string) => {
    if (value === undefined) setInner(next)
    onValueChange?.(next)
  }

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const input = event.target
    const raw = input.value
    const clean = raw.replace(/\s+/g, "")
    if (clean !== raw) {
      // Keep the caret where it was, minus the spaces removed before it.
      const before = raw.slice(0, input.selectionStart ?? raw.length)
      const caret = before.replace(/\s+/g, "").length
      requestAnimationFrame(() => inputRef.current?.setSelectionRange(caret, caret))
    }
    update(clean)
  }

  const apply = (next: string, from?: string, to?: string) => {
    update(next)
    setSettled(next)
    setClosedFor(next)
    if (from && to) setFixed({ from, to })
    inputRef.current?.focus()
  }

  React.useEffect(() => {
    if (!fixed) return
    const timer = setTimeout(() => setFixed(undefined), 3000)
    return () => clearTimeout(timer)
  }, [fixed])

  const completions = completeDomains && focused && closedFor !== email ? completeEmailDomain(email, domains) : []
  const open = completions.length > 0
  const listId = `${inputId}-domains`
  const { refs, floatingStyles } = useFloating({
    open,
    placement: "bottom-start",
    strategy: "fixed",
    whileElementsMounted: autoUpdate,
    middleware: [
      offset(4),
      flip({ padding: 8 }),
      shift({ padding: 8 }),
      size({
        padding: 8,
        apply({ rects, elements }) {
          elements.floating.style.minWidth = `${Math.min(rects.reference.width, 240)}px`
        },
      }),
    ],
  })
  const local = email.slice(0, email.lastIndexOf("@") + 1)
  const complete = (domain: string) => {
    update(`${local}${domain}`)
    setSettled(`${local}${domain}`)
    setClosedFor(`${local}${domain}`)
    setActive(-1)
  }
  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    onKeyDown?.(event)
    if (!open || event.defaultPrevented) return
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault()
      const step = event.key === "ArrowDown" ? 1 : -1
      // Cycles through the options and back to "none", so Enter can still submit the form.
      const slots = completions.length + 1
      setActive((i) => ((((i + 1 + step) % slots) + slots) % slots) - 1)
    } else if ((event.key === "Enter" || event.key === "Tab") && active >= 0 && completions[active]) {
      event.preventDefault()
      complete(completions[active])
    } else if (event.key === "Escape") {
      event.preventDefault()
      setClosedFor(email)
    }
  }

  const ready = settled === email
  const problem = ready ? findEmailProblem(email) : null
  const typedDomain = email.slice(email.lastIndexOf("@") + 1)
  const suggestion = ready && !problem ? suggestEmailDomain(email, domains) : null
  const fixedEmail = suggestion ? `${email.slice(0, email.lastIndexOf("@") + 1)}${suggestion}` : ""
  const showSuggestion = suggestion && fixedEmail !== dismissed && !open

  return (
    <div data-slot="email-input" className={cn("grid w-full max-w-sm gap-1.5", className)}>
      <label htmlFor={inputId} className="w-fit text-sm font-medium">
        {label}
      </label>
      <input
        ref={(node) => {
          inputRef.current = node
          refs.setReference(node)
        }}
        id={inputId}
        role={completeDomains ? "combobox" : undefined}
        aria-autocomplete={completeDomains ? "list" : undefined}
        aria-expanded={completeDomains ? open : undefined}
        aria-controls={open ? listId : undefined}
        aria-activedescendant={open && active >= 0 ? `${listId}-${active}` : undefined}
        type="text"
        inputMode="email"
        autoComplete="email"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        value={email}
        onChange={(event) => {
          setActive(-1)
          handleChange(event)
        }}
        onKeyDown={handleKeyDown}
        onFocus={(event) => {
          setFocused(true)
          onFocus?.(event)
        }}
        onBlur={(event) => {
          setFocused(false)
          setSettled(email)
          onBlur?.(event)
        }}
        aria-describedby={cn(hintId, describedBy)}
        data-warning={problem || showSuggestion ? "" : undefined}
        className={fieldClass}
        {...props}
      />
      <AnimatePresence>
        {open && (
          <motion.ul
            ref={refs.setFloating}
            style={floatingStyles}
            id={listId}
            role="listbox"
            aria-label={say.suggestionsLabel}
            initial={reduce ? false : { opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduce ? { opacity: 0, transition: { duration: 0 } } : { opacity: 0, y: -4, transition: { duration: 0.1 } }}
            transition={{ type: "spring", stiffness: 520, damping: 36 }}
            className="z-50 overflow-hidden rounded-md border bg-popover p-1 text-sm text-popover-foreground shadow-md"
          >
            {completions.map((domain, index) => (
              <li
                key={domain}
                id={`${listId}-${index}`}
                role="option"
                aria-selected={index === active}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => complete(domain)}
                onMouseEnter={() => setActive(index)}
                className="cursor-default truncate rounded-sm px-2 py-1.5 aria-selected:bg-accent"
              >
                <span className="text-muted-foreground">{local}</span>
                <span className="font-medium">{domain.slice(0, email.length - local.length)}</span>
                {domain.slice(email.length - local.length)}
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
      <div id={hintId} aria-live="polite" className="min-h-6 text-xs">
        {problem || showSuggestion ? (
          <p className="flex gap-1.5 text-amber-700 dark:text-amber-400">
            <span className="flex h-6 shrink-0 items-center">
              <MailWarning aria-hidden className="size-3.5" />
            </span>
            <span className="flex min-w-0 flex-wrap items-center gap-x-2">
              <span className="py-1">{problem ? problem.message : say.typoMessage}</span>
              {problem?.fix ? (
                <button type="button" onClick={() => problem.fix && apply(problem.fix, email, problem.fix)} className={fixClass}>
                  {problem.fixLabel}
                </button>
              ) : suggestion ? (
                <span className="flex items-center gap-1">
                  <button type="button" onClick={() => apply(fixedEmail, `@${typedDomain}`, `@${suggestion}`)} aria-label={fill(say.useLabel, { email: fixedEmail })} className={fixClass}>
                    <span>
                      {say.useShort} @<Highlighted typed={typedDomain} suggestion={suggestion} />
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setDismissed(fixedEmail)
                      inputRef.current?.focus()
                    }}
                    aria-label={say.keepLabel}
                    title={say.keepLabel}
                    className="grid size-6 place-items-center rounded-md transition-colors hover:bg-amber-500/10 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                  >
                    <X aria-hidden className="size-3.5" />
                  </button>
                </span>
              ) : null}
            </span>
          </p>
        ) : fixed ? null : hint ? (
          <p className="py-1 text-muted-foreground">{hint}</p>
        ) : null}
        <AnimatePresence>
          {fixed && !problem && !showSuggestion && (
            <motion.p
              key="fixed"
              initial={reduce ? false : { opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-1.5 py-1 text-emerald-700 dark:text-emerald-400"
            >
              <Check aria-hidden className="size-3.5 shrink-0" />
              <span className="[overflow-wrap:anywhere]">{fill(say.fixedText, { from: fixed.from, to: fixed.to })}</span>
            </motion.p>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
