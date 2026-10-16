"use client"

import * as React from "react"
import { ArrowBigUpDash, Eye, EyeOff, Languages, Space } from "lucide-react"

import { cn } from "@/lib/utils"

const SCRIPTS = ["Cyrillic", "Greek", "Arabic", "Hebrew", "Devanagari", "Bengali", "Tamil", "Thai", "Han", "Hangul", "Hiragana", "Katakana"].map(
  (name) => [name, new RegExp(`\\p{Script=${name}}`, "u")] as const
)

/** Names the writing system of the first non-Latin letter in `text` (e.g. "Cyrillic"), or null. */
export function foreignScript(text: string): string | null {
  const letter = text.match(/[^\p{Script=Latin}\P{L}]/u)?.[0]
  if (!letter) return null
  return SCRIPTS.find(([, pattern]) => pattern.test(letter))?.[0] ?? "another alphabet"
}

/** Where a value has leading or trailing whitespace, or null when it has none. */
export function edgeSpaces(text: string): "start" | "end" | "both" | null {
  const start = /^\s/.test(text)
  const end = /\s$/.test(text)
  return start && end ? "both" : start ? "start" : end ? "end" : null
}

export interface PasswordInputProps
  extends Omit<React.ComponentProps<"input">, "value" | "defaultValue" | "onChange" | "type"> {
  /** Visible label. */
  label?: string
  /** Helper text shown under the field while there is nothing to warn about. */
  hint?: string
  /** Controlled value. */
  value?: string
  /** Initial value when uncontrolled. */
  defaultValue?: string
  /** Called with the new value on every change. */
  onValueChange?: (value: string) => void
  /** Warning shown while Caps Lock is on. */
  capsLockMessage?: string
  /** Label of the one-tap fix that trims a pasted password. */
  trimLabel?: string
  /** Accessible label of the peek button. */
  peekLabel?: string
  /** `hold` shows the password only while the eye is pressed (safest on a shared screen); `toggle` flips it like most sign-in forms. */
  peek?: "hold" | "toggle"
  /** Layout warning when the pressed key is known, e.g. "Q gave й". */
  layoutMessage?: (script: string, pressed: string, typed: string) => React.ReactNode
  /** Layout warning when only the letters are known (pasted or autofilled). */
  scriptMessage?: (script: string) => string
  /** Warning for a pasted password with spaces at its `start`, `end` or `both`. */
  spaceMessage?: (where: "start" | "end" | "both") => string
}

type KeyPress = { script: string; pressed: string; typed: string }

const fieldClass =
  "h-9 w-full min-w-0 rounded-md border bg-transparent pr-10 pl-3 text-base shadow-xs transition-[color,box-shadow] outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm dark:bg-input/30 data-warning:border-amber-500 dark:data-warning:border-amber-400"
const fixClass =
  "inline-flex h-6 items-center gap-1 rounded-md border border-amber-500/40 px-2 font-medium text-amber-900 transition-colors hover:bg-amber-500/10 dark:text-amber-200 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"

/**
 * A password field for the "wrong password" that was actually typed right:
 * it warns when Caps Lock is on, when the keyboard is on another layout
 * (pressing Q typed й), and when a pasted password carries a stray space.
 * Press and hold the eye to peek; letting go re-masks it.
 */
