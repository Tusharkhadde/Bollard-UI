"use client"

import * as React from "react"
import { CircleAlert, CircleCheck, Globe, Info, RotateCcwKey, TriangleAlert, WandSparkles, X } from "lucide-react"

import { cn } from "@/lib/utils"
import { renameEnvKey, scanPublicEnv, type EnvFramework, type PublicEnvEntry } from "@/registry/default/public-env-guard/scan-public-env"

export { jwtClaims, parseEnvText, publicPrefix, renameEnvKey, scanPublicEnv, PUBLIC_PREFIXES, type EnvFramework, type PublicEnvEntry, type PublicEnvIssue, type PublicEnvIssueKind } from "@/registry/default/public-env-guard/scan-public-env"

const DEFAULT_MESSAGES = {
  label: "Environment variables",
  placeholder: "Paste your .env here\nNEXT_PUBLIC_API_URL=https://…",
  bundleHeading: "Ships to the browser",
  bundleEmpty: "No variable here reaches the browser.",
  serverOnly: "{count} stay on the server",
  clean: "No secrets in the browser bundle.",
  problems: "{errors} to move off the client · {warnings} to check",
  "secret-value": "This {shape} would be inlined into every visitor's JavaScript. Read it in server code instead.",
  "service-role": "A Supabase service_role key bypasses row-level security. It must never reach the browser.",
  "url-credentials": "This URL carries a username and password, and every visitor would get them.",
  "secret-name": "The name says secret, and {prefix} puts it in the client bundle.",
  "high-entropy": "This looks like a credential. Anything behind {prefix} is readable in DevTools.",
  "dead-prefix": "{framework} doesn't expose {prefix}, so client code reads undefined.",
  "misleading-prefix": "Safe today, since {framework} doesn't expose {prefix}, but the name invites someone to make it public.",
  "google-key": "Google keys may be public, but restrict this one by referrer so nobody can run up your bill.",
  duplicate: "{fix} is already set for the server, so this public copy can go.",
  rename: "Rename to {fix}",
  remove: "Remove public copy",
  keepPublic: "It's public",
  fixAll: "Move {count} to server",
  rotate: "Moved {key} off the client. If it was ever deployed, rotate it: old builds still contain the value.",
  dismiss: "Dismiss",
  masked: "hidden",
  auto: "any framework",
  next: "Next.js",
  vite: "Vite",
  cra: "Create React App",
  expo: "Expo",
  sveltekit: "SvelteKit",
  astro: "Astro",
  nuxt: "Nuxt",
}
export type PublicEnvGuardMessages = typeof DEFAULT_MESSAGES

const fill = (text: string, values: Record<string, string | number>) => text.replace(/\{(\w+)\}/g, (match, key: string) => String(values[key] ?? match))
const mask = (value: string) => (value.length <= 8 ? "•".repeat(value.length) : `${value.slice(0, 4)}••••${value.slice(-2)}`)
const tones = {
  error: "text-red-700 dark:text-red-400",
  warning: "text-amber-700 dark:text-amber-400",
  info: "text-muted-foreground",
}
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

export interface PublicEnvGuardProps extends Omit<React.ComponentProps<"textarea">, "value" | "defaultValue" | "onChange"> {
  /** Controlled .env text. */
  value?: string
  /** Initial text when uncontrolled. */
  defaultValue?: string
  /** Called with the new text on every edit or fix. */
  onValueChange?: (value: string) => void
  /** Which bundler reads this file. Decides which prefixes are public; "auto" treats every known prefix as public. */
  framework?: EnvFramework
  /** Keys you've confirmed are meant to be public, so they're never flagged. */
  publicKeys?: string[]
  /** Called when the user marks a flagged key as public. */
  onMarkPublic?: (key: string) => void
  /** Called after a key is moved off the client, so you can open a rotation task. */
  onMoveToServer?: (from: string, to: string | null) => void
  /** Visible label; shorthand for `messages.label`. */
  label?: string
  /** Every visible string. `{key}`, `{fix}`, `{prefix}`, `{shape}`, `{framework}`, `{count}` are filled in. */
  messages?: Partial<PublicEnvGuardMessages>
}

