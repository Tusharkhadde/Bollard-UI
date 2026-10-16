"use client"

// Bollard UI — password-policy-input · MIT licence · https://bollard-ui.vercel.app/components/password-policy-input

import * as React from "react"
import { Check, CircleCheck, Loader2, ShieldAlert, Wand2, X } from "lucide-react"

import { cn } from "@/lib/utils"
import { auditPasswordPolicy, NIST_POLICY, sanitizePolicy, trySamples, type FindingId, type PasswordPolicy, type PolicyFinding, type SampleResult } from "./policy"

export { auditPasswordPolicy, NIST_POLICY, sanitizePolicy, trySamples, type FindingId, type PasswordPolicy, type PolicyFinding, type SampleResult } from "./policy"

/** Every visible string. `{count}`, `{min}`, `{days}` and `{section}` are filled in. */
export const PASSWORD_POLICY_MESSAGES = {
  title: "Password rules",
  standard: "Checked against NIST SP 800-63B-4 (2025)",
  summaryBad: "{count} rules work against your users",
  summaryGood: "Meets NIST SP 800-63B-4",
  applyNist: "Apply NIST defaults",
  minLength: "Minimum length",
  maxLength: "Maximum length",
  require: "Require",
  upper: "Uppercase", lower: "Lowercase", digit: "Number", symbol: "Symbol",
  expiryDays: "Force a change every (days, 0 = never)",
  maxFailedAttempts: "Failed sign-ins before lockout (0 = no limit)",
  mfaRequired: "A second factor is always required",
  breachCheck: "Block breached and common passwords",
  allowPaste: "Allow pasting passwords",
  securityQuestions: "Security questions",
  passwordHints: "Password hints",
  shall: "Breaks NIST:",
  should: "NIST advises:",
  fix: "Fix",
  findings: {
    composition: "Composition rules are banned: people answer them with Password1!. Length does the work instead.",
    expiry: "Forced changes every {days} days are banned: people just bump a digit (Password1! → Password2!). Force a change only after a breach.",
    "min-length": "Too short. Without a second factor the minimum is 15; with one, 8.",
    "max-length": "Allow at least 64 characters so passphrases and password managers fit.",
    "max-below-min": "The maximum is below the minimum: nobody can choose a password.",
    paste: "Allow paste: password managers rely on it where autofill isn't available. Autofill itself must never be blocked.",
    breach: "Passwords must be checked against breached and common ones, and the reason given when one is refused.",
    questions: "Security questions are banned: the answers are guessable or public.",
    hints: "Hints are banned: anyone who can see the hint gets a head start.",
    "rate-limit": "Limit failed sign-ins to at most 100 in a row, so guessing gets nowhere.",
  } as Record<FindingId, string>,
  effectTitle: "What your rules do to real passwords",
  accepted: "Accepted",
  rejected: "Refused",
  reasons: { short: "too short", long: "too long", upper: "needs a capital", lower: "needs a lowercase letter", digit: "needs a number", symbol: "needs a symbol", blocked: "on breach lists" } as Record<SampleResult["reasons"][number], string>,
  commonWarning: "on every breach list",
  save: "Save rules",
  saved: "Saved",
  applied: "NIST defaults applied. Nothing works against your users now.",
}

export type PasswordPolicyMessages = typeof PASSWORD_POLICY_MESSAGES

const fill = (template: string, values: Record<string, string | number>) => template.replace(/\{(\w+)\}/g, (m, k: string) => String(values[k] ?? m))
const FIELD_OF: Record<FindingId, keyof PasswordPolicy> = {
  composition: "requireUppercase", expiry: "expiryDays", "min-length": "minLength", "max-length": "maxLength", "max-below-min": "maxLength",
  paste: "allowPaste", breach: "breachCheck", questions: "securityQuestions", hints: "passwordHints", "rate-limit": "maxFailedAttempts",
}
const inputClass = "h-9 w-full min-w-0 rounded-md border bg-transparent px-3 text-base shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-destructive md:text-sm dark:bg-input/30"
const fixClass = "inline-flex h-6 shrink-0 items-center rounded-md border px-2 text-xs font-medium outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50"
const DEFAULT_SAMPLES = ["Password1!", "Summer2026!", "mango rickshaw monsoon tea", "correct-horse-battery-staple"]

