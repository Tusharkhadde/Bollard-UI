"use client"

import * as React from "react"
import { ChartPie, CircleAlert, TriangleAlert, Undo2, WandSparkles } from "lucide-react"

import { cn } from "@/lib/utils"
import { checkUtm, joinUrl, normaliseUtm, splitUrl, type UtmCheckOptions, type UtmKey } from "./utm"

export { checkUtm, ga4Channel, normaliseUtm, normaliseValue, GA4_SOURCES, UTM_KEYS, type UtmIssue, type UtmKey } from "./utm"

const FIELDS: { key: UtmKey; label: string; placeholder: string }[] = [
  { key: "utm_source", label: "Source", placeholder: "facebook" },
  { key: "utm_medium", label: "Medium", placeholder: "paid_social" },
  { key: "utm_campaign", label: "Campaign", placeholder: "diwali_sale" },
]

const fieldClass =
  "h-9 w-full min-w-0 rounded-md border bg-transparent px-3 text-sm shadow-xs transition-[color,box-shadow] outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30 data-warning:border-amber-500 dark:data-warning:border-amber-400"
const fixClass =
  "inline-flex h-6 items-center gap-1 rounded-md border border-amber-500/40 px-2 font-medium text-amber-900 transition-colors hover:bg-amber-500/10 dark:text-amber-200 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"

/** Sets one parameter on a URL, appending it when missing and dropping it when emptied. */
function setParam(url: string, key: string, value: string) {
  const { base, params, hash } = splitUrl(url)
  const next: [string, string][] = params.some(([k]) => k === key) ? params.map((p) => (p[0] === key ? [key, value] : p)) : [...params, [key, value]]
  return joinUrl(base, value ? next : next.filter(([k]) => k !== key), hash)
}

export interface UtmCheckProps extends UtmCheckOptions, Omit<React.ComponentProps<"div">, "defaultValue"> {
  /** Controlled URL. */
  value?: string
  /** Initial URL when uncontrolled. */
  defaultValue?: string
  /** Called with the URL on every edit and fix. */
  onValueChange?: (value: string) => void
  /** Visible label of the URL field. */
  label?: string
  /** Show the source, medium and campaign fields under the URL. */
  builder?: boolean
  /** Label before the predicted GA4 channel. */
  channelLabel?: string
  /** Warning for UTM tags on links to your own site. */
  internalText?: string
  /** Label of the fix-all button. */
  normaliseLabel?: string
  /** Label of the Undo button. */
  undoLabel?: string
  /** Shown when no issues are found. */
  cleanText?: string
}

/**
 * Stops campaign links that fragment analytics. As a URL is built or pasted it catches what splits
 * or misfiles reports: Facebook vs facebook and "Diwali Sale" vs diwali_sale (or a value your reports
 * already spell differently), source and medium swapped, a medium GA4 files as organic or Unassigned,
 * misspelled keys, a second "?", tags after "#" and tags on links to your own site, which overwrite
 * the visitor's real source. It reads back the GA4 channel, fixes each issue in one tap or all at once.
 */
