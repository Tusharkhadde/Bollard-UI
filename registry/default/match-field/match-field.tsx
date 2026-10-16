"use client"

// Bollard UI — match-field · MIT licence · https://bollard-ui.vercel.app/components/match-field

import * as React from "react"
import { CircleCheck, CircleX, ClipboardX } from "lucide-react"

import { cn } from "@/lib/utils"

export type MatchStatus =
  | { state: "empty" }
  | { state: "progress"; typed: number; total: number }
  | { state: "match" }
  | { state: "mismatch"; at: number }
  | { state: "long"; extra: number }

/** Compares a confirmation against the original, character by character, without needing to show either. */
export function compareEntries(first: string, second: string): MatchStatus {
  if (!second) return { state: "empty" }
  const limit = Math.min(first.length, second.length)
  for (let i = 0; i < limit; i++) if (first[i] !== second[i]) return { state: "mismatch", at: i }
  if (second.length > first.length) return { state: "long", extra: second.length - first.length }
  return second.length === first.length ? { state: "match" } : { state: "progress", typed: second.length, total: first.length }
}

export interface MatchFieldMessages {
  empty: string
  progress: (typed: number, total: number) => string
  match: string
  mismatch: (position: number) => string
  long: (extra: number) => string
  pasteBlocked: string
  /** Shown when the paste is a copy of the first entry (the default `blockPaste="copied"` mode). */
  pasteCopied: string
}

export const DEFAULT_MATCH_FIELD_MESSAGES: MatchFieldMessages = {
  empty: "Type it again to confirm.",
  progress: (typed, total) => `So far so good: ${typed} of ${total} characters.`,
  match: "Both entries match.",
  mismatch: (position) => `Doesn't match from character ${position} onward.`,
  long: (extra) => `Too long by ${extra} character${extra === 1 ? "" : "s"}.`,
  pasteBlocked: "Pasting is off here. Type it again so a typo can't be copied across.",
  pasteCopied: "That's a copy of the entry above, so any typo would come with it. Type it again.",
}

export interface MatchFieldProps
  extends Omit<React.ComponentProps<"div">, "defaultValue" | "onChange" | "children"> {
  /** `password` masks both entries; `account` is for bank account numbers (digits only, masked once you leave the field). */
  kind?: "password" | "account"
  /** Label for the first entry. */
  label?: string
  /** Label for the confirmation entry. */
  confirmLabel?: string
  /** Helper text under the first entry. */
  hint?: string
  /** Controlled value of the first entry. */
  value?: string
  /** Initial value of the first entry when uncontrolled. */
  defaultValue?: string
  /** Initial value of the confirmation entry, e.g. when restoring a draft form. */
  defaultConfirmValue?: string
  /** Called with the first entry on every change. */
  onValueChange?: (value: string) => void
  /** Called whenever the two entries start or stop matching. */
  onMatchChange?: (matches: boolean) => void
  /** When to mask the first entry. Defaults to `always` for passwords and `blur` for accounts. */
  maskFirst?: "always" | "blur" | "never"
  /**
   * `"copied"` (default) refuses paste or drop into the confirm field only when it is a copy of
   * the first entry, so a typo can't be copied across while password managers and pasting from
   * a saved source keep working (NIST SP 800-63B and the UK NCSC advise against blocking paste).
   * `true` refuses every paste, `false` allows all.
   */
  blockPaste?: boolean | "copied"
  /** Name of the first input, for native form submission. */
  name?: string
  /** Override any of the status texts. */
  messages?: Partial<MatchFieldMessages>
}

const fieldClass =
  "h-9 w-full min-w-0 rounded-md border bg-transparent px-3 text-base shadow-xs transition-[color,box-shadow] outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 md:text-sm dark:bg-input/30 aria-invalid:border-destructive aria-invalid:focus-visible:ring-destructive/20 dark:aria-invalid:focus-visible:ring-destructive/40"

/**
 * Two-entry confirmation for passwords and bank account numbers that shows
 * where the entries part ways ("doesn't match from character 7") without
 * revealing either value. A shorter, correct-so-far confirmation reads as
 * progress, not an error. Pasting a copy of the first entry is refused (a typo
 * would ride along), but password managers and other pastes still work.
 */
