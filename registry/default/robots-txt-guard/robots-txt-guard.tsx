"use client"

// Bollard UI — robots-txt-guard · MIT licence · https://bollard-ui.vercel.app/components/robots-txt-guard

import * as React from "react"
import { CircleAlert, CircleCheck, CircleX, Info, TriangleAlert, WandSparkles } from "lucide-react"

import { cn } from "@/lib/utils"
import { applyRobotsFix, checkRobots, testRobots, type RobotsIssue } from "@/registry/default/robots-txt-guard/check-robots"

export { applyRobotsFix, checkRobots, decide, parseRobots, robotsPatternMatches, rulesFor, testRobots, type RobotsContext, type RobotsGroup, type RobotsIssue, type RobotsIssueKind, type RobotsRule, type RobotsTestCode } from "@/registry/default/robots-txt-guard/check-robots"

const DEFAULT_MESSAGES = {
  label: "robots.txt",
  production: "production",
  staging: "not production",
  placeholder: "User-agent: *\nDisallow:",
  clean: "No problems. Crawlers will read this as intended.",
  problems: "{errors} to fix · {warnings} to review",
  line: "Line {line}",
  selectLine: "Select line {line}",
  fixAll: "Fix {count}",
  remove: "Remove line",
  apply: "Change to {fix}",
  "fix-block-all": "Allow everything",
  "fix-typo": "Use {detail}",
  "fix-no-colon": "Add the colon",
  "fix-no-group": "Add User-agent: *",
  "fix-sitemap-relative": "Use full URL",
  "fix-sitemap-host": "Use live site",
  "fix-sitemap-http": "Use https",
  "fix-path-no-slash": "Add /",
  "fix-full-url-path": "Use the path",
  "block-all": "Disallow: / stops every search engine crawling the whole site, so its pages fade from results. This is the staging rule.",
  "staging-rule": "Looks like a staging leftover.",
  "blocks-assets": "Blocks {detail}, so Google can't render your pages the way visitors see them.",
  "sitemap-relative": "Sitemap needs a full URL, so crawlers skip this one.",
  "sitemap-host": "Sitemap points at {detail}, not your live site.",
  "sitemap-elsewhere": "Sitemap is on {detail}. Fine if it's your CDN; check it isn't an old copy.",
  "sitemap-http": "Sitemap uses http on an https site.",
  "sitemap-invalid": "This sitemap URL doesn't parse.",
  typo: "Typo for {detail}. Google may forgive it; most other crawlers ignore the line.",
  "no-colon": "No colon, so crawlers ignore this line.",
  "unknown-field": "Crawlers don't know {detail} and skip it.",
  noindex: "Google stopped reading noindex here in 2019. Use a noindex meta tag or X-Robots-Tag header instead.",
  "crawl-delay": "Google ignores Crawl-delay. Bing and Yandex honour it.",
  "no-group": "This rule comes before any User-agent, so no crawler applies it.",
  "path-no-slash": "Paths must start with / or *, so this matches nothing.",
  "full-url-path": "Rules take a path, not a full URL, so this matches nothing.",
  testLabel: "Test a URL",
  testPlaceholder: "/products/blue-shoe",
  agentLabel: "Crawler",
  allowed: "Allowed. No rule matches {path} for {agent}.",
  "allowed-by": "Allowed for {agent} by line {line}: {rule}",
  "blocked-by": "Blocked for {agent} by line {line}: {rule}",
  "robots-itself": "robots.txt itself is always fetched.",
  "other-host": "This file only covers your own host, not {host}.",
  invalid: "That isn't a URL or a path.",
}
export type RobotsTxtGuardMessages = typeof DEFAULT_MESSAGES

const fill = (text: string, values: Record<string, string | number>) => text.replace(/\{(\w+)\}/g, (match, key: string) => String(values[key] ?? match))
const tones = { error: "text-red-700 dark:text-red-400", warning: "text-amber-700 dark:text-amber-400", info: "text-muted-foreground" }
const icons = { error: CircleAlert, warning: TriangleAlert, info: Info }
const fixClass = (error: boolean) =>
  cn(
    "inline-flex min-h-6 max-w-full items-center gap-1 rounded-md border px-2 text-left font-medium [overflow-wrap:anywhere] transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
    error ? "border-red-500/40 text-red-800 hover:bg-red-500/10 dark:text-red-200" : "border-amber-500/40 text-amber-900 hover:bg-amber-500/10 dark:text-amber-200",
  )
const field = "h-9 w-full min-w-0 rounded-md border bg-transparent px-3 text-base shadow-xs transition-[color,box-shadow] outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 md:text-sm dark:bg-input/30"

/** Announces `text` only after typing settles, so screen readers don't chatter on every keystroke. */
function useSettled(text: string, delay = 900) {
  const [settled, setSettled] = React.useState(text)
  React.useEffect(() => {
    const timer = setTimeout(() => setSettled(text), delay)
    return () => clearTimeout(timer)
  }, [text, delay])
  return settled
}

