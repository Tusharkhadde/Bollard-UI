// Bollard UI — bill-split-check · MIT licence · https://bollard-ui.vercel.app/components/bill-split-check

/** One line on the receipt. `price` is the line total (all units), as printed. */
export interface ReceiptItem {
  id: string
  name: string
  price: number
  qty?: number
}

export interface ReceiptTax {
  label: string
  amount: number
}

export interface Receipt {
  items: ReceiptItem[]
  /** Tax lines as printed (CGST and SGST are two lines). */
  taxes?: ReceiptTax[]
  /** Service charge as printed, in money. */
  serviceCharge?: number
  /** A "Round off" line as printed (e.g. -0.40), so a rounded total isn't read as missing money. */
  roundOff?: number
  /** The total printed at the bottom. Turns on the wrong-total and tax-twice checks. */
  total?: number
}

export interface SplitPerson {
  id: string
  name: string
}

/** What the group decides while splitting. */
export interface SplitValue {
  /** Item id → ids of the people who shared it. */
  claims: Record<string, string[]>
  /** Tip on top, in money. */
  tip: number
  mode: "items" | "equal"
  /** Item prices already include the tax lines, so they aren't added again. */
  taxInclusive: boolean
  /** Keep the printed service charge. Turn off when the group asks for it to be removed. */
  service: boolean
  /** Money added (or taken off, if negative) so the split matches the printed total, shared by what each ate. */
  adjust: number
}

export type SplitProblem =
  | { kind: "unclaimed"; items: ReceiptItem[]; amount: number }
  | { kind: "taxTwice"; amount: number }
  | { kind: "tipOnService"; service: number; tip: number }
  | { kind: "wrongTotal"; printed: number; computed: number; gap: number; rounding: boolean }
  | { kind: "nobodyItems"; people: SplitPerson[] }

export interface SplitShare {
  person: SplitPerson
  /** What they ate (items only). */
  items: number
  /** Their share of everything, tax, service, tip and adjustment included. Shares add up to `toPay` exactly. */
  share: number
  /** What the same person would pay on an equal split, for the "lightest eater" comparison. */
  equal: number
}

export interface SplitResult {
  subtotal: number
  tax: number
  service: number
  /** Items + tax (unless inclusive) + service + round-off + adjust. */
  bill: number
  toPay: number
  shares: SplitShare[]
  problems: SplitProblem[]
  /** Who pays most extra under an equal split, and how much. */
  lightest: { person: SplitPerson; extra: number } | null
}

const num = (n: unknown) => (typeof n === "number" && Number.isFinite(n) ? n : 0)

/** Splits `total` minor units across weights so the parts add up exactly (largest remainder). */
export function allocate(total: number, weights: number[]): number[] {
  const sum = weights.reduce((s, w) => s + Math.max(0, w), 0)
  if (!weights.length) return []
  const raw = weights.map((w) => (sum > 0 ? (Math.max(0, w) / sum) * total : total / weights.length))
  const out = raw.map(Math.floor)
  let left = total - out.reduce((s, n) => s + n, 0)
  raw
    .map((r, i) => ({ i, rest: r - Math.floor(r) }))
    .sort((a, b) => b.rest - a.rest || a.i - b.i)
    .forEach(({ i }) => {
      if (left > 0) (out[i]++, left--)
    })
  return out
}

/**
 * Works out every share and what's wrong with the split. Pure, so it can run on a server.
 * Shares are computed in minor units and rounded by largest remainder, so they always add up to what is paid.
 */
export function splitBill(receipt: Receipt, people: SplitPerson[], value: SplitValue, digits = 2): SplitResult {
  const f = 10 ** digits
  const items = (receipt?.items ?? []).filter((i) => i && typeof i.id === "string").slice(0, 200)
  const folks = (people ?? []).filter((p) => p && typeof p.id === "string").slice(0, 50)
  const ids = new Set(folks.map((p) => p.id))
  const claimers = (id: string) => (value?.claims?.[id] ?? []).filter((p) => ids.has(p))

  const subtotal = items.reduce((s, i) => s + Math.max(0, num(i.price)), 0)
  const printedTax = (receipt?.taxes ?? []).reduce((s, t) => s + Math.max(0, num(t?.amount)), 0)
  const tax = value?.taxInclusive ? 0 : printedTax
  const service = value?.service === false ? 0 : Math.max(0, num(receipt?.serviceCharge))
  const adjust = num(value?.adjust)
  const roundOff = num(receipt?.roundOff)
  const tip = Math.max(0, num(value?.tip))
  const bill = subtotal + tax + service + roundOff + adjust
  // A negative adjustment can't make the table owe less than nothing.
  const toPay = Math.max(0, bill + tip)
  const problems: SplitProblem[] = []

  const unclaimed = items.filter((i) => claimers(i.id).length === 0 && num(i.price) > 0)
  if (value?.mode !== "equal" && unclaimed.length) problems.push({ kind: "unclaimed", items: unclaimed, amount: unclaimed.reduce((s, i) => s + num(i.price), 0) })

  // A service charge the group had removed comes off the printed total too.
  const printed = num(receipt?.total) - (value?.service === false ? Math.max(0, num(receipt?.serviceCharge)) : 0)
  const tol = 1 / f + 1e-9
  if (printed > 0) {
    const computed = bill
    const gap = Math.round((printed - computed) * f) / f
    // Prices that already include tax, with the tax lines added on top: the overshoot is exactly the tax.
    if (!value?.taxInclusive && printedTax > 0 && Math.abs(gap + printedTax) <= Math.max(tol, printedTax * 0.01)) problems.push({ kind: "taxTwice", amount: printedTax })
    // Under one major unit (₹0.40, $0.50) is almost always the receipt rounding its total, not a missing item.
    else if (Math.abs(gap) > tol) problems.push({ kind: "wrongTotal", printed, computed, gap, rounding: digits > 0 && Math.abs(gap) < 1 })
  }
  if (service > 0 && tip > 0) problems.push({ kind: "tipOnService", service, tip })

  // Item shares in minor units.
  const eaten = new Map<string, number>(folks.map((p) => [p.id, 0]))
  items.forEach((i) => {
    const who = claimers(i.id)
    const parts = allocate(Math.round(Math.max(0, num(i.price)) * f), who.length ? who.map(() => 1) : [])
    who.forEach((p, k) => eaten.set(p, (eaten.get(p) ?? 0) + parts[k]))
  })
  if (value?.mode !== "equal") {
    const idle = folks.filter((p) => !eaten.get(p.id))
    if (idle.length && idle.length < folks.length) problems.push({ kind: "nobodyItems", people: idle })
  }

  const totalMinor = Math.round(toPay * f)
  const weights = folks.map((p) => eaten.get(p.id) ?? 0)
  // Unclaimed items are shared like the extras, by what each ate, so nothing goes missing from the split.
  const byItems = allocate(totalMinor, weights)
  const equal = allocate(totalMinor, folks.map(() => 1))
  const shares = folks.map((p, k) => ({
    person: p,
    items: (eaten.get(p.id) ?? 0) / f,
    share: (value?.mode === "equal" ? equal[k] : byItems[k]) / f,
    equal: equal[k] / f,
  }))
  const extras = folks.map((p, k) => ({ person: p, extra: (equal[k] - byItems[k]) / f })).filter((x) => x.extra > 0)
  const lightest = weights.some((w) => w > 0) && extras.length ? extras.reduce((a, b) => (b.extra > a.extra ? b : a)) : null

  return { subtotal, tax, service, bill, toPay, shares, problems, lightest }
}
