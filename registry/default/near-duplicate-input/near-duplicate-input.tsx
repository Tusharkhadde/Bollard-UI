"use client"

import * as React from "react"
import { CopyX, LoaderCircle, Plus } from "lucide-react"

import { cn } from "@/lib/utils"

/** How a typed name relates to an existing one, closest first. */
export type DuplicateReason = "exact" | "spacing" | "case" | "punctuation" | "plural" | "typo"

export interface NearDuplicate {
  item: string
  reason: DuplicateReason
}

const words = (text: string) =>
  text
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean)

/** "Bugs" → "bug", "Categories" → "category", "Boxes" → "box"; leaves "class" and "news" alone. */
const singular = (word: string) =>
  word.length < 4 || /(ss|us|is|news)$/.test(word)
    ? word
    : word.replace(/ies$/, "y").replace(/(s|x|z|ch|sh)es$/, "$1").replace(/s$/, "")

/** Optimal string alignment distance: a swapped pair of letters costs 1. */
function distance(a: string, b: string) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array<number>(b.length).fill(0)])
  for (let j = 1; j <= b.length; j++) d[0][j] = j
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1)
    }
  }
  return d[a.length][b.length]
}

const squash = (text: string) => text.trim().replace(/\s+/g, " ")
const digits = (text: string) => text.match(/\d+/g)?.join(",") ?? ""

/** How `typed` relates to `item`, or null when they are genuinely different names. */
export function compareNames(typed: string, item: string): DuplicateReason | null {
  if (typed === item) return "exact"
  if (squash(typed) === squash(item)) return "spacing"
  if (squash(typed).toLowerCase() === squash(item).toLowerCase()) return "case"
  const a = words(typed)
  const b = words(item)
  if (!a.length || !b.length) return null
  if (a.join("") === b.join("")) return "punctuation"
  const sa = a.map(singular).join("")
  const sb = b.map(singular).join("")
  if (sa === sb) return "plural"
  // A one-letter slip is a typo, but "Q3" vs "Q4" or "v1" vs "v2" are different things.
  if (sa.length < 5 || digits(sa) !== digits(sb)) return null
  return distance(sa, sb) <= (sa.length >= 10 ? 2 : 1) ? "typo" : null
}

/** The existing item closest to what was typed, or null. Ties go to the earlier item. */
export function findNearDuplicate(typed: string, items: readonly string[]): NearDuplicate | null {
  if (!typed.trim()) return null
  const order: DuplicateReason[] = ["exact", "spacing", "case", "punctuation", "plural", "typo"]
  let best: NearDuplicate | null = null
  for (const item of items) {
    const reason = compareNames(typed, item)
    if (reason && (!best || order.indexOf(reason) < order.indexOf(best.reason))) best = { item, reason }
  }
  return best
}

const defaultMessages: Record<DuplicateReason, string> = {
  exact: "{item} already exists.",
  spacing: "{item} already exists; only the spacing differs.",
  case: "{item} already exists; only the capitals differ.",
  punctuation: "{item} already exists, written with different punctuation.",
  plural: "{item} already exists; only singular vs plural differs.",
  typo: "Did you mean {item}?",
}

export interface NearDuplicateInputProps
  extends Omit<React.ComponentProps<"input">, "value" | "defaultValue" | "onChange" | "onSubmit"> {
  /** Names that already exist. */
  items: readonly string[]
  /** Visible label. */
  label?: string
  /** Controlled text. */
  value?: string
  /** Initial text when uncontrolled. */
  defaultValue?: string
  /** Called with the text on every change. */
  onValueChange?: (value: string) => void
  /** Creates the trimmed name. Return a promise to show a pending state; throw to keep the text. */
  onCreate: (name: string) => void | Promise<void>
  /** Called when the user picks the existing item instead. */
  onUseExisting?: (item: string) => void
  /** Warning text per reason; `{item}` marks where the existing name goes. */
  messages?: Partial<Record<DuplicateReason, string>>
  /** Label of the create button. */
  createLabel?: string
  /** Create button label while a near-duplicate (but not a same-name) match is showing. */
  createAnywayLabel?: string
  /** Label of the one-tap fix that picks the existing item. */
  useExistingLabel?: string
}

/**
 * A "new tag / project / label" field that stops near-duplicates. As you type
 * it compares against what exists, ignoring capitals, spacing, punctuation,
 * plurals and one-letter typos (but never different numbers: Q3 isn't Q4),
 * and offers "Use existing". Enter takes the safe path, so a hurried Enter
 * reuses the existing name; creating a near-twin anyway is a deliberate click.
 */
