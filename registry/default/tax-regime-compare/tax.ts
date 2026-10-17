// Bollard UI — tax-regime-compare · MIT licence · https://bollard-ui.vercel.app/components/tax-regime-compare

/**
 * India income tax, old vs new regime, for tax year 2026-27 (FY 2026-27), resident individuals with salary.
 * Slabs: Memorandum to the Finance Bill 2026 (no change for tax year 2026-27; new regime = s.202 of the
 * Income-tax Act 2025). Rebate, standard deduction and deduction limits: incometax.gov.in (AY 2026-27 page,
 * unchanged). HRA 50% places: Income-tax Rules 2026, rule 279. Section names are the familiar 1961 Act ones.
 */

export type Regime = "old" | "new"
export type AgeBand = "under60" | "60to80" | "over80"

export interface TaxInput {
  /** Gross annual salary, all allowances included (HRA too), before any exemption. */
  salary: number
  /** Annual basic + DA. Drives the HRA and employer-NPS limits. */
  basic?: number
  /** HRA received in the year. */
  hra?: number
  /** Rent paid in the year. */
  rent?: number
  /** Where you rent: one of HRA_FIFTY_PERCENT_CITIES gets 50% of salary, anywhere else 40%. */
  city?: string
  /** Interest, rent received and other income taxed at slab rates. */
  otherIncome?: number
  /** 80C: PF, PPF, ELSS, life cover, home-loan principal, tuition… */
  d80C?: number
  /** 80D: health insurance for self, spouse and children. */
  d80D?: number
  /** 80D: health insurance for parents. */
  d80DParents?: number
  /** Interest on a home loan for a self-occupied house (s.24(b)). */
  homeLoanInterest?: number
  /** 80CCD(1B): your own extra NPS contribution. */
  nps?: number
  /** 80CCD(2): employer's NPS contribution. Counts in both regimes, within a % of basic. */
  employerNps?: number
  /** Professional tax paid (old regime only). */
  professionalTax?: number
  /** The regime the user picked (for "costs more" warnings). */
  regime?: Regime
}

export interface TaxOptions {
  age?: AgeBand
  /** Parents are 60 or over (raises the parents' 80D limit). */
  parentsSenior?: boolean
  /** Employer is central/state government (14% employer-NPS limit in the old regime instead of 10%). */
  governmentEmployer?: boolean
}

export const HRA_FIFTY_PERCENT_CITIES = ["Mumbai", "Kolkata", "Delhi", "Chennai", "Hyderabad", "Pune", "Ahmedabad", "Bengaluru"]
export const LIMITS = { d80C: 150_000, d80D: 25_000, d80DSenior: 50_000, homeLoan: 200_000, nps: 50_000, professionalTax: 2_500, stdOld: 50_000, stdNew: 75_000 }

export type DeductionKey = "hra" | "d80C" | "d80D" | "d80DParents" | "homeLoanInterest" | "nps" | "employerNps" | "professionalTax" | "standard"

export interface RegimeTax {
  regime: Regime
  gross: number
  /** What each deduction or exemption actually counted for. */
  allowed: Partial<Record<DeductionKey, number>>
  taxable: number
  slabTax: number
  rebate: number
  surcharge: number
  cess: number
  total: number
}

export type TaxIssue =
  | { kind: "costsMore"; chosen: Regime; extra: number }
  | { kind: "notInNew"; items: { key: DeductionKey; amount: number }[] }
  | { kind: "overCap"; key: DeductionKey; claimed: number; cap: number }
  | { kind: "hraNoRent" }
  | { kind: "hraOverBasic" }
  | { kind: "marginal"; over: number; tax: number }
  | { kind: "oldRebateGap"; gap: number; room: number }

export interface TaxComparison {
  old: RegimeTax
  new: RegimeTax
  winner: Regime | "tie"
  saving: number
  /** Old-regime deductions (beyond the standard deduction) at which both regimes cost the same; null if old can never win. */
  breakEven: number | null
  /** Old-regime deductions this input actually claims, beyond the standard deduction. */
  claimed: number
  issues: TaxIssue[]
}

