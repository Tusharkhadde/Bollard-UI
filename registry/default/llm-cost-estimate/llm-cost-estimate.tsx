"use client"

import * as React from "react"
import { Coins, Info, Loader2, PiggyBank, TriangleAlert } from "lucide-react"

import { cn } from "@/lib/utils"
import { checkRun, estimateCost, estimateTokens, priceFactor, type CostFinding, type ModelPrice } from "./cost"

export { checkRun, estimateCost, estimateTokens, priceFactor, suggestMaxTokens, type CostEstimate, type CostFinding, type ModelPrice, type RunPlan } from "./cost"

/** Every visible string. Values in `{braces}` are filled in. */
export const LLM_COST_MESSAGES = {
  heading: "Before you run",
  asOf: "Prices from your table, as of {date}",
  model: "Model",
  maxTokens: "max_tokens",
  notSet: "not set",
  perMillion: "{input} in / {output} out per 1M",
  perMillionBatch: "{input} in / {output} out per 1M at the batch rate",
  batch: "Use the Batch API",
  batchHint: "{discount} cheaper. Results can take up to 24 hours.",
  batchSaving: "Not urgent? Through the Batch API this costs ≈{batch} instead of ≈{cost}, with results within 24 hours.",
  expected: "Estimated cost",
  worst: "up to {cost} if every reply hits the limit",
  shape: "{items} × {input} input + {output} output tokens",
  shapeOne: "{input} input + {output} output tokens",
  outputUnknown: "up to {output}",
  estimatedNote: "Input is estimated from the text (code and non-English text count heavier). Pass a tokenizer count for exact numbers.",
  noMaxTokens: "No max_tokens: each reply can run to {limit} tokens, so the worst case is {worst}.",
  setMax: "Set max_tokens to {n}",
  overflowInput: "Each request is ≈{needed} tokens, but {model} holds {window}. These requests will fail.",
  overflowReply: "≈{input} input plus max_tokens {reply} is over {model}'s {window}-token window.",
  switchTo: "Switch to {model}",
  lowerTo: "Lower max_tokens to {n}",
  jump: "That's {factor}× your last run ({last}).",
  costlyBulk: "For {items} requests, {model} would cost ≈{cheaper} instead of ≈{cost}, if its quality is enough.",
  stale: "These prices are {days} days old. Check current rates before a large run.",
  keep: "Keep",
  summaryIssues: "{count} things to check before spending {cost}.",
  summaryOk: "Estimated {cost}.",
  run: "Run {items} · ≈{cost}",
  runAnyway: "Run anyway · ≈{cost}",
  requests: "{n} requests",
  request: "1 request",
}

export type LlmCostMessages = typeof LLM_COST_MESSAGES

const fill = (template: string, values: Record<string, string | number>) =>
  template.replace(/\{(\w+)\}/g, (match, key: string) => String(values[key] ?? match))

const toTime = (d: unknown) => {
  const time = d instanceof Date ? d.getTime() : typeof d === "string" || typeof d === "number" ? new Date(d).getTime() : NaN
  return Number.isFinite(time) ? time : null
}

