"use client"

import * as React from "react"
import { Check, TriangleAlert } from "lucide-react"

import { cn } from "@/lib/utils"
import {
  boundsOf,
  compareVersions,
  describeRange,
  findRangeSlips,
  formatVersion,
  parseRange,
  parseVersion,
  satisfies,
  type ComparatorSet,
  type SemVer,
} from "./semver"

export * from "./semver"

const fill = (template: string, values: Record<string, string>) =>
  template.replace(/\{(\w+)\}/g, (match, key: string) => values[key] ?? match)

const fieldClass =
  "h-9 w-full min-w-0 rounded-md border bg-transparent px-3 font-mono text-base shadow-xs transition-[color,box-shadow] outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive md:text-sm dark:bg-input/30 data-warning:border-amber-500 dark:data-warning:border-amber-400"
const fixClass =
  "inline-flex h-6 items-center gap-1 rounded-md border border-amber-500/40 px-2 font-mono font-medium text-amber-900 transition-colors hover:bg-amber-500/10 dark:text-amber-200 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"

export interface VersionRangeInputProps extends Omit<
  React.ComponentProps<"input">,
  "value" | "defaultValue" | "onChange" | "type"
> {
  /** Visible label. */
  label?: string
  /** Controlled value. */
  value?: string
  /** Initial value when uncontrolled. */
  defaultValue?: string
  /** Called with the text on every change. */
  onValueChange?: (value: string) => void
  /** Published versions to test the range against. Invalid entries are ignored. */
  versions?: string[]
  /** Pause in ms before warnings appear while typing. Leaving the field shows them at once. */
  delay?: number
  /** Turns a parsed range into words. Override to translate. */
  describe?: (sets: ComparatorSet[]) => string
  /** Templates: `{range}`, `{allowed}`, `{token}`, `{version}`, `{count}`, `{total}` are filled in. */
  allowsText?: string
  matchCountText?: string
  invalidText?: string
  andText?: string
  hyphenText?: string
  zeroMinorText?: string
  zeroPatchText?: string
  noMatchText?: string
  neverText?: string
  latestOutsideText?: string
  /** Badge on the version a fresh install would resolve to. */
  installsLabel?: string
}

/**
 * A semver range field (npm-style ^ ~ >= < x || and hyphen ranges) that reads
 * the range back in plain English, marks which published versions match and
 * which one a fresh install picks, and warns about the classic surprises:
 * ^0.x locking to one minor, "1.2.3-2.0.0" being a prerelease rather than a
 * range, commas for AND, and ranges that match nothing that exists.
 */
