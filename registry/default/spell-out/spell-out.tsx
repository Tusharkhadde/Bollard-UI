"use client"

import * as React from "react"
import { Check, Copy, Eye, EyeOff, TriangleAlert } from "lucide-react"

import { cn } from "@/lib/utils"
import { findSpellTraps, groupCode, spellChar } from "./spell"

export { NATO, findSpellTraps, groupCode, spellChar, type SpelledChar } from "./spell"

const fill = (template: string, values: Record<string, string | number>) => template.replace(/\{(\w+)\}/g, (m, k: string) => String(values[k] ?? m))
const button =
  "inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-sm font-medium outline-none transition-colors hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50"

export interface SpellOutProps extends Omit<React.ComponentProps<"div">, "children" | "onCopy"> {
  /** The exact value: a booking ref, IBAN, wallet address, licence key or password. */
  value: string
  /** What it is, e.g. "Booking reference". */
  label?: string
  /** Characters per group. Defaults to 3 for short codes and 4 for long ones. */
  groupSize?: number
  /** Say "capital"/"lowercase" for letters. Defaults to on when the value mixes cases, or for secrets. */
  caseSensitive?: boolean
  /** Mask the value until revealed, then hide it again after `revealFor` ms. */
  secret?: boolean
  revealFor?: number
  /** Which view opens first. */
  defaultView?: "characters" | "phonetic"
  /** Called after the exact value was copied. */
  onCopied?: () => void
  viewLabel?: string
  charactersLabel?: string
  phoneticLabel?: string
  copyLabel?: string
  copiedLabel?: string
  showLabel?: string
  hideLabel?: string
  hiddenLabel?: string
  /** Templates: `{position}` and `{detail}` are filled in. */
  homoglyphText?: string
  invisibleText?: string
  edgeSpaceText?: string
  confusableHint?: string
}

/**
 * Stops a code being misread when it is said aloud or copied by hand. It splits the value
 * into groups, names look-alikes under the glyph (0 "zero" vs O "oh", 1/l/I), spells it in
 * the NATO alphabet ("K as in Kilo", case named when it matters), and warns about traps no
 * eye can catch: Cyrillic or Greek look-alike letters, invisible characters and edge spaces.
 */