/**
 * A .env field that shows exactly what a client prefix (NEXT_PUBLIC_, VITE_,
 * REACT_APP_, EXPO_PUBLIC_, PUBLIC_, NUXT_PUBLIC_) will inline into the
 * browser bundle, and catches secrets that would ship with it: known key
 * shapes, Supabase service_role JWTs, passwords in URLs, secret-sounding names
 * and high-entropy strings. One tap renames a key to server-only (or drops the
 * public copy when the server name already exists) and reminds you to rotate.
 */
export function PublicEnvGuard({
  value,
  defaultValue = "",
  onValueChange,
  framework = "auto",
  publicKeys = [],
  onMarkPublic,
  onMoveToServer,
  label,
  messages,
  rows = 6,
  id,
  className,
  ref,
  "aria-describedby": describedBy,
  ...props
}: PublicEnvGuardProps) {
  const t = { ...DEFAULT_MESSAGES, ...messages, ...(label !== undefined && { label }) }
  const [inner, setInner] = React.useState(defaultValue)
  const [markedPublic, setMarkedPublic] = React.useState<string[]>([])
  const [moved, setMoved] = React.useState<string[]>([])
  const textarea = React.useRef<HTMLTextAreaElement>(null)
  const list = React.useRef<HTMLUListElement>(null)
  const refocus = React.useRef<number | null>(null)
  const autoId = React.useId()
  const inputId = id ?? autoId
  const text = value ?? inner
  React.useImperativeHandle(ref, () => textarea.current as HTMLTextAreaElement)

  const entries = React.useMemo(() => scanPublicEnv(text, framework, [...publicKeys, ...markedPublic]), [text, framework, publicKeys, markedPublic])
  const exposed = entries.filter((entry) => entry.prefix || entry.issue)
  const issues = exposed.flatMap((entry) => (entry.issue && entry.issue.severity !== "info" ? [entry.issue] : []))
  const errors = issues.filter((issue) => issue.severity === "error").length
  const movable = exposed.filter((entry) => entry.issue?.severity === "error" && entry.issue.fix !== undefined)
  const summary = !entries.length ? "" : issues.length ? fill(t.problems, { errors, warnings: issues.length - errors }) : t.clean
  const announced = useSettled(summary)
  const frameworkName = t[framework]

  const update = (next: string) => {
    if (value === undefined) setInner(next)
    onValueChange?.(next)
  }
  // The tapped button disappears with its issue, so focus moves to the next fix (or the field) instead of the page.
  React.useEffect(() => {
    if (refocus.current === null) return
    const buttons = list.current?.querySelectorAll<HTMLButtonElement>("button[data-fix]") ?? []
    ;(buttons[Math.min(refocus.current, buttons.length - 1)] ?? textarea.current)?.focus()
    refocus.current = null
  }, [text, markedPublic])
  const fixIndex = (button: HTMLElement) => [...(list.current?.querySelectorAll("button[data-fix]") ?? [])].indexOf(button)
  const move = (targets: PublicEnvEntry[]) => {
    // Apply bottom-up so earlier line numbers stay valid when a public copy is deleted.
    const next = [...targets].sort((a, b) => b.line - a.line).reduce((acc, entry) => renameEnvKey(acc, entry, entry.issue?.fix ?? null), text)
    update(next)
    setMoved((prev) => [...new Set([...prev, ...targets.map((entry) => entry.key)])])
    targets.forEach((entry) => onMoveToServer?.(entry.key, entry.issue?.fix ?? null))
  }

  return (
    <div data-slot="public-env-guard" className={cn("grid w-full grid-cols-[minmax(0,1fr)] max-w-xl min-w-0 gap-1.5 text-sm", className)}>
      <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
        <label htmlFor={inputId} className="font-medium">
          {t.label}
        </label>
        <span className="rounded-md border px-1.5 py-0.5 font-mono text-xs text-muted-foreground">{frameworkName}</span>
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
          <span className={cn("flex items-center gap-1.5", issues.length ? "text-muted-foreground" : "text-emerald-700 dark:text-emerald-400")}>
            {issues.length ? <TriangleAlert aria-hidden className="size-3.5 text-amber-600 dark:text-amber-400" /> : <CircleCheck aria-hidden className="size-3.5" />}
            {summary}
          </span>
        )}
        {movable.length > 1 && (
          <button type="button" onClick={() => {
              refocus.current = 0
              move(movable)
            }} className={fixClass(true)}>
            <WandSparkles aria-hidden className="size-3.5" />
            {fill(t.fixAll, { count: movable.length })}
          </button>
        )}
      </div>
      {/* The live region stays mounted so the rotate reminder is announced when it appears. */}
      <div aria-live="polite" className="empty:hidden">
        {moved.length > 0 && (
          <p className="flex items-start gap-1.5 rounded-md border border-amber-500/40 bg-amber-500/5 px-2 py-1.5 text-xs text-amber-900 dark:text-amber-200">
            <RotateCcwKey aria-hidden className="mt-0.5 size-3.5 shrink-0" />
            <span className="min-w-0 flex-1 [overflow-wrap:anywhere]">{fill(t.rotate, { key: moved.join(", ") })}</span>
            <button type="button" aria-label={t.dismiss} onClick={() => {
                setMoved([])
                textarea.current?.focus()
              }} className="grid size-5 shrink-0 place-items-center rounded-sm outline-none hover:bg-foreground/10 focus-visible:ring-[3px] focus-visible:ring-ring/50">
              <X aria-hidden className="size-3" />
            </button>
          </p>
        )}
      </div>
      {entries.length > 0 && (
        <section aria-labelledby={`${inputId}-bundle`} className="mt-1 overflow-hidden rounded-md border">
          <h3 id={`${inputId}-bundle`} className="flex items-center gap-1.5 border-b bg-muted/50 px-2 py-1.5 text-xs font-medium">
            <Globe aria-hidden className="size-3.5 text-muted-foreground" />
            {t.bundleHeading}
            <span className="ml-auto font-normal text-muted-foreground">{fill(t.serverOnly, { count: entries.length - exposed.length })}</span>
          </h3>
          {exposed.length === 0 ? (
            <p className="px-2 py-2 text-xs text-muted-foreground">{t.bundleEmpty}</p>
          ) : (
            <ul ref={list} className="divide-y text-xs">
              {exposed.map((entry) => {
                const issue = entry.issue
                const hidden = issue && issue.kind !== "dead-prefix" && issue.kind !== "google-key"
                const Icon = issue?.severity === "error" ? CircleAlert : issue?.severity === "warning" ? TriangleAlert : Info
                return (
                  <li key={entry.line} data-severity={issue?.severity} className="grid gap-1 px-2 py-1.5 data-[severity=error]:bg-red-500/5 data-[severity=warning]:bg-amber-500/5">
                    <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 font-mono">
                      <span className="min-w-0 font-medium break-all">
                        <span className="text-muted-foreground">{entry.prefix}</span>
                        {entry.key.slice(entry.prefix.length)}
                      </span>
                      <span className="ml-auto max-w-full min-w-0 truncate text-muted-foreground">
                        {entry.deadPrefix ? <span className="italic">undefined</span> : hidden ? <span aria-label={t.masked}>{mask(entry.value)}</span> : entry.value}
                      </span>
                    </div>
                    {issue && (
                      <div className={cn("flex gap-1.5", tones[issue.severity])}>
                        <span className="flex h-6 shrink-0 items-center">
                          <Icon aria-hidden className="size-3.5" />
                        </span>
                        <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                          <span className="py-1">
                            {fill(t[issue.kind], { shape: issue.shape ?? "", prefix: entry.prefix || entry.deadPrefix, framework: frameworkName })}
                            {issue.fix === null && ` ${fill(t.duplicate, { fix: entry.bare })}`}
                          </span>
                          {issue.fix !== undefined && (
                            <button
                              type="button"
                              data-fix=""
                              onClick={(event) => {
                                refocus.current = fixIndex(event.currentTarget)
                                if (issue.kind === "dead-prefix") update(renameEnvKey(text, entry, issue.fix ?? entry.key))
                                else move([entry])
                              }}
                              className={fixClass(issue.severity === "error")}
                            >
                              {issue.fix === null ? t.remove : fill(t.rename, { fix: issue.fix })}
                            </button>
                          )}
                          {issue.kind === "high-entropy" && (
                            <button
                              type="button"
                              data-fix=""
                              onClick={(event) => {
                                refocus.current = fixIndex(event.currentTarget)
                                setMarkedPublic((prev) => [...prev, entry.key])
                                onMarkPublic?.(entry.key)
                              }}
                              className={fixClass(false)}
                            >
                              {t.keepPublic}
                            </button>
                          )}
                        </span>
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      )}
    </div>
  )
}
