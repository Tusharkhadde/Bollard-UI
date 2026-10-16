"use client"

// Bollard UI — join-preview · MIT licence · https://bollard-ui.vercel.app/components/join-preview

import * as React from "react"
import { ArrowRight, CircleX, LoaderCircle, TriangleAlert } from "lucide-react"

import { cn } from "@/lib/utils"

export type JoinHow = "inner" | "left" | "right" | "full"
export type JoinRow = Record<string, unknown>
/** Ways to loosen key matching. Each is off until the user (or you) turns it on. */
export interface JoinNormalize { text?: boolean; trim?: boolean; case?: boolean; zeros?: boolean }
export type JoinFix = keyof JoinNormalize
/** The relationship you expect: "m:1" means many left rows may share one right row, never the reverse. */
export type JoinCardinality = "1:1" | "m:1" | "1:m" | "m:m"

const INVISIBLE = /[\u00a0\u200b\u200c\u200d\ufeff]/g

/** The comparable form of one key value, or null when it is blank and can never match. */
export function joinKey(values: unknown[], n: JoinNormalize = {}): string | null {
  const parts: string[] = []
  for (const v of values) {
    if (v === null || v === undefined || (typeof v === "number" && Number.isNaN(v))) return null
    let s = String(v)
    if (n.trim) s = s.replace(INVISIBLE, " ").trim()
    if (!s.trim()) return null
    if (n.case) s = s.toLowerCase()
    if (n.zeros) s = s.replace(/^0+(?=\d)/, "")
    parts.push((n.text || typeof v === "string" ? "s:" : `${typeof v}:`) + s)
  }
  return parts.join("\u0001")
}

const typesOf = (rows: JoinRow[], cols: string[]) =>
  new Set(rows.flatMap((r) => cols.map((c) => r[c])).filter((v) => v !== null && v !== undefined && v !== "").map((v) => typeof v))

function count(rows: JoinRow[], cols: string[], n: JoinNormalize) {
  const map = new Map<string, { count: number; sample: unknown }>()
  let blank = 0
  for (const row of rows) {
    const k = joinKey(cols.map((c) => row[c]), n)
    if (k === null) blank++
    else {
      const hit = map.get(k)
      if (hit) hit.count++
      else map.set(k, { count: 1, sample: cols.map((c) => row[c]).join(" · ") })
    }
  }
  return { map, blank }
}

/** Predicts what a join will do before you run it: row counts for every join type, fan-out, unmatched and blank keys, and which normalisation would rescue unmatched rows. */
export function analyzeJoin(left: JoinRow[], right: JoinRow[], leftOn: string[], rightOn: string[], n: JoinNormalize = {}) {
  const L = count(left, leftOn, n)
  const R = count(right, rightOn, n)
  let pairs = 0, matchedLeft = 0, matchedRight = 0
  const fanout: { key: string; left: number; right: number }[] = []
  for (const [k, l] of L.map) {
    const r = R.map.get(k)
    if (!r) continue
    pairs += l.count * r.count
    matchedLeft += l.count
    matchedRight += r.count
    if (l.count > 1 || r.count > 1) fanout.push({ key: String(l.sample), left: l.count, right: r.count })
  }
  const unmatchedLeft = left.length - matchedLeft
  const unmatchedRight = right.length - matchedRight
  const repeats = (m: Map<string, { count: number; sample: unknown }>) => [...m.values()].filter((v) => v.count > 1)
  const lt = typesOf(left, leftOn), rt = typesOf(right, rightOn)
  const typeMismatch = !n.text && [...lt].some((t) => !rt.has(t)) && lt.size > 0 && rt.size > 0
  return {
    pairs, matchedLeft, matchedRight, unmatchedLeft, unmatchedRight,
    blankLeft: L.blank, blankRight: R.blank,
    counts: { inner: pairs, left: pairs + unmatchedLeft, right: pairs + unmatchedRight, full: pairs + unmatchedLeft + unmatchedRight } as Record<JoinHow, number>,
    fanout: fanout.sort((a, b) => b.left * b.right - a.left * a.right),
    leftRepeats: repeats(L.map), rightRepeats: repeats(R.map),
    typeMismatch, leftTypes: [...lt], rightTypes: [...rt],
  }
}

