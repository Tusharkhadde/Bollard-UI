"use client"

import * as React from "react"
import { CircleAlert, Loader2, TicketPercent, X } from "lucide-react"

import { cn } from "@/lib/utils"
import { cleanCoupon, confusablePositions, CONFUSABLE_GROUPS, matchConfusable, type CouponResult } from "@/registry/default/coupon-input/coupon"

export * from "@/registry/default/coupon-input/coupon"

type Applied = Extract<CouponResult, { status: "applied" }>

/** Every sentence the field shows. Override any of them to reword or translate. */
export const COUPON_INPUT_MESSAGES = {
  label: "Promo code",
  placeholder: "Enter code",
  placeholderApplied: "Try another code",
  apply: "Apply",
  remove: "Remove code",
  cleaned: (parts: string[]) => `Cleaned the pasted code: removed ${parts.join(" and ")}.`,
  saving: (amount: string) => `You save ${amount}`,
  capped: (cap: string, full: string) => `Capped at ${cap}. Without the cap it would be ${full}.`,
  partial: (items: string) => `Not applied to ${items}. The saving is on the rest of your cart.`,
  minCart: (code: string, more: string, minimum: string) => `Add ${more} more to use ${code}. It needs a cart of ${minimum}.`,
  expired: (code: string, date: string) => `${code} ended on ${date}.`,
  notStarted: (code: string, date: string) => `${code} starts on ${date}.`,
  excluded: (code: string, items: string) => `${code} doesn't cover anything in your cart (${items}).`,
  used: (code: string) => `You've already used ${code}. It works once per customer.`,
  limitReached: (code: string) => `${code} has been claimed by everyone it was meant for.`,
  notEligible: (code: string, reason?: string) => reason ?? `${code} isn't available on this account.`,
  notFound: (code: string) => `We couldn't find ${code}.`,
  didYouMean: "Did you mean",
  lookAlike: (pairs: string) => `Check the look-alikes: ${pairs}.`,
  worse: (next: string, current: string, currentCode: string) =>
    `This saves ${next}, less than ${currentCode} (${current}). Only one code can be used.`,
  switchAnyway: "Switch anyway",
  keep: (code: string) => `Keep ${code}`,
  failed: "Couldn't check the code. Your cart is unchanged.",
  retry: "Try again",
}

const NAMES: Record<string, string> = { O: "O (letter)", "0": "0 (zero)", I: "I (letter)", "1": "1 (one)", L: "L", S: "S", "5": "5", B: "B", "8": "8", Z: "Z", "2": "2", G: "G", "6": "6" }

export interface CouponInputProps extends Omit<React.ComponentProps<"div">, "defaultValue" | "onChange"> {
  /** Checks a cleaned code against the cart. May return a Promise; a rejection shows a retry. */
  onApply: (code: string) => CouponResult | Promise<CouponResult>
  /** The applied code, controlled. `null` when none. */
  value?: Applied | null
  /** The applied code when uncontrolled. */
  defaultValue?: Applied | null
  /** Called when a code is applied or removed. */
  onValueChange?: (value: Applied | null) => void
  /** Public codes (banners, emails) to compare a not-found code against for look-alike typos. */
  knownCodes?: string[]
  /** A code to check straight away, e.g. from a `?coupon=` link or a "copy code" banner. */
  defaultCode?: string
  /** Keep letter case as typed. Most shops treat codes as case-insensitive. */
  caseSensitive?: boolean
  /** Ask before replacing an applied code with one that saves less. Turn off when codes stack. */
  guardDowngrade?: boolean
  /** ISO 4217 code for savings and minimums. */
  currency?: string
  /** BCP 47 locale for money and dates. */
  locale?: string
  /** Time zone for expiry dates. */
  timeZone?: string
  /** Reword or translate any sentence. */
  messages?: Partial<typeof COUPON_INPUT_MESSAGES>
}

const fieldClass =
  "h-9 w-full min-w-0 rounded-md border bg-transparent px-3 font-mono text-base tracking-wider slashed-zero shadow-xs transition-[color,box-shadow] outline-none placeholder:font-sans placeholder:tracking-normal placeholder:normal-case placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 md:text-sm dark:bg-input/30 aria-invalid:border-amber-500 dark:aria-invalid:border-amber-400"
const buttonClass =
  "inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-md border px-4 text-sm font-medium shadow-xs transition-colors outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 dark:bg-input/30"
const fixClass =
  "inline-flex h-6 items-center gap-1 rounded-md border border-amber-500/40 px-2 font-medium text-amber-900 transition-colors hover:bg-amber-500/10 dark:text-amber-200 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"

