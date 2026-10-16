"use client"

import * as React from "react"
import { ShieldAlert, ShieldCheck, TriangleAlert } from "lucide-react"

import { cn } from "@/lib/utils"
import { findHintLeak, removeLeak, type HintLeak } from "./hint-leak"

export * from "./hint-leak"

/** Default messages. `{length}`, `{total}`, `{match}` are filled in. */
export const PASSWORD_HINT_MESSAGES = {
  hintLabel: "Password hint",
  answerLabel: "Security answer",
  hintHelp: "Anyone who tries to sign in as you can see this.",
  answerHelp: "Pick something that has nothing to do with your password.",
  whole: "Your hint contains your whole password. Anyone who sees it can sign in as you.",
  wholeReversed: "Your hint contains your password backwards. Anyone who sees it can sign in as you.",
  wholeAnswer: "Your answer contains your whole password. Anyone who learns it can sign in as you.",
  part: "Your hint gives away {length} of your password's {total} characters.",
  partAnswer: "Your answer shares {length} of your password's {total} characters.",
  reuse: "This tells anyone who sees it that you reuse a password from another account.",
  remove: "Remove “{match}”",
  clear: "Clear it",
  safe: "Doesn't give your password away.",
}

const fill = (s: string, d: Record<string, string>) => s.replace(/\{(\w+)\}/g, (m, k: string) => d[k] ?? m)

export interface PasswordHintGuardProps extends Omit<React.ComponentProps<"input">, "value" | "defaultValue" | "onChange"> {
  /** The password chosen in the same form. Only compared, never shown or stored. */
  password: string
  /** Controlled hint or answer. */
  value?: string
  /** Initial hint when uncontrolled. */
  defaultValue?: string
  /** Called with the hint on every change and fix. */
  onValueChange?: (value: string) => void
  /** A public password hint, or a security-question answer. Changes the copy. */
  kind?: "hint" | "answer"
  /** Visible label. Defaults to the kind's label. */
  label?: string
  /** Shortest shared run, in characters, that counts as giving part of the password away. */
  minRun?: number
  /** Called with the leak (or null) as it changes, so the form can block saving on a whole-password leak. */
  onLeakChange?: (leak: HintLeak | null) => void
  /** Pause in ms before the check runs while typing. Leaving the field runs it at once. */
  delay?: number
  /** Override any message or label. */
  messages?: Partial<typeof PASSWORD_HINT_MESSAGES>
}

/**
 * A password hint or security-answer field that warns when it gives the
 * password away, the way millions of Adobe hints did in 2013: the whole
 * password (also backwards, spaced out or in leetspeak), a big piece of it, or
 * "same as my bank". It never shows the password, quotes only the leaking part
 * of the hint, and removes it in one tap.
 */
export function PasswordHintGuard({
  password,
  value,
  defaultValue = "",
  onValueChange,
  kind = "hint",
  label,
  minRun = 4,
  onLeakChange,
  delay = 400,
  messages,
  id,
  className,
  onBlur,
  ref,
  "aria-describedby": describedBy,
  ...props
}: PasswordHintGuardProps) {
  const t = { ...PASSWORD_HINT_MESSAGES, ...messages }
  const [inner, setInner] = React.useState(defaultValue)
  const hint = value ?? inner
  const [settled, setSettled] = React.useState(hint)
  const inputRef = React.useRef<HTMLInputElement>(null)
  const autoId = React.useId()
  const inputId = id ?? autoId
  React.useImperativeHandle(ref, () => inputRef.current as HTMLInputElement)

  React.useEffect(() => {
    const timer = setTimeout(() => setSettled(hint), delay)
    return () => clearTimeout(timer)
  }, [hint, delay])

  const leak = React.useMemo(() => (settled.trim() ? findHintLeak(settled, password, minRun) : null), [settled, password, minRun])
  const leakRef = React.useRef(onLeakChange)
  React.useEffect(() => {
    leakRef.current = onLeakChange
  })
  React.useEffect(() => leakRef.current?.(leak), [leak])

  const update = (next: string, settle = false) => {
    if (value === undefined) setInner(next)
    if (settle) setSettled(next)
    onValueChange?.(next)
  }

  const shown = settled === hint ? leak : null
  const answer = kind === "answer"
  const match = shown ? hint.slice(shown.start, shown.end) : ""
  const fixed = shown ? removeLeak(hint, shown) : ""
  const severe = shown?.kind === "whole" || (shown?.kind === "part" && shown.length / shown.total >= 0.6)
  const message = !shown
    ? ""
    : shown.kind === "whole"
      ? answer ? t.wholeAnswer : shown.reversed ? t.wholeReversed : t.whole
      : shown.kind === "part"
        ? fill(answer ? t.partAnswer : t.part, { length: String(shown.length), total: String(shown.total) })
        : t.reuse
  const short = match.length > 24 ? `${match.slice(0, 22)}…` : match

  return (
    <div data-slot="password-hint-guard" className={cn("grid w-full max-w-sm gap-1.5", className)}>
      <label htmlFor={inputId} className="w-fit text-sm font-medium">{label ?? (answer ? t.answerLabel : t.hintLabel)}</label>
      <input
        ref={inputRef}
        id={inputId}
        autoComplete="off"
        spellCheck={false}
        value={hint}
        onChange={(e) => update(e.target.value)}
        onBlur={(e) => {
          setSettled(hint)
          onBlur?.(e)
        }}
        aria-describedby={[`${inputId}-status`, describedBy].filter(Boolean).join(" ")}
        aria-invalid={severe || undefined}
        data-warning={shown && !severe ? "" : undefined}
        className="h-9 w-full min-w-0 rounded-md border bg-transparent px-3 text-base shadow-xs transition-[color,box-shadow] outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-destructive disabled:cursor-not-allowed disabled:opacity-50 md:text-sm dark:bg-input/30 data-warning:border-amber-500 dark:data-warning:border-amber-400"
        {...props}
      />
      <div id={`${inputId}-status`} aria-live="polite" className="min-h-6 text-xs">
        {shown ? (
          <p
            role={severe ? "alert" : undefined}
            className={cn("flex gap-1.5", severe ? "text-red-700 dark:text-red-400" : "text-amber-700 dark:text-amber-400")}
          >
            <span className="flex h-6 shrink-0 items-center">
              {severe ? <ShieldAlert aria-hidden className="size-3.5" /> : <TriangleAlert aria-hidden className="size-3.5" />}
            </span>
            <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
              <span className="py-1">{message}</span>
              <button
                type="button"
                onClick={() => {
                  update(fixed, true)
                  inputRef.current?.focus()
                }}
                className={cn(
                  "inline-flex h-6 max-w-full items-center gap-1 rounded-md border px-2 font-medium transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
                  severe
                    ? "border-red-500/40 text-red-900 hover:bg-red-500/10 dark:text-red-200"
                    : "border-amber-500/40 text-amber-900 hover:bg-amber-500/10 dark:text-amber-200"
                )}
              >
                <span className="truncate">{fixed ? fill(t.remove, { match: short }) : t.clear}</span>
              </button>
            </span>
          </p>
        ) : hint.trim() && password && settled === hint ? (
          <p className="flex items-center gap-1.5 py-1 text-emerald-700 dark:text-emerald-400">
            <ShieldCheck aria-hidden className="size-3.5" /> {t.safe}
          </p>
        ) : (
          <p className="py-1 text-muted-foreground">{answer ? t.answerHelp : t.hintHelp}</p>
        )}
      </div>
    </div>
  )
}