/** For each fix not yet on, how many more left rows would find a match, with one example pair. */
export function joinRescues(left: JoinRow[], right: JoinRow[], leftOn: string[], rightOn: string[], n: JoinNormalize = {}) {
  const base = analyzeJoin(left, right, leftOn, rightOn, n)
  const out: { fix: JoinFix; rows: number; example?: [string, string] }[] = []
  for (const fix of (["text", "trim", "case", "zeros"] as JoinFix[]).filter((f) => !n[f])) {
    if (fix !== "text" && base.typeMismatch) continue
    const next = { ...n, [fix]: true }
    const rows = analyzeJoin(left, right, leftOn, rightOn, next).matchedLeft - base.matchedLeft
    if (rows <= 0) continue
    const rightKeys = new Map(right.map((r) => [joinKey(rightOn.map((c) => r[c]), next), rightOn.map((c) => r[c]).join(" · ")]))
    const was = new Set(right.map((r) => joinKey(rightOn.map((c) => r[c]), n)))
    const hit = left.find((r) => !was.has(joinKey(leftOn.map((c) => r[c]), n)) && rightKeys.has(joinKey(leftOn.map((c) => r[c]), next)))
    out.push({ fix, rows, example: hit ? [leftOn.map((c) => hit[c]).join(" · "), String(rightKeys.get(joinKey(leftOn.map((c) => hit[c]), next)))] : undefined })
  }
  return out
}

export interface JoinPreviewMessages {
  rows: string; copies: string; dropped: string; blanks: string; extra: string
  fanout: string; fanoutRow: string; expectBroken: string; blankKeys: string
  text: string; trim: string; case: string; zeros: string; rescue: string; join: string; failed: string
  how: Record<JoinHow, string>
  /** Accessible name of the preview, with {left} and {right}. */
  label?: string
  /** How each expected cardinality reads inside `expectBroken`, with {left} and {right}. */
  expectText?: Partial<Record<JoinCardinality, string>>
}

const DEFAULTS: JoinPreviewMessages = {
  rows: "{count} rows",
  copies: "+{count} copies from fan-out",
  dropped: "−{count} dropped, no match",
  blanks: "{count} with empty {other} columns",
  extra: "+{count} only in {other}",
  fanout: "Some keys repeat, so matching rows are copied.",
  fanoutRow: "{key}: {left} × {right} → {total} rows",
  expectBroken: "You expect {expect}, but some {table} keys repeat (e.g. {key}). The join will copy rows.",
  blankKeys: "{count} in {table} have no key and will never match.",
  text: "The key is {leftType} in {left} but {rightType} in {right}, so nothing compares equal.",
  trim: "Some keys only differ by spaces, e.g. “{a}” and “{b}”.",
  case: "Some keys only differ by case, e.g. “{a}” and “{b}”.",
  zeros: "Some keys only differ by leading zeros, e.g. “{a}” and “{b}”.",
  rescue: "{fix} · matches {count} more",
  join: "Join · {count} rows",
  failed: "The join failed. Nothing was changed.",
  how: { inner: "Inner", left: "Left", right: "Right", full: "Full" },
  label: "Join preview: {left} with {right}",
}
const FIX_LABELS: Record<JoinFix, string> = { text: "Compare as text", trim: "Trim spaces", case: "Ignore case", zeros: "Ignore leading zeros" }
const EXPECT_TEXT: Record<JoinCardinality, string> = { "1:1": "one-to-one", "m:1": "each {left} row to match at most one {right} row", "1:m": "each {right} row to match at most one {left} row", "m:m": "" }

