"use client"

// Bollard UI — recovery-check · MIT licence · https://bollard-ui.vercel.app/components/recovery-check

import * as React from "react"
import { CircleCheck, KeyRound, LoaderCircle, Mail, Phone, ShieldAlert, ShieldCheck, Smartphone } from "lucide-react"

import { cn } from "@/lib/utils"

const DAY = 86_400_000

export type SecondFactor = "passkey" | "security-key" | "authenticator" | "sms"

export interface RecoveryState {
  /** Recovery email and when the user last proved they can read it. */
  email?: { value: string; confirmedAt: Date | number | string }
  /** Recovery phone and when the user last proved they can receive on it. */
  phone?: { value: string; confirmedAt: Date | number | string }
  /** Second factors on the account, besides the password. */
  factors: { type: SecondFactor; phone?: string }[]
  /** Unused backup codes left. Omit when none were ever generated. */
  backupCodesLeft?: number
}

export type IssueId = "stale-email" | "stale-phone" | "no-backup" | "single-factor" | "sms-same-phone" | "codes-low" | "codes-used"

export interface RecoveryIssue {
  id: IssueId
  /** "warning" can lock the user out in a likely scenario; "notice" is worth fixing soon. */
  severity: "warning" | "notice"
}

const digits = (phone: string) => phone.replace(/\D/g, "")

/**
 * Finds what would lock the user out. Pure, so it can run on the server.
 * Contact details count as stale after `staleAfterDays` without a confirmation.
 */
export function checkRecovery(state: RecoveryState, now: number, staleAfterDays = 180): RecoveryIssue[] {
  const issues: RecoveryIssue[] = []
  const stale = (at: Date | number | string) => now - new Date(at).getTime() > staleAfterDays * DAY
  if (state.factors.length === 0) issues.push({ id: "single-factor", severity: "warning" })
  if (!state.email && !state.phone && !state.backupCodesLeft) issues.push({ id: "no-backup", severity: "warning" })
  if (state.email && stale(state.email.confirmedAt)) issues.push({ id: "stale-email", severity: "warning" })
  if (state.phone && stale(state.phone.confirmedAt)) issues.push({ id: "stale-phone", severity: "warning" })
  // Losing one phone takes out both the second factor and the way back in.
  const sms = state.factors.filter((f) => f.type === "sms" && f.phone)
  if (state.phone && sms.length === state.factors.length && sms.some((f) => digits(f.phone!) === digits(state.phone!.value)))
    issues.push({ id: "sms-same-phone", severity: "notice" })
  if (state.backupCodesLeft !== undefined && state.backupCodesLeft > 0 && state.backupCodesLeft <= 2) issues.push({ id: "codes-low", severity: "notice" })
  // Every code spent, but email or phone still exist (otherwise "no-backup" already covers it).
  if (state.backupCodesLeft === 0 && (state.email || state.phone)) issues.push({ id: "codes-used", severity: "notice" })
  return issues
}

/** "t•••@gmail.com", "•••• 8781": enough to recognise, not enough to leak. */
export function maskContact(value: string) {
  if (value.includes("@")) {
    const [name, domain] = value.split("@")
    return `${name.slice(0, 1)}•••@${domain}`
  }
  return `•••• ${digits(value).slice(-4)}`
}

const fill = (template: string, values: Record<string, string | number>) =>
  template.replace(/\{(\w+)\}/g, (match, key: string) => String(values[key] ?? match))

const COPY: Record<IssueId, { icon: typeof Mail; title: string; detail: string; fix: string }> = {
  "stale-email": { icon: Mail, title: "Is {email} still yours?", detail: "Not confirmed in {age}. If it's gone, reset links go nowhere.", fix: "Send a test link" },
  "stale-phone": { icon: Phone, title: "Is {phone} still yours?", detail: "Not confirmed in {age}. Old numbers get reassigned to strangers.", fix: "Send a test code" },
  "no-backup": { icon: KeyRound, title: "No way back in", detail: "Forget your password and there's nothing to reset it with.", fix: "Get backup codes" },
  "single-factor": { icon: ShieldAlert, title: "Only a password protects you", detail: "A leaked password is all someone needs to get in.", fix: "Add a passkey" },
  "sms-same-phone": { icon: Smartphone, title: "One phone holds both keys", detail: "Lose {phone} and you lose your sign-in code and your recovery.", fix: "Add a passkey" },
  "codes-low": { icon: KeyRound, title: "Backup codes running low", detail: "Only {count} left, and each works once. Make a fresh set before you run out.", fix: "Make new codes" },
  "codes-used": { icon: KeyRound, title: "Backup codes all used", detail: "Every code has been used, so they can't get you in any more.", fix: "Make new codes" },
}

