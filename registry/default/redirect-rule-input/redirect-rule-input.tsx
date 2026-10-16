"use client"

// Bollard UI — redirect-rule-input · MIT licence · https://bollard-ui.vercel.app/components/redirect-rule-input

import * as React from "react"
import { ArrowRight, CircleAlert, CircleCheck, Info, Repeat, TriangleAlert, WandSparkles } from "lucide-react"

import { cn } from "@/lib/utils"
import {
  applyRedirectFix,
  checkRedirects,
  parseRedirects,
  traceRedirects,
  type RedirectFormat,
  type RedirectIssue,
  type RedirectMethod,
  type TraceResult,
} from "@/registry/default/redirect-rule-input/redirects"

export {
  applyRedirectFix, checkRedirects, detectRedirectFormat, parseRedirects, POST_PATTERN, resolveTraceUrl, TEMPORARY_PATTERN, traceRedirects,
  type CheckOptions, type ParsedRedirects, type RedirectFix, type RedirectFormat, type RedirectIssue, type RedirectIssueKind, type RedirectMethod, type RedirectRule, type TraceHop, type TraceResult,
} from "@/registry/default/redirect-rule-input/redirects"

export const REDIRECT_RULE_INPUT_MESSAGES = {
  label: "Redirect rules",
  placeholder: "Paste vercel.json redirects, a Netlify _redirects file or nginx rewrite/return lines",
  detected: "Read as {format}",
  vercel: "Vercel vercel.json",
  netlify: "Netlify _redirects",
  nginx: "nginx",
  "note-vercel": "Vercel: no status means 308 Permanent, sources are case-sensitive, and the query string is passed on.",
  "note-netlify": "Netlify: default is 301, /a and /a/ match the same rule, and the docs list 307 as unsupported.",
  "note-nginx": "nginx: server-level rewrites run first, in order. return drops the query unless you add $is_args$args.",
  line: "Line {line}",
  clean: "No problems found in {count} rules.",
  problems: "{errors} to fix · {warnings} to review",
  fixAll: "Fix {count}",
  json: "This isn't valid JSON yet: {detail}",
  shape: "Couldn't find source and destination here.",
  "shape-root": "No redirects array found. Paste the whole vercel.json or just the redirects list.",
  "line-bad": "Couldn't read this line: {detail}",
  regex: "This regex doesn't compile in JavaScript, so it isn't checked: {detail}",
  truncated: "Only the first {detail} rules were checked in depth.",
  loop: "Redirect loop: browsers bounce between these and show “too many redirects”.",
  "too-many": "More than 20 hops. Browsers give up and show an error.",
  "slash-loop": "Netlify matches paths with or without the trailing slash, so this rule redirects to itself. Use Pretty URLs to set slashes instead.",
  chain: "{detail} hops before the page loads. Each one costs a round trip, and search engines may stop following.",
  shadowed: "Never runs: line {detail} catches the same URLs first.",
  insecure: "Sends visitors to http://, so the next hop is unencrypted and browsers may warn.",
  "permanent-temporary": "{detail} is permanent: browsers may cache it indefinitely, so you can't reliably take it back later. This looks like a temporary move.",
  "default-permanent": "No status set, so Vercel sends 308 Permanent, which browsers may cache indefinitely. This looks like a temporary move.",
  "method-change": "If anything POSTs here, browsers resend it as GET and drop the body. {detail} keeps the method.",
  "method-netlify": "If anything POSTs here, browsers resend it as GET and drop the body. Netlify has no 307, so point the form or client at the new URL.",
  "netlify-status": "Netlify's docs list {detail} as unsupported for redirects. Use 302 (temporary) or 301 (permanent).",
  "netlify-query-status": "Netlify passes the query string on only for 200, 301 and 302, so ?utm and other parameters are lost here.",
  "query-dropped": "return doesn't pass the query string on, so ?page=2 or ?utm=… is lost.",
  "rewrite-drops-args": "The trailing ? tells nginx to drop the query string.",
  "slash-unreachable": "Never runs: trailingSlash is {detail}, so Vercel redirects this path before your rules see it.",
  "slash-one-way": "Only {detail} redirects. The same path without the trailing slash doesn't.",
  "vercel-conflict": "permanent and statusCode can't be used together. Vercel rejects the config.",
  "query-exact": "Matches only URLs whose query has exactly {detail} and nothing else. Add a plain rule after it for the rest.",
  "source-slash": "The source must start with / (or https:// for a whole domain). As written it never matches anything.",
  "destination-slash": "The destination must start with / or https://. Without it the browser resolves it relative to the old URL, or the deploy rejects it.",
  "unknown-param": "Uses {detail}, but the source never captures it, so there's nothing to fill in and visitors land on a broken URL.",
  "open-redirect": "The destination's domain comes from the request, so anyone can make a link on your site that sends people to a phishing page. Write the domain out.",
  "source-query": "The source only matches the path. The ?query is never part of it, so this rule never runs.",
  "source-hash": "Browsers never send the {detail} part to the server, so this rule never runs.",
  "fix-chain": "Point straight to {to}",
  "fix-shadowed": "Move above line {detail}",
  "fix-insecure": "Use https",
  "fix-permanent-temporary": "Make it temporary",
  "fix-default-permanent": "Make it temporary",
  "fix-method-change": "Keep the method",
  "fix-netlify-status": "Use {status}",
  "fix-query-dropped": "Keep the query",
  "fix-rewrite-drops-args": "Keep the query",
  "fix-slash-unreachable": "Use {source}",
  "fix-slash-one-way": "Match both",
  "fix-vercel-conflict": "Remove permanent",
  "fix-source-slash": "Add the leading /",
  "fix-destination-slash": "Add the leading /",
  "fix-source-query": "Match the query separately",
  "fix-source-hash": "Remove {detail}",
  tracer: "Test a URL",
  tracePlaceholder: "/old-page?utm_source=mail",
  method: "Request method",
  noRedirect: "Not redirected. It's served as is.",
  rewrite: "Served from {to} without changing the address.",
  status: "Answered with {status}.",
  external: "Leaves your site.",
  loopEnd: "Loops back to {to}.",
  tooMany: "Still redirecting after 20 hops.",
  cycle: "nginx rewrite cycle: it gives up with a 500 error.",
  invalid: "Enter a path like /old or a full URL.",
  becomesGet: "POST becomes GET, body dropped",
  platformHop: "{platform} itself",
  landedOne: "Lands on {to} after 1 redirect.",
  landedMany: "Lands on {to} after {count} redirects. Point the first rule straight there.",
}
export type RedirectRuleInputMessages = typeof REDIRECT_RULE_INPUT_MESSAGES

