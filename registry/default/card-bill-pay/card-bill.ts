// Bollard UI — card-bill-pay · MIT licence · https://bollard-ui.vercel.app/components/card-bill-pay

/**
 * Pure credit card bill rules. Sources (RBI Master Direction – Credit Card and Debit Card – Issuance and Conduct
 * Directions, 2022, as updated, and its FAQ):
 * - Paying less than the total amount due by the due date loses the interest-free period: interest runs from each
 *   transaction's date on the outstanding amount (adjusted for payments), not on the total amount due.
 * - The interest-free period is suspended while any of the previous bill is outstanding, so new spends pay interest too.
 * - Late payment charges, and reporting to credit bureaus, only when the account is past due for more than 3 days;
 *   charged on the amount outstanding after the due date.
 * - Minimum amount due may not cause negative amortisation.
 * - Late payment charges only on the outstanding amount after the due date, not on the total amount due (RBI
 *   Directions 2025 para 23(5); restated by the Amendment Directions 2026, in force 1 Apr 2027, which keeps the
 *   3-day rule).
 * - The statement must say what level of unpaid amount loses the interest-free period (RBI amendment, 7 Mar 2024),
 *   so an issuer may forgive a tiny shortfall: `keepsInterestFreeUpTo`.
 * Card rates, GST on interest (18% in India) and late fee slabs vary by issuer, so they are options here.
 */

export interface CardStatement {
  /** Total amount due on the statement. */
  totalDue: number
  /** Minimum amount due on the statement. */
  minimumDue: number
  /** Payment due date, as a day number (see `toDayNumber`) or a "YYYY-MM-DD" string. */
  dueDate: number | string
  /** Statement date. Used to estimate interest back to the purchase dates. */
  statementDate?: number | string
}

export interface CardBillOptions {
  /** Monthly finance charge in percent, as on the card's MITC. Default 3.75. */
  monthlyRate?: number
  /** GST on interest and fees, percent. Default 18. */
  gstRate?: number
  /** Days after the due date before a late fee and bureau report. RBI: 3. */
  graceDays?: number
  /** Late fee for an amount left unpaid after the due date. Leave out when unknown. */
  lateFee?: (outstanding: number) => number
  /** The issuer's minimum due as a percent of the balance, for the "minimum only" payoff. Default 5. */
  minimumPercent?: number
  /** Floor of the minimum due. Default 250 (the indicative figure in RBI's no-negative-amortisation example). */
  minimumFloor?: number
  /** Unpaid amount the issuer forgives without losing the interest-free period, as printed on the statement. Default 0. */
  keepsInterestFreeUpTo?: number
}

/** "YYYY-MM-DD" or a day number to whole days since 1970; anything else is null. */
export function toDayNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? Math.round(value) : null
  const m = typeof value === "string" ? /^(\d{4})-(\d{2})-(\d{2})/.exec(value.trim()) : null
  if (!m) return null
  const n = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) / 864e5
  return Number.isFinite(n) ? Math.round(n) : null
}

const money = (n: unknown) => (typeof n === "number" && Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : 0)

export type PaymentKind = "none" | "full" | "over" | "partial" | "minimum" | "belowMinimum"

export interface PaymentReadback {
  kind: PaymentKind
  amount: number
  totalDue: number
  minimumDue: number
  /** Left unpaid after this payment. */
  unpaid: number
  /** Paid more than the bill. */
  extra: number
  /** Rough interest (with GST) the next statement will carry; 0 when paid in full on time. */
  interest: number
  /** Days after the due date this payment lands; 0 or less is on time. */
  daysLate: number
  /** A late fee and a bureau report apply: paid past the grace days, or below the minimum with nothing more to follow. */
  late: boolean
  /** The late fee, when `lateFee` was given. */
  lateFee: number | null
  /** Paid after the due date but within the grace days: no fee or report, interest still applies. */
  inGrace: boolean
  /** Short of the total, but within the shortfall the issuer forgives (`keepsInterestFreeUpTo`). */
  forgiven: boolean
  /** Paying only the minimum every month with no new spending. Null when it never clears in 50 years. */
  minimumOnly: { months: number; interest: number } | null
}