export interface RobotsTxtGuardProps extends Omit<React.ComponentProps<"textarea">, "value" | "defaultValue" | "onChange"> {
  /** Controlled robots.txt text. */
  value?: string
  /** Initial text when uncontrolled. */
  defaultValue?: string
  /** Called with the new text on every edit or fix. */
  onValueChange?: (value: string) => void
  /** The file is about to serve production, so Disallow: / and staging leftovers are flagged. */
  production?: boolean
  /** The live origin (https://acme.com). Enables sitemap host checks and one-tap sitemap fixes. */
  siteUrl?: string
  /** Extra CSS/JS paths that must stay crawlable, e.g. "/build/app.css". */
  assetPaths?: string[]
  /** Crawlers offered in the URL tester. */
  agents?: string[]
  /** Visible label; shorthand for `messages.label`. */
  label?: string
  /** Every visible string. `{line}`, `{detail}`, `{fix}`, `{rule}`, `{agent}`, `{path}`, `{host}`, `{count}` are filled in. */
  messages?: Partial<RobotsTxtGuardMessages>
}

/**
 * A robots.txt editor that catches the lines that quietly de-index a site or
 * do nothing: Disallow: / shipped from staging, staging leftovers, rules that
 * block the CSS and JS Google renders with (checked against real asset paths
 * with Google's matching), relative or wrong-host sitemaps, directive typos,
 * missing colons and rules Google ignores (noindex, Crawl-delay). A built-in
 * tester says whether a crawler may fetch a URL and which line decides it.
 */
