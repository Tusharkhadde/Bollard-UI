"use client"

// Bollard UI — set-cookie-check · MIT licence · https://bollard-ui.vercel.app/components/set-cookie-check

import * as React from "react"
import { CircleAlert, CircleCheck, Cookie, Info, TriangleAlert, WandSparkles } from "lucide-react"

import { cn } from "@/lib/utils"
import { applyCookieEdits, checkCookies, formatLifetime, parseCookies, readCookie, type CookieIssue, type CookieReadback } from "@/registry/default/set-cookie-check/set-cookie"

export { applyCookieEdits, checkCookies, COOKIE_AGE_LIMIT, formatLifetime, parseCookieDate, parseCookieLine, parseCookies, readCookie, splitFoldedSetCookie, type CookieAttr, type CookieContext, type CookieEdit, type CookieIssue, type CookieIssueKind, type CookieReadback, type ParsedCookie } from "@/registry/default/set-cookie-check/set-cookie"

export const SET_COOKIE_CHECK_MESSAGES = {
  label: "Set-Cookie",
  from: "from {host}",
  placeholder: "Set-Cookie: sid=…; Secure; HttpOnly; SameSite=Lax; Path=/",
  clean: "No problems. Browsers will keep these cookies as written.",
  problems: "{errors} to fix · {warnings} to review",
  fixAll: "Fix {count}",
  cookie: "Cookie {name}",
  nameless: "(no name)",
  hostOnly: "Only {host}",
  thisHost: "Only the host that sets it",
  domain: "{domain} and every subdomain",
  secure: "HTTPS only",
  insecure: "Also sent over http",
  httpOnly: "Hidden from JavaScript",
  scriptable: "Readable by JavaScript",
  Strict: "Never sent cross-site",
  Lax: "Cross-site only on top-level links",
  None: "Sent on every cross-site request",
  default: "No SameSite: browsers pick (Lax in Chrome)",
  session: "Until the browser closes",
  delete: "Deletes the cookie",
  until: "Lasts {duration}, until {date}",
  lasts: "Lasts {duration}",
  untilExpires: "Until its Expires date",
  cappedFrom: " (capped from {requested})",
  partitioned: "Partitioned per top-level site",
  size: "{bytes} of 4096 bytes",
  "samesite-none-insecure": "SameSite=None without Secure: browsers reject this cookie outright.",
  "partitioned-insecure": "Partitioned without Secure: browsers reject this cookie outright.",
  "insecure-origin": "A Secure cookie can't be set from an http:// page, so this one is dropped.",
  "host-prefix": "__Host- cookies need Secure, Path=/ and no Domain. Missing: {detail}, so browsers reject it.",
  "secure-prefix": "__Secure- cookies need Secure, so browsers reject this one.",
  "too-big": "Name and value are {detail} bytes. Over 4096, browsers drop the whole cookie.",
  "domain-mismatch": "Domain={detail} isn't this host or a parent of it, so browsers reject the cookie.",
  "domain-public-suffix": "{detail} is a public suffix. Browsers refuse cookies scoped to it.",
  "domain-parent": "Domain={detail} shares this cookie with every subdomain, including ones you don't control or that host user content.",
  "domain-self": "Setting Domain={detail} still shares it with every subdomain. Leave Domain out to keep it on this host only.",
  "session-no-httponly": "Sign-in cookie readable by JavaScript: one XSS bug and it can be stolen.",
  "session-no-secure": "Sign-in cookie without Secure: it's sent over plain http to anyone who can watch the network.",
  "expires-conflict": "Max-Age ({detail}) and Expires disagree. Browsers follow Max-Age, so Expires is misleading.",
  "expires-invalid": "Browsers can't read Expires={detail} (it needs a month name, like Thu, 01 Jan 2026 00:00:00 GMT), so it's ignored and the cookie ends when the browser closes.",
  "max-age-invalid": "Max-Age={detail} isn't a whole number, so browsers ignore it.",
  capped: "Browsers cap cookies at 400 days, so this one lasts 400 days, not {detail}.",
  "bad-samesite": "SameSite={detail} isn't Strict, Lax or None, so browsers ignore it.",
  "bad-chars": "The value has a {detail}. Some servers and browsers cut it there; encode it.",
  "no-name": "No name=value pair, so browsers store a nameless cookie that other nameless ones overwrite.",
  "attr-too-big": "{detail} is over 1024 characters, so browsers ignore it.",
  typo: "Browsers don't know {from} and skip it.",
  "domain-dot": "The leading dot in Domain is ignored; it's the same as without it.",
  "path-relative": "Path={detail} doesn't start with /, so browsers use the default path instead.",
  deletes: "Max-Age or Expires is in the past, so this deletes the cookie.",
  "third-party": "Meant for cross-site embeds? Browsers that block third-party cookies drop it unless it's Partitioned (CHIPS).",
  "partitioned-samesite": "Partitioned only matters cross-site, which also needs SameSite=None.",
  "no-samesite": "No SameSite: Chrome treats it as Lax, other browsers may not. Say it explicitly.",
  "http-prefix": "__Http- and __Host-Http- cookies need Secure and HttpOnly. Missing: {detail}, so browsers reject it.",
  "nameless-prefix": "A cookie with no name whose value starts with __Secure-, __Host- or __Http- is rejected, so it can't fake a prefixed cookie.",
  "control-char": "Contains a control character ({detail}), so browsers ignore the whole Set-Cookie line.",
  folded: "{detail} cookies are joined with commas on one line. Browsers read only the first and fold the rest into its last attribute. Send one Set-Cookie per cookie.",
  overwritten: "Line {detail} sets the same cookie (name, Domain and Path), so this one is replaced before anything reads it.",
  "fix-samesite-none-insecure": "Add Secure",
  "fix-partitioned-insecure": "Add Secure",
  "fix-host-prefix": "Add what's missing",
  "fix-secure-prefix": "Add Secure",
  "fix-domain-mismatch": "Remove Domain",
  "fix-domain-public-suffix": "Remove Domain",
  "fix-domain-parent": "Keep it on this host",
  "fix-domain-self": "Remove Domain",
  "fix-session-no-httponly": "Add HttpOnly",
  "fix-session-no-secure": "Add Secure",
  "fix-expires-conflict": "Remove Expires",
  "fix-expires-invalid": "Fix the date",
  "fix-expires-invalid-remove": "Remove Expires",
  "fix-max-age-invalid": "Remove Max-Age",
  "fix-capped": "Use 400 days",
  "fix-bad-samesite": "Use Lax",
  "fix-bad-chars": "Encode the value",
  "fix-attr-too-big": "Remove it",
  "fix-typo": "Use {to}",
  "fix-domain-dot": "Drop the dot",
  "fix-path-relative": "Use Path=/",
  "fix-third-party": "Add Partitioned",
  "fix-partitioned-samesite": "Add SameSite=None",
  "fix-no-samesite": "Add SameSite=Lax",
  "fix-http-prefix": "Add what's missing",
  "fix-control-char": "Encode the value",
  "fix-folded": "Split into lines",
  "fix-overwritten": "Remove this line",
}
export type SetCookieCheckMessages = typeof SET_COOKIE_CHECK_MESSAGES