const fill = (text: string, values: Record<string, string | number | undefined>) => text.replace(/\{(\w+)\}/g, (match, key: string) => String(values[key] ?? match))
const tones = { error: "text-red-700 dark:text-red-400", warning: "text-amber-700 dark:text-amber-400", info: "text-muted-foreground" }
const icons = { error: CircleAlert, warning: TriangleAlert, info: Info }
const fixClass = (error: boolean) =>
  cn(
    "inline-flex min-h-6 max-w-full items-center gap-1 rounded-md border px-2 text-left font-medium [overflow-wrap:anywhere] transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
    error ? "border-red-500/40 text-red-800 hover:bg-red-500/10 dark:text-red-200" : "border-amber-500/40 text-amber-900 hover:bg-amber-500/10 dark:text-amber-200",
  )
const field = "w-full min-w-0 rounded-md border bg-transparent px-3 font-mono text-base shadow-xs transition-[color,box-shadow] outline-none placeholder:font-sans placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 md:text-xs dark:bg-input/30"

/** Announces `text` only after typing settles, so screen readers don't chatter on every keystroke. */
function useSettled(text: string, delay = 900) {
  const [settled, setSettled] = React.useState(text)
  React.useEffect(() => {
    const timer = setTimeout(() => setSettled(text), delay)
    return () => clearTimeout(timer)
  }, [text, delay])
  return settled
}

function useControllable<T>(value: T | undefined, initial: T, onChange?: (next: T) => void) {
  const [inner, setInner] = React.useState(initial)
  const set = (next: T) => {
    if (value === undefined) setInner(next)
    onChange?.(next)
  }
  return [value ?? inner, set] as const
}

