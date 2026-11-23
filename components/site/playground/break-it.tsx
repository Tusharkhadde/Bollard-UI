"use client"

import * as React from "react"
import Link from "next/link"
import { ArrowUpRight, Check, CircleCheck, Sparkles, Trash2, Wand2 } from "lucide-react"
import { AnimatePresence, motion, useAnimate, useReducedMotion } from "motion/react"

import { InstallPill } from "@/components/site/landing/install-pill"
import { trackMistakeCaught, trackPlaygroundTab } from "@/lib/analytics"
import { cn } from "@/lib/utils"
import { AmountInput } from "@/registry/default/amount-input/amount-input"
import { EmailInput, findEmailProblem, suggestEmailDomain } from "@/registry/default/email-input/email-input"
import { PasswordInput, edgeSpaces, foreignScript } from "@/registry/default/password-input/password-input"
import { PhoneInput, normalizePhone } from "@/registry/default/phone-input/phone-input"
import { TypeToConfirm, matchedLength } from "@/registry/default/type-to-confirm/type-to-confirm"

/*
 * "Try to break it": five real registry components, each with one mistake to make.
 * Whether a mistake was caught is decided with the components' own exported helpers
 * (suggestEmailDomain, normalizePhone, matchedLength…), so this file adds no
 * validation logic of its own. Progress lives in localStorage; nothing typed is stored
 * or sent anywhere.
 */

export type BreakItId = "amount-input" | "email-input" | "password-input" | "phone-input" | "type-to-confirm"

type Tab = { id: BreakItId; title: string; mistake: string; hint: string }

export const BREAK_IT_TABS: Tab[] = [
  { id: "amount-input", title: "Amount", mistake: "The extra zero", hint: "Rent is usually ₹24,000. Type 2,40,000, one zero too many." },
  { id: "email-input", title: "Email", mistake: "The mistyped domain", hint: "Type an address like alex@gmial.con and pause." },
  { id: "password-input", title: "Password", mistake: "Caps Lock left on", hint: "Turn Caps Lock on and type, or end the password with a space." },
  { id: "phone-input", title: "Phone", mistake: "The doubled +91", hint: "Type +91 +91 98765 43210, or a number with a leading 0." },
  { id: "type-to-confirm", title: "Delete", mistake: "Deleting on autopilot", hint: "Open the dialog and type the project name wrong. Delete stays locked." },
]

const STORAGE_KEY = "bollard:home-playground:caught"
const TYPICAL_RENT = 24000
const PROJECT = "acme/production"

/** Waits until a value has stopped changing, like the components themselves do before warning. */
function useSettled<T>(value: T, ms: number) {
  const [settled, setSettled] = React.useState(value)
  React.useEffect(() => {
    const timer = window.setTimeout(() => setSettled(value), ms)
    return () => window.clearTimeout(timer)
  }, [value, ms])
  return settled
}

function readCaught(): BreakItId[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]")
    return Array.isArray(parsed) ? parsed.filter((id): id is BreakItId => BREAK_IT_TABS.some((t) => t.id === id)) : []
  } catch {
    return []
  }
}

