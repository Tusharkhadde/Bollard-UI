// Bollard UI — llm-cost-estimate · MIT licence · https://bollard-ui.vercel.app/components/llm-cost-estimate

/** One row of your price table. Prices are per million tokens, in the table's currency. */
export interface ModelPrice {
  id: string
  /** Shown in the picker, e.g. "Large (frontier)". */
  label: string
  /** Price per 1M input tokens. */
  input: number
  /** Price per 1M output tokens. */
  output: number
  /** Most tokens one request can hold, input plus output. */
  contextWindow: number
  /** Most tokens one reply can be, which is what you pay for with no max_tokens. */
  maxOutput: number
  /** Share taken off input and output when sent through the provider's Batch API, e.g. 0.5 for 50%. Omit when there is none. */
  batchDiscount?: number
}

/** A run being estimated. Token counts are per request. */
export interface RunPlan {
  /** Requests in the run (rows in the batch). */
  items: number
  /** Input tokens per request. */
  inputTokens: number
  /** Typical reply length, if known. */
  expectedOutputTokens?: number | null
  /** The max_tokens you will send; null or undefined means none. */
  maxTokens?: number | null
  /** Sent through the Batch API, so `batchDiscount` applies. */
  batch?: boolean
}

export interface CostEstimate {
  /** Cost if replies come in at the expected length (or at max_tokens when no expectation is given). */
  expected: number
  /** Cost if every reply runs to its limit. */
  worst: number
  inputTokens: number
  /** Expected output tokens across the run. */
  outputTokens: number
  /** Output tokens across the run if every reply hits the limit. */
  worstOutputTokens: number
}

export type CostFinding =
  | { kind: "noMaxTokens"; worst: number; suggest: number }
  | { kind: "contextOverflow"; needed: number; window: number; inputAlone: boolean; fitsIn?: ModelPrice; lowerTo?: number }
  | { kind: "jump"; factor: number; last: number }
  | { kind: "costlyBulk"; cheaper: ModelPrice; cheaperCost: number }
  | { kind: "batchSaving"; batchCost: number; discount: number }
  | { kind: "stalePrices"; days: number }

