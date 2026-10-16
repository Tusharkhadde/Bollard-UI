"use client"

// Bollard UI — scope-picker · MIT licence · https://bollard-ui.vercel.app/components/scope-picker

import * as React from "react"
import { ShieldAlert, ShieldCheck, TriangleAlert, Wand2 } from "lucide-react"

import { cn } from "@/lib/utils"

export type ScopeAccess = "read" | "write" | "delete" | "admin"

export interface ScopeDef {
  /** The scope string your API uses, e.g. "contents:write". */
  id: string
  /** Short name shown in the list. */
  title: string
  /** What it lets the key do, as a verb phrase that completes "This key can…" ("push commits"). */
  does: string
  access: ScopeAccess
  /** Scopes this one already grants (write usually includes read). */
  implies?: string[]
}

export interface ScopeSelection {
  scopes: string[]
  /** Days until the key expires, or null for never. */
  expiresInDays: number | null
}

/** Every scope a selection grants, following `implies` chains. */
export function grantedScopes(selected: string[], defs: ScopeDef[]) {
  const byId = new Map(defs.map((d) => [d.id, d]))
  const granted = new Set<string>()
  const visit = (id: string) => {
    if (granted.has(id)) return
    granted.add(id)
    byId.get(id)?.implies?.forEach(visit)
  }
  selected.forEach(visit)
  return granted
}

/** Selected scopes that never showed up in usage. */
export function unusedScopes(selected: string[], used: string[]) {
  return selected.filter((id) => !used.includes(id))
}

export interface ScopePickerProps extends Omit<React.ComponentProps<"div">, "defaultValue" | "onChange"> {
  /** Visible label. */
  label?: string
  /** Every scope your API offers, with plain-language descriptions. */
  scopes: ScopeDef[]
  /** Selected scopes and expiry (controlled). */
  value?: ScopeSelection
  /** Starting selection when uncontrolled. */
  defaultValue?: ScopeSelection
  /** Called with the selection after every change. */
  onValueChange?: (value: ScopeSelection) => void
  /** Scope ids this key (or a similar one) actually used; enables the "Only what you've used" suggestion. */
  used?: string[]
  /** Expiry choices in days; null means no expiry. */
  expiryOptions?: (number | null)[]
  /** Suggested expiry when "no expiry" is picked. */
  suggestedExpiry?: number
  /** Locale for expiry dates. */
  locale?: string
  /** "This key", "This app". */
  subject?: string
  /** Period the usage data covers, e.g. "90 days". */
  usedWindow?: string
  /** Warning for scopes not used in that period. */
  unusedText?: string
  /** Label of the "Only what you've used" fix. */
  onlyUsedLabel?: string
  /** Warning for a key that never expires. */
  noExpiryText?: string
  /** Shown when the selection matches usage. */
  leastPrivilegeText?: string
  /** Accessible label of the expiry options. */
  expiresLabel?: string
  /** Label of the never-expires option. */
  neverLabel?: string
  /** `{days}` is filled in. */
  expiryFixLabel?: string
  /** `{date}` or `{days}` is filled in. */
  expiresOnText?: string
  /** Expiry readback with a relative time. */
  expiresInText?: string
  /** Readback for a key that never expires. */
  neverExpiresText?: string
  /** Shown when no scope is selected. */
  emptyText?: string
  /** Marks a scope granted by another one. */
  includedText?: string
}

const fill = (t: string, v: Record<string, string>) => t.replace(/\{(\w+)\}/g, (m, k: string) => v[k] ?? m)
const risky = (a: ScopeAccess) => a !== "read"
const badge: Record<ScopeAccess, string> = {
  read: "bg-muted text-muted-foreground",
  write: "bg-red-500/10 text-red-700 dark:text-red-400",
  delete: "bg-red-600 text-white dark:bg-red-500/80",
  admin: "bg-red-600 text-white dark:bg-red-500/80",
}
const fixClass =
  "inline-flex h-6 items-center gap-1 rounded-md border border-amber-500/40 px-2 font-medium text-amber-900 transition-colors hover:bg-amber-500/10 dark:text-amber-200 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"

