"use client"

import * as React from "react"
import { ArrowRight, ChevronRight, Eye, EyeOff, FolderInput, Link2, Link2Off, LoaderCircle, Settings2 } from "lucide-react"

import { cn } from "@/lib/utils"

export interface MoveLocation {
  /** Path segments from the root, e.g. ["Acme", "Marketing", "Public"]. */
  path: string[]
  /** Who can see what's placed here, as people read it: "Public", "Design team", "Only you". */
  visibility: string
  /** How many people can see items placed here. */
  viewers: number
  /** Index of the path segment that sets the visibility. Defaults to the last one. */
  visibilityFrom?: number
  /** Settings items inherit here, e.g. { Retention: "Deleted after 90 days" }. */
  settings?: Record<string, string>
}

export interface MoveItem {
  name: string
  /** Links elsewhere that point at the item's current path and break when it moves. */
  pathLinks?: number
  /** People it's shared with directly; they keep access wherever it goes. */
  directShares?: number
}

/** Everything that changes with a move: audience, broken links and inherited settings. `notSet` labels a setting one side lacks. */
export function moveImpact(items: MoveItem[], from: MoveLocation, to: MoveLocation, notSet = "Not set") {
  const keys = new Set([...Object.keys(from.settings ?? {}), ...Object.keys(to.settings ?? {})])
  const directShares = Math.max(0, ...items.map((i) => i.directShares ?? 0))
  return {
    gained: Math.max(0, to.viewers - from.viewers),
    /** People who only saw it through the old folder; direct shares keep access. */
    lost: Math.max(0, from.viewers - Math.max(to.viewers, directShares)),
    directShares,
    brokenLinks: items.reduce((sum, i) => sum + (i.pathLinks ?? 0), 0),
    settings: [...keys]
      .map((label) => ({ label, from: from.settings?.[label] ?? notSet, to: to.settings?.[label] ?? notSet }))
      .filter((s) => s.from !== s.to),
  }
}

/** Every user-visible string. Counts arrive as a number and as text formatted for the locale. */
export const MOVE_READBACK_MESSAGES = {
  title: (what: string): React.ReactNode => `Move ${what}?`,
  oneItem: (name: string) => `“${name}”`,
  items: (n: number, count: string) => `${count} ${n === 1 ? "item" : "items"}`,
  people: (n: number, count: string) => `${count} ${n === 1 ? "person" : "people"}`,
  links: (n: number, count: string) => `${count} ${n === 1 ? "link" : "links"}`,
  from: "From",
  to: "To",
  fromPath: "Current location",
  toPath: "Destination",
  becomes: "becomes",
  notSet: "Not set",
  /** `total` is everyone who can see the destination. */
  gained: (visibility: string, total: string) => `Moving into ${visibility} makes it visible to ${total}.`,
  lost: (count: string, kept: string) => `${count} lose access${kept ? `; ${kept} shared directly keep it` : ""}.`,
  same: "Who can see it stays the same.",
  broken: (count: string) => `${count} to the old path will break.`,
  redirect: "Leave a redirect at the old location",
  redirected: (count: string) => `${count} keep working through a redirect.`,
  move: (what: string) => `Move ${what}`,
  /** Button label when the move widens the audience, so the click says what it does. */
  widen: (_what: string, count: number, formatted: string) => `Move and share with ${formatted} more`,
  pending: "Moving…",
  cancel: "Cancel",
}
export type MoveReadbackMessages = typeof MOVE_READBACK_MESSAGES
const button =
  "inline-flex h-9 items-center justify-center gap-2 rounded-md [&_svg]:shrink-0 px-4 text-sm font-medium whitespace-nowrap shadow-xs outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-busy:cursor-progress"

function Path({ location, label }: { location: MoveLocation; label: string }) {
  const pivot = location.visibilityFrom ?? location.path.length - 1
  return (
    <ol aria-label={label} className="flex min-w-0 flex-wrap items-center gap-x-1 gap-y-0.5 text-sm">
      {location.path.map((segment, i) => (
        <li key={i} className="flex items-center gap-1">
          {i > 0 && <ChevronRight aria-hidden className="size-3.5 text-muted-foreground" />}
          <span className={cn(i === location.path.length - 1 ? "font-medium" : "text-muted-foreground", i === pivot && "rounded bg-muted px-1")}>
            {segment}
          </span>
        </li>
      ))}
    </ol>
  )
}