/** Reads back what paying `amount` on `payDay` costs, against the statement and the card's terms. */
export function readPayment(statement: Partial<CardStatement> | null | undefined, amount: unknown, payDay: number | undefined, options: CardBillOptions = {}): PaymentReadback {
  const { monthlyRate = 3.75, gstRate = 18, graceDays = 3, lateFee, minimumPercent = 5, minimumFloor = 250, keepsInterestFreeUpTo = 0 } = options
  const totalDue = money(statement?.totalDue)
  const minimumDue = Math.min(money(statement?.minimumDue), totalDue)
  const paid = money(amount)
  const due = toDayNumber(statement?.dueDate)
  const stmt = toDayNumber(statement?.statementDate)
  const daysLate = due !== null && payDay !== undefined ? payDay - due : 0
  const unpaid = Math.max(0, Math.round((totalDue - paid) * 100) / 100)
  const extra = Math.max(0, Math.round((paid - totalDue) * 100) / 100)
  const kind: PaymentKind = paid === 0 ? "none" : extra > 0 ? "over" : unpaid === 0 ? "full" : paid < minimumDue ? "belowMinimum" : paid === minimumDue ? "minimum" : "partial"

  const daily = (Math.max(0, monthlyRate) / 100) * 12 / 365
  const gst = 1 + Math.max(0, gstRate) / 100
  let interest = 0
  const forgiven = unpaid > 0 && unpaid <= Math.max(0, Number(keepsInterestFreeUpTo) || 0) && daysLate <= 0
  if (totalDue > 0 && !forgiven && (unpaid > 0 || daysLate > 0)) {
    // Purchases are assumed spread evenly over the 30 days before the statement (about 15 days old on average): the
    // whole bill pays interest from then to the payment, and what's left from the payment to the next statement.
    const statementDay = stmt ?? (due !== null ? due - 20 : null)
    const sinceSpend = statementDay !== null && payDay !== undefined ? Math.max(0, payDay - statementDay) + 15 : 30
    const toNextStatement = statementDay !== null && payDay !== undefined ? Math.max(0, statementDay + 30 - payDay) : 15
    interest = (totalDue * daily * sinceSpend + unpaid * daily * toNextStatement) * gst
  }
  // Past the grace days nothing was paid by the due date; below the minimum it turns late unless the rest follows.
  const pastGrace = daysLate > graceDays
  const late = totalDue > 0 && (pastGrace || paid < minimumDue)
  const owedAfterDue = pastGrace ? totalDue : unpaid
  const fee = late && lateFee ? Math.max(0, Number(lateFee(owedAfterDue)) || 0) * gst : null

  return {
    kind, amount: paid, totalDue, minimumDue, unpaid, extra,
    interest: Math.round(interest * 100) / 100,
    daysLate, late, lateFee: fee === null ? null : Math.round(fee * 100) / 100,
    inGrace: daysLate > 0 && daysLate <= graceDays,
    forgiven,
    minimumOnly: payoffAtMinimum(totalDue, monthlyRate, gstRate, minimumPercent, minimumFloor),
  }
}

/** Months and total interest to clear `balance` paying only the minimum each month, with no new spending. */
export function payoffAtMinimum(balance: number, monthlyRate = 3.75, gstRate = 18, minimumPercent = 5, minimumFloor = 250): { months: number; interest: number } | null {
  let left = money(balance)
  if (left === 0) return { months: 0, interest: 0 }
  const rate = (Math.max(0, monthlyRate) / 100) * (1 + Math.max(0, gstRate) / 100)
  let interest = 0
  for (let month = 1; month <= 600; month++) {
    const charge = left * rate
    interest += charge
    left += charge
    const pay = Math.min(left, Math.max(left * (Math.max(0, minimumPercent) / 100), minimumFloor))
    if (pay <= charge && pay < left) return null
    left -= pay
    if (left < 0.01) return { months: month, interest: Math.round(interest) }
  }
  return null
}
