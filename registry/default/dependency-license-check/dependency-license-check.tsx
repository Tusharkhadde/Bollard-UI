"use client"

// Bollard UI — dependency-license-check · MIT licence · https://bollard-ui.vercel.app/components/dependency-license-check

import * as React from "react"
import { CircleCheck, Loader2, Package, Pin, Scale, ShieldAlert, Trash2 } from "lucide-react"

import { cn } from "@/lib/utils"
import { licenseText, reviewDependency, type DependencyInfo, type LicenseCategory, type LicenseLevel, type LicensePolicy, type LicenseReason } from "./license"

export { categorize, CUSTOM_LICENSE, licenseText, readLicense, reviewDependency, type DependencyInfo, type LicenseField, type LicenseCategory, type LicenseLevel, type LicensePolicy, type LicenseReading, type LicenseReason, type LicenseReview } from "./license"

/** Every visible string. `{license}`, `{chosen}`, `{project}`, `{from}`, `{version}`, `{count}` and `{total}` are filled in. */
export const DEPENDENCY_LICENSE_MESSAGES = {
  heading: "New dependencies",
  policy: { distributed: "Shipped to users", saas: "Hosted service", internal: "Internal only" } as Record<NonNullable<LicensePolicy["distribution"]>, string>,
  proprietary: "Closed source",
  reasons: {
    ok: "",
    allowed: "Approved by your team's policy.",
    chosen: "Dual-licensed: you can use it under {chosen}.",
    devOnly: "Dev only, so it isn't shipped and its copyleft doesn't reach your code.",
    denied: "{license} is on your team's deny list.",
    missing: "No license declared. Without one you have no permission to use it.",
    unknown: "“{license}” isn't a license this check recognises. Read its terms first.",
    weak: "Weak copyleft: fine to use unmodified, but changes to its own files must be shared.",
    gpl: "GPL: shipping it in closed-source code means releasing your source under the GPL.",
    gplSaas: "GPL: fine on servers you run, but not in code you ship to browsers or apps.",
    agpl: "AGPL: anyone who uses your app, even over the web, can ask for your full source.",
    copyleftInternal: "Copyleft, but fine while this stays internal. Check again before you ship it.",
    copyleftInOpenSource: "{license} would make the combined project {license} when distributed.",
    sourceAvailable: "Source-available, not open source. Check its terms before you ship it.",
    sourceAvailableSaas: "Source-available: it usually bars offering it as a hosted service.",
    custom: "Custom or paid terms (“{license}”). Read them before you add it.",
    incompatible: "{license} can't be combined with your {project} code.",
  } as Record<LicenseReason, string>,
  changed: "Was {from} up to {version}.",
  changedNoVersion: "Was {from} in the previous version.",
  categories: { permissive: "Permissive", weak: "Weak copyleft", unknown: "Unknown", strong: "Copyleft", network: "Network copyleft", "source-available": "Source-available", missing: "No license" } as Record<LicenseCategory, string>,
  dev: "dev",
  pin: "Stay on {version}",
  remove: "Remove",
  keep: "Keep",
  pinned: "Pinned to {version}, the last {from} release.",
  summaryBlocked: "{count} of {total} not allowed by your policy",
  summaryReview: "{count} of {total} to review",
  summaryOk: "Every license fits your policy",
  add: "Add dependencies",
  addAnyway: "Add anyway",
}

export type DependencyLicenseMessages = typeof DEPENDENCY_LICENSE_MESSAGES

const fill = (template: string, values: Record<string, string | number>) =>
  template.replace(/\{(\w+)\}/g, (match, key: string) => String(values[key] ?? match))

const CHIP: Record<LicenseCategory, string> = {
  permissive: "bg-emerald-500/15 text-emerald-800 dark:text-emerald-300",
  weak: "bg-sky-500/15 text-sky-800 dark:text-sky-300",
  unknown: "bg-amber-500/15 text-amber-800 dark:text-amber-300",
  strong: "bg-red-500/15 text-red-800 dark:text-red-300",
  network: "bg-red-500/15 text-red-800 dark:text-red-300",
  "source-available": "bg-amber-500/15 text-amber-800 dark:text-amber-300",
  missing: "bg-red-500/15 text-red-800 dark:text-red-300",
}
const TEXT: Record<LicenseLevel, string> = {
  ok: "text-muted-foreground",
  note: "text-muted-foreground",
  warn: "text-amber-700 dark:text-amber-400",
  block: "text-red-700 dark:text-red-400",
}
const fixClass =
  "inline-flex h-6 items-center gap-1 rounded-md border border-amber-500/40 px-2 font-medium text-amber-900 transition-colors hover:bg-amber-500/10 dark:text-amber-200 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
const blockFixClass =
  "inline-flex h-6 items-center gap-1 rounded-md border border-red-500/40 px-2 font-medium text-red-800 transition-colors hover:bg-red-500/10 dark:text-red-300 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
