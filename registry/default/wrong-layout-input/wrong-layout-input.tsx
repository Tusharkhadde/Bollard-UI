"use client"

// Bollard UI — wrong-layout-input · MIT licence · https://bollard-ui.vercel.app/components/wrong-layout-input

import * as React from "react"
import { Check, Languages, X } from "lucide-react"

import { cn } from "@/lib/utils"
import { detectWrongLayout, KEYBOARD_LAYOUTS, type KeyboardLayout, type LayoutFix } from "./layouts"

export {
  detectWrongLayout,
  fromLayout,
  GREEK,
  HEBREW,
  HINDI_INSCRIPT,
  KEYBOARD_LAYOUTS,
  RUSSIAN,
  toLayout,
  type KeyboardLayout,
  type LayoutChange,
  type LayoutFix,
} from "./layouts"

export interface WrongLayoutInputProps
  extends Omit<React.ComponentProps<"input">, "value" | "defaultValue" | "onChange"> {
  /** Visible label. */
  label?: string
  /** Helper text shown while there is nothing to warn about. */
  hint?: string
  /** Controlled value. */
  value?: string
  /** Initial value when uncontrolled. */
  defaultValue?: string
  /** Called with the new value on every change, including a conversion and its undo. */
  onValueChange?: (value: string) => void
  /** Layouts to check against US English QWERTY. Pass only the ones your users have to keep the bundle small. */
  layouts?: KeyboardLayout[]
  /** Words that are never retyped: product names, codes, slang your users write. */
  ignore?: string[]
  /** Pause in ms before the warning appears while typing. Leaving the field shows it at once. */
  delay?: number
  /** Name of the Latin layout in messages. */
  latinName?: string
  /** Builds the warning. `typed` is the layout the text was typed in, `meant` the language it reads as. */
  warning?: (typed: string, meant: string) => string
  /** Builds the note shown after converting, with a reminder that the keyboard is probably still wrong. */
  converted?: (meant: string, keyboard: string) => string
  /** Start of the fix button's accessible name ("Use привет"). */
  useLabel?: string
  /** Accessible label of the button that keeps the text as typed. */
  keepLabel?: string
  /** Label of the button that restores the text as typed. */
  undoLabel?: string
}

const EMPTY: string[] = []
const fieldClass =
  "h-9 w-full min-w-0 rounded-md border bg-transparent px-3 text-base shadow-xs transition-[color,box-shadow] outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm dark:bg-input/30 data-warning:border-amber-500 dark:data-warning:border-amber-400"
const smallButton =
  "inline-flex h-6 shrink-0 items-center gap-1 rounded-md px-2 font-medium transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"

/** The fixed text with each retyped word marked, in the language it was meant in. */
function Preview({ fix }: { fix: LayoutFix }) {
  const parts: React.ReactNode[] = []
  let at = 0
  let shift = 0 // the fixed text drifts from the original wherever a word changed length
  for (const change of fix.changes) {
    const start = change.index + shift
    parts.push(fix.text.slice(at, start))
    parts.push(
      <mark key={start} className="rounded-sm bg-amber-300/50 px-px text-inherit dark:bg-amber-400/25">
        {change.to}
      </mark>,
    )
    at = start + change.to.length
    shift += change.to.length - change.from.length
  }
  parts.push(fix.text.slice(at))
  const lang = fix.direction === "toLayout" ? fix.layout.lang : "en"
  return (
    <bdi lang={lang} className="min-w-0 truncate">
      {parts}
    </bdi>
  )
}

/**
 * A text field that notices words typed with the wrong keyboard layout: "ghbdtn" when the
 * keyboard was on English but the person meant Russian "привет", or "руддщ" for "hello" the
 * other way round, plus Hebrew, Greek and Hindi InScript. It scores what was typed against a
 * small letter-pair model of each language, rejects spellings no real word has, and offers the
 * retyped text as a one-tap fix with undo. Names, acronyms, links and code are left alone.
 */
