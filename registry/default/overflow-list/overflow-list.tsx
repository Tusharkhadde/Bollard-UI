"use client"

// Bollard UI — overflow-list · MIT licence · https://bollard-ui.vercel.app/components/overflow-list

import * as React from "react"
import { CircleAlert, TriangleAlert } from "lucide-react"

import { cn } from "@/lib/utils"

export interface OverflowItem {
  id: string
  /** Name shown on the chip, or under the avatar as a tooltip and accessible name. */
  label: string
  /** `error` and `warning` items get a colored chip; `error` items always stay visible. */
  tone?: "default" | "error" | "warning"
  /** Short state used in the "+3 more, 1 skipped" summary when the item is hidden. */
  status?: string
  /** The signed-in user. Always stays visible and is marked "You". */
  current?: boolean
  /** Always keep this item visible, whatever `max` says. */
  pinned?: boolean
  /** Avatar image. Initials are shown when missing. */
  image?: string
}

/** True when an item must never be folded into "+N more". */
export const isPinned = (item: OverflowItem) => Boolean(item.pinned || item.current || item.tone === "error")

/**
 * Splits items into visible and hidden. Pinned items are always visible (even past
 * `max`), the rest fill the remaining slots, and the original order is kept.
 */
export function splitOverflow(items: OverflowItem[], max: number) {
  const pinned = items.filter(isPinned).length
  let free = Math.max(0, max - pinned)
  const visible: OverflowItem[] = []
  const hidden: OverflowItem[] = []
  for (const item of items) {
    if (isPinned(item) || free-- > 0) visible.push(item)
    else hidden.push(item)
  }
  // Don't spend the chip on a single item: show it instead.
  if (hidden.length === 1) return { visible: items, hidden: [] }
  return { visible, hidden }
}

/** "+3 more, 1 skipped, 1 pending": the count plus every status hiding behind it. */
export function summarizeHidden(hidden: OverflowItem[], more = "more") {
  const counts = new Map<string, number>()
  for (const item of hidden) if (item.status) counts.set(item.status, (counts.get(item.status) ?? 0) + 1)
  return [`+${hidden.length} ${more}`, ...[...counts].map(([status, n]) => `${n} ${status}`)].join(", ")
}