const num = (x: unknown) => {
  const n = Number(x)
  return Number.isFinite(n) && n > 0 ? Math.min(n, 1e11) : 0
}
const OLD_SLABS: Record<AgeBand, [number, number][]> = {
  under60: [[250_000, 0], [500_000, 0.05], [1_000_000, 0.2], [Infinity, 0.3]],
  "60to80": [[300_000, 0], [500_000, 0.05], [1_000_000, 0.2], [Infinity, 0.3]],
  over80: [[500_000, 0], [1_000_000, 0.2], [Infinity, 0.3]],
}
const NEW_SLABS: [number, number][] = [[400_000, 0], [800_000, 0.05], [1_200_000, 0.1], [1_600_000, 0.15], [2_000_000, 0.2], [2_400_000, 0.25], [Infinity, 0.3]]

function slab(income: number, slabs: [number, number][]) {
  let tax = 0
  let floor = 0
  for (const [top, rate] of slabs) {
    if (income > floor) tax += (Math.min(income, top) - floor) * rate
    floor = top
  }
  return tax
}

/** Surcharge with marginal relief at each threshold. The new regime stops at 25%. */
function surcharge(income: number, tax: number, taxAt: (i: number) => number, regime: Regime) {
  const bands: [number, number][] = [[50_000_000, regime === "new" ? 0.25 : 0.37], [20_000_000, 0.25], [10_000_000, 0.15], [5_000_000, 0.1]]
  for (let i = 0; i < bands.length; i++) {
    const [threshold, rate] = bands[i]
    if (income <= threshold) continue
    const below = bands[i + 1]?.[1] ?? 0
    const atThreshold = taxAt(threshold) * (1 + below)
    return Math.max(0, Math.min(tax * rate, atThreshold + (income - threshold) - tax))
  }
  return 0
}

/** Tax under one regime. `extraOld` adds hypothetical old-regime deductions (used for the break-even search). */
export function regimeTax(input: TaxInput, regime: Regime, options: TaxOptions = {}, extraOld = 0): RegimeTax {
  const salary = num(input.salary)
  const basic = num(input.basic) || salary * 0.5
  const gross = salary + num(input.otherIncome)
  const allowed: Partial<Record<DeductionKey, number>> = {}
  allowed.standard = Math.min(salary, regime === "new" ? LIMITS.stdNew : LIMITS.stdOld)
  allowed.employerNps = Math.min(num(input.employerNps), basic * (regime === "new" || options.governmentEmployer ? 0.14 : 0.1))
  if (regime === "old") {
    const fifty = HRA_FIFTY_PERCENT_CITIES.some((c) => c.toLowerCase() === String(input.city ?? "").trim().toLowerCase())
    allowed.hra = Math.max(0, Math.min(num(input.hra), num(input.rent) - basic * 0.1, basic * (fifty ? 0.5 : 0.4)))
    allowed.professionalTax = Math.min(num(input.professionalTax), LIMITS.professionalTax)
    allowed.homeLoanInterest = Math.min(num(input.homeLoanInterest), LIMITS.homeLoan)
    allowed.d80C = Math.min(num(input.d80C), LIMITS.d80C)
    allowed.d80D = Math.min(num(input.d80D), options.age && options.age !== "under60" ? LIMITS.d80DSenior : LIMITS.d80D)
    allowed.d80DParents = Math.min(num(input.d80DParents), options.parentsSenior ? LIMITS.d80DSenior : LIMITS.d80D)
    allowed.nps = Math.min(num(input.nps), LIMITS.nps)
  }
  const off = Object.values(allowed).reduce((a, b) => a + (b ?? 0), 0) + (regime === "old" ? extraOld : 0)
  // s.288A: total income is rounded to the nearest ₹10.
  const taxable = Math.round(Math.max(0, gross - off) / 10) * 10
  const slabs = regime === "new" ? NEW_SLABS : OLD_SLABS[options.age ?? "under60"]
  const taxAt = (i: number) => slab(i, slabs)
  const slabTax = taxAt(taxable)
  let rebate = 0
  if (regime === "new" && taxable <= 1_200_000) rebate = Math.min(slabTax, 60_000)
  else if (regime === "new") rebate = Math.max(0, slabTax - (taxable - 1_200_000)) // marginal relief just above ₹12 lakh
  else if (taxable <= 500_000) rebate = Math.min(slabTax, 12_500)
  const afterRebate = slabTax - rebate
  const sc = surcharge(taxable, afterRebate, taxAt, regime)
  const cess = (afterRebate + sc) * 0.04
  return { regime, gross, allowed, taxable, slabTax: Math.round(slabTax), rebate: Math.round(rebate), surcharge: Math.round(sc), cess: Math.round(cess), total: Math.round(afterRebate + sc + cess) }
}

