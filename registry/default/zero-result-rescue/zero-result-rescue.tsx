"use client"

import * as React from "react"
import { ArrowRight, LoaderCircle, SearchX } from "lucide-react"

import { cn } from "@/lib/utils"
import {
  pickRescues,
  rescueCandidates,
  RUSSIAN_LAYOUT,
  type ActiveSearchFilter,
  type KeyboardLayout,
  type Rescue,
  type RescueChange,
  type SearchAttempt,
} from "./rescue"

export * from "./rescue"

const fill = (template: string, values: Record<string, string | number>) =>
  template.replace(/\{(\w+)\}/g, (match, key: string) => String(values[key] ?? match))

const capitalize = (text: string) => text.replace(/^\p{Ll}/u, (char) => char.toUpperCase())

const DEFAULT_LAYOUTS = [RUSSIAN_LAYOUT]

export interface ZeroResultRescueProps extends Omit<React.ComponentProps<"div">, "children"> {
  /** The query that returned nothing. */
  query: string
  /** Filters applied to that search. */
  filters?: ActiveSearchFilter[]
  /** The category the search was limited to, if any. */
  scope?: string
  /** Words your catalog knows (product names, brands, categories), used for "did you mean". */
  vocabulary?: string[]
  /** Keyboard layouts to try when the query looks typed with the wrong one. */
  layouts?: KeyboardLayout[]
  /**
   * Returns how many results an attempt would give, or a promise of it (a count-only API call).
   * Called once per candidate fix, all at once; the signal aborts when the query changes. A
   * rejected count just drops that fix.
   */
  count: (attempt: SearchAttempt, signal: AbortSignal) => number | Promise<number>
  /** Run the chosen fix. */
  onRescue: (attempt: SearchAttempt, rescue: Rescue) => void
  /** Most fixes to offer. */
  limit?: number
  /** Templates: `{query}`, `{scope}`, `{filters}`, `{count}`, `{filter}`, `{layout}`, `{from}`, `{to}` are filled in. */
  titleText?: string
  scopeText?: string
  searchLabel?: string
  withoutLabel?: string
  allCategoriesLabel?: string
  spellingReason?: string
  layoutReason?: string
  capsReason?: string
  filterReason?: string
  scopeReason?: string
  /** Shown when no single change brings results back. */
  fallbackText?: string
  formatCount?: (count: number) => string
  /** "1 filter" / "2 filters" under the title. */
  filtersText?: (count: number) => string
  /** Shown while async counts are coming in. */
  checkingText?: string
  /** Fixes are recounted when the query, filters, scope, vocabulary or layouts change; change this too when the data behind `count` does. */
  countKey?: string | number
}

const defaultCount = (count: number) => `${count.toLocaleString()} ${count === 1 ? "result" : "results"}`

/**
 * A "no results" state that explains why nothing matched and offers only fixes
 * that are proven to return results: a spelling correction from your own
 * vocabulary, the query retyped in the right keyboard layout or without Caps
 * Lock, dropping the one filter that hides everything, or widening to all
 * categories. Each fix shows its result count, so no tap leads to another empty page.
 */