export function WrongLayoutInput({
  label = "Message",
  hint,
  value,
  defaultValue = "",
  onValueChange,
  layouts = KEYBOARD_LAYOUTS,
  ignore = EMPTY,
  delay = 600,
  latinName = "English",
  warning = (typed, meant) => `Looks like ${meant} typed on the ${typed} keyboard.`,
  converted = (meant, keyboard) => `Retyped in ${meant}. Your keyboard may still be set to ${keyboard}.`,
  useLabel = "Use",
  keepLabel = "Keep as typed",
  undoLabel = "Undo",
  id,
  className,
  onBlur,
  ref,
  ...props
}: WrongLayoutInputProps) {
  const [inner, setInner] = React.useState(defaultValue)
  const text = value ?? inner
  const [settled, setSettled] = React.useState(text)
  const [dismissed, setDismissed] = React.useState<string>()
  const [undo, setUndo] = React.useState<{ before: string; after: string; fix: LayoutFix }>()
  const inputRef = React.useRef<HTMLInputElement>(null)
  const autoId = React.useId()
  const inputId = id ?? autoId
  const hintId = `${inputId}-hint`

  React.useImperativeHandle(ref, () => inputRef.current as HTMLInputElement)

  React.useEffect(() => {
    const timer = setTimeout(() => setSettled(text), delay)
    return () => clearTimeout(timer)
  }, [text, delay])

  const fix = React.useMemo(
    () => (settled === text && text !== dismissed ? detectWrongLayout(text, layouts, ignore) : null),
    [settled, text, dismissed, layouts, ignore],
  )
  const done = undo && undo.after === text ? undo : undefined

  const update = (next: string) => {
    if (value === undefined) setInner(next)
    onValueChange?.(next)
  }

  const apply = (next: LayoutFix) => {
    setUndo({ before: text, after: next.text, fix: next })
    setDismissed(text) // undoing shouldn't bring the same warning straight back
    update(next.text)
    setSettled(next.text)
    const input = inputRef.current
    input?.focus()
    // A short flash shows the text was replaced, not just moved.
    if (input && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      input.animate([{ backgroundColor: "rgb(251 191 36 / 0.3)" }, { backgroundColor: "transparent" }], { duration: 400, easing: "ease-out" })
    }
  }

  const names = (f: LayoutFix) =>
    f.direction === "toLayout" ? { typed: latinName, meant: f.layout.name } : { typed: f.layout.name, meant: latinName }

  return (
    <div data-slot="wrong-layout-input" className={cn("grid w-full max-w-sm gap-1.5", className)}>
      <label htmlFor={inputId} className="w-fit text-sm font-medium">
        {label}
      </label>
      <input
        ref={inputRef}
        id={inputId}
        type="text"
        dir="auto"
        spellCheck={false}
        value={text}
        onChange={(event) => update(event.target.value)}
        onBlur={(event) => {
          setSettled(text)
          onBlur?.(event)
        }}
        aria-describedby={hintId}
        data-warning={fix ? "" : undefined}
        className={fieldClass}
        {...props}
      />
      <div id={hintId} aria-live="polite" className="min-h-6 text-xs">
        {fix ? (
          <div className="grid gap-1 text-amber-700 dark:text-amber-400">
            <p className="flex gap-1.5">
              <span className="flex h-6 shrink-0 items-center">
                <Languages aria-hidden className="size-3.5" />
              </span>
              <span className="py-1">{warning(names(fix).typed, names(fix).meant)}</span>
            </p>
            <div className="flex min-w-0 items-center gap-1 pl-5">
              <button
                type="button"
                onClick={() => apply(fix)}
                aria-label={`${useLabel} ${fix.text}`}
                className={cn(smallButton, "min-w-0 border border-amber-500/40 text-amber-900 hover:bg-amber-500/10 dark:text-amber-200")}
              >
                <span aria-hidden>{useLabel}</span>
                <Preview fix={fix} />
              </button>
              <button
                type="button"
                onClick={() => setDismissed(text)}
                aria-label={keepLabel}
                title={keepLabel}
                className="grid size-6 shrink-0 place-items-center rounded-md transition-colors hover:bg-amber-500/10 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                <X aria-hidden className="size-3.5" />
              </button>
            </div>
          </div>
        ) : done ? (
          <p className="flex gap-1.5 text-muted-foreground">
            <span className="flex h-6 shrink-0 items-center">
              <Check aria-hidden className="size-3.5 text-emerald-600 dark:text-emerald-400" />
            </span>
            <span className="flex min-w-0 flex-wrap items-center gap-x-2">
              <span className="py-1">{converted(names(done.fix).meant, names(done.fix).typed)}</span>
              <button
                type="button"
                onClick={() => {
                  update(done.before)
                  setSettled(done.before)
                  setUndo(undefined)
                  inputRef.current?.focus()
                }}
                className={cn(smallButton, "border hover:bg-accent")}
              >
                {undoLabel}
              </button>
            </span>
          </p>
        ) : hint ? (
          <p className="py-1 text-muted-foreground">{hint}</p>
        ) : null}
      </div>
    </div>
  )
}
