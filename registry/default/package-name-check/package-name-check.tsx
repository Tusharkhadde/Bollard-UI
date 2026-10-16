"use client"

import * as React from "react"
import { CircleAlert, CircleCheck, Info, LoaderCircle, Package, TriangleAlert } from "lucide-react"

import { cn } from "@/lib/utils"
import { checkPackageName, judgeLookup, parseInstall, POPULAR_PACKAGES, replacePackage, type Ecosystem, type PackageInfo, type PackageRef, type PackageVerdict } from "@/registry/default/package-name-check/package-names"

export { checkPackageName, distance, judgeLookup, NODE_BUILTINS, normalizePypi, parseInstall, POPULAR_PACKAGES, PYPI_IMPORT_NAMES, PYTHON_STDLIB, replacePackage, type Ecosystem, type PackageInfo, type PackageRef, type PackageVerdict, type PackageVerdictKind, type ParsedInstall } from "@/registry/default/package-name-check/package-names"

export const PACKAGE_NAME_CHECK_MESSAGES = {
  label: "Install command or package names",
  placeholder: "npm install lodash dotenv",
  npm: "npm",
  pypi: "PyPI",
  ecosystem: "Registry",
  detected: "Reading as {ecosystem} from the command.",
  checking: "Checking the registry…",
  lookupFailed: "Couldn't reach the registry, so only the name was checked.",
  summaryClean: "{count} checked, all look right.",
  summary: "{count} checked · {flagged} to look at",
  use: "Use {suggestion}",
  remove: "Remove it",
  ok: "A popular package.",
  "ok-found": "Found on the registry.",
  invalid: "Not a valid {ecosystem} name, so the install fails.",
  uppercase: "New npm names are all lowercase, so “{name}” is either missing or an old, unrelated package. You probably meant {suggestion}.",
  "builtin-npm": "{name} is built into Node. npm install fetches a registry package with that name, not Node's module (at best a placeholder).",
  "builtin-pypi": "{name} is part of Python's standard library, so there's nothing to install. A PyPI package with that name isn't it.",
  "import-name": "{name} is what you import. The package to install is {suggestion}.",
  separator: "Same letters as {suggestion} with different dashes or dots, a classic typosquat (crossenv for cross-env stole environment variables in 2017).",
  "lookalike-chars": "Look-alike characters for {suggestion} (capital I for l, 0 for o). jeIlyfish on PyPI stole keys this way.",
  typo: "A letter or two off {suggestion}, a popular package squatters copy.",
  affix: "{suggestion} with an extra prefix or suffix, a common squatting pattern (cross-env.js, python3-dateutil).",
  missing: "No package with this name exists. Anyone can register a missing name, including one an AI assistant made up, and fill it with malware.",
  new: "First published {days} days ago with {downloads} downloads. Make sure it's the package you meant.",
  unchecked: "Not on the popular list, so this check can't vouch for it.",
}
export type PackageNameCheckMessages = typeof PACKAGE_NAME_CHECK_MESSAGES

const fill = (text: string, values: Record<string, string | number>) => text.replace(/\{(\w+)\}/g, (match, key: string) => String(values[key] ?? match))
const tones = { error: "text-red-700 dark:text-red-400", warning: "text-amber-700 dark:text-amber-400", info: "text-muted-foreground", ok: "text-emerald-700 dark:text-emerald-400" }
const icons = { error: CircleAlert, warning: TriangleAlert, info: Info, ok: CircleCheck }
const fixClass = (error: boolean) =>
  cn(
    "inline-flex min-h-6 items-center rounded-md border px-2 font-medium transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
    error ? "border-red-500/40 text-red-800 hover:bg-red-500/10 dark:text-red-200" : "border-amber-500/40 text-amber-900 hover:bg-amber-500/10 dark:text-amber-200",
  )

