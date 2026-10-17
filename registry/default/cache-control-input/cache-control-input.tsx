"use client"

// Bollard UI — cache-control-input · MIT licence · https://bollard-ui.vercel.app/components/cache-control-input

import * as React from "react"
import { CircleAlert, CircleCheck, Globe, Info, Monitor, Server, TriangleAlert, WandSparkles } from "lucide-react"

import { cn } from "@/lib/utils"
import { applyCacheEdits, checkCacheHeaders, formatDuration, readCacheHeaders, type CacheIssue, type CacheTier, type TierReadback } from "@/registry/default/cache-control-input/cache-control"

export { applyCacheEdits, checkCacheHeaders, deltaSeconds, formatDuration, isFingerprinted, parseDirectives, parseHeaders, parseHttpDate, readCacheHeaders, readTier, serializeDirectives, type CacheContext, type CacheIssue, type CacheIssueKind, type CacheTier, type Directive, type HeaderEdit, type TierReadback } from "@/registry/default/cache-control-input/cache-control"

export const CACHE_CONTROL_INPUT_MESSAGES = {
  label: "Response headers",
  placeholder: "Cache-Control: public, max-age=600\nVary: Accept-Encoding",
  personalized: "Different for each signed-in user",
  path: "URL path",
  pathPlaceholder: "/assets/app.3f9a1c2b.js",
  readback: "Who caches it",
  browser: "Browser",
  cdn: "CDN",
  shared: "Other shared caches",
  never: "Never stores it ({source})",
  revalidate: "Stores it, but asks your server before each reuse ({source})",
  fresh: "Reuses it for {duration} without asking ({source})",
  freshUntil: "Reuses it until the Expires date",
  immutable: ", even on reload",
  swr: ", then serves it stale for up to {swr} while refreshing",
  heuristic: "No lifetime set, so it guesses about {duration} from Last-Modified",
  "unset-browser": "No lifetime set, so it re-checks before reuse",
  "unset-shared": "No lifetime set, so it's up to each cache's default",
  clean: "No problems. Caches will do what these headers say.",
  problems: "{errors} to fix · {warnings} to review",
  fixAll: "Fix {count}",
  "personal-shared": "Per-user response, but {detail} can store it and serve it to other visitors. That's how account pages leak.",
  "personal-unset": "Per-user response with no caching rule. Some CDNs and proxies cache by default, so say private.",
  "set-cookie-shared": "This response sets a cookie and {detail} can cache it, handing that cookie to everyone who gets the cached copy.",
  "no-cache-personal": "no-cache doesn't mean “don't store”. CDNs keep a copy and can serve it after a 304 check. For per-user data, use no-store.",
  "no-store-asset": "no-store makes every visit re-download this fingerprinted file. Its name changes on each deploy, so it's safe to keep for a year.",
  "immutable-unhashed": "immutable on a URL that keeps its name: browsers keep the old file for {detail} and won't fetch your new one, even on reload.",
  "html-long": "Browsers keep this page for {detail} and you can't purge them. After a deploy, visitors load old HTML that points at files that are gone.",
  "vary-encoding": "The body is {detail}-compressed but Vary lacks Accept-Encoding, so a cache can send compressed bytes to a client that can't read them.",
  "vary-missing": "The body changes with {detail}, but Vary doesn't say so, so caches serve one version to everyone.",
  "vary-user-agent": "Vary: User-Agent splits the cache per browser version, so almost nothing gets reused.",
  "vary-star": "Vary: * means no cache can ever reuse this response.",
  typo: "“{from}” isn't a cache directive, so caches skip it.",
  unknown: "Caches don't know {detail} and skip it.",
  quoted: "{detail} must not be quoted. Some caches ignore it when it is.",
  "bad-value": "{detail} isn't a whole number of seconds, so caches treat the response as already stale.",
  duplicate: "{detail} appears twice with different values. Caches use the first one or treat the response as stale.",
  "expires-invalid": "Expires “{detail}” isn't an HTTP date (like Thu, 01 Dec 2026 16:00:00 GMT), so caches treat the response as already expired.",
  "expires-duplicate": "Expires is sent twice. Caches use the first one or treat the response as stale.",
  "public-private": "public and private together: caches follow private, so drop one.",
  pragma: "Pragma is a request header. Caches ignore it in responses.",
  "no-cache-max-age": "max-age does nothing next to no-cache. Every reuse is checked anyway.",
  "immutable-no-age": "immutable does nothing without a max-age.",
  "fix-personal-shared": "Make it private",
  "fix-set-cookie-shared": "Make it private",
  "fix-personal-unset": "Add private, no-cache",
  "fix-no-cache-personal": "Use no-store",
  "fix-no-store-asset": "Cache for a year",
  "fix-immutable-unhashed": "Remove immutable",
  "fix-html-long": "Use no-cache",
  "fix-vary-encoding": "Add Accept-Encoding",
  "fix-vary-missing": "Add {detail}",
  "fix-vary-user-agent": "Remove User-Agent",
  "fix-typo": "Use {to}",
  "fix-quoted": "Unquote",
  "fix-bad-value": "Use seconds",
  "fix-duplicate": "Keep the first",
  "fix-public-private": "Drop public",
  "fix-pragma": "Remove Pragma",
  "fix-expires-invalid": "Use an HTTP date",
  "fix-expires-duplicate": "Keep the first",
}
export type CacheControlInputMessages = typeof CACHE_CONTROL_INPUT_MESSAGES