export interface PasswordPolicyInputProps extends Omit<React.ComponentProps<"div">, "defaultValue" | "onChange"> {
  /** Controlled policy. */
  value?: Partial<PasswordPolicy>
  /** Initial policy when uncontrolled. Missing fields take NIST defaults. */
  defaultValue?: Partial<PasswordPolicy>
  /** Called with the full, cleaned policy on every change. */
  onValueChange?: (policy: PasswordPolicy) => void
  /** Passwords to run through the rules, to show the effect on real behaviour. */
  samples?: string[]
  /** Save the rules. May return a Promise; edits made while it runs keep the form unsaved. */
  onSave?: (policy: PasswordPolicy) => void | Promise<void>
  /** Any visible string. */
  messages?: Partial<Omit<PasswordPolicyMessages, "findings" | "reasons">> & { findings?: Partial<PasswordPolicyMessages["findings"]>; reasons?: Partial<PasswordPolicyMessages["reasons"]> }
}

/**
 * An admin form for a site's password rules that reads them back against NIST SP 800-63B-4: it flags
 * the rules the standard now bans (composition, forced rotation, security questions, hints), short
 * minimums (15 without MFA, 8 with), maximums under 64, blocked paste, no breach check and no failed-sign-in
 * limit, shows what the rules do to real passwords (Password1! in, a long passphrase out), and fixes
 * each one, or all at once, in a tap.
 */