export interface MoveReadbackProps extends Omit<React.ComponentProps<"form">, "onSubmit" | "title"> {
  /** Items being moved. */
  items: MoveItem[]
  /** Where they are now. */
  from: MoveLocation
  /** Where they are going. */
  to: MoveLocation
  /** Runs on confirm. `keepRedirect` is true when old links should keep working. Return a promise to show a pending state. */
  onMove: (options: { keepRedirect: boolean }) => void | Promise<void>
  /** Called when the user cancels. */
  onCancel?: () => void
  /** Offer to leave a redirect/shortcut at the old path. Omit when the product can't. */
  canKeepRedirect?: boolean
  /** BCP 47 locale for counts. Defaults to the viewer's. */
  locale?: string
  /** Every visible string (see `MOVE_READBACK_MESSAGES`). The single-string props below still work and win. */
  messages?: Partial<MoveReadbackMessages>
  /** @deprecated Use `messages.gained`. */
  gainedText?: (visibility: string, total: string) => string
  /** @deprecated Use `messages.lost`. */
  lostText?: (count: string, kept: string) => string
  /** @deprecated Use `messages.same`. */
  sameText?: string
  /** @deprecated Use `messages.broken`. */
  brokenText?: (count: string) => string
  /** @deprecated Use `messages.redirect`. */
  redirectLabel?: string
  /** @deprecated Use `messages.redirected`. */
  redirectedText?: (count: string) => string
  /** @deprecated Use `messages.move`. */
  moveLabel?: (what: string) => string
  /** @deprecated Use `messages.widen`. */
  widenLabel?: (what: string, count: number) => string
  /** @deprecated Use `messages.title`. */
  title?: (what: string) => React.ReactNode
  /** @deprecated Use `messages.pending`. */
  pendingLabel?: string
  /** @deprecated Use `messages.cancel`. */
  cancelLabel?: string
}

/**
 * A move confirmation that reads back what moves with the item. It shows the
 * destination path with the folder that sets access highlighted, counts who
 * gains and who loses access (direct shares stay), how many path links break
 * (with a one-tap redirect), and which inherited settings change. When the
 * move widens the audience, the button says so.
 */
