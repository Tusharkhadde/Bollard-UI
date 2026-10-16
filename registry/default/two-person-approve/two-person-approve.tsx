"use client"

import * as React from "react"
import { Check, Clock, LoaderCircle, ShieldCheck, TriangleAlert, UserX, X } from "lucide-react"

import { cn } from "@/lib/utils"

export interface Person {
  id: string
  name: string
}

/** FNV-1a over the exact plan text, as 8 hex digits. Any change to what will run changes it. */
export function planFingerprint(plan: string) {
  let hash = 0x811c9dc5
  for (let i = 0; i < plan.length; i++) hash = Math.imul(hash ^ plan.charCodeAt(i), 0x01000193)
  return (hash >>> 0).toString(16).padStart(8, "0")
}

/** "1 h 20 min", "41 min", "45 s". */
export function formatLeft(ms: number) {
  const s = Math.max(0, Math.ceil(ms / 1000))
  if (s < 60) return `${s} s`
  const m = Math.ceil(s / 60)
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ""}`
}

const fill = (template: string, values: Record<string, string>) =>
  template.replace(/\{(\w+)\}/g, (match, key: string) => values[key] ?? match)
const button =
  "inline-flex h-9 items-center justify-center gap-2 rounded-md px-4 text-sm font-medium whitespace-nowrap shadow-xs outline-none transition-[color,background-color,box-shadow] focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50"

type Outcome = { verdict: "approved" | "rejected"; reason: string }

export interface TwoPersonApproveProps extends Omit<React.ComponentProps<"section">, "title"> {
  /** What is being asked for, e.g. "Drop table payments_archive". */
  title: string
  /** Exactly what will run once approved: a command, a diff, a SQL statement. */
  plan: string
  /** Who asked. They can never approve their own request. */
  requester: Person
  /** Everyone allowed to approve. The requester is excluded even if listed. */
  approvers: Person[]
  /** The person looking at the card. */
  currentUser: Person
  /** When the request lapses. Nothing runs after this. */
  expiresAt: Date | number | string
  /** When it was requested; drives the expiry bar. */
  requestedAt: Date | number | string
  /** Approve. Receives the note and the fingerprint of the exact plan approved. Return a promise to show progress. */
  onApprove: (decision: { reason: string; fingerprint: string }) => void | Promise<void>
  /** Reject. A reason is required. */
  onReject: (decision: { reason: string }) => void | Promise<void>
  /** Templates: `{requester}`, `{approvers}`, `{time}` are filled in. */
  selfText?: string
  /** Shown when the current user isn't an approver. */
  notApproverText?: string
  /** Shown when the plan changed since it was reviewed. */
  changedText?: string
  /** Label of the reviewed-fingerprint chip. */
  reviewedLabel?: string
  /** Shown once the request has expired. */
  expiredText?: string
  /** Shown when rejecting without a reason. */
  reasonMissingText?: string
  /** Shown after approving. */
  approvedText?: string
  /** Shown after rejecting. */
  rejectedText?: string
  /** Label of the Approve button. */
  approveLabel?: string
  /** Label of the Reject button. */
  rejectLabel?: string
}

/**
 * The two-person rule for high-risk actions. The requester can see the card
 * but can't approve it, and is told exactly who can. Approval is bound to a
 * fingerprint of the plan: if the plan changes while it's open, the changed
 * lines flash and Approve locks until the reviewer acknowledges them, so
 * nobody approves version 1 and runs version 2. Rejecting needs a reason, and
 * an expired request can't be approved at all.
 */
export function TwoPersonApprove({
  title, plan, requester, approvers, currentUser, expiresAt, requestedAt, onApprove, onReject,
  selfText = "You requested this, so someone else has to approve it. Ask {approvers}.",
  notApproverText = "You're not on the approver list. Ask {approvers}.",
  changedText = "{requester} changed the plan after you opened it. Changed lines are marked.",
  reviewedLabel = "I've reviewed the change",
  expiredText = "Expired at {time}. Nothing ran. {requester} can request it again.",
  reasonMissingText = "Add a reason so {requester} knows what to change.",
  approvedText = "Approved. This exact plan will run now.",
  rejectedText = "Rejected. Nothing will run.",
  approveLabel = "Approve and run",
  rejectLabel = "Reject",
  className,
  ...props
}: TwoPersonApproveProps) {
  const [now, setNow] = React.useState<number>()
  const [reviewed, setReviewed] = React.useState(plan)
  const [reason, setReason] = React.useState("")
  const [missing, setMissing] = React.useState(false)
  const [pending, setPending] = React.useState<"approve" | "reject">()
  const [outcome, setOutcome] = React.useState<Outcome>()
  const reasonRef = React.useRef<HTMLTextAreaElement>(null)
  const id = React.useId()

  React.useEffect(() => {
    setNow(Date.now())
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])

  const end = new Date(expiresAt).getTime()
  const start = new Date(requestedAt).getTime()
  const left = now === undefined ? end - start : end - now
  const expired = now !== undefined && left <= 0
  const eligible = approvers.filter((p) => p.id !== requester.id)
  const isSelf = currentUser.id === requester.id
  const canApprove = eligible.some((p) => p.id === currentUser.id)
  const changed = reviewed !== plan
  const oldLines = new Set(reviewed.split("\n"))
  const values = {
    requester: requester.name,
    approvers: eligible.map((p) => p.name).join(" or ") || "an approver",
    time: new Date(end).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
  }
  const blocked = isSelf ? selfText : !canApprove ? notApproverText : null
  const locked = !!blocked || expired || !!outcome || !!pending

  const decide = async (verdict: "approve" | "reject") => {
    if (verdict === "reject" && !reason.trim()) {
      setMissing(true)
      reasonRef.current?.focus()
      return
    }
    setPending(verdict)
    try {
      if (verdict === "approve") await onApprove({ reason: reason.trim(), fingerprint: planFingerprint(plan) })
      else await onReject({ reason: reason.trim() })
      setOutcome({ verdict: verdict === "approve" ? "approved" : "rejected", reason: reason.trim() })
    } catch {
      // The caller reports the error; the card stays open for another try.
    } finally {
      setPending(undefined)
    }
  }

  const state = outcome?.verdict ?? (expired ? "expired" : "pending")
  const soon = left < 5 * 60_000

  return (
    <section
      data-slot="two-person-approve"
      data-state={state}
      aria-labelledby={`${id}-title`}
      className={cn("w-full max-w-md overflow-hidden rounded-lg border bg-card text-card-foreground shadow-xs", className)}
      {...props}
    >
      <style>{`@keyframes cui-two-person-approve-flash{from{background-color:rgb(245 158 11/.35)}to{background-color:rgb(245 158 11/.12)}}`}</style>
      <div className="relative flex items-center gap-2 border-b px-3 py-2 text-xs">
        <ShieldCheck aria-hidden className="size-4 text-muted-foreground" />
        <span className="truncate font-medium">Two-person approval</span>
        <span
          className={cn(
            "ml-auto inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 font-medium tabular-nums",
            state === "approved" && "bg-emerald-500/15 text-emerald-800 dark:text-emerald-300",
            state === "rejected" && "bg-red-500/15 text-red-800 dark:text-red-300",
            state === "expired" && "bg-muted text-muted-foreground",
            state === "pending" && (soon ? "bg-amber-500/15 text-amber-800 dark:text-amber-300" : "bg-muted"),
          )}
        >
          {state === "pending" ? <Clock aria-hidden className="size-3.5" /> : null}
          {state === "pending" ? `Expires in ${formatLeft(left)}` : state[0].toUpperCase() + state.slice(1)}
        </span>
        {state === "pending" ? (
          <span
            aria-hidden
            className={cn("absolute inset-x-0 bottom-0 h-0.5 origin-left transition-transform duration-1000 ease-linear motion-reduce:transition-none", soon ? "bg-amber-500" : "bg-foreground/25")}
            style={{ transform: `scaleX(${Math.max(0, Math.min(1, left / Math.max(1, end - start)))})` }}
          />
        ) : null}
      </div>

      <div className="grid gap-3 p-3">
        <div>
          <h3 id={`${id}-title`} className="text-sm font-semibold">{title}</h3>
          <p className="text-xs text-muted-foreground">Requested by {requester.name}</p>
        </div>

        <div className="grid gap-1.5">
          <div className="flex items-baseline justify-between gap-2 text-xs">
            <span className="font-medium">What will run</span>
            <span className="font-mono text-muted-foreground" title="Approval covers this exact plan">
              #{planFingerprint(plan).replace(/(.{4})/, "$1 ")}
            </span>
          </div>
          <pre className="max-h-48 overflow-auto rounded-md border bg-muted/50 py-2 font-mono text-xs leading-5" aria-describedby={changed ? `${id}-changed` : undefined}>
            {plan.split("\n").map((line, index) => {
              const isNew = changed && !oldLines.has(line)
              return (
                <span
                  key={`${index}-${line}`}
                  className={cn("block px-3", isNew && "bg-amber-500/12 motion-safe:animate-[cui-two-person-approve-flash_400ms_ease-out]")}
                >
                  {isNew ? <span className="sr-only">Changed: </span> : null}
                  {line || " "}
                </span>
              )
            })}
          </pre>
          <div aria-live="polite" id={`${id}-changed`}>
            {changed && !locked ? (
              <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-amber-700 dark:text-amber-400">
                <TriangleAlert aria-hidden className="size-3.5 shrink-0" />
                <span className="min-w-0 flex-1">{fill(changedText, values)}</span>
                <button
                  type="button"
                  onClick={() => setReviewed(plan)}
                  className="inline-flex h-6 items-center rounded-md border border-amber-500/40 px-2 font-medium text-amber-900 transition-colors outline-none hover:bg-amber-500/10 focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:text-amber-200"
                >
                  {reviewedLabel}
                </button>
              </p>
            ) : null}
          </div>
        </div>

        <div className="grid gap-1.5 text-xs">
          <span className="font-medium">Can approve</span>
          <ul className="flex flex-wrap gap-1.5">
            {eligible.map((p) => (
              <li key={p.id} className={cn("rounded-full border px-2 py-0.5", p.id === currentUser.id && "border-foreground/40 font-medium")}>
                {p.name}{p.id === currentUser.id ? " (you)" : ""}
              </li>
            ))}
            <li className="inline-flex items-center gap-1 rounded-full border border-dashed px-2 py-0.5 text-muted-foreground">
              <UserX aria-hidden className="size-3" /> <span className="line-through">{requester.name}</span>
              <span className="sr-only">cannot approve,</span> requester
            </li>
          </ul>
        </div>

        {outcome ? (
          <p role="status" className={cn("flex items-center gap-2 text-sm font-medium", outcome.verdict === "approved" ? "text-emerald-700 dark:text-emerald-400" : "text-red-700 dark:text-red-400")}>
            {outcome.verdict === "approved" ? <Check aria-hidden className="size-4" /> : <X aria-hidden className="size-4" />}
            {outcome.verdict === "approved" ? approvedText : rejectedText}
          </p>
        ) : expired ? (
          <p role="status" className="text-sm text-muted-foreground">{fill(expiredText, values)}</p>
        ) : (
          <>
            {!blocked ? (
              <div className="grid gap-1.5">
                <label htmlFor={`${id}-reason`} className="text-xs font-medium">Reason <span className="font-normal text-muted-foreground">(required to reject)</span></label>
                <textarea
                  ref={reasonRef}
                  id={`${id}-reason`}
                  rows={2}
                  value={reason}
                  aria-invalid={missing && !reason.trim() ? true : undefined}
                  aria-describedby={`${id}-missing`}
                  onChange={(event) => setReason(event.target.value)}
                  className="min-h-16 w-full resize-y rounded-md border bg-transparent px-3 py-2 text-base shadow-xs outline-none transition-[color,box-shadow] placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-destructive md:text-sm dark:bg-input/30"
                />
                <p id={`${id}-missing`} aria-live="polite" className="text-xs text-amber-700 empty:hidden dark:text-amber-400">
                  {missing && !reason.trim() ? fill(reasonMissingText, values) : ""}
                </p>
              </div>
            ) : null}
            <div className="flex flex-wrap items-center justify-end gap-2">
              {blocked ? (
                <p className="flex w-full gap-1.5 text-xs text-muted-foreground" id={`${id}-blocked`}>
                  <UserX aria-hidden className="mt-px size-3.5 shrink-0" /> {fill(blocked, values)}
                </p>
              ) : null}
              <button type="button" disabled={locked} onClick={() => void decide("reject")} aria-describedby={blocked ? `${id}-blocked` : undefined} className={cn(button, "border bg-background hover:bg-accent dark:border-input dark:bg-input/30 dark:hover:bg-input/50")}>
                {pending === "reject" ? <LoaderCircle aria-hidden className="size-4 animate-spin" /> : null}
                {rejectLabel}
              </button>
              <button type="button" disabled={locked || changed} onClick={() => void decide("approve")} aria-describedby={blocked ? `${id}-blocked` : changed ? `${id}-changed` : undefined} className={cn(button, "bg-primary text-primary-foreground hover:bg-primary/90")}>
                {pending === "approve" ? <LoaderCircle aria-hidden className="size-4 animate-spin" /> : null}
                {approveLabel}
              </button>
            </div>
          </>
        )}
      </div>
    </section>
  )
}
