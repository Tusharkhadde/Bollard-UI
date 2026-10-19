"use client"

// Bollard UI — upi-id-input · MIT licence · https://bollard-ui.vercel.app/components/upi-id-input

import * as React from "react"
import { BadgeCheck, CircleAlert, Link2, LoaderCircle, RotateCw, Smartphone, TriangleAlert } from "lucide-react"

import { cn } from "@/lib/utils"
import { findUpiIssue, normalizeUpiId, UPI_HANDLES, upiNamesMatch, type UpiHandleInfo } from "./upi"

export { findUpiIssue, normalizeUpiId, UPI_APP_ALIASES, UPI_HANDLES, upiNamesMatch, type UpiHandleInfo, type UpiIssue } from "./upi"

/** What a verification backend says about a UPI ID, e.g. Razorpay's validate/vpa `{ success, customer_name }`. */
export interface UpiVerification {
  valid: boolean
  /** The name registered to the ID. */
  name?: string
}

type Check = { vpa: string; state: "checking" } | { vpa: string; state: "done"; result: UpiVerification | null } | { vpa: string; state: "failed" }

export interface UpiIdInputProps extends Omit<React.ComponentProps<"input">, "value" | "defaultValue" | "onChange"> {
  /** Visible label. */
  label?: string
  /** Controlled UPI ID (cleaned). */
  value?: string
  /** Initial UPI ID when uncontrolled. */
  defaultValue?: string
  /** Called with the cleaned ID on every change; a pasted upi://pay link becomes its `pa`. */
  onValueChange?: (value: string) => void
  /** Asks your backend who the ID is registered to. Return null when it cannot confirm the ID. */
  verify?: (vpa: string, signal: AbortSignal) => Promise<UpiVerification | null>
  /** Called with the verification result, or null when the ID changes. */
  onVerifiedChange?: (result: UpiVerification | null) => void
  /** The name the user expects to pay; a different registered name is called out. */
  expectedName?: string
  /** Known handles. Defaults to Google Pay, PhonePe, Paytm, Amazon Pay, WhatsApp, BHIM and major banks. */
  handles?: Record<string, UpiHandleInfo>
  /** Pause in ms before warnings appear while typing. */
  delay?: number
  /** Override any visible string, e.g. to translate. */
  messages?: Partial<typeof UPI_ID_MESSAGES>
}

/** Every visible string. Templates: `{handle}`, `{count}`, `{name}`, `{id}`, `{app}` are filled in. */
export const UPI_ID_MESSAGES = {
  email: "That's an email address. UPI IDs end in a handle with no dot, like @oksbi.",
  "no-handle": "Add the app handle after the number, like @ybl or @okaxis.",
  "bad-chars": "A UPI ID has one @ and only letters, digits, dots, dashes or underscores.",
  typo: "Looks like a typo in the handle.",
  "app-name": "That's the app's name, not its handle. Ask the payee which one theirs ends in:",
  "phone-code": "Drop the country code or 0: mobile UPI IDs use the 10-digit number.",
  "phone-length": "Mobile numbers have 10 digits; this has {count}.",
  unknown: "@{handle} isn't a handle we know. It may be new; check it with the payee.",
  useId: "Use {id}",
  fromLink: "From a payment link that says it's for {name}",
  handleIs: "@{handle} is {app}",
  checking: "Checking who this ID belongs to…",
  checkFailed: "Couldn't check this ID.",
  notChecked: "This ID wasn't checked against a live directory.",
  retry: "Retry",
  notFound: "No account uses this UPI ID. Check each letter with the payee.",
  registeredTo: "Registered to {name}.",
  exists: "This UPI ID exists.",
  notExpected: "Not {name}. Make sure this is who you mean to pay.",
  notOnLink: "Not {name}, the name on the link. Make sure this is who you mean to pay.",
}

/** Fills `{key}` slots; a slot can take a node so names stay bold. */
function fill(template: string, values: Record<string, React.ReactNode>) {
  return template.split(/(\{\w+\})/).map((part, i) => {
    const key = part.match(/^\{(\w+)\}$/)?.[1]
    return key && key in values ? <React.Fragment key={i}>{values[key]}</React.Fragment> : part
  })
}

const field =
  "h-9 w-full min-w-0 rounded-md border bg-transparent px-3 text-base shadow-xs transition-[color,box-shadow] outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-destructive md:text-sm dark:bg-input/30 data-warning:border-amber-500 dark:data-warning:border-amber-400"
