"use client"

import * as React from "react"
import { ArrowUpRight, Loader2, OctagonX, ShieldAlert } from "lucide-react"

import { cn } from "@/lib/utils"
import { detectCollectRisks, type CollectRequest, type CollectRisk } from "./collect"

export { detectCollectRisks, looksPersonal, type CollectRequest, type CollectRisk } from "./collect"

/** Every visible string. `{amount}`, `{name}`, `{word}` and `{expected}` are filled in. */
export const UPI_COLLECT_MESSAGES = {
  direction: "This request takes money from you",
  youPay: "You pay",
  to: "to",
  note: "Their note",
  question: "Are you expecting money from them?",
  receiving: "Yes, they're paying me",
  paying: "No, I'm paying them",
  stopTitle: "Then decline this request.",
  stopBody: "Receiving money never needs your UPI PIN. Entering it here sends {amount} to them. Ask them to pay to your UPI ID or QR code instead.",
  answerFirst: "Answer this first.",
  risks: {
    receiveWording: "The note says “{word}”, but approving a request only ever sends money.",
    refund: "“{word}”: a real refund arrives on its own. You never approve it.",
    prize: "“{word}”: prizes and rewards never need your PIN.",
    buyer: "“{word}”: a common buyer scam on OLX and marketplaces. A buyer pays you; you don't approve their request.",
    kyc: "“{word}”: banks and utilities don't collect money through a UPI request to verify or unblock you.",
    personCollect: "This looks like a person's UPI ID. Person-to-person collect requests were switched off on 1 Oct 2025.",
    unknown: "You haven't paid this UPI ID before.",
    nameMismatch: "You expected {expected}, but the bank says this is {name}.",
    testAmount: "Small “test” requests are often followed by a bigger one.",
  } as Record<CollectRisk["kind"], string>,
  decline: "Decline",
  pay: "Pay {amount}",
  confirmPay: "Yes, send {amount}",
  confirmHint: "Sent money can't be pulled back. Press again to continue to your PIN.",
  declined: "Request declined.",
}

export type UpiCollectMessages = typeof UPI_COLLECT_MESSAGES

const fill = (template: string, values: Record<string, string | number>) =>
  template.replace(/\{(\w+)\}/g, (match, key: string) => String(values[key] ?? match))

const buttonClass = "inline-flex h-9 items-center justify-center gap-2 rounded-md px-4 text-sm font-medium outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-60"
const choiceClass =
  "inline-flex h-8 items-center rounded-md border px-3 text-sm font-medium outline-none transition-colors hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-checked:border-foreground aria-checked:bg-accent"

export interface UpiCollectGuardProps extends Omit<React.ComponentProps<"div">, "onChange"> {
  /** The incoming request. */
  request: CollectRequest
  /** UPI IDs the user has paid before; anything else is "unknown". */
  contacts?: string[]
  /** Who the user believes is asking, to compare with the bank's name. */
  expectedName?: string
  /** Locale for money. */
  locale?: string
  /** Continue to the PIN screen. Only reachable after the user says they are paying. May return a Promise. */
  onPay?: (request: CollectRequest) => void | Promise<void>
  /** Decline the request. May return a Promise. */
  onDecline?: (request: CollectRequest) => void | Promise<void>
  /** Any visible string. */
  messages?: Partial<Omit<UpiCollectMessages, "risks">> & { risks?: Partial<UpiCollectMessages["risks"]> }
}

/**
 * Sits in front of the UPI PIN for a collect request and says the one thing scams hide: approving
 * sends money, it never receives it. Asks "are you expecting money?" and turns a yes into a
 * decline-only stop; flags refund, prize, OLX-buyer and KYC wording, person-to-person collects
 * (stopped since 1 Oct 2025), unknown requesters and small test amounts.
 */
