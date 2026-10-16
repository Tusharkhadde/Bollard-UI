"use client"

import * as React from "react"
import { CircleCheck, Cloud, KeyRound, LoaderCircle, ShieldAlert, Smartphone, TriangleAlert } from "lucide-react"

import { cn } from "@/lib/utils"
import { checkPasskeyName, describeDevice, isDuplicateName, nextFreeName, passkeyLocation, passkeyProvider, suggestPasskeyName, type PasskeyProvider } from "./passkey-name"

export * from "./passkey-name"

/** Default text. `{name}`, `{suggestion}`, `{free}`, `{max}`, `{provider}`, `{device}` are filled in. */
export const PASSKEY_NAME_MESSAGES = {
  title: "Passkey created",
  description: "Name it so you can tell it apart from your other passkeys later.",
  label: "Passkey name",
  help: "Shown in your security settings and in new sign-in alerts.",
  empty: "Without a name it shows up as just “Passkey”.",
  duplicate: "You already have a passkey called “{name}”, so you couldn't tell them apart.",
  long: "Keep it under {max} characters so it fits in lists.",
  generic: "“{name}” won't tell it apart from your others. Say where it lives.",
  use: "Use “{suggestion}”",
  useFree: "Use “{free}”",
  shorten: "Shorten it",
  synced: "Syncs through {provider} to your other devices.",
  syncedUnknown: "Syncs to your other devices through your password manager.",
  deviceBound: "Only on this {device}. Add a passkey on another device too, so losing this one doesn't lock you out.",
  thisDevice: "device",
  phoneDevice: "phone",
  securityKeyDevice: "security key",
  fallbackName: "Passkey",
  securityKeyName: "Security key",
  hybridName: "Passkey on your phone",
  others: "Your other passkeys",
  save: "Save name",
  saving: "Saving…",
  saved: "Saved as “{name}”.",
  skip: "Skip",
  saveError: "Couldn't save the name. Try again.",
}

export type PasskeyNameMessages = typeof PASSKEY_NAME_MESSAGES

const fill = (s: string, d: Record<string, string | number>) => s.replace(/\{(\w+)\}/g, (m, k: string) => String(d[k] ?? m))
const button = "inline-flex h-9 items-center justify-center gap-1.5 rounded-md px-4 text-sm font-medium transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50"

export interface PasskeyNamePromptProps extends Omit<React.ComponentProps<"input">, "value" | "defaultValue" | "onChange"> {
  /** The new credential's AAGUID, from the registration response. Names syncing managers like iCloud Keychain or 1Password. */
  aaguid?: string
  /** User agent to describe the device. Read from the browser after mount when omitted. */
  userAgent?: string
  /** `authenticatorAttachment` from the response: "cross-platform" without a known AAGUID reads as a security key. */
  attachment?: "platform" | "cross-platform"
  /** `response.getTransports()`. "hybrid" (made on a phone over a QR code) stops the name and notes describing this computer. */
  transports?: string[]
  /** The backup-eligible (BE) flag. true: it syncs; false: it lives on this device only. Omit when unknown. */
  backupEligible?: boolean
  /** Names of the user's other passkeys, to keep the new name distinct. */
  existingNames?: string[]
  /** Extra AAGUID → provider entries, merged over the built-in table. */
  providers?: Record<string, PasskeyProvider>
  /** Controlled name. Defaults to the suggestion until the user edits it. */
  value?: string
  /** Initial name when uncontrolled. Defaults to the suggestion. */
  defaultValue?: string
  onValueChange?: (value: string) => void
  /** Saves the name. May return a Promise; the button shows a pending state and a rejection shows an error. */
  onSave?: (name: string) => void | Promise<void>
  /** Shows a Skip button. Called with the suggestion so the passkey is never left as just "Passkey". */
  onSkip?: (suggestion: string) => void
  /** Longest name allowed. */
  maxLength?: number
  /** Pause in ms before warnings appear while typing. */
  delay?: number
  /** Override any visible or announced text. */
  messages?: Partial<PasskeyNameMessages>
}

/**
 * Shown right after a passkey is created. Prefills a name that tells it apart
 * (the syncing manager from its AAGUID, or "Mac · Chrome" from the device),
 * numbers it when that name is taken, and warns about empty, duplicate and
 * generic names before they end up as five identical "Passkey" rows. It also
 * says whether the passkey syncs or lives on this device only.
 */