const fill = (text: string, values: Record<string, string | number>) => text.replace(/\{(\w+)\}/g, (match, key: string) => String(values[key] ?? match))
const tones = { error: "text-red-700 dark:text-red-400", warning: "text-amber-700 dark:text-amber-400", info: "text-muted-foreground" }
const icons = { error: CircleAlert, warning: TriangleAlert, info: Info }
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

export interface SetCookieCheckProps extends Omit<React.ComponentProps<"textarea">, "value" | "defaultValue" | "onChange"> {
  /** Controlled text: one Set-Cookie per line, with or without the "Set-Cookie:" prefix. */
  value?: string
  /** Initial text when uncontrolled. */
  defaultValue?: string
  /** Called with the new text on every edit or fix. */
  onValueChange?: (value: string) => void
  /** Host that sends the header, e.g. "app.acme.com". Enables Domain checks. */
  host?: string
  /** The response is served over https (default true). */
  https?: boolean
  /** Clock in ms for Expires and the 400-day cap. Defaults to the time the component mounted. */
  now?: number
  /** Cookie names treated as sign-in sessions. */
  sessionPattern?: RegExp
  /** Locale for dates in the readback (default "en-US", always in UTC). */
  locale?: string
  /** Visible label; shorthand for `messages.label`. */
  label?: string
  /** Every visible string. `{name}`, `{host}`, `{domain}`, `{duration}`, `{date}`, `{detail}`, `{from}`, `{to}`, `{count}`, `{requested}` are filled in. */
  messages?: Partial<SetCookieCheckMessages>
}

