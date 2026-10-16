"use client"

import * as React from "react"
import { Check, Copy, KeyRound } from "lucide-react"

import { cn } from "@/lib/utils"

export type EnvDiffStatus = "missing" | "leak" | "reused" | "empty" | "changed" | "extra" | "same"

export interface EnvDiffRow {
  key: string
  status: EnvDiffStatus
  /** Value in the reference environment (undefined when the key is absent there). */
  base?: string
  /** Value in the environment being checked. */
  target?: string
  /** True when the key looks like a secret, so its values are shown masked. */
  secret: boolean
  /** Why a `leak` was flagged, e.g. "points at localhost". */
  reason?: string
}

const SECRET_KEY = /SECRET|TOKEN|PASSWORD|PASSWD|PRIVATE|API_?KEY|_KEY$|^KEY$|DSN|CREDENTIAL|SALT|COOKIE/i
/** Rank used to sort rows: the things that break a deploy come first. */
const RANK: Record<EnvDiffStatus, number> = { missing: 0, leak: 1, reused: 2, empty: 3, changed: 4, extra: 5, same: 6 }

/** Parses KEY=VALUE text (comments, `export`, quotes, multi-line quoted values such as PEM keys) into a map. Later keys win, like dotenv. */
export function parseEnvText(text: string): Record<string, string> {
  const out: Record<string, string> = {}
  const lines = text.split(/\r?\n/)
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line || line.startsWith("#")) continue
    const match = line.match(/^(?:export\s+)?([\w.-]+)\s*[=:]\s*(.*)$/)
    if (!match) continue
    let value = match[2]
    const quote = value[0]
    if (quote === '"' || quote === "'" || quote === "`") {
      // A quoted value runs to its closing quote, even across lines.
      let body = value.slice(1)
      while (body.lastIndexOf(quote) < 0 && i + 1 < lines.length) body += "\n" + lines[++i]
      const end = body.lastIndexOf(quote)
      value = end < 0 ? body : body.slice(0, end)
      if (quote === '"') value = value.replace(/\\n/g, "\n")
    } else value = value.replace(/\s+#.*$/, "").trim()
    out[match[1]] = value
  }
  return out
}

/** Hides the password in a connection URL ("postgres://app:hunter2@db" → "postgres://app:••••@db"), which keys like DATABASE_URL carry without looking secret. */
export const maskUrlCredentials = (value: string) => value.replace(/(\/\/[^/:@\s]*:)[^@/\s]+@/g, "$1••••@")

/** A short, stable fingerprint (FNV-1a, 4 hex chars) so two masked values can be compared without showing them. */
export function fingerprint(value: string) {
  let hash = 0x811c9dc5
  for (let i = 0; i < value.length; i++) hash = Math.imul(hash ^ value.charCodeAt(i), 0x01000193)
  return ((hash >>> 0) & 0xffff).toString(16).padStart(4, "0")
}

/** Values that belong to another environment: the reference env's own name, or test keys and localhost in production. */
function leakReason(value: string, baseName: string, production: boolean): string | undefined {
  if (production && /(^|[^a-z])(sk|pk|rk)_test_/i.test(value)) return "is a test key"
  if (production && /localhost|127\.0\.0\.1|0\.0\.0\.0/i.test(value)) return "points at localhost"
  const name = baseName.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  // A whole word only, so "dev" catches api.dev.acme.com but not devtools.com or device.
  if (name.length >= 3 && new RegExp(`(^|[^a-z0-9])${name}([^a-z0-9]|$)`, "i").test(value)) return `mentions ${baseName}`
}

/**
 * Compares two environments key by key. `missing` keys exist in base but not
 * target, `extra` only in target. Values in the target that look borrowed from
 * another environment are a `leak` (in `production`, test keys and localhost
 * count too); a secret identical in both is `reused`.
 */
export function diffEnv(
  base: Record<string, string>,
  target: Record<string, string>,
  options: { baseName?: string; production?: boolean; isSecret?: (key: string) => boolean } = {},
): EnvDiffRow[] {
  const { baseName = "", production = false, isSecret = (key: string) => SECRET_KEY.test(key) } = options
  const keys = [...new Set([...Object.keys(base), ...Object.keys(target)])]
  return keys
    .map((key): EnvDiffRow => {
      const row = { key, base: base[key], target: target[key], secret: isSecret(key) }
      if (row.target === undefined) return { ...row, status: "missing" }
      if (row.base === undefined) return { ...row, status: "extra" }
      if (row.target === "" && row.base !== "") return { ...row, status: "empty" }
      const reason = leakReason(row.target, baseName, production)
      if (reason) return { ...row, status: "leak", reason }
      if (row.target === row.base) return { ...row, status: row.secret && row.target ? "reused" : "same" }
      return { ...row, status: "changed" }
    })
    .sort((a, b) => RANK[a.status] - RANK[b.status] || a.key.localeCompare(b.key))
}

