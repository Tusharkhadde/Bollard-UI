"use client"

// Bollard UI — email-change-guard · MIT licence · https://bollard-ui.vercel.app/components/email-change-guard

import * as React from "react"
import { KeyRound, LogIn, Loader2, MailCheck, MailWarning, Receipt, ShieldCheck, X } from "lucide-react"

import { cn } from "@/lib/utils"
import { checkEmailChange, cleanEmail, type EmailChangeIssue } from "./email-change"

export { checkEmailChange, cleanEmail, firstDifference, isEmail, mailboxKey, type EmailChangeIssue } from "./email-change"

/** Every visible string. `{email}`, `{old}`, `{domain}`, `{at}` and `{seconds}` are filled in. */
export const EMAIL_CHANGE_MESSAGES = {
  current: "Current email",
  newEmail: "New email",
  confirm: "Type it again",
  invalid: "That isn't a complete email address.",
  same: "That's already your email.",
  sameMailbox: "That goes to the same inbox as {old}.",
  typo: "Did you mean {email}?",
  useFix: "Use @{domain}",
  useFixLabel: "Use {email}",
  keepTyped: "Keep {email}",
  fixed: "Changed to {email}.",
  mismatch: "The two don't match from character {at}.",
  movesTitle: "What moves to the new address",
  moves: ["Signing in", "Receipts and invoices", "Password resets and 2FA codes", "Security alerts"],
  keepsOld: "{old} keeps working until you click the link we send to the new address.",
  submit: "Send verification link",
  submitAnyway: "Send to this address anyway",
  pendingTitle: "Check {email}",
  pendingBody: "Click the link we sent. Until then, sign-in, receipts and codes still go to {old}.",
  resend: "Resend link",
  resendIn: "Resend in {seconds}s",
  resent: "Sent again.",
  edit: "Use a different address",
  cancel: "Cancel change",
  cancelled: "Change cancelled. {old} stays your email.",
  failed: "Couldn't send the link. Try again.",
}

export type EmailChangeMessages = typeof EMAIL_CHANGE_MESSAGES

const fill = (template: string, values: Record<string, string | number>) =>
  template.replace(/\{(\w+)\}/g, (match, key: string) => String(values[key] ?? match))

const fieldClass =
  "h-9 w-full min-w-0 rounded-md border bg-transparent px-3 text-base shadow-xs md:text-sm outline-none transition-[color,box-shadow] dark:bg-input/30 focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-destructive read-only:opacity-70"
const fixClass =
  "inline-flex h-6 items-center rounded-md border border-amber-500/40 px-2 text-xs font-medium text-amber-900 transition-colors hover:bg-amber-500/10 dark:text-amber-200 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
const buttonClass = "inline-flex h-9 items-center justify-center gap-2 rounded-md px-4 text-sm font-medium outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-60"
const icons = [LogIn, Receipt, KeyRound, ShieldCheck]

export interface EmailChangeGuardProps extends Omit<React.ComponentProps<"div">, "defaultValue" | "onChange"> {
  /** The account's current, verified email. */
  currentEmail: string
  /** Controlled new-email text. */
  value?: string
  /** Initial new-email text when uncontrolled. */
  defaultValue?: string
  /** Called as the new email is typed or fixed. */
  onValueChange?: (email: string) => void
  /** Controlled address awaiting verification; null for none. */
  pendingEmail?: string | null
  /** Sends the verification link. Only called for a clean, matching address. May return a Promise; a rejection keeps the form. */
  onRequestChange?: (email: string) => void | Promise<void>
  /** Sends the link again. */
  onResend?: (email: string) => void | Promise<void>
  /** Drops the pending change; the current email stays. */
  onCancelChange?: (email: string) => void | Promise<void>
  /** Seconds before Resend is allowed again. */
  resendCooldown?: number
  /** Provider domains to check typos against. */
  domains?: string[]
  /** Pause in ms before typo and match checks run while typing. */
  delay?: number
  /** Any visible string. */
  messages?: Partial<EmailChangeMessages>
}

/**
 * Changing an account email without locking yourself out: catches a typo'd provider and a
 * confirmation that doesn't match, spots the same inbox (Gmail dots, +tags), says what moves with
 * the address (sign-in, receipts, 2FA codes), and keeps the old address active until the new one is
 * verified, with resend, edit and cancel while it waits.
 */