export function UtmCheck({
  value,
  defaultValue = "",
  onValueChange,
  placedOn,
  knownValues,
  separator,
  sources,
  label = "Campaign URL",
  builder = true,
  channelLabel = "GA4 channel",
  internalText = "Internal link, no tags needed",
  normaliseLabel = "Normalise all",
  undoLabel = "Undo",
  cleanText = "Tags are consistent.",
  id,
  className,
  ...props
}: UtmCheckProps) {
  const [inner, setInner] = React.useState(defaultValue)
  const [history, setHistory] = React.useState<string[]>([])
  const [flash, setFlash] = React.useState<{ keys: string[]; n: number }>({ keys: [], n: 0 })
  const autoId = React.useId()
  const inputId = id ?? autoId
  const url = value ?? inner
  const options = { placedOn, knownValues, separator, sources }
  const { issues, params, channel } = checkUtm(url, options)
  const fixable = issues.filter((i) => i.fix)
  const get = (k: string) => params.find(([key]) => key === k)?.[1] ?? ""
  const internal = issues.some((i) => i.id === "internal")

  const update = (next: string) => {
    if (value === undefined) setInner(next)
    onValueChange?.(next)
  }
  const apply = (next: string) => {
    const before = new Map(params)
    const changed = splitUrl(next).params.filter(([k, v]) => before.get(k) !== v).map(([k]) => k)
    setHistory((h) => [...h, url])
    setFlash((f) => ({ keys: changed, n: f.n + 1 }))
    update(next)
  }

  return (
    <div data-slot="utm-check" className={cn("grid w-full max-w-md gap-3", className)} {...props}>
      <style>{"@keyframes cui-utm-check-flash{from{background-color:rgb(16 185 129/.25)}}"}</style>
      <div className="grid gap-1.5">
        <label htmlFor={inputId} className="w-fit text-sm font-medium">
          {label}
        </label>
        <input
          id={inputId}
          type="url"
          inputMode="url"
          autoComplete="off"
          spellCheck={false}
          value={url}
          onChange={(e) => update(e.target.value)}
          aria-describedby={`${inputId}-issues`}
          data-warning={issues.some((i) => !i.param) ? "" : undefined}
          className={cn(fieldClass, "font-mono text-xs")}
        />
      </div>

      {builder && !internal && (
        <div className="grid grid-cols-[repeat(auto-fit,minmax(8.5rem,1fr))] gap-2">
          {FIELDS.map(({ key, label: fieldLabel, placeholder }) => (
            <div key={key} className="grid min-w-0 gap-1">
              <label htmlFor={`${inputId}-${key}`} className="text-xs font-medium text-muted-foreground">
                {fieldLabel}
              </label>
              <input
                key={flash.keys.includes(key) ? `${key}-${flash.n}` : key}
                id={`${inputId}-${key}`}
                value={get(key)}
                placeholder={placeholder}
                spellCheck={false}
                autoCapitalize="none"
                onChange={(e) => update(setParam(url, key, e.target.value))}
                data-warning={issues.some((i) => i.param === key || (i.id === "swapped" && key !== "utm_campaign")) ? "" : undefined}
                className={cn(fieldClass, "h-8 px-2", flash.keys.includes(key) && "animate-[cui-utm-check-flash_600ms_ease-out] motion-reduce:animate-none")}
              />
            </div>
          ))}
        </div>
      )}

      <div id={`${inputId}-issues`} aria-live="polite" className="grid gap-1.5 text-xs">
        {(channel || internal) && (
          <p className="flex items-center gap-1.5 text-muted-foreground">
            <ChartPie aria-hidden className="size-3.5" />
            {channelLabel}
            <span className={cn("rounded-sm border px-1.5 py-0.5 font-medium text-foreground", (channel === "Unassigned" || issues.some((i) => i.id === "medium")) && "border-amber-500/40 text-amber-800 dark:text-amber-300")}>
              {internal ? internalText : channel}
            </span>
          </p>
        )}
        {issues.map((issue) => {
          const Icon = issue.severity === "harmful" ? CircleAlert : TriangleAlert
          return (
            <p key={issue.id} className={cn("flex gap-1.5", issue.severity === "harmful" ? "text-red-700 dark:text-red-400" : "text-amber-700 dark:text-amber-400")}>
              <span className="flex h-6 shrink-0 items-center">
                <Icon aria-hidden className="size-3.5" />
              </span>
              <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                <span className="py-1">{issue.message}</span>
                {issue.fix && (
                  <button type="button" onClick={() => issue.fix && apply(issue.fix)} className={fixClass}>
                    {issue.fixLabel}
                  </button>
                )}
              </span>
            </p>
          )
        })}
        {params.length > 0 && issues.length === 0 && <p className="py-1 text-emerald-700 dark:text-emerald-400">{cleanText}</p>}
      </div>

      {(fixable.length > 1 || history.length > 0) && (
        <div className="flex flex-wrap gap-2">
          {fixable.length > 1 && (
            <button
              type="button"
              onClick={() => apply(normaliseUtm(url, options))}
              className="inline-flex h-8 items-center gap-1.5 rounded-md border bg-background px-3 text-sm font-medium shadow-xs transition-colors outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:border-input dark:bg-input/30"
            >
              <WandSparkles aria-hidden className="size-4" />
              {normaliseLabel} <span className="text-muted-foreground tabular-nums">{fixable.length}</span>
            </button>
          )}
          {history.length > 0 && (
            <button
              type="button"
              onClick={() => (update(history[history.length - 1]), setHistory((h) => h.slice(0, -1)))}
              className="inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-sm font-medium transition-colors outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50"
            >
              <Undo2 aria-hidden className="size-4" />
              {undoLabel}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
