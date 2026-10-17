"use client"

// Bollard UI — cancel-readback · MIT licence · https://bollard-ui.vercel.app/components/cancel-readback

import * as React from "react"
import { CalendarClock, Check, CircleCheck, LoaderCircle, Receipt, X } from "lucide-react"

import { cn } from "@/lib/utils"

export interface CancelAlternative {
  id: string
  /** e.g. "Pause for 1 month". */
  label: string
  /** The honest terms, e.g. "No charge until 13 Dec, then ₹499/mo". */
  detail: string
}

/** The exact moment access ends, with weekday, time and zone, plus whole days from `now`. */
export function describeAccessEnd(endsAt: Date | number | string, now: number, locale?: string, timeZone?: string) {
  const end = new Date(endsAt)
  const text = new Intl.DateTimeFormat(locale, {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone,
    timeZoneName: "short",
  }).format(end)
  const short = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", timeZone }).format(end)
  return { text, short, days: Math.max(0, Math.round((end.getTime() - now) / 86_400_000)), endsNow: end.getTime() <= now }
}

const button =
  "inline-flex h-9 items-center justify-center gap-2 rounded-md px-4 text-sm font-medium whitespace-nowrap shadow-xs outline-none transition-[color,background-color,box-shadow] focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-busy:cursor-progress"
const outline = "border bg-background hover:bg-accent dark:border-input dark:bg-input/30 dark:hover:bg-input/50"
type End = ReturnType<typeof describeAccessEnd>

export interface CancelReadbackProps extends Omit<React.ComponentProps<"section">, "title"> {
  /** Plan name, e.g. "Pro". */
  plan: string
  /** When paid access ends if they cancel now. */
  accessEndsAt: Date | number | string
  /** What the user loses when access ends. */
  lose: string[]
  /** What the user keeps after cancelling. */
  keep: string[]
  /** Refund wording, e.g. "₹1,240 back to your UPI within 5–7 days". `null` means no refund. */
  refund?: string | null
  /** Pause or downgrade options, offered once, below the cancel button. */
  alternatives?: CancelAlternative[]
  /** Called with the id of a pause or downgrade option the user picks. */
  onAlternative?: (id: string) => void
  /** Cancels. Return a promise to show a pending state; a rejection keeps the form. */
  onConfirm: () => void | Promise<void>
  /** Undoes the cancellation while access is still active. */
  onResume?: () => void | Promise<void>
  /** Called when the user decides to keep the plan. */
  onKeep?: () => void
  /** Controlled cancelled state. */
  cancelled?: boolean
  /** Initial cancelled state when uncontrolled. */
  defaultCancelled?: boolean
  /** Called when the plan is cancelled or resumed. */
  onCancelledChange?: (cancelled: boolean) => void
  /** BCP 47 locale for the end date. */
  locale?: string
  /** IANA time zone for the end date. Defaults to the visitor's. */
  timeZone?: string
  /** Heading; receives the plan name. */
  title?: (plan: string) => React.ReactNode
  /** Cancel button text; receives the plan and end date. */
  confirmLabel?: (plan: string, end: End) => string
  /** Keep-plan button text. */
  keepLabel?: (plan: string) => string
  /** Resume button text on the receipt. */
  resumeLabel?: string
  /** Shown when there is no refund. */
  noRefundText?: (end: End) => string
  /** Explains that access continues until the end date. */
  earlyText?: (plan: string, end: End) => string
  /** Receipt text after cancelling. */
  doneText?: (plan: string, end: End) => string
  /** Heading for pause and downgrade options. */
  alternativesLabel?: string
  /** Text for hiding the alternatives. */
  hideLabel?: string
}

/**
 * An honest cancel screen. It reads back the exact date and time access ends,
 * what is lost and kept, and the refund (or plainly that there isn't one),
 * and reassures that cancelling early doesn't cut paid time short. The cancel
 * button is first and never moves: pause or downgrade options appear once,
 * below it, with their real terms and a Hide. After cancelling it shows the
 * same readback as a receipt, with an undo until access ends.
 */
