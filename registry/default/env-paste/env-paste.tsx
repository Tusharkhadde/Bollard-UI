"use client"

// Bollard UI — env-paste · MIT licence · https://bollard-ui.vercel.app/components/env-paste

import * as React from "react"
import { CircleAlert, CircleCheck, TriangleAlert, WandSparkles } from "lucide-react"

import { cn } from "@/lib/utils"
import { applyEnvFix, fixAllEnv, isSafeFix, parseEnv, type EnvIssue, type EnvTarget } from "@/registry/default/env-paste/parse-env"

export { applyEnvFix, fixAllEnv, parseEnv, toEnvKey, type EnvEntry, type EnvIssue, type EnvTarget } from "@/registry/default/env-paste/parse-env"

const SECRET_KEY = /SECRET|TOKEN|PASSWORD|PASSWD|PRIVATE|_KEY$|^KEY$|DSN|CREDENTIAL/

/** Keeps the prefix that tells test from live (`sk_test_…x9`) and hides the rest. */
export function maskSecret(value: string) {
  if (value.length <= 8) return "•".repeat(value.length)
  const prefix = value.match(/^["'`]?[a-z]+_(?:test|live)_/i)?.[0] ?? value.slice(0, 3)
  return `${prefix}${"•".repeat(4)}${value.slice(-2)}`
}

const fixClass = (severity: EnvIssue["severity"]) =>
  cn(
    "inline-flex min-h-6 max-w-full items-center gap-1 rounded-md border px-2 text-left font-medium transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
    severity === "error"
      ? "border-red-500/40 text-red-800 hover:bg-red-500/10 dark:text-red-200"
      : "border-amber-500/40 text-amber-900 hover:bg-amber-500/10 dark:text-amber-200",
  )

export interface EnvPasteProps extends Omit<React.ComponentProps<"textarea">, "value" | "defaultValue" | "onChange"> {
  /** Visible label. */
  label?: string
  /** The environment this config is for. Enables test-key-in-production and live-key-in-development checks. */
  environment?: EnvTarget
  /** Controlled text. */
  value?: string
  /** Initial text when uncontrolled. */
  defaultValue?: string
  /** Called with the new text on every edit or fix. */
  onValueChange?: (value: string) => void
  /** Mask values whose key looks secret (keeps the sk_test_ / sk_live_ prefix visible). */
  maskSecrets?: boolean
  /** Label of the button that applies every safe fix. `{count}` is filled in. */
  fixAllLabel?: string
  /** Shown when every line parses cleanly. `{count}` is the number of variables. */
  cleanText?: string
  /** Shown when there are problems. `{errors}` and `{warnings}` are filled in. */
  problemsText?: string
  /** Placeholder shown in the empty textarea. */
  placeholder?: string
}

/**
 * A textarea for pasting .env / KEY=VALUE config that shows what the loader
 * will actually read. It flags stray and curly quotes, padded values, a ` #`
 * that silently cuts a value short, duplicate keys (naming the line that
 * wins), bad or lowercase keys, empty values, and test or live secrets in the
 * wrong environment, each with a one-tap fix where one is safe.
 */
export function EnvPaste({
  label = "Environment variables",
  environment,
  value,
  defaultValue = "",
  onValueChange,
  maskSecrets = true,
  fixAllLabel = "Fix {count}",
  cleanText = "{count} variables, no problems found.",
  problemsText = "{errors} errors, {warnings} warnings",
  placeholder = "Paste your .env here\nDATABASE_URL=postgres://…",
  rows = 8,
  id,
  className,
  ref,
  ...props
}: EnvPasteProps) {
  const [inner, setInner] = React.useState(defaultValue)
  const textareaRef = React.useRef<HTMLTextAreaElement>(null)
  const autoId = React.useId()
  const inputId = id ?? autoId
  const text = value ?? inner
  const entries = React.useMemo(() => parseEnv(text, environment), [text, environment])
  React.useImperativeHandle(ref, () => textareaRef.current as HTMLTextAreaElement)

  const update = (next: string) => {
    if (value === undefined) setInner(next)
    onValueChange?.(next)
  }
  const issues = entries.flatMap((entry) => entry.issues)
  const errors = issues.filter((issue) => issue.severity === "error").length
  const safe = issues.filter(isSafeFix).length
  const masked = (key: string) => maskSecrets && SECRET_KEY.test(key)

  /** Selects the source line in the textarea so the user sees exactly what is meant. */
  const reveal = (line: number) => {
    const el = textareaRef.current
    if (!el) return
    const starts = text.split("\n").reduce<number[]>((acc, row) => [...acc, acc[acc.length - 1] + row.length + 1], [0])
    el.focus()
    el.setSelectionRange(starts[line], starts[line + 1] - 1)
  }

  return (
    <div data-slot="env-paste" className={cn("grid w-full max-w-xl gap-1.5", className)}>
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={inputId} className="text-sm font-medium">
          {label}
        </label>
        {environment && (
          <span className={cn("rounded-md border px-1.5 py-0.5 font-mono text-xs", environment === "production" ? "border-red-500/40 text-red-700 dark:text-red-300" : "text-muted-foreground")}>
            {environment}
          </span>
        )}
      </div>
      <textarea
        ref={textareaRef}
        id={inputId}
        rows={rows}
        value={text}
        onChange={(event) => update(event.target.value)}
        spellCheck={false}
        autoCapitalize="none"
        autoCorrect="off"
        wrap="off"
        placeholder={placeholder}
        aria-invalid={errors > 0 || undefined}
        className="w-full min-w-0 resize-y rounded-md border bg-transparent px-3 py-2 font-mono text-xs leading-5 shadow-xs transition-[color,box-shadow] outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-destructive dark:bg-input/30"
        {...props}
      />
      <div aria-live="polite" className="mt-1.5 flex min-h-6 items-center justify-between gap-2 text-xs">
        {!entries.length ? null : issues.length ? (
          <>
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <TriangleAlert aria-hidden className="size-3.5 text-amber-600 dark:text-amber-400" />
              {problemsText.replace("{errors}", String(errors)).replace("{warnings}", String(issues.length - errors))}
            </span>
            {safe > 0 && (
              <button type="button" onClick={() => update(fixAllEnv(text, environment))} className={fixClass("warning")}>
                <WandSparkles aria-hidden className="size-3.5" />
                {fixAllLabel.replace("{count}", String(safe))}
              </button>
            )}
          </>
        ) : (
          <span className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400">
            <CircleCheck aria-hidden className="size-3.5" />
            {cleanText.replace("{count}", String(entries.length))}
          </span>
        )}
      </div>
      {entries.length > 0 && (
        <ul aria-label="Parsed variables, as the loader will read them" className="divide-y overflow-hidden rounded-md border text-xs">
          {entries.map((entry) => (
            <li key={entry.line} data-issues={entry.issues.length || undefined} className="flex gap-2 px-2 py-1.5 data-issues:bg-amber-500/5">
              <button type="button" onClick={() => reveal(entry.line)} aria-label={`Select line ${entry.line + 1}`} className="h-5 w-5 shrink-0 rounded text-right font-mono text-muted-foreground tabular-nums hover:text-foreground outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50">
                {entry.line + 1}
              </button>
              <div className="min-w-0 flex-1">
                <div className="flex h-5 min-w-0 items-center gap-2 font-mono">
                  <span className="max-w-[60%] shrink-0 truncate font-medium">{entry.key}</span>
                  <span className="min-w-0 truncate text-muted-foreground" title={masked(entry.key) ? undefined : entry.value}>
                    {entry.value === "" ? <span className="opacity-60">(empty)</span> : masked(entry.key) ? maskSecret(entry.value) : entry.value}
                  </span>
                </div>
                {entry.issues.map((issue, index) => (
                  <p key={index} className={cn("mt-1 flex gap-1.5", issue.severity === "error" ? "text-red-700 dark:text-red-400" : "text-amber-700 dark:text-amber-400")}>
                    <span className="flex h-6 shrink-0 items-center">
                      {issue.severity === "error" ? <CircleAlert aria-hidden className="size-3.5" /> : <TriangleAlert aria-hidden className="size-3.5" />}
                    </span>
                    <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="py-1">{issue.message}</span>
                      {issue.fix !== undefined && (
                        <button type="button" onClick={() => update(applyEnvFix(text, entry.line, issue.fix ?? null))} className={fixClass(issue.severity)}>
                          {issue.fixLabel}
                        </button>
                      )}
                    </span>
                  </p>
                ))}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
