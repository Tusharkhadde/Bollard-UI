"use client"

import * as React from "react"
import { Info, ShieldAlert } from "lucide-react"

import { cn } from "@/lib/utils"
import { detectHomoglyphs, type HomoglyphFinding } from "./homoglyph"

export { detectHomoglyphs, skeleton } from "./homoglyph"
export type { HomoglyphFinding, HomoglyphKind, HomoglyphReport } from "./homoglyph"

export interface HomoglyphGuardProps
  extends Omit<React.ComponentProps<"input">, "value" | "defaultValue" | "onChange"> {
  /** Visible label. */
  label?: string
  /** Helper text shown while nothing looks suspicious. */
  hint?: string
  /** Controlled value. */
  value?: string
  /** Initial value when uncontrolled. */
  defaultValue?: string
  /** Called with the new value on every change. */
  onValueChange?: (value: string) => void
  /** Names this field must not imitate (your brand, staff handles). "paypa1" or "rnicrosoft" is flagged against them. */
  protectedNames?: string[]
  /** Shown when look-alike, styled or invisible characters are found. */
  warningMessage?: string
  /** Shown before a protected name the value imitates. */
  impersonationMessage?: string
  /** Text on the fix button, before the plain-ASCII value. */
  fixLabel?: string
  /** Shown when only ambiguous plain characters (0/O, 1/l/I) are present. */
  misreadMessage?: string
  /** Text before the character each finding imitates. */
  looksLikeLabel?: string
}

const fieldClass =
  "h-9 w-full min-w-0 rounded-md border bg-transparent px-3 text-base shadow-xs transition-[color,box-shadow] outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm dark:bg-input/30 data-warning:border-amber-500 dark:data-warning:border-amber-400"
const fixClass =
  "inline-flex h-6 max-w-full items-center gap-1 rounded-md border border-amber-500/40 px-2 font-medium text-amber-900 transition-colors hover:bg-amber-500/10 dark:text-amber-200 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
const NO_NAMES: string[] = []
const flash = "motion-safe:animate-[cui-homoglyph-guard-flash_400ms_ease-out]"
const keyframes = `@keyframes cui-homoglyph-guard-flash{0%{transform:scale(1.35);background-color:rgb(245 158 11 / .6)}100%{transform:scale(1)}}`

/** The value as typed, in a monospace readback, with every suspicious character marked and invisibles made visible. */
function Readback({ chars, findings }: { chars: string[]; findings: HomoglyphFinding[] }) {
  return (
    <p className="font-mono text-sm break-all whitespace-pre-wrap text-foreground">
      {chars.map((ch, i) => {
        const f = findings.find((x) => x.index === i)
        if (!f) return <span key={i}>{ch}</span>
        const tone = f.kind === "ambiguous" ? "bg-sky-500/15 text-sky-900 dark:text-sky-200" : "bg-amber-300/60 text-amber-950 dark:bg-amber-400/25 dark:text-amber-100"
        return f.kind === "invisible" ? (
          <mark key={`${i}${ch}`} title={f.name} className={cn("mx-px inline-block rounded-sm border border-dashed border-amber-500 px-0.5 align-middle font-sans text-[10px] leading-4", tone, flash)}>
            {f.codePoint.slice(2)}
          </mark>
        ) : (
          <mark key={`${i}${ch}`} title={f.name} className={cn("inline-block rounded-sm px-px", tone, flash)}>{ch}</mark>
        )
      })}
    </p>
  )
}

/**
 * A username, handle or domain field that catches look-alike characters before they reach
 * a signup, an allow-list or a payee: a Cyrillic "а" in "pаypal", a Greek "ο", a zero-width
 * space, fullwidth letters, a name written wholly in look-alikes ("ѕсоре"), and ambiguous
 * 0/O and 1/l/I. It names each suspicious character with its real script and code point and
 * offers the plain-ASCII version, while leaving names written in one real script ("иван") alone.
 */