const ORDER = Object.keys(COPY) as IssueId[]

type FixState = "pending" | "done" | "failed"

export interface RecoveryCheckProps extends React.ComponentProps<"section"> {
  /** Recovery methods on the account and when each was last confirmed. */
  state: RecoveryState
  /** Runs the one-tap fix for an issue. Resolve to mark it fixed; reject to show `failedText`. */
  onFix: (issue: IssueId) => void | Promise<void>
  /** Optional "Change" next to a stale email or phone, for users who already know it's gone. */
  onChangeContact?: (kind: "email" | "phone") => void
  /** Days without confirmation before an email or phone counts as stale. */
  staleAfterDays?: number
  /** Override the title, detail or fix label of any issue. `{email}`, `{phone}`, `{age}` and `{count}` are filled in. */
  issueText?: Partial<Record<IssueId, Partial<(typeof COPY)[IssueId]>>>
  /** Templates: `{count}` is the number of open issues. */
  title?: string
  /** Summary line. `{count}` is the number of open issues. */
  summaryText?: string
  /** Shown when nothing is at risk. */
  allClearText?: string
  /** Shown in place of the fix button once fixed. */
  fixedLabel?: string
  /** Label of the optional Change button for a stale contact. */
  changeLabel?: string
  /** Shown when onFix rejects. */
  failedText?: string
  /** Locale for relative ages ("8 months ago"). */
  locale?: string
}

/**
 * A security checkup that asks "if you lost your phone today, could you get
 * back in?" It flags recovery details nobody has confirmed in months, no backup
 * method, a password-only account, and the trap most checkups miss: the same
 * phone acting as both the second factor and the recovery number. Each issue
 * has one button that fixes it, and fixed rows stay visible as proof.
 */
