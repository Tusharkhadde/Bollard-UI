"use client"

import * as React from "react"
import { Check, Copy, Maximize2, X } from "lucide-react"

import { cn } from "@/lib/utils"

/** Characters that are easy to misread or mistype, with how to say them out loud. */
export const AMBIGUOUS: Record<string, string> = {
  "0": "zero", O: "letter O", o: "small o",
  "1": "one", l: "small L", I: "capital i", "|": "bar",
  "5": "five", S: "letter S", s: "small s",
  "2": "two", Z: "letter Z", z: "small z",
  "8": "eight", B: "letter B",
}

/** Splits into groups, either every `size` characters or by a pattern like [4, 4, 4] (the rest stays in one last group). */
export function chunk(value: string, size: number | number[]) {
  const out: string[] = []
  for (let i = 0, g = 0; i < value.length; g++) {
    const len = Array.isArray(size) ? (size[g] ?? value.length) : Math.max(1, size)
    out.push(value.slice(i, i + len))
    i += len
  }
  return out
}

/** Spells groups out for a screen reader: "8 letter O letter B one, small L ...". */
export function spellOut(groups: string[]) {
  return groups.map((group) => [...group].map((c) => AMBIGUOUS[c] ?? (c === " " ? "space" : c)).join(" ")).join(", ")
}

export interface ReadbackProps extends Omit<React.ComponentProps<"div">, "children"> {
  /** The value to read or type elsewhere. Spaces and dashes are removed before grouping. */
  value: string
  /** What it is, e.g. "Wi-Fi password". */
  label: string
  /** Characters per group, or a pattern like [4, 4, 4, 4]. */
  groupSize?: number | number[]
  /** Keep the original separators instead of stripping them (for passwords where they matter). */
  verbatim?: boolean
  /** Offer a full-screen, large-type view for showing the value to someone. */
  showMode?: boolean
  /** Text of the copy button. */
  copyLabel?: string
  /** Text shown after copying. */
  copiedLabel?: string
  /** Text of the full-screen button. */
  showLabel?: string
  /** Text of the button that closes the full-screen view. */
  doneLabel?: string
}

const buttonClass =
  "inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"

/**
 * Displays a code someone has to read out, copy by hand or type on another device without
 * mistakes. It groups the characters, labels every look-alike (zero vs letter O, one vs small L),
 * copies the clean value, and has a large "show to someone" view for across-the-desk handoffs.
 */
export function Readback({
  value,
  label,
  groupSize = 4,
  verbatim = false,
  showMode = true,
  copyLabel = "Copy",
  copiedLabel = "Copied",
  showLabel = "Show",
  doneLabel = "Done",
  className,
  ...props
}: ReadbackProps) {
  const [copied, setCopied] = React.useState(false)
  const [presenting, setPresenting] = React.useState(false)
  const dialogRef = React.useRef<HTMLDialogElement>(null)
  const titleId = React.useId()

  const clean = verbatim ? value : value.replace(/[\s-]/g, "")
  const groups = chunk(clean, groupSize)
  const ambiguous = [...clean].filter((c) => AMBIGUOUS[c]).length

  React.useEffect(() => {
    if (!copied) return
    const timer = setTimeout(() => setCopied(false), 1800)
    return () => clearTimeout(timer)
  }, [copied])

  // The native dialog gives the top layer, focus trapping, Escape and focus return for free.
  React.useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (presenting && !dialog.open) dialog.showModal()
    if (!presenting && dialog.open) dialog.close()
  }, [presenting])

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(clean)
      setCopied(true)
    } catch {
      // Clipboard can be blocked (insecure context, permissions); the value stays readable.
    }
  }

  const renderGroups = (large: boolean) => (
    <div aria-hidden className={cn("flex flex-wrap font-mono slashed-zero", large ? "justify-center gap-x-6 gap-y-6" : "gap-x-2 gap-y-2")}>
      {groups.map((group, g) => (
        <span key={g} className="flex">
          {[...group].map((char, i) => {
            const name = AMBIGUOUS[char]
            return (
              // Fixed-width columns keep every group evenly spaced; each label word gets its own short line.
              <span key={i} className={cn("flex flex-col items-center", large ? "w-14 text-6xl sm:w-20 sm:text-7xl" : "w-9 text-xl")}>
                <span className={cn("rounded-sm px-0.5 leading-tight", name && "bg-amber-100 text-amber-950 dark:bg-amber-400/20 dark:text-amber-100")}>{char}</span>
                <span className={cn("min-h-[2lh] text-center font-sans leading-tight text-muted-foreground", large ? "mt-2 text-xs sm:text-sm" : "mt-0.5 text-[10px]")}>
                  {name?.split(" ").map((word) => (
                    <span key={word} className="block">
                      {word}
                    </span>
                  ))}
                </span>
              </span>
            )
          })}
        </span>
      ))}
    </div>
  )

  return (
    <div data-slot="readback" className={cn("grid w-full max-w-md gap-3 rounded-lg border bg-card p-4 text-card-foreground", className)} {...props}>
      <div className="-my-1 flex items-center justify-between gap-2">
        <span className="text-sm font-medium">{label}</span>
        <div className="-mr-2 flex">
          {showMode && (
            <button type="button" className={buttonClass} onClick={() => setPresenting(true)} aria-haspopup="dialog">
              <Maximize2 aria-hidden className="size-3.5" />
              {showLabel}
            </button>
          )}
          <button type="button" className={cn(buttonClass, copied && "text-emerald-700 dark:text-emerald-400")} onClick={copy} aria-label={copied ? copiedLabel : `${copyLabel} ${label}`}>
            {copied ? <Check aria-hidden className="size-3.5" /> : <Copy aria-hidden className="size-3.5" />}
            {copied ? copiedLabel : copyLabel}
          </button>
        </div>
      </div>
      <p className="sr-only">{`${label}: ${spellOut(groups)}`}</p>
      {renderGroups(false)}
      <p className="text-xs text-muted-foreground">
        {clean.length} characters
        {ambiguous > 0 && ` · ${ambiguous} look-alike${ambiguous === 1 ? "" : "s"} labelled`}
        {!verbatim && clean !== value && " · copies without spaces"}
      </p>
      <span aria-live="polite" className="sr-only">
        {copied ? `${label} copied to clipboard` : ""}
      </span>
      {showMode && (
        <dialog
          ref={dialogRef}
          aria-labelledby={titleId}
          onClose={() => setPresenting(false)}
          className="m-0 h-dvh max-h-none w-dvw max-w-none bg-background p-6 text-foreground backdrop:bg-background open:flex open:flex-col open:items-center open:justify-center open:gap-10"
        >
          <p id={titleId} className="text-lg font-medium text-muted-foreground">
            {label}
          </p>
          {renderGroups(true)}
          <p className="sr-only">{spellOut(groups)}</p>
          <button
            type="button"
            autoFocus
            onClick={() => setPresenting(false)}
            className="inline-flex h-9 items-center gap-2 rounded-md border px-4 text-sm font-medium transition-colors hover:bg-accent outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            <X aria-hidden className="size-4" />
            {doneLabel}
          </button>
        </dialog>
      )}
    </div>
  )
}