const ghostClass =
  "inline-flex h-6 items-center gap-1 rounded-md px-2 font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"

export interface DependencyLicenseCheckProps extends Omit<React.ComponentProps<"div">, "defaultValue" | "onChange"> {
  /** Controlled dependencies being added. */
  value?: DependencyInfo[]
  /** Initial dependencies when uncontrolled. */
  defaultValue?: DependencyInfo[]
  /** Called after Remove or "Stay on" with the new list. */
  onValueChange?: (dependencies: DependencyInfo[]) => void
  /** Your project's license, distribution and allow/deny lists. */
  policy?: LicensePolicy
  /** Called on Add. With problems left, the first click jumps to them and the second adds. May return a Promise. */
  onAdd?: (dependencies: DependencyInfo[]) => void | Promise<void>
  /** Any visible string; `reasons`, `categories` and `policy` may be partial. */
  messages?: Partial<Omit<DependencyLicenseMessages, "reasons" | "categories" | "policy">> & {
    reasons?: Partial<DependencyLicenseMessages["reasons"]>
    categories?: Partial<DependencyLicenseMessages["categories"]>
    policy?: Partial<DependencyLicenseMessages["policy"]>
  }
}

/**
 * Checks each dependency's license against your project before it is added: GPL or AGPL in
 * closed-source code, no license or one it doesn't recognise, source-available terms in a hosted
 * product, and a relicense since the previous version (offering to stay on the last version under
 * the old license). Dual licenses are read for the friendliest option, and dev-only copyleft passes.
 */
