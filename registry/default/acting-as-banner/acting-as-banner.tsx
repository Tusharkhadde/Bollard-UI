"use client"

import * as React from "react"
import { Clock, LoaderCircle, Undo2, UserCog } from "lucide-react"

import { cn } from "@/lib/utils"

/** Banner layout shared by every Bollard UI banner: one height, padding, icon size and action style. */
const bar = "flex min-h-11 flex-wrap items-center gap-x-3 gap-y-1.5 px-3 py-1.5 text-sm"
const action =
  "inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-md px-3 text-sm font-medium whitespace-nowrap outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-60"
/** Banner tones, identical across Bollard UI banners. */
const tones = {
  warning: {
    surface: "border-amber-500/30 bg-background bg-linear-to-r from-amber-500/10 to-amber-500/10 text-amber-950 dark:text-amber-50",
    icon: "text-amber-600 dark:text-amber-400",
    muted: "text-amber-900/75 dark:text-amber-100/75",
    solid: "bg-amber-700 text-white hover:bg-amber-800 dark:bg-amber-400 dark:text-amber-950 dark:hover:bg-amber-300",
    outline: "border border-amber-700/25 hover:bg-amber-500/15 dark:border-amber-300/25",
  },
} as const

const hues = [12, 36, 160, 200, 230, 262, 290, 330]

/** A stable hue per org name, so "Acme Corp" is the same color in the banner and on every button. */
export function orgHue(name: string) {
  let hash = 0
  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) | 0
  return hues[Math.abs(hash) % hues.length]
}

function OrgMark({ name, className }: { name: string; className?: string }) {
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("")
  return (
    <span
      aria-hidden
      style={{ backgroundColor: `oklch(0.55 0.16 ${orgHue(name)})` }}
      className={cn("grid shrink-0 place-items-center rounded-[4px] font-semibold text-white", className)}
    >
      {initials}
    </span>
  )
}

function useMinutesLeft(expiresAt: Date | string | number | undefined, onExpire?: () => void) {
  const [minutes, setMinutes] = React.useState<number>()
  const expire = React.useRef(onExpire)
  React.useEffect(() => {
    expire.current = onExpire
  })
  React.useEffect(() => {
    setMinutes(undefined)
    if (expiresAt === undefined) return
    const end = new Date(expiresAt).getTime()
    let fired = false
    const update = () => {
      const left = Math.max(0, Math.ceil((end - Date.now()) / 60_000))
      setMinutes(left)
      if (left === 0 && !fired) {
        fired = true
        expire.current?.()
      }
    }
    update()
    const timer = setInterval(update, 5_000)
    return () => clearInterval(timer)
  }, [expiresAt])
  return minutes
}

export interface ActingAsBannerProps extends Omit<React.ComponentProps<"div">, "children"> {
  /** The identity whose permissions are in effect right now. */
  subject: { name: string; email?: string }
  /** The organization or workspace actions apply to. */
  org?: string
  /** Who is really signed in, shown so the session stays accountable. */
  actor?: string
  /** When the session ends on its own. Shows a live countdown. */
  expiresAt?: Date | string | number
  /** Called once when `expiresAt` passes. */
  onExpire?: () => void
  /** Return to your own identity. Return a promise to show a pending state. */
  onSwitchBack: () => void | Promise<void>
  /** Stick to the top of the scroll container. */
  sticky?: boolean
  /** Templates: `{name}` and `{minutes}` are filled in. */
  actingLabel?: string
  signedInLabel?: string
  endsInLabel?: string
  expiredLabel?: string
  /** Defaults to "Switch back to {actor's first name}". */
  switchBackLabel?: string
  switchBackErrorText?: string
}

/**
 * A persistent "you're acting as someone else" bar for impersonation and
 * multi-org sessions, so support staff never change a customer's data
 * believing it's their own. Shows who, where, who's really behind it, and a
 * one-tap way back. Pair it with `OrgContextChip` on destructive buttons.
 */
