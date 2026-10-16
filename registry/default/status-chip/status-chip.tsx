"use client"

import * as React from "react"
import { CircleCheck, CircleDashed, CircleDotDashed, CircleHelp, Info, OctagonX, TriangleAlert, type LucideIcon } from "lucide-react"

import { cn } from "@/lib/utils"

/** Each tone has its own icon shape, so no two statuses differ by colour alone. */
export type StatusTone = "success" | "warning" | "danger" | "info" | "progress" | "neutral"

export interface StatusDefinition {
  /** Short visible text, e.g. "Payment failed". */
  label: string
  tone: StatusTone
  /** What the status means, in one sentence. */
  meaning: string
  /** What the person should do next, if anything. */
  next?: string
}

/**
 * Colours follow the Okabe-Ito colour-blind-safe palette (bluish green, orange,
 * vermillion, reddish purple, sky blue). Danger is the only solid chip, so it
 * still stands out by lightness when hue can't be seen at all.
 */
export const STATUS_TONES: Record<StatusTone, { icon: LucideIcon; className: string }> = {
  success: { icon: CircleCheck, className: "border-emerald-700/30 bg-emerald-500/10 text-emerald-800 dark:border-emerald-400/30 dark:text-emerald-300" },
  warning: { icon: TriangleAlert, className: "border-amber-600/40 bg-amber-400/15 text-amber-900 dark:border-amber-400/40 dark:text-amber-200" },
  danger: { icon: OctagonX, className: "border-transparent bg-red-700 text-white dark:bg-red-400 dark:text-red-950" },
  info: { icon: Info, className: "border-fuchsia-700/30 bg-fuchsia-500/10 text-fuchsia-800 dark:border-fuchsia-400/30 dark:text-fuchsia-300" },
  progress: { icon: CircleDotDashed, className: "border-sky-700/30 bg-sky-500/10 text-sky-800 dark:border-sky-400/30 dark:text-sky-300" },
  neutral: { icon: CircleDashed, className: "border-dashed border-foreground/30 bg-transparent text-muted-foreground" },
}

/**
 * Declares an app's statuses in one place. In development it warns when one
 * label is given two tones, the drift that makes "Pending" amber on one page
 * and blue on the next.
 */
export function defineStatuses<K extends string>(map: Record<K, StatusDefinition>) {
  if (process.env.NODE_ENV !== "production") {
    const seen = new Map<string, StatusTone>()
    for (const { label, tone } of Object.values<StatusDefinition>(map)) {
      const key = label.toLowerCase()
      if (seen.has(key) && seen.get(key) !== tone) console.warn(`StatusChip: "${label}" is defined as both ${seen.get(key)} and ${tone}.`)
      seen.set(key, tone)
    }
  }
  return map
}

/** A starter map for orders and payments. Replace or extend it with `defineStatuses`. */
export const DEFAULT_STATUSES = defineStatuses({
  paid: { label: "Paid", tone: "success", meaning: "The payment cleared and the money is on its way to you." },
  processing: { label: "Processing", tone: "progress", meaning: "The bank is still confirming the payment. This usually takes under a minute.", next: "Nothing to do, it updates on its own." },
  pending: { label: "Awaiting payment", tone: "warning", meaning: "The invoice was sent but hasn't been paid yet.", next: "Send a reminder if it's past the due date." },
  failed: { label: "Payment failed", tone: "danger", meaning: "The bank declined the payment, so the order won't ship.", next: "Ask the customer for another card or retry." },
  refunded: { label: "Refunded", tone: "info", meaning: "The money went back to the customer. The order is closed." },
  draft: { label: "Draft", tone: "neutral", meaning: "Only you can see this. Nothing has been sent.", next: "Finish it and send when ready." },
})

export type DefaultStatus = keyof typeof DEFAULT_STATUSES

export interface StatusChipProps<K extends string = DefaultStatus> extends Omit<React.ComponentProps<"button">, "children"> {
  /** The status key, looked up in `statuses`. Unknown keys render a "?" chip and warn in development. */
  status: K
  /** The app-wide status map. Share one map so a status means the same thing everywhere. */
  statuses?: Record<K, StatusDefinition>
  /** Details about this instance, shown first in the explanation, e.g. "Card ending 4242 was declined." */
  detail?: string
  /** Chip size. */
  size?: "sm" | "default"
  /** Heading before `next` in the explanation. */
  nextLabel?: string
  /** Meaning shown for a status missing from the map. */
  unknownMeaning?: string
}

