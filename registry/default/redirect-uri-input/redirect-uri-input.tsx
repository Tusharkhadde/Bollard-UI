"use client"

import * as React from "react"
import { CircleCheck, Info, ShieldAlert, TriangleAlert } from "lucide-react"

import { cn } from "@/lib/utils"
import { checkRedirectUri, diffParts, findRegistered, type MismatchReason, type RedirectIssue, type RedirectIssueKind } from "./redirect-uri-check"

export * from "./redirect-uri-check"

/** Default text. `{registered}` and `{fix}` are filled in. */
export const REDIRECT_URI_MESSAGES = {
  label: "Redirect URI",
  placeholder: "https://app.example.com/auth/callback",
  help: "Must match a registered URI character for character.",
  matched: "Matches a registered URI exactly.",
  yours: "yours",
  registeredLabel: "registered",
  use: "Use {fix}",
  useRegistered: "Use the registered one",
  errors: "{count} problems",
  whitespace: "Spaces and line breaks are part of the comparison, so this never matches.",
  relative: "Redirect URIs must be absolute, with a scheme.",
  "dangerous-scheme": "This scheme can run code or read files. Providers reject it.",
  invalid: "This isn't a valid URI.",
  wildcard: "Wildcards aren't matched. The * is compared as a literal character.",
  fragment: "Redirect URIs can't contain a #fragment.",
  userinfo: "A user@ part hides the real host and is rejected.",
  "localhost-prod": "localhost in production sends sign-ins to whatever runs on the user's own machine.",
  http: "Plain http sends the authorization code unencrypted.",
  uppercase: "The comparison is case-sensitive. Use the lowercase scheme and host you registered.",
  "localhost-name": "Native apps should use 127.0.0.1, not localhost, so the redirect can't be served from the network.",
  query: "The query is part of the match, so it must be identical on every request. Use state for values that change.",
  "custom-scheme": "Any app can claim a short scheme. Use your reverse domain, like com.example.app:/callback.",
  "mismatch-trailing-slash": "A trailing slash is a different URI.",
  "mismatch-case": "Only the letter case differs, and the match is case-sensitive.",
  "mismatch-encoding": "Only the encoding differs (%2F versus /), which is still a mismatch.",
  "mismatch-scheme": "http and https are different URIs.",
  "mismatch-www": "www. makes it a different host.",
  "mismatch-port": "The port differs.",
  "mismatch-loopback": "localhost, 127.0.0.1 and [::1] are different hosts to the provider.",
  "mismatch-query": "The query string differs.",
  "mismatch-path": "The path differs from the registered one.",
  "mismatch-unlisted": "This URI isn't registered, so the provider will reject the sign-in.",
}

export type RedirectUriMessages = typeof REDIRECT_URI_MESSAGES

const fill = (s: string, d: Record<string, string | number>) => s.replace(/\{(\w+)\}/g, (m, k: string) => String(d[k] ?? m))
const issueText = (t: RedirectUriMessages, issue: RedirectIssue) =>
  issue.kind === "mismatch" ? t[`mismatch-${issue.reason ?? "unlisted"}` as `mismatch-${MismatchReason}`] : t[issue.kind as Exclude<RedirectIssueKind, "mismatch">]
const tone = {
  error: "text-red-700 dark:text-red-400",
  warning: "text-amber-700 dark:text-amber-400",
  hint: "text-muted-foreground",
}
const fixClass = (severity: RedirectIssue["severity"]) =>
  cn(
    "inline-flex h-6 max-w-full items-center rounded-md border px-2 font-medium transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
    severity === "error" ? "border-red-500/40 text-red-900 hover:bg-red-500/10 dark:text-red-200" : severity === "warning" ? "border-amber-500/40 text-amber-900 hover:bg-amber-500/10 dark:text-amber-200" : "hover:bg-accent",
  )

export interface RedirectUriInputProps extends Omit<React.ComponentProps<"input">, "value" | "defaultValue" | "onChange"> {
  /** Controlled URI. */
  value?: string
  /** Initial URI when uncontrolled. */
  defaultValue?: string
  /** Called on every change and fix. */
  onValueChange?: (value: string) => void
  /** URIs registered with the provider. Turns on the exact-match check with a near-miss diff. */
  registered?: string[]
  /** A production client: localhost is an error. Plain http to any other host is always an error (RFC 9700 §2.6). */
  production?: boolean
  /** A native or desktop app (RFC 8252): loopback ports may vary and custom schemes are expected. */
  native?: boolean
  /** Called with the current issues after each check, so a form can block saving on errors. */
  onIssuesChange?: (issues: RedirectIssue[]) => void
  /** Pause in ms before the check runs while typing. Leaving the field or a fix runs it at once. */
  delay?: number
  /** Override any visible or announced text. */
  messages?: Partial<RedirectUriMessages>
}

/**
 * A redirect URI field that catches the exact-match traps that end in
 * "redirect_uri_mismatch": a trailing slash, http versus https, letter case,
 * www, a port, localhost in production, wildcards, a #fragment or stray
 * whitespace. Against the registered list it names the near miss, highlights
 * the differing characters side by side, and swaps in the registered URI in one tap.
 */