export function RecoveryCheck({
  state,
  onFix,
  onChangeContact,
  staleAfterDays = 180,
  issueText,
  title = "Could you get back in?",
  summaryText = "{count} things could lock you out of your account.",
  allClearText = "You can get back in even if you lose your phone.",
  fixedLabel = "Fixed",
  changeLabel = "Change",
  failedText = "That didn't work. Try again.",
  locale,
  className,
  ...props
}: RecoveryCheckProps) {
  const id = React.useId()
  const [now, setNow] = React.useState<number>()
  const [fixes, setFixes] = React.useState<Partial<Record<IssueId, FixState>>>({})
  const [justFixed, setJustFixed] = React.useState<IssueId>()
  const listRef = React.useRef<HTMLUListElement>(null)
  React.useEffect(() => setNow(Date.now()), [])
  // The fix button disappears once it works, so focus moves to that row's "Fixed" mark instead of <body>.
  React.useEffect(() => {
    if (justFixed) listRef.current?.querySelector<HTMLElement>(`[data-issue="${justFixed}"] [data-fixed]`)?.focus()
  }, [justFixed])

  const found = now === undefined ? [] : checkRecovery(state, now, staleAfterDays)
  // Fixed issues stay on screen, in their place, even once the new state no longer reports them.
  const fixedGone = (Object.keys(fixes) as IssueId[]).filter((key) => fixes[key] === "done" && !found.some((i) => i.id === key))
  const shown = [...found, ...fixedGone.map((key) => ({ id: key, severity: "notice" as const }))].sort((a, b) => ORDER.indexOf(a.id) - ORDER.indexOf(b.id))
  const open = shown.filter((i) => fixes[i.id] !== "done")
  const age = (at?: Date | number | string) => {
    if (!at || now === undefined) return ""
    const months = Math.max(0, Math.round((now - new Date(at).getTime()) / (30 * DAY)))
    if (Number.isNaN(months)) return ""
    const [count, unit] = months >= 12 ? [Math.round(months / 12), "year"] : [months, "month"]
    return new Intl.NumberFormat(locale, { style: "unit", unit, unitDisplay: "long" }).format(count)
  }
  const values = {
    email: state.email ? maskContact(state.email.value) : "",
    phone: state.phone ? maskContact(state.phone.value) : "",
    count: state.backupCodesLeft ?? 0,
  }

  const fix = async (issue: IssueId) => {
    setFixes((map) => ({ ...map, [issue]: "pending" }))
    try {
      await onFix(issue)
      setFixes((map) => ({ ...map, [issue]: "done" }))
      setJustFixed(issue)
    } catch {
      setFixes((map) => ({ ...map, [issue]: "failed" }))
    }
  }

  return (
    <section data-slot="recovery-check" data-state={open.length ? "at-risk" : "clear"} aria-labelledby={`${id}-title`} className={cn("grid w-full max-w-md gap-3 rounded-lg border bg-card p-4 text-card-foreground shadow-xs", className)} {...props}>
      <div className="flex gap-3">
        <span className={cn("grid size-8 shrink-0 place-items-center rounded-full transition-colors", open.length ? "bg-amber-500/15 text-amber-700 dark:text-amber-400" : "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400")}>
          {open.length ? <ShieldAlert aria-hidden className="size-4" /> : <ShieldCheck aria-hidden className="size-4" />}
        </span>
        <div className="min-w-0 text-sm">
          <h3 id={`${id}-title`} className="font-medium">{title}</h3>
          <p aria-live="polite" className="text-xs text-muted-foreground">{now === undefined ? "" : open.length ? fill(summaryText, { count: open.length }) : allClearText}</p>
        </div>
      </div>

      {shown.length > 0 && (
        <ul ref={listRef} className="divide-y rounded-md border">
          {shown.map((issue) => {
            const copy = { ...COPY[issue.id], ...issueText?.[issue.id] }
            const Icon = copy.icon
            const fixState = fixes[issue.id]
            const done = fixState === "done"
            const when = age(issue.id === "stale-email" ? state.email?.confirmedAt : state.phone?.confirmedAt)
            return (
              <li key={issue.id} data-issue={issue.id} data-state={fixState ?? "open"} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2.5 text-sm">
                <div className="flex min-w-0 flex-1 basis-56 gap-3">
                <Icon aria-hidden className={cn("mt-0.5 size-4 shrink-0", done ? "text-emerald-600 dark:text-emerald-400" : issue.severity === "warning" ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground")} />
                <div className={cn("min-w-0 flex-1 transition-opacity", done && "opacity-60")}>
                  <p className="font-medium">{fill(copy.title, { ...values, age: when })}</p>
                  {!done && <p className="text-xs text-muted-foreground">{fill(copy.detail, { ...values, age: when })}</p>}
                  {fixState === "failed" && <p role="alert" className="mt-1 text-xs text-red-700 dark:text-red-400">{failedText}</p>}
                </div>
                </div>
                {done ? (
                  <span data-fixed tabIndex={-1} className="ml-auto inline-flex h-8 items-center gap-1.5 rounded-md px-1 text-sm font-medium text-emerald-700 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:text-emerald-400">
                    <CircleCheck aria-hidden className="size-4" /> {fixedLabel}
                    <span className="sr-only">: {fill(copy.title, { ...values, age: when })}</span>
                  </span>
                ) : (
                  <div className="ml-auto flex gap-2">
                  {onChangeContact && (issue.id === "stale-email" || issue.id === "stale-phone") && (
                    <button type="button" onClick={() => onChangeContact(issue.id === "stale-email" ? "email" : "phone")} className="inline-flex h-8 items-center rounded-md border border-amber-700/25 px-3 text-sm font-medium outline-none transition-colors hover:bg-amber-500/15 focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:border-amber-300/25">
                      {changeLabel}
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={fixState === "pending"}
                    onClick={() => void fix(issue.id)}
                    className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md bg-amber-700 px-3 text-sm font-medium whitespace-nowrap text-white outline-none transition-colors hover:bg-amber-800 focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-60 dark:bg-amber-400 dark:text-amber-950 dark:hover:bg-amber-300"
                  >
                    {fixState === "pending" && <LoaderCircle aria-hidden className="size-4 animate-spin" />}
                    {fill(copy.fix, values)}
                  </button>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
