"use client"

// Bollard UI — mcp-tool-review · MIT licence · https://bollard-ui.vercel.app/components/mcp-tool-review

import * as React from "react"
import { AlertTriangle, Check, ChevronDown, Fingerprint, Loader2, Power, ShieldCheck, Undo2, Wrench } from "lucide-react"
import { AnimatePresence, animate, motion, useReducedMotion } from "motion/react"

import { cn } from "@/lib/utils"

import { markDanger, revealHidden, reviewTools, type McpTool, type ToolChange, type ToolReview } from "./tool-diff"

export { markDanger, revealHidden, reviewTools, toolHash, wordDiff, type DiffPart, type FindingCode, type McpTool, type ParamChange, type ToolChange, type ToolFinding, type ToolReview } from "./tool-diff"

export const MCP_TOOL_REVIEW_MESSAGES = {
  changed: "{server} changed {count} tool since you approved it|{server} changed {count} tools since you approved them",
  unchanged: "{server} hasn't changed anything since you approved it.",
  poisoned: "{count} of them now gives the AI hidden orders.|{count} of them now give the AI hidden orders.",
  change: { added: "New", removed: "Removed", changed: "Changed", same: "Same" } satisfies Record<ToolChange, string>,
  risk: { danger: "Suspicious", warn: "Check", ok: "Looks fine" },
  params: "Parameters",
  noDescription: "(no description)",
  keep: "Keep approved version",
  disable: "Turn off",
  accept: "Accept change",
  acceptAnyway: "Accept anyway",
  confirm: "This change gives the AI hidden orders. Press again only if you trust {server} and wrote this yourself.",
  acknowledge: "OK",
  acceptSafe: "Accept {count} safe change|Accept {count} safe changes",
  resolved: { accept: "Accepted", keep: "Kept the approved version", disable: "Turned off" },
  undo: "Undo",
  failed: "That didn't save. Try again.",
}

type Messages = typeof MCP_TOOL_REVIEW_MESSAGES
export type ToolResolution = "accept" | "keep" | "disable"

export interface McpToolReviewProps extends Omit<React.ComponentProps<"div">, "children"> {
  /** Server name as the person knows it. */
  server: string
  /** Tool definitions as they were when the person approved the server (pinned). */
  approved: McpTool[] | null | undefined
  /** Tool definitions the server lists now. */
  current: McpTool[] | null | undefined
  /** Tools from the person's other servers, to catch shadowing and name clashes. */
  otherTools?: { server: string; name: string }[]
  /** Called per tool. May return a Promise; the card shows a pending state and can't fire twice. */
  onResolve?: (name: string, resolution: ToolResolution) => void | Promise<void>
  /** Override any visible string, including change, risk and resolved texts. */
  messages?: Partial<Omit<Messages, "change" | "risk" | "resolved">> & { change?: Partial<Messages["change"]>; risk?: Partial<Messages["risk"]>; resolved?: Partial<Messages["resolved"]> }
}

const fill = (t: string, v: Record<string, string | number>) =>
  (t.includes("|") ? t.split("|")[Number(v.count) === 1 ? 0 : 1] : t).replace(/\{(\w+)\}/g, (k, key: string) => String(v[key] ?? k))
const btn = "inline-flex h-8 items-center justify-center gap-1.5 rounded-md px-3 text-xs font-medium outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-60"
const RANK = { danger: 0, warn: 1, ok: 2 }

/**
 * Stops an MCP "rug pull": a server that changes its tools after you approved them, slipping in orders for
 * the AI (Invariant Labs' tool-poisoning attack, the WhatsApp MCP exfiltration). It diffs each tool against
 * the pinned definition word by word, marks the poisoned phrases inside the new text (<IMPORTANT>, ~/.ssh,
 * "do not tell the user", another server's send_email), flags new free-text parameters that could carry data
 * out, invisible characters and read-only labels that flipped, and lets the person keep the approved version,
 * turn the tool off, or accept the change, with a second press for anything suspicious.
 */