export function ZeroResultRescue({
  query,
  filters = [],
  scope,
  vocabulary = [],
  layouts = DEFAULT_LAYOUTS,
  count,
  onRescue,
  limit = 3,
  titleText = "No results for “{query}”",
  scopeText = "in {scope}",
  searchLabel = "Search “{query}”",
  withoutLabel = "without {filter}",
  allCategoriesLabel = "in all categories",
  spellingReason = "“{from}” looks like “{to}”",
  layoutReason = "typed with the {layout} keyboard layout",
  capsReason = "Caps Lock looks on",
  filterReason = "{filter} hides every match",
  scopeReason = "nothing in {scope}",
  fallbackText = "Nothing close turned up. Try fewer or more general words.",
  formatCount = defaultCount,
  filtersText = (n) => `${n} ${n === 1 ? "filter" : "filters"}`,
  checkingText = "Looking for close matches…",
  countKey,
  className,
  ...props
}: ZeroResultRescueProps) {
  // Inline arrays and objects change identity every render; key the work on their contents instead.
  const inputKey = JSON.stringify([query, filters, scope, vocabulary, layouts.map((l) => l.name), limit, countKey])
  const candidates = React.useMemo(
    () => rescueCandidates({ query, filters, scope, vocabulary, layouts }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [inputKey],
  )
  const countRef = React.useRef(count)
  React.useEffect(() => {
    countRef.current = count
  })
  const [result, setResult] = React.useState<{ key: string; rescues: Rescue[] } | null>(null)

  // A layout effect, so in-memory counts settle before paint and never flash the checking line.
  React.useLayoutEffect(() => {
    const controller = new AbortController()
    const counts = candidates.map((candidate) => {
      try {
        return countRef.current(candidate.attempt, controller.signal)
      } catch {
        return 0
      }
    })
    const settle = (values: number[]) => !controller.signal.aborted && setResult({ key: inputKey, rescues: pickRescues(candidates, values, limit) })
    if (counts.every((n) => typeof n === "number")) settle(counts as number[])
    else void Promise.all(counts.map((n) => Promise.resolve(n).catch(() => 0))).then(settle)
    return () => controller.abort()
  }, [candidates, inputKey, limit])

  const checking = result?.key !== inputKey
  const rescues = checking ? [] : result.rescues

  const reason = (change: RescueChange) => {
    if (change.kind === "spelling") return change.words.map(([from, to]) => fill(spellingReason, { from, to })).join(", ")
    if (change.kind === "layout") return fill(layoutReason, { layout: change.layout })
    if (change.kind === "caps") return capsReason
    if (change.kind === "filter") return fill(filterReason, { filter: change.label })
    return fill(scopeReason, { scope: scope ?? "" })
  }
  const context = [
    scope && fill(scopeText, { scope }),
    filters.length && filtersText(filters.length),
  ]
    .filter(Boolean)
    .join(" · ")

  return (
    <div
      data-slot="zero-result-rescue"
      data-state={checking ? "checking" : rescues.length ? "rescuable" : "empty"}
      aria-busy={checking || undefined}
      role="status"
      className={cn("grid w-full max-w-md gap-3 rounded-lg border border-dashed p-4", className)}
      {...props}
    >
      <style>{`@keyframes cui-zero-result-rescue-in{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:none}}`}</style>
      <div className="flex gap-3">
        <SearchX aria-hidden className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
        <div className="min-w-0">
          <p className="text-sm font-medium break-words">{fill(titleText, { query })}</p>
          {context && <p className="text-xs text-muted-foreground">{context}</p>}
        </div>
      </div>
      {checking ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <LoaderCircle aria-hidden className="size-4 animate-spin" />
          {checkingText}
        </p>
      ) : rescues.length ? (
        <ul key={query} className="grid gap-1.5">
          {rescues.map((rescue, index) => {
            const spelling = rescue.changes.find((change) => change.kind === "spelling")
            const fixed = new Set(spelling?.kind === "spelling" ? spelling.words.map(([, to]) => to.toLowerCase()) : [])
            const removed = rescue.changes.filter((change) => change.kind === "filter")
            return (
              <li
                key={rescue.changes.map((change) => change.kind + (change.kind === "filter" ? change.id : "")).join()}
                style={{ animationDelay: `${index * 60}ms` }}
                className="motion-safe:animate-[cui-zero-result-rescue-in_250ms_ease-out_both]"
              >
                <button
                  type="button"
                  onClick={() => onRescue(rescue.attempt, rescue)}
                  className="group grid w-full grid-cols-[1fr_auto] items-start gap-x-3 gap-y-0.5 rounded-md border bg-background px-3 py-2 text-left shadow-xs transition-colors outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30 dark:hover:bg-input/50"
                >
                  <span className="min-w-0 text-sm font-medium break-words">
                    {searchLabel
                      .split("{query}")
                      .flatMap((part, i) => (i ? [<Query key={i} text={rescue.attempt.query} fixed={fixed} />, part] : [part]))}
                    {removed.map((change) =>
                      change.kind === "filter" ? ` ${fill(withoutLabel, { filter: change.label })}` : "",
                    )}
                    {rescue.attempt.allCategories && ` ${allCategoriesLabel}`}
                  </span>
                  <span className="flex shrink-0 items-center gap-1 pt-0.5 text-xs font-medium whitespace-nowrap text-emerald-700 dark:text-emerald-400">
                    {formatCount(rescue.count)}
                    <ArrowRight
                      aria-hidden
                      className="size-3.5 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none"
                    />
                  </span>
                  <span className="col-span-2 text-xs text-muted-foreground">
                    {capitalize(rescue.changes.map(reason).join(" · "))}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">{fallbackText}</p>
      )}
    </div>
  )
}

/** The repaired query with corrected words highlighted. */
function Query({ text, fixed }: { text: string; fixed: Set<string> }) {
  return (
    <>
      {text.split(/([\p{L}\p{N}]+)/u).map((part, index) =>
        fixed.has(part.toLowerCase()) ? (
          <mark key={index} className="rounded-sm bg-amber-300/50 px-px text-inherit dark:bg-amber-400/25">
            {part}
          </mark>
        ) : (
          part
        ),
      )}
    </>
  )
}