const typeName = (types: string[]) => types.map((x) => (x === "string" ? "text" : x === "number" ? "a number" : x)).join(" or ")
const fill = (t: string, v: Record<string, string | number>) => t.replace(/\{(\w+)\}/g, (m, k: string) => String(v[k] ?? m))
const fixClass =
  "inline-flex h-6 max-w-full items-center gap-1 rounded-md border border-amber-500/40 px-2 font-medium text-amber-900 transition-colors hover:bg-amber-500/10 dark:text-amber-200 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"

export interface JoinPreviewProps extends Omit<React.ComponentProps<"section">, "children"> {
  /** Left table: a display name and its rows. */
  left: { name: string; rows: JoinRow[] }
  /** Right table: a display name and its rows. */
  right: { name: string; rows: JoinRow[] }
  /** Key column(s) on the left. */
  leftOn: string | string[]
  /** Key column(s) on the right. Defaults to `leftOn`. */
  rightOn?: string | string[]
  /** Controlled join type. */
  how?: JoinHow
  /** Initial join type when uncontrolled. */
  defaultHow?: JoinHow
  /** Called when the user picks a join type. */
  onHowChange?: (how: JoinHow) => void
  /** Controlled key normalisation. */
  normalize?: JoinNormalize
  /** Initial key normalisation when uncontrolled. */
  defaultNormalize?: JoinNormalize
  /** Called when the user toggles a key normalisation. */
  onNormalizeChange?: (normalize: JoinNormalize) => void
  /** Cardinality you expect. Breaking it turns the fan-out warning red. */
  expect?: JoinCardinality
  /** Runs the join. May return a Promise; the button shows a pending state. */
  onJoin?: (plan: { how: JoinHow; normalize: JoinNormalize }) => void | Promise<unknown>
  /** Locale for numbers. */
  locale?: string
  /** Every visible string, with `{placeholders}`. */
  messages?: Partial<JoinPreviewMessages>
}

/**
 * Shows what a join will do before it runs: rows before and after for every join type, rows
 * copied by fan-out (with the keys causing it), rows dropped for having no match, blank keys,
 * and keys that never match because of type, spaces, case or leading zeros, each with a
 * one-tap fix that says how many rows it rescues.
 */
