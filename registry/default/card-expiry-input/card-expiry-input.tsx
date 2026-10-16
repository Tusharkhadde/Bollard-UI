"use client"

import * as React from "react"
import { CalendarClock, CircleX, TriangleAlert } from "lucide-react"

import { cn } from "@/lib/utils"
import { checkExpiry, formatExpiry, timeLeft } from "@/registry/default/card-expiry-input/card-expiry"

export * from "@/registry/default/card-expiry-input/card-expiry"

/** Default messages. `{date}`, `{left}`, `{month}`, `{years}`, `{fix}`, `{renewal}` are filled in. */
export const CARD_EXPIRY_MESSAGES = {
  valid: "Valid through {date}",
  left: "{left} left",
  thisMonth: "Expires at the end of this month",
  month: "There's no month {month}. Months run 01–12.",
  past: "This card expired on {date}.",
  swapped: "Looks like the year came first.",
  longYear: "Use the 2-digit year printed on the card.",
  far: "That's more than {years} years away. Check the year.",
  renewal: "It runs out before the {renewal} renewal, so that charge would fail.",
  use: "Use {fix}",
}

export interface CardExpiryInputProps
  extends Omit<React.ComponentProps<"input">, "value" | "defaultValue" | "onChange" | "type"> {
  /** Visible label. */
  label?: string
  /** Controlled value, as shown (MM/YY). */
  value?: string
  /** Initial value when uncontrolled. */
  defaultValue?: string
  /** Called with the formatted text, plus `{ month, year }` once it is a valid, unexpired date. */
  onValueChange?: (value: string, expiry: { month: number; year: number } | null) => void
  /** "Today" for the expiry checks. Defaults to the visitor's clock, read after mount. */
  today?: Date
  /** Next date the saved card will be charged. A card that runs out first gets a warning. */
  renewsOn?: Date
  /** Expiries further out than this many years are flagged as a likely wrong year. */
  maxYears?: number
  /** Locale for the dates read back. */
  locale?: string
  /** Override any of the default messages. */
  messages?: Partial<typeof CARD_EXPIRY_MESSAGES>
}

const fieldClass =
  "h-9 w-full min-w-0 rounded-md border bg-transparent px-3 font-mono text-base tabular-nums shadow-xs transition-[color,box-shadow] outline-none placeholder:font-sans placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm dark:bg-input/30 aria-invalid:border-destructive data-warning:border-amber-500 dark:data-warning:border-amber-400"
const fixClass =
  "inline-flex h-6 items-center gap-1 rounded-md border border-amber-500/40 px-2 font-medium text-amber-900 transition-colors hover:bg-amber-500/10 dark:text-amber-200 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
const keyframes = `@keyframes cui-card-expiry-input-flash{0%{background-color:rgb(16 185 129 / .3)}100%{background-color:transparent}}`

const fill = (template: string, values: Record<string, string | number>) =>
  template.replace(/\{(\w+)\}/g, (match, key: string) => String(values[key] ?? match))

/**
 * A card expiry field that types itself into MM/YY and reads the date back as "Valid through
 * 31 Oct 2028", since a card works to the end of its month, not the 1st. It catches month 00 or 13,
 * the year typed first (28/10, or a 2028-10 autofill), a four-digit year, an expired card, a year
 * too far out, and a card that dies before the subscription's next renewal, with one-tap fixes.
 */
