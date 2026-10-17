"use client"

// Bollard UI — bcc-guard · MIT licence · https://bollard-ui.vercel.app/components/bcc-guard

import * as React from "react"
import NumberFlow from "@number-flow/react"
import { EyeOff, Loader2, Send, ShieldCheck, Undo2, Users } from "lucide-react"
import { AnimatePresence, animate, motion, useReducedMotion } from "motion/react"

import { cn } from "@/lib/utils"

import { analyseExposure, moveOutsideToBcc, parseRecipient, type Recipients } from "./exposure"

export {
  analyseExposure,
  DEFAULT_SENSITIVE_TERMS,
  findSensitiveTerms,
  moveOutsideToBcc,
  parseRecipient,
  PERSONAL_DOMAINS,
  type Exposure,
  type ParsedRecipient,
  type Recipients,
} from "./exposure"

export const BCC_GUARD_MESSAGES = {
  seenBy: "What {viewer} will see",
  someone: "each recipient",
  more: "+{count} more",
  bccOnly: "Bcc: you",
  exposed: "people outside see each other's addresses",
  names: "by name",
  personal: "private addresses",
  orgs: "companies",
  sensitive: "Being on this list says something about them: {terms}.",
  icoAdvice: "For lists like this the ICO says Bcc alone isn't enough: send each person their own email (mail merge or a bulk-email service).",
  move: "Move {count} to Bcc|Move all {count} to Bcc",
  each: "Send one email each",
  moved: "Moved {count} outside recipient to Bcc.|Moved {count} outside recipients to Bcc.",
  undo: "Undo",
  safe: "Outside recipients only see themselves and you.",
  send: "Send",
  sendExposed: "Send with {count} address showing|Send with {count} addresses showing",
  confirm: "Everyone on this email will see the others. Press again to send it anyway.",
  sending: "Sending…",
  status: "{count} outside recipients would see each other's addresses.",
}

type Messages = typeof BCC_GUARD_MESSAGES

export interface BccGuardProps extends Omit<React.ComponentProps<"section">, "children" | "defaultValue" | "onChange"> {
  /** Controlled recipients. */
  value?: Recipients
  /** Initial recipients when uncontrolled. */
  defaultValue?: Recipients
  /** Fires with the new recipients after a fix or an undo. */
  onValueChange?: (value: Recipients) => void
  /** Your own organisation's domains; colleagues there may see each other. */
  internalDomains?: string[]
  /** The sender's address. When every recipient moves to Bcc it fills the empty To line. */
  from?: string
  /** Subject and body, scanned for terms that make the list itself sensitive. */
  subject?: string
  /** Email body, scanned for sensitive terms. */
  body?: string
  /** Terms that make membership of the list sensitive. Replaces the default list; spread DEFAULT_SENSITIVE_TERMS to extend it. */
  sensitiveTerms?: string[]
  /** How many outside organisations seeing each other counts as exposed (default 3; 2 on a sensitive email). */
  exposeAt?: number
  /** Sends the email. `individually` asks for one message per recipient. May return a Promise. */
  onSend?: (value: Recipients, mode: "together" | "individually") => void | Promise<void>
  /** Addresses shown in the preview before "+N more". Default 3. */
  previewCount?: number
  /** Override any visible string. */
  messages?: Partial<Messages>
}

const fill = (t: string, v: Record<string, string | number>) =>
  (t.includes("|") ? t.split("|")[Number(v.count) === 1 ? 0 : 1] : t).replace(/\{(\w+)\}/g, (k, key: string) => String(v[key] ?? k))
const EMPTY: Recipients = { to: [], cc: [], bcc: [] }
const chip =
  "inline-flex h-8 items-center gap-1.5 rounded-md border bg-background px-3 text-sm font-medium shadow-xs outline-none transition-colors hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-60 dark:bg-input/30"

/**
 * Stops a group email exposing everyone on it (56 Dean Street's HIV newsletter put 781 addresses in To,
 * 730 of them carrying full names: a £180,000 ICO fine). It shows the To line exactly as one recipient
 * will see it, counts the organisations and names that line gives away, flags when being on the list is
 * itself sensitive and offers one email each, moves every outside recipient to Bcc in one tap with Undo,
 * and asks for a second press to send while addresses still show.
 */