export function JoinPreview({
  left, right, leftOn, rightOn, how, defaultHow = "left", onHowChange, normalize, defaultNormalize = {}, onNormalizeChange,
  expect, onJoin, locale, messages, className, ...props
}: JoinPreviewProps) {
  const t = { ...DEFAULTS, ...messages, how: { ...DEFAULTS.how, ...messages?.how } }
  const expectText = { ...EXPECT_TEXT, ...messages?.expectText }
  const [innerHow, setInnerHow] = React.useState(defaultHow)
  const [innerNorm, setInnerNorm] = React.useState(defaultNormalize)
  const [state, setState] = React.useState<"idle" | "pending" | "error">("idle")
  const radios = React.useRef<(HTMLButtonElement | null)[]>([])
  const kind = how ?? innerHow
  const norm = normalize ?? innerNorm
  const lOn = [leftOn].flat(), rOn = [rightOn ?? leftOn].flat()
  const a = React.useMemo(() => analyzeJoin(left.rows, right.rows, lOn, rOn, norm), [left.rows, right.rows, lOn.join(), rOn.join(), norm]) // eslint-disable-line react-hooks/exhaustive-deps
  const rescues = React.useMemo(() => joinRescues(left.rows, right.rows, lOn, rOn, norm), [left.rows, right.rows, lOn.join(), rOn.join(), norm]) // eslint-disable-line react-hooks/exhaustive-deps
  const nf = new Intl.NumberFormat(locale)

  const setHow = (next: JoinHow) => { if (how === undefined) setInnerHow(next); onHowChange?.(next) }
  const applyFix = (fix: JoinFix) => {
    const next = { ...norm, [fix]: true }
    if (normalize === undefined) setInnerNorm(next)
    onNormalizeChange?.(next)
  }

  const baseIsRight = kind === "right"
  const base = baseIsRight ? right : left
  const other = baseIsRight ? left : right
  const matchedBase = baseIsRight ? a.matchedRight : a.matchedLeft
  const unmatchedBase = baseIsRight ? a.unmatchedRight : a.unmatchedLeft
  const copies = a.pairs - matchedBase
  const result = a.counts[kind]
  const repeatsOn = expect === "m:1" ? "right" : expect === "1:m" ? "left" : expect === "1:1" ? (a.rightRepeats.length ? "right" : "left") : null
  const broken = repeatsOn && (repeatsOn === "right" ? a.rightRepeats : a.leftRepeats)
  const hows: JoinHow[] = ["inner", "left", "right", "full"]
  const typeText = fill(t.text, { leftType: typeName(a.leftTypes), rightType: typeName(a.rightTypes), left: left.name, right: right.name })

  const run = async () => {
    if (!onJoin || state === "pending") return
    setState("pending")
    try { await onJoin({ how: kind, normalize: norm }); setState("idle") } catch { setState("error") }
  }
  const onKeyDown = (event: React.KeyboardEvent) => {
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key]
    const jump = { Home: 0, End: hows.length - 1 }[event.key]
    if (!step && jump === undefined) return
    event.preventDefault()
    const next = jump !== undefined ? hows[jump] : hows[(hows.indexOf(kind) + step! + hows.length) % hows.length]
    setHow(next)
    radios.current[hows.indexOf(next)]?.focus()
  }

  const chips = [
    copies > 0 && { tone: "warn", text: fill(t.copies, { count: nf.format(copies) }) },
    unmatchedBase > 0 && kind === "inner" && { tone: "bad", text: fill(t.dropped, { count: nf.format(unmatchedBase) }) },
    unmatchedBase > 0 && kind !== "inner" && { tone: "warn", text: fill(t.blanks, { count: nf.format(unmatchedBase), other: other.name }) },
    kind === "full" && a.unmatchedRight > 0 && { tone: "info", text: fill(t.extra, { count: nf.format(a.unmatchedRight), other: right.name }) },
  ].filter(Boolean) as { tone: string; text: string }[]

  return (
    <section data-slot="join-preview" aria-label={fill(t.label!, { left: left.name, right: right.name })} className={cn("grid w-full min-w-0 max-w-md gap-3 rounded-lg border bg-card p-3 text-sm text-card-foreground", className)} {...props}>
      <div role="radiogroup" aria-label="Join type" onKeyDown={onKeyDown} className="grid grid-cols-4 gap-1 rounded-md bg-muted p-1">
        {hows.map((h, i) => (
          <button
            key={h}
            ref={(el) => { radios.current[i] = el }}
            type="button"
            role="radio"
            aria-checked={kind === h}
            tabIndex={kind === h ? 0 : -1}
            onClick={() => setHow(h)}
            className={cn("grid min-w-0 rounded px-1 py-1 text-xs transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50", kind === h ? "bg-background font-medium shadow-xs dark:bg-input/40" : "text-muted-foreground hover:text-foreground")}
          >
            {t.how[h]}
            <span className="truncate tabular-nums">{nf.format(a.counts[h])}</span>
          </button>
        ))}
      </div>

      <div aria-live="polite" className="grid gap-1.5">
        <p className="flex flex-wrap items-center gap-2">
          <span className="text-muted-foreground">{base.name}</span>
          <span className="font-medium tabular-nums">{fill(t.rows, { count: nf.format(base.rows.length) })}</span>
          <ArrowRight aria-hidden className="size-4 text-muted-foreground" />
          <span className={cn("font-semibold tabular-nums", result !== base.rows.length && "text-amber-700 dark:text-amber-400")}>{fill(t.rows, { count: nf.format(result) })}</span>
        </p>
        {chips.length > 0 && (
          <ul className="flex flex-wrap gap-1.5 text-xs">
            {chips.map((c) => (
              <li key={c.text} className={cn("rounded-md px-1.5 py-0.5 tabular-nums", c.tone === "bad" ? "bg-red-500/10 text-red-700 dark:text-red-400" : c.tone === "warn" ? "bg-amber-500/10 text-amber-800 dark:text-amber-300" : "bg-muted text-muted-foreground")}>{c.text}</li>
            ))}
          </ul>
        )}
      </div>

      <div aria-live="polite" className="grid gap-1 text-xs empty:hidden">
        {a.typeMismatch && !rescues.some((r) => r.fix === "text") && <Note tone="danger" text={typeText} />}
        {rescues.map((r) => (
          <Note
            key={r.fix}
            tone={r.fix === "text" ? "danger" : "warning"}
            text={r.fix === "text" ? typeText : fill(t[r.fix], { a: r.example?.[0] ?? "", b: r.example?.[1] ?? "" })}
            fix={fill(t.rescue, { fix: FIX_LABELS[r.fix], count: nf.format(r.rows) })}
            onFix={() => applyFix(r.fix)}
          />
        ))}
        {broken && broken.length > 0 ? (
          <Note tone="danger" text={fill(t.expectBroken, { expect: fill(expectText[expect!], { left: left.name, right: right.name }), count: broken.length, table: repeatsOn === "right" ? right.name : left.name, key: `${broken[0].sample} ×${broken[0].count}` })} />
        ) : copies > 0 ? (
          <Note tone="warning" text={t.fanout} />
        ) : null}
        {copies > 0 && (
          <ul className="grid gap-0.5 pl-5 text-muted-foreground tabular-nums">
            {a.fanout.filter((f) => (baseIsRight ? f.left : f.right) > 1).slice(0, 3).map((f) => (
              <li key={f.key}>{fill(t.fanoutRow, { key: f.key, left: `${f.left} ${left.name}`, right: `${f.right} ${right.name}`, total: f.left * f.right })}</li>
            ))}
          </ul>
        )}
        {a.blankLeft > 0 && <Note tone="warning" text={fill(t.blankKeys, { count: a.blankLeft, table: left.name })} />}
        {a.blankRight > 0 && <Note tone="warning" text={fill(t.blankKeys, { count: a.blankRight, table: right.name })} />}
      </div>

      {onJoin && (
        <div className="flex flex-wrap items-center justify-end gap-2">
          {state === "error" && <p role="alert" className="mr-auto text-xs text-red-700 dark:text-red-400">{t.failed}</p>}
          <button type="button" onClick={run} aria-busy={state === "pending"} className="inline-flex h-9 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow-xs transition-colors hover:bg-primary/90 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-60" disabled={state === "pending"}>
            {state === "pending" && <LoaderCircle aria-hidden className="size-4 animate-spin" />}
            {fill(t.join, { count: nf.format(result) })}
          </button>
        </div>
      )}
    </section>
  )
}

function Note({ tone, text, fix, onFix }: { tone: "warning" | "danger"; text: string; fix?: string; onFix?: () => void }) {
  const Icon = tone === "danger" ? CircleX : TriangleAlert
  return (
    <p className={cn("flex gap-1.5", tone === "danger" ? "text-red-700 dark:text-red-400" : "text-amber-700 dark:text-amber-400")}>
      <span className="flex h-6 shrink-0 items-center"><Icon aria-hidden className="size-3.5" /></span>
      <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
        {text && <span className="min-w-0 py-1 [overflow-wrap:anywhere]">{text}</span>}
        {fix && <button type="button" onClick={onFix} className={fixClass}><span className="truncate">{fix}</span></button>}
      </span>
    </p>
  )
}