/** The code in a monospace face with every look-alike character underlined. */
function MarkedCode({ code }: { code: string }) {
  const marks = new Set(confusablePositions(code))
  return (
    <span className="font-mono font-medium tracking-wider slashed-zero">
      {[...code].map((ch, i) => (marks.has(i) ? <span key={i} className="underline decoration-amber-500 decoration-2 underline-offset-2">{ch}</span> : ch))}
    </span>
  )
}

/**
 * A promo-code field that never says just "invalid". It cleans pasted spaces, hidden
 * characters and case, says exactly why a code didn't apply (cart minimum with the gap,
 * expiry date, excluded items, already used), spots O-vs-0 style look-alikes with a
 * one-tap fix, shows the real saving including caps, and asks before a worse code
 * replaces a better one.
 */
export function CouponInput({
  onApply,
  value,
  defaultValue = null,
  onValueChange,
  knownCodes = [],
  defaultCode,
  caseSensitive = false,
  guardDowngrade = true,
  currency = "INR",
  locale = "en-IN",
  timeZone,
  messages,
  className,
  ...props
}: CouponInputProps) {
  const m = { ...COUPON_INPUT_MESSAGES, ...messages }
  const [inner, setInner] = React.useState<Applied | null>(defaultValue)
  const [text, setText] = React.useState("")
  const [note, setNote] = React.useState("")
  const [busy, setBusy] = React.useState(false)
  const [result, setResult] = React.useState<CouponResult | "failed" | null>(null)
  const inputRef = React.useRef<HTMLInputElement>(null)
  const pasted = React.useRef(false)
  const id = React.useId()
  const applied = value === undefined ? inner : value
  // Buttons like "Did you mean" and "Remove" vanish once used; send focus back to the field instead of <body>.
  const refocus = () =>
    requestAnimationFrame(() => {
      const active = document.activeElement
      if (!active || active === document.body) inputRef.current?.focus()
    })

  const money = (n: number) => new Intl.NumberFormat(locale, { style: "currency", currency, maximumFractionDigits: Number.isInteger(n) ? 0 : 2 }).format(n)
  const date = (d: Date | string) => new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", year: "numeric", timeZone }).format(new Date(d))

  const commit = (next: Applied | null) => {
    if (value === undefined) setInner(next)
    onValueChange?.(next)
  }

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const cleaned = cleanCoupon(event.target.value, caseSensitive)
    const parts = [
      cleaned.spaces && `${cleaned.spaces} space${cleaned.spaces > 1 ? "s" : ""}`,
      cleaned.invisible && `${cleaned.invisible} hidden character${cleaned.invisible > 1 ? "s" : ""}`,
    ].filter(Boolean) as string[]
    // Only mention cleaning for pastes; a typed space is simply ignored.
    setNote(parts.length && pasted.current ? m.cleaned(parts) : "")
    pasted.current = false
    setText(cleaned.code)
    setResult(null)
  }

  const apply = async (code = text, auto = false) => {
    if (!code || busy) return
    setText(code)
    setBusy(true)
    try {
      const next = await onApply(code)
      setResult(next)
      if (next.status === "applied" && !(guardDowngrade && applied && applied.code !== next.code && next.saving < applied.saving)) {
        commit(next)
        setText("")
        setNote("")
      }
    } catch {
      setResult("failed")
    } finally {
      setBusy(false)
      // A code checked on load never grabs focus (or opens the mobile keyboard).
      if (!auto) refocus()
    }
  }

  const opened = React.useRef(false)
  React.useEffect(() => {
    if (opened.current || !defaultCode) return
    opened.current = true
    apply(cleanCoupon(defaultCode, caseSensitive).code, true)
    // Runs once, for the code the field opened with.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const status = result === "failed" ? null : result
  const downgrade = status?.status === "applied" && applied?.code !== status.code ? status : null
  const suggestion = status?.status === "not-found" ? matchConfusable(status.code, knownCodes) : null
  const groups = status?.status === "not-found" && !suggestion
    ? CONFUSABLE_GROUPS.filter((g) => [...status.code].some((ch) => g.includes(ch)))
    : []

  let reason: React.ReactNode = null
  if (status && status.status !== "applied") {
    const code = status.code
    if (status.status === "min-cart") {
      reason = (
        <span className="grid w-full gap-1.5">
          <span>{m.minCart(code, money(status.minimum - status.cartTotal), money(status.minimum))}</span>
          <span className="h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
            <span className="block h-full rounded-full bg-amber-500 transition-[width] duration-300" style={{ width: `${Math.min(100, (status.cartTotal / status.minimum) * 100)}%` }} />
          </span>
        </span>
      )
    } else if (status.status === "expired") reason = m.expired(code, date(status.endedAt))
    else if (status.status === "not-started") reason = m.notStarted(code, date(status.startsAt))
    else if (status.status === "excluded") reason = m.excluded(code, status.items.join(", "))
    else if (status.status === "used") reason = m.used(code)
    else if (status.status === "limit-reached") reason = m.limitReached(code)
    else if (status.status === "not-eligible") reason = m.notEligible(code, status.reason)
    else {
      reason = (
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="py-1">{m.notFound(code)}</span>
          {suggestion ? (
            <button type="button" className={fixClass} onClick={() => apply(suggestion)} aria-label={`${m.didYouMean} ${suggestion}? Apply it`}>
              {m.didYouMean} <MarkedCode code={suggestion} /><span className="-ml-1">?</span>
            </button>
          ) : groups.length ? (
            <span className="py-1">
              <MarkedCode code={code} /> · {m.lookAlike(groups.map((g) => [...g].map((ch) => NAMES[ch]).join(" vs ")).join(", "))}
            </span>
          ) : null}
        </span>
      )
    }
  }

  return (
    <div data-slot="coupon-input" className={cn("grid w-full max-w-sm gap-1.5", className)} {...props}>
      <label htmlFor={id} className="w-fit text-sm font-medium">{m.label}</label>

      {applied && (
        <div className="flex items-center gap-2 rounded-md border border-emerald-500/40 bg-emerald-50 px-3 py-2 text-sm text-emerald-950 dark:bg-emerald-950/30 dark:text-emerald-50">
          <TicketPercent aria-hidden className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
          <span className="min-w-0 flex-1">
            <span className="font-mono font-medium tracking-wider slashed-zero">{applied.code}</span>
            {applied.description && <span className="text-emerald-800 dark:text-emerald-200"> · {applied.description}</span>}
            <span className="block font-medium tabular-nums">{m.saving(money(applied.saving))}</span>
            {applied.uncapped !== undefined && applied.uncapped > applied.saving && (
              <span className="block text-xs text-emerald-800 dark:text-emerald-200">{m.capped(money(applied.saving), money(applied.uncapped))}</span>
            )}
            {!!applied.excludedItems?.length && <span className="block text-xs text-emerald-800 dark:text-emerald-200">{m.partial(applied.excludedItems.join(", "))}</span>}
          </span>
          <button
            type="button"
            onClick={() => { commit(null); setResult(null); refocus() }}
            aria-label={`${m.remove} ${applied.code}`}
            className="grid size-7 shrink-0 place-items-center self-start rounded-md transition-colors hover:bg-emerald-500/10 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            <X aria-hidden className="size-4" />
          </button>
        </div>
      )}

      <div className="flex gap-2">
        <input
          ref={inputRef}
          id={id}
          value={text}
          onChange={handleChange}
          onPaste={() => { pasted.current = true }}
          onKeyDown={(event) => {
            if (event.key !== "Enter") return
            event.preventDefault()
            apply()
          }}
          autoComplete="off"
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
          placeholder={applied ? m.placeholderApplied : m.placeholder}
          aria-invalid={!!reason || undefined}
          aria-describedby={`${id}-status`}
          className={cn(fieldClass, !caseSensitive && "uppercase")}
        />
        <button type="button" onClick={() => apply()} disabled={!text || busy} aria-busy={busy || undefined} className={buttonClass}>
          {busy && <Loader2 aria-hidden className="size-4 animate-spin" />}
          {m.apply}
        </button>
      </div>

      <div id={`${id}-status`} aria-live="polite" className="text-xs empty:hidden">
        {note && !reason && <p className="py-1 text-muted-foreground">{note}</p>}
        {result === "failed" && (
          <p className="flex items-center gap-2 text-destructive">
            <CircleAlert aria-hidden className="size-3.5 shrink-0" />
            <span>{m.failed}</span>
            <button type="button" onClick={() => apply()} className="font-medium underline underline-offset-2 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50">{m.retry}</button>
          </p>
        )}
        {reason && (
          <p className="flex gap-1.5 text-amber-700 dark:text-amber-400">
            <span className="flex h-6 shrink-0 items-center"><CircleAlert aria-hidden className="size-3.5" /></span>
            <span className="flex min-w-0 flex-1 items-center py-1">{reason}</span>
          </p>
        )}
        {downgrade && applied && (
          <div className="flex gap-1.5 text-amber-700 dark:text-amber-400">
            <span className="flex h-6 shrink-0 items-center"><CircleAlert aria-hidden className="size-3.5" /></span>
            <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
              <span className="py-1">{m.worse(money(downgrade.saving), money(applied.saving), applied.code)}</span>
              <button type="button" className={fixClass} onClick={() => { setResult(null); setText(""); inputRef.current?.focus() }}>{m.keep(applied.code)}</button>
              <button type="button" className={fixClass} onClick={() => { commit(downgrade); setResult(null); setText(""); refocus() }}>{m.switchAnyway}</button>
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
