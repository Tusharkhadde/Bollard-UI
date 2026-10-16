"use client"

import * as React from "react"
import { ArrowRightLeft, CircleCheck, Clock, Crown, LoaderCircle, TriangleAlert, X } from "lucide-react"

import { cn } from "@/lib/utils"

export interface OrgMember {
  name: string
  email: string
  /** Their current plan, when known. */
  plan?: string
}

export interface TransferRequest {
  email: string
  name?: string
  sentAt: Date | number | string
  expiresAt: Date | number | string
  status: "pending" | "accepted" | "declined"
}

export interface RecipientOptions {
  orgDomain?: string
  members?: OrgMember[]
  requiredPlan?: string
  /** Plans from lowest to highest, used to compare against `requiredPlan`. */
  plans?: string[]
}

const squash = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "")

/** Who the email is, whether it's outside the org, whether their plan is too low, and a same-person member to switch to. */
export function checkRecipient(email: string, { orgDomain, members = [], requiredPlan, plans = ["Free", "Pro", "Team", "Enterprise"] }: RecipientOptions) {
  const value = email.trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return null
  const [local, domain] = value.split("@")
  const member = members.find((m) => m.email.toLowerCase() === value)
  const external = !!orgDomain && domain !== orgDomain.toLowerCase()
  const suggestion = external
    ? members.find((m) => squash(m.name) === squash(local) || squash(m.email.split("@")[0]) === squash(local))
    : undefined
  const planTooLow = !!(member?.plan && requiredPlan && plans.indexOf(member.plan) < plans.indexOf(requiredPlan))
  return { email: value, domain, member, external, suggestion, planTooLow }
}

const button =
  "inline-flex h-9 items-center justify-center gap-2 rounded-md px-4 text-sm font-medium whitespace-nowrap shadow-xs outline-none transition-[color,background-color,box-shadow] focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 aria-busy:cursor-progress"
const outline = "border bg-background hover:bg-accent dark:border-input dark:bg-input/30 dark:hover:bg-input/50"
const field =
  "h-9 w-full min-w-0 rounded-md border bg-transparent px-3 text-base shadow-xs outline-none transition-[color,box-shadow] placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-destructive md:text-sm dark:bg-input/30 data-warning:border-amber-500 dark:data-warning:border-amber-400"
const fix =
  "inline-flex h-6 items-center gap-1 rounded-md border border-amber-500/40 px-2 font-medium text-amber-900 outline-none transition-colors hover:bg-amber-500/10 focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:text-amber-200"
const daysLeft = (until: Date | number | string, now: number) => Math.max(0, Math.ceil((new Date(until).getTime() - now) / 86_400_000))

export interface TransferOwnershipProps extends Omit<React.ComponentProps<"section">, "title" | "defaultValue">, RecipientOptions {
  /** What is being handed over, e.g. "Acme workspace". */
  resource: string
  /** What moves to the new owner. */
  moves: string[]
  /** What stays with you, e.g. "Admin access", "Your personal drafts". */
  keeps: string[]
  /** Controlled request. `null` means no transfer has been sent. */
  request?: TransferRequest | null
  /** Starting pending request when uncontrolled. */
  defaultRequest?: TransferRequest | null
  /** Called when a request is sent or withdrawn. */
  onRequestChange?: (request: TransferRequest | null) => void
  /** Sends the request. Return a promise to show a pending state; a rejection keeps the form. */
  onSend: (recipient: { email: string; name?: string }) => void | Promise<void>
  /** Controlled recipient email. */
  value?: string
  /** Starting recipient email when uncontrolled. */
  defaultValue?: string
  /** Called with the recipient email. */
  onValueChange?: (email: string) => void
  /** Withdraws a pending request. */
  onWithdraw?: () => void | Promise<void>
  /** How long the recipient has to accept. */
  expiresInDays?: number
  /** Heading, given the resource name. */
  title?: (resource: string) => React.ReactNode
  /** Label of the recipient email input. */
  label?: string
  /** Label of the send-request button. */
  sendLabel?: string
  /** Warning for an email outside the organisation. */
  externalText?: (domain: string) => string
  /** Checkbox text to confirm an outside recipient. */
  externalAck?: (domain: string) => string
  /** Warning when the recipient's plan is too low. */
  planText?: (name: string, plan: string, required: string) => string
  /** Status line once a request exists. `who` is their name or email. */
  statusText?: (status: TransferStatus, who: string, resource: string, daysLeft: number) => string
  /** Line under the readback before sending. */
  noteText?: (expiresInDays: number) => string
  /** Label of the withdraw button. */
  withdrawLabel?: string
  /** Label of the choose-someone-else button. */
  chooseAgainLabel?: string
}

