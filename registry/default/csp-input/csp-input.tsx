"use client"

// Bollard UI — csp-input · MIT licence · https://bollard-ui.vercel.app/components/csp-input

import * as React from "react"
import { CircleCheck, Info, ShieldAlert, TriangleAlert, WandSparkles } from "lucide-react"

import { cn } from "@/lib/utils"
import { applyCspFix, checkCsp, parseCsp, serializeCsp, type CspDelivery, type CspFinding, type CspFindingKind, type CspMode } from "./csp-check"

export * from "./csp-check"

/** Default text. `{directive}`, `{source}`, `{with}`, `{to}`, `{count}` are filled in. */
export const CSP_INPUT_MESSAGES = {
  label: "Content-Security-Policy",
  placeholder: "default-src 'self'; script-src 'self'; object-src 'none'",
  enforced: "enforced",
  reportOnly: "report-only",
  header: "header",
  meta: "<meta>",
  reportOnlyNote: "Report-only blocks nothing. It only reports what an enforced policy would block.",
  baseline: "Start from a safe baseline",
  clean: "No problems found.",
  error: "{count} error",
  errors: "{count} errors",
  warning: "{count} warning",
  warnings: "{count} warnings",
  readout: "Directives",
  removeSource: "Remove {source}",
  replaceSource: "Use {with}",
  add: "Add {directive} {sources}",
  removeDirective: "Remove {directive}",
  split: "Add the ;",
  rename: "Rename to {to}",
  unwrap: "Keep the value only",
  enforce: "Make it enforced",
  "report-only-pasted": "This is the Report-Only header. It reports violations but blocks nothing.",
  "report-only-no-endpoint": "Report-only with no report-to or report-uri does nothing: nothing is blocked and no report is sent.",
  "report-only-meta": "Browsers ignore report-only policies in a <meta> tag. Send it as a header.",
  "report-only-ignored": "{directive} is ignored in a report-only policy, so it won't show up in reports either.",
  "header-name": "Only the value is the policy. The header name or meta tag around it isn't.",
  "meta-ignored": "{directive} is ignored when the policy is set in a <meta> tag.",
  unquoted: "{source} without quotes is read as a host name. Keywords, nonces and hashes need single quotes.",
  "missing-semicolon": "{source} is being read as a source of {directive}. A semicolon is missing before it.",
  comma: "Commas don't separate sources. In a header, the comma in {source} starts a second policy and cuts {directive} short.",
  duplicate: "Browsers use the first {directive} and ignore this one.",
  unknown: "{directive} isn't a CSP directive, so browsers ignore it.",
  "none-mixed": "'none' is ignored when {directive} lists other sources.",
  "strict-dynamic-alone": "'strict-dynamic' without a nonce or hash blocks every script.",
  "unsafe-inline": "'unsafe-inline' lets injected scripts run. Use a nonce or hash; inline scripts without one stop working once it's gone.",
  "unsafe-eval": "'unsafe-eval' lets strings run as code through eval(). Remove it unless a library needs it.",
  wildcard: "* in {directive} lets any site supply it.",
  "scheme-only": "{source} in {directive} allows scripts from any {source} site, including an attacker's.",
  "data-script": "data: in {directive} lets an injected tag run a script written into the URL.",
  "bypass-host": "{source} serves JSONP or AngularJS that can run any script, so allowing it undoes the allowlist. Prefer a nonce with 'strict-dynamic'.",
  "no-default-src": "No default-src, so every directive you didn't list allows anything.",
  "no-object-src": "object-src isn't 'none', so <object> and <embed> can load plugins around the policy.",
  "no-base-uri": "No base-uri, so an injected <base> tag can repoint every relative script URL.",
  "no-frame-ancestors": "No frame-ancestors, so any site can frame this page to trick clicks.",
}

export type CspInputMessages = typeof CSP_INPUT_MESSAGES

const fill = (s: string, d: Record<string, string | number | undefined>) => s.replace(/\{(\w+)\}/g, (m, k: string) => String(d[k] ?? m))
const tone = { error: "text-red-700 dark:text-red-400", warning: "text-amber-700 dark:text-amber-400", hint: "text-muted-foreground" }
const fixClass = (severity: CspFinding["severity"]) =>
  cn(
    "inline-flex h-6 max-w-full items-center gap-1 rounded-md border px-2 font-medium transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
    severity === "error" ? "border-red-500/40 text-red-900 hover:bg-red-500/10 dark:text-red-200" : severity === "warning" ? "border-amber-500/40 text-amber-900 hover:bg-amber-500/10 dark:text-amber-200" : "hover:bg-accent",
  )