export function BccGuard({
  value: valueProp, defaultValue, onValueChange, internalDomains, from, subject, body, sensitiveTerms, exposeAt, onSend,
  previewCount = 3, messages, className, ...props
}: BccGuardProps) {
  const m = { ...BCC_GUARD_MESSAGES, ...messages }
  const [inner, setInner] = React.useState<Recipients>(defaultValue ?? EMPTY)
  const value = valueProp ?? inner
  const [undo, setUndo] = React.useState<{ before: Recipients; count: number } | null>(null)
  const [armed, setArmed] = React.useState(false)
  const [sending, setSending] = React.useState(false)
  const [status, setStatus] = React.useState("")
  const rootRef = React.useRef<HTMLElement>(null)
  const sendRef = React.useRef<HTMLButtonElement>(null)
  const moveRef = React.useRef<HTMLButtonElement>(null)
  const reduce = useReducedMotion()
  const id = React.useId()

  const x = React.useMemo(
    () => analyseExposure(value, { internalDomains, subject, body, sensitiveTerms, exposeAt, from }),
    [value, internalDomains, subject, body, sensitiveTerms, exposeAt, from],
  )
  const visible = [...(value.to ?? []), ...(value.cc ?? [])].map(parseRecipient).filter((r) => r.address)
  const viewer = x.outside[0]
  const risky = x.exposed
  const warn = armed && risky

  const set = (next: Recipients) => {
    if (valueProp === undefined) setInner(next)
    onValueChange?.(next)
  }

  // A second press only confirms the list it was armed on; any change to who's exposed asks again.
  React.useEffect(() => setArmed(false), [x.outside.length, x.exposed])

  React.useEffect(() => {
    const t = setTimeout(() => setStatus(risky ? fill(m.status, { count: x.outside.length }) : ""), 500)
    return () => clearTimeout(t)
  }, [risky, x.outside.length, m.status])

  const move = () => {
    setUndo({ before: value, count: x.outside.length })
    set(moveOutsideToBcc(value, internalDomains, from))
    setArmed(false)
    requestAnimationFrame(() => sendRef.current?.focus())
  }

  const restore = () => {
    if (!undo) return
    set(undo.before)
    setUndo(null)
    requestAnimationFrame(() => moveRef.current?.focus())
  }

  const send = async (mode: "together" | "individually") => {
    if (sending) return
    if (mode === "together" && risky && !armed) {
      setArmed(true)
      if (!reduce && sendRef.current) animate(sendRef.current, { x: [0, -5, 5, -3, 0] }, { duration: 0.3 })
      return
    }
    setSending(true)
    try {
      await onSend?.(value, mode)
    } catch {
      // The caller shows its own error; the button becomes usable again.
    } finally {
      setSending(false)
      setArmed(false)
    }
  }

  const shown = visible.slice(0, previewCount)
  const rest = visible.length - shown.length

  return (
    <section
      ref={rootRef}
      data-slot="bcc-guard"
      data-state={risky ? "exposed" : "safe"}
      aria-labelledby={`${id}-seen`}
      className={cn("grid w-full min-w-0 gap-3 text-sm", className)}
      {...props}
    >
      <div className={cn("grid min-w-0 gap-2 rounded-md border p-3 transition-colors", risky ? "border-red-500/40 bg-red-500/5 dark:bg-red-500/10" : "bg-muted/40")}>
        <p id={`${id}-seen`} className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <EyeOff aria-hidden className="size-3.5" />
          {fill(m.seenBy, { viewer: viewer?.name ?? viewer?.address ?? m.someone })}
        </p>
        <div className="flex min-w-0 flex-wrap items-center gap-1 font-mono text-xs">
          <span className="text-muted-foreground">To:</span>
          <AnimatePresence initial={false} mode="popLayout">
            {shown.map((r) => (
              <motion.span
                key={r.address}
                layout={!reduce}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0, scale: reduce ? 1 : 0.9 }}
                className={cn("max-w-full truncate rounded-sm px-1.5 py-0.5", x.outside.some((o) => o.address === r.address) ? "bg-red-500/10 text-red-800 dark:text-red-300" : "bg-background")}
              >
                {r.address}
              </motion.span>
            ))}
          </AnimatePresence>
          {rest > 0 && <span className="text-muted-foreground">{fill(m.more, { count: rest.toLocaleString("en-US") })}</span>}
        </div>
        {value.bcc.length > 0 && !risky && <p className="font-mono text-xs text-muted-foreground">{m.bccOnly}</p>}

        {risky ? (
          <p className="text-sm">
            <Users aria-hidden className="mr-1.5 inline size-4 align-[-3px] text-red-600 dark:text-red-400" />
            <strong className="font-semibold tabular-nums"><NumberFlow value={x.outside.length} /></strong> {m.exposed}:{" "}
            {[
              [x.names, m.names],
              [x.personal, m.personal],
              [x.companies, m.orgs],
            ]
              .filter(([n]) => Number(n) > 0)
              .map(([n, label], i, all) => (
                <React.Fragment key={String(label)}>
                  <span className="tabular-nums"><NumberFlow value={Number(n)} /></span> {label}
                  {i < all.length - 1 ? ", " : "."}
                </React.Fragment>
              ))}
          </p>
        ) : (
          x.outside.length + value.bcc.length > 0 && (
            <p className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400">
              <ShieldCheck aria-hidden className="size-4 shrink-0" />
              {m.safe}
            </p>
          )
        )}

        {x.sensitive.length > 0 && x.outside.length + value.bcc.length > 1 && (
          <div className="grid gap-0.5 text-xs">
            <p className="font-medium text-foreground">{fill(m.sensitive, { terms: x.sensitive.map((t) => `“${t}”`).join(", ") })}</p>
            <p className="text-muted-foreground">{m.icoAdvice}</p>
          </div>
        )}
      </div>

      <AnimatePresence initial={false}>
        {undo && !risky && (
          <motion.p
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground"
          >
            {fill(m.moved, { count: undo.count })}
            <button type="button" onClick={restore} className="inline-flex h-7 items-center gap-1 rounded-md px-2 font-medium text-foreground outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50">
              <Undo2 aria-hidden className="size-3.5" />
              {m.undo}
            </button>
          </motion.p>
        )}
      </AnimatePresence>

      <div className="flex flex-wrap items-center gap-2">
        {risky && (
          <button ref={moveRef} type="button" onClick={move} className={chip}>
            {fill(m.move, { count: x.outside.length.toLocaleString("en-US") })}
          </button>
        )}
        {onSend && x.sensitive.length > 0 && x.outside.length + value.bcc.length > 1 && (
          <button type="button" disabled={sending} onClick={() => send("individually")} className={chip}>
            {m.each}
          </button>
        )}
        {onSend && (
          <button
            ref={sendRef}
            type="button"
            disabled={sending}
            aria-describedby={warn ? `${id}-confirm` : undefined}
            onClick={() => send("together")}
            className={cn(
              "inline-flex h-8 max-w-full items-center gap-1.5 rounded-md px-3 text-sm font-medium shadow-xs outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-60",
              warn ? "bg-destructive text-white hover:bg-destructive/90" : "bg-primary text-primary-foreground hover:bg-primary/90",
            )}
          >
            {sending ? <Loader2 aria-hidden className="size-4 animate-spin" /> : <Send aria-hidden className="size-4" />}
            <span className="truncate">{sending ? m.sending : warn ? fill(m.sendExposed, { count: x.outside.length.toLocaleString("en-US") }) : m.send}</span>
          </button>
        )}
      </div>
      {warn && (
        <p id={`${id}-confirm`} role="alert" className="-mt-1 text-xs text-amber-700 dark:text-amber-400">
          {m.confirm}
        </p>
      )}
      <span role="status" className="sr-only">{status}</span>
    </section>
  )
}