export function NearDuplicateInput({
  items,
  label = "New tag",
  value,
  defaultValue = "",
  onValueChange,
  onCreate,
  onUseExisting,
  messages,
  createLabel = "Create",
  createAnywayLabel = "Create anyway",
  useExistingLabel = "Use existing",
  id,
  className,
  onKeyDown,
  ref,
  ...props
}: NearDuplicateInputProps) {
  const [inner, setInner] = React.useState(defaultValue)
  const [pending, setPending] = React.useState(false)
  const inputRef = React.useRef<HTMLInputElement>(null)
  const autoId = React.useId()
  const inputId = id ?? autoId
  const text = value ?? inner
  const match = React.useMemo(() => findNearDuplicate(text, items), [text, items])
  const name = squash(text)
  const blocked = match?.reason === "exact" || match?.reason === "spacing" || match?.reason === "case"

  React.useImperativeHandle(ref, () => inputRef.current as HTMLInputElement)

  const update = (next: string) => {
    if (value === undefined) setInner(next)
    onValueChange?.(next)
  }
  const useExisting = (item: string) => {
    onUseExisting?.(item)
    update("")
    inputRef.current?.focus()
  }
  const create = async () => {
    if (!name || blocked || pending) return
    setPending(true)
    try {
      await onCreate(name)
      update("")
    } catch {
      // The caller reports the error; the text stays so nothing is lost.
    } finally {
      setPending(false)
      inputRef.current?.focus()
    }
  }

  const message = match
    ? (messages?.[match.reason] ?? defaultMessages[match.reason]).split(/(\{item\})/).map((part, index) =>
        part === "{item}" ? (
          <mark key={index} className="rounded-sm bg-amber-500/15 px-1 font-medium text-inherit">
            {match.item}
          </mark>
        ) : (
          part
        ),
      )
    : null

  return (
    <div data-slot="near-duplicate-input" className={cn("grid w-full max-w-sm gap-1.5", className)}>
      <label htmlFor={inputId} className="w-fit text-sm font-medium">
        {label}
      </label>
      <div className="flex gap-2">
        <input
          ref={inputRef}
          id={inputId}
          type="text"
          autoComplete="off"
          value={text}
          onChange={(event) => update(event.target.value)}
          onKeyDown={(event) => {
            onKeyDown?.(event)
            if (event.key !== "Enter" || event.defaultPrevented) return
            event.preventDefault()
            if (match) useExisting(match.item)
            else void create()
          }}
          aria-describedby={`${inputId}-hint`}
          data-warning={match ? "" : undefined}
          className="h-9 w-full min-w-0 rounded-md border bg-transparent px-3 text-base shadow-xs transition-[color,box-shadow] outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 md:text-sm dark:bg-input/30 data-warning:border-amber-500 dark:data-warning:border-amber-400"
          {...props}
        />
        <button
          type="button"
          onClick={create}
          disabled={!name || blocked || pending}
          aria-busy={pending || undefined}
          className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-md border bg-background px-4 text-sm font-medium shadow-xs transition-colors hover:bg-accent disabled:pointer-events-none disabled:opacity-50 dark:border-input dark:bg-input/30 dark:hover:bg-input/50 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          {pending ? <LoaderCircle aria-hidden className="size-4 animate-spin" /> : <Plus aria-hidden className="size-4" />}
          {match && !blocked ? createAnywayLabel : createLabel}
        </button>
      </div>
      <div id={`${inputId}-hint`} aria-live="polite" className="min-h-6 text-xs">
        {match && (
          <p className="flex gap-1.5 text-amber-700 dark:text-amber-400">
            <span className="flex h-6 shrink-0 items-center">
              <CopyX aria-hidden className="size-3.5" />
            </span>
            <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
              <span className="py-1">{message}</span>
              <button
                type="button"
                onClick={() => useExisting(match.item)}
                aria-label={`${useExistingLabel}: ${match.item}`}
                className="inline-flex h-6 items-center gap-1 rounded-md border border-amber-500/40 px-2 font-medium text-amber-900 transition-colors hover:bg-amber-500/10 dark:text-amber-200 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                {useExistingLabel}
              </button>
            </span>
          </p>
        )}
      </div>
    </div>
  )
}
