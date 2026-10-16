"use client"

import * as React from "react"
import { CircleCheck, EyeOff, Globe, Reply, Undo2, Users } from "lucide-react"

import { cn } from "@/lib/utils"
import { domainOf, isInternal, parseAddressList, planReplyAll, type Mailbox, type ReplyAllOptions, type ReplySource } from "./reply"

export { addressKey, domainOf, isInternal, parseAddressList, planReplyAll, type AddressInput, type Mailbox, type ReplyAllOptions, type ReplyAllPlan, type ReplySource } from "./reply"

/** Every visible string. `{…}` placeholders are filled in. */
export const REPLY_ALL_MESSAGES = {
  label: "Reply all check",
  quiet: "Reply all goes to {count} people.",
  quietOne: "Reply all goes to 1 person.",
  bccTitle: "You're not on the recipient list",
  bccBody: "You were BCC'd or this was forwarded to you. Replying to all shows {count} people that you got it.",
  bccBodyOne: "You were BCC'd or this was forwarded to you. Replying to all shows 1 person that you got it.",
  undisclosedBody: "This went to undisclosed recipients, so only the sender will get your reply.",
  largeTitle: "Reply all reaches {count} people",
  lists: "Includes {lists}.",
  listSize: "{name} ({count} members)",
  externalTitle: "{count} outside {org}",
  externalTitleOne: "1 person outside {org}",
  yourOrg: "your organisation",
  replyToElsewhere: "Replies go to {replyTo}, not to {from}.",
  senderOnly: "Reply to {name} only",
  internalOnly: "Leave out people outside {org}",
  replyAllAnyway: "Reply all anyway",
  chosenSender: "Replying to {name} only.",
  chosenInternal: "Replying to {count} people at {org}.",
  chosenAll: "Replying to all {count} people.",
  undo: "Undo",
  change: "Change",
  recipients: "To {to} · Cc {cc}",
  recipientsNoCc: "To {to}",
  others: "{count} people",
}

export type ReplyAllMessages = typeof REPLY_ALL_MESSAGES
export type ReplyAllMode = "all" | "sender" | "internal"

const fill = (template: string, values: Record<string, string | number>) => template.replace(/\{(\w+)\}/g, (m, k: string) => String(values[k] ?? m))
const label = (m: Mailbox) => m.name || m.email
const fixClass = "inline-flex min-h-6 items-center gap-1 rounded-md border border-amber-500/40 px-2 py-0.5 text-left font-medium text-amber-900 transition-colors hover:bg-amber-500/10 dark:text-amber-200 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
const ghostClass = "inline-flex min-h-6 items-center rounded-md px-2 font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"

export interface ReplyAllGuardProps extends Omit<React.ComponentProps<"section">, "defaultValue" | "onChange">, ReplyAllOptions {
  /** The message being replied to: From, Reply-To, To and Cc as header strings or mailboxes. */
  message: ReplySource
  /** Controlled mode. */
  value?: ReplyAllMode
  /** Initial mode when uncontrolled. */
  defaultValue?: ReplyAllMode
  /** Called with the mode and the recipients it gives. */
  onValueChange?: (mode: ReplyAllMode, recipients: { to: Mailbox[]; cc: Mailbox[] }) => void
  /** Reach at which a reply all is called large. */
  largeAt?: number
  /** Where focus goes after a choice, usually the reply body. Defaults to the next button here. */
  returnFocusRef?: React.RefObject<HTMLElement | null>
  /** Any visible string. */
  messages?: Partial<ReplyAllMessages>
}

/**
 * Stops the reply all nobody wanted: before it goes, it says how many people it really reaches
 * (lists expanded), names the people outside your organisation, notices when you were only BCC'd
 * and would reveal yourself, and when Reply-To points somewhere else. One tap replies to the sender
 * only or leaves out external people, with Undo.
 */