export function PasskeyNamePrompt({
  aaguid,
  userAgent,
  attachment,
  transports,
  backupEligible,
  existingNames = [],
  providers,
  value,
  defaultValue,
  onValueChange,
  onSave,
  onSkip,
  maxLength = 64,
  delay = 400,
  messages,
  id,
  className,
  onFocus,
  onBlur,
  ref,
  "aria-describedby": describedBy,
  ...props
}: PasskeyNamePromptProps) {
  const t = { ...PASSKEY_NAME_MESSAGES, ...messages }
  const [agent, setAgent] = React.useState<{ ua: string; touch: number } | null>(null)
  React.useEffect(() => {
    if (userAgent === undefined) setAgent({ ua: navigator.userAgent, touch: navigator.maxTouchPoints ?? 0 })
  }, [userAgent])
  const ua = userAgent ?? agent?.ua ?? ""
  const touch = agent?.touch ?? 0
  const suggestion = suggestPasskeyName({ aaguid, userAgent: ua, touchPoints: touch, attachment, transports, existing: existingNames, providers, fallback: t.fallbackName, securityKey: t.securityKeyName, hybrid: t.hybridName })
  const [inner, setInner] = React.useState<string | null>(defaultValue ?? null)
  const name = value ?? inner ?? suggestion
  const [settled, setSettled] = React.useState(name)
  const [state, setState] = React.useState<{ status: "idle" | "pending" | "saved" | "failed"; forced?: boolean }>({ status: "idle" })
  const inputRef = React.useRef<HTMLInputElement>(null)
  const selected = React.useRef(false)
  const autoId = React.useId()
  const inputId = id ?? autoId
  React.useImperativeHandle(ref, () => inputRef.current as HTMLInputElement)

  React.useEffect(() => {
    const timer = setTimeout(() => setSettled(name), delay)
    return () => clearTimeout(timer)
  }, [name, delay])

  const update = (next: string, settle = false) => {
    if (value === undefined) setInner(next)
    if (settle) setSettled(next)
    setState({ status: "idle" })
    onValueChange?.(next)
  }
  const applyFix = (next: string) => {
    update(next, true)
    inputRef.current?.focus()
  }

  const visible = settled === name || state.forced ? checkPasskeyName(name, existingNames, maxLength) : undefined
  const blocking = visible === "empty" || visible === "duplicate" || visible === "long"
  const free = nextFreeName(name || suggestion, existingNames)
  const provider = passkeyProvider(aaguid, providers)
  const location = passkeyLocation(attachment, transports)
  const device = location === "phone" ? t.phoneDevice : location === "security-key" && provider?.kind !== "manager" ? t.securityKeyDevice : describeDevice(ua, touch).device

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    // Enter in the field submits too, so a save in flight must not start a second one.
    if (state.status === "pending") return
    const problem = checkPasskeyName(name, existingNames, maxLength)
    if (problem && problem !== "generic") {
      setSettled(name)
      setState({ status: "idle", forced: true })
      inputRef.current?.focus()
      return
    }
    setState({ status: "pending" })
    try {
      await onSave?.(name.trim())
      setState({ status: "saved" })
    } catch {
      setState({ status: "failed" })
    }
  }

  const message = visible === "empty" ? t.empty : visible === "duplicate" ? fill(t.duplicate, { name: name.trim() }) : visible === "long" ? fill(t.long, { max: maxLength }) : visible === "generic" ? fill(t.generic, { name: name.trim() }) : ""
  const fix = visible === "duplicate" ? { label: fill(t.useFree, { free }), next: free }
    : visible === "long" ? { label: t.shorten, next: name.trim().slice(0, maxLength).trim() }
    : visible && suggestion !== name.trim() ? { label: fill(t.use, { suggestion }), next: suggestion } : null

  return (
    <form data-slot="passkey-name-prompt" onSubmit={submit} noValidate className={cn("grid w-full max-w-sm min-w-0 gap-3 rounded-xl border bg-card p-4 text-sm text-card-foreground shadow-xs", className)}>
      <div className="flex items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"><KeyRound aria-hidden className="size-4" /></span>
        <div className="grid min-w-0 gap-0.5">
          <p className="font-medium">{t.title}</p>
          <p className="text-muted-foreground">{t.description}</p>
        </div>
      </div>
      <div className="grid gap-1.5">
        <label htmlFor={inputId} className="w-fit font-medium">{t.label}</label>
        <input
          ref={inputRef}
          id={inputId}
          value={name}
          autoComplete="off"
          spellCheck={false}
          onChange={(e) => update(e.target.value)}
          onFocus={(e) => {
            // The first focus selects the suggestion, so typing replaces it and Enter keeps it.
            if (!selected.current) e.currentTarget.select()
            selected.current = true
            onFocus?.(e)
          }}
          onBlur={(e) => {
            setSettled(name)
            onBlur?.(e)
          }}
          aria-invalid={(state.forced && blocking) || undefined}
          aria-describedby={[`${inputId}-status`, describedBy].filter(Boolean).join(" ")}
          data-warning={visible && !(state.forced && blocking) ? "" : undefined}
          className="h-9 w-full min-w-0 rounded-md border bg-transparent px-3 text-base shadow-xs transition-[color,box-shadow] outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-destructive md:text-sm dark:bg-input/30 data-warning:border-amber-500 dark:data-warning:border-amber-400"
          {...props}
        />
        <div id={`${inputId}-status`} aria-live="polite" className="min-h-6 text-xs">
          {visible ? (
            <p role={state.forced && blocking ? "alert" : undefined} className={cn("flex gap-1.5", state.forced && blocking ? "text-red-700 dark:text-red-400" : "text-amber-700 dark:text-amber-400")}>
              <span className="flex h-6 shrink-0 items-center">{state.forced && blocking ? <ShieldAlert aria-hidden className="size-3.5" /> : <TriangleAlert aria-hidden className="size-3.5" />}</span>
              <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                <span className="py-1 break-words">{message}</span>
                {fix && (
                  <button type="button" onClick={() => applyFix(fix.next)} className="inline-flex h-6 max-w-full items-center rounded-md border border-amber-500/40 px-2 font-medium text-amber-900 transition-colors outline-none hover:bg-amber-500/10 focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:text-amber-200">
                    <span className="truncate">{fix.label}</span>
                  </button>
                )}
              </span>
            </p>
          ) : state.status === "saved" ? (
            <p className="flex items-center gap-1.5 py-1 text-emerald-700 dark:text-emerald-400"><CircleCheck aria-hidden className="size-3.5" />{fill(t.saved, { name: name.trim() })}</p>
          ) : state.status === "failed" ? (
            <p role="alert" className="flex items-center gap-1.5 py-1 text-red-700 dark:text-red-400"><ShieldAlert aria-hidden className="size-3.5" />{t.saveError}</p>
          ) : (
            <p className="py-1 text-muted-foreground">{t.help}</p>
          )}
        </div>
      </div>
      {backupEligible !== undefined && (
        <p className={cn("flex gap-1.5 text-xs", backupEligible ? "text-muted-foreground" : "text-amber-700 dark:text-amber-400")}>
          {backupEligible ? <Cloud aria-hidden className="mt-px size-3.5 shrink-0" /> : <Smartphone aria-hidden className="mt-px size-3.5 shrink-0" />}
          {backupEligible
            ? provider?.kind === "manager" ? fill(t.synced, { provider: provider.name }) : t.syncedUnknown
            : fill(t.deviceBound, { device: device ?? t.thisDevice })}
        </p>
      )}
      {existingNames.length > 0 && (
        <div className="grid gap-1.5">
          <span className="text-xs text-muted-foreground">{t.others}</span>
          <ul className="flex flex-wrap gap-1.5">
            {existingNames.map((existing, i) => {
              const clash = visible === "duplicate" && isDuplicateName(existing, [name])
              return (
                <li key={`${existing}-${i}`} data-clash={clash || undefined} className={cn("max-w-full truncate rounded-md border px-2 py-0.5 text-xs", clash ? "border-amber-500/50 bg-amber-500/10 text-amber-900 dark:text-amber-200" : "text-muted-foreground")}>
                  {existing}
                </li>
              )
            })}
          </ul>
        </div>
      )}
      <div className="flex flex-wrap justify-end gap-2">
        {onSkip && (
          <button type="button" onClick={() => onSkip(suggestion)} disabled={state.status === "pending"} className={cn(button, "hover:bg-accent")}>{t.skip}</button>
        )}
        <button type="submit" disabled={state.status === "pending"} className={cn(button, "bg-primary text-primary-foreground hover:bg-primary/90")}>
          {state.status === "pending" && <LoaderCircle aria-hidden className="size-4 animate-spin" />}
          {state.status === "pending" ? t.saving : t.save}
        </button>
      </div>
    </form>
  )
}
