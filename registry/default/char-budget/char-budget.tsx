"use client"

import * as React from "react"
import { TriangleAlert, WandSparkles } from "lucide-react"

import { cn } from "@/lib/utils"

export type CharTarget =
  | { kind: "x"; label?: string }
  | { kind: "sms"; label?: string; /** Most segments you are willing to pay for. */ maxSegments?: number }
  | { kind: "graphemes"; label: string; limit: number; /** Search snippets cut off around, not exactly at, the limit. */ soft?: boolean }

export const CHAR_TARGETS = {
  x: { kind: "x" },
  sms: { kind: "sms", maxSegments: 1 },
  linkedin: { kind: "graphemes", label: "LinkedIn post", limit: 3000 },
  meta: { kind: "graphemes", label: "Meta description", limit: 160, soft: true },
} satisfies Record<string, CharTarget>

const GSM_BASIC = "@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà"
const GSM_EXTENDED = "\f^{}\\[~]|€"
const GSM_SAFE: Record<string, string> = { "‘": "'", "’": "'", "‚": "'", "“": '"', "”": '"', "„": '"', "–": "-", "—": "-", "…": "...", "\u00a0": " ", "′": "'", "″": '"' }
const NAMES: Record<string, string> = { "‘": "curly quote", "’": "curly apostrophe", "“": "curly quote", "”": "curly quote", "–": "en dash", "—": "em dash", "…": "ellipsis", "\u00a0": "non-breaking space" }

let segmenter: Intl.Segmenter | null | undefined

/** User-perceived characters: 👍🏽 or 🇮🇳 count once. Falls back to code points without Intl.Segmenter. */
export function graphemes(text: string): string[] {
  if (segmenter === undefined) segmenter = typeof Intl !== "undefined" && "Segmenter" in Intl ? new Intl.Segmenter(undefined, { granularity: "grapheme" }) : null
  return segmenter ? Array.from(segmenter.segment(text), (s) => s.segment) : Array.from(text)
}

/** X counts URLs as 23, and emoji, CJK and most non-Latin characters as 2. */
export function xLength(text: string) {
  const withoutUrls = text.replace(/https?:\/\/\S+/g, "")
  const urls = (text.match(/https?:\/\/\S+/g) ?? []).length
  const light = (cp: number) => cp <= 4351 || (cp >= 8192 && cp <= 8205) || (cp >= 8208 && cp <= 8223) || (cp >= 8242 && cp <= 8247)
  return urls * 23 + graphemes(withoutUrls).reduce((sum, g) => sum + (/\p{Extended_Pictographic}/u.test(g) || !light(g.codePointAt(0) ?? 0) ? 2 : 1), 0)
}

/** GSM-7 vs UCS-2 segment math, including 2-septet extended characters and no split pairs. */
export function smsInfo(text: string) {
  const culprits = graphemes(text).filter((g) => [...g].some((c) => !GSM_BASIC.includes(c) && !GSM_EXTENDED.includes(c)))
  const ucs2 = culprits.length > 0
  const units = Array.from(text, (c) => (ucs2 ? c.length : GSM_EXTENDED.includes(c) ? 2 : 1))
  const total = units.reduce((a, b) => a + b, 0)
  const [single, multi] = ucs2 ? [70, 67] : [160, 153]
  let segments = total === 0 ? 0 : 1
  if (total > single) {
    let used = 0
    for (const unit of units) {
      if (used + unit > multi) {
        segments++
        used = 0
      }
      used += unit
    }
  }
  return { encoding: ucs2 ? "UCS-2" : "GSM-7", total, segments, single, multi, culprits }
}