const TONE: Record<EnvDiffStatus, string> = {
  missing: "border-red-500/40 bg-red-500/10 text-red-800 dark:text-red-200",
  leak: "border-red-500/40 bg-red-500/10 text-red-800 dark:text-red-200",
  reused: "border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-200",
  empty: "border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-200",
  changed: "border-border text-foreground",
  extra: "border-border text-muted-foreground",
  same: "border-border text-muted-foreground",
}

const DEFAULT_LABELS: Record<EnvDiffStatus, string> = {
  missing: "Missing",
  leak: "Wrong env",
  reused: "Same secret",
  empty: "Empty",
  changed: "Changed",
  extra: "Only in {target}",
  same: "Same",
}

const DEFAULT_HINTS: Partial<Record<EnvDiffStatus, string>> = {
  missing: "Set in {base}, not in {target}. The app may crash on boot.",
  leak: "The {target} value {reason}.",
  reused: "The same secret is used in {base} and {target}. A leak in one exposes both.",
  empty: "Set but empty in {target}. Most apps treat this as missing.",
}

export interface EnvDiffProps extends Omit<React.ComponentProps<"div">, "children"> {
  /** Reference environment: dotenv text or a key/value map. */
  base: string | Record<string, string>
  /** Environment being checked against the reference. */
  target: string | Record<string, string>
  /** Name of the reference environment. Also used to spot its values leaking into the target. */
  baseName?: string
  /** Name of the environment being checked. */
  targetName?: string
  /** Treat the target as production: test keys and localhost values are flagged. Defaults to a name containing "prod" or "live". */
  production?: boolean
  /** Decides which keys are secret. Defaults to names containing SECRET, TOKEN, PASSWORD, KEY, DSN… */
  isSecret?: (key: string) => boolean
  /** Show unchanged keys too. They are hidden by default so the real differences stand out. */
  showSame?: boolean
  /** Badge text per status. `{target}` is filled in. */
  statusLabels?: Partial<Record<EnvDiffStatus, string>>
  /** Explanation per status. `{base}`, `{target}` and `{reason}` are filled in. */
  hints?: Partial<Record<EnvDiffStatus, string>>
  /** Summary when nothing needs attention. */
  cleanText?: string
  /** Summary when something does. `{count}` is filled in. */
  problemsText?: string
  /** Label of the button that copies the missing keys as a KEY= template. `{count}` is filled in. */
  copyMissingLabel?: string
  /** Label shown after copying. */
  copiedLabel?: string
  /** Label of the toggle for unchanged keys. `{count}` is filled in. */
  showSameLabel?: string
  /** Label of the same toggle while unchanged keys are shown. */
  hideSameLabel?: string
  /** Shown where a key isn't set. */
  notSetText?: string
  /** Shown where a value is an empty string. */
  emptyText?: string
  /** Read by screen readers for a masked value. `{fingerprint}` is filled in. */
  maskedText?: string
  /** Read by screen readers next to a secret key. */
  secretText?: string
}

const fill = (text: string, values: Record<string, string | number>) =>
  text.replace(/\{(\w+)\}/g, (match, key: string) => String(values[key] ?? match))

/**
 * Catches config drift before a deploy: keys set in staging but missing in
 * production, empty values, a production value that still points at
 * localhost, a test key or the staging host, and one secret reused across
 * both. Secrets are never shown; a short fingerprint tells you whether two
 * masked values match, so the diff is safe to screenshot into a ticket.
 */