function fixLabel(t: CspInputMessages, finding: CspFinding) {
  const fix = finding.fix
  if (!fix) return ""
  switch (fix.op) {
    case "remove-source": return fill(t.removeSource, { source: fix.source })
    case "replace-source": return fill(t.replaceSource, { with: fix.with })
    case "add": return fill(t.add, { directive: fix.directive, sources: fix.sources.join(" ") })
    case "remove-directive": return fill(t.removeDirective, { directive: fix.directive })
    case "split": return t.split
    case "rename": return fill(t.rename, { to: fix.to })
    case "unwrap": return finding.kind === "report-only-pasted" ? t.enforce : t.unwrap
  }
}

export interface CspInputProps extends Omit<React.ComponentProps<"textarea">, "value" | "defaultValue" | "onChange"> {
  /** Controlled policy text. */
  value?: string
  /** Initial policy when uncontrolled. */
  defaultValue?: string
  /** Called on every change and fix. */
  onValueChange?: (value: string) => void
  /** How the policy will be sent. "report-only" blocks nothing and must name a report endpoint. */
  mode?: CspMode
  /** Header or <meta> tag. A meta tag ignores frame-ancestors, report-uri and sandbox. */
  delivery?: CspDelivery
  /** Called with the findings after each check, so a form can block saving on errors. */
  onFindingsChange?: (findings: CspFinding[]) => void
  /** Pause in ms before the check runs while typing. Leaving the field or a fix runs it at once. */
  delay?: number
  /** Override any visible or announced text. */
  messages?: Partial<CspInputMessages>
}

/**
 * A Content-Security-Policy editor that reads the policy the way a browser
 * does, so it catches what makes a CSP look strict while it protects nothing:
 * 'unsafe-inline' without a nonce, 'unsafe-eval', *, data: or https: in
 * script-src, a missing default-src or object-src, unquoted keywords, a missing
 * semicolon, typo'd and duplicate directives, and the report-only traps (a
 * Report-Only header pasted as the real one, or no endpoint to report to).
 * Each finding is pinned to its directive in a readout and most fix in one tap.
 */