export interface CharBudgetProps
  extends Omit<React.ComponentProps<"textarea">, "value" | "defaultValue" | "onChange"> {
  /** Visible label. */
  label?: string
  /** Controlled text. */
  value?: string
  /** Initial text when uncontrolled. */
  defaultValue?: string
  /** Called on every edit, including one-tap fixes. */
  onValueChange?: (value: string) => void
  /** Limits to check at once; defaults to X, SMS, LinkedIn and a meta description. */
  targets?: CharTarget[]
  /** Text of the warning shown when a character forces the SMS into UCS-2. */
  ucs2Message?: string
  /** Label of the fix that swaps curly quotes, dashes and ellipses for plain ones. */
  plainLabel?: string
  /** Reword or translate the counter's labels and announcements. */
  messages?: Partial<typeof CHAR_BUDGET_MESSAGES>
}

const fieldClass =
  "min-h-24 w-full min-w-0 resize-y rounded-md border bg-transparent px-3 py-2 text-base shadow-xs transition-[color,box-shadow] outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm dark:bg-input/30 data-warning:border-amber-500 dark:data-warning:border-amber-400"
const fixClass =
  "inline-flex h-6 items-center gap-1 rounded-md border border-amber-500/40 px-2 font-medium text-amber-900 transition-colors hover:bg-amber-500/10 dark:text-amber-200 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"

const describeChar = (g: string) =>
  NAMES[g] ?? (/\p{Extended_Pictographic}/u.test(g) ? "emoji" : `U+${g.codePointAt(0)?.toString(16).toUpperCase().padStart(4, "0")}`)

/** Every sentence and label the counter shows. Override any of them to reword or translate. */
export const CHAR_BUDGET_MESSAGES = {
  xLabel: "X post",
  smsLabel: "SMS",
  smsNote: (encoding: string, parts: number) => `${encoding} · ${parts} part${parts === 1 ? "" : "s"}`,
  over: (count: string) => `${count} over`,
  tooLong: (labels: string) => `Too long for ${labels}`,
  fits: "Fits every target",
  find: (name: string) => `Find ${name}`,
}

/** Measures text against each target and says whether it is over or close to the limit. */
export function measureTargets(text: string, targets: CharTarget[], messages: Partial<typeof CHAR_BUDGET_MESSAGES> = {}) {
  const t = { ...CHAR_BUDGET_MESSAGES, ...messages }
  const sms = smsInfo(text)
  const count = graphemes(text).length
  return targets.map((target) => {
    if (target.kind === "x") {
      const used = xLength(text)
      return { label: target.label ?? t.xLabel, used, limit: 280, soft: false, note: "", over: used > 280 }
    }
    if (target.kind === "sms") {
      const max = target.maxSegments ?? 1
      const note = t.smsNote(sms.encoding, sms.segments)
      return { label: target.label ?? t.smsLabel, used: sms.total, limit: max === 1 ? sms.single : sms.multi * max, soft: false, note, over: sms.segments > max }
    }
    return { label: target.label, used: count, limit: target.limit, soft: !!target.soft, note: "", over: count > target.limit }
  })
}

/**
 * A textarea checked against every place the text is going at once. It counts what people see
 * (graphemes, not code units), uses each platform's own rules, and names the exact character that
 * silently turned a 1-part SMS into a pricier UCS-2 message, with a one-tap fix where one exists.
 */