function useSettled<T>(value: T, delay: number) {
  const [settled, setSettled] = React.useState(value)
  React.useEffect(() => {
    const timer = setTimeout(() => setSettled(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])
  return settled
}

export interface PackageNameCheckProps extends Omit<React.ComponentProps<"textarea">, "value" | "defaultValue" | "onChange"> {
  /** Controlled text: an install command, a requirements.txt or names one per line. */
  value?: string
  /** Initial text when uncontrolled. */
  defaultValue?: string
  /** Called with the text on every edit or fix. */
  onValueChange?: (value: string) => void
  /** Registry for bare names. A command (npm i, pip install, uv add…) overrides it. */
  ecosystem?: Ecosystem
  /** Initial registry when uncontrolled. */
  defaultEcosystem?: Ecosystem
  /** Called when the user switches registry. */
  onEcosystemChange?: (ecosystem: Ecosystem) => void
  /** Popular names to compare against per registry. Defaults to a curated list. */
  popular?: Partial<Record<Ecosystem, string[]>>
  /** Optional registry lookup (existence, downloads, first publish date). Rejections are caught. */
  lookup?: (name: string, ecosystem: Ecosystem, signal: AbortSignal) => Promise<PackageInfo | null>
  /** Clock for "published N days ago", in ms. Defaults to the time the component mounted. */
  now?: number
  /** Called with every package's verdict whenever they change. */
  onVerdictsChange?: (verdicts: PackageVerdict[]) => void
  /** Visible label; shorthand for `messages.label`. */
  label?: string
  /** Every visible string. `{name}`, `{suggestion}`, `{ecosystem}` and the other placeholders are filled in. */
  messages?: Partial<PackageNameCheckMessages>
}

/**
 * Checks an install command or requirements list before it runs, catching
 * typosquats and lookalikes of popular packages (loadsh, crossenv,
 * jeIlyfish, cross-env.js), import names that aren't the package (sklearn,
 * cv2, bs4), built-ins installed from the registry (fs, json), invalid names,
 * and, with a registry lookup, names that don't exist or appeared last week.
 */
export function PackageNameCheck({ value, defaultValue = "", onValueChange, ecosystem, defaultEcosystem = "npm", onEcosystemChange, popular, lookup, now, onVerdictsChange, label, messages, rows = 2, id, className, ref, "aria-describedby": describedBy, ...props }: PackageNameCheckProps) {
  const t = { ...PACKAGE_NAME_CHECK_MESSAGES, ...messages, ...(label !== undefined && { label }) }
  const [inner, setInner] = React.useState(defaultValue)
  const text = String(value ?? inner ?? "")
  const [innerEco, setInnerEco] = React.useState<Ecosystem>(defaultEcosystem)
  const chosen = ecosystem ?? innerEco
  const [mounted, setMounted] = React.useState<number>()
  React.useEffect(() => setMounted(Date.now()), [])
  const clock = now ?? mounted ?? 0
  const cache = React.useRef(new Map<string, PackageInfo | null | "failed">())
  const [, setVersion] = React.useState(0)
  const [pendingKeys, setPendingKeys] = React.useState<string[]>([])
  const textarea = React.useRef<HTMLTextAreaElement>(null)
  const list = React.useRef<HTMLUListElement>(null)
  const refocus = React.useRef<number | null>(null)
  const autoId = React.useId()
  const inputId = id ?? autoId
  React.useImperativeHandle(ref, () => textarea.current as HTMLTextAreaElement)

  const update = (next: string) => {
    if (value === undefined) setInner(next)
    onValueChange?.(next)
  }
  const parsed = React.useMemo(() => parseInstall(text, chosen), [text, chosen])
  const base = React.useMemo(() => parsed.packages.map((ref) => checkPackageName(ref, parsed.ecosystem, popular?.[parsed.ecosystem] ?? POPULAR_PACKAGES[parsed.ecosystem])), [parsed, popular])
  const verdicts = base.map((verdict) => {
    const result = cache.current.get(`${parsed.ecosystem}:${verdict.ref.name}`)
    return result && result !== "failed" ? judgeLookup(verdict, result, clock) : verdict
  })

  // Look names up only after typing settles; responses for text that has since changed are dropped.
  const settledNames = useSettled(base.filter((verdict) => verdict.severity !== "error").map((verdict) => `${parsed.ecosystem}:${verdict.ref.name}`).join("\n"), 600)
  // Held in a ref so an inline lookup function doesn't restart every request on each render.
  const lookupRef = React.useRef(lookup)
  lookupRef.current = lookup
  const canLookup = Boolean(lookup)
  React.useEffect(() => {
    const run = lookupRef.current
    if (!run || !settledNames) return
    const controller = new AbortController()
    const todo = [...new Set(settledNames.split("\n"))].filter((key) => !cache.current.has(key))
    setPendingKeys(todo)
    for (const key of todo) {
      const [eco, name] = key.split(/:(.*)/s) as [Ecosystem, string]
      Promise.resolve()
        .then(() => run(name, eco, controller.signal))
        .then(
          (info) => info,
          () => "failed" as const,
        )
        .then((result) => {
          if (controller.signal.aborted) return
          cache.current.set(key, result ?? null)
          setPendingKeys((keys) => keys.filter((pendingKey) => pendingKey !== key))
          setVersion((version) => version + 1)
        })
    }
    return () => controller.abort()
  }, [settledNames, canLookup])

  const verdictKey = verdicts.map((verdict) => `${verdict.ref.name}:${verdict.kind}`).join("|")
  const onVerdicts = React.useRef(onVerdictsChange)
  onVerdicts.current = onVerdictsChange
  React.useEffect(() => {
    onVerdicts.current?.(verdicts)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [verdictKey])

  React.useEffect(() => {
    if (refocus.current === null) return
    const buttons = list.current?.querySelectorAll<HTMLButtonElement>("button[data-fix]") ?? []
    ;(buttons[Math.min(refocus.current, buttons.length - 1)] ?? textarea.current)?.focus()
    refocus.current = null
  }, [text])
  const apply = (ref: PackageRef, name: string | null, button: HTMLElement) => {
    refocus.current = [...(list.current?.querySelectorAll("button[data-fix]") ?? [])].indexOf(button)
    const next = name === null ? (text.slice(0, ref.start) + text.slice(ref.start + ref.token.length)).replace(/[ \t]{2,}/g, " ").replace(/^[ \t]+$/gm, "") : replacePackage(text, ref, name)
    update(next)
  }

  const pending = pendingKeys.length > 0
  const failed = verdicts.some((verdict) => cache.current.get(`${parsed.ecosystem}:${verdict.ref.name}`) === "failed")
  const flagged = verdicts.filter((verdict) => verdict.severity === "error" || verdict.severity === "warning").length
  const summary = verdicts.length ? (flagged ? fill(t.summary, { count: verdicts.length, flagged }) : fill(t.summaryClean, { count: verdicts.length })) : ""
  const announced = useSettled(pending ? "" : summary, 900)
  const message = (verdict: PackageVerdict, index: number) => {
    const key = verdict.kind === "builtin" ? (`builtin-${parsed.ecosystem}` as const) : verdict.kind === "ok" && base[index]?.kind !== "ok" ? "ok-found" : verdict.kind
    return fill(t[key], { ...verdict.detail, ecosystem: t[parsed.ecosystem] })
  }

  return (
    <div data-slot="package-name-check" className={cn("grid w-full max-w-xl min-w-0 grid-cols-[minmax(0,1fr)] gap-1.5 text-sm", className)}>
      <div className="flex flex-wrap items-end justify-between gap-2">
        <label htmlFor={inputId} className="flex w-fit items-center gap-1.5 font-medium">
          <Package aria-hidden className="size-4 text-muted-foreground" />
          {t.label}
        </label>
        {!parsed.detected && (
          <div role="radiogroup" aria-label={t.ecosystem} className="inline-flex rounded-md border p-0.5 text-xs">
            {(["npm", "pypi"] as const).map((option) => (
              <button
                key={option}
                type="button"
                role="radio"
                aria-checked={chosen === option}
                onClick={() => {
                  if (ecosystem === undefined) setInnerEco(option)
                  onEcosystemChange?.(option)
                }}
                className={cn("h-6 rounded-[5px] px-2 font-medium transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50", chosen === option ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}
              >
                {t[option]}
              </button>
            ))}
          </div>
        )}
      </div>
      <textarea
        ref={textarea}
        id={inputId}
        rows={rows}
        value={text}
        onChange={(event) => update(event.target.value)}
        placeholder={t.placeholder}
        spellCheck={false}
        autoCapitalize="none"
        autoCorrect="off"
        aria-describedby={[describedBy, `${inputId}-status`].filter(Boolean).join(" ")}
        className="field-sizing-content min-h-14 w-full min-w-0 resize-y rounded-md border bg-transparent px-3 py-2 font-mono text-base leading-5 shadow-xs transition-[color,box-shadow] outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 md:text-xs dark:bg-input/30"
        {...props}
      />
      <span role="status" className="sr-only">
        {announced}
      </span>
      <div id={`${inputId}-status`} className="grid gap-1.5 text-xs">
        {(summary || parsed.detected) && (
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-muted-foreground">
            {parsed.detected && <span>{fill(t.detected, { ecosystem: t[parsed.ecosystem] })}</span>}
            {summary && <span className={cn(!flagged && "text-emerald-700 dark:text-emerald-400")}>{summary}</span>}
            {pending && (
              <span className="inline-flex items-center gap-1">
                <LoaderCircle aria-hidden className="size-3.5 animate-spin motion-reduce:animate-none" />
                {t.checking}
              </span>
            )}
            {failed && !pending && <span>{t.lookupFailed}</span>}
          </p>
        )}
        {verdicts.length > 0 && (
          <ul ref={list} className="grid gap-1.5">
            {verdicts.map((verdict, index) => {
              const Icon = icons[verdict.severity]
              const removable = verdict.kind === "builtin"
              return (
                <li key={`${verdict.ref.start}-${index}`} className={cn("flex gap-1.5", tones[verdict.severity])}>
                  <span className="flex h-6 shrink-0 items-center">
                    <Icon aria-hidden className="size-3.5" />
                  </span>
                  <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="py-1 [overflow-wrap:anywhere]">
                      <code className="mr-1 rounded border bg-muted/40 px-1 font-mono text-[11px] text-foreground">{verdict.ref.name}</code>
                      {verdict.severity === "ok" ? <span className="text-muted-foreground">{message(verdict, index)}</span> : message(verdict, index)}
                    </span>
                    {verdict.suggestion && verdict.severity !== "ok" && (
                      <button type="button" data-fix="" onClick={(event) => apply(verdict.ref, verdict.suggestion as string, event.currentTarget)} className={fixClass(verdict.severity === "error")}>
                        {fill(t.use, { suggestion: verdict.suggestion })}
                      </button>
                    )}
                    {removable && (
                      <button type="button" data-fix="" onClick={(event) => apply(verdict.ref, null, event.currentTarget)} className={fixClass(false)}>
                        {t.remove}
                      </button>
                    )}
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