/**
 * A status badge that never relies on colour alone: every tone has its own icon
 * shape plus text, colours come from a colour-blind-safe palette, and hovering
 * or focusing the chip explains what the status means and what to do next.
 * A change of status gets one short pop so it isn't missed.
 */
export function StatusChip<K extends string = DefaultStatus>({
  status,
  statuses = DEFAULT_STATUSES as Record<string, StatusDefinition> as Record<K, StatusDefinition>,
  detail,
  size = "default",
  nextLabel = "What to do",
  unknownMeaning = "This status isn't defined in the app's status map.",
  className,
  onKeyDown,
  ref,
  ...props
}: StatusChipProps<K>) {
  const known = statuses[status] as StatusDefinition | undefined
  const def: StatusDefinition = known ?? { label: String(status).replace(/[_-]+/g, " "), tone: "neutral", meaning: unknownMeaning }
  const Icon = known ? STATUS_TONES[def.tone].icon : CircleHelp
  const [open, setOpen] = React.useState(false)
  const [alignEnd, setAlignEnd] = React.useState(false)
  const chipRef = React.useRef<HTMLButtonElement>(null)
  const previous = React.useRef(status)
  const tipId = React.useId()

  React.useImperativeHandle(ref, () => chipRef.current as HTMLButtonElement)

  React.useEffect(() => {
    if (!known && process.env.NODE_ENV !== "production") console.warn(`StatusChip: unknown status "${status}".`)
  }, [known, status])

  React.useEffect(() => {
    if (previous.current === status) return
    previous.current = status
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return
    chipRef.current?.animate([{ transform: "scale(0.85)", opacity: 0.5 }, { transform: "scale(1.06)" }, { transform: "scale(1)", opacity: 1 }], { duration: 320, easing: "ease-out" })
  }, [status])

  // Open toward the side with room, inside the surrounding table, list or card (or the screen).
  React.useLayoutEffect(() => {
    const chip = chipRef.current
    if (!open || !chip) return
    const frame = chip.closest("table, ul, ol, [role=table], [role=grid], [role=list], section, article")
    const right = Math.min(window.innerWidth - 8, frame?.getBoundingClientRect().right ?? Infinity)
    setAlignEnd(chip.getBoundingClientRect().left + 256 > right)
  }, [open])

  return (
    <span className="relative inline-flex" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <button
        ref={chipRef}
        type="button"
        data-slot="status-chip"
        data-tone={def.tone}
        aria-describedby={tipId}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={(event) => {
          if (event.key === "Escape") setOpen(false)
          onKeyDown?.(event)
        }}
        className={cn(
          "inline-flex shrink-0 cursor-help items-center gap-1 rounded-full border font-medium whitespace-nowrap outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
          size === "sm" ? "h-5 px-1.5 text-[11px] [&_svg]:size-3" : "h-6 px-2 text-xs [&_svg]:size-3.5",
          STATUS_TONES[def.tone].className,
          className,
        )}
        {...props}
      >
        <Icon aria-hidden className="shrink-0" />
        {def.label}
      </button>
      <span
        id={tipId}
        role="tooltip"
        hidden={!open}
        className={cn(
          "absolute top-full z-50 mt-1.5 w-64 max-w-[calc(100vw-2rem)] rounded-md border bg-popover p-3 text-left text-xs font-normal whitespace-normal text-popover-foreground shadow-md",
          alignEnd ? "right-0" : "left-0",
        )}
      >
        <span className="mb-1 flex items-center gap-1.5 font-medium">
          <Icon aria-hidden className="size-3.5 shrink-0" />
          {def.label}
        </span>
        {detail && <span className="mb-1 block">{detail}</span>}
        <span className="block text-muted-foreground">{def.meaning}</span>
        {def.next && (
          <span className="mt-2 block">
            <span className="font-medium">{nextLabel}: </span>
            {def.next}
          </span>
        )}
      </span>
    </span>
  )
}