const fix =
  "inline-flex h-6 items-center gap-1 rounded-md border border-amber-500/40 px-2 font-medium whitespace-nowrap text-amber-900 transition-colors hover:bg-amber-500/10 dark:text-amber-200 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
const reveal = "motion-safe:animate-[cui-upi-id-input-reveal_250ms_ease-out]"
const BLOCKING = ["email", "no-handle", "bad-chars", "phone-length", "typo", "app-name"]

/**
 * A UPI ID field that stops money going to a typo'd or wrong VPA. It cleans what's
 * typed or pasted (even a whole upi://pay link), catches emails, typo'd handles
 * (@okaxsi), app names typed as handles (@gpay), wrong-length phone IDs and retired
 * handles, then reads back the registered name from a pluggable check before paying,
 * flagging a name that differs from the one expected or the one the link claimed.
 */
export function UpiIdInput({
  label = "UPI ID",
  value,
  defaultValue = "",
  onValueChange,
  verify,
  onVerifiedChange,
  expectedName,
  handles = UPI_HANDLES,
  delay = 600,
  messages,
  id,
  className,
  onBlur,
  ref,
  ...props
}: UpiIdInputProps) {
  const t = { ...UPI_ID_MESSAGES, ...messages }
  const [inner, setInner] = React.useState(() => normalizeUpiId(defaultValue).vpa)
  const [linkName, setLinkName] = React.useState(() => normalizeUpiId(defaultValue).linkName)
  const [settled, setSettled] = React.useState(inner)
  const [check, setCheck] = React.useState<Check>()
  const [attempt, setAttempt] = React.useState(0)
  const autoId = React.useId()
  const inputId = id ?? autoId
  const vpa = value ?? inner
  const ready = settled === vpa
  const issue = ready ? findUpiIssue(vpa, handles) : null
  const at = vpa.lastIndexOf("@")
  const local = at > 0 ? vpa.slice(0, at) : ""
  const handle = handles[vpa.slice(at + 1)]
  const checkable = ready && at > 0 && at < vpa.length - 1 && !(issue && BLOCKING.includes(issue.kind))
  const verifyRef = React.useRef(verify)
  const changeRef = React.useRef(onVerifiedChange)
  React.useEffect(() => {
    verifyRef.current = verify
    changeRef.current = onVerifiedChange
  })

  React.useEffect(() => {
    const timer = setTimeout(() => setSettled(vpa), delay)
    return () => clearTimeout(timer)
  }, [vpa, delay])

  React.useEffect(() => {
    if (!checkable || !verifyRef.current) return
    const controller = new AbortController()
    setCheck({ vpa, state: "checking" })
    verifyRef.current(vpa, controller.signal).then(
      (result) => {
        if (controller.signal.aborted) return
        setCheck({ vpa, state: "done", result })
        changeRef.current?.(result)
      },
      () => !controller.signal.aborted && setCheck({ vpa, state: "failed" })
    )
    return () => controller.abort()
  }, [vpa, checkable, attempt])

  /** `fixing` keeps the payment link's name when a one-tap fix edits its ID. */
  const update = (raw: string, now = false, fixing = false) => {
    const { vpa: next, linkName: name } = normalizeUpiId(raw)
    if (!fixing) setLinkName(/^upi:/i.test(raw.trim()) ? name : undefined)
    if (value === undefined) setInner(next)
    if (now) setSettled(next)
    if (next !== vpa) changeRef.current?.(null)
    onValueChange?.(next)
  }

  const current = check?.vpa === vpa ? check : undefined
  const result = current?.state === "done" ? current.result : undefined
  const expected = expectedName?.trim() || linkName
  const nameDiffers = result?.valid && result.name && expected && !upiNamesMatch(expected, result.name)
  const isPhone = /^[6-9]\d{9}$/.test(local)
  const line = (icon: React.ReactNode, text: React.ReactNode, actions?: React.ReactNode, tone = "text-amber-700 dark:text-amber-400") => (
    <p className={cn("flex gap-1.5", tone)}>
      <span className="flex h-6 shrink-0 items-center">{icon}</span>
      <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1"><span className="py-1">{text}</span>{actions}</span>
    </p>
  )
  const warn = <TriangleAlert aria-hidden className="size-3.5" />
  const strong = (text: string) => <span className="font-medium text-foreground">{text}</span>
  const issueText = (i: NonNullable<typeof issue>) =>
    i.kind === "phone-length"
      ? i.fix ? t["phone-code"] : fill(t["phone-length"], { count: local.replace(/\D/g, "").length })
      : i.kind === "unknown" ? fill(t.unknown, { handle: vpa.slice(at + 1) }) : t[i.kind]

  return (
    <div data-slot="upi-id-input" className={cn("grid w-full max-w-sm gap-1.5", className)}>
      <style>{`@keyframes cui-upi-id-input-reveal{from{opacity:0;transform:translateY(-4px)}}`}</style>
      <label htmlFor={inputId} className="w-fit text-sm font-medium">{label}</label>
      <input
        ref={ref}
        id={inputId}
        type="text"
        inputMode="email"
        autoComplete="off"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        placeholder="name@okaxis"
        value={vpa}
        onChange={(e) => update(e.target.value)}
        onPaste={(e) => {
          const text = e.clipboardData.getData("text")
          if (/^upi:/i.test(text.trim())) {
            e.preventDefault()
            update(text, true)
          }
        }}
        onBlur={(e) => {
          setSettled(vpa)
          onBlur?.(e)
        }}
        aria-describedby={`${inputId}-status`}
        aria-invalid={result?.valid === false || undefined}
        data-warning={(issue && issue.kind !== "unknown") || nameDiffers ? "" : undefined}
        className={field}
        {...props}
      />
      <div id={`${inputId}-status`} aria-live="polite" className="grid min-h-6 gap-1 text-xs">
        {linkName && line(<Link2 aria-hidden className="size-3.5" />, fill(t.fromLink, { name: strong(linkName) }), null, "text-muted-foreground")}
        {issue &&
          line(warn, issueText(issue), (
            <>
              {"suggestions" in issue && issue.suggestions.map((h) => (
                <button key={h} type="button" onClick={() => update(`${local}@${h}`, true, true)} aria-label={t.useId.replace("{id}", `${local}@${h}`)} className={fix}>@{h}</button>
              ))}
              {issue.kind === "phone-length" && issue.fix && <button type="button" onClick={() => update(issue.fix!, true, true)} className={fix}>{fill(t.useId, { id: issue.fix.split("@")[0] })}</button>}
            </>
          ), issue.kind === "unknown" ? "text-muted-foreground" : undefined)}
        {!issue && ready && handle && (
          <p className="flex flex-wrap items-center gap-x-2 py-1 text-muted-foreground">
            {isPhone && <span className="inline-flex items-center gap-1 tabular-nums"><Smartphone aria-hidden className="size-3.5" />{local.slice(0, 5)} {local.slice(5)} ·</span>}
            <span>{fill(t.handleIs, { handle: vpa.slice(at + 1), app: `${handle.app}${handle.bank && handle.bank !== handle.app ? ` (${handle.bank})` : ""}` })}</span>
          </p>
        )}
        {!issue && ready && handle?.note && line(warn, handle.note)}
        {current?.state === "checking" && line(<LoaderCircle aria-hidden className="size-3.5 animate-spin" />, t.checking, null, "text-muted-foreground motion-safe:animate-pulse")}
        {current?.state === "failed" && line(warn, t.checkFailed, <button type="button" onClick={() => setAttempt((n) => n + 1)} className={fix}><RotateCw aria-hidden className="size-3" /> {t.retry}</button>)}
        {current?.state === "done" && current.result === null && line(<CircleAlert aria-hidden className="size-3.5" />, t.notChecked, null, "text-muted-foreground")}
        {result?.valid === false && (
          <div role="alert" className={cn("flex gap-2 rounded-md border border-red-500/30 bg-red-500/10 px-2.5 py-2 text-sm text-red-900 dark:text-red-100", reveal)}>
            <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0 text-red-600 dark:text-red-400" />
            <p>{t.notFound}</p>
          </div>
        )}
        {result?.valid && (
          <div className={cn("flex gap-2 rounded-md border px-2.5 py-2 text-sm", nameDiffers ? "border-amber-500/40 bg-amber-500/10" : "border-emerald-600/30 bg-emerald-500/10", reveal)}>
            {nameDiffers ? <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" /> : <BadgeCheck aria-hidden className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />}
            <p>
              {result.name ? fill(t.registeredTo, { name: <span className="font-medium">{result.name}</span> }) : t.exists}
              {nameDiffers && <> {fill(linkName && !expectedName ? t.notOnLink : t.notExpected, { name: <span className="font-medium">{expected}</span> })}</>}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
