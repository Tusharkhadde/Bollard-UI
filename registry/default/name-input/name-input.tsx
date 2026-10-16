"use client"

import * as React from "react"
import { ArrowLeftRight, TriangleAlert, X } from "lucide-react"

import { cn } from "@/lib/utils"
import { findNameIssue, looksSwapped } from "@/registry/default/name-input/name-case"

export * from "@/registry/default/name-input/name-case"

const fieldClass =
  "h-9 w-full min-w-0 rounded-md border bg-transparent px-3 text-base shadow-xs transition-[color,box-shadow] outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm dark:bg-input/30 data-warning:border-amber-500 dark:data-warning:border-amber-400"
const fixClass =
  "inline-flex h-6 min-w-0 items-center gap-1 rounded-md border border-amber-500/40 px-2 font-medium text-amber-900 transition-colors hover:bg-amber-500/10 dark:text-amber-200 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
const keepClass =
  "grid size-6 shrink-0 place-items-center rounded-md transition-colors hover:bg-amber-500/10 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"

/** One amber warning line with an optional one-tap fix and a "keep it" button. */
function Warning({ message, fixLabel, onFix, onKeep, keepLabel, icon: Icon = TriangleAlert }: {
  message: string
  fixLabel?: React.ReactNode
  onFix?: () => void
  onKeep: () => void
  keepLabel: string
  icon?: typeof TriangleAlert
}) {
  return (
    <p className="flex gap-1.5 text-amber-700 dark:text-amber-400">
      <span className="flex h-6 shrink-0 items-center">
        <Icon aria-hidden className="size-3.5" />
      </span>
      <span className="flex min-w-0 flex-wrap items-center gap-x-2">
        <span className="py-1">{message}</span>
        <span className="flex min-w-0 items-center gap-1">
          {onFix && (
            <button type="button" onClick={onFix} className={fixClass}>
              <span className="truncate">{fixLabel}</span>
            </button>
          )}
          <button type="button" onClick={onKeep} aria-label={keepLabel} title={keepLabel} className={keepClass}>
            <X aria-hidden className="size-3.5" />
          </button>
        </span>
      </span>
    </p>
  )
}

export interface NameInputProps
  extends Omit<React.ComponentProps<"input">, "value" | "defaultValue" | "onChange" | "type"> {
  /** Visible label. */
  label?: string
  /** Controlled value. */
  value?: string
  /** Initial value when uncontrolled. */
  defaultValue?: string
  /** Called with the value exactly as typed. Nothing is ever rewritten without a tap. */
  onValueChange?: (value: string) => void
  /** Helper text shown while there is nothing to point out. */
  hint?: string
  /** The field holds only a family name, so a leading particle stays lower case ("van der Berg"). */
  surname?: boolean
  /** Pause in ms before suggestions appear while typing. Leaving the field shows them at once. */
  delay?: number
  /** Shown when the name is in capitals. */
  capsMessage?: string
  /** Shown when the name is all lowercase. */
  lowerMessage?: string
  /** Shown when a name has digits; receives them, e.g. "2". */
  digitsMessage?: (digits: string) => string
  /** Shown for doubled or stray spaces. */
  spacesMessage?: string
  /** Fix button text; receives the suggested name. */
  fixLabel?: (fix: string) => string
  /** Accessible label of the button that keeps the name as typed. */
  keepLabel?: string
}

/**
 * A person-name field that notices caps lock, an all-lowercase name, stray
 * digits and doubled spaces, and offers a cased version that respects McDonald,
 * O'Brien, Jean-Pierre, van der Berg and de la Cruz. Words the person already
 * mixed-cased are never touched, and nothing changes until they tap the fix.
 */