const fill = (text: string, values: Record<string, string | number>) => text.replace(/\{(\w+)\}/g, (match, key: string) => String(values[key] ?? match))
const tones = { error: "text-red-700 dark:text-red-400", warning: "text-amber-700 dark:text-amber-400", info: "text-muted-foreground" }
const icons = { error: CircleAlert, warning: TriangleAlert, info: Info }
const tierIcons = { browser: Monitor, cdn: Globe, shared: Server }
const fixClass = (error: boolean) =>
  cn(
    "inline-flex min-h-6 max-w-full items-center gap-1 rounded-md border px-2 text-left font-medium [overflow-wrap:anywhere] transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
    error ? "border-red-500/40 text-red-800 hover:bg-red-500/10 dark:text-red-200" : "border-amber-500/40 text-amber-900 hover:bg-amber-500/10 dark:text-amber-200",
  )

/** Announces `text` only after typing settles, so screen readers don't chatter on every keystroke. */
function useSettled(text: string, delay = 900) {
  const [settled, setSettled] = React.useState(text)
  React.useEffect(() => {
    const timer = setTimeout(() => setSettled(text), delay)
    return () => clearTimeout(timer)
  }, [text, delay])
  return settled
}

/** Controlled-or-uncontrolled state in one line. */
function useControllable<T>(value: T | undefined, initial: T, onChange?: (next: T) => void) {
  const [inner, setInner] = React.useState(initial)
  const current = value ?? inner
  const set = (next: T) => {
    if (value === undefined) setInner(next)
    onChange?.(next)
  }
  return [current, set] as const
}

export interface CacheControlInputProps extends Omit<React.ComponentProps<"textarea">, "value" | "defaultValue" | "onChange"> {
  /** Controlled header text: full "Name: value" lines, or a bare Cache-Control value. */
  value?: string
  /** Initial header text when uncontrolled. */
  defaultValue?: string
  /** Called with the new text on every edit or fix. */
  onValueChange?: (value: string) => void
  /** Controlled "different for each signed-in user" switch. */
  personalized?: boolean
  /** Initial value of that switch when uncontrolled. */
  defaultPersonalized?: boolean
  /** Called when the user flips the switch. */
  onPersonalizedChange?: (personalized: boolean) => void
  /** Controlled URL path the headers are for. Judges fingerprinted assets and HTML pages. */
  path?: string
  /** Initial URL path when uncontrolled. */
  defaultPath?: string
  /** Called when the user edits the path. */
  onPathChange?: (path: string) => void
  /** Request headers that change the body (e.g. ["Accept-Language"]); each must be listed in Vary. */
  varyOn?: string[]
  /** Clock for Expires maths, in ms. Defaults to the time the component mounted. */
  now?: number
  /** Visible label; shorthand for `messages.label`. */
  label?: string
  /** Every visible string. `{detail}`, `{source}`, `{duration}`, `{swr}`, `{from}`, `{to}`, `{count}` are filled in. */
  messages?: Partial<CacheControlInputMessages>
}

/**
 * A Cache-Control editor that reads back who caches the response and for how
 * long (browser, CDN, other shared caches; CDN-Cache-Control and
 * Surrogate-Control included), and catches the mistakes that leak or strand
 * content: per-user pages a CDN can store, no-cache mistaken for no-store,
 * immutable on URLs that keep their name, a missing Vary and long-lived HTML.
 */
