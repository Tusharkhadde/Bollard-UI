"use client"

import * as React from "react"
import { Gift, Loader2, OctagonX, PhoneOff, ShieldAlert } from "lucide-react"

import { cn } from "@/lib/utils"
import { scamSignals, shouldPause, type GiftCardLine, type ScamOptions, type ScamSignal, type ScamStory } from "./scam"

export { findStories, LARGE_TOTAL_BY_CURRENCY, largeTotalFor, normalizeNote, SCAM_WORDS, scamSignals, shouldPause, type GiftCardLine, type ScamOptions, type ScamSignal, type ScamStory } from "./scam"

export type ScamAnswer = "gift" | "asked" | "bill"

/** Every visible string. `{total}`, `{count}`, `{brands}` and `{words}` are filled in. */
export const GIFT_CARD_SCAM_MESSAGES = {
  calm: "Gift cards are for gifts. Never use them to pay someone.",
  heading: "Quick check before you pay",
  lead: "No real company or government agency asks to be paid in gift cards. Anyone who does is a scammer.",
  why: "Why we're asking",
  story: {
    codes: "The note talks about sending card codes ({words}). Whoever has the number and PIN can spend the money, even if you keep the card.",
    boss: "The note mentions a boss or work ({words}). Scammers pose as managers who need cards “for clients”, fast.",
    government: "The note mentions {words}. Tax offices, police and courts never take gift cards.",
    refund: "The note mentions {words}. A real refund never needs you to buy cards.",
    techSupport: "The note mentions {words}. Microsoft, Apple and real support desks don't take gift cards.",
    utility: "The note mentions {words}. Power, gas and water companies don't take gift cards.",
    prize: "The note mentions {words}. A real prize never costs a fee in gift cards.",
    emergency: "The note mentions {words}. Call that person back on a number you already have.",
  } as Record<ScamStory, string>,
  large: "{total} is a lot to put on gift cards.",
  several: "{count} cards in one order ({brands}).",
  firstPurchase: "This is your first gift card order.",
  question: "Did someone ask you to buy these to pay them, or to send them the codes?",
  answers: { gift: "No, they're gifts for people I know", asked: "Yes, someone asked me to", bill: "I'm paying a bill, fee or fine with them" } as Record<ScamAnswer, string>,
  stopHeading: "Stop. This is a scam.",
  stopBody: "Whatever they said, nobody legitimate takes payment in gift cards. Don't buy the cards and don't share any codes.",
  stopPhone: "If someone is on the phone with you now, hang up. Then talk to someone you trust.",
  stopShared: "Already sent codes? Contact the card company today; some can freeze the balance.",
  cancel: "Cancel this order",
  back: "I picked the wrong answer",
  help: "How to report it",
  answerFirst: "Answer the question above to continue.",
  continue: "Continue to payment",
}

export type GiftCardScamMessages = Omit<typeof GIFT_CARD_SCAM_MESSAGES, "story" | "answers"> & { story: Record<ScamStory, string>; answers: Record<ScamAnswer, string> }

const fill = (template: string, values: Record<string, string | number>) =>
  template.replace(/\{(\w+)\}/g, (match, key: string) => String(values[key] ?? match))

export interface GiftCardScamGuardProps extends Omit<React.ComponentProps<"div">, "onChange"> {
  /** Cards in the order. */
  lines: GiftCardLine[]
  /** Gift message or note on the order, checked for scam stories. */
  note?: string
  /** True when this customer has never bought a gift card before. */
  firstPurchase?: boolean
  /** ISO 4217 code for amounts. */
  currency?: string
  /** BCP 47 locale for formatting the total. */
  locale?: string
  /** Total at or above which the order counts as large: a number, or one per currency. Defaults to about US$500 in `currency` (e.g. ₹20,000). */
  largeTotal?: ScamOptions["largeTotal"]
  /** Card count at or above which the order counts as several. Defaults to 3. */
  severalCards?: ScamOptions["severalCards"]
  /** Extra or replacement word lists, e.g. in another language. */
  words?: ScamOptions["words"]
  /** Where "How to report it" goes, e.g. your country's fraud reporting site. */
  helpUrl?: string
  /** Called with the user's answer whenever it changes, for your fraud signals. */
  onAnswer?: (answer: ScamAnswer | null) => void
  /** Proceed to payment. Only reachable after a "gift" answer when the order is paused. May return a Promise. */
  onContinue?: () => void | Promise<void>
  /** Cancel the order. */
  onCancel?: () => void
  /** Any visible string; `story` and `answers` may be partial. */
  messages?: Partial<Omit<GiftCardScamMessages, "story" | "answers">> & { story?: Partial<Record<ScamStory, string>>; answers?: Partial<Record<ScamAnswer, string>> }
}