export function NameInput({
  label = "Full name",
  value,
  defaultValue = "",
  onValueChange,
  hint,
  surname = false,
  delay = 700,
  capsMessage = "Typed in capitals?",
  lowerMessage = "Names usually start with a capital.",
  digitsMessage = (digits) => `Names rarely contain digits (${digits}).`,
  spacesMessage = "There's an extra space.",
  fixLabel = (fix) => `Use “${fix}”`,
  keepLabel = "Keep it as typed",
  id,
  className,
  onBlur,
  ref,
  ...props
}: NameInputProps) {
  const [inner, setInner] = React.useState(defaultValue)
  const [settled, setSettled] = React.useState(defaultValue)
  const [kept, setKept] = React.useState<string>()
  const inputRef = React.useRef<HTMLInputElement>(null)
  const autoId = React.useId()
  const inputId = id ?? autoId
  const name = value ?? inner

  React.useImperativeHandle(ref, () => inputRef.current as HTMLInputElement)

  React.useEffect(() => {
    const timer = setTimeout(() => setSettled(name), delay)
    return () => clearTimeout(timer)
  }, [name, delay])

  const update = (next: string) => {
    if (value === undefined) setInner(next)
    onValueChange?.(next)
  }

  const issue = settled === name && name !== kept ? findNameIssue(name, { surname }) : null
  const message = !issue
    ? ""
    : issue.kind === "digits"
      ? digitsMessage(issue.detail ?? "")
      : issue.kind === "spaces"
        ? spacesMessage
        : issue.detail === "caps" ? capsMessage : lowerMessage

  return (
    <div data-slot="name-input" className={cn("grid w-full max-w-sm gap-1.5", className)}>
      <label htmlFor={inputId} className="w-fit text-sm font-medium">
        {label}
      </label>
      <input
        ref={inputRef}
        id={inputId}
        type="text"
        autoComplete={surname ? "family-name" : "name"}
        autoCapitalize="words"
        spellCheck={false}
        value={name}
        onChange={(event) => update(event.target.value)}
        onBlur={(event) => {
          setSettled(name)
          onBlur?.(event)
        }}
        aria-describedby={`${inputId}-hint`}
        data-warning={issue ? "" : undefined}
        className={fieldClass}
        {...props}
      />
      <div id={`${inputId}-hint`} aria-live="polite" className="min-h-6 text-xs">
        {issue ? (
          <Warning
            message={message}
            fixLabel={issue.fix && fixLabel(issue.fix)}
            onFix={issue.fix ? () => {
              update(issue.fix as string)
              setSettled(issue.fix as string)
              inputRef.current?.focus()
            } : undefined}
            onKeep={() => setKept(name)}
            keepLabel={keepLabel}
          />
        ) : hint ? (
          <p className="py-1 text-muted-foreground">{hint}</p>
        ) : null}
      </div>
    </div>
  )
}

export interface PersonName {
  first: string
  last: string
}

export interface NameFieldsProps extends Omit<React.ComponentProps<"fieldset">, "defaultValue" | "onChange"> {
  /** Controlled names. */
  value?: PersonName
  /** Initial names when uncontrolled. */
  defaultValue?: PersonName
  /** Called with both names whenever either changes. */
  onValueChange?: (value: PersonName) => void
  /** Label for the first-name box. */
  firstLabel?: string
  /** Label for the last-name box. */
  lastLabel?: string
  /** Shown when the two look entered the wrong way round. */
  swapMessage?: string
  /** Button text to swap first and last. */
  swapLabel?: string
  /** Shown when the whole name went into the first field; receives the word that looks like the surname. */
  splitMessage?: (word: string) => string
  /** Button text to split a full name. */
  splitLabel?: string
  /** Accessible label for keeping the name as typed. */
  keepLabel?: string
  /** Pause in ms after typing stops before the pair is checked. */
  delay?: number
}

/**
 * First and last name fields that also catch the pair entered the wrong way
 * round (Sharma / Priya) or the whole name typed into the first field, each
 * with a one-tap swap or move. Each field gets NameInput's casing checks.
 */
export function NameFields({
  value,
  defaultValue = { first: "", last: "" },
  onValueChange,
  firstLabel = "First name",
  lastLabel = "Last name",
  swapMessage = "First and last name look swapped.",
  swapLabel = "Swap them",
  splitMessage = (word) => `Is “${word}” the last name?`,
  splitLabel = "Move it",
  keepLabel = "Keep them as typed",
  delay = 700,
  className,
  ...props
}: NameFieldsProps) {
  const [inner, setInner] = React.useState(defaultValue)
  const [kept, setKept] = React.useState<string>()
  const names = value ?? inner
  const key = `${names.first}\u0000${names.last}`
  const [settled, setSettled] = React.useState(key)

  React.useEffect(() => {
    const timer = setTimeout(() => setSettled(key), delay)
    return () => clearTimeout(timer)
  }, [key, delay])

  const update = (next: PersonName) => {
    if (value === undefined) setInner(next)
    onValueChange?.(next)
  }

  const words = names.first.trim().split(/\s+/)
  const ready = key === settled && key !== kept
  const swapped = ready && looksSwapped(names.first, names.last)
  const split = ready && !names.last.trim() && words.length === 2 && /^\p{Lu}/u.test(words[1]) ? words[1] : ""

  return (
    <fieldset data-slot="name-fields" className={cn("@container grid w-full min-w-0 max-w-sm gap-1.5", className)} {...props}>
      <div className="grid gap-x-3 @xs:grid-cols-2">
        <NameInput label={firstLabel} autoComplete="given-name" value={names.first} onValueChange={(first) => update({ ...names, first })} />
        <NameInput label={lastLabel} surname value={names.last} onValueChange={(last) => update({ ...names, last })} />
      </div>
      <div aria-live="polite" className="text-xs empty:hidden">
        {swapped ? (
          <Warning
            icon={ArrowLeftRight}
            message={swapMessage}
            fixLabel={swapLabel}
            onFix={() => update({ first: names.last.trim(), last: names.first.trim().replace(/,$/, "") })}
            onKeep={() => setKept(key)}
            keepLabel={keepLabel}
          />
        ) : split ? (
          <Warning
            message={splitMessage(split)}
            fixLabel={splitLabel}
            onFix={() => update({ first: words[0], last: split })}
            onKeep={() => setKept(key)}
            keepLabel={keepLabel}
          />
        ) : null}
      </div>
    </fieldset>
  )
}
