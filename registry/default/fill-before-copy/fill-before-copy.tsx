"use client"

// Bollard UI — fill-before-copy · MIT licence · https://bollard-ui.vercel.app/components/fill-before-copy

import * as React from "react"
import { Check, Copy, TextCursorInput, TriangleAlert } from "lucide-react"

import { cn } from "@/lib/utils"

/** `<YOUR_API_KEY>`, `<project-id>` and `{{project_id}}`, but not HTML tags like `<div>`. */
export const PLACEHOLDER = /<([A-Z][A-Z0-9_]*|[a-z][a-z0-9]*(?:[-_][a-z0-9]+)+)>|\{\{\s*([A-Za-z_][\w.-]*)\s*\}\}/g

export type SnippetPart = { type: "text"; value: string } | { type: "slot"; name: string; raw: string }

/** Splits a snippet into plain text and placeholders. The same name twice is one value. */
export function parsePlaceholders(code: string, pattern: RegExp = PLACEHOLDER): SnippetPart[] {
  const parts: SnippetPart[] = []
  let last = 0
  for (const m of code.matchAll(new RegExp(pattern.source, pattern.flags.includes("g") ? pattern.flags : pattern.flags + "g"))) {
    if (m.index > last) parts.push({ type: "text", value: code.slice(last, m.index) })
    parts.push({ type: "slot", name: m.slice(1).find(Boolean) ?? m[0], raw: m[0] })
    last = m.index + m[0].length
  }
  if (last < code.length) parts.push({ type: "text", value: code.slice(last) })
  return parts
}

/**
 * Trims a value and unwraps it if the placeholder's brackets came along: "<sk_live_1>" → "sk_live_1".
 * Pasting the placeholder itself back in ("<YOUR_API_KEY>") counts as empty.
 */
export function cleanPlaceholderValue(text: string, name?: string) {
  const t = text.trim()
  const m = t.match(/^<(.+)>$/) ?? t.match(/^\{\{\s*(.+?)\s*\}\}$/)
  const inner = m ? m[1] : t
  return inner === name ? "" : inner
}

/** "YOUR_API_KEY" → "Your API key", "project_id" → "Project id". */
export const humanize = (name: string) => {
  const words = name.replace(/[_.-]+/g, " ").trim().toLowerCase().replace(/\b(api|id|url|uri|ssh|aws|gcp|db)\b/g, (w) => (w === "id" ? w : w.toUpperCase()))
  return words.charAt(0).toUpperCase() + words.slice(1)
}

const SECRET = /key|token|secret|password|passwd|pwd/i
const fill = (template: string, values: Record<string, string>) => template.replace(/\{(\w+)\}/g, (m, k: string) => values[k] ?? m)

export interface FillBeforeCopyProps extends Omit<React.ComponentProps<"div">, "defaultValue" | "onCopy"> {
  /** The snippet, with placeholders like `<YOUR_API_KEY>` or `{{project_id}}`. */
  code: string
  /** Header text, e.g. "Terminal" or "bash". */
  title?: string
  /** Which placeholder syntax to detect. */
  pattern?: RegExp
  /** Controlled values by placeholder name. */
  value?: Record<string, string>
  /** Initial values when uncontrolled. */
  defaultValue?: Record<string, string>
  /** Called with every value on each change. */
  onValueChange?: (value: Record<string, string>) => void
  /** "block" refuses to copy until every placeholder is filled; "warn" asks once, then copies. */
  unfilled?: "block" | "warn"
  /** Called with the filled text that went to the clipboard. */
  onCopy?: (text: string) => void
  /** Templates: `{count}` and `{names}` are filled in. */
  fillLabel?: string
  /** Status text counting placeholders left ({count} is filled in). */
  leftText?: string
  /** Status text when every placeholder is filled. */
  readyText?: string
  /** Copy button text. */
  copyLabel?: string
  /** Shown after copying. */
  copiedLabel?: string
  /** Text for copying with placeholders left. */
  copyAnywayLabel?: string
  /** Shown when Copy is blocked. */
  blockedText?: string
}

/**
 * Stops people pasting `curl -H "Authorization: Bearer <YOUR_API_KEY>"` into a terminal. Each
 * placeholder becomes an inline field (repeats share one value), secrets stay masked, pasted
 * brackets are stripped, and Copy is blocked, or asks once, until nothing is left unfilled.
 */
