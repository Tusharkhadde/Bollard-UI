"use client"

import * as React from "react"
import { CircleCheck, CircleX, Landmark } from "lucide-react"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"

import { cn } from "@/lib/utils"
import { AmountInput } from "@/registry/default/amount-input/amount-input"

import { Reveal } from "./reveal"
import { Section, SectionHeading } from "./section-heading"

type Mode = "without" | "with"

const USUAL = 24000
const TYPO = 240000
const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 })

const NOTES: Record<Mode, { tone: "bad" | "good"; text: string }[]> = {
  without: [
    { tone: "bad", text: "₹2,40,000 is a valid number, so validation passes." },
    { tone: "bad", text: "Nothing reads the amount back before money moves." },
    { tone: "bad", text: "The mistake shows up on the bank statement." },
  ],
  with: [
    { tone: "good", text: "The amount is read back in words, the way a cheque would." },
    { tone: "good", text: "Ten times the usual rent asks “Extra zero?”" },
    { tone: "good", text: "One tap fixes it before anything is sent." },
  ],
}

/** Section 4: the same transfer form, with and without the guard, one toggle apart. */
export function WithoutWith() {
  const reduce = useReducedMotion()
  const [mode, setMode] = React.useState<Mode>("with")
  const [amount, setAmount] = React.useState<number | null>(TYPO)
  const [plain, setPlain] = React.useState("2,40,000")
  const [confirmed, setConfirmed] = React.useState(false)
  const [sent, setSent] = React.useState<number | null>(null)

  const switchTo = (next: Mode) => {
    setMode(next)
    setAmount(TYPO)
    setPlain("2,40,000")
    setConfirmed(false)
    setSent(null)
  }

  const flagged = amount !== null && (amount / USUAL >= 10 || amount / USUAL <= 0.1)
  const canSend = mode === "without" || (amount !== null && amount > 0 && (!flagged || confirmed))
  const plainValue = Number(plain.replace(/[^\d]/g, "")) || 0
  const sendAmount = mode === "without" ? plainValue : amount ?? 0
  const fade = reduce ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } } : { initial: { opacity: 0, y: 8 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -6 } }

  return (
    <Section id="without-with" labelledBy="without-with-heading">
      <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-16">
        <Reveal>
          <SectionHeading id="without-with-heading" eyebrow="Without vs with" title="Same form. One guard rail.">
            Validation checks that a value is allowed. Bollard checks that it&apos;s what the person meant. Flip the switch and send the same ₹2,40,000.
          </SectionHeading>
          <ul className="mt-8 grid gap-3">
            <AnimatePresence mode="popLayout" initial={false}>
              {NOTES[mode].map((note, i) => (
                <motion.li
                  key={`${mode}-${i}`}
                  {...fade}
                  transition={{ duration: 0.25, delay: reduce ? 0 : i * 0.06 }}
                  className="flex items-start gap-2.5 text-sm leading-relaxed text-pretty"
                >
                  {note.tone === "good" ? (
                    <CircleCheck aria-hidden className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                  ) : (
                    <CircleX aria-hidden className="mt-0.5 size-4 shrink-0 text-destructive" />
                  )}
                  <span className={note.tone === "good" ? "text-foreground" : "text-muted-foreground"}>{note.text}</span>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        </Reveal>

        <Reveal delay={0.06} className="min-w-0">
          <div className="flex justify-center">
            <div role="group" aria-label="Compare the form" className="relative inline-flex rounded-full border bg-surface p-1">
              {(["without", "with"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  aria-pressed={mode === m}
                  onClick={() => switchTo(m)}
                  className={cn(
                    "relative h-8 rounded-full px-4 text-sm font-medium outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50",
                    mode === m ? "text-foreground" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {mode === m && (
                    <motion.span
                      layoutId={reduce ? undefined : "without-with-pill"}
                      aria-hidden
                      className="absolute inset-0 rounded-full border bg-background shadow-xs"
                      transition={{ type: "spring", stiffness: 500, damping: 38 }}
                    />
                  )}
                  <span className="relative">{m === "without" ? "Without Bollard" : "With Bollard"}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="ink-amber bg-dots mt-5 grid min-h-[23rem] place-items-center rounded-2xl border bg-surface p-4 sm:p-8">
            <div
              className={cn(
                "w-full max-w-sm rounded-xl border bg-card p-5 shadow-[0_24px_60px_-36px_rgb(0_0_0/0.45)] transition-[border-color] duration-300",
                mode === "with" && flagged && !confirmed ? "border-amber-500/50" : "",
              )}
            >
              <div className="flex items-center gap-2.5">
                <span aria-hidden className="grid size-8 place-items-center rounded-lg border bg-background text-muted-foreground">
                  <Landmark className="size-4" />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-medium tracking-tight">Send money</span>
                  <span className="block text-xs text-muted-foreground">To: Sunrise Apartments · usually {inr.format(USUAL)}</span>
                </span>
              </div>

              <div className="mt-4 min-h-[7.5rem]">
                <AnimatePresence mode="wait" initial={false}>
                  {mode === "without" ? (
                    <motion.div key="without" {...fade} transition={{ duration: 0.22 }} className="grid gap-1.5">
                      <label htmlFor="ww-plain" className="w-fit text-sm font-medium">
                        Amount (₹)
                      </label>
                      <input
                        id="ww-plain"
                        inputMode="numeric"
                        value={plain}
                        onChange={(e) => {
                          setPlain(e.target.value)
                          setSent(null)
                        }}
                        className="h-9 w-full rounded-md border bg-transparent px-3 text-base tabular-nums shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 md:text-sm dark:bg-input/30"
                      />
                      <p className="text-xs text-muted-foreground">Looks fine. Nothing to see here.</p>
                    </motion.div>
                  ) : (
                    <motion.div key="with" {...fade} transition={{ duration: 0.22 }}>
                      <AmountInput
                        label="Amount"
                        locale="en-IN"
                        currency="INR"
                        typical={USUAL}
                        value={amount}
                        onValueChange={(v) => {
                          setAmount(v)
                          setSent(null)
                        }}
                        className="max-w-none"
                      />
                      {flagged && (
                        <label className="mt-1 flex items-start gap-2 text-xs text-muted-foreground">
                          <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} className="mt-0.5 size-3.5 accent-[var(--brand)]" />
                          Yes, {amount !== null ? inr.format(amount) : "this amount"} is right.
                        </label>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <button
                type="button"
                disabled={!canSend}
                onClick={() => setSent(sendAmount)}
                className="mt-3 h-10 w-full rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground outline-none transition-opacity hover:bg-primary/90 focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-45"
              >
                {canSend ? `Send ${inr.format(sendAmount)}` : "Check the amount first"}
              </button>

              <div className="mt-3 min-h-[3.25rem]" aria-live="polite">
                <AnimatePresence initial={false}>
                  {sent !== null && (
                    <motion.p
                      key={`${mode}-${sent}`}
                      {...fade}
                      transition={{ duration: 0.22 }}
                      className={cn(
                        "rounded-md border p-2.5 text-xs leading-relaxed",
                        sent >= USUAL * 10
                          ? "border-destructive/30 bg-destructive/10 text-destructive"
                          : "border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300",
                      )}
                    >
                      {sent >= USUAL * 10
                        ? `Sent ${inr.format(sent)}: ${inr.format(sent - USUAL)} more than this month's rent. (A fictional outcome.)`
                        : `Sent ${inr.format(sent)}. Exactly what was meant.`}
                    </motion.p>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </Section>
  )
}
