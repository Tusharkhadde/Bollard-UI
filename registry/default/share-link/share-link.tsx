"use client"

import * as React from "react"
import { Building2, Check, Copy, Globe, Link2Off, LoaderCircle, Lock, Timer, TriangleAlert } from "lucide-react"

import { cn } from "@/lib/utils"

export type ShareAccess = "anyone" | "organization" | "invited"
export type ShareRole = "view" | "comment" | "edit"
export interface ShareSettings {
  access: ShareAccess
  role: ShareRole
  /** Epoch ms when the link stops working, or null for never. */
  expiresAt: number | null
}

const ACCESS_RANK: Record<ShareAccess, number> = { invited: 0, organization: 1, anyone: 2 }
const ROLE_RANK: Record<ShareRole, number> = { view: 0, comment: 1, edit: 2 }

/** True when `next` lets more people do more, or for longer, than `prev`. */
export function widensAccess(prev: ShareSettings, next: ShareSettings) {
  return (
    ACCESS_RANK[next.access] > ACCESS_RANK[prev.access] ||
    ROLE_RANK[next.role] > ROLE_RANK[prev.role] ||
    (next.expiresAt ?? Infinity) > (prev.expiresAt ?? Infinity)
  )
}

/** "3 days 4 hr", "52 min", "04:59" under ten minutes. Units are localized with `Intl` for `locale`. */
export function formatCountdown(ms: number, locale?: string) {
  const s = Math.max(0, Math.ceil(ms / 1000))
  if (s < 600) return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`
  const unit = (n: number, u: "day" | "hour" | "minute") =>
    new Intl.NumberFormat(locale, { style: "unit", unit: u, unitDisplay: u === "day" ? "long" : "short" }).format(n)
  const d = Math.floor(s / 86_400)
  const h = Math.floor((s % 86_400) / 3600)
  if (d) return h ? `${unit(d, "day")} ${unit(h, "hour")}` : unit(d, "day")
  return h ? `${unit(h, "hour")} ${unit(Math.floor((s % 3600) / 60), "minute")}` : unit(Math.ceil(s / 60), "minute")
}

const DEFAULT_WHO: Record<ShareAccess, string> = {
  anyone: "Anyone with the link",
  organization: "People in {organization} with the link",
  invited: "Only people you invite",
}
const DEFAULT_ACCESS: Record<ShareAccess, string> = { invited: "Invited only", organization: "{organization}", anyone: "Anyone" }
const DEFAULT_ROLE: Record<ShareRole, string> = { view: "Can view", comment: "Can comment", edit: "Can edit" }
const DEFAULT_VERB: Record<ShareRole, string> = { view: "view", comment: "comment", edit: "edit" }

const fill = (t: string, v: Record<string, string>) => t.replace(/\{(\w+)\}/g, (m, k: string) => v[k] ?? m)
const field =
  "h-9 w-full min-w-0 rounded-md border bg-transparent px-3 text-sm shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-50 dark:bg-input/30"
const btn =
  "inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-md px-4 text-sm font-medium whitespace-nowrap outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50"
const fixClass =
  "inline-flex h-6 items-center rounded-md border border-amber-500/40 px-2 font-medium text-amber-900 transition-colors hover:bg-amber-500/10 dark:text-amber-200 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"

export interface ShareLinkProps extends Omit<React.ComponentProps<"div">, "defaultValue"> {
  /** The link being shared. */
  url: string
  /** Controlled settings. */
  value?: ShareSettings
  /** Initial settings when uncontrolled. */
  defaultValue?: ShareSettings
  onValueChange?: (settings: ShareSettings) => void
  /** Kills the link. Return a promise to show a pending state. */
  onRevoke: () => void | Promise<void>
  /** Shown after revoking, to make a fresh link. */
  onCreate?: () => void
  /** Organisation name for the "people in …" option. */
  organization?: string
  /** Expiry presets in days. */
  expiryDays?: number[]
  /** Days the one-tap "add an expiry" fix sets on a public link. */
  suggestedExpiryDays?: number
  locale?: string
  timeZone?: string
  label?: string
  /** Who the link reaches, used in the readback. `{organization}` is filled in. */
  whoText?: Partial<Record<ShareAccess, string>>
  /** Options of the "who" menu. `{organization}` is filled in. */
  accessLabels?: Partial<Record<ShareAccess, string>>
  /** Options of the "what they can do" menu. */
  roleLabels?: Partial<Record<ShareRole, string>>
  /** The `{verb}` in the readback for each role. */
  verbText?: Partial<Record<ShareRole, string>>
  /** Accessible names of the settings group and its three menus. */
  settingsLabel?: string
  accessLabel?: string
  roleLabel?: string
  expiryLabel?: string
  /** Expiry preset options. `{days}` is filled in; `expiryOptionOneText` is used for 1 day. */
  expiryOptionText?: string
  expiryOptionOneText?: string
  /** Formats the time left in `expiresInText`. Defaults to `formatCountdown` in `locale`. */
  formatRemaining?: (ms: number) => string
  /** Templates: `{who}`, `{verb}` and `{until}` are filled in. */
  readbackText?: string
  untilText?: string
  noExpiryText?: string
  /** The "never expires" option of the expiry menu. */
  noExpiryOptionText?: string
  expiresInText?: string
  expiredText?: string
  publicEditText?: string
  viewOnlyLabel?: string
  noExpiryHint?: string
  addExpiryLabel?: string
  widenedText?: string
  copyLabel?: string
  copiedLabel?: string
  revokeLabel?: string
  revokeConfirmText?: string
  cancelLabel?: string
  revokedText?: string
  createLabel?: string
}

/**
 * A share link that says exactly what it grants. Every change is read back as a
 * sentence ("Anyone with the link can edit until Fri 16 Oct, 5:00 PM"), public
 * edit access gets a one-tap "Make it view-only", a live countdown shows when it
 * dies, and widening a link you've already copied warns that everyone who has it
 * gets the new access too. Copying announces the readback; revoking asks once.
 */
export function ShareLink({
  url,
  value,
  defaultValue = { access: "invited", role: "view", expiresAt: null },
  onValueChange,
  onRevoke,
  onCreate,
  organization = "your organisation",
  expiryDays = [1, 7, 30],
  suggestedExpiryDays = 7,
  locale,
  timeZone,
  label = "Share link",
  whoText,
  accessLabels,
  roleLabels,
  verbText,
  settingsLabel = "Link settings",
  accessLabel = "Who can open it",
  roleLabel = "What they can do",
  expiryLabel = "Expires",
  expiryOptionText = "{days} days from now",
  expiryOptionOneText = "1 day from now",
  formatRemaining,
  readbackText = "{who} can {verb} {until}.",
  untilText = "until {date}",
  noExpiryText = "with no expiry",
  noExpiryOptionText = "No expiry",
  expiresInText = "Expires in {time}",
  expiredText = "This link has expired.",
  publicEditText = "Anyone who gets this link, including people it's forwarded to, can change or delete the content.",
  viewOnlyLabel = "Make it view-only",
  noExpiryHint = "Public links get forwarded. An expiry limits the damage.",
  addExpiryLabel = "Expire in {days} days",
  widenedText = "You already copied this link. Everyone you sent it to gets this new access too.",
  copyLabel = "Copy",
  copiedLabel = "Copied",
  revokeLabel = "Revoke link",
  revokeConfirmText = "People with the link lose access immediately.",
  cancelLabel = "Cancel",
  revokedText = "Link revoked. Nobody can open it any more.",
  createLabel = "Create new link",
  className,
  ...props
}: ShareLinkProps) {
  const [inner, setInner] = React.useState(defaultValue)
  const settings = value ?? inner
  const [now, setNow] = React.useState<number>()
  const [copied, setCopied] = React.useState<ShareSettings>()
  const [justCopied, setJustCopied] = React.useState(false)
  const [phase, setPhase] = React.useState<"idle" | "confirm" | "pending" | "revoked">("idle")
  const cancelRef = React.useRef<HTMLButtonElement>(null)
  const readbackRef = React.useRef<HTMLParagraphElement>(null)
  const id = React.useId()

  const left = settings.expiresAt === null || now === undefined ? null : settings.expiresAt - now
  const lastHour = left !== null && left > 0 && left < 3_600_000
  // Tick every second in the last hour, every 30 s otherwise.
  React.useEffect(() => {
    setNow(Date.now())
    const timer = setInterval(() => setNow(Date.now()), lastHour ? 1000 : 30_000)
    return () => clearInterval(timer)
  }, [lastHour])

  React.useEffect(() => {
    if (phase === "confirm") cancelRef.current?.focus()
  }, [phase])
  React.useEffect(() => {
    if (!justCopied) return
    if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches)
      readbackRef.current?.animate([{ backgroundColor: "rgb(16 185 129 / 0.2)" }, { backgroundColor: "rgb(16 185 129 / 0)" }], { duration: 400, easing: "ease-out" })
    const timer = setTimeout(() => setJustCopied(false), 2000)
    return () => clearTimeout(timer)
  }, [justCopied])

  const update = (patch: Partial<ShareSettings>) => {
    const next = { ...settings, ...patch }
    setJustCopied(false) // "Copied" described the old settings
    if (value === undefined) setInner(next)
    onValueChange?.(next)
  }
  const dateText = (at: number) =>
    new Intl.DateTimeFormat(locale, { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone }).format(at)

  const inDays = (days: number) => Math.round((Date.now() + days * 86_400_000) / 60_000) * 60_000
  const dayText = (at: number) => new Intl.DateTimeFormat(locale, { weekday: "short", day: "numeric", month: "short", timeZone }).format(at)

  const expired = left !== null && left <= 0
  const revoked = phase === "revoked"
  const org = { organization }
  const who = fill({ ...DEFAULT_WHO, ...whoText }[settings.access], org)
  const accessOptions = { ...DEFAULT_ACCESS, ...accessLabels }
  const roleOptions = { ...DEFAULT_ROLE, ...roleLabels }
  const readback = fill(readbackText, {
    who,
    verb: { ...DEFAULT_VERB, ...verbText }[settings.role],
    until: settings.expiresAt === null ? noExpiryText : fill(untilText, { date: dateText(settings.expiresAt) }),
  })
  const AccessIcon = { anyone: Globe, organization: Building2, invited: Lock }[settings.access]
  const publicEdit = settings.access === "anyone" && settings.role === "edit"
  const widened = copied && widensAccess(copied, settings)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(settings)
      setJustCopied(true)
    } catch {
      // Clipboard blocked: the field stays selectable for a manual copy.
    }
  }
  const revoke = async () => {
    setPhase("pending")
    try {
      await onRevoke()
      setPhase("revoked")
    } catch {
      setPhase("confirm")
    }
  }

  return (
    <div data-slot="share-link" data-state={revoked ? "revoked" : expired ? "expired" : "active"} className={cn("@container grid w-full max-w-md gap-3 text-sm", className)} {...props}>
      <div className="grid gap-1.5">
        <label htmlFor={id} className="w-fit font-medium">
          {label}
        </label>
        <div className="flex gap-2">
          <input id={id} readOnly value={url} onFocus={(e) => e.target.select()} className={cn(field, "font-mono text-xs", (revoked || expired) && "text-muted-foreground line-through")} />
          <button type="button" onClick={() => void copy()} disabled={revoked || expired} className={cn(btn, "border bg-background hover:bg-accent dark:bg-input/30 dark:hover:bg-input/50")}>
            {justCopied ? <Check aria-hidden className="size-4 text-emerald-600 dark:text-emerald-400" /> : <Copy aria-hidden className="size-4" />}
            {justCopied ? copiedLabel : copyLabel}
          </button>
        </div>
      </div>

      {revoked ? (
        <div className="flex flex-wrap items-center gap-3">
          <p className="flex flex-1 items-center gap-1.5 text-muted-foreground" role="status">
            <Link2Off aria-hidden className="size-4 shrink-0" />
            {revokedText}
          </p>
          {onCreate && (
            <button type="button" onClick={onCreate} className={cn(btn, "h-8 bg-primary px-3 text-primary-foreground hover:bg-primary/90")}>
              {createLabel}
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2 @sm:grid-cols-3" aria-label={settingsLabel} role="group">
            <select aria-label={accessLabel} value={settings.access} onChange={(e) => update({ access: e.target.value as ShareAccess })} className={field}>
              {(["invited", "organization", "anyone"] as const).map((a) => (
                <option key={a} value={a}>{fill(accessOptions[a], org)}</option>
              ))}
            </select>
            <select aria-label={roleLabel} value={settings.role} onChange={(e) => update({ role: e.target.value as ShareRole })} className={field}>
              {(["view", "comment", "edit"] as const).map((r) => (
                <option key={r} value={r}>{roleOptions[r]}</option>
              ))}
            </select>
            <select
              aria-label={expiryLabel}
              value={settings.expiresAt === null ? "never" : "current"}
              onChange={(e) => e.target.value !== "current" && update({ expiresAt: e.target.value === "never" ? null : inDays(Number(e.target.value)) })}
              className={cn(field, "col-span-2 @sm:col-span-1")}
            >
              {settings.expiresAt !== null && <option value="current">{dayText(settings.expiresAt)}</option>}
              {expiryDays.map((d) => (
                <option key={d} value={d}>
                  {d === 1 ? expiryOptionOneText : fill(expiryOptionText, { days: String(d) })}
                </option>
              ))}
              <option value="never">{noExpiryOptionText}</option>
            </select>
          </div>

          <div className="grid gap-1.5">
            <p ref={readbackRef} aria-live="polite" className="-mx-1 flex items-start gap-2 rounded-md px-1 py-0.5 font-medium">
              <AccessIcon aria-hidden className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              {expired ? expiredText : readback}
              {justCopied && <span className="sr-only">{`${copiedLabel}. ${readback}`}</span>}
            </p>
            {left !== null && !expired && (
              <p className={cn("flex items-center gap-1.5 text-xs tabular-nums", left < 3_600_000 ? "text-amber-700 dark:text-amber-400" : "text-muted-foreground")}>
                <Timer aria-hidden className="size-3.5" />
                {fill(expiresInText, { time: formatRemaining ? formatRemaining(left) : formatCountdown(left, locale) })}
              </p>
            )}
            <div aria-live="polite" className="grid gap-1 text-xs empty:hidden">
              {publicEdit && <Warning text={publicEditText} fix={viewOnlyLabel} onFix={() => update({ role: "view" })} />}
              {settings.access === "anyone" && settings.expiresAt === null && (
                <Warning text={noExpiryHint} fix={fill(addExpiryLabel, { days: String(suggestedExpiryDays) })} onFix={() => update({ expiresAt: inDays(suggestedExpiryDays) })} />
              )}
              {widened && <Warning text={widenedText} />}
            </div>
          </div>

          {phase === "idle" ? (
            <button type="button" onClick={() => setPhase("confirm")} className={cn(btn, "-ml-2 h-8 w-fit px-2 text-red-700 hover:bg-red-500/10 dark:text-red-400")}>
              <Link2Off aria-hidden className="size-4" />
              {revokeLabel}
            </button>
          ) : (
            <div
              role="group"
              aria-label={revokeConfirmText}
              onKeyDown={(e) => e.key === "Escape" && phase === "confirm" && setPhase("idle")}
              className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-red-950 dark:text-red-50"
            >
              <p className="min-w-0 flex-1 basis-48">{revokeConfirmText}</p>
              <div className="ml-auto flex gap-2">
                <button ref={cancelRef} type="button" onClick={() => setPhase("idle")} disabled={phase === "pending"} className={cn(btn, "h-8 border border-red-700/25 px-3 hover:bg-red-500/15 dark:border-red-300/25")}>
                  {cancelLabel}
                </button>
                <button
                  type="button"
                  onClick={() => void revoke()}
                  disabled={phase === "pending"}
                  aria-busy={phase === "pending" || undefined}
                  className={cn(btn, "h-8 bg-red-700 px-3 text-white hover:bg-red-800 dark:bg-red-400 dark:text-red-950 dark:hover:bg-red-300")}
                >
                  {phase === "pending" && <LoaderCircle aria-hidden className="size-4 animate-spin" />}
                  {revokeLabel}
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function Warning({ text, fix, onFix }: { text: string; fix?: string; onFix?: () => void }) {
  return (
    <p className="flex gap-1.5 text-amber-700 dark:text-amber-400">
      <span className="flex h-6 shrink-0 items-center">
        <TriangleAlert aria-hidden className="size-3.5" />
      </span>
      <span className="flex min-w-0 flex-wrap items-center gap-x-2">
        <span className="py-1">{text}</span>
        {fix && (
          <button type="button" onClick={onFix} className={fixClass}>
            {fix}
          </button>
        )}
      </span>
    </p>
  )
}