export function MoveReadback({
  items,
  from,
  to,
  onMove,
  onCancel,
  canKeepRedirect = true,
  locale,
  messages,
  gainedText,
  lostText,
  sameText,
  brokenText,
  redirectLabel,
  redirectedText,
  moveLabel,
  widenLabel,
  title,
  pendingLabel,
  cancelLabel,
  className,
  ...props
}: MoveReadbackProps) {
  const legacy = Object.fromEntries(
    Object.entries({
      gained: gainedText, lost: lostText, same: sameText, broken: brokenText, redirect: redirectLabel, redirected: redirectedText,
      move: moveLabel, title, pending: pendingLabel, cancel: cancelLabel,
      widen: widenLabel && ((what: string, n: number) => widenLabel(what, n)),
    }).filter(([, v]) => v !== undefined),
  ) as Partial<MoveReadbackMessages>
  const t: MoveReadbackMessages = { ...MOVE_READBACK_MESSAGES, ...messages, ...legacy }
  const num = (n: number) => n.toLocaleString(locale)
  const [redirect, setRedirect] = React.useState(false)
  const [pending, setPending] = React.useState(false)
  const audienceRef = React.useRef<HTMLLIElement>(null)
  const titleId = React.useId()
  const impact = moveImpact(items, from, to, t.notSet)
  const what = items.length === 1 ? t.oneItem(items[0].name) : t.items(items.length, num(items.length))
  const people = (n: number) => t.people(n, num(n))
  const destKey = to.path.join("/")

  // Flash the audience line when the destination changes, so a new count is noticed.
  const first = React.useRef(true)
  React.useEffect(() => {
    if (first.current) return void (first.current = false)
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return
    audienceRef.current?.animate([{ backgroundColor: "rgb(245 158 11 / 0.25)" }, { backgroundColor: "transparent" }], { duration: 400, easing: "ease-out" })
  }, [destKey])

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (pending) return
    setPending(true)
    try {
      await onMove({ keepRedirect: canKeepRedirect && redirect })
    } catch {
      // The caller reports the error; the form stays open to retry.
    } finally {
      setPending(false)
    }
  }

  const row = "-mx-1.5 flex items-start gap-2 rounded-md px-1.5 py-1"
  const warn = "text-amber-900 dark:text-amber-100"
  const warnIcon = "mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400"

  return (
    <form data-slot="move-readback" aria-labelledby={`${titleId}`} onSubmit={submit} className={cn("w-full max-w-lg space-y-4 rounded-xl border bg-card p-4 text-card-foreground sm:p-5", className)} {...props}>
      <h3 id={titleId} className="font-medium break-words">
        {t.title(what)}
      </h3>
      <div className="grid gap-2 text-sm">
        <div className="flex items-start gap-2">
          <span className="w-10 shrink-0 pt-px text-xs text-muted-foreground">{t.from}</span>
          <Path location={from} label={t.fromPath} />
        </div>
        <div className="flex items-start gap-2">
          <span className="w-10 shrink-0 pt-px text-xs text-muted-foreground">{t.to}</span>
          <Path location={to} label={t.toPath} />
        </div>
      </div>

      <ul aria-live="polite" className="space-y-1 border-t pt-3 text-sm">
        <li ref={audienceRef} className={cn(row, impact.gained > 0 && warn)}>
          {impact.gained > 0 ? <Eye aria-hidden className={warnIcon} /> : impact.lost > 0 ? <EyeOff aria-hidden className="mt-0.5 size-4 shrink-0 text-muted-foreground" /> : <Eye aria-hidden className="mt-0.5 size-4 shrink-0 text-muted-foreground" />}
          <span>
            {impact.gained > 0
              ? t.gained(to.visibility, people(to.viewers))
              : impact.lost > 0
                ? t.lost(people(impact.lost), impact.directShares ? people(impact.directShares) : "")
                : t.same}
            <span className="block text-xs text-muted-foreground">
              {from.visibility} ({num(from.viewers)}) <ArrowRight aria-label={t.becomes} role="img" className="inline size-3" /> {to.visibility} ({num(to.viewers)})
            </span>
          </span>
        </li>

        {impact.brokenLinks > 0 && (
          <li className={cn(row, !redirect && warn)}>
            {redirect ? <Link2 aria-hidden className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400" /> : <Link2Off aria-hidden className={warnIcon} />}
            <span className="min-w-0 flex-1">
              {(redirect ? t.redirected : t.broken)(t.links(impact.brokenLinks, num(impact.brokenLinks)))}
              {canKeepRedirect && (
                <label className="mt-1 flex w-fit cursor-pointer items-center gap-2 text-xs text-foreground">
                  <input type="checkbox" checked={redirect} onChange={(e) => setRedirect(e.target.checked)} className="size-3.5 accent-primary outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50" />
                  {t.redirect}
                </label>
              )}
            </span>
          </li>
        )}

        {impact.settings.map((s) => (
          <li key={s.label} className={row}>
            <Settings2 aria-hidden className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            <span className="min-w-0">
              <span className="font-medium">{s.label}</span>: <span className="text-muted-foreground line-through decoration-muted-foreground/60">{s.from}</span>{" "}
              <ArrowRight aria-label={t.becomes} role="img" className="inline size-3" /> {s.to}
            </span>
          </li>
        ))}
      </ul>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        {onCancel && (
          <button type="button" disabled={pending} onClick={onCancel} className={cn(button, "border bg-background hover:bg-accent dark:border-input dark:bg-input/30")}>
            {t.cancel}
          </button>
        )}
        <button type="submit" aria-busy={pending || undefined} className={cn(button, "bg-primary text-primary-foreground hover:bg-primary/90")}>
          {pending ? <LoaderCircle aria-hidden className="size-4 animate-spin" /> : <FolderInput aria-hidden className="size-4" />}
          <span className="truncate">{pending ? t.pending : impact.gained > 0 ? t.widen(what, impact.gained, num(impact.gained)) : t.move(what)}</span>
        </button>
      </div>
    </form>
  )
}