export function FillBeforeCopy({
  code,
  title = "Terminal",
  pattern = PLACEHOLDER,
  value,
  defaultValue = {},
  onValueChange,
  unfilled = "block",
  onCopy,
  fillLabel = "Fill {count}",
  leftText = "Still a placeholder: {names}.",
  readyText = "All placeholders filled.",
  copyLabel = "Copy",
  copiedLabel = "Copied",
  copyAnywayLabel = "Copy anyway",
  blockedText = "Couldn't copy. Your browser blocked clipboard access.",
  className,
  ...props
}: FillBeforeCopyProps) {
  const [inner, setInner] = React.useState(defaultValue)
  const [focused, setFocused] = React.useState<string>()
  const [state, setState] = React.useState<"idle" | "copied" | "asking" | "blocked">("idle")
  const fieldRefs = React.useRef<Record<string, HTMLInputElement | null>>({})
  const values = value ?? inner
  const parts = React.useMemo(() => parsePlaceholders(code, pattern), [code, pattern])
  const names = [...new Set(parts.flatMap((p) => (p.type === "slot" ? [p.name] : [])))]
  const clean = (name: string) => cleanPlaceholderValue(values[name] ?? "", name)
  const missing = names.filter((n) => !clean(n))
  const statusId = React.useId()

  React.useEffect(() => {
    if (state !== "copied") return
    const t = setTimeout(() => setState("idle"), 2000)
    return () => clearTimeout(t)
  }, [state])

  const update = (name: string, text: string) => {
    const next = { ...values, [name]: text }
    if (value === undefined) setInner(next)
    onValueChange?.(next)
    if (state === "asking") setState("idle")
  }

  const copy = async (force = false) => {
    if (missing.length && !force) {
      if (unfilled === "warn") return setState("asking")
      return fieldRefs.current[missing[0]]?.focus()
    }
    const text = parts.map((p) => (p.type === "text" ? p.value : clean(p.name) || p.raw)).join("")
    try {
      await navigator.clipboard.writeText(text)
      setState("copied")
      onCopy?.(text)
    } catch {
      setState("blocked")
    }
  }

  const count = `${missing.length} placeholder${missing.length === 1 ? "" : "s"}`
  const blocked = missing.length > 0 && unfilled === "block"
  const seen = new Set<string>()

  return (
    <div data-slot="fill-before-copy" className={cn("grid w-full min-w-0 gap-1.5", className)} {...props}>
      <div className="overflow-hidden rounded-lg border bg-muted/40 dark:bg-input/20">
        <div className="flex h-11 items-center justify-between gap-2 border-b pr-1.5 pl-3">
          <span className="truncate text-xs font-medium text-muted-foreground">{title}</span>
          <button
            type="button"
            onClick={() => void copy()}
            aria-describedby={statusId}
            data-blocked={blocked ? "" : undefined}
            className={cn(
              "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md px-3 text-sm font-medium transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
              blocked ? "text-amber-800 hover:bg-amber-500/10 dark:text-amber-300" : "hover:bg-accent",
            )}
          >
            {state === "copied" ? <Check aria-hidden className="size-4" /> : blocked ? <TextCursorInput aria-hidden className="size-4" /> : <Copy aria-hidden className="size-4" />}
            {state === "copied" ? copiedLabel : blocked ? fill(fillLabel, { count }) : copyLabel}
          </button>
        </div>
        <pre className="px-3 py-2.5 font-mono text-[13px] leading-7 whitespace-pre-wrap [overflow-wrap:anywhere]">
          <code>
            {parts.map((part, i) => {
              if (part.type === "text") return <React.Fragment key={i}>{part.value}</React.Fragment>
              const text = values[part.name] ?? ""
              const secret = SECRET.test(part.name) && focused !== `${part.name}-${i}`
              const first = !seen.has(part.name)
              seen.add(part.name)
              return (
                <input
                  key={i}
                  ref={first ? (el) => void (fieldRefs.current[part.name] = el) : undefined}
                  type={secret && text ? "password" : "text"}
                  value={text}
                  placeholder={part.name}
                  aria-label={humanize(part.name)}
                  aria-invalid={state === "asking" && !text ? true : undefined}
                  autoComplete="off"
                  spellCheck={false}
                  onChange={(e) => update(part.name, e.target.value)}
                  onFocus={() => setFocused(`${part.name}-${i}`)}
                  onPaste={(e) => {
                    e.preventDefault()
                    update(part.name, cleanPlaceholderValue(e.clipboardData.getData("text"), part.name))
                  }}
                  onBlur={() => {
                    setFocused(undefined)
                    if (text !== clean(part.name)) update(part.name, clean(part.name))
                  }}
                  style={{ width: `${Math.max((text || part.name).length, 4) + 1.5}ch` }}
                  className={cn(
                    "mx-px inline-block h-6 max-w-full rounded-sm border px-1 align-middle font-mono text-[13px] outline-none transition-colors placeholder:text-amber-800/70 focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:placeholder:text-amber-200/60",
                    clean(part.name)
                      ? "border-transparent bg-emerald-500/10 text-emerald-900 dark:text-emerald-200"
                      : "border-dashed border-amber-500/70 bg-amber-500/10",
                  )}
                />
              )
            })}
          </code>
        </pre>
      </div>
      <div id={statusId} aria-live="polite" className="min-h-6 text-xs">
        {state === "blocked" ? (
          <p role="alert" className="flex items-center gap-1.5 py-1 text-red-700 dark:text-red-400">
            <TriangleAlert aria-hidden className="size-3.5 shrink-0" />
            {blockedText}
          </p>
        ) : missing.length ? (
          <p className="flex gap-1.5 text-amber-700 dark:text-amber-400">
            <span className="flex h-6 shrink-0 items-center">
              <TriangleAlert aria-hidden className="size-3.5" />
            </span>
            <span className="flex min-w-0 flex-wrap items-center gap-x-2">
              <span className="py-1">{fill(leftText, { names: missing.map(humanize).join(", "), count })}</span>
              {state === "asking" && (
                <button
                  type="button"
                  onClick={() => void copy(true)}
                  className="inline-flex h-6 items-center rounded-md border border-amber-500/40 px-2 font-medium text-amber-900 transition-colors hover:bg-amber-500/10 dark:text-amber-200 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                >
                  {copyAnywayLabel}
                </button>
              )}
            </span>
          </p>
        ) : names.length ? (
          <p className="flex items-center gap-1.5 py-1 text-emerald-700 dark:text-emerald-400">
            <Check aria-hidden className="size-3.5 shrink-0" />
            {readyText}
          </p>
        ) : null}
      </div>
    </div>
  )
}