export type TransferStatus = TransferRequest["status"] | "expired"

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`

/**
 * An ownership handover that can't land on the wrong person or end in limbo.
 * It reads back what moves and what you keep, warns when the email is outside
 * the org (with a one-tap switch to the colleague it probably meant), blocks a
 * recipient whose plan can't own the resource, and never transfers on send:
 * the recipient must accept, and until then it shows a pending state with the
 * expiry, while you stay the owner.
 */
export function TransferOwnership({
  resource,
  moves,
  keeps,
  orgDomain,
  members,
  requiredPlan,
  plans,
  request,
  defaultRequest = null,
  onRequestChange,
  onSend,
  onWithdraw,
  expiresInDays = 7,
  title = (r) => `Transfer ownership of ${r}`,
  label = "New owner's email",
  sendLabel = "Send transfer request",
  externalText = (d) => `${d} is outside your organization. They'd own this, and you couldn't take it back.`,
  externalAck = (d) => `I mean to hand this to someone at ${d}`,
  planText = (n, p, r) => `${n} is on ${p}. Owning this needs ${r}, so they couldn't accept.`,
  statusText = (status, who, r, days) =>
    status === "accepted" ? `${who} accepted and now owns ${r}.` :
    status === "declined" ? `${who} declined. You're still the owner.` :
    status === "expired" ? `The request to ${who} expired. You're still the owner.` :
    `Waiting for ${who} to accept, ${plural(days, "day")} left. You stay the owner until then.`,
  noteText = (days) => `Nothing moves until they accept. They have ${plural(days, "day")}, and you can withdraw the request until then.`,
  withdrawLabel = "Withdraw request",
  chooseAgainLabel = "Choose someone else",
  value,
  defaultValue = "",
  onValueChange,
  className,
  ...props
}: TransferOwnershipProps) {
  const [inner, setInner] = React.useState(defaultRequest)
  const [innerEmail, setInnerEmail] = React.useState(defaultValue)
  const email = value ?? innerEmail
  const setEmail = (next: string) => {
    if (value === undefined) setInnerEmail(next)
    onValueChange?.(next)
    setAck(false)
  }
  const [ack, setAck] = React.useState(false)
  const [pending, setPending] = React.useState(false)
  const [now, setNow] = React.useState(0)
  const baseId = React.useId()
  const current = request === undefined ? inner : request
  const check = checkRecipient(email, { orgDomain, members, requiredPlan, plans })
  const who = check?.member?.name ?? check?.email
  const blocked = !check || check.planTooLow || (check.external && !ack)

  React.useEffect(() => setNow(Date.now()), [current])

  const setRequest = (next: TransferRequest | null) => {
    if (request === undefined) setInner(next)
    onRequestChange?.(next)
  }
  const run = async (task: () => void | Promise<void>, after: () => void) => {
    if (pending) return
    setPending(true)
    try {
      await task()
      after()
    } catch {
      // The caller reports the error; the current state stays.
    } finally {
      setPending(false)
    }
  }
  const send = (event: React.FormEvent) => {
    event.preventDefault()
    if (blocked || !check) return
    const recipient = { email: check.email, name: check.member?.name }
    void run(
      () => onSend(recipient),
      () => {
        const sentAt = Date.now()
        setRequest({ ...recipient, sentAt, expiresAt: sentAt + expiresInDays * 86_400_000, status: "pending" })
      },
    )
  }

  const readback = (
    <div className="grid gap-3 text-sm sm:grid-cols-2">
      {[
        { heading: `Moves to ${current?.name ?? who ?? "the new owner"}`, items: moves },
        { heading: "You keep", items: keeps },
      ].map((group) => (
        <div key={group.heading} className="min-w-0">
          <p className="mb-1 truncate text-xs font-medium text-muted-foreground">{group.heading}</p>
          <ul className="list-disc space-y-0.5 pl-5">{group.items.map((item) => <li key={item}>{item}</li>)}</ul>
        </div>
      ))}
    </div>
  )

  const expired = current?.status === "pending" && now > 0 && new Date(current.expiresAt).getTime() <= now
  return (
    <section
      data-slot="transfer-ownership"
      data-state={current ? (expired ? "expired" : current.status) : "draft"}
      aria-labelledby={`${baseId}-title`}
      className={cn("w-full max-w-md space-y-4 rounded-xl border bg-card p-4 text-card-foreground sm:p-5", className)}
      {...props}
    >
      <h3 id={`${baseId}-title`} className="flex items-center gap-2 font-medium">
        <Crown aria-hidden className="size-4 shrink-0 text-muted-foreground" /> {title(resource)}
      </h3>

      {current ? (
        <>
          <div
            aria-live="polite"
            className={cn(
              "flex gap-3 rounded-md p-3 text-sm",
              current.status === "accepted"
                ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                : current.status === "declined" || expired
                  ? "bg-muted text-foreground"
                  : "bg-amber-50 text-amber-900 dark:bg-amber-950/50 dark:text-amber-200",
            )}
          >
            {current.status === "accepted" ? (
              <CircleCheck aria-hidden className="mt-0.5 size-4 shrink-0" />
            ) : current.status === "declined" || expired ? (
              <X aria-hidden className="mt-0.5 size-4 shrink-0" />
            ) : (
              <Clock aria-hidden className="mt-0.5 size-4 shrink-0 motion-safe:animate-pulse" />
            )}
            <p className="min-w-0">
              {statusText(expired ? "expired" : current.status, current.name ?? current.email, resource, now ? daysLeft(current.expiresAt, now) : expiresInDays)}
            </p>
          </div>
          {readback}
          {current.status === "pending" && !expired ? (
            onWithdraw && (
              <div className="flex justify-end">
                <button type="button" aria-busy={pending || undefined} onClick={() => void run(onWithdraw, () => setRequest(null))} className={cn(button, outline)}>
                  {pending && <LoaderCircle aria-hidden className="size-4 animate-spin" />} {withdrawLabel}
                </button>
              </div>
            )
          ) : (
            current.status !== "accepted" && (
              <div className="flex justify-end">
                <button type="button" onClick={() => setRequest(null)} className={cn(button, outline)}>
                  {chooseAgainLabel}
                </button>
              </div>
            )
          )}
        </>
      ) : (
        <form onSubmit={send} className="space-y-4">
          <div>
            <label htmlFor={`${baseId}-email`} className="mb-1.5 block text-sm font-medium">
              {label}
            </label>
            <input
              id={`${baseId}-email`}
              type="email"
              autoComplete="off"
              spellCheck={false}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              aria-describedby={`${baseId}-hint`}
              aria-invalid={check?.planTooLow || undefined}
              data-warning={check?.external ? "" : undefined}
              className={field}
            />
            <div id={`${baseId}-hint`} aria-live="polite" className="min-h-6 text-xs">
              {check?.planTooLow && check.member?.plan && requiredPlan ? (
                <p role="alert" className="mt-1.5 flex gap-1.5 text-destructive">
                  <TriangleAlert aria-hidden className="mt-px size-3.5 shrink-0" /> {planText(check.member.name, check.member.plan, requiredPlan)}
                </p>
              ) : check?.external ? (
                <div className="mt-1.5 space-y-1.5 text-amber-700 dark:text-amber-400">
                  <p className="flex gap-1.5">
                    <span className="flex h-6 shrink-0 items-center">
                      <TriangleAlert aria-hidden className="size-3.5" />
                    </span>
                    <span className="flex min-w-0 flex-wrap items-center gap-x-2">
                      <span className="py-1">{externalText(check.domain)}</span>
                      {check.suggestion && (
                        <button type="button" onClick={() => setEmail(check.suggestion!.email)} className={fix}>
                          Use {check.suggestion.email}
                        </button>
                      )}
                    </span>
                  </p>
                  <label className="flex items-center gap-2 text-foreground">
                    <input type="checkbox" checked={ack} onChange={(event) => setAck(event.target.checked)} className="size-3.5 accent-amber-600" />
                    {externalAck(check.domain)}
                  </label>
                </div>
              ) : check?.member ? (
                <p className="mt-1.5 text-muted-foreground">
                  {check.member.name}
                  {check.member.plan ? ` · ${check.member.plan} plan` : ""}
                </p>
              ) : null}
            </div>
          </div>
          {readback}
          <p className="text-xs text-muted-foreground">
            {noteText(expiresInDays)}
          </p>
          <div className="flex justify-end">
            <button type="submit" disabled={blocked} aria-busy={pending || undefined} className={cn(button, "bg-primary text-primary-foreground hover:bg-primary/90")}>
              {pending ? <LoaderCircle aria-hidden className="size-4 animate-spin" /> : <ArrowRightLeft aria-hidden className="size-4" />}
              {sendLabel}
            </button>
          </div>
        </form>
      )}
    </section>
  )
}