export function PasswordInput({
  label = "Password",
  hint,
  value,
  defaultValue = "",
  onValueChange,
  capsLockMessage = "Caps Lock is on.",
  trimLabel = "Trim spaces",
  peekLabel,
  peek = "hold",
  layoutMessage = (script, pressed, typed) => (
    <>
      Your keyboard is typing {script}: <kbd className="font-mono">{pressed}</kbd> gave <kbd className="font-mono">{typed}</kbd>. Switch layouts?
    </>
  ),
  scriptMessage = (script) => `The password contains ${script} letters. Is the keyboard on the right layout?`,
  spaceMessage = (where) => `The pasted password ${where === "both" ? "starts and ends" : `${where}s`} with a space.`,
  id,
  className,
  disabled,
  autoComplete = "current-password",
  onKeyDown,
  onKeyUp,
  onBlur,
  onPaste,
  ref,
  ...props
}: PasswordInputProps) {
  const [inner, setInner] = React.useState(defaultValue)
  const [capsLock, setCapsLock] = React.useState(false)
  const [keyPress, setKeyPress] = React.useState<KeyPress | null>(null)
  const [pasted, setPasted] = React.useState(false)
  const [peeking, setPeeking] = React.useState(false)
  const inputRef = React.useRef<HTMLInputElement>(null)
  const autoId = React.useId()
  const inputId = id ?? autoId
  const hintId = `${inputId}-hint`
  const password = value ?? inner

  React.useImperativeHandle(ref, () => inputRef.current as HTMLInputElement)

  // Letting go outside the window never fires pointerup, so re-mask on window blur too.
  React.useEffect(() => {
    if (!peeking || peek !== "hold") return
    const stop = () => setPeeking(false)
    window.addEventListener("blur", stop)
    window.addEventListener("pointerup", stop)
    return () => {
      window.removeEventListener("blur", stop)
      window.removeEventListener("pointerup", stop)
    }
  }, [peeking, peek])

  const update = (next: string) => {
    if (value === undefined) setInner(next)
    onValueChange?.(next)
    if (!next) setPasted(false)
  }

  const readKey = (event: React.KeyboardEvent<HTMLInputElement>) => {
    setCapsLock(event.getModifierState("CapsLock"))
    // event.code is the physical key; event.key is what the layout produced.
    const physical = event.code.match(/^Key([A-Z])$/)?.[1]
    if (physical && event.key.length === 1 && !/[a-z]/i.test(event.key)) {
      const script = foreignScript(event.key)
      if (script) setKeyPress({ script, pressed: physical, typed: event.key })
    }
  }

  const script = foreignScript(password)
  const layout = script ? (keyPress?.script === script ? keyPress : { script }) : null
  const spaces = pasted ? edgeSpaces(password) : null
  const warnings: { key: string; icon: React.ReactNode; text: React.ReactNode; fix?: () => void }[] = []
  if (capsLock) warnings.push({ key: "caps", icon: <ArrowBigUpDash />, text: capsLockMessage })
  if (layout) {
    warnings.push({
      key: "layout",
      icon: <Languages />,
      text: "pressed" in layout ? layoutMessage(layout.script, layout.pressed, layout.typed) : scriptMessage(layout.script),
    })
  }
  if (spaces) {
    warnings.push({
      key: "space",
      icon: <Space />,
      text: spaceMessage(spaces),
      fix: () => {
        update(password.trim())
        inputRef.current?.focus()
      },
    })
  }

  const hold = peek === "hold"
  const stopPeek = () => hold && setPeeking(false)
  const peekName = peekLabel ?? (hold ? "Hold to show password" : peeking ? "Hide password" : "Show password")

  return (
    <div data-slot="password-input" className={cn("grid w-full max-w-sm gap-1.5", className)}>
      <label htmlFor={inputId} className="w-fit text-sm font-medium">
        {label}
      </label>
      <div className="relative">
        <input
          ref={inputRef}
          id={inputId}
          type={peeking ? "text" : "password"}
          disabled={disabled}
          autoComplete={autoComplete}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          value={password}
          onChange={(event) => update(event.target.value)}
          onPaste={(event) => {
            setPasted(true)
            onPaste?.(event)
          }}
          onKeyDown={(event) => {
            readKey(event)
            onKeyDown?.(event)
          }}
          onKeyUp={(event) => {
            setCapsLock(event.getModifierState("CapsLock"))
            onKeyUp?.(event)
          }}
          onBlur={(event) => {
            setCapsLock(false)
            onBlur?.(event)
          }}
          aria-describedby={hintId}
          data-warning={warnings.length ? "" : undefined}
          className={fieldClass}
          {...props}
        />
        <button
          type="button"
          disabled={disabled}
          aria-label={peekName}
          aria-pressed={peeking}
          title={peekName}
          // Keep focus (and the caret) in the field while peeking.
          onPointerDown={(event) => {
            event.preventDefault()
            if (hold) setPeeking(true)
          }}
          onPointerUp={stopPeek}
          onPointerCancel={stopPeek}
          onClick={() => !hold && setPeeking((on) => !on)}
          onKeyDown={(event) => {
            if (hold && (event.key === " " || event.key === "Enter") && !event.repeat) {
              event.preventDefault()
              setPeeking(true)
            }
          }}
          onKeyUp={stopPeek}
          onBlur={stopPeek}
          onContextMenu={(event) => event.preventDefault()}
          className={cn(
            "absolute top-1/2 right-1 grid size-7 -translate-y-1/2 touch-none place-items-center rounded-md text-muted-foreground transition-colors select-none hover:bg-accent hover:text-foreground disabled:pointer-events-none disabled:opacity-50 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
            peeking && "bg-accent text-foreground"
          )}
        >
          {!hold && peeking ? <EyeOff aria-hidden className="size-4" /> : <Eye aria-hidden className="size-4" />}
        </button>
      </div>
      <div id={hintId} aria-live="polite" className="min-h-6 text-xs">
        {warnings.length ? (
          <ul className="text-amber-700 dark:text-amber-400">
            {warnings.map((warning) => (
              <li key={warning.key} className="flex gap-1.5">
                <span aria-hidden className="flex h-6 shrink-0 items-center [&_svg]:size-3.5">
                  {warning.icon}
                </span>
                <span className="flex min-w-0 flex-wrap items-center gap-x-2">
                  <span className="py-1">{warning.text}</span>
                  {warning.fix && (
                    <button type="button" onClick={warning.fix} className={fixClass}>
                      {trimLabel}
                    </button>
                  )}
                </span>
              </li>
            ))}
          </ul>
        ) : hint ? (
          <p className="py-1 text-muted-foreground">{hint}</p>
        ) : null}
      </div>
    </div>
  )
}
