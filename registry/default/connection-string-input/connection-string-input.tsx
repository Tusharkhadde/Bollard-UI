"use client"

// Bollard UI — connection-string-input · MIT licence · https://bollard-ui.vercel.app/components/connection-string-input

import * as React from "react"
import { Check, CircleAlert, CircleCheck, Copy, Database, Eye, EyeOff, Info, TriangleAlert } from "lucide-react"

import { cn } from "@/lib/utils"
import { checkConnectionString, maskConnectionString, parseConnectionString, safeDecode, type ConnectionFix, type ConnectionIssue, type DbEnvironment } from "@/registry/default/connection-string-input/connection-string"

export { checkConnectionString, cleanConnectionString, editDistance, encodePassword, maskConnectionString, parseConnectionString, safeDecode, strictHost, type ConnectionFix, type ConnectionIssue, type ConnectionIssueKind, type DbEnvironment, type DbFamily, type ParsedConnection } from "@/registry/default/connection-string-input/connection-string"

export const CONNECTION_STRING_INPUT_MESSAGES = {
  label: "Database URL",
  placeholder: "postgresql://user:password@host:5432/database?sslmode=verify-full",
  readback: "What the driver connects to",
  user: "User",
  password: "Password",
  host: "Host",
  database: "Database",
  tls: "Encryption",
  none: "None",
  passwordRead: "{count} characters, hidden",
  noPassword: "None in the URL",
  show: "Show password",
  hide: "Hide password",
  copy: "Copy without password",
  copied: "Copied with the password masked",
  defaultDb: "Same as the user name",
  clean: "Looks right for {environment}.",
  toFix: "{count} to fix",
  toReview: "{count} to review",
  production: "production",
  staging: "staging",
  development: "development",
  "tls-verify-full": "TLS, certificate and host name checked",
  "tls-verify-ca": "TLS, certificate checked but not the host name",
  "tls-require": "TLS, certificate not checked",
  "tls-prefer": "Tries TLS, falls back to unencrypted",
  "tls-allow": "Unencrypted unless the server insists",
  "tls-disable": "Unencrypted",
  "tls-default": "Not set: libpq uses prefer (falls back to unencrypted)",
  "tls-system": "TLS, certificate and host name checked (sslrootcert=system)",
  "tls-on": "TLS",
  "tls-off": "Unencrypted",
  "pasted-wrapper": "Quotes, a KEY= prefix or line breaks came along with the paste. Drivers read them as part of the URL.",
  "not-a-url": "This isn't a connection URL. It should start with something like postgresql://.",
  jdbc: "That's a JDBC URL. Node, Python and Go drivers want it without jdbc:, and JDBC puts the user and password in ?user= and ?password=.",
  "scheme-typo": "{scheme}:// isn't a database scheme, so the driver refuses it. Did you mean {guess}://?",
  "unknown-scheme": "{scheme}:// isn't one this field knows, so only the password and host are checked.",
  "password-at": "The password has an @ that isn't encoded. Parsers that split at the first @ (libpq, psql) try to connect to “{host}”. Needs encoding: {chars}",
  "password-hash": "The password has a #, and URL parsers treat everything after # as a fragment, so the password is cut short. Needs encoding: {chars}",
  "password-ends-early": "The password has a {chars} that isn't encoded, so URL parsers end the host there and the connection fails.",
  "bad-percent": "The password has a % that isn't followed by two hex digits, so drivers fail to decode it (URIError: URI malformed).",
  "password-colon": "The password has a : that isn't encoded. Most drivers still read it right, but encode it as %3A so every one does.",
  "password-space": "The password has a space. Encode it so no driver trims or splits it.",
  "localhost-prod": "{host} in production points at the app's own server or container, not your database.",
  "no-host": "No host, so libpq connects through a local Unix socket instead of the network.",
  "bad-port": "Port “{port}” isn't a number.",
  "wrong-port": "Port {port} is {owner}'s default. Is this the right server?",
  "srv-port": "mongodb+srv:// URLs can't have a port; the driver looks the ports up in DNS and rejects this one.",
  "srv-hosts": "mongodb+srv:// takes exactly one host name (the DNS seed), so drivers reject these {count}. List several hosts with mongodb:// instead.",
  "rootcert-system-mode": "With sslrootcert=system, libpq only accepts sslmode=verify-full, so sslmode={mode} fails to connect.",
  "mongo-password-colon": "The password has a : that isn't encoded. MongoDB drivers reject a second colon in the user info, so encode it as %3A.",
  "no-database": "No database name, so Postgres connects to one named after the user ({user}).",
  "no-sslmode": "No sslmode, so libpq uses prefer: it falls back to an unencrypted connection and never checks the certificate.",
  "weak-sslmode": "sslmode={mode} in production can send the password and data unencrypted.",
  "bad-sslmode": "sslmode={mode} isn't valid, so libpq refuses to connect. It takes disable, allow, prefer, require, verify-ca or verify-full.",
  "unknown-param": "libpq refuses ?{key}= as an invalid parameter (other drivers may ignore it). Parameter names are case-sensitive, and only ssl=true is accepted as a JDBC alias.",
  "redis-plain": "redis:// is unencrypted. Managed Redis outside your network needs rediss://.",
  "mongo-no-tls": "This MongoDB URL connects without TLS. mongodb:// needs tls=true; mongodb+srv:// turns TLS on unless tls=false.",
  "fix-pasted-wrapper": "Clean it",
  "fix-jdbc": "Remove jdbc:",
  "fix-encode": "Encode the password",
  "fix-drop-port": "Remove the port",
  "fix-use": "Use {value}",
}
export type ConnectionStringInputMessages = typeof CONNECTION_STRING_INPUT_MESSAGES