export function CardExpiryInput({
  label = "Expiry date",
  value,
  defaultValue = "",
  onValueChange,
  today: todayProp,
  renewsOn,
  maxYears = 20,
  locale = "en-GB",
  messages,
  placeholder = "MM / YY",
  id,
  className,
  ref,
  ...props
}: CardExpiryInputProps) {
  const [inner, setInner] = React.useState(defaultValue)
  const [clock, setClock] = React.useState<Date>()
  const [flash, setFlash] = React.useState(0)
  const autoId = React.useId()
  const inputId = id ?? autoId
  const text = value ?? inner
  const t = { ...CARD_EXPIRY_MESSAGES, ...messages }

  React.useEffect(() => {
    if (!todayProp) setClock(new Date())
  }, [todayProp])
  const today = todayProp ?? clock
  const result = checkExpiry(text, { today, renewsOn, maxYears })
  const date = (d: Date) => new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", year: "numeric" }).format(d)

  const commit = (next: string) => {
    const check = checkExpiry(next, { today, renewsOn, maxYears })
    const [mm, yy] = next.split("/")
    const usable = check.kind === "ok" || (check.kind === "warning" && (check.issue === "far" || check.issue === "renewal"))
    if (value === undefined) setInner(next)
    onValueChange?.(next, usable ? { month: Number(mm), year: 2000 + Number(yy) } : null)
  }
  const apply = (fix: string) => {
    commit(fix)
    setFlash((n) => n + 1)
  }

  let line: React.ReactNode = null
  if (result.kind === "error") {
    line = (
      <p role="alert" className="flex items-center gap-1.5 py-1 text-destructive">
        <CircleX aria-hidden className="size-3.5 shrink-0" />
        {result.issue === "month" ? fill(t.month, { month: result.month ?? "" }) : fill(t.past, { date: result.expires ? date(result.expires) : "" })}
      </p>
    )
  } else if (result.kind === "warning") {
    const message = {
      swapped: t.swapped,
      "long-year": t.longYear,
      far: fill(t.far, { years: maxYears }),
      renewal: renewsOn ? fill(t.renewal, { renewal: date(renewsOn) }) : "",
    }[result.issue]
    line = (
      <p data-warning-id={result.issue} className="flex gap-1.5 text-amber-700 dark:text-amber-400">
        <span className="flex h-6 shrink-0 items-center">
          <TriangleAlert aria-hidden className="size-3.5" />
        </span>
        <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
          <span className="py-1">{message}</span>
          {result.fix && (
            <button type="button" onClick={() => apply(result.fix as string)} className={cn(fixClass, "font-mono")}>
              {fill(t.use, { fix: result.fix })}
            </button>
          )}
        </span>
      </p>
    )
  }

  const expires = result.kind === "ok" || (result.kind === "warning" && result.issue === "renewal") ? result.expires : undefined
  const invalid = result.kind === "error"

  return (
    <div data-slot="card-expiry-input" className={cn("grid content-start w-full max-w-[16rem] gap-1.5", className)}>
      <style>{keyframes}</style>
      <label htmlFor={inputId} className="w-fit text-sm font-medium">
        {label}
      </label>
      <input
        ref={ref}
        id={inputId}
        type="text"
        inputMode="numeric"
        autoComplete="cc-exp"
        maxLength={7}
        placeholder={placeholder}
        value={text}
        onChange={(event) => commit(formatExpiry(event.target.value, text))}
        aria-invalid={invalid || undefined}
        aria-describedby={`${inputId}-status`}
        data-warning={result.kind === "warning" ? "" : undefined}
        className={fieldClass}
        {...props}
      />
      <div id={`${inputId}-status`} aria-live="polite" className="grid min-h-6 gap-1 text-xs">
        {expires && today && (
          <p
            key={flash}
            className={cn(
              "flex w-fit items-center gap-1.5 rounded-sm py-1 pr-1 text-muted-foreground",
              flash > 0 && "motion-safe:animate-[cui-card-expiry-input-flash_400ms_ease-out]",
            )}
          >
            <CalendarClock aria-hidden className="size-3.5 shrink-0" />
            <span>
              <span className="font-medium text-foreground">{fill(t.valid, { date: date(expires) })}</span>
              {" · "}
              {result.kind === "ok" && result.thisMonth ? t.thisMonth : fill(t.left, { left: timeLeft(today, expires) })}
            </span>
          </p>
        )}
        {line}
      </div>
    </div>
  )
}
