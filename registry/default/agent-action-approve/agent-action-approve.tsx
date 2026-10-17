"use client"

// Bollard UI — agent-action-approve · MIT licence · https://bollard-ui.vercel.app/components/agent-action-approve

import * as React from "react"
import { AlertTriangle, Ban, Check, Loader2, ShieldAlert, ShieldCheck, Terminal, X } from "lucide-react"
import { AnimatePresence, animate, motion, useReducedMotion } from "motion/react"

import { cn } from "@/lib/utils"

import { SCOPES, analyzeToolCall, type Risk, type Scope, type ToolCall, type Undo } from "./analyze"

export { SCOPES, analyzeToolCall, tokenize, tokenizeRaw, type Analysis, type Finding, type Risk, type Scope, type ToolCall, type Undo } from "./analyze"

export const AGENT_ACTION_APPROVE_MESSAGES = {
  says: "Agent says",
  does: "This will",
  mismatch: "Doesn't match",
  reach: "Reaches",
  undo: "Undo",
  risk: { low: "Low risk", medium: "Changes things", high: "Dangerous" } satisfies Record<Risk, string>,
  scope: { none: "Nothing", item: "One file", folder: "One folder", project: "This project", outside: "Outside the project", home: "Your home folder", drive: "A whole drive", remote: "Another server", prod: "Production" } satisfies Record<Scope, string>,
  undoLabel: { none: "Nothing to undo", easy: "Easy to undo", hard: "Hard to undo", never: "Can't be undone" } satisfies Record<Undo, string>,
  deny: "Deny",
  approve: "Approve once",
  hold: "Hold to approve",
  holding: "Keep holding…",
  holdHint: "Dangerous call: press and hold to approve.",
  tapped: "Hold the button down, don't tap it.",
  always: "Always allow…",
  alwaysTitle: "This saves a rule:",
  alwaysAlso: "It would also let through, without asking:",
  alwaysSave: "Save rule",
  cancel: "Cancel",
  refused: {
    wrapper: "No \"always\" for this: the command runs other code (npx, bash -c, sudo), so a rule could allow anything.",
    chain: "No \"always\" for chained commands: a rule for the first part would let the rest ride along.",
    irreversible: "No \"always\" for anything that can't be undone. Approve it once, each time.",
    empty: "",
  },
  approved: "Approved once",
  denied: "Denied",
  allowed: "Always allowed",
  failed: "That didn't go through. Try again.",
}

type Messages = typeof AGENT_ACTION_APPROVE_MESSAGES
export type AgentDecision = { type: "deny" } | { type: "once" } | { type: "always"; rule: string }

export interface AgentActionApproveProps extends Omit<React.ComponentProps<"div">, "children"> {
  /** The tool call the agent wants to make. Null or junk renders an empty, safe card. */
  call: ToolCall | null | undefined
  /** Hosts an upload may go to without a warning, e.g. ["api.github.com"]. */
  allowedHosts?: string[]
  /** How long a dangerous call must be held, in ms. Default 1200. */
  holdMs?: number
  /** Called with the decision. May return a Promise: buttons show a pending state and can't fire twice. */
  onDecision?: (decision: AgentDecision) => void | Promise<void>
  /** Override any visible string. */
  messages?: Partial<Omit<Messages, "risk" | "scope" | "undoLabel" | "refused">> & {
    risk?: Partial<Messages["risk"]>
    scope?: Partial<Messages["scope"]>
    undoLabel?: Partial<Messages["undoLabel"]>
    refused?: Partial<Messages["refused"]>
  }
}

const signature = (call: unknown, hosts: unknown) => {
  try {
    return JSON.stringify([call ?? null, hosts ?? null])
  } catch {
    return "unserializable"
  }
}
const btn = "relative inline-flex h-9 items-center justify-center gap-2 overflow-hidden rounded-md px-4 text-sm font-medium outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-60"
const RISK_TONE: Record<Risk, string> = {
  low: "border-emerald-500/40 text-emerald-700 dark:text-emerald-400",
  medium: "border-amber-500/40 text-amber-700 dark:text-amber-400",
  high: "border-red-500/50 bg-red-500/10 text-red-700 dark:text-red-400",
}

/**
 * Stops an AI agent's tool call from doing something nobody approved. It reads the call itself and says in
 * plain words what will happen, how far it reaches and whether it can be undone; marks the one token that
 * changes everything (a lone `\` that means the drive root, an unset `$VAR`, `../`); puts "agent says" beside
 * "this will" when they disagree; makes dangerous calls hold-to-approve; and shows what an "always allow"
 * rule would also let through, refusing it for wrappers, chains and anything irreversible.
 */
