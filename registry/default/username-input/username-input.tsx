"use client"

import * as React from "react"
import { AtSign, CircleCheck, CircleX, LoaderCircle, TriangleAlert } from "lucide-react"

import { cn } from "@/lib/utils"
import {
  RESERVED_USERNAMES,
  canonicalUsername,
  checkUsername,
  cleanUsername,
  usernameCandidates,
  type UsernameIssue,
} from "@/registry/default/username-input/username"

export * from "@/registry/default/username-input/username"

/** Default messages. `{name}`, `{canonical}`, `{chars}`, `{fix}`, `{min}`, `{max}` are filled in. */
export const USERNAME_MESSAGES = {
  readback: "Your handle:",
  readbackCase: "Shown as @{name}, but it's @{canonical} for everyone else. Capitals don't count.",
  tooShort: "At least {min} characters.",
  tooLong: "At most {max} characters.",
  "lookalike-letters": "Some letters only look Latin.",
  characters: "Not allowed: {chars}.",
  edge: "Can't start or end with . or _, or use .. in a row.",
  reserved: "@{name} is reserved.",
  "reserved-lookalike": "Too close to @{name}, which is reserved for staff.",
  "case-duplicate": "@{name} already exists. Handles ignore capitals.",
  taken: "@{name} is taken.",
  impersonation: "Looks like @{name}. People could mistake you for them.",
  use: "Use {fix}",
  checking: "Checking…",
  available: "@{canonical} is available",
  unavailable: "@{canonical} is taken.",
  tryInstead: "Try:",
  checkError: "Couldn't check right now. We'll check again when you continue.",
}

/** What `checkAvailability` may return: a plain yes/no, or a no with the server's own suggestions. */
export type AvailabilityResult = boolean | { available: boolean; suggestions?: string[] }

type Availability = { state: "idle" | "checking" | "available" | "error" } | { state: "taken"; suggestions: string[] }

export interface UsernameInputProps extends Omit<React.ComponentProps<"input">, "value" | "defaultValue" | "onChange" | "minLength" | "maxLength"> {
  /** Visible label. */
  label?: string
  /** Controlled value, as typed (without the @). */
  value?: string
  /** Initial value when uncontrolled. */
  defaultValue?: string
  /** Called with the cleaned text and the canonical handle, or null while the handle can't be used. */
  onValueChange?: (value: string, handle: string | null) => void
  /** Words nobody may register, also caught in disguise (adm1n, supp0rt). */
  reserved?: string[]
  /** Handles that exist, e.g. verified or staff accounts, checked for case-only and look-alike clashes. */
  existing?: string[]
  /** Resolves whether the canonical handle is free. Debounced; stale answers are ignored. Keep it stable. */
  checkAvailability?: (handle: string, signal: AbortSignal) => AvailabilityResult | Promise<AvailabilityResult>
  /** Fewest characters. */
  minLength?: number
  /** Most characters. */
  maxLength?: number
  /** Pause in ms before checking availability. */
  delay?: number
  /** Override any of the default messages. */
  messages?: Partial<typeof USERNAME_MESSAGES>
}

const fixClass =
  "inline-flex h-6 items-center gap-1 rounded-md border border-amber-500/40 px-2 font-mono font-medium text-amber-900 transition-colors hover:bg-amber-500/10 dark:text-amber-200 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
const keyframes = `@keyframes cui-username-input-flash{0%{background-color:rgb(16 185 129 / .3)}100%{background-color:transparent}}`
const fill = (template: string, values: Record<string, string | number>) =>
  template.replace(/\{(\w+)\}/g, (match, key: string) => String(values[key] ?? match))
const blocking = (issue: UsernameIssue | null) => !!issue && ["reserved", "case-duplicate", "taken"].includes(issue.kind)

/**
 * A handle field that shows exactly what will be registered (@ and capitals stripped, ｆｕｌｌ-width
 * folded) and stops the handles that cause trouble later: reserved staff words even in disguise
 * (adm1n), names that differ from an existing one only in case, look-alikes that impersonate one
 * (pr1ya_sharma vs priya.sharma) and Cyrillic letters posing as Latin. Availability is checked after a
 * pause, stale answers are dropped, and a taken handle comes back with free alternatives to tap.
 */