export function CspInput({
  value,
  defaultValue = "",
  onValueChange,
  mode = "enforce",
  delivery = "header",
  onFindingsChange,
  delay = 500,
  messages,
  id,
  className,
  onBlur,
  ref,
  rows = 4,
  "aria-describedby": describedBy,
  ...props
}: CspInputProps) {
  const t = { ...CSP_INPUT_MESSAGES, ...messages }
  const [inner, setInner] = React.useState(defaultValue)
  const text = value ?? inner
  const [settled, setSettled] = React.useState(text)
  const areaRef = React.useRef<HTMLTextAreaElement>(null)
  const listRef = React.useRef<HTMLUListElement>(null)
  // A tapped fix disappears with its finding, so focus moves to the fix that took its place.
  const refocus = React.useRef<number | null>(null)
  const autoId = React.useId()
  const areaId = id ?? autoId
  React.useImperativeHandle(ref, () => areaRef.current as HTMLTextAreaElement)

  React.useEffect(() => {
    const timer = setTimeout(() => setSettled(text), delay)
    return () => clearTimeout(timer)
  }, [text, delay])

  const parsed = React.useMemo(() => parseCsp(settled), [settled])
  const findings = React.useMemo(() => checkCsp(parsed, { mode, delivery }), [parsed, mode, delivery])
  const findingsRef = React.useRef(onFindingsChange)
  React.useEffect(() => {
    findingsRef.current = onFindingsChange
  })
  React.useEffect(() => findingsRef.current?.(findings), [findings])

  React.useEffect(() => {
    if (refocus.current === null) return
    const buttons = listRef.current?.querySelectorAll<HTMLButtonElement>("button[data-fix]") ?? []
    ;(buttons[Math.min(refocus.current, buttons.length - 1)] ?? areaRef.current)?.focus()
    refocus.current = null
  }, [findings])

  const update = (next: string, settle = false) => {
    if (value === undefined) setInner(next)
    if (settle) setSettled(next)
    onValueChange?.(next)
  }
  const fresh = settled === text
  const shown = fresh ? findings : []
  const errors = shown.filter((f) => f.severity === "error").length
  const warnings = shown.filter((f) => f.severity === "warning").length
  const empty = !text.trim()
  const count = (n: number, one: string, many: string) => (n ? [fill(n === 1 ? one : many, { count: n })] : [])
  const status = !fresh || empty ? "" : errors || warnings ? [...count(errors, t.error, t.errors), ...count(warnings, t.warning, t.warnings)].join(" · ") : t.clean
  const flagged = (directive: string, source?: string) =>
    shown.find((f) => f.directive === directive && f.source === source && f.severity !== "hint")?.severity
  const baseline = `default-src 'self'; script-src 'self'; object-src 'none'; base-uri 'self'${delivery === "header" ? "; frame-ancestors 'self'" : ""}`

  return (
    <div data-slot="csp-input" className={cn("grid w-full max-w-lg min-w-0 grid-cols-[minmax(0,1fr)] gap-1.5 text-sm", className)}>
      <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
        <label htmlFor={areaId} className="font-medium">{t.label}</label>
        <span className="font-mono text-xs whitespace-nowrap text-muted-foreground">
          {mode === "report-only" ? t.reportOnly : t.enforced} · {delivery === "meta" ? t.meta : t.header}
        </span>
      </div>
      <textarea
        ref={areaRef}
        id={areaId}
        rows={rows}
        value={text}
        placeholder={t.placeholder}
        autoCapitalize="none"
        autoCorrect="off"
        autoComplete="off"
        spellCheck={false}
        onChange={(e) => update(e.target.value)}
        onBlur={(e) => {
          setSettled(text)
          onBlur?.(e)
        }}
        aria-invalid={errors > 0 || undefined}
        aria-describedby={[`${areaId}-status`, describedBy].filter(Boolean).join(" ")}
        className="w-full min-w-0 resize-y rounded-md border bg-transparent px-3 py-2 font-mono text-base break-all shadow-xs transition-[color,box-shadow] outline-none placeholder:font-sans placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-destructive disabled:cursor-not-allowed disabled:opacity-50 md:text-sm dark:bg-input/30"
        {...props}
      />
      {mode === "report-only" && (
        <p className="flex gap-1.5 text-xs text-muted-foreground"><Info aria-hidden className="mt-px size-3.5 shrink-0" />{t.reportOnlyNote}</p>
      )}
      <p id={`${areaId}-status`} aria-live="polite" className={cn("flex min-h-5 items-center gap-1.5 text-xs", errors ? tone.error : warnings ? tone.warning : "text-emerald-700 dark:text-emerald-400")}>
        {status && (errors ? <ShieldAlert aria-hidden className="size-3.5" /> : warnings ? <TriangleAlert aria-hidden className="size-3.5" /> : <CircleCheck aria-hidden className="size-3.5" />)}
        {status}
      </p>
      {empty && (
        <button type="button" onClick={() => { update(baseline, true); areaRef.current?.focus() }} className={cn(fixClass("hint"), "w-fit text-xs")}>
          <WandSparkles aria-hidden className="size-3.5" /> {t.baseline}
        </button>
      )}
      {shown.length > 0 && (
        <ul ref={listRef} className="grid gap-1.5 text-xs">
          {shown.map((finding, index) => {
            const Icon = finding.severity === "error" ? ShieldAlert : finding.severity === "warning" ? TriangleAlert : Info
            return (
              <li key={`${finding.kind}-${finding.directive}-${finding.source}-${index}`} data-severity={finding.severity} className={cn("flex gap-1.5", tone[finding.severity])}>
                <span className="flex h-6 shrink-0 items-center"><Icon aria-hidden className="size-3.5" /></span>
                <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="py-1 break-words">{fill(t[finding.kind as CspFindingKind], { directive: finding.directive, source: finding.source })}</span>
                  {finding.fix && (
                    <button
                      type="button"
                      data-fix=""
                      onClick={(event) => {
                        refocus.current = [...(listRef.current?.querySelectorAll("button[data-fix]") ?? [])].indexOf(event.currentTarget)
                        const fix = finding.fix!
                        const body = serializeCsp(applyCspFix(parsed.directives, fix), text.includes("\n"))
                        // Only "Keep the value only" drops the header name or meta tag; every other fix keeps it.
                        const [before, after] = fix.op !== "unwrap" && parsed.wrapper ? parsed.wrapper : ["", ""]
                        update(before + body + after, true)
                      }}
                      className={cn(fixClass(finding.severity), "font-mono")}
                    >
                      <span className="truncate">{fixLabel(t, finding)}</span>
                    </button>
                  )}
                </span>
              </li>
            )
          })}
        </ul>
      )}
      {fresh && parsed.directives.length > 0 && (
        <div className="mt-1.5 grid gap-1.5 border-t pt-3">
          <span className="text-xs font-medium text-muted-foreground">{t.readout}</span>
          <dl className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-x-3 gap-y-1.5 font-mono text-xs">
            {parsed.directives.map((d, i) => (
              <React.Fragment key={`${d.name}-${i}`}>
                <dt className={cn("py-0.5 font-medium break-all", flagged(d.name) && tone[flagged(d.name)!])}>{d.name}</dt>
                <dd className="flex min-w-0 flex-wrap gap-1">
                  {d.sources.map((s, j) => {
                    const risk = flagged(d.name, s)
                    return (
                      <span key={`${s}-${j}`} className={cn("max-w-full rounded-sm border px-1.5 py-0.5 break-all", risk === "error" ? "border-red-500/50 bg-red-500/10 text-red-800 dark:text-red-200" : risk === "warning" ? "border-amber-500/50 bg-amber-500/10 text-amber-900 dark:text-amber-200" : "bg-muted/50")}>
                        {s}
                      </span>
                    )
                  })}
                </dd>
              </React.Fragment>
            ))}
          </dl>
        </div>
      )}
    </div>
  )
}