export function BreakIt({ className }: { className?: string }) {
  const reduce = useReducedMotion()
  const [active, setActive] = React.useState(0)
  const [caught, setCaught] = React.useState<BreakItId[]>([])
  const [badgeScope, animateBadge] = useAnimate<HTMLDivElement>()
  const tabRefs = React.useRef<(HTMLButtonElement | null)[]>([])

  React.useEffect(() => setCaught(readCaught()), [])

  const markCaught = React.useCallback((id: BreakItId) => {
    setCaught((current) => {
      if (current.includes(id)) return current
      const next = [...current, id]
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      } catch {}
      trackMistakeCaught({ component: id, surface: "home-playground" })
      return next
    })
  }, [])

  const total = BREAK_IT_TABS.length
  const all = caught.length === total

  // A small pulse when the last mistake is caught.
  const wasAll = React.useRef(false)
  React.useEffect(() => {
    if (all && !wasAll.current && !reduce && badgeScope.current) {
      animateBadge(badgeScope.current, { scale: [1, 1.12, 0.98, 1] }, { duration: 0.6, ease: "easeOut" })
    }
    wasAll.current = all
  }, [all, reduce, animateBadge, badgeScope])

  const select = (index: number) => {
    setActive(index)
    trackPlaygroundTab({ component: BREAK_IT_TABS[index].id })
  }

  const onTabKey = (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    const keys: Record<string, number> = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }
    let next = index
    if (event.key in keys) next = (index + keys[event.key] + total) % total
    else if (event.key === "Home") next = 0
    else if (event.key === "End") next = total - 1
    else return
    event.preventDefault()
    tabRefs.current[next]?.focus()
    select(next)
  }

  const tab = BREAK_IT_TABS[active]

  return (
    <div className={cn("grid gap-4", className)}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div
          ref={badgeScope}
          className={cn(
            "inline-flex h-8 items-center gap-2 rounded-full border px-3 text-sm font-medium tabular-nums transition-colors",
            all ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" : "bg-background",
          )}
        >
          {all ? <Sparkles aria-hidden className="size-3.5" /> : <span aria-hidden className="size-2 rounded-full bg-brand" />}
          <span>
            {caught.length} of {total} mistakes caught
          </span>
          <span aria-hidden className="ml-1 hidden gap-1 sm:flex">
            {BREAK_IT_TABS.map((t) => (
              <span key={t.id} className={cn("size-1.5 rounded-full transition-colors", caught.includes(t.id) ? "bg-emerald-500" : "bg-foreground/15")} />
            ))}
          </span>
        </div>
        <span className="sr-only" aria-live="polite">
          {caught.length ? `${caught.length} of ${total} mistakes caught.${all ? " All caught." : ""}` : ""}
        </span>
        <Link href="/playground" className="group inline-flex items-center gap-1 rounded-sm text-sm font-medium text-muted-foreground outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50">
          Open the full playground <ArrowUpRight aria-hidden className="size-3.5 transition-transform group-hover:-translate-y-px group-hover:translate-x-px motion-reduce:transition-none" />
        </Link>
      </div>

      <div className="grid min-w-0 gap-3 lg:grid-cols-[15rem_minmax(0,1fr)]">
        <div
          role="tablist"
          aria-label="Components to break"
          aria-orientation="vertical"
          className="-mx-4 flex snap-x scroll-px-4 gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:px-0 lg:flex-col lg:overflow-visible lg:pb-0"
        >
          {BREAK_IT_TABS.map((t, i) => {
            const selected = i === active
            const done = caught.includes(t.id)
            return (
              <button
                key={t.id}
                ref={(node) => {
                  tabRefs.current[i] = node
                }}
                type="button"
                role="tab"
                id={`break-tab-${t.id}`}
                aria-selected={selected}
                aria-controls={`break-panel-${t.id}`}
                tabIndex={selected ? 0 : -1}
                onClick={() => select(i)}
                onKeyDown={(e) => onTabKey(e, i)}
                className={cn(
                  "relative flex min-w-[9.5rem] shrink-0 snap-start items-center gap-3 rounded-xl border px-3 py-2.5 text-left outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 lg:min-w-0",
                  selected ? "border-border-strong bg-card shadow-xs" : "border-transparent bg-transparent hover:bg-surface",
                )}
              >
                {selected && (
                  <motion.span
                    layoutId={reduce ? undefined : "break-tab-marker"}
                    aria-hidden
                    className="absolute top-2.5 bottom-2.5 left-0 hidden w-0.5 rounded-full bg-brand lg:block"
                    transition={{ type: "spring", stiffness: 500, damping: 40 }}
                  />
                )}
                <span
                  aria-hidden
                  className={cn(
                    "grid size-6 shrink-0 place-items-center rounded-full border font-mono text-[11px] transition-colors",
                    done ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "text-muted-foreground",
                  )}
                >
                  {done ? <Check className="size-3.5" /> : i + 1}
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-medium tracking-tight">{t.title}</span>
                  <span className="block truncate text-xs text-muted-foreground">{t.mistake}</span>
                </span>
                {done && <span className="sr-only">(caught)</span>}
              </button>
            )
          })}
        </div>

        <div
          role="tabpanel"
          id={`break-panel-${tab.id}`}
          aria-labelledby={`break-tab-${tab.id}`}
          className="min-w-0 overflow-hidden rounded-2xl border bg-card shadow-[0_24px_60px_-40px_rgb(0_0_0/0.4)]"
        >
          <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3 sm:px-5">
            <div className="flex min-w-0 items-center gap-2">
              <code className="truncate font-mono text-[13px] font-medium">{tab.id}</code>
              <AnimatePresence initial={false}>
                {caught.includes(tab.id) && (
                  <motion.span
                    initial={reduce ? false : { opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-400"
                  >
                    <CircleCheck aria-hidden className="size-3" /> Caught
                  </motion.span>
                )}
              </AnimatePresence>
            </div>
            <Link
              href={`/components/${tab.id}`}
              className="inline-flex items-center gap-1 rounded-sm text-xs font-medium text-muted-foreground outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
            >
              Docs <ArrowUpRight aria-hidden className="size-3" />
            </Link>
          </div>
          <div className="ink-amber bg-dots grid min-h-[17rem] place-items-center bg-surface px-4 py-8 sm:px-8">
            <div className="w-full max-w-sm">
              <Stage key={tab.id} id={tab.id} onCaught={markCaught} />
            </div>
          </div>
          <div className="flex flex-col gap-3 border-t px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
            <p className="text-sm text-pretty text-muted-foreground">
              <span className="font-medium text-foreground">Try: </span>
              {tab.hint}
            </p>
            <InstallPill name={tab.id} surface="home-playground" size="sm" className="shrink-0 self-start sm:self-auto" />
          </div>
        </div>
      </div>
    </div>
  )
}

const showMe =
  "inline-flex h-7 items-center gap-1.5 rounded-md border bg-background px-2.5 text-xs font-medium text-muted-foreground outline-none transition-colors hover:border-border-strong hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"

function ShowMe({ onClick, children = "Make the mistake for me" }: { onClick: () => void; children?: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} className={cn(showMe, "mt-3")}>
      <Wand2 aria-hidden className="size-3.5" /> {children}
    </button>
  )
}