const fill = (text: string, values: Record<string, string | number>) => text.replace(/\{(\w+)\}/g, (match, key: string) => String(values[key] ?? match))
const tones = { error: "text-red-700 dark:text-red-400", warning: "text-amber-700 dark:text-amber-400", info: "text-muted-foreground" }
const icons = { error: CircleAlert, warning: TriangleAlert, info: Info }
const fixClass = (error: boolean) =>
  cn(
    "inline-flex min-h-6 items-center rounded-md border px-2 font-medium transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
    error ? "border-red-500/40 text-red-800 hover:bg-red-500/10 dark:text-red-200" : "border-amber-500/40 text-amber-900 hover:bg-amber-500/10 dark:text-amber-200",
  )
const iconButton = "grid size-6 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"

function useSettled(text: string, delay = 900) {
  const [settled, setSettled] = React.useState(text)
  React.useEffect(() => {
    const timer = setTimeout(() => setSettled(text), delay)
    return () => clearTimeout(timer)
  }, [text, delay])
  return settled
}

export interface ConnectionStringInputProps extends Omit<React.ComponentProps<"input">, "value" | "defaultValue" | "onChange"> {
  /** Controlled connection URL. */
  value?: string
  /** Initial connection URL when uncontrolled. */
  defaultValue?: string
  /** Called with the text on every edit or fix. */
  onValueChange?: (value: string) => void
  /** Where this URL will be used. Production turns localhost and missing TLS into problems. */
  environment?: DbEnvironment
  /** Visible label; shorthand for `messages.label`. */
  label?: string
  /** Every visible string. `{host}`, `{chars}`, `{mode}` and the other placeholders are filled in. */
  messages?: Partial<ConnectionStringInputMessages>
  /** Form field name. The real (unmasked) URL is submitted through a hidden input, since the visible one is masked when blurred. */
  name?: string
}

/**
 * A database URL field that masks the password whenever it isn't being
 * edited and catches what breaks or weakens the connection: an unencoded
 * @, #, / or % in the password (with the host a strict parser would really
 * try), localhost in production, a missing or invalid sslmode, a port that
 * belongs to another database, and quotes or KEY= dragged in from a .env file.
 */