export function UsernameInput({
  label = "Username",
  value,
  defaultValue = "",
  onValueChange,
  reserved = RESERVED_USERNAMES,
  existing = [],
  checkAvailability,
  minLength = 3,
  maxLength = 30,
  delay = 400,
  messages,
  id,
  className,
  ref,
  ...props
}: UsernameInputProps) {
  const [inner, setInner] = React.useState(defaultValue)
  const [availability, setAvailability] = React.useState<Availability>({ state: "idle" })
  const [flash, setFlash] = React.useState(0)
  const autoId = React.useId()
  const inputId = id ?? autoId
  const t = { ...USERNAME_MESSAGES, ...messages }
  const text = value ?? inner
  const name = cleanUsername(text)
  const canonical = canonicalUsername(text)
  const issue = checkUsername(text, { reserved, existing })
  const length = name.length < minLength ? "tooShort" : name.length > maxLength ? "tooLong" : null
  const usable = !!name && !issue && !length
  const ok = (handle: string) => {
    const h = cleanUsername(handle)
    return !checkUsername(h, { reserved, existing }) && h.length >= minLength && h.length <= maxLength
  }

  const okRef = React.useRef(ok)
  React.useEffect(() => {
    okRef.current = ok
  })

  const commit = (next: string, applied = false) => {
    if (value === undefined) setInner(next)
    onValueChange?.(cleanUsername(next), ok(next) ? canonicalUsername(next) : null)
    if (applied) setFlash((n) => n + 1)
  }

  React.useEffect(() => {
    if (!checkAvailability || !usable) return setAvailability({ state: "idle" })
    const controller = new AbortController()
    setAvailability({ state: "checking" })
    const timer = setTimeout(async () => {
      const ask = async (handle: string) => {
        const answer = await checkAvailability(handle, controller.signal)
        return typeof answer === "boolean" ? { available: answer } : answer
      }
      try {
        const first = await ask(canonical)
        if (controller.signal.aborted) return
        if (first.available) return setAvailability({ state: "available" })
        let suggestions = (first.suggestions ?? []).filter((s) => okRef.current(s)).slice(0, 3)
        if (!first.suggestions) {
          for (const candidate of usernameCandidates(canonical).filter((s) => okRef.current(s))) {
            if (suggestions.length === 3 || controller.signal.aborted) break
            if ((await ask(candidate)).available) suggestions = [...suggestions, candidate]
          }
        }
        if (!controller.signal.aborted) setAvailability({ state: "taken", suggestions })
      } catch {
        if (!controller.signal.aborted) setAvailability({ state: "error" })
      }
    }, delay)
    return () => {
      controller.abort()
      clearTimeout(timer)
    }
  }, [canonical, usable, checkAvailability, delay])

  const key = issue?.kind === "reserved" && !issue.exact ? "reserved-lookalike" : issue?.kind
  const issueText = issue && key ? fill(t[key], { name: "name" in issue ? issue.name : "", chars: "chars" in issue ? issue.chars : "" }) : ""
  const fix = issue && "fix" in issue && issue.fix ? issue.fix : undefined
  const warn = (!!issue && !blocking(issue)) || availability.state === "taken"

  return (
    <div data-slot="username-input" className={cn("grid content-start w-full max-w-sm gap-1.5", className)}>
      <style>{keyframes}</style>
      <label htmlFor={inputId} className="w-fit text-sm font-medium">
        {label}
      </label>
      <div
        data-warning={warn ? "" : undefined}
        data-invalid={blocking(issue) ? "" : undefined}
        className="flex h-9 w-full min-w-0 items-center rounded-md border shadow-xs transition-[color,box-shadow] focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50 dark:bg-input/30 data-warning:border-amber-500 dark:data-warning:border-amber-400 data-invalid:border-destructive"
      >
        <AtSign aria-hidden className="ml-3 size-4 shrink-0 text-muted-foreground" />
        <input
          ref={ref}
          id={inputId}
          type="text"
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          value={text}
          onChange={(event) => commit(event.target.value)}
          aria-invalid={blocking(issue) || undefined}
          aria-describedby={`${inputId}-status`}
          className="h-full w-full min-w-0 bg-transparent px-2 font-mono text-base outline-none md:text-sm"
          {...props}
        />
        <span aria-hidden className="mr-3 flex shrink-0">
          {availability.state === "checking" && <LoaderCircle className="size-4 animate-spin text-muted-foreground" />}
          {availability.state === "available" && <CircleCheck className="size-4 text-emerald-600 dark:text-emerald-400" />}
        </span>
      </div>
      <div id={`${inputId}-status`} aria-live="polite" className="grid min-h-6 gap-1 text-xs">
        {name && !issue && (
          <p
            key={flash}
            className={cn("w-fit rounded-sm py-1 pr-1 text-muted-foreground", flash > 0 && "motion-safe:animate-[cui-username-input-flash_400ms_ease-out]")}
          >
            {name !== canonical ? (
              fill(t.readbackCase, { name, canonical })
            ) : (
              <>{t.readback} <span className="font-mono font-medium text-foreground">@{canonical}</span></>
            )}
          </p>
        )}
        {issue && blocking(issue) && (
          <p role="alert" className="flex items-center gap-1.5 py-1 text-destructive">
            <CircleX aria-hidden className="size-3.5 shrink-0" />
            {issueText}
          </p>
        )}
        {issue && !blocking(issue) && (
          <p data-warning-id={issue.kind} className="flex gap-1.5 text-amber-700 dark:text-amber-400">
            <span className="flex h-6 shrink-0 items-center"><TriangleAlert aria-hidden className="size-3.5" /></span>
            <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
              <span className="py-1">{issueText}</span>
              {fix && (
                <button type="button" onClick={() => commit(fix, true)} className={fixClass}>
                  {fill(t.use, { fix: `@${fix}` })}
                </button>
              )}
            </span>
          </p>
        )}
        {!issue && length && name && <p className="py-1 text-muted-foreground">{fill(t[length], { min: minLength, max: maxLength })}</p>}
        {availability.state === "checking" && <p className="sr-only">{t.checking}</p>}
        {availability.state === "available" && (
          <p className="flex items-center gap-1.5 py-1 text-emerald-700 dark:text-emerald-400">
            <CircleCheck aria-hidden className="size-3.5 shrink-0" />
            {fill(t.available, { canonical })}
          </p>
        )}
        {availability.state === "error" && <p className="py-1 text-muted-foreground">{t.checkError}</p>}
        {availability.state === "taken" && (
          <p data-warning-id="unavailable" className="flex gap-1.5 text-amber-700 dark:text-amber-400">
            <span className="flex h-6 shrink-0 items-center"><TriangleAlert aria-hidden className="size-3.5" /></span>
            <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
              <span className="py-1">{fill(t.unavailable, { canonical })}{availability.suggestions.length > 0 && ` ${t.tryInstead}`}</span>
              {availability.suggestions.map((suggestion) => (
                <button key={suggestion} type="button" onClick={() => commit(suggestion, true)} className={fixClass}>
                  @{suggestion}
                </button>
              ))}
            </span>
          </p>
        )}
      </div>
    </div>
  )
}