export function VersionRangeInput({
  label = "Version range",
  value,
  defaultValue = "",
  onValueChange,
  versions = [],
  delay = 500,
  describe = describeRange,
  allowsText = "{range} allows {allowed}.",
  matchCountText = "{count} of {total} published versions match",
  invalidText = "That isn't a valid range.",
  andText = "npm ranges use a space for AND, not a comma or &&.",
  hyphenText = "{token} is a prerelease of one version, not a range.",
  zeroMinorText = "{token} won't reach the next 0.x minor: below 1.0, every minor is treated as breaking.",
  zeroPatchText = "{token} allows only that one version: below 0.1, every patch is breaking.",
  noMatchText = "No published version matches.",
  neverText = "This range can never match any version.",
  latestOutsideText = "Excludes the latest, {version}.",
  installsLabel = "installs",
  id,
  className,
  onBlur,
  ref,
  ...props
}: VersionRangeInputProps) {
  const [inner, setInner] = React.useState(defaultValue)
  const [settled, setSettled] = React.useState(defaultValue)
  const inputRef = React.useRef<HTMLInputElement>(null)
  const autoId = React.useId()
  const inputId = id ?? autoId
  const range = value ?? inner

  React.useImperativeHandle(ref, () => inputRef.current as HTMLInputElement)

  React.useEffect(() => {
    const timer = setTimeout(() => setSettled(range), delay)
    return () => clearTimeout(timer)
  }, [range, delay])

  const update = (next: string) => {
    if (value === undefined) setInner(next)
    onValueChange?.(next)
  }
  const apply = (next: string) => {
    update(next)
    setSettled(next)
    inputRef.current?.focus()
  }

  const published = React.useMemo(
    () =>
      versions
        .map((text) => parseVersion(text))
        .filter((v): v is SemVer => !!v)
        .sort(compareVersions),
    [versions],
  )
  const sets = React.useMemo(() => parseRange(range), [range])
  const ready = settled === range
  const matched = published.map((version) => !!sets && satisfies(version, sets))
  const installs = matched.lastIndexOf(true)
  const stable = published.filter((version) => !version.pre.length)
  const latest = stable[stable.length - 1]
  const never = !!sets && sets.every((set) => boundsOf(set).empty)
  const count = matched.filter(Boolean).length

  const lines: { key: string; text: string; fix?: string }[] = []
  if (ready) {
    for (const slip of findRangeSlips(range)) {
      const template = {
        and: andText,
        hyphen: hyphenText,
        "zero-minor": zeroMinorText,
        "zero-patch": zeroPatchText,
      }[slip.kind]
      lines.push({
        key: `${slip.kind}-${slip.token}`,
        text: fill(template, { token: slip.token }),
        fix: slip.fix,
      })
    }
    if (sets && never) lines.push({ key: "never", text: neverText })
    else if (sets && published.length && count === 0) {
      lines.push({
        key: "none",
        text: noMatchText,
        fix: latest ? `^${formatVersion(latest)}` : undefined,
      })
    }
  }
  const latestIndex = latest ? published.indexOf(latest) : -1
  const latestOutside = ready && sets && count > 0 && latestIndex >= 0 && !matched[latestIndex]

  return (
    <div data-slot="version-range-input" className={cn("grid w-full max-w-sm gap-1.5", className)}>
      <label htmlFor={inputId} className="w-fit text-sm font-medium">
        {label}
      </label>
      <input
        ref={inputRef}
        id={inputId}
        type="text"
        autoComplete="off"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        value={range}
        onChange={(event) => update(event.target.value)}
        onBlur={(event) => {
          setSettled(range)
          onBlur?.(event)
        }}
        aria-invalid={ready && !sets ? true : undefined}
        aria-describedby={`${inputId}-hint`}
        data-warning={lines.length && sets ? "" : undefined}
        className={fieldClass}
        {...props}
      />
      <div id={`${inputId}-hint`} aria-live="polite" className="grid min-h-6 gap-1 text-xs">
        {sets ? (
          <p className="py-1 text-muted-foreground">
            {fill(allowsText, {
              range: range.trim() || "*",
              allowed: describe(sets),
            })}
            {latestOutside && latest && <> {fill(latestOutsideText, { version: formatVersion(latest) })}</>}
          </p>
        ) : ready && range.trim() ? (
          <p role="alert" className="flex items-center gap-1.5 py-1 text-destructive">
            <TriangleAlert aria-hidden className="size-3.5 shrink-0" />
            {invalidText}
          </p>
        ) : null}
        {lines.map(({ key, text, fix }) => (
          <p key={key} className="flex gap-1.5 text-amber-700 dark:text-amber-400">
            <span className="flex h-6 shrink-0 items-center">
              <TriangleAlert aria-hidden className="size-3.5" />
            </span>
            <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
              <span className="py-1">{text}</span>
              {fix && (
                <button type="button" onClick={() => apply(fix)} aria-label={`Use ${fix}`} className={fixClass}>
                  {fix}
                </button>
              )}
            </span>
          </p>
        ))}
      </div>
      {published.length > 0 && (
        <div className="grid gap-1.5">
          <p className="text-xs text-muted-foreground">
            {fill(matchCountText, {
              count: String(count),
              total: String(published.length),
            })}
          </p>
          <ul className="flex flex-wrap gap-1" aria-label="Published versions">
            {published.map((version, index) => (
              <li
                key={formatVersion(version)}
                data-match={matched[index] || undefined}
                className={cn(
                  "inline-flex h-6 items-center gap-1 rounded-md border px-1.5 font-mono text-xs transition-colors duration-200 ease-out motion-reduce:transition-none",
                  matched[index]
                    ? "border-emerald-600/30 bg-emerald-500/10 text-emerald-800 dark:border-emerald-400/30 dark:text-emerald-300"
                    : "text-muted-foreground/70 line-through decoration-muted-foreground/40",
                )}
              >
                {matched[index] && <Check aria-hidden className="size-3" />}
                {formatVersion(version)}
                <span className="sr-only">{matched[index] ? " matches" : " does not match"}</span>
                {index === installs && (
                  <span className="rounded-sm bg-emerald-600 px-1 font-sans text-[10px] leading-4 font-medium text-white dark:bg-emerald-400 dark:text-emerald-950">
                    {installsLabel}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