export function ConnectionStringInput({ value, defaultValue = "", onValueChange, environment = "production", label, messages, id, className, onFocus, onBlur, ref, name, form, "aria-describedby": describedBy, ...props }: ConnectionStringInputProps) {
  const t = { ...CONNECTION_STRING_INPUT_MESSAGES, ...messages, ...(label !== undefined && { label }) }
  const [inner, setInner] = React.useState(defaultValue)
  const text = String(value ?? inner ?? "")
  const [editing, setEditing] = React.useState(false)
  const [revealed, setRevealed] = React.useState(false)
  const [copied, setCopied] = React.useState(false)
  const input = React.useRef<HTMLInputElement>(null)
  const list = React.useRef<HTMLUListElement>(null)
  const refocus = React.useRef<number | null>(null)
  const autoId = React.useId()
  const inputId = id ?? autoId
  React.useImperativeHandle(ref, () => input.current as HTMLInputElement)

  const update = (next: string) => {
    if (value === undefined) setInner(next)
    onValueChange?.(next)
  }
  const issues = React.useMemo(() => checkConnectionString(text, environment), [text, environment])
  const parsed = React.useMemo(() => parseConnectionString(text), [text])
  const errors = issues.filter((issue) => issue.severity === "error").length
  const counted = issues.filter((issue) => issue.severity !== "info").length
  const summary = !text.trim() ? "" : counted ? [errors && fill(t.toFix, { count: errors }), counted - errors && fill(t.toReview, { count: counted - errors })].filter(Boolean).join(" · ") : fill(t.clean, { environment: t[environment] })
  const announced = useSettled(summary)
  const shown = editing || revealed ? text : maskConnectionString(text)

  React.useEffect(() => {
    if (refocus.current === null) return
    const buttons = list.current?.querySelectorAll<HTMLButtonElement>("button[data-fix]") ?? []
    ;(buttons[Math.min(refocus.current, buttons.length - 1)] ?? input.current)?.focus()
    refocus.current = null
  }, [text])
  React.useEffect(() => {
    if (!copied) return
    const timer = setTimeout(() => setCopied(false), 2000)
    return () => clearTimeout(timer)
  }, [copied])

  const fix = (next: ConnectionFix, button: HTMLElement) => {
    refocus.current = [...(list.current?.querySelectorAll("button[data-fix]") ?? [])].indexOf(button)
    update(next.next)
  }
  const copyMasked = async () => {
    try {
      await navigator.clipboard.writeText(maskConnectionString(text))
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }
  const message = (issue: ConnectionIssue) => fill(t[issue.kind], issue.detail)

  const param = (name: string) => parsed?.params.find(([key]) => key.toLowerCase() === name)?.[1]
  const sslmode = param("sslmode")
  const mongoOff = param("tls") === "false" || param("ssl") === "false"
  const tls = !parsed
    ? ""
    : parsed.family === "postgres"
      ? sslmode && `tls-${sslmode}` in t
        ? t[`tls-${sslmode}` as keyof ConnectionStringInputMessages]
        : param("sslrootcert") === "system"
          ? t["tls-system"]
          : param("ssl") === "true"
            ? t["tls-require"]
            : t["tls-default"]
      : parsed.scheme === "rediss" || (parsed.scheme === "mongodb+srv" && !mongoOff) || param("tls") === "true" || param("ssl") === "true"
        ? t["tls-on"]
        : parsed.family === "redis" || parsed.family === "mongodb"
          ? t["tls-off"]
          : ""
  const password = parsed?.hasPassword ? (safeDecode(parsed.rawPassword) ?? parsed.rawPassword) : ""
  const rows: [string, React.ReactNode][] = parsed
    ? [
        [t.user, safeDecode(parsed.user) ?? parsed.user],
        [t.password, parsed.hasPassword ? (revealed ? password : fill(t.passwordRead, { count: [...password].length })) : t.noPassword],
        [t.host, parsed.hosts.map(({ host, port }) => (port ? `${host}:${port}` : host)).join(", ") || t.none],
        [t.database, parsed.database ? (safeDecode(parsed.database) ?? parsed.database) : parsed.family === "postgres" ? t.defaultDb : t.none],
        ...(tls ? ([[t.tls, tls]] as [string, string][]) : []),
      ]
    : []

  return (
    <div data-slot="connection-string-input" className={cn("grid w-full max-w-xl min-w-0 grid-cols-[minmax(0,1fr)] gap-1.5 text-sm", className)}>
      <label htmlFor={inputId} className="flex w-fit items-center gap-1.5 font-medium">
        <Database aria-hidden className="size-4 text-muted-foreground" />
        {t.label}
      </label>
      <input
        ref={input}
        id={inputId}
        value={shown}
        onChange={(event) => update(event.target.value)}
        onFocus={(event) => {
          const el = event.currentTarget
          const maskFrom = parsed?.passwordRange ? Math.max(0, text.indexOf(parsed.clean)) + parsed.passwordRange[0] : Infinity
          const caret = el.selectionStart ?? el.value.length
          const all = el.value !== "" && el.selectionStart === 0 && el.selectionEnd === el.value.length
          // Swap in the real text right away (not on the next render), keeping a tab-in "select all" so a paste replaces
          // instead of appending. A caret before the password keeps its spot; one inside or after it goes to the end.
          if (el.value !== text) {
            el.value = text
            if (all) el.select()
            else if (caret <= maskFrom) el.setSelectionRange(caret, caret)
          }
          setEditing(true)
          onFocus?.(event)
        }}
        onBlur={(event) => {
          setEditing(false)
          onBlur?.(event)
        }}
        placeholder={t.placeholder}
        spellCheck={false}
        autoCapitalize="none"
        autoCorrect="off"
        autoComplete="off"
        data-1p-ignore=""
        data-lpignore="true"
        aria-invalid={errors > 0 || undefined}
        aria-describedby={[describedBy, `${inputId}-status`].filter(Boolean).join(" ")}
        className="h-9 w-full min-w-0 rounded-md border bg-transparent px-3 font-mono text-base shadow-xs transition-[color,box-shadow] outline-none placeholder:font-sans placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-destructive md:text-xs dark:bg-input/30"
        {...props}
      />
      {/* The visible field shows a masked password when blurred, so forms get the real value from here. */}
      {name && <input type="hidden" name={name} form={form} value={text} />}
      <span role="status" className="sr-only">
        {announced}
      </span>
      {parsed && (
        <section aria-labelledby={`${inputId}-readback`} className="mt-1.5 grid gap-1.5 rounded-md border bg-muted/40 p-3 text-xs">
          <div className="flex items-center justify-between gap-2">
            <h3 id={`${inputId}-readback`} className="font-medium text-muted-foreground">
              {t.readback}
            </h3>
            <button type="button" onClick={copyMasked} className="inline-flex h-6 items-center gap-1 rounded-md px-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50">
              {copied ? <Check aria-hidden className="size-3.5" /> : <Copy aria-hidden className="size-3.5" />}
              <span aria-live="polite">{copied ? t.copied : t.copy}</span>
            </button>
          </div>
          <dl className="grid grid-cols-[minmax(0,5.5rem)_minmax(0,1fr)] gap-x-2 gap-y-1">
            {rows.map(([name, read]) => (
              <React.Fragment key={name}>
                <dt className="text-muted-foreground">{name}</dt>
                <dd className={cn("flex min-w-0 items-center gap-1", name === t.tls || (name === t.password && !revealed) || (name === t.database && !parsed.database) ? "" : "font-mono break-all")}>
                  <span className="min-w-0">{read}</span>
                  {name === t.password && parsed.hasPassword && (
                    <button type="button" onClick={() => setRevealed((open) => !open)} aria-pressed={revealed} aria-label={revealed ? t.hide : t.show} title={revealed ? t.hide : t.show} className={iconButton}>
                      {revealed ? <EyeOff aria-hidden className="size-3.5" /> : <Eye aria-hidden className="size-3.5" />}
                    </button>
                  )}
                </dd>
              </React.Fragment>
            ))}
          </dl>
        </section>
      )}
      <div id={`${inputId}-status`} className="mt-1.5 grid gap-1.5 text-xs">
        {summary && (
          <span className={cn("flex items-center gap-1.5", counted ? "text-muted-foreground" : "text-emerald-700 dark:text-emerald-400")}>
            {counted ? <TriangleAlert aria-hidden className={cn("size-3.5", errors ? "text-red-600 dark:text-red-400" : "text-amber-600 dark:text-amber-400")} /> : <CircleCheck aria-hidden className="size-3.5" />}
            {summary}
          </span>
        )}
        {issues.length > 0 && (
          <ul ref={list} className="grid gap-1.5">
            {issues.map((issue, index) => {
              const Icon = icons[issue.severity]
              return (
                <li key={`${issue.kind}-${index}`} className={cn("flex gap-1.5", tones[issue.severity])}>
                  <span className="flex h-6 shrink-0 items-center">
                    <Icon aria-hidden className="size-3.5" />
                  </span>
                  <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="py-1 [overflow-wrap:anywhere]">{message(issue)}</span>
                    {issue.fixes.map((next) => (
                      <button key={next.next} type="button" data-fix="" onClick={(event) => fix(next, event.currentTarget)} className={fixClass(issue.severity === "error")}>
                        {fill(t[next.label as keyof ConnectionStringInputMessages] ?? next.label, next.detail ?? {})}
                      </button>
                    ))}
                  </span>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
