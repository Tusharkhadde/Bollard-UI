"use client"

import * as React from "react"
import { BadgeCheck, CircleAlert, LoaderCircle, RotateCw, TriangleAlert, UserPlus } from "lucide-react"

import { cn } from "@/lib/utils"
import { comparePayeeNames, type PayeeVerdict } from "./payee-match"

export { comparePayeeNames, nameTokens, type PayeeVerdict } from "./payee-match"

export interface PayeeDetails {
  name: string
  account: string
  /** Bank code: IFSC, sort code, routing number. */
  code: string
}

export interface PayeeLookupResult {
  /** The account holder's name. Return it only for match or close match if your backend decides. */
  name?: string
  /** Your backend's own verdict; when absent the names are compared here. */
  verdict?: PayeeVerdict
  accountType?: "personal" | "business"
  /** The account doesn't exist, or the bank couldn't be asked. */
  status?: "not-found" | "unavailable"
}

/** Every user-visible string, so the check can be translated. */
export const PAYEE_MESSAGES = {
  checking: "Checking the name with their bank…",
  matches: "Name matches:",
  accountType: (type: "personal" | "business") => `${type === "business" ? "Business" : "Personal"} account`,
  close: "Close match. Did you mean",
  closeType: (type: "personal" | "business") => `It's a ${type} account.`,
  typeMismatch: (actual: "personal" | "business", expected: "personal" | "business") =>
    `The name matches, but it's a ${actual} account, not ${expected}.`,
  useName: "Use this name",
  noMatch: "The name doesn't match this account.",
  notFound: "This account doesn't exist.",
  noMatchAdvice: "Check the details with the payee using contact details you trust. Money sent to the wrong account may not come back.",
  unavailable: "Couldn't check the name with their bank. Money sent to the wrong account may not come back.",
  retry: "Retry",
  newPayee: "You haven't paid this account before.",
  newLarge: "First payment to this payee, and a large one:",
  pay: (amount: string, payee: string) => `Pay${amount ? ` ${amount}` : ""} to ${payee}`,
  payAnyway: (amount: string, payee: string) => `Pay anyway${amount ? ` ${amount}` : ""} to ${payee}`,
  payeeFallback: "payee",
}
export type PayeeMessages = typeof PAYEE_MESSAGES

type Check = { key: string; state: "checking" } | { key: string; state: "done"; result: PayeeLookupResult } | { key: string; state: "failed" }

export interface PayeeCheckProps extends Omit<React.ComponentProps<"div">, "defaultValue"> {
  /** Payee details (controlled). */
  value?: PayeeDetails
  /** Initial payee details when uncontrolled. */
  defaultValue?: PayeeDetails
  /** Called with the details on every change. */
  onValueChange?: (value: PayeeDetails) => void
  /** Asks the payee's bank who holds the account. Called again only when the account or code changes. */
  lookup: (details: Pick<PayeeDetails, "account" | "code">, signal: AbortSignal) => Promise<PayeeLookupResult>
  /** Whether the account details are complete enough to look up. */
  isComplete?: (details: PayeeDetails) => boolean
  /** Payment amount, for the large-payment callout. */
  amount?: number
  /** Formats `amount`, e.g. with Intl.NumberFormat. */
  formatAmount?: (amount: number) => string
  /** True when the user has never paid this account before. */
  newPayee?: boolean
  /** A first payment at or above this is called out. */
  largeAmount?: number
  /** Sends the payment. Return a promise to show a pending state. */
  onPay?: (details: PayeeDetails, verdict: PayeeVerdict | "unchecked") => void | Promise<void>
  /** Offers a small test payment for a large first payment. */
  onTestPayment?: (details: PayeeDetails) => void
  /** Button text for a small test payment. */
  testPaymentLabel?: string
  /** Label for the payee name. */
  nameLabel?: string
  /** Label for the account number. */
  accountLabel?: string
  /** Label for the bank code (IFSC, sort code, routing). */
  codeLabel?: string
  /** Checkbox text to pay despite no match. */
  acknowledgeLabel?: string
  /** The account type the user said they're paying. A different type from the bank is a close match, as Confirmation of Payee requires. */
  expectedAccountType?: "personal" | "business"
  /** Override any other user-visible string (see `PAYEE_MESSAGES`). */
  messages?: Partial<PayeeMessages>
}

const field =
  "h-9 w-full min-w-0 rounded-md border bg-transparent px-3 text-base shadow-xs transition-[color,box-shadow] outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 md:text-sm dark:bg-input/30"
const fix =
  "inline-flex h-6 items-center gap-1 rounded-md border px-2 font-medium whitespace-nowrap transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
const button =
  "inline-flex min-h-9 w-full min-w-0 items-center text-center py-2 justify-center gap-2 rounded-md px-4 text-sm font-medium shadow-xs transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50"
const reveal = "motion-safe:animate-[cui-payee-check-reveal_250ms_ease-out]"
const defaultComplete = (d: PayeeDetails) => d.account.replace(/\D/g, "").length >= 6 && d.code.trim().length >= 4