export function SpellOut({
  value,
  label,
  groupSize,
  caseSensitive,
  secret = false,
  revealFor = 30_000,
  defaultView = "characters",
  onCopied,
  viewLabel = "View",
  charactersLabel = "Characters",
  phoneticLabel = "Read aloud",
  copyLabel = "Copy",
  copiedLabel = "Copied",
  showLabel = "Show",
  hideLabel = "Hide",
  hiddenLabel = "Hidden. Show it to spell it out.",
  homoglyphText = "Character {position} is not a Latin “{detail}”, it only looks like one.",
  invisibleText = "Character {position} is an invisible {detail}.",
  edgeSpaceText = "Character {position} is a space at the edge, easy to lose when copying.",
  confusableHint = "Look-alike characters are named underneath.",
  className,
  ...props
}: SpellOutProps) {
  const [view, setView] = React.useState(defaultView)
  const [revealed, setRevealed] = React.useState(!secret)
  const [copied, setCopied] = React.useState(false)
  const labelId = React.useId()

  React.useEffect(() => {
    if (!secret || !revealed) return
    const timer = setTimeout(() => setRevealed(false), revealFor)
    return () => clearTimeout(timer)
  }, [secret, revealed, revealFor])

  React.useEffect(() => {
    if (!copied) return
    const timer = setTimeout(() => setCopied(false), 1600)
    return () => clearTimeout(timer)
  }, [copied])

  const length = Array.from(value).length
  const cased = caseSensitive ?? (secret || (/[a-z]/.test(value) && /[A-Z]/.test(value)))
  const groups = groupCode(value, groupSize ?? (length <= 8 ? 3 : 4))
  const traps = findSpellTraps(value)
  const hasConfusable = Array.from(value).some((c) => spellChar(c).caption)
  const hidden = secret && !revealed

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      onCopied?.()
    } catch {
      // Clipboard blocked: the value is still on screen to copy by hand.
    }
  }

  let position = 0
  return (
    <div data-slot="spell-out" className={cn("grid w-full max-w-sm gap-2", className)} {...props}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        {label && (
          <span id={labelId} className="text-sm font-medium">
            {label} <span className="font-normal text-muted-foreground tabular-nums">· {length}</span>
          </span>
        )}
        <div role="group" aria-label={viewLabel} className="ml-auto inline-flex rounded-md border p-0.5">
          {(["characters", "phonetic"] as const).map((v) => (
            <button
              key={v}
              type="button"
              aria-pressed={view === v}
              onClick={() => setView(v)}
              className={cn(button, "h-7 px-2.5 text-xs", view === v && "bg-accent")}
            >
              {v === "characters" ? charactersLabel : phoneticLabel}
            </button>
          ))}
        </div>
      </div>

      <div aria-labelledby={label ? labelId : undefined} className="rounded-md border bg-muted/40 p-2.5 dark:bg-input/30">
        {view === "characters" ? (
          <div className="flex flex-wrap gap-x-3 gap-y-2 font-mono slashed-zero" role={hidden ? undefined : "list"}>
            {hidden && <span className="sr-only">{hiddenLabel}</span>}
            {groups.map((group, g) => (
              <span key={g} role={hidden ? undefined : "listitem"} className="flex gap-0.5">
                {group.map((char, c) => {
                  const spelled = spellChar(char, cased)
                  return (
                    <span
                      key={c}
                      className={cn(
                        "flex w-6 flex-col items-center rounded-sm pt-0.5",
                        spelled.caption && !hidden && "bg-background shadow-xs dark:bg-input/50",
                        spelled.trap && !hidden && "bg-amber-500/15 text-amber-900 ring-1 ring-amber-500/50 dark:text-amber-200",
                      )}
                    >
                      {!hidden && <span className="sr-only">{spelled.spoken}, </span>}
                      <span aria-hidden className="text-lg leading-6">
                        {hidden ? "•" : spelled.trap === "invisible" || char === " " ? "␣" : char}
                      </span>
                      <span aria-hidden className="h-3.5 font-sans text-[10px] leading-3.5 text-muted-foreground">
                        {!hidden && (spelled.caption ?? (spelled.trap === "homoglyph" ? "fake" : ""))}
                      </span>
                    </span>
                  )
                })}
              </span>
            ))}
          </div>
        ) : hidden ? (
          <p className="py-1 text-sm text-muted-foreground">
            <span aria-hidden>••••••••</span>
            <span className="sr-only">{hiddenLabel}</span>
          </p>
        ) : (
          <ol className="grid max-h-56 gap-1.5 overflow-y-auto text-sm">
            {groups.map((group, g) => {
              const from = position + 1
              position += group.length
              return (
                <li key={g} className="flex gap-2">
                  <span className="w-10 shrink-0 pt-0.5 text-right text-xs text-muted-foreground tabular-nums">
                    {from === position ? from : `${from}–${position}`}
                  </span>
                  <span className="flex min-w-0 flex-wrap gap-1">
                    {group.map((char, c) => {
                      const spelled = spellChar(char, cased)
                      return (
                        <span
                          key={c}
                          className={cn(
                            "rounded-sm border bg-background px-1.5 leading-6 whitespace-nowrap dark:bg-input/30",
                            spelled.trap && "border-amber-500/50 bg-amber-500/10 text-amber-900 dark:text-amber-200",
                          )}
                        >
                          {spelled.spoken}
                        </span>
                      )
                    })}
                  </span>
                </li>
              )
            })}
          </ol>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={copy} className={cn(button, "border shadow-xs")}>
          {copied ? <Check aria-hidden className="size-4" /> : <Copy aria-hidden className="size-4" />}
          {copied ? copiedLabel : copyLabel}
        </button>
        {secret && (
          <button type="button" onClick={() => setRevealed((r) => !r)} aria-pressed={revealed} className={button}>
            {revealed ? <EyeOff aria-hidden className="size-4" /> : <Eye aria-hidden className="size-4" />}
            {revealed ? hideLabel : showLabel}
          </button>
        )}
        <span aria-live="polite" className="sr-only">
          {copied ? copiedLabel : ""}
        </span>
      </div>

      <div aria-live="polite" className="grid gap-1 text-xs">
        {traps.map((trap) => (
          <p key={`${trap.kind}-${trap.position}`} className="flex gap-1.5 text-amber-700 dark:text-amber-400">
            <TriangleAlert aria-hidden className="mt-px size-3.5 shrink-0" />
            {fill(trap.kind === "homoglyph" ? homoglyphText : trap.kind === "invisible" ? invisibleText : edgeSpaceText, trap)}
          </p>
        ))}
        {!traps.length && hasConfusable && !hidden && view === "characters" && <p className="text-muted-foreground">{confusableHint}</p>}
      </div>
    </div>
  )
}