/**
 * A permission picker for API keys and OAuth grants that pushes least privilege. It reads
 * back in plain words what the key will be able to do (destructive powers in red), marks
 * write, delete and admin scopes, offers "Only what you've used" from real usage, and
 * warns when the key never expires. Scopes a broader one already grants show as included.
 */
export function ScopePicker({
  label = "Permissions",
  scopes,
  value,
  defaultValue = { scopes: [], expiresInDays: 30 },
  onValueChange,
  used,
  expiryOptions = [7, 30, 90, 365, null],
  suggestedExpiry = 90,
  locale,
  subject = "This key",
  usedWindow = "in the last 90 days",
  unusedText = "{count} of these weren't used {window}.",
  onlyUsedLabel = "Only what you've used",
  noExpiryText = "A key that never expires keeps working long after it's forgotten or leaked.",
  leastPrivilegeText = "Only what it needs.",
  expiresLabel = "Expires",
  neverLabel = "Never",
  expiryFixLabel = "Expire in {days} days",
  expiresOnText = "It expires on {date}.",
  expiresInText = "It expires in {days} days.",
  neverExpiresText = "It never expires.",
  emptyText = "{subject} can't do anything yet.",
  includedText = "Included by a broader permission",
  className,
  ...props
}: ScopePickerProps) {
  const [inner, setInner] = React.useState(defaultValue)
  const [now, setNow] = React.useState<number>()
  const sel = value ?? inner
  const rows = React.useRef(new Map<string, HTMLElement>())
  const id = React.useId()
  React.useEffect(() => setNow(Date.now()), [])

  const update = (next: ScopeSelection) => {
    if (value === undefined) setInner(next)
    onValueChange?.(next)
  }

  const direct = new Set(sel.scopes)
  const granted = grantedScopes(sel.scopes, scopes)
  const unused = used ? unusedScopes(sel.scopes, used) : []
  const toggle = (scopeId: string) => update({ ...sel, scopes: direct.has(scopeId) ? sel.scopes.filter((s) => s !== scopeId) : [...sel.scopes, scopeId] })

  const onlyUsed = () => {
    const removed = sel.scopes.filter((s) => !used!.includes(s))
    update({ ...sel, scopes: scopes.filter((d) => used!.includes(d.id)).map((d) => d.id) })
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return
    removed.forEach((s) => rows.current.get(s)?.animate([{ backgroundColor: "rgb(239 68 68 / 0.18)" }, {}], { duration: 400, easing: "ease-out" }))
  }

  // Readback: only what was picked directly (implied scopes are covered by their parent), risky last.
  const picked = scopes.filter((d) => direct.has(d.id)).sort((a, b) => Number(risky(a.access)) - Number(risky(b.access)))
  const list = new Intl.ListFormat(locale ?? "en", { type: "conjunction" })
  const parts = list.formatToParts(picked.map((d) => d.does))
  let element = 0
  const readback = parts.map((part, i) => {
    if (part.type === "literal") return part.value
    const def = picked[element++]
    return <span key={i} className={cn(risky(def.access) && "font-medium text-red-700 dark:text-red-400")}>{part.value}</span>
  })
  const expiry =
    sel.expiresInDays === null ? neverExpiresText
      : now === undefined ? fill(expiresInText, { days: String(sel.expiresInDays) })
        : fill(expiresOnText, { date: new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", year: "numeric" }).format(now + sel.expiresInDays * 86_400_000) })
  const lean = used && picked.length > 0 && unused.length === 0 && sel.expiresInDays !== null

  return (
    <div data-slot="scope-picker" className={cn("grid w-full max-w-sm gap-3", className)} {...props}>
      <fieldset className="grid gap-1.5">
        <legend className="mb-1.5 text-sm font-medium">{label}</legend>
        <ul className="divide-y rounded-md border">
          {scopes.map((def) => {
            const viaParent = !direct.has(def.id) && granted.has(def.id)
            const checked = direct.has(def.id) || viaParent
            return (
              <li key={def.id} ref={(el) => { if (el) rows.current.set(def.id, el); else rows.current.delete(def.id) }} className="first:rounded-t-md last:rounded-b-md">
                <label className={cn("flex items-start gap-3 px-3 py-2", viaParent && "opacity-70")}>
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={viaParent}
                    onChange={() => toggle(def.id)}
                    className="mt-0.5 size-4 shrink-0 rounded-sm accent-primary outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                      {def.title}
                      <code className="font-mono text-xs text-muted-foreground">{def.id}</code>
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {viaParent ? includedText : def.does}
                      {direct.has(def.id) && unused.includes(def.id) && <span className="text-amber-700 dark:text-amber-400"> · not used {usedWindow}</span>}
                    </span>
                  </span>
                  <span className={cn("mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-[11px] leading-none font-medium capitalize", badge[def.access])}>{def.access}</span>
                </label>
              </li>
            )
          })}
        </ul>
      </fieldset>

      <fieldset className="grid gap-1.5">
        <legend className="mb-1.5 text-sm font-medium">{expiresLabel}</legend>
        <div role="radiogroup" aria-label={expiresLabel} className="flex gap-1 rounded-md bg-muted p-1">
          {expiryOptions.map((days) => (
            <button
              key={String(days)}
              type="button"
              role="radio"
              aria-checked={sel.expiresInDays === days}
              onClick={() => update({ ...sel, expiresInDays: days })}
              className="h-7 flex-1 rounded-sm px-1 text-xs font-medium whitespace-nowrap text-muted-foreground outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-checked:bg-background aria-checked:text-foreground aria-checked:shadow-xs dark:aria-checked:bg-input/50"
            >
              {days === null ? neverLabel : days % 365 === 0 ? `${days / 365} yr` : `${days} d`}
            </button>
          ))}
        </div>
      </fieldset>

      <div aria-live="polite" className="grid gap-2">
        <p id={`${id}-readback`} className="rounded-md bg-muted/60 px-3 py-2 text-sm">
          {picked.length ? <>{subject} can {readback}. {expiry}</> : fill(emptyText, { subject })}
        </p>
        {unused.length > 0 && (
          <p className="flex gap-1.5 text-xs text-amber-700 dark:text-amber-400">
            <span className="flex h-6 shrink-0 items-center"><TriangleAlert aria-hidden className="size-3.5" /></span>
            <span className="flex min-w-0 flex-wrap items-center gap-x-2">
              <span className="py-1">{fill(unusedText, { count: String(unused.length), window: usedWindow })}</span>
              <button type="button" onClick={onlyUsed} className={fixClass}><Wand2 aria-hidden className="size-3" />{onlyUsedLabel}</button>
            </span>
          </p>
        )}
        {sel.expiresInDays === null && (
          <p className="flex gap-1.5 text-xs text-amber-700 dark:text-amber-400">
            <span className="flex h-6 shrink-0 items-center"><ShieldAlert aria-hidden className="size-3.5" /></span>
            <span className="flex min-w-0 flex-wrap items-center gap-x-2">
              <span className="py-1">{noExpiryText}</span>
              <button type="button" onClick={() => update({ ...sel, expiresInDays: suggestedExpiry })} className={fixClass}>{fill(expiryFixLabel, { days: String(suggestedExpiry) })}</button>
            </span>
          </p>
        )}
        {lean && (
          <p className="flex items-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-400">
            <ShieldCheck aria-hidden className="size-3.5" />{leastPrivilegeText}
          </p>
        )}
      </div>
    </div>
  )
}