/**
 * Confirmation of payee: once the account details are in, asks the bank who
 * holds the account and compares that with the name typed. A match goes
 * ahead, a close match offers the real name in one tap, and no match keeps
 * the real name hidden (so it can't be fished for) and needs an explicit
 * "pay anyway". It also calls out first-time payees and large first payments.
 */
export function PayeeCheck({
  value,
  defaultValue = { name: "", account: "", code: "" },
  onValueChange,
  lookup,
  isComplete = defaultComplete,
  amount,
  formatAmount = (n) => n.toLocaleString(),
  newPayee = false,
  largeAmount = 50_000,
  onPay,
  onTestPayment,
  testPaymentLabel = "Send a small test first",
  nameLabel = "Payee name",
  accountLabel = "Account number",
  codeLabel = "IFSC",
  acknowledgeLabel = "I've checked with the payee and want to pay anyway",
  expectedAccountType,
  messages,
  className,
  ...props
}: PayeeCheckProps) {
  const [inner, setInner] = React.useState(defaultValue)
  const [check, setCheck] = React.useState<Check>()
  const [acknowledged, setAcknowledged] = React.useState(false)
  const [pending, setPending] = React.useState(false)
  const [attempt, setAttempt] = React.useState(0)
  const id = React.useId()
  const details = value ?? inner
  const complete = isComplete(details)
  const key = complete ? `${details.account.replace(/\s/g, "")}|${details.code.trim().toUpperCase()}` : ""
  const lookupRef = React.useRef(lookup)
  React.useEffect(() => {
    lookupRef.current = lookup
  })

  const update = (patch: Partial<PayeeDetails>) => {
    const next = { ...details, ...patch }
    if (value === undefined) setInner(next)
    setAcknowledged(false)
    onValueChange?.(next)
  }

  // Look up once the account settles. The name never triggers a lookup: it's compared locally.
  React.useEffect(() => {
    if (!key) return
    const controller = new AbortController()
    const timer = setTimeout(() => {
      setCheck({ key, state: "checking" })
      const [account, code] = key.split("|")
      lookupRef.current({ account, code }, controller.signal).then(
        (result) => !controller.signal.aborted && setCheck({ key, state: "done", result }),
        () => !controller.signal.aborted && setCheck({ key, state: "failed" })
      )
    }, 500)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [key, attempt])

  // A result for other account details never shows.
  const current = check?.key === key ? check : undefined
  const result = current?.state === "done" ? current.result : undefined
  const unavailable = current?.state === "failed" || result?.status === "unavailable"
  const say = { ...PAYEE_MESSAGES, ...messages }
  const nameVerdict: PayeeVerdict | undefined =
    result && !result.status && details.name.trim() ? (result.verdict ?? (result.name ? comparePayeeNames(details.name, result.name) : undefined)) : undefined
  // Right name, wrong kind of account (personal vs business) is a close match, never a clean one.
  const typeMismatch = nameVerdict === "match" && !!expectedAccountType && !!result?.accountType && result.accountType !== expectedAccountType
  const verdict: PayeeVerdict | undefined = typeMismatch ? "close" : nameVerdict
  const large = newPayee && amount !== undefined && amount >= largeAmount
  const needsAck = verdict === "no-match" || unavailable
  const canPay = complete && !!details.name.trim() && !pending && !!(verdict || unavailable) && result?.status !== "not-found" && (!needsAck || acknowledged)
  const payee = verdict === "match" && result?.name ? result.name : details.name.trim() || say.payeeFallback
  const amountText = amount !== undefined ? formatAmount(amount) : ""

  const pay = async () => {
    setPending(true)
    try {
      await onPay?.(details, verdict ?? "unchecked")
    } catch {
      // The caller reports the error; the button becomes usable again.
    } finally {
      setPending(false)
    }
  }

  return (
    <div data-slot="payee-check" className={cn("grid w-full max-w-sm gap-3", className)} {...props}>
      <style>{`@keyframes cui-payee-check-reveal{from{opacity:0;transform:translateY(-4px)}}`}</style>
      <div className="grid gap-3 sm:grid-cols-[1fr_8rem]">
        <div className="grid gap-1.5">
          <label htmlFor={`${id}-account`} className="text-sm font-medium">{accountLabel}</label>
          <input id={`${id}-account`} inputMode="numeric" autoComplete="off" value={details.account} onChange={(e) => update({ account: e.target.value })} className={cn(field, "tabular-nums")} />
        </div>
        <div className="grid gap-1.5">
          <label htmlFor={`${id}-code`} className="text-sm font-medium">{codeLabel}</label>
          <input id={`${id}-code`} autoComplete="off" autoCapitalize="characters" spellCheck={false} value={details.code} onChange={(e) => update({ code: e.target.value.toUpperCase() })} className={cn(field, "uppercase")} />
        </div>
      </div>

      <div className="grid gap-1.5">
        <label htmlFor={`${id}-name`} className="text-sm font-medium">{nameLabel}</label>
        <input
          id={`${id}-name`}
          autoComplete="off"
          value={details.name}
          aria-invalid={verdict === "no-match" || undefined}
          aria-describedby={`${id}-result`}
          onChange={(e) => update({ name: e.target.value })}
          className={cn(field, "aria-invalid:border-destructive", verdict === "close" && "border-amber-500 dark:border-amber-400", verdict === "match" && "border-emerald-600/60")}
        />
        <div id={`${id}-result`} aria-live="polite" className="min-h-6 text-xs">
          {current?.state === "checking" && (
            <p className="flex items-center gap-1.5 py-1 text-muted-foreground motion-safe:animate-pulse">
              <LoaderCircle aria-hidden className="size-3.5 animate-spin" /> {say.checking}
            </p>
          )}
          {verdict === "match" && (
            <p className={cn("flex items-center gap-1.5 py-1 text-emerald-700 dark:text-emerald-400", reveal)}>
              <BadgeCheck aria-hidden className="size-3.5 shrink-0" />
              <span>
                {say.matches} <span className="font-medium">{result?.name ?? details.name}</span>
                {result?.accountType && <span className="text-muted-foreground"> · {say.accountType(result.accountType)}</span>}
              </span>
            </p>
          )}
          {verdict === "close" && (
            <p className={cn("flex gap-1.5 text-amber-700 dark:text-amber-400", reveal)}>
              <span className="flex h-6 shrink-0 items-center"><TriangleAlert aria-hidden className="size-3.5" /></span>
              <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                <span className="py-1">
                  {typeMismatch && result?.accountType && expectedAccountType ? (
                    say.typeMismatch(result.accountType, expectedAccountType)
                  ) : (
                    <>
                      {say.close} <span className="font-medium">{result?.name}</span>?{result?.accountType && ` ${say.closeType(result.accountType)}`}
                    </>
                  )}
                </span>
                {result?.name && !typeMismatch && (
                  <button type="button" onClick={() => update({ name: result.name })} className={cn(fix, "border-amber-500/40 text-amber-900 hover:bg-amber-500/10 dark:text-amber-200")}>
                    {say.useName}
                  </button>
                )}
              </span>
            </p>
          )}
          {(verdict === "no-match" || result?.status === "not-found") && (
            <div role="alert" className={cn("flex gap-2 rounded-md border border-red-500/30 bg-red-500/10 px-2.5 py-2 text-sm text-red-900 dark:text-red-100", reveal)}>
              <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0 text-red-600 dark:text-red-400" />
              <p>
                <span className="font-medium">{result?.status === "not-found" ? say.notFound : say.noMatch}</span> {say.noMatchAdvice}
              </p>
            </div>
          )}
          {unavailable && (
            <p className="flex gap-1.5 text-amber-700 dark:text-amber-400">
              <span className="flex h-6 shrink-0 items-center"><TriangleAlert aria-hidden className="size-3.5" /></span>
              <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                <span className="py-1">{say.unavailable}</span>
                <button type="button" onClick={() => setAttempt((n) => n + 1)} className={cn(fix, "border-amber-500/40 text-amber-900 hover:bg-amber-500/10 dark:text-amber-200")}>
                  <RotateCw aria-hidden className="size-3" /> {say.retry}
                </button>
              </span>
            </p>
          )}
        </div>
      </div>

      {newPayee && complete && (
        <p className="-mt-1.5 flex gap-1.5 text-xs text-muted-foreground">
          <span className="flex h-6 shrink-0 items-center"><UserPlus aria-hidden className="size-3.5" /></span>
          <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
            <span className="py-1">
              {large ? (
                <>{say.newLarge} <span className="font-medium text-foreground">{amountText}</span>.</>
              ) : (
                say.newPayee
              )}
            </span>
            {large && onTestPayment && (
              <button type="button" onClick={() => onTestPayment(details)} className={cn(fix, "hover:bg-accent")}>
                {testPaymentLabel}
              </button>
            )}
          </span>
        </p>
      )}

      {needsAck && details.name.trim() && (
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" checked={acknowledged} onChange={(e) => setAcknowledged(e.target.checked)} className="mt-0.5 size-4 shrink-0 accent-primary outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50" />
          {acknowledgeLabel}
        </label>
      )}

      <button
        type="button"
        disabled={!canPay}
        aria-busy={pending || undefined}
        onClick={() => void pay()}
        className={cn(
          button,
          needsAck ? "bg-destructive text-white hover:bg-destructive/90 dark:bg-destructive/60" : verdict === "close" ? "bg-amber-700 text-white hover:bg-amber-800 dark:bg-amber-400 dark:text-amber-950" : "bg-primary text-primary-foreground hover:bg-primary/90"
        )}
      >
        {pending && <LoaderCircle aria-hidden className="size-4 animate-spin" />}
        <span className="min-w-0 text-balance break-words">
          {needsAck || verdict === "close" ? say.payAnyway(amountText, payee) : say.pay(amountText, payee)}
        </span>
      </button>
    </div>
  )
}