/** Compares both regimes, finds the break-even deductions and flags choices and claims that cost money. Never throws. */
export function compareRegimes(input: TaxInput | null | undefined, options: TaxOptions = {}): TaxComparison {
  const i = input ?? { salary: 0 }
  const old = regimeTax(i, "old", options)
  const neu = regimeTax(i, "new", options)
  const diff = old.total - neu.total
  const winner = Math.abs(diff) < 1 ? "tie" : diff > 0 ? "new" : "old"
  const claimed = Object.entries(old.allowed).reduce((a, [k, v]) => a + (k === "standard" || k === "employerNps" ? 0 : (v ?? 0)), 0)

  // Old-regime tax falls as deductions rise, so binary-search the amount that matches the new regime.
  let breakEven: number | null = null
  const base = regimeTax({ ...i, hra: 0, rent: 0, d80C: 0, d80D: 0, d80DParents: 0, homeLoanInterest: 0, nps: 0, professionalTax: 0 }, "old", options)
  if (base.total <= neu.total) breakEven = 0
  else if (regimeTax(i, "old", options, old.gross).total <= neu.total) {
    const clean = { ...i, hra: 0, rent: 0, d80C: 0, d80D: 0, d80DParents: 0, homeLoanInterest: 0, nps: 0, professionalTax: 0 }
    let lo = 0, hi = old.gross
    for (let k = 0; k < 50 && hi - lo > 1; k++) {
      const mid = (lo + hi) / 2
      if (regimeTax(clean, "old", options, mid).total > neu.total) lo = mid
      else hi = mid
    }
    breakEven = Math.ceil(hi / 100) * 100
  }

  const issues: TaxIssue[] = []
  if (i.regime && winner !== "tie" && i.regime !== winner) issues.push({ kind: "costsMore", chosen: i.regime, extra: Math.abs(diff) })
  if (i.regime === "new") {
    const items = (["hra", "d80C", "d80D", "d80DParents", "homeLoanInterest", "nps", "professionalTax"] as const)
      .map((key) => ({ key, amount: key === "hra" ? Math.min(num(i.hra), num(i.rent)) : num(i[key]) }))
      .filter((x) => x.amount > 0)
    if (items.length) issues.push({ kind: "notInNew", items })
  }
  const caps: [DeductionKey, number, number][] = [
    ["d80C", num(i.d80C), LIMITS.d80C],
    ["d80D", num(i.d80D), options.age && options.age !== "under60" ? LIMITS.d80DSenior : LIMITS.d80D],
    ["d80DParents", num(i.d80DParents), options.parentsSenior ? LIMITS.d80DSenior : LIMITS.d80D],
    ["homeLoanInterest", num(i.homeLoanInterest), LIMITS.homeLoan],
    ["nps", num(i.nps), LIMITS.nps],
    ["professionalTax", num(i.professionalTax), LIMITS.professionalTax],
  ]
  for (const [key, claimedAmount, cap] of caps) if (i.regime !== "new" && claimedAmount > cap) issues.push({ kind: "overCap", key, claimed: claimedAmount, cap })
  if (num(i.hra) > 0 && num(i.rent) === 0) issues.push({ kind: "hraNoRent" })
  if (num(i.hra) > 0 && num(i.basic) === 0) issues.push({ kind: "hraOverBasic" })
  if (neu.taxable > 1_200_000 && neu.rebate > 0) issues.push({ kind: "marginal", over: neu.taxable - 1_200_000, tax: neu.total })
  const room = LIMITS.d80C - Math.min(num(i.d80C), LIMITS.d80C)
  if (old.taxable > 500_000 && old.taxable - 500_000 <= room && old.total > 0) issues.push({ kind: "oldRebateGap", gap: old.taxable - 500_000, room })

  return { old, new: neu, winner, saving: Math.abs(diff), breakEven, claimed, issues }
}