export function RedirectUriInput({
  value,
  defaultValue = "",
  onValueChange,
  registered = [],
  production = false,
  native = false,
  onIssuesChange,
  delay = 500,
  messages,
  id,
  className,
  onBlur,
  ref,
  "aria-describedby": describedBy,
  ...props
}: RedirectUriInputProps) {
  const t = { ...REDIRECT_URI_MESSAGES, ...messages }
  const [inner, setInner] = React.useState(defaultValue)
  const uri = value ?? inner
  const [settled, setSettled] = React.useState(uri)
  const inputRef = React.useRef<HTMLInputElement>(null)
  const autoId = React.useId()
  const inputId = id ?? autoId
  React.useImperativeHandle(ref, () => inputRef.current as HTMLInputElement)

  React.useEffect(() => {
    const timer = setTimeout(() => setSettled(uri), delay)
    return () => clearTimeout(timer)
  }, [uri, delay])

  const key = registered.join("\n")
  const issues = React.useMemo(
    () => checkRedirectUri(settled, { registered: key ? key.split("\n") : [], production, native }),
    [settled, key, production, native],
  )
  const issuesRef = React.useRef(onIssuesChange)
  React.useEffect(() => {
    issuesRef.current = onIssuesChange
  })
  React.useEffect(() => issuesRef.current?.(issues), [issues])

  const update = (next: string, settle = false) => {
    if (value === undefined) setInner(next)
    if (settle) setSettled(next)
    onValueChange?.(next)
  }
  const fresh = settled === uri
  const shown = fresh ? issues : []
  const errors = shown.filter((i) => i.severity === "error")
  const matched = fresh && !!uri.trim() && registered.length > 0 && !!findRegistered(uri.trim(), registered, native) && !errors.length
  // Screen readers hear one short summary once typing pauses, not the whole list on every keystroke.
  const summary = !fresh ? "" : errors.length > 1 ? fill(t.errors, { count: errors.length }) : shown[0] ? issueText(t, shown[0]) : matched ? t.matched : ""

  return (
    <div data-slot="redirect-uri-input" className={cn("grid w-full max-w-md min-w-0 grid-cols-[minmax(0,1fr)] gap-1.5 text-sm", className)}>
      <label htmlFor={inputId} className="w-fit font-medium">{t.label}</label>
      <input
        ref={inputRef}
        id={inputId}
        value={uri}
        placeholder={t.placeholder}
        inputMode="url"
        autoCapitalize="none"
        autoCorrect="off"
        autoComplete="off"
        spellCheck={false}
        onChange={(e) => update(e.target.value)}
        onBlur={(e) => {
          setSettled(uri)
          onBlur?.(e)
        }}
        aria-invalid={errors.length > 0 || undefined}
        aria-describedby={[`${inputId}-status`, describedBy].filter(Boolean).join(" ")}
        className="h-9 w-full min-w-0 rounded-md border bg-transparent px-3 font-mono text-base shadow-xs transition-[color,box-shadow] outline-none placeholder:font-sans placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-destructive disabled:cursor-not-allowed disabled:opacity-50 md:text-sm dark:bg-input/30"
        {...props}
      />
      <span id={`${inputId}-status`} aria-live="polite" className="sr-only">{summary}</span>
      <div className="mt-1.5 grid min-h-6 gap-1.5 text-xs">
        {shown.map((issue, index) => {
          // Two issues can share a fix (http and the https it was registered as); offer the button once.
          const repeat = shown.findIndex((other) => other.fix === issue.fix) < index
          const Icon = issue.severity === "error" ? ShieldAlert : issue.severity === "warning" ? TriangleAlert : Info
          const parts = issue.registered ? diffParts(uri.trim().split("#")[0], issue.registered) : null
          return (
            <div key={issue.kind} data-severity={issue.severity} className={cn("flex gap-1.5", tone[issue.severity])}>
              <span className="flex h-6 shrink-0 items-center"><Icon aria-hidden className="size-3.5" /></span>
              <div className="grid min-w-0 flex-1 gap-1.5">
                <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="py-1">{issueText(t, issue)}</span>
                  {issue.fix !== undefined && !repeat && (
                    <button
                      type="button"
                      onClick={() => {
                        update(issue.fix as string, true)
                        inputRef.current?.focus()
                      }}
                      className={fixClass(issue.severity)}
                    >
                      <span className="truncate">{issue.kind === "mismatch" ? t.useRegistered : fill(t.use, { fix: issue.fix as string })}</span>
                    </button>
                  )}
                </span>
                {parts && (
                  <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-2 gap-y-0.5 rounded-md border bg-muted/40 px-2 py-1.5 font-mono text-foreground">
                    <dt className="text-muted-foreground">{t.yours}</dt>
                    <dd className="break-all">
                      {parts[0]}<Mark text={parts[1]} tone="red" />{parts[3]}
                    </dd>
                    <dt className="text-muted-foreground">{t.registeredLabel}</dt>
                    <dd className="break-all">
                      {parts[0]}<Mark text={parts[2]} tone="emerald" />{parts[3]}
                    </dd>
                  </dl>
                )}
              </div>
            </div>
          )
        })}
        {matched && !shown.length && (
          <p className="flex items-center gap-1.5 py-1 text-emerald-700 dark:text-emerald-400"><CircleCheck aria-hidden className="size-3.5" /> {t.matched}</p>
        )}
        {!shown.length && !matched && <p className="py-1 text-muted-foreground">{t.help}</p>}
      </div>
    </div>
  )
}

/** The differing characters; an empty difference renders as a caret so a missing "/" is still visible. */
function Mark({ text, tone }: { text: string; tone: "red" | "emerald" }) {
  if (!text) return <span aria-hidden className={cn("mx-px inline-block h-3.5 w-0.5 translate-y-0.5 rounded-full", tone === "red" ? "bg-red-500" : "bg-emerald-500")} />
  return (
    <mark className={cn("rounded-sm px-px", tone === "red" ? "bg-red-500/20 text-red-800 dark:text-red-200" : "bg-emerald-500/20 text-emerald-800 dark:text-emerald-200")}>
      {text}
    </mark>
  )
}