export function RobotsTxtGuard({
  value,
  defaultValue = "",
  onValueChange,
  production = false,
  siteUrl,
  assetPaths,
  agents = ["Googlebot", "Googlebot-Image", "Bingbot", "GPTBot"],
  label,
  messages,
  rows = 8,
  id,
  className,
  ref,
  "aria-describedby": describedBy,
  ...props
}: RobotsTxtGuardProps) {
  const t = { ...DEFAULT_MESSAGES, ...messages, ...(label !== undefined && { label }) }
  const [inner, setInner] = React.useState(defaultValue)
  const [probe, setProbe] = React.useState("")
  const [agent, setAgent] = React.useState(agents[0] ?? "*")
  const textarea = React.useRef<HTMLTextAreaElement>(null)
  const list = React.useRef<HTMLUListElement>(null)
  const refocus = React.useRef<number | null>(null)
  const autoId = React.useId()
  const inputId = id ?? autoId
  const text = value ?? inner
  React.useImperativeHandle(ref, () => textarea.current as HTMLTextAreaElement)

  const issues = React.useMemo(() => checkRobots(text, { production, siteUrl, assetPaths }), [text, production, siteUrl, assetPaths])
  const counted = issues.filter((issue) => issue.severity !== "info")
  const errors = counted.filter((issue) => issue.severity === "error").length
  const fixable = issues.filter((issue) => issue.fix !== undefined && issue.severity !== "info")
  const summary = !text.trim() ? "" : counted.length ? fill(t.problems, { errors, warnings: counted.length - errors }) : t.clean
  const announced = useSettled(summary)
  const result = probe.trim() ? testRobots(text, probe, agent, siteUrl) : null
  const blocked = result !== null && (result.code === "blocked-by" || result.code === "invalid" || result.code === "other-host")
  const resultText = result
    ? fill(t[result.code], {
        agent: "agent" in result && result.agent !== "*" ? agent : `${agent} (User-agent: *)`,
        path: "path" in result ? (result.path ?? "") : "",
        host: "host" in result ? (result.host ?? "") : "",
        line: "rule" in result && result.rule ? result.rule.line + 1 : "",
        rule: "rule" in result && result.rule ? `${result.rule.type === "allow" ? "Allow" : "Disallow"}: ${result.rule.path}` : "",
      })
    : ""
  const announcedResult = useSettled(resultText)

  const update = (next: string) => {
    if (value === undefined) setInner(next)
    onValueChange?.(next)
  }
  // A fix removes its own button, so focus moves to the next fix (or the editor) instead of the page.
  React.useEffect(() => {
    if (refocus.current === null) return
    const buttons = list.current?.querySelectorAll<HTMLButtonElement>("button[data-fix]") ?? []
    ;(buttons[Math.min(refocus.current, buttons.length - 1)] ?? textarea.current)?.focus()
    refocus.current = null
  }, [text])
  const fix = (issue: RobotsIssue, button: HTMLElement) => {
    refocus.current = [...(list.current?.querySelectorAll("button[data-fix]") ?? [])].indexOf(button)
    update(applyRobotsFix(text, issue.line, issue.fix ?? null))
  }
  const fixAll = () => {
    // One fix per line, bottom-up, so deleting a line doesn't shift the ones still to fix.
    const byLine = new Map(fixable.map((issue) => [issue.line, issue]))
    refocus.current = 0
    update([...byLine.values()].sort((a, b) => b.line - a.line).reduce((acc, issue) => applyRobotsFix(acc, issue.line, issue.fix ?? null), text))
  }
  /** Selects the source line so the user sees exactly which line is meant. */
  const reveal = (line: number) => {
    const el = textarea.current
    if (!el) return
    const rowsText = text.split("\n")
    const start = rowsText.slice(0, line).reduce((sum, row) => sum + row.length + 1, 0)
    el.focus()
    el.setSelectionRange(start, start + (rowsText[line]?.length ?? 0))
  }
  const lineButton = (line: number) => (
    <button type="button" onClick={() => reveal(line)} aria-label={fill(t.selectLine, { line: line + 1 })} className="mr-1 rounded font-mono whitespace-nowrap text-muted-foreground tabular-nums underline-offset-2 outline-none hover:text-foreground hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50">
      {fill(t.line, { line: line + 1 })}
    </button>
  )

  return (
    <div data-slot="robots-txt-guard" className={cn("grid w-full grid-cols-[minmax(0,1fr)] max-w-xl min-w-0 gap-1.5 text-sm", className)}>
      <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
        <label htmlFor={inputId} className="font-mono font-medium">
          {t.label}
        </label>
        <span className={cn("rounded-md border px-1.5 py-0.5 font-mono text-xs", production ? "border-red-500/40 text-red-700 dark:text-red-300" : "text-muted-foreground")}>
          {production ? t.production : t.staging}
        </span>
      </div>
      <textarea
        ref={textarea}
        id={inputId}
        rows={rows}
        value={text}
        onChange={(event) => update(event.target.value)}
        spellCheck={false}
        autoCapitalize="none"
        autoCorrect="off"
        wrap="off"
        placeholder={t.placeholder}
        aria-invalid={errors > 0 || undefined}
        aria-describedby={[describedBy, `${inputId}-status`].filter(Boolean).join(" ")}
        className="w-full min-w-0 resize-y rounded-md border bg-transparent px-3 py-2 font-mono text-base leading-5 shadow-xs transition-[color,box-shadow] outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-destructive md:text-xs dark:bg-input/30"
        {...props}
      />
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
            {fill(t.fixAll, { count: new Set(fixable.map((issue) => issue.line)).size })}
          </button>
        )}
      </div>
      {issues.length > 0 && (
        <ul ref={list} className="grid gap-1.5 text-xs">
          {issues.map((issue) => {
            const Icon = icons[issue.severity]
            return (
              <li key={`${issue.line}-${issue.kind}`} className={cn("flex gap-1.5", tones[issue.severity])}>
                <span className="flex h-6 shrink-0 items-center">
                  <Icon aria-hidden className="size-3.5" />
                </span>
                <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="py-1">
                    {lineButton(issue.line)} {fill(issue.kind === "sitemap-host" && issue.severity === "info" ? t["sitemap-elsewhere"] : t[issue.kind], { detail: issue.detail ?? "" })}
                  </span>
                  {issue.fix !== undefined && (
                    <button type="button" data-fix="" title={issue.fix ?? undefined} onClick={(event) => fix(issue, event.currentTarget)} className={fixClass(issue.severity === "error")}>
                      {issue.fix === null ? t.remove : fill((t as Record<string, string>)[`fix-${issue.kind}`] ?? t.apply, { fix: issue.fix.split("\n")[0].trim(), detail: issue.detail ?? "" })}
                    </button>
                  )}
                </span>
              </li>
            )
          })}
        </ul>
      )}
      <div className="mt-2 grid gap-1.5 border-t pt-3">
        <div className="flex flex-wrap items-end gap-2">
          <div className="grid min-w-40 flex-1 gap-1.5">
            <label htmlFor={`${inputId}-test`} className="w-fit text-xs font-medium text-muted-foreground">
              {t.testLabel}
            </label>
            <input id={`${inputId}-test`} value={probe} onChange={(event) => setProbe(event.target.value)} placeholder={t.testPlaceholder} aria-describedby={`${inputId}-result`} autoCapitalize="none" spellCheck={false} inputMode="url" className={cn(field, "font-mono placeholder:font-sans")} />
          </div>
          <div className="grid gap-1.5">
            <label htmlFor={`${inputId}-agent`} className="w-fit text-xs font-medium text-muted-foreground">
              {t.agentLabel}
            </label>
            <select id={`${inputId}-agent`} value={agent} onChange={(event) => setAgent(event.target.value)} className={cn(field, "w-auto pr-8")}>
              {agents.map((name) => (
                <option key={name}>{name}</option>
              ))}
            </select>
          </div>
        </div>
        <p id={`${inputId}-result`} className={cn("flex min-h-5 gap-1.5 text-xs", blocked ? "text-red-700 dark:text-red-400" : "text-emerald-700 dark:text-emerald-400")}>
          {result && (blocked ? <CircleX aria-hidden className="mt-px size-3.5 shrink-0" /> : <CircleCheck aria-hidden className="mt-px size-3.5 shrink-0" />)}
          <span className="min-w-0 break-words">{resultText}</span>
        </p>
        <span role="status" className="sr-only">
          {announcedResult}
        </span>
      </div>
    </div>
  )
}