const num = (n: unknown, fallback = 0) => (typeof n === "number" && Number.isFinite(n) && n >= 0 ? n : fallback)
const CJK = /[\u3000-\u30ff\u3400-\u9fff\uac00-\ud7af\uf900-\ufaff\uff00-\uffef]/g
const NON_ASCII = /[^\x00-\x7f]/g
const CODE_CHARS = /[{}[\]();=<>|&*+#$\\]/g

/** Share of a model's price that applies to this plan: 1, or 1 − batchDiscount for batch runs. */
export const priceFactor = (model: ModelPrice, plan: Pick<RunPlan, "batch">) => {
  const d = num(model.batchDiscount)
  return plan.batch && d > 0 && d < 1 ? 1 - d : 1
}

/**
 * Rough token count, deliberately on the high side. Pass a real tokenizer count whenever you have one.
 * - English prose: about 4 characters per token (OpenAI's rule of thumb).
 * - Code and markup: about 3, because brackets, operators and indentation split into more tokens.
 * - Other scripts (Hindi, Arabic, Cyrillic, Thai, accented letters, emoji): about 2 characters per token.
 * - Chinese, Japanese and Korean: about one token per character.
 */
export function estimateTokens(text: unknown): number {
  if (typeof text !== "string" || !text) return 0
  const clean = text.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n")
  const cjk = clean.match(CJK)?.length ?? 0
  const rest = clean.replace(CJK, "")
  const other = Array.from(rest.match(NON_ASCII)?.join("") ?? "").length
  const ascii = rest.length - (rest.match(NON_ASCII)?.length ?? 0)
  const symbols = rest.replace(NON_ASCII, "").match(CODE_CHARS)?.length ?? 0
  const code = ascii >= 80 && symbols / ascii > 0.04
  return Math.ceil(ascii / (code ? 3 : 4)) + Math.ceil(other / 2) + cjk
}

/** Expected and worst-case cost of a run on one model. Garbage in gives zeros, never NaN. */
export function estimateCost(model: ModelPrice, plan: RunPlan): CostEstimate {
  const items = Math.floor(num(plan.items))
  const input = num(plan.inputTokens)
  const max = plan.maxTokens == null ? null : Math.min(num(plan.maxTokens), num(model.maxOutput, Infinity))
  const limit = max ?? num(model.maxOutput)
  const expectedOut = Math.min(num(plan.expectedOutputTokens ?? limit, limit), limit)
  const factor = priceFactor(model, plan)
  const inPrice = (num(model.input) / 1e6) * factor
  const outPrice = (num(model.output) / 1e6) * factor
  const inputTokens = items * input
  return {
    expected: inputTokens * inPrice + items * expectedOut * outPrice,
    worst: inputTokens * inPrice + items * limit * outPrice,
    inputTokens,
    outputTokens: items * expectedOut,
    worstOutputTokens: items * limit,
  }
}

/** A tidy max_tokens: twice the expected reply rounded up to a power of two, at least 256. */
export function suggestMaxTokens(expected: number | null | undefined, maxOutput: number): number {
  const base = Math.max(256, num(expected ?? 512) * 2)
  return Math.min(2 ** Math.ceil(Math.log2(base)), num(maxOutput, 4096) || 4096)
}

export interface CheckRunOptions {
  models: ModelPrice[]
  /** Cost of the previous comparable run. */
  lastCost?: number | null
  /** How many times the last run counts as a jump. */
  jumpFactor?: number
  /** Requests at which a run counts as bulk. */
  bulkItems?: number
  /** How many times pricier than the cheapest fitting model counts as costly. */
  costlyFactor?: number
  /** Date the prices were read, and now, in epoch ms. */
  pricesAsOf?: number | null
  now?: number
  staleAfterDays?: number
}

/** Everything about a run worth a second look before money is spent. */
export function checkRun(model: ModelPrice, plan: RunPlan, options: CheckRunOptions): CostFinding[] {
  const findings: CostFinding[] = []
  const est = estimateCost(model, plan)
  const input = num(plan.inputTokens)
  const items = Math.floor(num(plan.items))
  const reply = plan.maxTokens == null ? num(plan.expectedOutputTokens) : num(plan.maxTokens)
  const window = num(model.contextWindow, Infinity)
  if (input + reply > window) {
    const fitsIn = options.models.filter((m) => m.id !== model.id && num(m.contextWindow) >= input + reply).sort((a, b) => estimateCost(a, plan).expected - estimateCost(b, plan).expected)[0]
    const lowerTo = input < window && plan.maxTokens != null ? Math.floor(window - input) : undefined
    findings.push({ kind: "contextOverflow", needed: input + reply, window, inputAlone: input > window, fitsIn, lowerTo })
  }
  if (plan.maxTokens == null && items > 0) findings.push({ kind: "noMaxTokens", worst: est.worst, suggest: suggestMaxTokens(plan.expectedOutputTokens, model.maxOutput) })
  const last = num(options.lastCost)
  if (last > 0 && est.expected / last >= num(options.jumpFactor, 10)) findings.push({ kind: "jump", factor: est.expected / last, last })
  if (items >= num(options.bulkItems, 100)) {
    const cheaper = options.models
      .filter((m) => m.id !== model.id && num(m.contextWindow) >= input + reply)
      .map((m) => ({ m, cost: estimateCost(m, plan).expected }))
      .sort((a, b) => a.cost - b.cost)[0]
    if (cheaper && cheaper.cost > 0 && est.expected / cheaper.cost >= num(options.costlyFactor, 10)) findings.push({ kind: "costlyBulk", cheaper: cheaper.m, cheaperCost: cheaper.cost })
    const discount = num(model.batchDiscount)
    if (!plan.batch && discount > 0 && discount < 1 && est.expected > 0) findings.push({ kind: "batchSaving", batchCost: estimateCost(model, { ...plan, batch: true }).expected, discount })
  }
  const asOf = num(options.pricesAsOf ?? NaN, NaN)
  if (Number.isFinite(asOf) && options.now !== undefined) {
    const days = Math.floor((options.now - asOf) / 86_400_000)
    if (days > num(options.staleAfterDays, 60)) findings.push({ kind: "stalePrices", days })
  }
  return findings
}