export function DependencyLicenseCheck({ value, defaultValue = [], onValueChange, policy = {}, onAdd, messages, className, ...props }: DependencyLicenseCheckProps) {
  const t = {
    ...DEPENDENCY_LICENSE_MESSAGES,
    ...messages,
    reasons: { ...DEPENDENCY_LICENSE_MESSAGES.reasons, ...messages?.reasons },
    categories: { ...DEPENDENCY_LICENSE_MESSAGES.categories, ...messages?.categories },
    policy: { ...DEPENDENCY_LICENSE_MESSAGES.policy, ...messages?.policy },
  }
  const [inner, setInner] = React.useState(defaultValue)
  const [kept, setKept] = React.useState<Set<string>>(() => new Set())
  const [pinned, setPinned] = React.useState<Record<string, string>>({})
  const [asked, setAsked] = React.useState(false)
  const [pending, setPending] = React.useState(false)
  const rootRef = React.useRef<HTMLDivElement>(null)
  const baseId = React.useId()
  const addRef = React.useRef<HTMLButtonElement>(null)
  const deps = (Array.isArray(value ?? inner) ? (value ?? inner) : []).filter((d): d is DependencyInfo => !!d && typeof d.name === "string")
  const reviews = deps.map((dep) => reviewDependency(dep, policy))
  const open = reviews.map((review, i) => (review.level === "warn" || review.level === "block") && !kept.has(deps[i].name))
  const blocked = reviews.filter((review, i) => open[i] && review.level === "block").length
  const toReview = open.filter(Boolean).length
  const project = policy.project && !/^(proprietary|closed)$/i.test(policy.project) ? policy.project : t.proprietary

  const commit = (next: DependencyInfo[]) => {
    if (value === undefined) setInner(next)
    onValueChange?.(next)
    setAsked(false)
  }

  /** After a fix, go to the next row that still needs a decision, else Add, else the list. */
  const focusAfter = (index: number) =>
    requestAnimationFrame(() => {
      const rows = Array.from(rootRef.current?.querySelectorAll<HTMLElement>("[data-row]") ?? [])
      const next = rows.slice(index).find((row) => row.querySelector("[data-fix]"))
      ;(next?.querySelector<HTMLElement>("[data-fix]") ?? addRef.current ?? rootRef.current)?.focus()
    })

  const add = async () => {
    if (toReview && !asked) {
      setAsked(true)
      rootRef.current?.querySelector<HTMLElement>("[data-fix]")?.focus()
      return
    }
    if (!onAdd || pending) return
    setPending(true)
    try {
      await onAdd(deps)
    } catch {
      // The caller reports install failures; the button becomes usable again.
    } finally {
      setPending(false)
    }
  }

  return (
    <div ref={rootRef} tabIndex={-1} data-slot="dependency-license-check" data-state={blocked ? "blocked" : toReview ? "review" : "ok"} className={cn("w-full max-w-md space-y-3 text-sm outline-none", className)} {...props}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h3 className="font-medium">{t.heading}</h3>
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Scale aria-hidden className="size-3.5" />
          {project} · {t.policy[policy.distribution ?? "distributed"]}
        </p>
      </div>
      <ul className="divide-y rounded-md border">
        {deps.map((dep, index) => {
          const review = reviews[index]
          const needsDecision = open[index]
          const declared = licenseText(dep.license)
          const nameId = `${baseId}-${index}`
          const reason = fill(t.reasons[review.reason] ?? "", { license: review.chosen || declared, chosen: review.chosen, project })
          const level: LicenseLevel = needsDecision ? review.level : review.level === "note" ? "note" : "ok"
          return (
            <li key={`${dep.name}#${index}`} data-row data-level={review.level} className="space-y-1.5 p-3">
              <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                <Package aria-hidden className="size-4 shrink-0 text-muted-foreground" />
                <span id={nameId} className="min-w-0 truncate font-mono text-xs font-medium" title={`${dep.name}@${dep.version}`}>
                  {dep.name}
                  <span className="text-muted-foreground">@{dep.version}</span>
                </span>
                {dep.dev && <span className="rounded border px-1 text-[11px] text-muted-foreground">{t.dev}</span>}
                <span className={cn("ml-auto max-w-full truncate rounded-full px-2 py-0.5 text-xs font-medium", needsDecision || review.category === "permissive" ? CHIP[review.category] : "bg-muted text-muted-foreground")} title={declared}>
                  {review.chosen || t.categories.missing}
                  <span className="sr-only"> ({t.categories[review.category]})</span>
                </span>
              </div>
              {pinned[dep.name] && (
                <p className="flex gap-1.5 text-xs text-emerald-700 dark:text-emerald-400">
                  <Pin aria-hidden className="mt-0.5 size-3.5 shrink-0" />
                  {pinned[dep.name]}
                </p>
              )}
              {(reason || review.change) && (
                <div className={cn("flex gap-1.5 text-xs", TEXT[level])}>
                  {review.level === "block" && needsDecision ? <ShieldAlert aria-hidden className="mt-0.5 size-3.5 shrink-0" /> : <Scale aria-hidden className="mt-0.5 size-3.5 shrink-0" />}
                  <div className="min-w-0 space-y-1">
                    {review.change && (
                      <p className="break-words font-medium">
                        {fill(review.change.fromVersion ? t.changed : t.changedNoVersion, { from: review.change.from, version: review.change.fromVersion ?? "" })}
                      </p>
                    )}
                    {reason && <p className="break-words">{reason}</p>}
                    {needsDecision && (
                      <div className="flex flex-wrap gap-2 pt-0.5">
                        {review.change?.fromVersion && (
                          <button
                            type="button"
                            data-fix
                            aria-describedby={nameId}
                            onClick={() => {
                              const { from, fromVersion = "" } = review.change!
                              commit(deps.map((d, i) => (i === index ? { ...d, version: fromVersion, license: dep.previousLicense, previousVersion: undefined, previousLicense: undefined } : d)))
                              setPinned((p) => ({ ...p, [dep.name]: fill(t.pinned, { version: fromVersion, from }) }))
                              focusAfter(index)
                            }}
                            className={fixClass}
                          >
                            <Pin aria-hidden className="size-3.5" />
                            {fill(t.pin, { version: review.change.fromVersion })}
                          </button>
                        )}
                        <button
                          type="button"
                          data-fix={review.change?.fromVersion ? undefined : ""}
                          aria-describedby={nameId}
                          onClick={() => {
                            commit(deps.filter((_, i) => i !== index))
                            focusAfter(index)
                          }}
                          className={review.level === "block" ? blockFixClass : fixClass}
                        >
                          <Trash2 aria-hidden className="size-3.5" />
                          {t.remove}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setKept((k) => new Set(k).add(dep.name))
                            focusAfter(index + 1)
                          }}
                          aria-describedby={nameId}
                          className={ghostClass}
                        >
                          {t.keep}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </li>
          )
        })}
      </ul>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p aria-live="polite" className={cn("flex items-center gap-1.5 text-sm", blocked ? TEXT.block : toReview ? TEXT.warn : "text-emerald-700 dark:text-emerald-400")}>
          {toReview ? <ShieldAlert aria-hidden className="size-4 shrink-0" /> : <CircleCheck aria-hidden className="size-4 shrink-0" />}
          {blocked ? fill(t.summaryBlocked, { count: blocked, total: deps.length }) : toReview ? fill(t.summaryReview, { count: toReview, total: deps.length }) : t.summaryOk}
        </p>
        {onAdd && (
          <button
            ref={addRef}
            type="button"
            onClick={add}
            disabled={pending || !deps.length}
            className={cn(
              "ml-auto inline-flex h-9 shrink-0 items-center gap-2 rounded-md px-4 text-sm font-medium outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-60",
              asked && toReview ? "bg-red-700 text-white hover:bg-red-800 dark:bg-red-400 dark:text-red-950" : "bg-primary text-primary-foreground hover:bg-primary/90",
            )}
          >
            {pending && <Loader2 aria-hidden className="size-4 animate-spin" />}
            {asked && toReview ? t.addAnyway : t.add}
          </button>
        )}
      </div>
    </div>
  )
}