export function ReplyAllGuard({ message, me, orgDomains, listSizes, myLists, value, defaultValue = "all", onValueChange, largeAt = 20, returnFocusRef, messages, className, ...props }: ReplyAllGuardProps) {
  const t = { ...REPLY_ALL_MESSAGES, ...messages }
  const [inner, setInner] = React.useState<ReplyAllMode>(defaultValue)
  const [confirmed, setConfirmed] = React.useState(false)
  const [announcement, setAnnouncement] = React.useState("")
  const mode = value ?? inner
  const rootRef = React.useRef<HTMLElement>(null)
  const plan = planReplyAll(message, { me, orgDomains, listSizes, myLists })
  // A new message (same component reused in a reading pane) starts fresh, not on the last choice.
  const signature = [...plan.sender, ...plan.to, ...plan.cc].map((m) => m.email.toLowerCase()).join(",")
  const [seen, setSeen] = React.useState(signature)
  if (seen !== signature) {
    setSeen(signature)
    setInner(defaultValue)
    setConfirmed(false)
    setAnnouncement("")
  }
  const org = orgDomains?.[0]?.replace(/^@/, "") ?? t.yourOrg
  const senderName = plan.sender[0] ? label(plan.sender[0]) : ""
  const internal = { to: plan.to.filter((m) => isInternal(m.email, orgDomains)), cc: plan.cc.filter((m) => isInternal(m.email, orgDomains)) }
  const internalCount = internal.to.length + internal.cc.length
  const sizeOf = (m: Mailbox) => plan.lists.find((l) => l.mailbox.email === m.email)?.size ?? 1
  const internalReach = [...internal.to, ...internal.cc].reduce((sum, m) => sum + sizeOf(m), 0)

  const large = plan.reach >= largeAt
  const risky = plan.bcc || large || plan.external.length > 0 || plan.replyToElsewhere
  const canInternal = plan.external.length > 0 && internalCount > 0 && !plan.bcc

  React.useEffect(() => {
    if (!announcement) return
    const id = setTimeout(() => setAnnouncement(""), 4000)
    return () => clearTimeout(id)
  }, [announcement])

  const recipientsFor = (m: ReplyAllMode) => (m === "sender" ? { to: plan.sender, cc: [] } : m === "internal" ? internal : { to: plan.to, cc: plan.cc })

  const choose = (next: ReplyAllMode, text: string) => {
    if (value === undefined) setInner(next)
    onValueChange?.(next, recipientsFor(next))
    setConfirmed(next === "all")
    setAnnouncement(text)
    requestAnimationFrame(() => (returnFocusRef?.current ?? rootRef.current?.querySelector<HTMLElement>("[data-undo]") ?? rootRef.current)?.focus())
  }

  const undo = () => {
    if (value === undefined) setInner("all")
    onValueChange?.("all", recipientsFor("all"))
    setConfirmed(false)
    requestAnimationFrame(() => rootRef.current?.querySelector<HTMLElement>("[data-fix]")?.focus())
  }

  const byDomain = Object.entries(
    plan.external.reduce<Record<string, Mailbox[]>>((acc, m) => {
      ;(acc[domainOf(m.email)] ??= []).push(m)
      return acc
    }, {}),
  )
  const current = recipientsFor(mode)
  const preview = current.cc.length
    ? fill(t.recipients, { to: current.to.length === 1 ? label(current.to[0]) : fill(t.others, { count: current.to.length }), cc: current.cc.length === 1 ? label(current.cc[0]) : fill(t.others, { count: current.cc.length }) })
    : fill(t.recipientsNoCc, { to: current.to.length === 1 ? label(current.to[0]) : fill(t.others, { count: current.to.length }) })
  const chosenText = mode === "sender" ? fill(t.chosenSender, { name: senderName }) : mode === "internal" ? fill(t.chosenInternal, { count: internalReach.toLocaleString(), org }) : fill(t.chosenAll, { count: plan.reach.toLocaleString() })
  const settled = mode !== "all" || confirmed

  return (
    <section ref={rootRef} tabIndex={-1} data-slot="reply-all-guard" data-state={!risky ? "ok" : settled ? "settled" : "warning"} aria-label={t.label} className={cn("grid w-full max-w-md min-w-0 gap-2.5 rounded-xl border bg-card p-3 text-sm text-card-foreground shadow-xs outline-none", risky && !settled && (plan.bcc ? "border-red-500/50" : "border-amber-500/50"), className)} {...props}>
      <span aria-live="polite" className="sr-only">{announcement}</span>
      {!risky ? (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Users aria-hidden className="size-3.5 shrink-0" />
          {plan.reach === 1 ? t.quietOne : fill(t.quiet, { count: plan.reach.toLocaleString() })}
        </p>
      ) : settled ? (
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-emerald-700 dark:text-emerald-400">
          <CircleCheck aria-hidden className="size-3.5 shrink-0" />
          <span className="min-w-0 break-words">{chosenText}</span>
          <button type="button" data-undo onClick={undo} className={ghostClass}>
            {mode === "all" ? t.change : <><Undo2 aria-hidden className="mr-1 size-3.5" />{t.undo}</>}
          </button>
        </p>
      ) : (
        <>
          {plan.bcc && (
            <div className="flex gap-2 text-red-700 dark:text-red-400">
              <EyeOff aria-hidden className="mt-0.5 size-4 shrink-0" />
              <div className="grid min-w-0 gap-0.5">
                <p className="font-medium">{t.bccTitle}</p>
                <p className="text-xs break-words">{plan.undisclosed ? t.undisclosedBody : plan.reach === 1 ? t.bccBodyOne : fill(t.bccBody, { count: plan.reach.toLocaleString() })}</p>
              </div>
            </div>
          )}
          {large && !plan.undisclosed && (
            <div className="flex gap-2 text-amber-700 dark:text-amber-400">
              <Users aria-hidden className="mt-0.5 size-4 shrink-0" />
              <div className="grid min-w-0 gap-0.5">
                <p className="font-medium tabular-nums">{fill(t.largeTitle, { count: plan.reach.toLocaleString() })}</p>
                {plan.lists.length > 0 && (
                  <p className="text-xs break-words">{fill(t.lists, { lists: plan.lists.map((l) => fill(t.listSize, { name: l.mailbox.email, count: l.size.toLocaleString() })).join(", ") })}</p>
                )}
              </div>
            </div>
          )}
          {plan.external.length > 0 && (
            <div className="flex gap-2 text-amber-700 dark:text-amber-400">
              <Globe aria-hidden className="mt-0.5 size-4 shrink-0" />
              <div className="grid min-w-0 gap-0.5">
                <p className="font-medium">{plan.external.length === 1 ? fill(t.externalTitleOne, { org }) : fill(t.externalTitle, { count: plan.external.length, org })}</p>
                <ul className="grid gap-0.5 text-xs">
                  {byDomain.map(([domain, people]) => (
                    <li key={domain} className="break-words">
                      <span className="font-medium">{domain}</span>
                      <span className="text-muted-foreground"> · {people.map(label).join(", ")}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
          {plan.replyToElsewhere && (
            <p className="flex gap-2 text-xs break-words text-amber-700 dark:text-amber-400">
              <Reply aria-hidden className="mt-0.5 size-3.5 shrink-0" />
              {fill(t.replyToElsewhere, { replyTo: plan.sender.map((m) => m.email).join(", "), from: parseAddressList(message?.from)[0]?.email ?? "" })}
            </p>
          )}
          <div className="flex flex-wrap gap-2 pt-0.5 text-xs">
            {senderName && (
              <button type="button" data-fix onClick={() => choose("sender", fill(t.chosenSender, { name: senderName }))} className={fixClass}>
                <Reply aria-hidden className="size-3.5 shrink-0" />
                {fill(t.senderOnly, { name: senderName })}
              </button>
            )}
            {canInternal && (
              <button type="button" data-fix onClick={() => choose("internal", fill(t.chosenInternal, { count: internalReach.toLocaleString(), org }))} className={fixClass}>
                {fill(t.internalOnly, { org })}
              </button>
            )}
            {!plan.undisclosed && (
              <button type="button" onClick={() => choose("all", fill(t.chosenAll, { count: plan.reach.toLocaleString() }))} className={ghostClass}>
                {t.replyAllAnyway}
              </button>
            )}
          </div>
        </>
      )}
      <p className="truncate text-xs text-muted-foreground" title={[...current.to, ...current.cc].map((m) => m.email).join(", ")}>{preview}</p>
    </section>
  )
}