/** A hop path: /a → 301 → /b, wrapping on narrow screens. */
function HopPath({ path }: { path: string[] }) {
  return (
    <span className="flex flex-wrap items-center gap-x-1 gap-y-0.5 font-mono text-[11px] text-foreground/80">
      {path.map((step, index) => (
        <React.Fragment key={index}>
          {index > 0 && <ArrowRight aria-label="to" className="size-3 shrink-0 text-muted-foreground" />}
          <span className="[overflow-wrap:anywhere]">{step}</span>
        </React.Fragment>
      ))}
    </span>
  )
}

export interface RedirectRuleInputProps extends Omit<React.ComponentProps<"textarea">, "value" | "defaultValue" | "onChange"> {
  /** Controlled rules text. */
  value?: string
  /** Initial rules text when uncontrolled. */
  defaultValue?: string
  /** Called with the new text on every edit or fix. */
  onValueChange?: (value: string) => void
  /** Force a format instead of detecting it from the pasted text. */
  format?: RedirectFormat
  /** Your site's origin, used for paths without a host. Default https://example.com. */
  origin?: string
  /** Other hostnames of the same site (www, apex, old domains), so hops between them are followed. */
  hosts?: string[]
  /** URL the tester starts with. Defaults to an example from the first loop or chain. */
  defaultTraceUrl?: string
  /** Method the tester starts with. */
  defaultTraceMethod?: RedirectMethod
  /** Paths that look like temporary moves. Defaults to TEMPORARY_PATTERN (sale, promo, maintenance, beta…). */
  temporaryPattern?: RegExp
  /** Paths likely to receive POSTs. Defaults to POST_PATTERN (api, webhook, checkout, form…). */
  postPattern?: RegExp
  /** Visible label; shorthand for `messages.label`. */
  label?: string
  /** Every visible string. `{detail}`, `{line}`, `{to}`, `{status}`, `{count}`, `{format}` are filled in. */
  messages?: Partial<RedirectRuleInputMessages>
}

/**
 * A redirect list editor for vercel.json, Netlify _redirects and nginx that
 * catches what breaks links and SEO: loops and chains (with the hop path),
 * permanent codes on temporary moves, POSTs turned into GETs, dropped query
 * strings, trailing-slash traps, rules shadowed by an earlier wildcard and
 * hops to http. Includes a URL tester with GET/POST and one-tap fixes.
 */