/**
 * Stops someone paying a scammer with gift cards. At checkout it looks for the classic patterns
 * (a large total, several cards, a note about a boss, tax, police, a refund or tech support, a first
 * gift card order) and, when they show up, pauses on one plain question the user must answer.
 * "Someone asked me to" or "I'm paying a bill" ends at a clear stop screen, not at payment.
 */
export function GiftCardScamGuard({
  lines,
  note,
  firstPurchase,
  currency = "USD",
  locale,
  largeTotal,
  severalCards,
  words,
  helpUrl,
  onAnswer,
  onContinue,
  onCancel,
  messages,
  className,
  ...props
}: GiftCardScamGuardProps) {
  const t = { ...GIFT_CARD_SCAM_MESSAGES, ...messages, story: { ...GIFT_CARD_SCAM_MESSAGES.story, ...messages?.story }, answers: { ...GIFT_CARD_SCAM_MESSAGES.answers, ...messages?.answers } }
  const signals = scamSignals(lines, note, firstPurchase, { largeTotal, currency, severalCards, words })
  const paused = shouldPause(signals)
  const [answer, setAnswer] = React.useState<ScamAnswer | null>(null)
  const [pending, setPending] = React.useState(false)
  const [announcement, setAnnouncement] = React.useState("")
  const rootRef = React.useRef<HTMLDivElement>(null)
  const id = React.useId()
  const stopped = paused && (answer === "asked" || answer === "bill")

  React.useEffect(() => {
    const timer = setTimeout(() => setAnnouncement(stopped ? t.stopHeading : paused ? t.heading : ""), 400)
    return () => clearTimeout(timer)
  }, [paused, stopped, t.heading, t.stopHeading])

  const money = (n: number) => {
    try {
      return new Intl.NumberFormat(locale, { style: "currency", currency, maximumFractionDigits: 0 }).format(n)
    } catch {
      return `${Math.round(n)} ${currency}`
    }
  }
  const list = (items: string[]) => (typeof Intl.ListFormat === "function" ? new Intl.ListFormat(locale, { type: "conjunction" }).format(items) : items.join(", "))
  const describe = (s: ScamSignal) => {
    switch (s.kind) {
      case "story": return fill(t.story[s.story], { words: list(s.words.slice(0, 3).map((w) => `“${w}”`)) })
      case "large": return fill(t.large, { total: money(s.total) })
      case "several": return fill(t.several, { count: s.count, brands: list(s.brands) })
      case "firstPurchase": return t.firstPurchase
    }
  }

  const choose = (next: ScamAnswer | null) => {
    setAnswer(next)
    onAnswer?.(next)
    requestAnimationFrame(() => {
      const target = next === "asked" || next === "bill" ? "[data-cancel]" : next === null ? "input[type=radio]" : null
      if (target) rootRef.current?.querySelector<HTMLElement>(target)?.focus()
    })
  }

  const proceed = async () => {
    if (!onContinue || pending || (paused && answer !== "gift")) return
    setPending(true)
    try {
      await onContinue()
    } catch {
      // The caller reports payment failures; the button becomes usable again.
    } finally {
      setPending(false)
    }
  }

  const button = "inline-flex h-9 items-center justify-center gap-2 rounded-md px-4 text-sm font-medium outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-60"
  const canContinue = !paused || answer === "gift"

  return (
    <div ref={rootRef} data-slot="gift-card-scam-guard" data-state={stopped ? "stopped" : paused ? (answer === "gift" ? "answered" : "paused") : "ok"} className={cn("w-full max-w-md space-y-3 text-sm", className)} {...props}>
      <span aria-live="polite" className="sr-only">{announcement}</span>
      {!paused && (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Gift aria-hidden className="size-3.5 shrink-0" />
          {t.calm}
        </p>
      )}
      {paused && !stopped && (
        <section aria-labelledby={`${id}-h`} className="space-y-3 rounded-lg border border-amber-500/40 bg-amber-500/5 p-4">
          <div className="flex gap-2 text-amber-900 dark:text-amber-200">
            <ShieldAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
            <div className="min-w-0 space-y-1">
              <h3 id={`${id}-h`} className="font-medium">{t.heading}</h3>
              <p className="text-amber-800 dark:text-amber-300">{t.lead}</p>
            </div>
          </div>
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground">{t.why}</p>
            <ul className="list-disc space-y-1 pl-5 text-xs marker:text-amber-600">
              {signals.map((s) => <li key={s.kind === "story" ? s.story : s.kind} className="break-words">{describe(s)}</li>)}
            </ul>
          </div>
          <fieldset className="space-y-2">
            <legend className="mb-2 font-medium">{t.question}</legend>
            {(Object.keys(t.answers) as ScamAnswer[]).map((key) => (
              <label key={key} className="flex min-h-9 cursor-pointer items-center gap-2.5 rounded-md border bg-background px-3 py-2 has-[:checked]:border-foreground/40 has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-ring/50 dark:bg-input/30">
                <input type="radio" name={`${id}-answer`} value={key} checked={answer === key} onChange={() => choose(key)} className="size-4 shrink-0 accent-foreground outline-none" />
                <span className="min-w-0">{t.answers[key]}</span>
              </label>
            ))}
          </fieldset>
        </section>
      )}
      {stopped && (
        <section role="alert" aria-labelledby={`${id}-stop`} className="space-y-3 rounded-lg border border-red-500/40 bg-red-500/5 p-4 text-red-900 dark:text-red-200">
          <div className="flex gap-2">
            <OctagonX aria-hidden className="mt-0.5 size-5 shrink-0" />
            <div className="min-w-0 space-y-2">
              <h3 id={`${id}-stop`} className="text-base font-semibold">{t.stopHeading}</h3>
              <p>{t.stopBody}</p>
              <p className="flex gap-1.5"><PhoneOff aria-hidden className="mt-0.5 size-4 shrink-0" />{t.stopPhone}</p>
              <p className="text-xs text-red-800 dark:text-red-300">{t.stopShared}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" data-cancel onClick={onCancel} className={cn(button, "bg-red-700 text-white hover:bg-red-800 dark:bg-red-400 dark:text-red-950")}>{t.cancel}</button>
            {helpUrl && <a href={helpUrl} target="_blank" rel="noreferrer" className="rounded-sm text-sm font-medium underline underline-offset-4 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50">{t.help}</a>}
            <button type="button" onClick={() => choose(null)} className="ml-auto inline-flex h-8 items-center rounded-md px-3 text-xs font-medium text-muted-foreground outline-none hover:bg-accent hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50">{t.back}</button>
          </div>
        </section>
      )}
      {onContinue && !stopped && (
        <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-1.5">
          {!canContinue && <p id={`${id}-wait`} className="text-xs text-muted-foreground">{t.answerFirst}</p>}
          <button
            type="button"
            onClick={proceed}
            disabled={!canContinue || pending}
            aria-describedby={!canContinue ? `${id}-wait` : undefined}
            className={cn(button, "bg-primary text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed")}
          >
            {pending && <Loader2 aria-hidden className="size-4 animate-spin" />}
            {t.continue}
          </button>
        </div>
      )}
    </div>
  )
}