export function PasswordPolicyInput({ value, defaultValue, onValueChange, samples = DEFAULT_SAMPLES, onSave, messages, className, ...props }: PasswordPolicyInputProps) {
  const t: PasswordPolicyMessages = { ...PASSWORD_POLICY_MESSAGES, ...messages, findings: { ...PASSWORD_POLICY_MESSAGES.findings, ...messages?.findings }, reasons: { ...PASSWORD_POLICY_MESSAGES.reasons, ...messages?.reasons } }
  const [inner, setInner] = React.useState(() => sanitizePolicy(defaultValue))
  const policy = value ? sanitizePolicy(value) : inner
  const findings = auditPasswordPolicy(policy)
  const results = trySamples(policy, Array.isArray(samples) ? samples.filter((s) => typeof s === "string").slice(0, 6) : [])
  const [pending, setPending] = React.useState(false)
  const [saved, setSaved] = React.useState(false)
  const [status, setStatus] = React.useState("")
  const [spoken, setSpoken] = React.useState("")
  const version = React.useRef(0)
  const busy = React.useRef(false)
  const rootRef = React.useRef<HTMLDivElement>(null)
  const id = React.useId()
  const shallCount = findings.filter((f) => f.level === "shall").length

  React.useEffect(() => {
    const timer = setTimeout(() => setSpoken(status), 500)
    return () => clearTimeout(timer)
  }, [status])

  const update = (patch: Partial<PasswordPolicy>) => {
    const next = sanitizePolicy({ ...policy, ...patch })
    version.current++
    setSaved(false)
    setStatus("")
    if (!value) setInner(next)
    onValueChange?.(next)
    return next
  }

  const focusAfterFix = (fixed: FindingId, next: PasswordPolicy) => {
    const order = findings.map((f) => f.id)
    const remaining = auditPasswordPolicy(next).map((f) => f.id)
    const after = order.slice(order.indexOf(fixed) + 1).find((f) => remaining.includes(f)) ?? remaining[0]
    requestAnimationFrame(() => {
      const target = after ? rootRef.current?.querySelector<HTMLElement>(`[data-fix="${after}"]`) : rootRef.current?.querySelector<HTMLElement>("[data-summary]")
      target?.focus()
    })
  }

  const fixOne = (target: PolicyFinding) => {
    const next = update(target.fix)
    setStatus(auditPasswordPolicy(next).length ? "" : t.summaryGood)
    focusAfterFix(target.id, next)
  }

  const applyNist = () => {
    update({ ...NIST_POLICY, mfaRequired: policy.mfaRequired, minLength: Math.max(policy.mfaRequired ? 8 : 15, Math.min(policy.minLength, 64)) })
    setStatus(t.applied)
    requestAnimationFrame(() => rootRef.current?.querySelector<HTMLElement>("[data-summary]")?.focus())
  }

  const save = async () => {
    if (!onSave || busy.current || findings.some((f) => f.id === "max-below-min")) return
    const at = version.current
    busy.current = true
    setPending(true)
    try {
      await onSave(policy)
      if (at === version.current) { setSaved(true); setStatus(t.saved) }
    } catch {
      // The caller reports failures; Save works again.
    } finally {
      busy.current = false
      setPending(false)
    }
  }

  const findingFor = (field: keyof PasswordPolicy) => findings.filter((f) => FIELD_OF[f.id] === field)
  const finding = (field: keyof PasswordPolicy) => (
    <>
      {findingFor(field).map((f) => (
        <p key={f.id} id={`${id}-${f.id}`} className={cn("mt-1.5 flex flex-wrap items-start gap-x-2 gap-y-1 text-xs", f.level === "shall" ? "text-red-700 dark:text-red-400" : "text-amber-700 dark:text-amber-400")}>
          <span className="flex min-w-48 flex-1 gap-1.5">
            <ShieldAlert aria-hidden className="mt-px size-3.5 shrink-0" />
            <span className="min-w-0"><span className="font-medium">{f.level === "shall" ? t.shall : t.should} </span>{fill(t.findings[f.id], { days: policy.expiryDays })}</span>
          </span>
          <button type="button" data-fix={f.id} onClick={() => fixOne(f)} className={cn(fixClass, f.level === "shall" ? "border-red-500/40 text-red-800 hover:bg-red-500/10 dark:text-red-200" : "border-amber-500/40 text-amber-900 hover:bg-amber-500/10 dark:text-amber-200")}>{t.fix}</button>
        </p>
      ))}
    </>
  )
  const described = (field: keyof PasswordPolicy) => findingFor(field).map((f) => `${id}-${f.id}`).join(" ") || undefined

  const numberField = (field: "minLength" | "maxLength" | "expiryDays" | "maxFailedAttempts", label: string, wide = false) => (
    <div className={cn("min-w-0", wide && "sm:col-span-2")}>
      <label htmlFor={`${id}-${field}`} className="text-sm font-medium">{label}</label>
      <input
        id={`${id}-${field}`} type="number" inputMode="numeric" min={0} value={policy[field]}
        onChange={(e) => update({ [field]: e.target.value === "" ? 0 : Number(e.target.value) })}
        aria-invalid={findingFor(field).some((f) => f.level === "shall") || undefined} aria-describedby={described(field)}
        className={cn(inputClass, "mt-1.5")}
      />
      {finding(field)}
    </div>
  )

  const toggle = (field: "mfaRequired" | "breachCheck" | "allowPaste" | "securityQuestions" | "passwordHints") => (
    <div key={field} className="min-w-0">
      <label className="flex items-center justify-between gap-3 text-sm">
        <span>{t[field]}</span>
        <input type="checkbox" role="switch" checked={policy[field]} onChange={(e) => update({ [field]: e.target.checked })} aria-describedby={described(field)} className="size-4 shrink-0 accent-foreground outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50" />
      </label>
      {finding(field)}
    </div>
  )

  return (
    <div ref={rootRef} data-slot="password-policy-input" data-state={shallCount ? "breaks-nist" : findings.length ? "warning" : "ok"} className={cn("w-full max-w-md space-y-4 rounded-xl border bg-card p-4 text-sm text-card-foreground", className)} {...props}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold">{t.title}</p>
          <p data-summary tabIndex={-1} className={cn("mt-0.5 flex items-center gap-1.5 rounded-sm text-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50", findings.length ? "text-red-700 dark:text-red-400" : "text-emerald-700 dark:text-emerald-400")}>
            {findings.length ? <ShieldAlert aria-hidden className="size-3.5" /> : <CircleCheck aria-hidden className="size-3.5" />}
            {findings.length ? fill(t.summaryBad, { count: findings.length }) : t.summaryGood}
          </p>
          <p className="text-xs text-muted-foreground">{t.standard}</p>
        </div>
        {findings.length > 0 && (
          <button type="button" onClick={applyNist} className="inline-flex h-8 items-center gap-1.5 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground outline-none hover:bg-primary/90 focus-visible:ring-[3px] focus-visible:ring-ring/50">
            <Wand2 aria-hidden className="size-4" />{t.applyNist}
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {numberField("minLength", t.minLength)}
        {numberField("maxLength", t.maxLength)}
        <fieldset className="min-w-0 sm:col-span-2">
          <legend className="text-sm font-medium">{t.require}</legend>
          <div className="mt-1.5 flex flex-wrap gap-2">
            {(["requireUppercase", "requireLowercase", "requireDigit", "requireSymbol"] as const).map((field, i) => (
              <label key={field} className="inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-sm has-checked:border-red-500/50 has-checked:bg-red-500/5 has-focus-visible:ring-[3px] has-focus-visible:ring-ring/50">
                <input type="checkbox" checked={policy[field]} onChange={(e) => update({ [field]: e.target.checked })} aria-describedby={described("requireUppercase")} className="size-3.5 accent-foreground outline-none" />
                {[t.upper, t.lower, t.digit, t.symbol][i]}
              </label>
            ))}
          </div>
          {finding("requireUppercase")}
        </fieldset>
        {numberField("expiryDays", t.expiryDays, true)}
        {numberField("maxFailedAttempts", t.maxFailedAttempts, true)}
      </div>

      <div className="space-y-2.5 border-t pt-3">
        {(["mfaRequired", "breachCheck", "allowPaste", "securityQuestions", "passwordHints"] as const).map(toggle)}
      </div>

      {results.length > 0 && (
        <div className="space-y-1.5 rounded-md bg-muted/60 p-3">
          <p className="text-xs font-medium">{t.effectTitle}</p>
          <ul className="space-y-1">
            {results.map((r) => (
              <li key={r.password} className="flex items-start gap-2 text-xs">
                {r.accepted ? <Check aria-hidden className="mt-px size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" /> : <X aria-hidden className="mt-px size-3.5 shrink-0 text-muted-foreground" />}
                <span className="min-w-0 flex-1 [overflow-wrap:anywhere]">
                  <code className="font-mono">{r.password}</code>
                  <span className="text-muted-foreground"> · {r.accepted ? t.accepted : `${t.rejected}: ${r.reasons.map((x) => t.reasons[x]).join(", ")}`}</span>
                  {r.accepted && r.common && <span className="font-medium text-red-700 dark:text-red-400"> · {t.commonWarning}</span>}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {onSave && (
        <div className="flex justify-end">
          <button type="button" onClick={save} aria-disabled={pending || findings.some((f) => f.id === "max-below-min") || undefined} className="inline-flex h-9 items-center gap-2 rounded-md border px-4 text-sm font-medium outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-disabled:opacity-60 dark:bg-input/30">
            {pending && <Loader2 aria-hidden className="size-4 animate-spin" />}{saved ? t.saved : t.save}
          </button>
        </div>
      )}
      <span role="status" className="sr-only">{spoken}</span>
    </div>
  )
}
