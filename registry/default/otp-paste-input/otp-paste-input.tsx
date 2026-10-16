"use client"

import * as React from "react"
import { MessageSquareCode, MessageSquareWarning } from "lucide-react"

import { cn } from "@/lib/utils"

const CODE_WORDS = /\b(code|otp|passcode|pin|password|verification|verify|one[- ]time|2fa|login|sign[- ]?in)\b|कोड|ओटीपी/i
const NOT_A_CODE = /(\b(a\/?c|acct|account|card|ending|order|ref|txn|ticket|id|no|call|ph|phone|tel|rs|inr|usd)\.?|[+#₹$€£x*]|\d[:./])\s*$/i

/**
 * Turns any script's digits into ASCII 0-9: full-width ８２９ from a Japanese or Chinese IME,
 * Devanagari ४८२ from an Indic keyboard, Arabic-Indic ٤٨٢, and so on. Unicode keeps each
 * script's digits as a run of ten, so a digit's value is its distance from the start of its run.
 */
export function normalizeDigits(text: string): string {
  return text.replace(/\p{Nd}/gu, (digit) => {
    let start = digit.codePointAt(0)!
    while (/\p{Nd}/u.test(String.fromCodePoint(start - 1))) start--
    return String((digit.codePointAt(0)! - start) % 10)
  })
}

/**
 * Pulls a one-time code of exactly `length` digits out of a pasted SMS or
 * email. Runs of other lengths, phone numbers, amounts, account endings and
 * order numbers are skipped; a run near "code" / "OTP" wins over others.
 */
export function extractCode(raw: string, length = 6): string | null {
  const text = normalizeDigits(raw)
  const bare = text.replace(/[\s-]/g, "")
  if (/^\d+$/.test(bare)) return bare.length === length ? bare : null

  let best: { code: string; score: number } | null = null
  for (const match of text.matchAll(/\d+(?:[ -]\d+)*/g)) {
    const start = match.index ?? 0
    const end = start + match[0].length
    const before = text.slice(Math.max(0, start - 40), start)
    const after = text.slice(end, end + 30)
    // Glued to letters (AB12345C), or the start of a decimal or time (12.50, 10:30).
    if (/[\p{L}]$/u.test(before) || /^[\p{L}]|^[.:,/]\d/u.test(after)) continue
    const groups = match[0].split(/[ -]/)
    const joined = groups.join("")
    const options = joined.length === length && groups.every((g) => g.length >= 2) ? [joined] : groups.filter((g) => g.length === length)
    for (const code of options) {
      let score = 0
      if (CODE_WORDS.test(before)) score += 3
      if (CODE_WORDS.test(after.slice(0, 25))) score += 2
      if (NOT_A_CODE.test(before) || /^\s*%/.test(after)) score -= 4
      if (score >= 0 && (!best || score > best.score)) best = { code, score }
    }
  }
  return best?.code ?? null
}

export interface OtpPasteInputProps
  extends Omit<React.ComponentProps<"input">, "value" | "defaultValue" | "onChange" | "type" | "maxLength"> {
  /** Number of digits in the code. */
  length?: number
  /** Visible label. */
  label?: string
  /** Helper text shown until something is pasted. */
  hint?: string
  /** Controlled value (digits only). */
  value?: string
  /** Initial value when uncontrolled. */
  defaultValue?: string
  /** Called with the digits entered so far. */
  onValueChange?: (value: string) => void
  /** Called once all `length` digits are in. */
  onComplete?: (code: string) => void
  /** Shown after a code was picked out of a longer message. */
  foundMessage?: (code: string) => string
  /** Shown when a paste held no code of the right length. */
  notFoundMessage?: (length: number) => string
}

/**
 * A one-time-code field that accepts the whole message: paste "Your code is
 * 482913. Don't share it" and it keeps just 482913, skipping phone numbers and
 * amounts. Digits typed or pasted in other scripts (full-width, Devanagari) count too. One real input (autocomplete="one-time-code") sits over the boxes,
 * so SMS autofill, password managers and screen readers all just work.
 */
export function OtpPasteInput({
  length = 6,
  label = "Verification code",
  hint = "Paste the whole message if you like. We'll find the code.",
  value,
  defaultValue = "",
  onValueChange,
  onComplete,
  foundMessage = (code) => `Found ${code} in the pasted message.`,
  notFoundMessage = (n) => `Couldn't find a ${n}-digit code in what you pasted.`,
  disabled,
  id,
  className,
  onFocus,
  onBlur,
  ...props
}: OtpPasteInputProps) {
  const [inner, setInner] = React.useState(defaultValue)
  const [focused, setFocused] = React.useState(false)
  const [notice, setNotice] = React.useState<{ tone: "ok" | "warn"; text: string } | null>(null)
  const autoId = React.useId()
  const inputId = id ?? autoId
  const code = value ?? inner

  const update = (next: string) => {
    const digits = normalizeDigits(next).replace(/\D/g, "").slice(0, length)
    if (value === undefined) setInner(digits)
    onValueChange?.(digits)
    if (digits.length === length && digits !== code) onComplete?.(digits)
  }

  const fromMessage = (text: string) => {
    const found = extractCode(text, length)
    if (found) update(found)
    if (!found) setNotice({ tone: "warn", text: notFoundMessage(length) })
    else setNotice(normalizeDigits(text).replace(/[\s-]/g, "") === found ? null : { tone: "ok", text: foundMessage(found) })
  }

  // Edits only happen at the end (like the boxes suggest), but select-all stays possible so the code can be cleared.
  const keepCaretAtEnd = (input: HTMLInputElement) => {
    const end = input.value.length
    const { selectionStart: from, selectionEnd: to } = input
    if ((from === 0 && to === end) || (from === end && to === end)) return
    input.setSelectionRange(end, end)
  }

  const active = Math.min(code.length, length - 1)
  const complete = code.length === length
  const warn = notice?.tone === "warn"

  return (
    <div data-slot="otp-paste-input" className={cn("grid w-full max-w-sm gap-1.5", className)}>
      <label htmlFor={inputId} className="w-fit text-sm font-medium">
        {label}
      </label>
      <div className="relative w-fit max-w-full">
        <div aria-hidden className="flex gap-1.5 sm:gap-2">
          {Array.from({ length }, (_, i) => (
            <div
              key={i}
              className={cn(
                "grid h-9 w-9 min-w-0 shrink place-items-center rounded-md border bg-transparent font-mono text-base font-semibold tabular-nums shadow-xs transition-[color,box-shadow] sm:w-10 dark:bg-input/30",
                warn && "border-amber-500 dark:border-amber-400",
                complete && "border-emerald-500/70 dark:border-emerald-400/70",
                focused && i === active && "border-ring ring-[3px] ring-ring/50",
                disabled && "opacity-50"
              )}
            >
              {code[i] ?? (focused && i === active ? <span className="h-4 w-px animate-pulse bg-foreground" /> : null)}
            </div>
          ))}
        </div>
        {/* The real input covers the boxes; its text is transparent so the boxes do the drawing. */}
        <input
          id={inputId}
          value={code}
          disabled={disabled}
          autoComplete="one-time-code"
          inputMode="numeric"
          pattern={`\\d{${length}}`}
          spellCheck={false}
          aria-describedby={`${inputId}-notice`}
          onChange={(event) => {
            const next = event.target.value
            // Some autofill sources insert the whole message instead of just the code.
            if (/\D/.test(normalizeDigits(next)) && next.length > length) fromMessage(next)
            else {
              update(next)
              setNotice(null)
            }
          }}
          onPaste={(event) => {
            event.preventDefault()
            fromMessage(event.clipboardData.getData("text"))
          }}
          onFocus={(event) => {
            setFocused(true)
            keepCaretAtEnd(event.currentTarget)
            onFocus?.(event)
          }}
          onBlur={(event) => {
            setFocused(false)
            onBlur?.(event)
          }}
          onSelect={(event) => keepCaretAtEnd(event.currentTarget)}
          className="absolute inset-0 w-full bg-transparent font-mono text-transparent caret-transparent outline-none selection:bg-transparent disabled:cursor-not-allowed"
          {...props}
        />
      </div>
      <div id={`${inputId}-notice`} aria-live="polite" className="min-h-6 text-xs">
        {notice || hint ? (
          <p className={cn("flex gap-1.5", warn ? "text-amber-700 dark:text-amber-400" : "text-muted-foreground")}>
            {notice && (
              <span className="flex h-6 shrink-0 items-center">
                {warn ? <MessageSquareWarning aria-hidden className="size-3.5" /> : <MessageSquareCode aria-hidden className="size-3.5" />}
              </span>
            )}
            <span className="py-1">{notice?.text ?? hint}</span>
          </p>
        ) : null}
      </div>
    </div>
  )
}