export function UpiCollectGuard({
  request,
  contacts,
  expectedName,
  locale = "en-IN",
  onPay,
  onDecline,
  messages,
  className,
  "aria-describedby": describedBy,
  ...props
}: UpiCollectGuardProps) {
  const t = { ...UPI_COLLECT_MESSAGES, ...messages, risks: { ...UPI_COLLECT_MESSAGES.risks, ...messages?.risks } } as UpiCollectMessages
  const [intent, setIntent] = React.useState<"receiving" | "paying">()
  const [asked, setAsked] = React.useState(false)
  const [nudge, setNudge] = React.useState(false)
  const [pending, setPending] = React.useState<"pay" | "decline">()
  const [status, setStatus] = React.useState("")
  const [declined, setDeclined] = React.useState(false)
  const busy = React.useRef(false)
  const questionRef = React.useRef<HTMLDivElement>(null)
  const declineRef = React.useRef<HTMLButtonElement>(null)
  const id = React.useId()
  const safe: CollectRequest = request && typeof request === "object" ? request : { amount: 0 }
  const amountValue = Number.isFinite(Number(safe.amount)) ? Math.max(0, Number(safe.amount)) : 0
  const amount = new Intl.NumberFormat(locale, { style: "currency", currency: "INR", minimumFractionDigits: 2 }).format(amountValue)
  const risks = detectCollectRisks(safe, { contacts, expectedName })
  const name = safe.name || safe.vpa || ""
  const note = typeof safe.note === "string" ? safe.note.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n").slice(0, 500) : ""

  // Reset the answer when a different request arrives.
  const key = `${safe.vpa}|${amountValue}|${note}`
  const [seen, setSeen] = React.useState(key)
  if (seen !== key) {
    setSeen(key)
    setIntent(undefined)
    setAsked(false)
    setNudge(false)
    setDeclined(false)
    setStatus("")
  }

  const choose = (next: "receiving" | "paying") => {
    setIntent(next)
    setNudge(false)
    setAsked(false)
    if (next === "receiving") {
      setStatus(`${t.stopTitle} ${fill(t.stopBody, { amount })}`)
      requestAnimationFrame(() => declineRef.current?.focus())
    } else setStatus("")
  }

  const run = async (kind: "pay" | "decline") => {
    const action = kind === "pay" ? onPay : onDecline
    if (!action || busy.current || declined) return
    busy.current = true
    setPending(kind)
    try {
      await action(safe)
      if (kind === "decline") {
        setDeclined(true)
        setStatus(t.declined)
      }
    } catch {
      // The caller reports failures; the buttons become usable again.
    } finally {
      busy.current = false
      setPending(undefined)
    }
  }

  const pay = () => {
    if (intent !== "paying") {
      setNudge(true)
      setStatus(t.answerFirst)
      questionRef.current?.querySelector<HTMLElement>("[role=radio]")?.focus()
      return
    }
    if (risks.length && !asked) {
      setAsked(true)
      setStatus(t.confirmHint)
      return
    }
    void run("pay")
  }

  const onRadioKey = (event: React.KeyboardEvent) => {
    if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return
    event.preventDefault()
    const next = intent === "receiving" ? "paying" : "receiving"
    choose(next)
    questionRef.current?.querySelector<HTMLElement>(`[data-intent=${next}]`)?.focus()
  }

  const describe = (risk: CollectRisk) => fill(t.risks[risk.kind], { word: "word" in risk ? risk.word : "", expected: "expected" in risk ? risk.expected : "", name })

  return (
    <div data-slot="upi-collect-guard" data-state={declined ? "declined" : intent === "receiving" ? "stopped" : risks.length ? "warning" : "ok"} className={cn("w-full max-w-md space-y-3 rounded-xl border bg-card p-4 text-sm text-card-foreground", className)} {...props}>
      <div className="rounded-md border border-red-500/30 bg-red-500/5 p-3">
        <p className="flex items-center gap-1.5 text-xs font-medium text-red-800 dark:text-red-300">
          <ArrowUpRight aria-hidden className="size-4 shrink-0" />
          {t.direction}
        </p>
        <p className="mt-1.5 flex flex-wrap items-baseline gap-x-2">
          <span className="text-muted-foreground">{t.youPay}</span>
          <span className="text-2xl font-semibold tabular-nums">{amount}</span>
        </p>
        <p className="min-w-0 [overflow-wrap:anywhere]">
          <span className="text-muted-foreground">{t.to} </span>
          <span className="font-medium">{name}</span>
          {safe.name && safe.vpa && <span className="text-muted-foreground"> · {safe.vpa}</span>}
        </p>
        {note && (
          <p className="mt-2 whitespace-pre-line text-xs [overflow-wrap:anywhere]">
            <span className="text-muted-foreground">{t.note}: </span>“{note}”
          </p>
        )}
      </div>

      <div ref={questionRef} className="space-y-1.5">
        <p id={`${id}-q`} className="font-medium">{t.question}</p>
        <div role="radiogroup" aria-labelledby={`${id}-q`} aria-describedby={nudge ? `${id}-nudge` : undefined} className="flex flex-wrap gap-2" onKeyDown={onRadioKey}>
          {(["receiving", "paying"] as const).map((option, index) => (
            <button
              key={option}
              type="button"
              role="radio"
              data-intent={option}
              aria-checked={intent === option}
              tabIndex={intent ? (intent === option ? 0 : -1) : index === 0 ? 0 : -1}
              onClick={() => choose(option)}
              className={choiceClass}
            >
              {t[option]}
            </button>
          ))}
        </div>
        {nudge && <p id={`${id}-nudge`} className="text-xs text-amber-700 dark:text-amber-400">{t.answerFirst}</p>}
      </div>

      {intent === "receiving" ? (
        <div className="flex gap-2 rounded-md border border-red-500/30 bg-red-500/5 p-3 text-red-800 dark:text-red-300">
          <OctagonX aria-hidden className="mt-0.5 size-4 shrink-0" />
          <div className="min-w-0 space-y-1">
            <p className="font-medium">{t.stopTitle}</p>
            <p className="text-xs">{fill(t.stopBody, { amount })}</p>
          </div>
        </div>
      ) : risks.length > 0 && (
        <div className="space-y-1.5 rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-800 dark:text-amber-300">
          <ul id={`${id}-risks`} className="space-y-1.5">
            {risks.map((risk) => (
              <li key={risk.kind} className="flex gap-1.5">
                <ShieldAlert aria-hidden className="mt-0.5 size-3.5 shrink-0" />
                <span className="min-w-0 break-words">{describe(risk)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {asked && intent === "paying" && <p className="text-xs text-muted-foreground">{t.confirmHint}</p>}
      <span role="status" className="sr-only">{status}</span>
      <div className="grid gap-2 sm:flex sm:justify-end">
        {intent !== "receiving" && !declined && onPay && (
          <button
            type="button"
            onClick={pay}
            aria-disabled={!!pending || undefined}
            aria-describedby={[describedBy, risks.length ? `${id}-risks` : ""].filter(Boolean).join(" ") || undefined}
            className={cn(buttonClass, asked ? "bg-amber-700 text-white hover:bg-amber-800 dark:bg-amber-400 dark:text-amber-950" : "border bg-background hover:bg-accent dark:bg-input/30")}
          >
            {pending === "pay" && <Loader2 aria-hidden className="size-4 animate-spin" />}
            {fill(asked ? t.confirmPay : t.pay, { amount })}
          </button>
        )}
        <button ref={declineRef} type="button" onClick={() => run("decline")} aria-disabled={declined || !!pending || undefined} className={cn(buttonClass, "bg-primary text-primary-foreground hover:bg-primary/90")}>
          {pending === "decline" && <Loader2 aria-hidden className="size-4 animate-spin" />}
          {declined ? t.declined : t.decline}
        </button>
      </div>
    </div>
  )
}
