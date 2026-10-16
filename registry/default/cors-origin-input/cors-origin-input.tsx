"use client"

import * as React from "react"
import { CircleCheck, CircleX, ShieldAlert, WandSparkles, X } from "lucide-react"

import { cn } from "@/lib/utils"

export type OriginIssueKind =
  | "wildcard-credentials" | "null" | "wildcard" | "subdomain-wildcard" | "no-scheme"
  | "path" | "default-port" | "uppercase" | "unicode" | "http" | "localhost" | "invalid"

export interface OriginIssue {
  kind: OriginIssueKind
  severity: "error" | "warning"
  /** The corrected entry, or null when the fix is to remove it. Undefined when there is no safe fix. */
  fix?: string | null
}

export interface OriginContext {
  /** Access-Control-Allow-Credentials is true (cookies or auth headers are sent). */
  credentials?: boolean
  /** The list is for production, so http and localhost are flagged. */
  production?: boolean
}

const SCHEME = /^[a-z][a-z\d+.-]*:\/\//i
const LOCAL = /^(localhost|127\.0\.0\.1|\[::1\])$/i

/**
 * Checks one allow-list entry the way a browser compares it against the
 * request's Origin header: scheme + host + optional port, exact match.
 */
export function checkOrigin(entry: string, { credentials = false, production = false }: OriginContext = {}): OriginIssue[] {
  const value = entry.trim()
  if (value === "*") return credentials ? [{ kind: "wildcard-credentials", severity: "error", fix: null }] : production ? [{ kind: "wildcard", severity: "warning" }] : []
  if (value.toLowerCase() === "null") return [{ kind: "null", severity: "error", fix: null }]
  if (!SCHEME.test(value)) return [{ kind: "no-scheme", severity: "warning", fix: /^(localhost|127\.)/i.test(value) ? `http://${value}` : `https://${value}` }]
  const wild = value.includes("*.")
  let url: URL
  try {
    url = new URL(value.replace("*.", "wildcard-placeholder."))
  } catch {
    return [{ kind: "invalid", severity: "error" }]
  }
  // file: and other host-less URLs send Origin: null, so they can never be matched by name.
  if (!url.hostname || url.hostname.startsWith(".")) return [{ kind: "invalid", severity: "error" }]
  const host = url.host.replace("wildcard-placeholder.", "*.")
  const origin = `${url.protocol}//${host}`
  const authority = value.match(/^[^/]+\/\/([^/?#]*)/)?.[1] ?? ""
  const typedPort = authority.match(/:(\d+)$/)?.[1]
  const issues: OriginIssue[] = []
  if (wild) issues.push({ kind: "subdomain-wildcard", severity: credentials ? "error" : "warning" })
  // Anything after the authority (/, ?, #) or user@ inside it means the entry never equals an Origin header.
  if (/^[^/]+\/\/[^/?#]*[/?#]/.test(value) || authority.includes("@")) issues.push({ kind: "path", severity: "warning", fix: origin })
  else if (typedPort && !url.port) issues.push({ kind: "default-port", severity: "warning", fix: origin })
  else if (/[^\x00-\x7f]/.test(authority)) issues.push({ kind: "unicode", severity: "warning", fix: origin })
  else if (value !== origin && value.toLowerCase() === origin.toLowerCase()) issues.push({ kind: "uppercase", severity: "warning", fix: origin })
  const local = LOCAL.test(url.hostname)
  if (production && local) issues.push({ kind: "localhost", severity: "warning", fix: null })
  else if (production && url.protocol === "http:") issues.push({ kind: "http", severity: "warning", fix: origin.replace(/^http:/, "https:") })
  return issues
}

export type OriginTestCode =
  | "invalid" | "exact" | "wildcard" | "wildcard-credentials" | "pattern"
  | "has-path" | "format" | "no-scheme" | "scheme" | "port" | "www" | "unlisted"

/** Would a request from `origin` be allowed? `entry` names the closest listed entry when it's a near miss. */
export function testOrigin(list: string[], origin: string, context: OriginContext = {}): { allowed: boolean; code: OriginTestCode; origin: string; entry?: string } {
  // Sandboxed iframes, file: pages and some redirects send the literal Origin: null.
  if (origin.trim().toLowerCase() === "null") {
    const listed = list.find((entry) => entry.toLowerCase() === "null")
    return listed ? { allowed: true, code: "exact", origin: "null", entry: listed } : { allowed: false, code: "unlisted", origin: "null" }
  }
  let request: URL
  try {
    request = new URL(origin.trim())
  } catch {
    return { allowed: false, code: "invalid", origin }
  }
  if (!request.hostname) return { allowed: false, code: "invalid", origin }
  const sent = `${request.protocol}//${request.host}`
  const result = (allowed: boolean, code: OriginTestCode, entry?: string) => ({ allowed, code, origin: sent, entry })
  if (list.includes(sent)) return result(true, "exact", sent)
  if (list.includes("*") && !context.credentials) return result(true, "wildcard", "*")
  for (const entry of list) {
    const [scheme, domain] = entry.toLowerCase().split("*.")
    if (domain && scheme === `${request.protocol}//` && request.host.endsWith(`.${domain.replace(/\/$/, "")}`)) return result(!context.credentials, "pattern", entry)
  }
  for (const entry of list) {
    let listed: URL
    try {
      listed = new URL(SCHEME.test(entry) ? entry : `https://${entry}`)
    } catch {
      continue
    }
    if (`${listed.protocol}//${listed.host}` === sent)
      return result(false, !SCHEME.test(entry) ? "no-scheme" : /^[^/]+\/\/[^/?#]*[/?#@]|@/.test(entry) ? "has-path" : "format", entry)
    if (listed.host === request.host) return result(false, "scheme", entry)
    if (listed.hostname === request.hostname) return result(false, "port", entry)
    if (listed.hostname.replace(/^www\./, "") === request.hostname.replace(/^www\./, "")) return result(false, "www", entry)
  }
  // With credentials, * can't help, so a near miss above is the more useful answer.
  return list.includes("*") ? result(false, "wildcard-credentials", "*") : result(false, "unlisted")
}

const DEFAULT_TEST_MESSAGES: Record<OriginTestCode, string> = {
  invalid: "That isn't an origin. Use the form https://app.example.com.",
  exact: "Allowed. Matches {entry} exactly.",
  wildcard: "Allowed by *. So is every other website.",
  "wildcard-credentials": "Blocked. Browsers reject * when credentials are on.",
  pattern: "Allowed only if your server expands {entry} and echoes the exact origin back.",
  "has-path": "Blocked. {entry} is listed, but the slash or path means it never matches.",
  format: "Blocked. {entry} is listed, but browsers send it as {origin}, and the match is exact.",
  "no-scheme": "Blocked. {entry} is listed, but without a scheme it never matches.",
  scheme: "Blocked. {entry} is listed, but the scheme differs.",
  port: "Blocked. {entry} is listed, but the port differs.",
  www: "Blocked. {entry} is listed, but www. makes it a different origin.",
  unlisted: "Blocked. {origin} isn't on the list.",
}

const DEFAULT_MESSAGES: Record<OriginIssueKind, string> = {
  "wildcard-credentials": "Browsers reject * when credentials are on. List each origin instead.",
  null: "Any site can send Origin: null from a sandboxed iframe. Don't allow it.",
  wildcard: "Any website can read these responses.",
  "subdomain-wildcard": "The header can't hold *. Your server must match subdomains itself, anchored on the dot.",
  "no-scheme": "Origins need a scheme, so this never matches.",
  path: "Origins are only scheme, host and port. A slash, path, query or user@ means this never matches.",
  "default-port": "Browsers drop the default port, so this never matches.",
  uppercase: "Browsers send origins in lowercase.",
  unicode: "Browsers send international domains in punycode (xn--), so this never matches.",
  http: "Plain http in production.",
  localhost: "localhost in production lets any local dev server call this API.",
  invalid: "This isn't a valid origin.",
}

export interface CorsOriginInputProps extends Omit<React.ComponentProps<"div">, "defaultValue"> {
  /** Allowed origins (controlled). */
  value?: string[]
  /** Allowed origins when uncontrolled. */
  defaultValue?: string[]
  onValueChange?: (origins: string[]) => void
  /** Credentials are allowed for this API. Makes * and *. errors. */
  credentials?: boolean
  /** This list is for production. Flags http and localhost. */
  production?: boolean
  label?: string
  placeholder?: string
  /** Text per issue. */
  messages?: Partial<Record<OriginIssueKind, string>>
  /** Fix button labels. `{fix}` is filled in. */
  useLabel?: string
  removeLabel?: string
  /** `{count}` is filled in. */
  fixAllLabel?: string
  testLabel?: string
  testPlaceholder?: string
  /** Tester results. `{origin}` and `{entry}` are filled in. */
  testMessages?: Partial<Record<OriginTestCode, string>>
  /** Context shown beside the label. */
  credentialsOnLabel?: string
  credentialsOffLabel?: string
  productionLabel?: string
  /** Read to screen readers after an entry that has an error or a warning. */
  errorLabel?: string
  warningLabel?: string
}

const fill = (text: string, values: Record<string, string | number>) =>
  text.replace(/\{(\w+)\}/g, (match, key: string) => String(values[key] ?? match))
const fixClass = (error: boolean) =>
  cn(
    "inline-flex h-6 max-w-full items-center gap-1 rounded-md border px-2 font-medium transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
    error ? "border-red-500/40 text-red-800 hover:bg-red-500/10 dark:text-red-200" : "border-amber-500/40 text-amber-900 hover:bg-amber-500/10 dark:text-amber-200",
  )
const field =
  "h-9 w-full min-w-0 rounded-md border bg-transparent px-3 font-mono text-base shadow-xs transition-[color,box-shadow] outline-none placeholder:font-sans placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 md:text-sm dark:bg-input/30"

/**
 * A CORS allow-list editor that catches the entries that silently never match
 * or open the API to everyone: * with credentials, null, a trailing slash or
 * path, a missing scheme, a default port, http or localhost in production.
 * Each comes with a one-tap fix, and a built-in tester says whether a given
 * origin would get through and, if not, which near miss blocked it.
 */
export function CorsOriginInput({
  value,
  defaultValue = [],
  onValueChange,
  credentials = false,
  production = false,
  label = "Allowed origins",
  placeholder = "https://app.example.com",
  messages,
  useLabel = "Use {fix}",
  removeLabel = "Remove",
  fixAllLabel = "Fix {count}",
  testLabel = "Test an origin",
  testPlaceholder = "https://www.example.com",
  testMessages,
  credentialsOnLabel = "credentials: true",
  credentialsOffLabel = "no credentials",
  productionLabel = "prod",
  errorLabel = "error",
  warningLabel = "warning",
  className,
  ...props
}: CorsOriginInputProps) {
  const [inner, setInner] = React.useState(defaultValue)
  const [draft, setDraft] = React.useState("")
  const [probe, setProbe] = React.useState("")
  const baseId = React.useId()
  const input = React.useRef<HTMLInputElement>(null)
  const chips = React.useRef<HTMLUListElement>(null)
  const issuesBox = React.useRef<HTMLDivElement>(null)
  // A tapped chip or fix button disappears with its entry, so focus moves to its neighbour instead of the page.
  const refocus = React.useRef<(() => void) | null>(null)
  const origins = value ?? inner
  const context = { credentials, production }
  const text = { ...DEFAULT_MESSAGES, ...messages }
  const checked = origins.map((origin) => ({ origin, issues: checkOrigin(origin, context) }))
  const fixable = checked.flatMap(({ origin, issues }) => issues.filter((i) => i.fix !== undefined).slice(0, 1).map((i) => ({ origin, fix: i.fix })))

  const update = (next: string[]) => {
    const unique = [...new Set(next.map((o) => o.trim()).filter(Boolean))]
    if (value === undefined) setInner(unique)
    onValueChange?.(unique)
  }
  const replace = (origin: string, fix: string | null | undefined) => update(origins.flatMap((o) => (o === origin ? (fix === null ? [] : [fix ?? o]) : [o])))
  const keepFocus = (box: React.RefObject<HTMLElement | null>, index: number) => {
    refocus.current = () => {
      const buttons = box.current?.querySelectorAll<HTMLButtonElement>("button[data-fix]") ?? []
      ;(buttons[Math.min(index, buttons.length - 1)] ?? input.current)?.focus()
    }
  }
  React.useEffect(() => {
    refocus.current?.()
    refocus.current = null
  }, [origins])
  const add = (raw: string) => {
    const parts = raw.split(/[\s,]+/).filter(Boolean)
    if (parts.length) update([...origins, ...parts])
    setDraft("")
  }
  const fixAll = () => {
    const map = new Map(fixable.map((f) => [f.origin, f.fix]))
    update(origins.flatMap((o) => (map.has(o) ? (map.get(o) === null ? [] : [map.get(o) as string]) : [o])))
  }
  const result = probe.trim() ? testOrigin(origins, probe, context) : null
  const testText = { ...DEFAULT_TEST_MESSAGES, ...testMessages }

  return (
    <div data-slot="cors-origin-input" className={cn("grid w-full max-w-md gap-1.5 text-sm", className)} {...props}>
      <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
        <label htmlFor={`${baseId}-add`} className="font-medium">
          {label}
        </label>
        <span className="font-mono text-xs whitespace-nowrap text-muted-foreground">
          {credentials ? credentialsOnLabel : credentialsOffLabel}
          {production && ` · ${productionLabel}`}
        </span>
      </div>
      <ul ref={chips} aria-label={label} className="flex flex-wrap gap-1.5 empty:hidden">
        {checked.map(({ origin, issues }, index) => {
          const tone = issues.some((i) => i.severity === "error") ? "error" : issues.length ? "warning" : "ok"
          return (
            <li
              key={origin}
              data-tone={tone}
              className={cn(
                "inline-flex h-7 max-w-full items-center gap-1 rounded-md border pr-1 pl-2 font-mono text-xs",
                tone === "error" && "border-red-500/50 bg-red-500/10 text-red-800 dark:text-red-200",
                tone === "warning" && "border-amber-500/50 bg-amber-500/10 text-amber-900 dark:text-amber-200",
              )}
            >
              {tone !== "ok" && <ShieldAlert aria-hidden className="size-3 shrink-0" />}
              <span className="truncate">{origin}</span>
              {tone !== "ok" && <span className="sr-only">, {tone === "error" ? errorLabel : warningLabel}</span>}
              <button
                type="button"
                data-fix=""
                aria-label={`${removeLabel} ${origin}`}
                onClick={() => {
                  keepFocus(chips, index)
                  replace(origin, null)
                }} className="grid size-5 shrink-0 place-items-center rounded-sm transition-colors outline-none hover:bg-foreground/10 focus-visible:ring-[3px] focus-visible:ring-ring/50">
                <X aria-hidden className="size-3" />
              </button>
            </li>
          )
        })}
      </ul>
      <input
        ref={input}
        id={`${baseId}-add`}
        value={draft}
        placeholder={placeholder}
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        inputMode="url"
        aria-describedby={`${baseId}-issues`}
        aria-invalid={checked.some(({ issues }) => issues.some((i) => i.severity === "error")) || undefined}
        onChange={(event) => (/[\s,]$/.test(event.target.value) ? add(event.target.value) : setDraft(event.target.value))}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault()
            add(draft)
          }
        }}
        onPaste={(event) => {
          // A pasted list (one per line or comma separated) becomes entries at once; a single value stays editable.
          const pasted = event.clipboardData.getData("text")
          if (!/[\s,]/.test(pasted.trim())) return
          event.preventDefault()
          add(draft + pasted)
        }}
        onBlur={() => draft && add(draft)}
        className={field}
      />
      <div ref={issuesBox} id={`${baseId}-issues`} aria-live="polite" className="mt-1.5 grid gap-1.5 text-xs empty:hidden">
        {checked.flatMap(({ origin, issues }) =>
          issues.map((issue) => {
            const error = issue.severity === "error"
            return (
              <p key={origin + issue.kind} className={cn("flex gap-1.5", error ? "text-red-700 dark:text-red-400" : "text-amber-700 dark:text-amber-400")}>
                <span className="flex h-6 shrink-0 items-center">
                  <ShieldAlert aria-hidden className="size-3.5" />
                </span>
                <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="py-1">
                    <code className="font-mono font-medium break-all">{origin}</code> {text[issue.kind]}
                  </span>
                  {issue.fix !== undefined && (
                    <button
                      type="button"
                      data-fix=""
                      onClick={(event) => {
                        keepFocus(issuesBox, [...(issuesBox.current?.querySelectorAll("button[data-fix]") ?? [])].indexOf(event.currentTarget))
                        replace(origin, issue.fix)
                      }}
                      className={fixClass(error)}
                    >
                      {issue.fix === null ? removeLabel : <span className="truncate">{fill(useLabel, { fix: issue.fix })}</span>}
                    </button>
                  )}
                </span>
              </p>
            )
          }),
        )}
        {fixable.length > 1 && (
          <button
            type="button"
            onClick={() => {
              refocus.current = () => input.current?.focus()
              fixAll()
            }}
            className={cn(fixClass(false), "w-fit")}
          >
            <WandSparkles aria-hidden className="size-3.5" />
            {fill(fixAllLabel, { count: fixable.length })}
          </button>
        )}
      </div>
      <div className="mt-2 grid gap-1.5 border-t pt-3">
        <label htmlFor={`${baseId}-test`} className="w-fit text-xs font-medium text-muted-foreground">
          {testLabel}
        </label>
        <input id={`${baseId}-test`} value={probe} onChange={(event) => setProbe(event.target.value)} placeholder={testPlaceholder} autoCapitalize="none" spellCheck={false} inputMode="url" className={field} />
        <p aria-live="polite" className={cn("flex min-h-5 gap-1.5 text-xs", result && (result.allowed ? "text-emerald-700 dark:text-emerald-400" : "text-red-700 dark:text-red-400"))}>
          {result && (result.allowed ? <CircleCheck aria-hidden className="mt-px size-3.5 shrink-0" /> : <CircleX aria-hidden className="mt-px size-3.5 shrink-0" />)}
          {result && fill(testText[result.code], { origin: result.origin, entry: result.entry ?? "" })}
        </p>
      </div>
    </div>
  )
}