export function HomoglyphGuard({
  label = "Username",
  hint,
  value,
  defaultValue = "",
  onValueChange,
  protectedNames = NO_NAMES,
  warningMessage = "Contains characters that only look like plain letters.",
  impersonationMessage = "Looks like",
  fixLabel = "Use",
  misreadMessage = "Easy to misread when someone reads or types it:",
  looksLikeLabel = "looks like",
  id,
  className,
  ref,
  ...props
}: HomoglyphGuardProps) {
  const [inner, setInner] = React.useState(defaultValue)
  const text = value ?? inner
  const autoId = React.useId()
  const inputId = id ?? autoId
  const report = React.useMemo(() => detectHomoglyphs(text, protectedNames), [text, protectedNames])
  const chars = Array.from(text)
  const serious = report.findings.some((f) => f.kind !== "ambiguous")
  const warn = serious || !!report.impersonates
  const unique = report.findings.filter((f, i, all) => all.findIndex((x) => x.char === f.char) === i)

  const update = (next: string) => {
    if (value === undefined) setInner(next)
    onValueChange?.(next)
  }

  return (
    <div data-slot="homoglyph-guard" className={cn("grid w-full max-w-sm gap-1.5", className)}>
      <style>{keyframes}</style>
      <label htmlFor={inputId} className="w-fit text-sm font-medium">
        {label}
      </label>
      <input
        ref={ref}
        id={inputId}
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        value={text}
        onChange={(event) => update(event.target.value)}
        aria-describedby={`${inputId}-report`}
        data-warning={warn ? "" : undefined}
        className={fieldClass}
        {...props}
      />
      <div id={`${inputId}-report`} aria-live="polite" className="min-h-6 text-xs">
        {report.findings.length > 0 || report.impersonates ? (
          <div className="grid gap-2">
            <div className={cn("flex gap-1.5", warn ? "text-amber-700 dark:text-amber-400" : "text-muted-foreground")}>
              <span className="flex h-6 shrink-0 items-center">
                {warn ? <ShieldAlert aria-hidden className="size-3.5" /> : <Info aria-hidden className="size-3.5" />}
              </span>
              <span className="flex min-w-0 flex-wrap items-center gap-x-2">
                <span className="py-1">
                  {serious ? warningMessage : report.impersonates ? null : misreadMessage}
                  {report.impersonates ? (
                    <> {impersonationMessage} <strong className="font-semibold">{report.impersonates}</strong>.</>
                  ) : null}
                </span>
                {report.ascii ? (
                  <button type="button" onClick={() => update(report.ascii!)} aria-label={`${fixLabel} ${report.ascii}`} className={fixClass}>
                    {fixLabel} <span className="truncate font-mono">{report.ascii}</span>
                  </button>
                ) : null}
              </span>
            </div>
            {report.findings.length > 0 ? (
              <div className="grid gap-2 rounded-md border bg-muted/40 p-2">
                <Readback chars={chars} findings={report.findings} />
                <ul className="grid gap-1 text-muted-foreground">
                  {unique.map((f) => (
                    <li key={f.char} className="flex items-center gap-2">
                      <span className="grid h-6 min-w-6 shrink-0 place-items-center rounded-sm border bg-background px-1 font-mono text-sm text-foreground">
                        {f.kind === "invisible" ? <span className="text-[10px] text-amber-700 dark:text-amber-400">∅</span> : f.char}
                      </span>
                      <span className="min-w-0">
                        <span className="text-foreground">{f.script === "Common" ? "" : `${f.script} · `}</span>
                        <span className="font-mono">{f.codePoint}</span> <span className="lowercase">{f.name}</span>
                        {f.looksLike ? <> · {looksLikeLabel} <span className="font-mono text-foreground">{f.looksLike}</span></> : null}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        ) : hint ? (
          <p className="py-1 text-muted-foreground">{hint}</p>
        ) : null}
      </div>
    </div>
  )
}