export interface LlmCostEstimateProps extends Omit<React.ComponentProps<"div">, "defaultValue" | "onChange"> {
  /** Your price table. Nothing is hard-coded: prices change, so pass the ones you read and when. */
  models: ModelPrice[]
  /** When the prices in `models` were read. Shown, and flagged once older than `staleAfterDays`. */
  pricesAsOf: string | number | Date
  /** Controlled model id. */
  model?: string
  /** Initial model id when uncontrolled. Defaults to the first row. */
  defaultModel?: string
  /** Called with the chosen model id. */
  onModelChange?: (id: string) => void
  /** Controlled max_tokens; `null` means not set. */
  maxTokens?: number | null
  /** Initial max_tokens when uncontrolled. */
  defaultMaxTokens?: number | null
  /** Called with the new max_tokens, or null when cleared. */
  onMaxTokensChange?: (value: number | null) => void
  /** Controlled: send through the Batch API (needs `batchDiscount` on the model). */
  batch?: boolean
  /** Initial batch choice when uncontrolled. */
  defaultBatch?: boolean
  /** Called when the Batch API toggle changes. */
  onBatchChange?: (batch: boolean) => void
  /** Requests in the run. */
  items?: number
  /** One request's prompt, to estimate input tokens from. Ignored when `inputTokens` is given. */
  prompt?: string
  /** Exact input tokens per request from a real tokenizer. */
  inputTokens?: number
  /** Typical reply length in tokens, if you know it. */
  expectedOutputTokens?: number
  /** Cost of the last comparable run, to catch a run many times bigger. */
  lastRunCost?: number
  /** Multiple of the last run that counts as a jump. */
  jumpFactor?: number
  /** Requests at which the run counts as bulk, for the costly-model check. */
  bulkItems?: number
  /** How many times pricier than the cheapest fitting model counts as costly. */
  costlyFactor?: number
  /** Days after pricesAsOf before the price table is called stale. */
  staleAfterDays?: number
  /** ISO 4217 code for the table's prices. */
  currency?: string
  /** BCP 47 locale for numbers and currency. */
  locale?: string
  /** "Now" in epoch ms, for deterministic rendering. Read from the clock after mount when omitted. */
  now?: number
  /** Called on Run. With findings left, the first click jumps to them and the second runs. May return a Promise. */
  onRun?: (run: { model: string; maxTokens: number | null; batch: boolean; expectedCost: number; worstCost: number }) => void | Promise<void>
  /** Any visible string. */
  messages?: Partial<LlmCostMessages>
}

/**
 * Shown before a batch or a long prompt goes to an LLM API. It estimates input and output tokens
 * and the cost from your own price table, and catches the expensive mistakes: no max_tokens (so
 * every reply may run to the model's limit), a request bigger than the context window, a run many
 * times the last one, and a premium model picked for a bulk job, with one-tap fixes.
 */