export function EmailChangeGuard({
  currentEmail,
  value,
  defaultValue = "",
  onValueChange,
  pendingEmail: pendingProp,
  onRequestChange,
  onResend,
  onCancelChange,
  resendCooldown = 30,
  domains,
  delay = 600,
  messages,
  className,
  id,
  "aria-describedby": describedBy,
  ...props
}: EmailChangeGuardProps) {
  const t = { ...EMAIL_CHANGE_MESSAGES, ...messages }
  const [inner, setInner] = React.useState(defaultValue)
  const [confirm, setConfirm] = React.useState("")
  const [settled, setSettled] = React.useState({ email: defaultValue, confirm: "" })
  const [dismissed, setDismissed] = React.useState<string>()
  const [innerPending, setInnerPending] = React.useState<string | null>(null)
  const [busy, setBusy] = React.useState<"submit" | "resend" | "cancel">()
  const [cooldown, setCooldown] = React.useState(0)
  const [status, setStatus] = React.useState("")
  const [error, setError] = React.useState("")
  const [asked, setAsked] = React.useState(false)
  // A confirmation that is still a prefix of the address is "not finished yet", not wrong, until the field is left.
  const [confirmLeft, setConfirmLeft] = React.useState(false)
  const request = React.useRef(0)
  const autoId = React.useId()
  const baseId = id ?? autoId
  const emailRef = React.useRef<HTMLInputElement>(null)
  const confirmRef = React.useRef<HTMLInputElement>(null)
  const pendingRef = React.useRef<HTMLHeadingElement>(null)
  const email = typeof (value ?? inner) === "string" ? (value ?? inner) : ""
  const old = cleanEmail(currentEmail)
  const pending = pendingProp !== undefined ? pendingProp : innerPending

  React.useEffect(() => {
    const timer = setTimeout(() => setSettled({ email, confirm }), delay)
    return () => clearTimeout(timer)
  }, [email, confirm, delay])

  React.useEffect(() => {
    if (cooldown <= 0) return
    const timer = setTimeout(() => setCooldown((s) => s - 1), 1000)
    return () => clearTimeout(timer)
  }, [cooldown])

  /** Cleans pasted spaces and zero-width characters without throwing the caret to the end. */
  const cleanKeepingCaret = (input: HTMLInputElement) => {
    const raw = input.value
    const clean = cleanEmail(raw)
    if (clean.length !== raw.length && input.selectionStart !== null) {
      const caret = cleanEmail(raw.slice(0, input.selectionStart)).length
      requestAnimationFrame(() => input.setSelectionRange(caret, caret))
    }
    return clean
  }

  const update = (next: string) => {
    if (value === undefined) setInner(next)
    onValueChange?.(next)
    setError("")
    setAsked(false)
  }

  const issues = checkEmailChange(old, settled.email, settled.confirm, domains).filter((issue) => !(issue.kind === "typo" && issue.fixed === dismissed))
  const live = checkEmailChange(old, email, confirm, domains)
  const fieldIssues = issues.filter((issue) => issue.kind !== "mismatch")
  const typing = !confirmLeft && cleanEmail(settled.email).toLowerCase().startsWith(cleanEmail(settled.confirm).toLowerCase())
  const mismatch = typing ? undefined : issues.find((issue): issue is Extract<EmailChangeIssue, { kind: "mismatch" }> => issue.kind === "mismatch")
  // Typos and "same inbox" (a deliberate +tag or dotted Gmail) warn; only invalid, unchanged or unmatched addresses block.
  const ready = !!cleanEmail(email) && cleanEmail(email).toLowerCase() === cleanEmail(confirm).toLowerCase() && !live.some((i) => i.kind !== "typo" && i.kind !== "sameMailbox")

  const describe = (issue: EmailChangeIssue) => {
    switch (issue.kind) {
      case "invalid": return t.invalid
      case "same": return t.same
      case "sameMailbox": return fill(t.sameMailbox, { old })
      case "typo": return fill(t.typo, { email: issue.fixed })
      case "mismatch": return fill(t.mismatch, { at: issue.at + 1 })
    }
  }

  const applyFix = (fixed: string) => {
    update(fixed)
    setSettled((s) => ({ ...s, email: fixed }))
    setStatus(fill(t.fixed, { email: fixed }))
    // The confirmation must be retyped against the corrected address, so go there if it's filled.
    requestAnimationFrame(() => (confirm ? confirmRef : emailRef).current?.focus())
  }

  const act = async (kind: "submit" | "resend" | "cancel") => {
    if (busy) return
    const typo = kind === "submit" && fieldIssues.find((issue) => issue.kind === "typo")
    if (typo && !asked) {
      setAsked(true)
      emailRef.current?.parentElement?.querySelector<HTMLElement>("[data-fix]")?.focus()
      return
    }
    const target = kind === "submit" ? cleanEmail(email) : pending ?? ""
    const handler = kind === "submit" ? onRequestChange : kind === "resend" ? onResend : onCancelChange
    const ticket = ++request.current
    setBusy(kind)
    setError("")
    try {
      await handler?.(target)
      if (ticket !== request.current) return // a later action superseded this one
      if (kind === "submit") {
        if (pendingProp === undefined) setInnerPending(target)
        setCooldown(resendCooldown)
        requestAnimationFrame(() => pendingRef.current?.focus())
      } else if (kind === "resend") {
        setCooldown(resendCooldown)
        setStatus(t.resent)
      } else {
        if (pendingProp === undefined) setInnerPending(null)
        setStatus(fill(t.cancelled, { old }))
        requestAnimationFrame(() => emailRef.current?.focus())
      }
    } catch {
      if (ticket === request.current) setError(t.failed)
    } finally {
      if (ticket === request.current) setBusy(undefined)
    }
  }

  const editAgain = () => {
    request.current++
    if (pendingProp === undefined) setInnerPending(null)
    setBusy(undefined)
    requestAnimationFrame(() => emailRef.current?.select())
  }

  const hintId = `${baseId}-hint`
  const confirmHintId = `${baseId}-confirm-hint`
  const warn = (content: React.ReactNode, hint: string) => (
    <p id={hint} className="mt-1.5 flex gap-1.5 text-xs text-amber-700 dark:text-amber-400">
      <MailWarning aria-hidden className="mt-1 size-3.5 shrink-0" />
      <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">{content}</span>
    </p>
  )

  return (
    <div data-slot="email-change-guard" data-state={pending ? "pending" : issues.length ? "warning" : "editing"} className={cn("w-full max-w-md space-y-3 text-sm", className)} {...props}>
      <p className="min-w-0 [overflow-wrap:anywhere]">
        <span className="text-muted-foreground">{t.current}: </span>
        <span className="font-medium">{old}</span>
      </p>

      {pending ? (
        <div className="space-y-2 rounded-md border border-emerald-500/30 bg-emerald-500/5 p-3">
          <h3 ref={pendingRef} tabIndex={-1} className="flex items-center gap-1.5 font-medium text-emerald-800 outline-none dark:text-emerald-300 [overflow-wrap:anywhere]">
            <MailCheck aria-hidden className="size-4 shrink-0" />
            {fill(t.pendingTitle, { email: pending })}
          </h3>
          <p className="text-xs text-muted-foreground [overflow-wrap:anywhere]">{fill(t.pendingBody, { old })}</p>
          <div className="flex flex-wrap gap-2 pt-1">
            {onResend && (
              <button type="button" onClick={() => act("resend")} disabled={cooldown > 0 || !!busy} className={cn(buttonClass, "h-8 px-3 border bg-background hover:bg-accent dark:bg-input/30")}>
                {busy === "resend" && <Loader2 aria-hidden className="size-4 animate-spin" />}
                {cooldown > 0 ? fill(t.resendIn, { seconds: cooldown }) : t.resend}
              </button>
            )}
            <button type="button" onClick={editAgain} className={cn(buttonClass, "h-8 px-3 hover:bg-accent")}>{t.edit}</button>
            {onCancelChange && (
              <button type="button" onClick={() => act("cancel")} disabled={!!busy} className={cn(buttonClass, "h-8 px-3 text-muted-foreground hover:bg-accent hover:text-foreground")}>
                {busy === "cancel" && <Loader2 aria-hidden className="size-4 animate-spin" />}
                {t.cancel}
              </button>
            )}
          </div>
        </div>
      ) : (
        <>
          <div>
            <label htmlFor={`${baseId}-new`} className="text-sm font-medium">{t.newEmail}</label>
            <input
              ref={emailRef}
              id={`${baseId}-new`}
              type="email"
              inputMode="email"
              autoComplete="email"
              autoCapitalize="none"
              spellCheck={false}
              value={email}
              readOnly={busy === "submit"}
              onChange={(e) => update(cleanKeepingCaret(e.target))}
              onBlur={() => setSettled({ email, confirm })}
              aria-invalid={fieldIssues.some((i) => i.kind === "invalid" || i.kind === "same") || undefined}
              aria-describedby={[describedBy, fieldIssues.length ? hintId : `${baseId}-keeps`].filter(Boolean).join(" ")}
              className={cn(fieldClass, "mt-1.5")}
            />
            <div aria-live="polite">
            {fieldIssues.length > 0 && warn(
              fieldIssues.map((issue) => (
                <React.Fragment key={issue.kind}>
                  <span className="py-1">{describe(issue)}</span>
                  {issue.kind === "typo" && (
                    <>
                      <button type="button" data-fix onClick={() => applyFix(issue.fixed)} aria-label={fill(t.useFixLabel, { email: issue.fixed })} className={fixClass}>{fill(t.useFix, { domain: issue.domain })}</button>
                      <button type="button" onClick={() => { setDismissed(issue.fixed); emailRef.current?.focus() }} aria-label={fill(t.keepTyped, { email })} title={fill(t.keepTyped, { email })} className="grid size-6 place-items-center rounded-md text-muted-foreground hover:bg-accent outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"><X aria-hidden className="size-3.5" /></button>
                    </>
                  )}
                </React.Fragment>
              )),
              hintId,
            )}
            </div>
          </div>
          <div>
            <label htmlFor={`${baseId}-confirm`} className="text-sm font-medium">{t.confirm}</label>
            <input
              ref={confirmRef}
              id={`${baseId}-confirm`}
              type="email"
              inputMode="email"
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              value={confirm}
              readOnly={busy === "submit"}
              onChange={(e) => setConfirm(cleanKeepingCaret(e.target))}
              onFocus={() => setConfirmLeft(false)}
              onBlur={() => {
                setConfirmLeft(true)
                setSettled({ email, confirm })
              }}
              aria-invalid={!!mismatch || undefined}
              aria-describedby={mismatch ? confirmHintId : undefined}
              className={cn(fieldClass, "mt-1.5")}
            />
            <div aria-live="polite">
            {mismatch && warn(
              <span className="min-w-0 py-1 font-mono [overflow-wrap:anywhere]">
                <span className="font-sans">{describe(mismatch)} </span>
                {cleanEmail(confirm).slice(0, mismatch.at)}
                <mark className="rounded-sm bg-amber-500/25 px-px text-inherit">{cleanEmail(confirm).slice(mismatch.at) || "…"}</mark>
              </span>,
              confirmHintId,
            )}
            </div>
          </div>

          <div className="rounded-md border p-3">
            <p className="text-xs font-medium">{t.movesTitle}</p>
            <ul className="mt-2 grid gap-1.5 text-xs text-muted-foreground sm:grid-cols-2">
              {t.moves.map((move, i) => {
                const Icon = icons[i % icons.length]
                return <li key={move} className="flex items-center gap-1.5"><Icon aria-hidden className="size-3.5 shrink-0" />{move}</li>
              })}
            </ul>
            <p id={`${baseId}-keeps`} className="mt-2 text-xs [overflow-wrap:anywhere]">{fill(t.keepsOld, { old })}</p>
          </div>

          <div className="flex justify-end">
            <button type="button" onClick={() => act("submit")} disabled={!ready} aria-disabled={busy === "submit" || undefined} className={cn(buttonClass, "bg-primary text-primary-foreground hover:bg-primary/90")}>
              {busy === "submit" && <Loader2 aria-hidden className="size-4 animate-spin" />}
              {asked && fieldIssues.some((i) => i.kind === "typo") ? t.submitAnyway : t.submit}
            </button>
          </div>
        </>
      )}
      {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
      <span role="status" className="sr-only">{status}</span>
    </div>
  )
}