export function MatchField({
  kind = "password",
  label = kind === "account" ? "Account number" : "New password",
  confirmLabel = kind === "account" ? "Re-enter account number" : "Confirm password",
  hint,
  value,
  defaultValue = "",
  defaultConfirmValue = "",
  onValueChange,
  onMatchChange,
  maskFirst = kind === "account" ? "blur" : "always",
  blockPaste = "copied",
  name,
  messages,
  className,
  ...props
}: MatchFieldProps) {
  const [inner, setInner] = React.useState(defaultValue)
  const [second, setSecond] = React.useState(defaultConfirmValue)
  const [firstFocused, setFirstFocused] = React.useState(false)
  const [pasteBlocked, setPasteBlocked] = React.useState<"all" | "copied" | null>(null)
  const copiedFromFirst = React.useRef("")
  const id = React.useId()
  const first = value ?? inner
  const text = { ...DEFAULT_MATCH_FIELD_MESSAGES, ...messages }
  const status = compareEntries(first, second)
  const account = kind === "account"
  const masked = maskFirst === "always" || (maskFirst === "blur" && !firstFocused && first.length > 0)
  const matches = status.state === "match"
  const bad = status.state === "mismatch" || status.state === "long"

  const set = (nextFirst: string, nextSecond: string) => {
    if (nextFirst !== first) {
      if (value === undefined) setInner(nextFirst)
      onValueChange?.(nextFirst)
    }
    setSecond(nextSecond)
    const nextMatches = compareEntries(nextFirst, nextSecond).state === "match"
    if (nextMatches !== matches) onMatchChange?.(nextMatches)
  }
  const clean = (input: string) => (account ? input.replace(/\D/g, "") : input)

  // Remember what was copied or dragged out of the first entry, so pasting exactly that can be caught.
  const rememberCopy = (event: React.SyntheticEvent<HTMLInputElement>) => {
    const { value: text, selectionStart, selectionEnd } = event.currentTarget
    copiedFromFirst.current = text.slice(selectionStart ?? 0, selectionEnd ?? text.length)
  }

  const refusePaste = (event: React.ClipboardEvent | React.DragEvent) => {
    if (!blockPaste) return
    if (blockPaste === "copied") {
      const data = "clipboardData" in event ? event.clipboardData : event.dataTransfer
      const incoming = clean(data.getData("text/plain")).trim()
      const copied = clean(copiedFromFirst.current).trim()
      if (!copied || incoming !== copied) return
    }
    event.preventDefault()
    setPasteBlocked(blockPaste === "copied" ? "copied" : "all")
  }

  const message =
    status.state === "empty" ? text.empty
    : status.state === "progress" ? text.progress(status.typed, status.total)
    : status.state === "match" ? text.match
    : status.state === "mismatch" ? text.mismatch(status.at + 1)
    : text.long(status.extra)
  const Icon = matches ? CircleCheck : bad ? CircleX : null
  const slots = Math.max(first.length, second.length)
  const shared = {
    inputMode: account ? ("numeric" as const) : undefined,
    autoComplete: account ? "off" : "new-password",
    autoCapitalize: "none",
    spellCheck: false,
  }

  return (
    <div data-slot="match-field" className={cn("grid w-full max-w-sm gap-4", className)} {...props}>
      <div className="grid gap-1.5">
        <label htmlFor={`${id}-a`} className="w-fit text-sm font-medium">
          {label}
        </label>
        <input
          id={`${id}-a`}
          name={name}
          type={masked ? "password" : "text"}
          value={first}
          onFocus={() => setFirstFocused(true)}
          onBlur={() => setFirstFocused(false)}
          onChange={(event) => set(clean(event.target.value), second)}
          onCopy={rememberCopy}
          onCut={rememberCopy}
          onDragStart={rememberCopy}
          aria-describedby={hint ? `${id}-hint` : undefined}
          className={cn(fieldClass, account && "font-mono tracking-wider")}
          {...shared}
        />
        {hint && (
          <p id={`${id}-hint`} className="py-1 text-xs text-muted-foreground">
            {hint}
          </p>
        )}
      </div>

      <div className="grid gap-1.5">
        <label htmlFor={`${id}-b`} className="w-fit text-sm font-medium">
          {confirmLabel}
        </label>
        <div className="relative">
          <input
            id={`${id}-b`}
            type={account ? "text" : "password"}
            value={second}
            onPaste={refusePaste}
            onDrop={refusePaste}
            onChange={(event) => {
              setPasteBlocked(null)
              set(first, clean(event.target.value))
            }}
            aria-invalid={bad || undefined}
            aria-describedby={`${id}-status`}
            className={cn(fieldClass, "pr-9", account && "font-mono tracking-wider", matches && "border-emerald-500 dark:border-emerald-400")}
            {...shared}
          />
          {matches && (
            <CircleCheck aria-hidden className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-emerald-600 dark:text-emerald-400" />
          )}
        </div>

        {slots > 0 && (
          // One dot per character: green while it matches, red from the first difference. Values are never shown.
          <div aria-hidden className="flex flex-wrap gap-1 py-0.5">
            {Array.from({ length: slots }, (_, i) => {
              const typed = i < second.length
              const wrong = bad && i >= (status.state === "mismatch" ? status.at : first.length)
              return (
                <span
                  key={i}
                  className={cn(
                    "size-2 rounded-full transition-colors",
                    !typed && "border border-muted-foreground/40",
                    typed && !wrong && "bg-emerald-500 dark:bg-emerald-400",
                    typed && wrong && "bg-red-500 dark:bg-red-400",
                    status.state === "mismatch" && i === status.at && "ring-2 ring-red-500/30"
                  )}
                />
              )
            })}
          </div>
        )}

        <div className="min-h-6 text-xs">
          <p
            id={`${id}-status`}
            className={cn(
              "flex gap-1.5 text-muted-foreground",
              bad && "text-destructive",
              matches && "text-emerald-700 dark:text-emerald-400"
            )}
          >
            {Icon && (
              <span className="flex h-6 shrink-0 items-center">
                <Icon aria-hidden className="size-3.5" />
              </span>
            )}
            <span className="py-1">{message}</span>
          </p>
          {/* Announce only the outcomes, not every keystroke of progress. */}
          <span aria-live="polite" className="sr-only">
            {bad || matches ? message : ""}
          </span>
          <p aria-live="polite" className="flex gap-1.5 text-amber-700 dark:text-amber-400">
            {pasteBlocked && (
              <>
                <span className="flex h-6 shrink-0 items-center">
                  <ClipboardX aria-hidden className="size-3.5" />
                </span>
                <span className="py-1">{pasteBlocked === "copied" ? text.pasteCopied : text.pasteBlocked}</span>
              </>
            )}
          </p>
        </div>
      </div>
    </div>
  )
}