function Stage({ id, onCaught }: { id: BreakItId; onCaught: (id: BreakItId) => void }) {
  switch (id) {
    case "amount-input":
      return <AmountStage onCaught={() => onCaught(id)} />
    case "email-input":
      return <EmailStage onCaught={() => onCaught(id)} />
    case "password-input":
      return <PasswordStage onCaught={() => onCaught(id)} />
    case "phone-input":
      return <PhoneStage onCaught={() => onCaught(id)} />
    case "type-to-confirm":
      return <ConfirmStage onCaught={() => onCaught(id)} />
  }
}

function AmountStage({ onCaught }: { onCaught: () => void }) {
  const [amount, setAmount] = React.useState<number | null>(null)
  React.useEffect(() => {
    if (amount && (amount / TYPICAL_RENT >= 10 || amount / TYPICAL_RENT <= 0.1) && amount >= 100) onCaught()
  }, [amount, onCaught])
  return (
    <div>
      <AmountInput label="Monthly rent" locale="en-IN" currency="INR" typical={TYPICAL_RENT} value={amount} onValueChange={setAmount} className="max-w-none" />
      <ShowMe onClick={() => setAmount(240000)} />
    </div>
  )
}

function EmailStage({ onCaught }: { onCaught: () => void }) {
  const [email, setEmail] = React.useState("")
  const settled = useSettled(email, 700)
  React.useEffect(() => {
    if (settled.includes("@") && (findEmailProblem(settled) || suggestEmailDomain(settled))) onCaught()
  }, [settled, onCaught])
  return (
    <div>
      <EmailInput label="Work email" value={email} onValueChange={setEmail} className="max-w-none" />
      <ShowMe onClick={() => setEmail("alex@gmial.con")} />
    </div>
  )
}

function PasswordStage({ onCaught }: { onCaught: () => void }) {
  const [password, setPassword] = React.useState("")
  const settled = useSettled(password, 500)
  React.useEffect(() => {
    if (settled && (edgeSpaces(settled) || foreignScript(settled))) onCaught()
  }, [settled, onCaught])
  const checkCaps = (event: React.KeyboardEvent) => {
    if (event.getModifierState?.("CapsLock")) onCaught()
  }
  return (
    <div onKeyDownCapture={checkCaps} onKeyUpCapture={checkCaps}>
      <PasswordInput label="Password" value={password} onValueChange={setPassword} className="max-w-none" />
      <ShowMe onClick={() => setPassword("hunter2 ")}>Paste one with a trailing space</ShowMe>
    </div>
  )
}

function PhoneStage({ onCaught }: { onCaught: () => void }) {
  const [phone, setPhone] = React.useState("")
  const settled = useSettled(phone, 600)
  React.useEffect(() => {
    if (!settled.replace(/\D/g, "")) return
    const result = normalizePhone(settled, "IN")
    if (result.notes.length || result.unknownCode) onCaught()
  }, [settled, onCaught])
  return (
    <div>
      <PhoneInput
        label="Mobile number"
        value={phone}
        onValueChange={setPhone}
        defaultCountry="IN"
        preferredCountries={["IN", "US", "GB", "AE", "SG"]}
        className="max-w-none"
      />
      <ShowMe onClick={() => setPhone("+91 +91 98765 43210")} />
    </div>
  )
}

function ConfirmStage({ onCaught }: { onCaught: () => void }) {
  const [open, setOpen] = React.useState(false)
  const [deleted, setDeleted] = React.useState(false)
  const onInput = (event: React.FormEvent<HTMLDivElement>) => {
    const target = event.target
    if (!(target instanceof HTMLInputElement)) return
    const typed = target.value
    if (typed && matchedLength(typed, PROJECT) < typed.length) onCaught()
  }
  return (
    <div onInputCapture={onInput} className="grid gap-3">
      <div className="rounded-xl border border-destructive/30 bg-card p-4">
        <p className="text-sm font-medium">Delete this project</p>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          Removes <code className="font-mono text-foreground">{PROJECT}</code>, its deployments and its data. This can&apos;t be undone.
        </p>
        <button
          type="button"
          onClick={() => {
            setDeleted(false)
            setOpen(true)
          }}
          className="mt-3 inline-flex h-8 items-center gap-1.5 rounded-md bg-destructive px-3 text-xs font-medium text-white outline-none hover:bg-destructive/90 focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          <Trash2 aria-hidden className="size-3.5" /> Delete project…
        </button>
      </div>
      {deleted && (
        <p className="text-xs text-muted-foreground">Confirmed with the exact name. (Nothing was deleted: this is a demo.)</p>
      )}
      <TypeToConfirm
        open={open}
        onOpenChange={setOpen}
        phrase={PROJECT}
        title="Delete project?"
        description="This permanently removes the project and everything in it."
        confirmLabel="Delete project"
        onConfirm={() => {
          setDeleted(true)
          setOpen(false)
        }}
      />
    </div>
  )
}