export function RedirectRuleInput({
  value, defaultValue = "", onValueChange, format, origin, hosts, defaultTraceUrl, defaultTraceMethod = "GET", temporaryPattern, postPattern, label, messages,
  rows = 8, id, className, ref, "aria-describedby": describedBy, ...props
}: RedirectRuleInputProps) {
  const t = { ...REDIRECT_RULE_INPUT_MESSAGES, ...messages, ...(label !== undefined && { label }) }
  const [text, setText] = useControllable(value, defaultValue, onValueChange)
  const parsed = React.useMemo(() => parseRedirects(text, format), [text, format])
  const options = React.useMemo(() => ({ origin, hosts, temporaryPattern, postPattern }), [origin, hosts, temporaryPattern, postPattern])
  const issues = React.useMemo(() => checkRedirects(parsed, options), [parsed, options])
  const [traceInput, setTraceInput] = React.useState<string>()
  const [method, setMethod] = React.useState<RedirectMethod>(defaultTraceMethod)
  const textarea = React.useRef<HTMLTextAreaElement>(null)
  const list = React.useRef<HTMLUListElement>(null)
  const refocus = React.useRef<number | null>(null)
  const autoId = React.useId()
  const inputId = id ?? autoId
  React.useImperativeHandle(ref, () => textarea.current as HTMLTextAreaElement)

  const firstExample = issues.find((issue) => issue.path && issue.example)?.example ?? issues.find((issue) => issue.example)?.example ?? "/"
  // Pick the example once, so a fix doesn't swap the URL out from under the user.
  const [autoUrl, setAutoUrl] = React.useState<string>()
  React.useEffect(() => {
    if (autoUrl === undefined && firstExample !== "/") setAutoUrl(firstExample)
  }, [autoUrl, firstExample])
  const traceUrl = traceInput ?? defaultTraceUrl ?? autoUrl ?? firstExample
  const result: TraceResult = React.useMemo(() => traceRedirects(parsed, traceUrl, { ...options, method }), [parsed, traceUrl, options, method])
  const counted = issues.filter((issue) => issue.severity !== "info")
  const errors = counted.filter((issue) => issue.severity === "error").length
  const fixable = counted.filter((issue) => issue.fix)
  const summary = !text.trim() ? "" : counted.length ? fill(t.problems, { errors, warnings: counted.length - errors }) : fill(t.clean, { count: parsed.rules.length })
  const announced = useSettled(summary)
  const lineOf = (index?: number) => (index === undefined ? undefined : parsed.rules[index]?.line)

  // A fix removes its own button, so focus moves to the next fix (or the editor) instead of the page.
  React.useEffect(() => {
    if (refocus.current === null) return
    const buttons = list.current?.querySelectorAll<HTMLButtonElement>("button[data-fix]") ?? []
    ;(buttons[Math.min(refocus.current, buttons.length - 1)] ?? textarea.current)?.focus()
    refocus.current = null
  }, [text])
  const fix = (issue: RedirectIssue, button: HTMLElement) => {
    if (!issue.fix) return
    refocus.current = [...(list.current?.querySelectorAll("button[data-fix]") ?? [])].indexOf(button)
    setText(applyRedirectFix(text, issue.fix, parsed.format))
  }
  const fixAll = () => {
    // Fixes can touch the same rule or shift order, so apply one, re-check, repeat.
    let next = text
    for (let round = 0; round < 40; round++) {
      const current = parseRedirects(next, parsed.format)
      const first = checkRedirects(current, options).find((issue) => issue.severity !== "info" && issue.fix)
      const applied = first?.fix ? applyRedirectFix(next, first.fix, parsed.format) : next
      if (applied === next) break
      next = applied
    }
    refocus.current = 0
    setText(next)
  }

  const describe = (issue: RedirectIssue) => {
    const key = issue.kind === "shape" && issue.line === undefined ? "shape-root" : issue.kind === "line" ? "line-bad" : issue.kind
    const detail = issue.kind === "shadowed" ? issue.detail : issue.kind === "method-change" ? issue.detail?.split("→")[1] : issue.detail
    return fill(t[key as keyof RedirectRuleInputMessages], { detail })
  }
  const fixLabel = (issue: RedirectIssue) =>
    fill(t[`fix-${issue.kind}` as keyof RedirectRuleInputMessages] ?? "", { to: issue.fix?.destination, detail: issue.detail, status: issue.fix?.status, source: issue.fix?.source })
  const ending = (): string => {
    if (result.outcome === "invalid") return t.invalid
    if (result.outcome === "loop") return fill(t.loopEnd, { to: result.end })
    if (result.outcome === "too-many") return t.tooMany
    if (result.outcome === "cycle") return t.cycle
    if (result.outcome === "external") return t.external
    if (result.outcome === "rewrite") return fill(t.rewrite, { to: result.end })
    if (result.outcome === "status") return fill(t.status, { status: result.endStatus })
    if (!result.hops.length) return t.noRedirect
    return fill(result.hops.length === 1 ? t.landedOne : t.landedMany, { to: result.end, count: result.hops.length })
  }
  const bad = result.outcome === "loop" || result.outcome === "too-many" || result.outcome === "cycle"

  return (
    <div data-slot="redirect-rule-input" className={cn("grid w-full max-w-xl min-w-0 grid-cols-[minmax(0,1fr)] gap-1.5 text-sm", className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label htmlFor={inputId} className="w-fit font-medium">
          {t.label}
        </label>
        {text.trim() && <span className="rounded-md border px-1.5 py-0.5 text-[11px] text-muted-foreground">{fill(t.detected, { format: t[parsed.format] })}</span>}
      </div>
      <textarea
        ref={textarea}
        id={inputId}
        rows={rows}
        value={text}
        onChange={(event) => setText(event.target.value)}
        spellCheck={false}
        autoCapitalize="none"
        autoCorrect="off"
        // One rule per line matters more than fitting the width, so long lines scroll instead of wrapping.
        wrap="off"
        placeholder={t.placeholder}
        aria-invalid={errors > 0 || undefined}
        aria-describedby={[describedBy, `${inputId}-note`, `${inputId}-status`].filter(Boolean).join(" ")}
        className={cn(field, "resize-y overflow-x-auto py-2 leading-5 whitespace-pre aria-invalid:border-destructive")}
        {...props}
      />
      <p id={`${inputId}-note`} className="flex gap-1.5 text-xs text-muted-foreground">
        <Info aria-hidden className="mt-0.5 size-3.5 shrink-0" />
        {t[`note-${parsed.format}`]}
      </p>
      <span role="status" className="sr-only">
        {announced}
      </span>
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
            const Icon = issue.kind === "loop" ? Repeat : icons[issue.severity]
            return (
              <li key={`${issue.kind}-${issue.rule ?? "x"}-${index}`} className={cn("flex gap-1.5", tones[issue.severity])}>
                <span className="flex h-6 shrink-0 items-center">
                  <Icon aria-hidden className="size-3.5" />
                </span>
                <span className="grid min-w-0 gap-1 py-1">
                  <span>
                    {issue.line !== undefined && <span className="mr-1 rounded border px-1 font-mono text-[11px] text-muted-foreground">{fill(t.line, { line: issue.line })}</span>} {describe(issue)}
                  </span>
                  {issue.path && <HopPath path={issue.path} />}
                  {issue.fix && (
                    <span>
                      <button type="button" data-fix="" onClick={(event) => fix(issue, event.currentTarget)} className={fixClass(issue.severity === "error")}>
                        {fixLabel(issue)}
                      </button>
                    </span>
                  )}
                </span>
              </li>
            )
          })}
        </ul>
      )}
      {parsed.rules.length > 0 && (
        <section aria-labelledby={`${inputId}-tracer`} className="mt-1.5 grid gap-2 rounded-md border bg-muted/40 p-3 text-xs">
          <h3 id={`${inputId}-tracer`} className="font-medium text-muted-foreground">
            {t.tracer}
          </h3>
          <div className="flex flex-wrap gap-2">
            <input
              aria-labelledby={`${inputId}-tracer`}
              value={traceUrl}
              onChange={(event) => setTraceInput(event.target.value)}
              placeholder={t.tracePlaceholder}
              spellCheck={false}
              autoCapitalize="none"
              inputMode="url"
              className={cn(field, "h-9 min-w-40 flex-1")}
            />
            <div role="radiogroup" aria-label={t.method} className="inline-flex h-9 rounded-md border p-0.5 shadow-xs">
              {(["GET", "POST"] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  role="radio"
                  aria-checked={method === option}
                  tabIndex={method === option ? 0 : -1}
                  onClick={() => setMethod(option)}
                  onKeyDown={(event) => {
                    if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return
                    event.preventDefault()
                    const next = option === "GET" ? "POST" : "GET"
                    setMethod(next)
                    ;(event.currentTarget.parentElement?.querySelector(`[data-method="${next}"]`) as HTMLElement | null)?.focus()
                  }}
                  data-method={option}
                  className={cn("rounded-[5px] px-2.5 font-mono text-xs font-medium outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50", method === option ? "bg-background text-foreground shadow-xs dark:bg-input/60" : "text-muted-foreground hover:text-foreground")}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>
          <ol className="grid gap-1">
            {result.hops.map((hop, index) => (
              <li key={index} className="grid grid-cols-[2.25rem_minmax(0,1fr)] items-start gap-x-2">
                <span className="rounded border bg-background px-1 text-center font-mono text-[11px] font-medium dark:bg-input/30">{hop.status}</span>
                <span className="grid min-w-0 gap-0.5">
                  <span className="font-mono [overflow-wrap:anywhere]">
                    {hop.to}
                    {result.outcome === "loop" && index === result.hops.length - 1 && <Repeat aria-hidden className="ml-1 inline size-3 text-red-600 dark:text-red-400" />}
                  </span>
                  <span className="text-muted-foreground">
                    {hop.rule !== undefined ? fill(t.line, { line: lineOf(hop.rule) }) : fill(t.platformHop, { platform: t[parsed.format] })}
                    {hop.becomesGet && <span className="font-medium text-amber-700 dark:text-amber-400"> · {t.becomesGet}</span>}
                  </span>
                </span>
              </li>
            ))}
          </ol>
          {ending() && (
            <p className={cn("flex items-center gap-1.5", bad ? "font-medium text-red-700 dark:text-red-400" : "text-muted-foreground")}>
              {bad ? <CircleAlert aria-hidden className="size-3.5 shrink-0" /> : <CircleCheck aria-hidden className="size-3.5 shrink-0" />}
              {ending()}
            </p>
          )}
        </section>
      )}
    </div>
  )
}