const initials = (label: string) =>
  label
    .split(/\s+/)
    .map((word) => word[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()

const tones = {
  default: "border bg-background",
  error: "border border-red-500/40 bg-red-500/10 text-red-800 dark:text-red-300",
  warning: "border border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-200",
}
const rings = { default: "ring-background", error: "ring-red-500", warning: "ring-amber-500" }

export interface OverflowListProps extends React.ComponentProps<"div"> {
  /** Everything in the list, in display order. */
  items: OverflowItem[]
  /** How many items to show before folding the rest into "+N more". Pinned items may exceed it. */
  max?: number
  /** `chips` for tags and statuses, `avatars` for an overlapping people stack. */
  variant?: "chips" | "avatars"
  /** Accessible name of the list, such as "Reviewers". */
  label: string
  /** Word after the hidden count. */
  moreLabel?: string
  /** Label of the button that folds the list back. */
  lessLabel?: string
  /** Text added to the current user's item. */
  youLabel?: string
  /** Controlled expanded state. */
  expanded?: boolean
  /** Initial expanded state when uncontrolled. */
  defaultExpanded?: boolean
  /** Called when the expand button is pressed. */
  onExpandedChange?: (expanded: boolean) => void
}

/**
 * A "+N more" list or avatar stack that never folds away the item you came for:
 * failed items, the signed-in user and pinned items always stay visible, and the
 * expand button says what it hides ("+4 more, 1 skipped") instead of just a count.
 */
export function OverflowList({
  items,
  max = 4,
  variant = "chips",
  label,
  moreLabel = "more",
  lessLabel = "Show less",
  youLabel = "You",
  expanded: expandedProp,
  defaultExpanded = false,
  onExpandedChange,
  className,
  ...props
}: OverflowListProps) {
  const [innerExpanded, setInnerExpanded] = React.useState(defaultExpanded)
  const expanded = expandedProp ?? innerExpanded
  const toggle = () => {
    if (expandedProp === undefined) setInnerExpanded(!expanded)
    onExpandedChange?.(!expanded)
  }
  const listId = React.useId()
  const { visible, hidden } = splitOverflow(items, max)
  const shown = expanded ? items : visible
  const summary = summarizeHidden(hidden, moreLabel)
  const hiddenIds = new Set(hidden.map((item) => item.id))
  const avatars = variant === "avatars"
  const names = hidden.slice(0, 5).map((item) => item.label).join(", ")

  return (
    <div data-slot="overflow-list" className={cn("flex flex-wrap items-center gap-2", className)} {...props}>
      <ul id={listId} aria-label={label} className={cn("flex flex-wrap items-center", avatars ? "-space-x-1 pl-0.5" : "gap-1.5")}>
        {shown.map((item, i) => {
          const tone = item.tone ?? "default"
          const revealed = expanded && hiddenIds.has(item.id)
          const text = item.current ? `${item.label} (${youLabel})` : item.label
          const motion = revealed ? "motion-safe:animate-[cui-overflow-list-in_240ms_ease-out_both]" : undefined
          const delay = revealed ? { animationDelay: `${Math.min(i, 8) * 30}ms` } : undefined
          return avatars ? (
            <li key={item.id} title={item.status ? `${text}, ${item.status}` : text} className={cn("relative", motion)} style={delay}>
              <span
                className={cn(
                  "grid size-8 place-items-center overflow-hidden rounded-full bg-muted text-xs font-semibold ring-2",
                  item.current ? "ring-primary" : rings[tone],
                )}
              >
                {item.image ? <img src={item.image} alt="" className="size-full object-cover" /> : <span aria-hidden>{initials(item.label)}</span>}
              </span>
              <span className="sr-only">{item.status ? `${text}, ${item.status}` : text}</span>
              {tone !== "default" ? (
                <span aria-hidden className={cn("absolute -right-0.5 -bottom-0.5 size-3 rounded-full ring-2 ring-background", tone === "error" ? "bg-red-500" : "bg-amber-500")} />
              ) : null}
            </li>
          ) : (
            <li
              key={item.id}
              className={cn("inline-flex h-7 items-center gap-1 rounded-md px-2 text-xs font-medium", tones[tone], item.current && "border-primary/50", motion)}
              style={delay}
            >
              {tone === "error" ? <CircleAlert aria-hidden className="size-3.5" /> : tone === "warning" ? <TriangleAlert aria-hidden className="size-3.5" /> : null}
              {item.label}
              {item.current ? <span className="rounded-sm bg-primary px-1 text-[10px] text-primary-foreground">{youLabel}</span> : null}
              {item.status ? <span className="font-normal opacity-75">· {item.status}</span> : null}
            </li>
          )
        })}
      </ul>
      {hidden.length ? (
        <button
          type="button"
          aria-expanded={expanded}
          aria-controls={listId}
          aria-label={expanded ? lessLabel : `${summary}: ${names}${hidden.length > 5 ? "…" : ""}`}
          onClick={toggle}
          className={cn(
            "inline-flex h-7 items-center gap-1 px-2.5 text-xs font-medium transition-colors outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50",
            avatars ? "h-8 rounded-full border bg-background" : "rounded-md border border-dashed",
            !expanded && hidden.some((item) => item.status) && "border-amber-500/50",
          )}
        >
          {expanded ? lessLabel : summary}
        </button>
      ) : null}
      <style>{`@keyframes cui-overflow-list-in{from{opacity:0;transform:translateX(-6px) scale(.92)}to{opacity:1;transform:none}}`}</style>
    </div>
  )
}