export function CharBudget({
  label = "Message",
  value,
  defaultValue = "",
  onValueChange,
  targets = Object.values(CHAR_TARGETS),
  ucs2Message = "These switch the SMS to UCS-2, 70 characters per part instead of 160. Tap one to find it.",
  plainLabel = "Use plain characters",
  messages,
  rows = 5,
  id,
  className,
  ref,
  ...props
}: CharBudgetProps) {
  const [inner, setInner] = React.useState(defaultValue)
  const textareaRef = React.useRef<HTMLTextAreaElement>(null)
  const autoId = React.useId()
  const inputId = id ?? autoId
  const text = value ?? inner
  React.useImperativeHandle(ref, () => textareaRef.current as HTMLTextAreaElement)

  const update = (next: string) => {
    if (value === undefined) setInner(next)
    onValueChange?.(next)
  }

  const t = { ...CHAR_BUDGET_MESSAGES, ...messages }
  const rowsData = measureTargets(text, targets, messages)
  const overLabels = rowsData.filter((row) => row.over).map((row) => row.label)
  const culprits = targets.some((t) => t.kind === "sms") ? smsInfo(text).culprits : []
  const unique = [...new Set(culprits)]
  const fixable = culprits.some((g) => GSM_SAFE[g])

  /** Selects the next occurrence of a character after the caret, wrapping around. */
  const find = (grapheme: string) => {
    const el = textareaRef.current
    if (!el) return
    const from = el.selectionStart === el.selectionEnd || text.slice(el.selectionStart, el.selectionEnd) !== grapheme ? el.selectionStart : el.selectionEnd
    const start = text.indexOf(grapheme, from) >= 0 ? text.indexOf(grapheme, from) : text.indexOf(grapheme)
    el.focus()
    el.setSelectionRange(start, start + grapheme.length)
  }

  return (
    <div data-slot="char-budget" className={cn("grid w-full max-w-sm gap-1.5", className)}>
      <label htmlFor={inputId} className="w-fit text-sm font-medium">{label}</label>
      <textarea
        ref={textareaRef}
        id={inputId}
        rows={rows}
        value={text}
        aria-describedby={`${inputId}-summary`}
        data-warning={overLabels.length || unique.length ? "" : undefined}
        onChange={(event) => update(event.target.value)}
        className={fieldClass}
        {...props}
      />
      <p id={`${inputId}-summary`} aria-live="polite" className="sr-only">
        {overLabels.length ? t.tooLong(overLabels.join(", ")) : t.fits}
      </p>
      <ul className="grid gap-2 pt-1">
        {rowsData.map((row) => {
          const near = !row.over && row.used >= row.limit * 0.9
          return (
            <li key={row.label} className="grid gap-1">
              <div className="flex items-baseline justify-between gap-2 text-xs">
                <span className="font-medium">
                  {row.label} {row.note && <span className="font-normal text-muted-foreground">· {row.note}</span>}
                </span>
                <span className={cn("shrink-0 tabular-nums", row.over ? "text-red-600 dark:text-red-400" : near ? "text-amber-700 dark:text-amber-400" : "text-muted-foreground")}>
                  {row.used.toLocaleString()} / {row.soft ? "~" : ""}{row.limit.toLocaleString()}
                  {row.over && row.used > row.limit && ` · ${t.over((row.used - row.limit).toLocaleString())}`}
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
                <div
                  className={cn("h-full rounded-full transition-[width]", row.over ? "bg-red-500" : near ? "bg-amber-500" : "bg-emerald-500")}
                  style={{ width: `${Math.min(100, (row.used / row.limit) * 100)}%` }}
                />
              </div>
            </li>
          )
        })}
      </ul>
      {unique.length > 0 && (
        <div aria-live="polite" className="flex gap-1.5 pt-1 text-xs text-amber-700 dark:text-amber-400">
          <span className="flex h-6 shrink-0 items-center"><TriangleAlert aria-hidden className="size-3.5" /></span>
          <div className="grid min-w-0 gap-1.5">
            <span className="py-1">{ucs2Message}</span>
            <div className="flex flex-wrap gap-1.5">
              {unique.map((g) => (
                <button key={g} type="button" onClick={() => find(g)} aria-label={t.find(describeChar(g))} className={cn(fixClass, "font-normal")}>
                  <span className="font-mono font-semibold">{g === "\u00a0" ? "␣" : g}</span>
                  {describeChar(g)} ×{culprits.filter((c) => c === g).length}
                </button>
              ))}
              {fixable && (
                <button type="button" onClick={() => update(graphemes(text).map((g) => GSM_SAFE[g] ?? g).join(""))} className={fixClass}>
                  <WandSparkles aria-hidden className="size-3.5" />
                  {plainLabel}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