export function EnvDiff({
  base,
  target,
  baseName = "staging",
  targetName = "production",
  production = /\b(prod|production|prd|live)\b/i.test(targetName),
  isSecret,
  showSame: defaultShowSame = false,
  statusLabels,
  hints,
  cleanText = "{target} has everything {base} has.",
  problemsText = "{count} to fix before deploying {target}",
  copyMissingLabel = "Copy {count} missing",
  copiedLabel = "Copied",
  showSameLabel = "Show {count} unchanged",
  hideSameLabel = "Hide unchanged",
  notSetText = "not set",
  emptyText = "empty",
  maskedText = "Masked value, fingerprint {fingerprint}. Matching fingerprints mean matching values.",
  secretText = "Secret",
  className,
  ...props
}: EnvDiffProps) {
  const [showSame, setShowSame] = React.useState(defaultShowSame)
  const [copied, setCopied] = React.useState(false)
  const rows = React.useMemo(() => {
    const parse = (env: string | Record<string, string>) => (typeof env === "string" ? parseEnvText(env) : env)
    return diffEnv(parse(base), parse(target), { baseName, production, isSecret })
  }, [base, target, baseName, production, isSecret])

  React.useEffect(() => {
    if (!copied) return
    const id = setTimeout(() => setCopied(false), 1600)
    return () => clearTimeout(id)
  }, [copied])

  const labels = { ...DEFAULT_LABELS, ...statusLabels }
  const allHints = { ...DEFAULT_HINTS, ...hints }
  const names = { base: baseName, target: targetName }
  const problems = rows.filter((row) => RANK[row.status] <= RANK.empty)
  const missing = rows.filter((row) => row.status === "missing")
  const same = rows.filter((row) => row.status === "same").length
  const visible = showSame ? rows : rows.filter((row) => row.status !== "same")

  const copyMissing = async () => {
    try {
      await navigator.clipboard.writeText(missing.map((row) => `${row.key}=`).join("\n"))
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }

  const show = (row: EnvDiffRow, value: string | undefined) => {
    if (value === undefined) return <span className="text-muted-foreground italic">{notSetText}</span>
    if (value === "") return <span className="text-muted-foreground italic">{emptyText}</span>
    if (!row.secret) return <span className="whitespace-pre-wrap [overflow-wrap:anywhere]">{maskUrlCredentials(value)}</span>
    const label = fill(maskedText, { fingerprint: fingerprint(value) })
    return (
      <span className="inline-flex items-center gap-1.5" title={label}>
        <span className="sr-only">{label}</span>
        <span aria-hidden>••••••</span>
        <span aria-hidden className="rounded-sm bg-muted px-1 text-[11px] text-muted-foreground">#{fingerprint(value)}</span>
      </span>
    )
  }

  return (
    <div data-slot="env-diff" className={cn("grid w-full max-w-xl gap-2 text-sm", className)} {...props}>
      <div aria-live="polite" className="flex min-h-8 flex-wrap items-center justify-between gap-2">
        <p className={cn("font-medium", problems.length ? "text-red-700 dark:text-red-400" : "text-emerald-700 dark:text-emerald-400")}>
          {fill(problems.length ? problemsText : cleanText, { ...names, count: problems.length })}
        </p>
        {missing.length > 0 && (
          <button
            type="button"
            onClick={copyMissing}
            className="inline-flex h-8 items-center gap-1.5 rounded-md border px-3 text-sm font-medium shadow-xs transition-colors outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30"
          >
            {copied ? <Check aria-hidden className="size-4" /> : <Copy aria-hidden className="size-4" />}
            {copied ? copiedLabel : fill(copyMissingLabel, { count: missing.length })}
          </button>
        )}
      </div>
      <ul aria-label={`${baseName} compared with ${targetName}`} className="divide-y overflow-hidden rounded-md border">
        {visible.map((row) => (
          <li key={row.key} data-status={row.status} className="grid gap-1.5 px-3 py-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="flex min-w-0 items-center gap-1.5 font-mono text-xs font-medium">
                {row.secret && <KeyRound role="img" aria-label={secretText} className="size-3.5 shrink-0 text-muted-foreground" />}
                <span className="break-all">{row.key}</span>
              </span>
              <span className={cn("shrink-0 rounded-md border px-1.5 py-0.5 text-xs font-medium", TONE[row.status])}>
                {fill(labels[row.status], names)}
              </span>
            </div>
            {row.status !== "same" && (
              <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 font-mono text-xs">
                <dt className="text-muted-foreground">{baseName}</dt>
                <dd className="min-w-0">{show(row, row.base)}</dd>
                <dt className="text-muted-foreground">{targetName}</dt>
                <dd className={cn("min-w-0", RANK[row.status] <= RANK.empty && "font-medium")}>{show(row, row.target)}</dd>
              </dl>
            )}
            {allHints[row.status] && (
              <p className="text-xs text-muted-foreground">{fill(allHints[row.status] ?? "", { ...names, reason: row.reason ?? "" })}</p>
            )}
          </li>
        ))}
      </ul>
      {same > 0 && (
        <button
          type="button"
          aria-pressed={showSame}
          onClick={() => setShowSame((value) => !value)}
          className="w-fit rounded-md text-xs text-muted-foreground underline-offset-4 outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          {showSame ? hideSameLabel : fill(showSameLabel, { count: same })}
        </button>
      )}
    </div>
  )
}