export function CancelReadback({
  plan,
  accessEndsAt,
  lose,
  keep,
  refund = null,
  alternatives = [],
  onAlternative,
  onConfirm,
  onResume,
  onKeep,
  cancelled,
  defaultCancelled = false,
  onCancelledChange,
  locale,
  timeZone,
  title = (p) => `Cancel ${p}`,
  confirmLabel = (p, end) => (end.endsNow ? `Cancel ${p} now` : `Cancel, keep ${p} until ${end.short}`),
  keepLabel = (p) => `Keep ${p}`,
  resumeLabel = "Undo cancellation",
  noRefundText = (end) => (end.endsNow ? "No refund." : `No refund: you've paid through ${end.short}, so you keep access until then.`),
  earlyText = (p, end) => `Cancelling today doesn't cut your time short. You keep ${p} for the ${end.days} days you paid for.`,
  doneText = (p, end) => (end.endsNow ? `${p} is cancelled and has ended. You won't be charged again.` : `${p} is cancelled. It stays active until ${end.text}, and you won't be charged again.`),
  alternativesLabel = "Or, instead of cancelling",
  hideLabel = "Hide",
  className,
  ...props
}: CancelReadbackProps) {
  const [innerCancelled, setInnerCancelled] = React.useState(defaultCancelled)
  const [end, setEnd] = React.useState<End | null>(null)
  const [offered, setOffered] = React.useState(alternatives.length > 0)
  const [pending, setPending] = React.useState(false)
  const baseId = React.useId()
  const isCancelled = cancelled ?? innerCancelled
  const endsKey = new Date(accessEndsAt).getTime()

  // Formatting needs the viewer's clock and zone, so it waits for the client.
  React.useEffect(() => setEnd(describeAccessEnd(endsKey, Date.now(), locale, timeZone)), [endsKey, locale, timeZone])

  const run = async (task: () => void | Promise<void>, next: boolean) => {
    if (pending) return
    setPending(true)
    try {
      await task()
      if (cancelled === undefined) setInnerCancelled(next)
      onCancelledChange?.(next)
      setOffered(false)
    } catch {
      // The caller reports the error; nothing changed.
    } finally {
      setPending(false)
    }
  }

  const facts = (
    <>
      <p className="flex gap-2 text-sm">
        <CalendarClock aria-hidden className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
        <span>
          Access ends <strong className="font-medium">{end?.endsNow ? "now" : (end?.text ?? "…")}</strong>
        </span>
      </p>
      <div className="grid gap-3 text-sm sm:grid-cols-2">
        {[
          { heading: "You lose", items: lose, icon: X, tone: "text-red-600 dark:text-red-400" },
          { heading: "You keep", items: keep, icon: Check, tone: "text-emerald-600 dark:text-emerald-400" },
        ].map(({ heading, items, icon: Icon, tone }) => (
          <div key={heading}>
            <p className="mb-1 text-xs font-medium text-muted-foreground">{heading}</p>
            <ul className="space-y-0.5">
              {items.map((item) => (
                <li key={item} className="flex gap-1.5">
                  <Icon aria-hidden className={cn("mt-0.5 size-3.5 shrink-0", tone)} /> {item}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <p className="flex gap-2 text-sm">
        <Receipt aria-hidden className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
        <span>{refund ? `Refund: ${refund}` : end ? noRefundText(end) : "…"}</span>
      </p>
    </>
  )

  return (
    <section
      data-slot="cancel-readback"
      data-state={isCancelled ? "cancelled" : "active"}
      aria-labelledby={`${baseId}-title`}
      className={cn("w-full max-w-md space-y-4 rounded-xl border bg-card p-4 text-card-foreground sm:p-5", className)}
      {...props}
    >
      <h3 id={`${baseId}-title`} className="font-medium">
        {title(plan)}
      </h3>

      {isCancelled ? (
        <>
          <style>{"@keyframes cui-cancel-readback-in{from{opacity:0;transform:translateY(-4px)}}"}</style>
          <p role="status" className="flex gap-2 rounded-md motion-safe:animate-[cui-cancel-readback-in_250ms_ease-out] bg-emerald-50 p-3 text-sm text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
            <CircleCheck aria-hidden className="mt-0.5 size-4 shrink-0" /> {end ? doneText(plan, end) : null}
          </p>
          {facts}
          {onResume && !end?.endsNow && (
            <button type="button" aria-busy={pending || undefined} onClick={() => void run(onResume, false)} className={cn(button, outline, "w-full")}>
              {pending && <LoaderCircle aria-hidden className="size-4 animate-spin" />} {resumeLabel}
            </button>
          )}
        </>
      ) : (
        <>
          {facts}
          {end && !end.endsNow && !refund && <p className="text-xs text-muted-foreground">{earlyText(plan, end)}</p>}
          <div className="flex flex-col gap-2 sm:flex-row-reverse sm:justify-start">
            <button
              type="button"
              aria-busy={pending || undefined}
              onClick={() => void run(onConfirm, true)}
              className={cn(button, "bg-destructive text-white hover:bg-destructive/90 dark:bg-destructive/60 dark:hover:bg-destructive/70")}
            >
              {pending && <LoaderCircle aria-hidden className="size-4 animate-spin" />}
              {end ? confirmLabel(plan, end) : title(plan)}
            </button>
            {onKeep && (
              <button type="button" disabled={pending} onClick={onKeep} className={cn(button, outline)}>
                {keepLabel(plan)}
              </button>
            )}
          </div>
          {offered && (
            <div className="space-y-1.5 border-t pt-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-medium text-muted-foreground">{alternativesLabel}</p>
                <button
                  type="button"
                  onClick={() => setOffered(false)}
                  className="h-6 rounded-md px-2 text-xs text-muted-foreground outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50"
                >
                  {hideLabel}
                </button>
              </div>
              <ul className="grid gap-2 sm:grid-cols-2">
                {alternatives.map((alt) => (
                  <li key={alt.id}>
                    <button
                      type="button"
                      onClick={() => onAlternative?.(alt.id)}
                      className="w-full rounded-md border px-3 py-2 text-left text-sm outline-none transition-colors hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:border-input"
                    >
                      <span className="block font-medium">{alt.label}</span>
                      <span className="block text-xs text-muted-foreground">{alt.detail}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </section>
  )
}