export function CacheControlInput({
  value,
  defaultValue = "",
  onValueChange,
  personalized,
  defaultPersonalized = false,
  onPersonalizedChange,
  path,
  defaultPath = "",
  onPathChange,
  varyOn,
  now,
  label,
  messages,
  rows = 5,
  id,
  className,
  ref,
  "aria-describedby": describedBy,
  ...props
}: CacheControlInputProps) {
  const t = { ...CACHE_CONTROL_INPUT_MESSAGES, ...messages, ...(label !== undefined && { label }) }
  const [text, setText] = useControllable(value, defaultValue, onValueChange)
  const [personal, setPersonal] = useControllable(personalized, defaultPersonalized, onPersonalizedChange)
  const [route, setRoute] = useControllable(path, defaultPath, onPathChange)
  const [mounted, setMounted] = React.useState<number>()
  React.useEffect(() => setMounted(Date.now()), [])
  const clock = now ?? mounted
  const textarea = React.useRef<HTMLTextAreaElement>(null)
  const list = React.useRef<HTMLUListElement>(null)
  const refocus = React.useRef<number | null>(null)
  const autoId = React.useId()
  const inputId = id ?? autoId
  React.useImperativeHandle(ref, () => textarea.current as HTMLTextAreaElement)

  const context = React.useMemo(() => ({ personalized: personal, path: route, varyOn, now: clock }), [personal, route, varyOn, clock])
  const issues = React.useMemo(() => checkCacheHeaders(text, context), [text, context])
  const tiers = React.useMemo(() => readCacheHeaders(text, clock), [text, clock])
  const counted = issues.filter((issue) => issue.severity !== "info")
  const errors = counted.filter((issue) => issue.severity === "error").length
  const fixable = counted.filter((issue) => issue.fix)
  const summary = !text.trim() ? "" : counted.length ? fill(t.problems, { errors, warnings: counted.length - errors }) : t.clean
  const announced = useSettled(summary)
  const leaking = new Set(issues.filter((issue) => issue.kind === "personal-shared" || issue.kind === "set-cookie-shared").length ? ["cdn", "shared"] : [])

  // A fix removes its own button, so focus moves to the next fix (or the editor) instead of the page.
  React.useEffect(() => {
    if (refocus.current === null) return
    const buttons = list.current?.querySelectorAll<HTMLButtonElement>("button[data-fix]") ?? []
    ;(buttons[Math.min(refocus.current, buttons.length - 1)] ?? textarea.current)?.focus()
    refocus.current = null
  }, [text])
  const fix = (issue: CacheIssue, button: HTMLElement) => {
    refocus.current = [...(list.current?.querySelectorAll("button[data-fix]") ?? [])].indexOf(button)
    setText(applyCacheEdits(text, issue.fix ?? []))
  }
  const fixAll = () => {
    // Fixes can touch the same header, so apply one, re-check, repeat.
    let next = text
    for (let round = 0; round < 20; round++) {
      const first = checkCacheHeaders(next, context).find((issue) => issue.severity !== "info" && issue.fix)
      const applied = first ? applyCacheEdits(next, first.fix ?? []) : next
      if (applied === next) break
      next = applied
    }
    refocus.current = 0
    setText(next)
  }

  const describe = (read: TierReadback) => {
    if (read.state === "never") return fill(t.never, { source: read.source })
    if (read.state === "revalidate") return fill(t.revalidate, { source: read.source })
    if (read.state === "heuristic") return fill(t.heuristic, { duration: formatDuration(read.seconds ?? 0) })
    if (read.state === "unset") return read.tier === "browser" ? t["unset-browser"] : t["unset-shared"]
    const base = read.seconds === undefined ? t.freshUntil : fill(t.fresh, { duration: formatDuration(read.seconds), source: read.source })
    return base + (read.immutable && read.tier === "browser" ? t.immutable : "") + (read.staleWhileRevalidate ? fill(t.swr, { swr: formatDuration(read.staleWhileRevalidate) }) : "")
  }
  const message = (issue: CacheIssue) => {
    const [from, to] = (issue.detail ?? "").split("→")
    return { text: fill(t[issue.kind], { detail: issue.detail ?? "", from, to: to ?? "" }), fix: fill(t[`fix-${issue.kind}` as keyof CacheControlInputMessages] ?? "", { detail: issue.detail ?? "", to: to ?? "" }) }
  }

  return (
    <div data-slot="cache-control-input" className={cn("grid w-full max-w-xl min-w-0 grid-cols-[minmax(0,1fr)] gap-1.5 text-sm", className)}>
      <div className="flex flex-wrap items-end gap-x-3 gap-y-2">
        <div className="grid min-w-40 flex-1 gap-1.5">
          <label htmlFor={`${inputId}-path`} className="w-fit text-xs font-medium text-muted-foreground">
            {t.path}
          </label>
          <input
            id={`${inputId}-path`}
            value={route}
            onChange={(event) => setRoute(event.target.value)}
            placeholder={t.pathPlaceholder}
            spellCheck={false}
            autoCapitalize="none"
            inputMode="url"
            className="h-9 w-full min-w-0 rounded-md border bg-transparent px-3 font-mono text-base shadow-xs transition-[color,box-shadow] outline-none placeholder:font-sans placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 md:text-sm dark:bg-input/30"
          />
        </div>
        <label className="flex h-9 items-center gap-2 text-sm">
          <input type="checkbox" checked={personal} onChange={(event) => setPersonal(event.target.checked)} className="size-4 accent-primary outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50" />
          {t.personalized}
        </label>
      </div>
      <label htmlFor={inputId} className="mt-1.5 w-fit font-medium">
        {t.label}
      </label>
      <textarea
        ref={textarea}
        id={inputId}
        rows={rows}
        value={text}
        onChange={(event) => setText(event.target.value)}
        spellCheck={false}
        autoCapitalize="none"
        autoCorrect="off"
        wrap="soft"
        placeholder={t.placeholder}
        aria-invalid={errors > 0 || undefined}
        aria-describedby={[describedBy, `${inputId}-status`].filter(Boolean).join(" ")}
        className="w-full min-w-0 resize-y rounded-md border bg-transparent px-3 py-2 font-mono text-base leading-5 shadow-xs transition-[color,box-shadow] outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-destructive md:text-xs dark:bg-input/30"
        {...props}
      />
      <span role="status" className="sr-only">
        {announced}
      </span>
      {text.trim() && (
        <section aria-labelledby={`${inputId}-readback`} className="mt-1.5 grid gap-1.5 rounded-md border bg-muted/40 p-3 text-xs">
          <h3 id={`${inputId}-readback`} className="font-medium text-muted-foreground">
            {t.readback}
          </h3>
          <dl className="grid gap-1.5">
            {tiers.map((read) => {
              const Icon = tierIcons[read.tier as CacheTier]
              const danger = leaking.has(read.tier) && (read.state === "fresh" || read.state === "heuristic")
              return (
                <div key={read.tier} className="grid grid-cols-[1rem_minmax(0,6.5rem)_minmax(0,1fr)] items-start gap-x-2">
                  <Icon aria-hidden className={cn("mt-px size-3.5", danger ? "text-red-600 dark:text-red-400" : "text-muted-foreground")} />
                  <dt className="font-medium">{t[read.tier as CacheTier]}</dt>
                  <dd className={cn("min-w-0 break-words", danger ? "font-medium text-red-700 dark:text-red-400" : read.state === "never" ? "text-muted-foreground" : "")}>{describe(read)}</dd>
                </div>
              )
            })}
          </dl>
        </section>
      )}
      <div id={`${inputId}-status`} className="mt-1.5 flex min-h-6 flex-wrap items-center justify-between gap-2 text-xs empty:hidden">
        {summary && (
          <span className={cn("flex items-center gap-1.5", counted.length ? "text-muted-foreground" : "text-emerald-700 dark:text-emerald-400")}>
            {counted.length ? <TriangleAlert aria-hidden className="size-3.5 text-amber-600 dark:text-amber-400" /> : <CircleCheck aria-hidden className="size-3.5" />}
            {summary}
          </span>
        )}
        {fixable.length > 1 && (
          <button type="button" onClick={fixAll} className={fixClass(false)}>
            <WandSparkles aria-hidden className="size-3.5" />
            {fill(t.fixAll, { count: fixable.length })}
          </button>
        )}
      </div>
      {issues.length > 0 && (
        <ul ref={list} className="grid gap-1.5 text-xs">
          {issues.map((issue, index) => {
            const Icon = icons[issue.severity]
            const copy = message(issue)
            const result = issue.fix?.map((edit) => (edit.value === null ? `− ${edit.header}` : `${edit.header}: ${edit.value}`)).join("\n")
            return (
              <li key={`${issue.kind}-${issue.detail ?? ""}-${index}`} className={cn("flex gap-1.5", tones[issue.severity])}>
                <span className="flex h-6 shrink-0 items-center">
                  <Icon aria-hidden className="size-3.5" />
                </span>
                <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="py-1">
                    <span className="mr-1 rounded border px-1 font-mono text-[11px] text-muted-foreground">{issue.header}</span> {copy.text}
                  </span>
                  {issue.fix && (
                    <button type="button" data-fix="" title={result} onClick={(event) => fix(issue, event.currentTarget)} className={fixClass(issue.severity === "error")}>
                      {copy.fix}
                    </button>
                  )}
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