export function LlmCostEstimate({
  models: modelsProp,
  pricesAsOf,
  model: modelProp,
  defaultModel,
  onModelChange,
  maxTokens: maxProp,
  defaultMaxTokens = null,
  onMaxTokensChange,
  batch: batchProp,
  defaultBatch = false,
  onBatchChange,
  items: itemsProp = 1,
  prompt,
  inputTokens: inputProp,
  expectedOutputTokens,
  lastRunCost,
  jumpFactor = 10,
  bulkItems = 100,
  costlyFactor = 10,
  staleAfterDays = 60,
  currency = "USD",
  locale,
  now: nowProp,
  onRun,
  messages,
  className,
  ...props
}: LlmCostEstimateProps) {
  const t = { ...LLM_COST_MESSAGES, ...messages }
  const models = (Array.isArray(modelsProp) ? modelsProp : []).filter((m): m is ModelPrice => !!m && typeof m.id === "string")
  const [innerModel, setInnerModel] = React.useState(defaultModel ?? models[0]?.id ?? "")
  const [innerMax, setInnerMax] = React.useState<number | null>(defaultMaxTokens)
  const maxTokens = maxProp !== undefined ? maxProp : innerMax
  const [innerBatch, setInnerBatch] = React.useState(defaultBatch)
  const [draft, setDraft] = React.useState(maxTokens == null ? "" : String(maxTokens))
  const [clock, setClock] = React.useState<number>()
  const [kept, setKept] = React.useState<Set<string>>(() => new Set())
  const [asked, setAsked] = React.useState(false)
  const [pending, setPending] = React.useState(false)
  const [announcement, setAnnouncement] = React.useState("")
  const rootRef = React.useRef<HTMLDivElement>(null)
  const maxRef = React.useRef<HTMLInputElement>(null)
  const id = React.useId()

  React.useEffect(() => {
    if (nowProp === undefined) setClock(Date.now())
  }, [nowProp])
  React.useEffect(() => {
    setDraft(maxTokens == null ? "" : String(maxTokens))
  }, [maxTokens])

  const model = models.find((m) => m.id === (modelProp ?? innerModel)) ?? models[0]
  const canBatch = !!model && (model.batchDiscount ?? 0) > 0 && (model.batchDiscount ?? 0) < 1
  const batch = canBatch && (batchProp ?? innerBatch)
  const items = Number.isFinite(itemsProp) && itemsProp > 0 ? Math.floor(itemsProp) : 0
  const input = Number.isFinite(inputProp) && (inputProp as number) >= 0 ? (inputProp as number) : estimateTokens(prompt)
  const plan = { items, inputTokens: input, expectedOutputTokens, maxTokens, batch }
  const asOf = toTime(pricesAsOf)
  const est = model ? estimateCost(model, plan) : null
  const findings = model
    ? checkRun(model, plan, { models, lastCost: lastRunCost, jumpFactor, bulkItems, costlyFactor, pricesAsOf: asOf, now: nowProp ?? clock, staleAfterDays }).filter((f) => !kept.has(f.kind))
    : []
  const advisory = (f: CostFinding) => f.kind === "stalePrices" || f.kind === "batchSaving"
  const blocking = findings.filter((f) => !advisory(f))

  const nf = (n: number) => new Intl.NumberFormat(locale).format(Math.round(n))
  const money = (n: number) => {
    const digits = n > 0 && n < 1 ? 4 : n < 100 ? 2 : 0
    try {
      return new Intl.NumberFormat(locale, { style: "currency", currency, maximumFractionDigits: digits, minimumFractionDigits: Math.min(digits, 2) }).format(n)
    } catch {
      return `${n.toFixed(digits)} ${currency}`
    }
  }
  const date = asOf === null ? String(pricesAsOf ?? "") : new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", year: "numeric" }).format(asOf)
  const cost = est ? money(est.expected) : "—"

  const summary = est ? (blocking.length ? fill(t.summaryIssues, { count: blocking.length, cost }) : fill(t.summaryOk, { cost })) : ""
  React.useEffect(() => {
    const timer = setTimeout(() => setAnnouncement(summary), 700)
    return () => clearTimeout(timer)
  }, [summary])

  const setModel = (next: string) => {
    if (modelProp === undefined) setInnerModel(next)
    onModelChange?.(next)
    setAsked(false)
  }
  const setBatch = (next: boolean) => {
    if (batchProp === undefined) setInnerBatch(next)
    onBatchChange?.(next)
  }
  const setMax = (next: number | null) => {
    if (maxProp === undefined) setInnerMax(next)
    onMaxTokensChange?.(next)
    setAsked(false)
  }
  /** After a fix, focus the next finding's first button, else the max_tokens field. */
  const focusAfter = (index: number) =>
    // Two frames: the first lets React drop the fixed row, so focus never lands on a removed button.
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const rows = rootRef.current?.querySelectorAll<HTMLElement>("[data-finding]")
      ;(rows?.[Math.min(index, rows.length - 1)]?.querySelector<HTMLElement>("button") ?? maxRef.current)?.focus()
    }))

  const describe = (f: CostFinding) => {
    if (!model) return ""
    switch (f.kind) {
      case "noMaxTokens": return fill(t.noMaxTokens, { limit: nf(model.maxOutput), worst: money(f.worst) })
      case "contextOverflow": return f.inputAlone ? fill(t.overflowInput, { needed: nf(f.needed), model: model.label, window: nf(f.window) }) : fill(t.overflowReply, { input: nf(input), reply: nf(maxTokens ?? 0), model: model.label, window: nf(f.window) })
      case "jump": return fill(t.jump, { factor: f.factor >= 100 ? nf(f.factor) : f.factor.toFixed(f.factor < 20 ? 1 : 0), last: money(f.last) })
      case "costlyBulk": return fill(t.costlyBulk, { items: nf(items), model: f.cheaper.label, cheaper: money(f.cheaperCost), cost })
      case "batchSaving": return fill(t.batchSaving, { batch: money(f.batchCost), cost })
      case "stalePrices": return fill(t.stale, { days: f.days })
    }
  }
  const fixFor = (f: CostFinding): { label: string; run: () => void } | null => {
    if (f.kind === "noMaxTokens") return { label: fill(t.setMax, { n: nf(f.suggest) }), run: () => setMax(f.suggest) }
    if (f.kind === "contextOverflow" && f.lowerTo && f.lowerTo > 0) return { label: fill(t.lowerTo, { n: nf(f.lowerTo) }), run: () => setMax(f.lowerTo ?? null) }
    if (f.kind === "contextOverflow" && f.fitsIn) { const to = f.fitsIn; return { label: fill(t.switchTo, { model: to.label }), run: () => setModel(to.id) } }
    if (f.kind === "batchSaving") return { label: t.batch, run: () => setBatch(true) }
    if (f.kind === "costlyBulk") return { label: fill(t.switchTo, { model: f.cheaper.label }), run: () => setModel(f.cheaper.id) }
    return null
  }

  const run = async () => {
    if (blocking.length && !asked) {
      setAsked(true)
      rootRef.current?.querySelector<HTMLElement>("[data-finding] button")?.focus()
      return
    }
    if (!onRun || pending || !model || !est) return
    setPending(true)
    try {
      await onRun({ model: model.id, maxTokens, batch, expectedCost: est.expected, worstCost: est.worst })
    } catch {
      // The caller reports failures; the button becomes usable again.
    } finally {
      setPending(false)
    }
  }

  const field = "h-9 w-full min-w-0 rounded-md border bg-transparent px-3 text-sm shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30 aria-invalid:border-destructive"
  const small = "inline-flex h-6 shrink-0 items-center rounded-md px-2 text-xs font-medium outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50"
  const reply = maxTokens ?? expectedOutputTokens ?? null
  const outputText = est ? (expectedOutputTokens != null ? `≈${nf(est.outputTokens / Math.max(items, 1))}` : fill(t.outputUnknown, { output: nf(reply ?? model?.maxOutput ?? 0) })) : ""

  return (
    <div ref={rootRef} data-slot="llm-cost-estimate" data-state={blocking.length ? "warning" : "ok"} className={cn("w-full max-w-md space-y-3 rounded-lg border bg-card p-4 text-sm text-card-foreground", className)} {...props}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
        <h3 className="font-medium">{t.heading}</h3>
        <p className="text-xs text-muted-foreground">{fill(t.asOf, { date })}</p>
      </div>
      <div className="grid grid-cols-1 gap-3 min-[400px]:grid-cols-[1fr_9rem]">
        <div className="grid min-w-0 gap-1.5">
          <label htmlFor={`${id}-model`} className="text-xs font-medium">{t.model}</label>
          <select id={`${id}-model`} value={model?.id ?? ""} onChange={(e) => setModel(e.target.value)} className={cn(field, "pr-8")} aria-describedby={`${id}-price`}>
            {models.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
          </select>
          {model && <p id={`${id}-price`} className="text-xs text-muted-foreground">{fill(batch ? t.perMillionBatch : t.perMillion, { input: money(model.input * priceFactor(model, plan)), output: money(model.output * priceFactor(model, plan)) })}</p>}
        </div>
        <div className="grid min-w-0 content-start gap-1.5">
          <label htmlFor={`${id}-max`} className="font-mono text-xs font-medium">{t.maxTokens}</label>
          <input
            ref={maxRef}
            id={`${id}-max`}
            inputMode="numeric"
            autoComplete="off"
            value={draft}
            placeholder={t.notSet}
            aria-invalid={findings.some((f) => f.kind === "noMaxTokens" || (f.kind === "contextOverflow" && !f.inputAlone)) || undefined}
            onChange={(e) => {
              const digits = e.target.value.replace(/[^\d]/g, "").slice(0, 9)
              setDraft(digits)
              setMax(digits ? Number(digits) : null)
            }}
            className={cn(field, "font-mono tabular-nums")}
          />
        </div>
      </div>
      {canBatch && (
        <label className="flex cursor-pointer items-start gap-2 text-xs">
          <input type="checkbox" checked={batch} onChange={(e) => setBatch(e.target.checked)} aria-describedby={`${id}-batch`} className="mt-0.5 size-4 shrink-0 accent-foreground" />
          <span className="min-w-0">
            <span className="font-medium">{t.batch}</span>
            <span id={`${id}-batch`} className="block text-muted-foreground">{fill(t.batchHint, { discount: `${Math.round((model?.batchDiscount ?? 0) * 100)}%` })}</span>
          </span>
        </label>
      )}
      {est && (
        <div className="rounded-md bg-muted/50 p-3">
          <p className="text-xs text-muted-foreground">{t.expected}</p>
          <p className="flex flex-wrap items-baseline gap-x-2">
            <span className="text-2xl font-semibold tabular-nums">≈{cost}</span>
            {est.worst > est.expected * 1.05 && <span className="text-xs text-muted-foreground">{fill(t.worst, { cost: money(est.worst) })}</span>}
          </p>
          <p className="mt-1 text-xs text-muted-foreground tabular-nums">
            {fill(items === 1 ? t.shapeOne : t.shape, { items: nf(items), input: `${inputProp === undefined ? "≈" : ""}${nf(input)}`, output: outputText })}
            {inputProp === undefined && prompt ? <> · {t.estimatedNote}</> : null}
          </p>
        </div>
      )}
      <span aria-live="polite" className="sr-only">{announcement}</span>
      {findings.length > 0 && (
        <ul className="space-y-2">
          {findings.map((f, index) => {
            const fix = fixFor(f)
            const info = f.kind === "stalePrices"
            const tip = f.kind === "batchSaving"
            const descId = `${id}-f${index}`
            return (
              <li key={f.kind} data-finding className={cn("flex gap-1.5 text-xs", info ? "text-muted-foreground" : tip ? "text-emerald-800 dark:text-emerald-300" : "text-amber-700 dark:text-amber-400")}>
                {info ? <Info aria-hidden className="mt-0.5 size-3.5 shrink-0" /> : tip ? <PiggyBank aria-hidden className="mt-0.5 size-3.5 shrink-0" /> : <TriangleAlert aria-hidden className="mt-0.5 size-3.5 shrink-0" />}
                <div className="min-w-0 flex-1 space-y-1">
                  <p id={descId} className="break-words">{describe(f)}</p>
                  {!info && (
                    <div className="flex flex-wrap gap-2">
                      {fix && (
                        <button type="button" aria-describedby={descId} onClick={() => { fix.run(); focusAfter(index) }} className={cn(small, tip ? "border border-emerald-600/40 text-emerald-900 hover:bg-emerald-500/10 dark:text-emerald-200" : "border border-amber-500/40 text-amber-900 hover:bg-amber-500/10 dark:text-amber-200")}>
                          {fix.label}
                        </button>
                      )}
                      <button type="button" aria-describedby={descId} onClick={() => { setKept((k) => new Set(k).add(f.kind)); focusAfter(index) }} className={cn(small, "text-muted-foreground hover:bg-accent hover:text-foreground")}>
                        {t.keep}
                      </button>
                    </div>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}
      {onRun && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={run}
            disabled={pending || !est || items === 0}
            className={cn(
              "inline-flex min-h-9 max-w-full items-center gap-2 rounded-md px-4 py-1.5 text-left text-sm font-medium outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-60",
              asked && blocking.length ? "bg-amber-700 text-white hover:bg-amber-800 dark:bg-amber-400 dark:text-amber-950" : "bg-primary text-primary-foreground hover:bg-primary/90",
            )}
          >
            {pending ? <Loader2 aria-hidden className="size-4 animate-spin" /> : <Coins aria-hidden className="size-4" />}
            <span className="min-w-0">{asked && blocking.length ? fill(t.runAnyway, { cost }) : fill(t.run, { items: items === 1 ? t.request : fill(t.requests, { n: nf(items) }), cost })}</span>
          </button>
        </div>
      )}
    </div>
  )
}