/**
 * A Set-Cookie checker that reads back what the browser will really do with
 * each cookie (who gets it, over what, for how long, cross-site or not) and
 * catches the mistakes that get it rejected or stolen: SameSite=None or
 * Partitioned without Secure, broken __Host-/__Secure- prefixes, a Domain that
 * shares a sign-in cookie with every subdomain, a missing HttpOnly, Expires
 * and Max-Age that disagree, the 4096-byte limit and the 400-day cap.
 */
export function SetCookieCheck({
  value,
  defaultValue = "",
  onValueChange,
  host,
  https = true,
  now,
  sessionPattern,
  locale = "en-US",
  label,
  messages,
  rows = 4,
  id,
  className,
  ref,
  "aria-describedby": describedBy,
  ...props
}: SetCookieCheckProps) {
  const t = { ...SET_COOKIE_CHECK_MESSAGES, ...messages, ...(label !== undefined && { label }) }
  const [inner, setInner] = React.useState(defaultValue)
  const [mounted, setMounted] = React.useState<number>()
  React.useEffect(() => setMounted(Date.now()), [])
  const textarea = React.useRef<HTMLTextAreaElement>(null)
  const list = React.useRef<HTMLDivElement>(null)
  const refocus = React.useRef<number | null>(null)
  const autoId = React.useId()
  const inputId = id ?? autoId
  const text = value ?? inner
  React.useImperativeHandle(ref, () => textarea.current as HTMLTextAreaElement)

  const context = React.useMemo(() => ({ host, https, now: now ?? mounted, sessionPattern }), [host, https, now, mounted, sessionPattern])
  const cookies = React.useMemo(() => parseCookies(text).map((cookie) => ({ cookie, read: readCookie(cookie, context) })), [text, context])
  const issues = React.useMemo(() => checkCookies(text, context), [text, context])
  const counted = issues.filter((issue) => issue.severity !== "info")
  const errors = counted.filter((issue) => issue.severity === "error").length
  const fixable = counted.filter((issue) => issue.fix)
  const summary = !text.trim() ? "" : counted.length ? fill(t.problems, { errors, warnings: counted.length - errors }) : t.clean
  const announced = useSettled(summary)
  const kinds = (line: number) => new Set(issues.filter((issue) => issue.line === line && issue.severity !== "info").map((issue) => issue.kind))

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
  const fix = (issue: CookieIssue, button: HTMLElement) => {
    refocus.current = [...(list.current?.querySelectorAll("button[data-fix]") ?? [])].indexOf(button)
    update(applyCookieEdits(text, issue.line, issue.fix ?? []))
  }
  const fixAll = () => {
    // Fixes can touch the same attribute, so apply one, re-check, repeat.
    let next = text
    for (let round = 0; round < 40; round++) {
      const first = checkCookies(next, context).find((issue) => issue.severity !== "info" && issue.fix)
      const applied = first ? applyCookieEdits(next, first.line, first.fix ?? []) : next
      if (applied === next) break
      next = applied
    }
    refocus.current = 0
    update(next)
  }

  const date = (ms: number) => new Date(ms).toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })
  const facts = (read: CookieReadback, line: number) => {
    const bad = kinds(line)
    const life = read.lifetime
    const lasts =
      life.kind === "session" ? t.session
      : life.kind === "delete" ? t.delete
      : life.kind === "until" ? fill(t.until, { duration: formatLifetime((life.at - (context.now ?? life.at)) / 1000), date: date(life.at) })
      : Number.isFinite(life.seconds) ? fill(t.lasts, { duration: formatLifetime(life.seconds) })
      : t.untilExpires
    const capped = (life.kind === "until" || life.kind === "unknown") && life.capped ? fill(t.cappedFrom, { requested: formatLifetime(life.requestedSeconds) }) : ""
    return [
      { text: read.scope === "host" ? (read.domain ? fill(t.hostOnly, { host: read.domain }) : t.thisHost) : fill(t.domain, { domain: read.domain ?? "" }), bad: bad.has("domain-parent") || bad.has("domain-self") || bad.has("domain-mismatch") || bad.has("domain-public-suffix") },
      { text: read.secure ? t.secure : t.insecure, bad: !read.secure && (bad.has("session-no-secure") || bad.has("samesite-none-insecure")) },
      { text: read.httpOnly ? t.httpOnly : t.scriptable, bad: bad.has("session-no-httponly") },
      { text: t[read.sameSite], bad: false },
      { text: lasts + capped, bad: capped !== "" },
      ...(read.partitioned ? [{ text: t.partitioned, bad: false }] : []),
      ...(read.bytes > 3072 ? [{ text: fill(t.size, { bytes: read.bytes }), bad: read.bytes > 4096 }] : []),
    ]
  }

  return (
    <div data-slot="set-cookie-check" className={cn("grid w-full max-w-xl min-w-0 grid-cols-[minmax(0,1fr)] gap-1.5 text-sm", className)}>
      <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
        <label htmlFor={inputId} className="font-mono font-medium">
          {t.label}
        </label>
        {host && <span className="rounded-md border px-1.5 py-0.5 font-mono text-xs text-muted-foreground">{fill(t.from, { host })}</span>}
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
        placeholder={t.placeholder}
        aria-invalid={errors > 0 || undefined}
        aria-describedby={[describedBy, `${inputId}-status`].filter(Boolean).join(" ")}
        className="w-full min-w-0 resize-y rounded-md border bg-transparent px-3 py-2 font-mono text-base leading-5 break-all shadow-xs transition-[color,box-shadow] outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-destructive md:text-xs dark:bg-input/30"
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
            {fill(t.fixAll, { count: fixable.length })}
          </button>
        )}
      </div>
      <div ref={list} className="grid gap-2">
        {cookies.map(({ cookie, read }) => {
          const own = issues.filter((issue) => issue.line === cookie.line)
          const name = cookie.name || t.nameless
          return (
            <section key={cookie.line} aria-label={fill(t.cookie, { name })} className="grid min-w-0 gap-2 rounded-md border p-3 text-xs">
              <h3 className="flex min-w-0 items-center gap-1.5 font-mono text-sm font-medium">
                <Cookie aria-hidden className="size-3.5 shrink-0 text-muted-foreground" />
                <span className="truncate">{name}</span>
              </h3>
              <ul className="flex flex-wrap gap-1.5">
                {facts(read, cookie.line).map((fact) => (
                  <li key={fact.text} className={cn("rounded-md border px-1.5 py-0.5", fact.bad ? "border-red-500/40 bg-red-500/5 text-red-700 dark:text-red-300" : "bg-muted/40 text-muted-foreground")}>
                    {fact.text}
                  </li>
                ))}
              </ul>
              {own.length > 0 && (
                <ul className="grid gap-1.5">
                  {own.map((issue) => {
                    const Icon = icons[issue.severity]
                    const [from, to] = (issue.detail ?? "").split("→")
                    const fixKey = `fix-${issue.kind}${issue.kind === "expires-invalid" && issue.fix?.[0]?.op === "remove" ? "-remove" : ""}` as keyof SetCookieCheckMessages
                    const action = fill(t[fixKey] ?? "", { to: to ?? "" })
                    return (
                      <li key={`${issue.kind}-${issue.detail ?? ""}`} className={cn("flex gap-1.5", tones[issue.severity])}>
                        <span className="flex h-6 shrink-0 items-center">
                          <Icon aria-hidden className="size-3.5" />
                        </span>
                        <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                          <span className="py-1 [overflow-wrap:anywhere]">{fill(t[issue.kind], { detail: issue.detail ?? "", from, to: to ?? "" })}</span>
                          {issue.fix && (
                            <button type="button" data-fix="" aria-label={`${action}: ${name}`} onClick={(event) => fix(issue, event.currentTarget)} className={fixClass(issue.severity === "error")}>
                              {action}
                            </button>
                          )}
                        </span>
                      </li>
                    )
                  })}
                </ul>
              )}
            </section>
          )
        })}
      </div>
    </div>
  )
}