export function McpToolReview({ server, approved, current, otherTools, onResolve, messages, className, ...props }: McpToolReviewProps) {
  const m: Messages = {
    ...MCP_TOOL_REVIEW_MESSAGES,
    ...messages,
    change: { ...MCP_TOOL_REVIEW_MESSAGES.change, ...messages?.change },
    risk: { ...MCP_TOOL_REVIEW_MESSAGES.risk, ...messages?.risk },
    resolved: { ...MCP_TOOL_REVIEW_MESSAGES.resolved, ...messages?.resolved },
  }
  const reviews = React.useMemo(
    () => reviewTools(approved, current, { otherTools }).filter((r) => r.change !== "same").sort((a, b) => RANK[a.risk] - RANK[b.risk]),
    [approved, current, otherTools],
  )
  const others = React.useMemo(() => (otherTools ?? []).map((o) => o.name), [otherTools])
  const [open, setOpen] = React.useState<Record<string, boolean>>({})
  const [done, setDone] = React.useState<Record<string, ToolResolution>>({})
  const [pending, setPending] = React.useState<string | null>(null)
  const [armed, setArmed] = React.useState<string | null>(null)
  const [failed, setFailed] = React.useState<string | null>(null)
  const [status, setStatus] = React.useState("")
  const rootRef = React.useRef<HTMLDivElement>(null)
  const reduce = useReducedMotion()
  const id = React.useId()

  const poisoned = reviews.filter((r) => r.risk === "danger").length
  const safe = reviews.filter((r) => r.risk === "ok" && r.change !== "removed" && !done[r.name])
  const isOpen = (r: ToolReview) => open[r.name] ?? r.risk === "danger"

  const focusNext = () =>
    requestAnimationFrame(() =>
      requestAnimationFrame(() => rootRef.current?.querySelector<HTMLElement>("[data-open-card] [data-primary], [data-card-toggle]:not([data-done])")?.focus()),
    )

  const resolve = async (names: string[], how: ToolResolution, button?: HTMLElement | null) => {
    if (pending) return
    const one = names.length === 1 ? reviews.find((r) => r.name === names[0]) : undefined
    if (how === "accept" && one?.risk === "danger" && armed !== one.name) {
      setArmed(one.name)
      if (!reduce && button) animate(button, { x: [0, -5, 5, -3, 0] }, { duration: 0.3 })
      return
    }
    setPending(names.join())
    setFailed(null)
    try {
      for (const n of names) await onResolve?.(n, how)
      setDone((d) => ({ ...d, ...Object.fromEntries(names.map((n) => [n, how])) }))
      setStatus(`${names.join(", ")}: ${m.resolved[how]}`)
      setArmed(null)
      focusNext()
    } catch {
      setFailed(names.join())
    } finally {
      setPending(null)
    }
  }

  const pins = (r: ToolReview) => (
    <span className="inline-flex items-center gap-1 font-mono text-[11px] text-muted-foreground">
      <Fingerprint aria-hidden className="size-3" />
      {r.pinBefore ?? "—"} → {r.pinAfter ?? "—"}
    </span>
  )

  return (
    <div ref={rootRef} data-slot="mcp-tool-review" data-state={poisoned ? "suspicious" : reviews.length ? "changed" : "unchanged"} className={cn("grid w-full min-w-0 gap-2", className)} {...props}>
      <div className={cn("flex min-w-0 gap-2 rounded-lg border p-3 text-sm", poisoned ? "border-red-500/40 bg-red-500/5 dark:bg-red-500/10" : reviews.length ? "border-amber-500/40 bg-amber-500/5 dark:bg-amber-500/10" : "")}>
        {reviews.length ? <AlertTriangle aria-hidden className={cn("mt-0.5 size-4 shrink-0", poisoned ? "text-red-600 dark:text-red-400" : "text-amber-600 dark:text-amber-400")} /> : <ShieldCheck aria-hidden className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />}
        <div className="grid min-w-0 gap-0.5">
          <p className="font-medium break-words">{reviews.length ? fill(m.changed, { server, count: reviews.length }) : fill(m.unchanged, { server })}</p>
          {poisoned > 0 && <p className="text-xs text-red-700 dark:text-red-400">{fill(m.poisoned, { count: poisoned })}</p>}
        </div>
      </div>

      <ul className="grid gap-1.5">
        {reviews.map((r) => {
          const resolved = done[r.name]
          const expanded = !resolved && isOpen(r)
          const body = `${id}-${r.name}`
          return (
            <motion.li key={r.name} layout={!reduce} data-open-card={expanded || undefined} className={cn("min-w-0 rounded-lg border bg-card", !resolved && r.risk === "danger" && "border-red-500/40")}>
              <h3 className="flex min-w-0 items-center">
                <button
                  type="button"
                  data-card-toggle
                  data-done={resolved || undefined}
                  aria-expanded={expanded}
                  aria-controls={body}
                  disabled={!!resolved}
                  onClick={() => setOpen((o) => ({ ...o, [r.name]: !isOpen(r) }))}
                  className="flex min-w-0 flex-1 items-center gap-2 rounded-lg px-3 py-2.5 text-left outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-default"
                >
                  {resolved ? <Check aria-hidden className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400" /> : <Wrench aria-hidden className="size-4 shrink-0 text-muted-foreground" />}
                  <span className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-0.5">
                    <span className="min-w-0 font-mono text-sm break-words">
                      {r.name.split("_").map((part, i) => (
                        <React.Fragment key={i}>
                          {i > 0 && "_"}
                          {i > 0 && <wbr />}
                          {part}
                        </React.Fragment>
                      ))}
                    </span>
                    <span className="shrink-0 rounded-full border px-1.5 text-[11px] text-muted-foreground">{m.change[r.change]}</span>
                  </span>
                  <span className="shrink-0 text-xs font-medium">
                    {resolved ? (
                      <span className="text-muted-foreground">{m.resolved[resolved]}</span>
                    ) : (
                      <span className={r.risk === "danger" ? "text-red-700 dark:text-red-400" : r.risk === "warn" ? "text-amber-700 dark:text-amber-400" : "text-emerald-700 dark:text-emerald-400"}>{m.risk[r.risk]}</span>
                    )}
                  </span>
                  {!resolved && <ChevronDown aria-hidden className={cn("size-4 shrink-0 text-muted-foreground transition-transform", expanded && "rotate-180")} />}
                </button>
                {resolved && (
                  <button
                    type="button"
                    onClick={() => {
                      setDone(({ [r.name]: _, ...rest }) => rest)
                      setOpen((o) => ({ ...o, [r.name]: true }))
                    }}
                    className={cn(btn, "mr-1.5 h-7 px-2 hover:bg-accent")}
                  >
                    <Undo2 aria-hidden className="size-3.5" />
                    {m.undo}
                  </button>
                )}
              </h3>
              <AnimatePresence initial={false}>
                {expanded && (
                  <motion.div
                    id={body}
                    initial={reduce ? { opacity: 0 } : { opacity: 0, height: 0 }}
                    animate={reduce ? { opacity: 1 } : { opacity: 1, height: "auto" }}
                    exit={reduce ? { opacity: 0 } : { opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="grid gap-2.5 border-t px-3 pt-2.5 pb-3">
                      {r.findings.length > 0 && (
                        <ul className="grid gap-1">
                          {r.findings.map((f) => (
                            <li key={f.code + f.message} className="flex min-w-0 gap-1.5 text-xs">
                              <AlertTriangle aria-hidden className={cn("mt-0.5 size-3.5 shrink-0", f.level === "danger" ? "text-red-600 dark:text-red-400" : "text-amber-600 dark:text-amber-400")} />
                              <span className="min-w-0 break-words [overflow-wrap:anywhere]">
                                {f.message}
                                {/* The trigger can sit outside the description diff (a nested parameter, an enum), so quote it. */}
                                {f.excerpt && f.code !== "shadowing" && f.code !== "exfil-param" && !r.diff.some((d) => d.op === "add" && d.text.includes(f.excerpt!)) && (
                                  <code className="ml-1 rounded-sm bg-red-500/10 px-1 font-mono text-[11px] text-red-800 dark:text-red-200">{revealHidden(f.excerpt)}</code>
                                )}
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                      <p className="max-h-48 overflow-auto rounded-md border bg-muted/40 p-2 text-xs leading-relaxed break-words [overflow-wrap:anywhere]" tabIndex={0}>
                        {r.diff.every((d) => !d.text) && <span className="text-muted-foreground">{m.noDescription}</span>}
                        {r.diff.map((d, i) =>
                          d.op === "del" ? (
                            <del key={i} className="bg-red-500/10 text-red-700 decoration-red-500/60 dark:text-red-300">{revealHidden(d.text)}</del>
                          ) : d.op === "add" ? (
                            <ins key={i} className="bg-emerald-500/10 text-foreground no-underline">
                              {markDanger(revealHidden(d.text), others).map((s, j) =>
                                s.danger ? (
                                  <mark key={j} className="rounded-sm bg-red-500/25 font-semibold text-red-800 dark:text-red-200">{s.text}</mark>
                                ) : (
                                  <React.Fragment key={j}>{s.text}</React.Fragment>
                                ),
                              )}
                            </ins>
                          ) : (
                            <span key={i}>{revealHidden(d.text)}</span>
                          ),
                        )}
                      </p>
                      {r.params.length > 0 && (
                        <div className="grid gap-1 text-xs">
                          <span className="text-muted-foreground">{m.params}</span>
                          <ul className="grid gap-0.5 font-mono">
                            {r.params.map((p) => (
                              <li key={p.name} className={cn("break-words", p.op === "add" ? "text-emerald-700 dark:text-emerald-400" : p.op === "del" ? "text-red-700 line-through dark:text-red-400" : "")}>
                                {p.op === "add" ? "+ " : p.op === "del" ? "− " : "~ "}
                                {p.name}
                                {p.type && <span className="text-muted-foreground">: {p.type}</span>}
                                {p.description && <span className="font-sans text-muted-foreground"> — {p.description}</span>}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {pins(r)}
                      <div className="flex flex-wrap gap-1.5">
                        {r.change === "removed" ? (
                          <button type="button" data-primary disabled={!!pending} onClick={() => resolve([r.name], "accept")} className={cn(btn, "bg-primary text-primary-foreground hover:bg-primary/90")}>
                            {m.acknowledge}
                          </button>
                        ) : (
                          <>
                            {r.change === "changed" && (
                              <button type="button" data-primary disabled={!!pending} onClick={() => resolve([r.name], "keep")} className={cn(btn, "bg-primary text-primary-foreground hover:bg-primary/90")}>
                                {pending === r.name && <Loader2 aria-hidden className="size-3.5 animate-spin" />}
                                {m.keep}
                              </button>
                            )}
                            <button type="button" data-primary={r.change === "added" || undefined} disabled={!!pending} onClick={() => resolve([r.name], "disable")} className={cn(btn, "border bg-background hover:bg-accent dark:bg-input/30")}>
                              <Power aria-hidden className="size-3.5" />
                              {m.disable}
                            </button>
                            <button
                              type="button"
                              disabled={!!pending}
                              aria-describedby={armed === r.name ? `${body}-confirm` : undefined}
                              onClick={(e) => resolve([r.name], "accept", e.currentTarget)}
                              className={cn(btn, armed === r.name ? "bg-destructive text-white hover:bg-destructive/90" : "text-muted-foreground hover:bg-accent hover:text-foreground")}
                            >
                              {armed === r.name ? m.acceptAnyway : m.accept}
                            </button>
                          </>
                        )}
                      </div>
                      {armed === r.name && (
                        <p id={`${body}-confirm`} role="alert" className="text-xs text-red-700 dark:text-red-400">
                          {fill(m.confirm, { server })}
                        </p>
                      )}
                      {failed === r.name && (
                        <p role="alert" className="text-xs text-red-700 dark:text-red-400">
                          {m.failed}
                        </p>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.li>
          )
        })}
      </ul>

      {safe.length > 1 && (
        <button type="button" disabled={!!pending} onClick={() => resolve(safe.map((r) => r.name), "accept")} className={cn(btn, "w-fit border bg-background hover:bg-accent dark:bg-input/30")}>
          <Check aria-hidden className="size-3.5" />
          {fill(m.acceptSafe, { count: safe.length })}
        </button>
      )}
      <span role="status" className="sr-only">{status}</span>
    </div>
  )
}