export function ActingAsBanner({
  subject,
  org,
  actor,
  expiresAt,
  onExpire,
  onSwitchBack,
  sticky = true,
  actingLabel = "Acting as",
  signedInLabel = "Signed in as {name}",
  endsInLabel = "Ends in {minutes} min",
  expiredLabel = "Session expired",
  switchBackLabel,
  switchBackErrorText = "Couldn't switch back. Try again.",
  className,
  ...props
}: ActingAsBannerProps) {
  const [leaving, setLeaving] = React.useState(false)
  const [failed, setFailed] = React.useState(false)
  const minutes = useMinutesLeft(expiresAt, onExpire)
  const tone = tones.warning
  const backLabel = switchBackLabel ?? (actor ? `Switch back to ${actor.split(/[\s@]/)[0]}` : "Switch back")

  const switchBack = async () => {
    setLeaving(true)
    setFailed(false)
    try {
      await onSwitchBack()
    } catch {
      setFailed(true)
    } finally {
      setLeaving(false)
    }
  }

  return (
    <div
      data-slot="acting-as-banner"
      role="region"
      aria-label={`${actingLabel} ${subject.name}${org ? `, ${org}` : ""}`}
      className={cn(bar, "z-40 w-full border-b px-4", tone.surface, sticky && "sticky top-0", className)}
      {...props}
    >
      <div className="flex min-w-0 flex-1 basis-60 items-center gap-3">
        <UserCog aria-hidden className={cn("size-4 shrink-0", tone.icon)} />
        <div className="min-w-0 flex-1">
          <p>
            {actingLabel} <strong className="font-semibold">{subject.name}</strong>
            {subject.email && <span className={cn("hidden sm:inline", tone.muted)}> ({subject.email})</span>}
            {org && (
              <span className="ml-1.5 inline-flex items-center gap-1 rounded-md border border-amber-700/20 bg-background/60 py-px pr-1.5 pl-0.5 align-middle text-xs font-medium dark:border-amber-300/20">
                <OrgMark name={org} className="size-4 text-[9px]" />
                {org}
              </span>
            )}
          </p>
          {(actor || minutes !== undefined) && (
            <p className={cn("flex flex-wrap items-center gap-x-3 text-xs", tone.muted)}>
              {actor && <span>{signedInLabel.replace("{name}", actor)}</span>}
              {minutes !== undefined && (
                <span className="inline-flex items-center gap-1 tabular-nums">
                  <Clock aria-hidden className="size-3.5" />
                  {minutes > 0 ? endsInLabel.replace("{minutes}", String(minutes)) : expiredLabel}
                </span>
              )}
            </p>
          )}
          {failed && (
            <p role="alert" className="text-xs font-medium text-red-700 dark:text-red-300">
              {switchBackErrorText}
            </p>
          )}
        </div>
      </div>
      <button type="button" onClick={() => void switchBack()} disabled={leaving} className={cn(action, tone.solid)}>
        {leaving ? <LoaderCircle aria-hidden className="size-4 animate-spin" /> : <Undo2 aria-hidden className="size-4" />}
        {backLabel}
      </button>
    </div>
  )
}

export interface OrgContextChipProps extends Omit<React.ComponentProps<"span">, "children"> {
  /** The organization the surrounding action applies to. */
  org: string
  /** Also say whose identity the action runs as. */
  actingAs?: string
  /** Word joining the action to the org; "in" reads as "Delete in Acme Corp". */
  preposition?: string
}

/**
 * Drop inside any destructive button so it always says where it acts:
 * `<button>Delete <OrgContextChip org="Acme Corp" /></button>` reads, and is
 * announced, as "Delete in Acme Corp". Uses the same color as the banner.
 */
export function OrgContextChip({ org, actingAs, preposition = "in", className, ...props }: OrgContextChipProps) {
  return (
    <span data-slot="org-context-chip" className={cn("inline-flex items-center gap-1 whitespace-nowrap", className)} {...props}>
      <span className="opacity-80">{preposition}</span>
      <span className="inline-flex items-center gap-1 rounded-[5px] bg-black/10 py-0.5 pr-1.5 pl-0.5 text-[0.85em] font-semibold dark:bg-white/15">
        <OrgMark name={org} className="size-3.5 text-[8px]" />
        {org}
      </span>
      {actingAs && <span className="opacity-80">as {actingAs}</span>}
    </span>
  )
}