export function AgentActionApprove({ call, allowedHosts, holdMs = 1200, onDecision, messages, className, ...props }: AgentActionApproveProps) {
  const d = AGENT_ACTION_APPROVE_MESSAGES
  const m: Messages = {
    ...d,
    ...messages,
    risk: { ...d.risk, ...messages?.risk },
    scope: { ...d.scope, ...messages?.scope },
    undoLabel: { ...d.undoLabel, ...messages?.undoLabel },
    refused: { ...d.refused, ...messages?.refused },
  }
  // Keyed on content, so a parent that rebuilds the same call or host list each render doesn't reset the card.
  const sig = signature(call, allowedHosts)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const a = React.useMemo(() => analyzeToolCall(call, { allowedHosts }), [sig])
  const reduce = useReducedMotion()
  const id = React.useId()
  const [decision, setDecision] = React.useState<AgentDecision | null>(null)
  const [pending, setPending] = React.useState<AgentDecision["type"] | null>(null)
  const [error, setError] = React.useState(false)
  const [always, setAlways] = React.useState(false)
  const [progress, setProgress] = React.useState(0)
  const [tapped, setTapped] = React.useState(false)
  const [status, setStatus] = React.useState("")
  const holdRef = React.useRef<HTMLButtonElement>(null)
  const resultRef = React.useRef<HTMLDivElement>(null)
  const alwaysRef = React.useRef<HTMLButtonElement>(null)
  const raf = React.useRef(0)
  const busy = pending !== null
  const intent = typeof call?.intent === "string" ? call.intent.trim() : ""
  const hold = a.risk === "high"
  const spaced = typeof call?.command === "string" || typeof call?.args?.command === "string"

  // A new call resets the card.
  React.useEffect(() => {
    setDecision(null)
    setAlways(false)
    setError(false)
    setTapped(false)
  }, [a])
  React.useEffect(() => () => cancelAnimationFrame(raf.current), [])
  // The buttons are gone once decided; keep focus on the card instead of dropping it to the page.
  React.useEffect(() => {
    if (decision) resultRef.current?.focus()
  }, [decision])

  const decide = async (d: AgentDecision) => {
    if (busy || decision) return
    setPending(d.type)
    setError(false)
    try {
      await onDecision?.(d)
      setDecision(d)
      setStatus(d.type === "deny" ? m.denied : d.type === "once" ? m.approved : `${m.allowed}: ${d.rule}`)
    } catch {
      setError(true)
    } finally {
      setPending(null)
    }
  }

  const startHold = () => {
    if (busy || decision) return
    setTapped(false)
    const t0 = performance.now()
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / holdMs)
      setProgress(p)
      if (p < 1) raf.current = requestAnimationFrame(tick)
      else {
        raf.current = 0
        setProgress(0)
        decide({ type: "once" })
      }
    }
    cancelAnimationFrame(raf.current)
    raf.current = requestAnimationFrame(tick)
  }
  const stopHold = () => {
    if (!raf.current) return
    cancelAnimationFrame(raf.current)
    raf.current = 0
    // Any release before the hold completes counts as a tap, even one shorter than a frame (a quick Enter).
    setProgress(0)
    setTapped(true)
    if (!reduce && holdRef.current) animate(holdRef.current, { x: [0, -5, 5, -3, 0] }, { duration: 0.3 })
  }

  const reach = SCOPES.indexOf(a.scope)
  const slips = a.findings.filter((f) => f.id.startsWith("slip-"))
  // The says/does box already shows a mismatch; don't repeat it in the list.
  const findings = a.findings.filter((f) => !(intent && f.id === "mismatch"))

  if (decision) {
    const Icon = decision.type === "deny" ? Ban : Check
    return (
      <div data-slot="agent-action-approve" data-state="decided" className={cn("w-full min-w-0", className)} {...props}>
        <div ref={resultRef} tabIndex={-1} className="flex min-w-0 items-center gap-2 rounded-lg border bg-card px-3 py-2.5 text-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50">
          <Icon aria-hidden className={cn("size-4 shrink-0", decision.type === "deny" ? "text-muted-foreground" : "text-emerald-600 dark:text-emerald-400")} />
          <span className="font-medium">{decision.type === "deny" ? m.denied : decision.type === "once" ? m.approved : m.allowed}</span>
          <code className="min-w-0 truncate font-mono text-xs text-muted-foreground">{decision.type === "always" ? decision.rule : a.does}</code>
        </div>
        <span role="status" className="sr-only">{status}</span>
      </div>
    )
  }

  return (
    <div data-slot="agent-action-approve" data-risk={a.risk} className={cn("grid w-full min-w-0 gap-3 rounded-lg border bg-card p-3 text-card-foreground shadow-xs sm:p-4", a.risk === "high" && "border-red-500/40", className)} {...props}>
      <div className="flex min-w-0 items-center gap-2">
        <Terminal aria-hidden className="size-4 shrink-0 text-muted-foreground" />
        <span className="min-w-0 flex-1 truncate font-mono text-xs text-muted-foreground">{call?.tool || "Bash"}</span>
        <span className={cn("inline-flex h-6 shrink-0 items-center gap-1 rounded-full border px-2 text-xs font-medium", RISK_TONE[a.risk])}>
          {a.risk === "high" ? <ShieldAlert aria-hidden className="size-3.5" /> : <ShieldCheck aria-hidden className="size-3.5" />}
          {m.risk[a.risk]}
        </span>
      </div>

      <div className={cn("grid gap-2 rounded-md border p-2.5 text-sm", a.mismatch ? "border-red-500/40 bg-red-500/5 dark:bg-red-500/10" : "bg-muted/40")}>
        {intent && (
          <p className="grid gap-0.5">
            <span className="text-xs text-muted-foreground">{m.says}</span>
            <span className="break-words">“{intent}”</span>
          </p>
        )}
        <p className="grid gap-0.5">
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            {m.does}
            {a.mismatch && (
              <span className="inline-flex items-center gap-1 font-medium text-red-700 dark:text-red-400">
                <AlertTriangle aria-hidden className="size-3.5" />
                {m.mismatch}
              </span>
            )}
          </span>
          <span className="font-medium break-words [overflow-wrap:anywhere]">{a.does}</span>
        </p>
      </div>

      {a.tokens.length > 0 && (
        <pre className="max-h-40 overflow-auto rounded-md border bg-muted/40 px-2.5 py-2 font-mono text-xs whitespace-pre-wrap break-all">
          {a.tokens.map((t, i) => (
            <React.Fragment key={i}>
              {i > 0 && spaced ? " " : ""}
              {t.slip ? (
                <mark aria-describedby={`${id}-slip`} className="rounded-sm bg-red-500/20 px-1 font-semibold text-red-700 underline decoration-red-500 decoration-wavy underline-offset-2 dark:text-red-300">
                  {t.text}
                </mark>
              ) : (
                t.text
              )}
            </React.Fragment>
          ))}
        </pre>
      )}

      <dl className="grid grid-cols-2 gap-2 text-xs">
        <div className="grid min-w-0 gap-1">
          <dt className="text-muted-foreground">{m.reach}</dt>
          <dd className="grid gap-1">
            <span className={cn("font-medium", reach >= SCOPES.indexOf("outside") && "text-red-700 dark:text-red-400")}>{m.scope[a.scope]}</span>
            <span aria-hidden className="flex gap-0.5">
              {SCOPES.map((s, i) => (
                <motion.span
                  key={s}
                  initial={false}
                  animate={{ opacity: i <= reach ? 1 : 0.25 }}
                  transition={{ delay: reduce ? 0 : i * 0.03 }}
                  className={cn("h-1.5 flex-1 rounded-full", i <= reach ? (reach >= SCOPES.indexOf("outside") ? "bg-red-500" : reach >= SCOPES.indexOf("project") ? "bg-amber-500" : "bg-emerald-500") : "bg-muted-foreground/40")}
                />
              ))}
            </span>
          </dd>
        </div>
        <div className="grid min-w-0 content-start gap-1">
          <dt className="text-muted-foreground">{m.undo}</dt>
          <dd className={cn("font-medium", a.undo === "never" && "text-red-700 dark:text-red-400")}>{m.undoLabel[a.undo]}</dd>
        </div>
      </dl>

      {findings.length > 0 && (
        <ul className="grid gap-1.5">
          {findings.map((f) => (
            <li key={f.id} id={slips[0]?.id === f.id ? `${id}-slip` : undefined} className="flex min-w-0 gap-2 text-xs">
              <AlertTriangle aria-hidden className={cn("mt-0.5 size-3.5 shrink-0", f.level === "danger" ? "text-red-600 dark:text-red-400" : "text-amber-600 dark:text-amber-400")} />
              <span className="min-w-0 break-words [overflow-wrap:anywhere]">
                <span className="font-medium">{f.title}.</span> <span className="text-muted-foreground">{f.detail}</span>
              </span>
            </li>
          ))}
        </ul>
      )}

      <AnimatePresence initial={false}>
        {always && a.rule && (
          <motion.div
            initial={reduce ? { opacity: 0 } : { opacity: 0, height: 0 }}
            animate={reduce ? { opacity: 1 } : { opacity: 1, height: "auto" }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="grid gap-2 rounded-md border border-amber-500/40 bg-amber-500/5 p-2.5 text-xs dark:bg-amber-500/10">
              <p>
                {m.alwaysTitle} <code className="rounded-sm bg-background px-1 font-mono break-all">{a.rule}</code>
              </p>
              <p className="text-muted-foreground">{m.alwaysAlso}</p>
              <ul className="grid list-disc gap-0.5 pl-4 font-mono break-words">
                {a.ruleAlso.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
              <div className="flex flex-wrap gap-1.5">
                <button type="button" autoFocus disabled={busy} onClick={() => decide({ type: "always", rule: a.rule! })} className={cn(btn, "h-8 px-3 bg-primary text-primary-foreground hover:bg-primary/90")}>
                  {pending === "always" && <Loader2 aria-hidden className="size-4 animate-spin" />}
                  {m.alwaysSave}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAlways(false)
                    requestAnimationFrame(() => alwaysRef.current?.focus())
                  }}
                  className={cn(btn, "h-8 px-3 border bg-background hover:bg-accent dark:bg-input/30")}
                >
                  {m.cancel}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex flex-wrap items-center gap-2">
        <button type="button" disabled={busy} onClick={() => decide({ type: "deny" })} className={cn(btn, "border bg-background shadow-xs hover:bg-accent dark:bg-input/30")}>
          {pending === "deny" ? <Loader2 aria-hidden className="size-4 animate-spin" /> : <X aria-hidden className="size-4" />}
          {m.deny}
        </button>
        {hold ? (
          <button
            ref={holdRef}
            type="button"
            disabled={busy}
            aria-describedby={`${id}-hold`}
            onPointerDown={(e) => {
              if (e.button === 0) startHold()
            }}
            onPointerUp={stopHold}
            onPointerLeave={stopHold}
            onPointerCancel={stopHold}
            onKeyDown={(e) => {
              if ((e.key === " " || e.key === "Enter") && !e.repeat) {
                e.preventDefault()
                startHold()
              }
            }}
            onKeyUp={(e) => {
              if (e.key === " " || e.key === "Enter") stopHold()
            }}
            onContextMenu={(e) => e.preventDefault()}
            className={cn(btn, "touch-none select-none bg-destructive text-white shadow-xs hover:bg-destructive/90")}
          >
            <span aria-hidden className="absolute inset-y-0 left-0 bg-black/25 dark:bg-white/25" style={{ width: `${progress * 100}%` }} />
            <span className="relative inline-flex items-center gap-2">
              {pending === "once" && <Loader2 aria-hidden className="size-4 animate-spin" />}
              {progress > 0 ? m.holding : m.hold}
            </span>
          </button>
        ) : (
          <button type="button" disabled={busy} onClick={() => decide({ type: "once" })} className={cn(btn, "bg-primary text-primary-foreground shadow-xs hover:bg-primary/90")}>
            {pending === "once" ? <Loader2 aria-hidden className="size-4 animate-spin" /> : <Check aria-hidden className="size-4" />}
            {m.approve}
          </button>
        )}
        {a.rule && !always && (
          <button ref={alwaysRef} type="button" disabled={busy} onClick={() => setAlways(true)} className={cn(btn, "px-3 text-muted-foreground hover:bg-accent hover:text-foreground")}>
            {m.always}
          </button>
        )}
      </div>
      {hold && (
        <p id={`${id}-hold`} className={cn("-mt-1 text-xs", tapped ? "text-red-700 dark:text-red-400" : "text-muted-foreground")}>
          {tapped ? m.tapped : m.holdHint}
        </p>
      )}
      {!a.rule && a.ruleRefused && m.refused[a.ruleRefused] && <p className="-mt-1 text-xs text-muted-foreground">{m.refused[a.ruleRefused]}</p>}
      {error && (
        <p role="alert" className="-mt-1 text-xs text-red-700 dark:text-red-400">
          {m.failed}
        </p>
      )}
      <span role="status" className="sr-only">{status}</span>
    </div>
  )
}
