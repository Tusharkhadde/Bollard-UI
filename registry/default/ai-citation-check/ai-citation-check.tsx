"use client"

import * as React from "react"
import { BookOpen, Bot, Check, CircleHelp, ExternalLink, Link2, Loader2, Quote, Scale, Trash2, Wrench, XCircle } from "lucide-react"
import { AnimatePresence, animate, motion, useReducedMotion } from "motion/react"

import { cn } from "@/lib/utils"

import { applyFix, findReferences, type IssueCode, type RefKind, type Reference } from "./citations"

export { applyFix, findReferences, type Issue, type IssueCode, type RefKind, type Reference } from "./citations"

export const AI_CITATION_CHECK_MESSAGES = {
  summary: "{bad} look made up · {unverified} unverified · {ok} verified",
  none: "No references, links or quotes to check yet.",
  status: { bad: "Looks made up", missing: "Not found", off: "Exists, details off", unverified: "Unverified", verified: "Verified", checking: "Checking…" },
  missing: "No record of this in {source}.",
  kind: { doi: "DOI", case: "Case", url: "Link", cite: "Citation", quote: "Quote", marker: "Chatbot marker" } satisfies Record<RefKind, string>,
  /** Optional translations of each reason; {vars} come from the issue. Leave empty to use the built-in English. */
  issue: {} as Partial<Record<IssueCode, string>>,
  fix: "Use hyphens",
  remove: "Remove",
  show: "Show",
  more: "Show {count} more",
  submit: "Submit",
  submitAnyway: "Submit anyway",
  confirm: "{count} reference may not exist. Press again to submit it as is.|{count} references may not exist. Press again to submit them as is.",
  submitting: "Submitting…",
}

type Messages = typeof AI_CITATION_CHECK_MESSAGES
type Status = keyof Messages["status"]
/** What a lookup found. `true`/`false` are shorthand for found/not found. */
export type VerifyResult = boolean | { status: "found" | "not-found"; title?: string; url?: string }

export interface AiCitationCheckProps extends Omit<React.ComponentProps<"textarea">, "value" | "defaultValue" | "onChange" | "onSubmit"> {
  value?: string
  defaultValue?: string
  onValueChange?: (value: string) => void
  /** Looks a reference up (Crossref for DOIs, CourtListener for cases, a HEAD request for links). Rejections show as Unverified. */
  verify?: (ref: Reference, signal: AbortSignal) => Promise<VerifyResult>
  /** Named in "No record of this in …". */
  sourceName?: string
  /** The current year, for "hasn't happened yet". Defaults to the device's year. */
  year?: number
  /** Called on submit. May return a Promise. Anything made up or unverified needs a second press. */
  onSubmit?: (value: string) => void | Promise<void>
  /** References listed before "Show N more". Default 5. */
  maxVisible?: number
  className?: string
  textareaClassName?: string
  messages?: Partial<Omit<Messages, "status" | "kind">> & { status?: Partial<Messages["status"]>; kind?: Partial<Messages["kind"]> }
}

type Lookup = { state: "checking" | "found" | "not-found" | "error"; title?: string; url?: string }

const fill = (t: string, v: Record<string, string | number>) =>
  (t.includes("|") ? t.split("|")[Number(v.count) === 1 ? 0 : 1] : t).replace(/\{(\w+)\}/g, (k, key: string) => String(v[key] ?? k))
const chip = "inline-flex h-7 items-center gap-1 rounded-md border bg-background px-2.5 text-xs font-medium outline-none transition-colors hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30"
const ICON: Record<RefKind, typeof Bot> = { doi: BookOpen, case: Scale, url: Link2, cite: BookOpen, quote: Quote, marker: Bot }
const TONE: Record<Status, string> = {
  bad: "border-red-500/40 bg-red-500/5 dark:bg-red-500/10",
  missing: "border-red-500/40 bg-red-500/5 dark:bg-red-500/10",
  off: "border-amber-500/40 bg-amber-500/5 dark:bg-amber-500/10",
  unverified: "border-amber-500/40 bg-amber-500/5 dark:bg-amber-500/10",
  verified: "border-emerald-500/30",
  checking: "",
}
const PILL: Record<Status, string> = {
  bad: "text-red-700 dark:text-red-400",
  missing: "text-red-700 dark:text-red-400",
  off: "text-amber-700 dark:text-amber-400",
  unverified: "text-amber-700 dark:text-amber-400",
  verified: "text-emerald-700 dark:text-emerald-400",
  checking: "text-muted-foreground",
}
const RANK: Record<Status, number> = { bad: 0, missing: 0, off: 1, unverified: 2, checking: 3, verified: 4 }

/**
 * Stops made-up references going out in AI-written text (the ChatGPT cases in Mata v. Avianca; Deloitte's
 * refunded government report). It flags the tells with reasons — a DOI prefix that isn't the named journal's
 * publisher, a long dash inside a DOI, F.3d cited for a post-2021 case, a future year, leftover oaicite
 * markers, long quotes with no source — looks each one up through a pluggable `verify`, and calls anything
 * it couldn't confirm "Unverified", never fine. Dashes and markers are fixed in one tap.
 */
export function AiCitationCheck({
  value: valueProp, defaultValue = "", onValueChange, verify, sourceName = "the lookup", year, onSubmit, maxVisible = 5, className, textareaClassName, messages,
  id: idProp, "aria-describedby": describedBy, onBlur, ...props
}: AiCitationCheckProps) {
  const m: Messages = { ...AI_CITATION_CHECK_MESSAGES, ...messages, status: { ...AI_CITATION_CHECK_MESSAGES.status, ...messages?.status }, kind: { ...AI_CITATION_CHECK_MESSAGES.kind, ...messages?.kind } }
  const [inner, setInner] = React.useState(defaultValue)
  const value = valueProp ?? inner
  const [checked, setChecked] = React.useState(value)
  const [lookups, setLookups] = React.useState<Record<string, Lookup>>({})
  const [all, setAll] = React.useState(false)
  const [armed, setArmed] = React.useState(false)
  const [submitting, setSubmitting] = React.useState(false)
  const [status, setStatus] = React.useState("")
  const fieldRef = React.useRef<HTMLTextAreaElement>(null)
  const listRef = React.useRef<HTMLUListElement>(null)
  const submitRef = React.useRef<HTMLButtonElement>(null)
  const asked = React.useRef(new Set<string>())
  const reduce = useReducedMotion()
  const auto = React.useId()
  const id = idProp ?? auto

  React.useEffect(() => {
    if (value === checked) return
    const t = setTimeout(() => setChecked(value), 800)
    return () => clearTimeout(t)
  }, [value, checked])

  const refs = React.useMemo(() => findReferences(checked.replace(/\r\n?/g, "\n"), { year }), [checked, year])

  // Look up each key once, three at a time. Results belong to the key, not the text, so edits elsewhere never discard them.
  const verifyRef = React.useRef(verify)
  verifyRef.current = verify
  const canVerify = !!verify
  React.useEffect(() => {
    if (!canVerify) return
    const todo = [...new Set(refs.map((r) => r.key).filter((k): k is string => !!k && !asked.current.has(k)))]
    if (!todo.length) return
    const ctrl = new AbortController()
    const pending = new Set(todo)
    todo.forEach((k) => asked.current.add(k))
    setLookups((l) => ({ ...l, ...Object.fromEntries(todo.map((k) => [k, { state: "checking" } as Lookup])) }))
    const queue = todo.map((k) => refs.find((r) => r.key === k)!)
    const worker = async () => {
      for (let ref = queue.shift(); ref; ref = queue.shift()) {
        const key = ref.key!
        let next: Lookup
        try {
          const r = await verifyRef.current!(ref, ctrl.signal)
          next = typeof r === "boolean" ? { state: r ? "found" : "not-found" } : { state: r?.status === "found" ? "found" : "not-found", title: r?.title, url: r?.url }
        } catch {
          next = { state: "error" }
        }
        if (ctrl.signal.aborted) continue
        pending.delete(key)
        setLookups((l) => ({ ...l, [key]: next }))
      }
    }
    Promise.all([worker(), worker(), worker()])
    // Anything still in flight is asked again by the next run.
    return () => {
      ctrl.abort()
      pending.forEach((k) => asked.current.delete(k))
    }
  }, [refs, canVerify])

  const statusOf = (r: Reference): Status => {
    const l = r.key ? lookups[r.key] : undefined
    if (l?.state === "not-found") return "missing"
    if (r.issues.length) return l?.state === "found" ? "off" : r.kind === "quote" ? "unverified" : "bad"
    if (l?.state === "checking") return "checking"
    if (l?.state === "found") return "verified"
    return "unverified"
  }
  const rows = refs.map((r) => ({ r, s: statusOf(r) })).sort((a, b) => RANK[a.s] - RANK[b.s] || a.r.start - b.r.start)
  const bad = rows.filter((x) => x.s === "bad" || x.s === "missing").length
  const unverified = rows.filter((x) => x.s === "unverified" || x.s === "off" || x.s === "checking").length
  const ok = rows.length - bad - unverified
  const summary = rows.length ? fill(m.summary, { bad, unverified, ok }) : m.none

  React.useEffect(() => {
    const t = setTimeout(() => setStatus(checked.trim() ? summary : ""), 700)
    return () => clearTimeout(t)
  }, [summary, checked])
  React.useEffect(() => setArmed(false), [checked])

  const set = (next: string, now = false) => {
    if (valueProp === undefined) setInner(next)
    onValueChange?.(next)
    if (now) setChecked(next)
  }

  // Ranges come from the last check; if typing moved on, find the same reference in the live text.
  const live = (r: Reference) => (value === checked ? r : findReferences(value.replace(/\r\n?/g, "\n"), { year }).find((x) => x.kind === r.kind && x.text === r.text))

  const repair = (r: Reference) => {
    const ref = live(r)
    if (!ref) return setChecked(value)
    const next = applyFix(value, ref)
    set(next, true)
    const first = findReferences(next, { year }).find((x) => x.fix !== undefined)
    requestAnimationFrame(() =>
      requestAnimationFrame(() => ((first && listRef.current?.querySelector<HTMLElement>(`[data-ref="${CSS.escape(first.id)}"] [data-fix]`)) || fieldRef.current)?.focus()),
    )
  }

  const show = (r: Reference) => {
    const ref = live(r)
    const el = fieldRef.current
    if (!ref || !el) return
    el.focus()
    el.setSelectionRange(ref.start, ref.end)
  }

  const submit = async () => {
    if (submitting) return
    setChecked(value)
    if (bad + unverified > 0 && !armed) {
      setArmed(true)
      if (!reduce && submitRef.current) animate(submitRef.current, { x: [0, -5, 5, -3, 0] }, { duration: 0.3 })
      return
    }
    setSubmitting(true)
    try {
      await onSubmit?.(value)
    } catch {
      // The caller reports its own failure; the button becomes usable again.
    } finally {
      setSubmitting(false)
      setArmed(false)
    }
  }

  const visible = all ? rows : rows.slice(0, Math.max(1, maxVisible))

  return (
    <div data-slot="ai-citation-check" data-state={bad ? "flagged" : unverified ? "unverified" : "clear"} className={cn("grid w-full min-w-0 gap-2", className)}>
      <textarea
        ref={fieldRef}
        id={id}
        value={value}
        rows={7}
        aria-invalid={bad > 0 || undefined}
        aria-describedby={[describedBy, `${id}-summary`].filter(Boolean).join(" ")}
        onChange={(e) => set(e.target.value)}
        onBlur={(e) => {
          onBlur?.(e)
          setChecked(e.currentTarget.value)
        }}
        onPaste={() => requestAnimationFrame(() => setChecked(fieldRef.current?.value ?? ""))}
        className={cn(
          "min-h-32 w-full resize-y rounded-md border bg-transparent px-3 py-2 text-base shadow-xs outline-none transition-colors focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-red-500/60 md:text-sm dark:bg-input/30",
          textareaClassName,
        )}
        {...props}
      />
      <p id={`${id}-summary`} className={cn("text-xs", bad ? "font-medium text-red-700 dark:text-red-400" : unverified ? "text-amber-700 dark:text-amber-400" : "text-muted-foreground")}>
        {summary}
      </p>

      {rows.length > 0 && (
        <ul ref={listRef} className="grid gap-1.5">
          <AnimatePresence initial={false}>
            {visible.map(({ r, s }, i) => {
              const Icon = ICON[r.kind]
              const l = r.key ? lookups[r.key] : undefined
              return (
                <motion.li
                  key={r.id}
                  data-ref={r.id}
                  layout={!reduce}
                  initial={reduce ? { opacity: 0 } : { opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0, transition: { delay: reduce ? 0 : Math.min(i, 5) * 0.04 } }}
                  exit={{ opacity: 0, transition: { duration: 0.12 } }}
                  className={cn("grid min-w-0 gap-1.5 rounded-md border p-2.5", TONE[s])}
                >
                  <div className="flex min-w-0 items-start gap-2">
                    <Icon aria-hidden className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                    <div className="grid min-w-0 flex-1 gap-0.5">
                      <span className="flex flex-wrap items-center gap-x-2 text-xs">
                        <span className="text-muted-foreground">{m.kind[r.kind]}</span>
                        <span className={cn("inline-flex items-center gap-1 font-medium", PILL[s])}>
                          {s === "checking" ? <Loader2 aria-hidden className="size-3 animate-spin" /> : s === "verified" ? <Check aria-hidden className="size-3" /> : s === "unverified" || s === "off" ? <CircleHelp aria-hidden className="size-3" /> : <XCircle aria-hidden className="size-3" />}
                          {m.status[s]}
                        </span>
                      </span>
                      <span className={cn("line-clamp-2 text-sm break-words [overflow-wrap:anywhere]", (r.kind === "doi" || r.kind === "url" || r.kind === "marker") && "font-mono text-xs")}>{r.text}</span>
                      {r.issues.map((iss) => (
                        <span key={iss.code} className="text-xs text-muted-foreground">
                          {m.issue[iss.code] ? fill(m.issue[iss.code]!, iss.vars ?? {}) : iss.message}
                        </span>
                      ))}
                      {s === "missing" && <span className="text-xs text-muted-foreground">{fill(m.missing, { source: sourceName })}</span>}
                      {l?.state === "found" && l.title && (
                        <span className="flex min-w-0 items-center gap-1 text-xs text-muted-foreground">
                          {l.url ? (
                            <a href={l.url} target="_blank" rel="noreferrer" className="inline-flex min-w-0 items-center gap-1 underline-offset-2 outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50">
                              <span className="truncate">{l.title}</span>
                              <ExternalLink aria-hidden className="size-3 shrink-0" />
                            </a>
                          ) : (
                            <span className="truncate">{l.title}</span>
                          )}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5 pl-6">
                    {r.fix !== undefined && (
                      <button type="button" data-fix onClick={() => repair(r)} className={chip}>
                        {r.fix ? <Wrench aria-hidden className="size-3.5" /> : <Trash2 aria-hidden className="size-3.5" />}
                        {r.fix ? m.fix : m.remove}
                      </button>
                    )}
                    <button type="button" onClick={() => show(r)} className={chip}>
                      {m.show}
                    </button>
                  </div>
                </motion.li>
              )
            })}
          </AnimatePresence>
          {!all && rows.length > visible.length && (
            <li>
              <button type="button" onClick={() => setAll(true)} className={chip}>
                {fill(m.more, { count: rows.length - visible.length })}
              </button>
            </li>
          )}
        </ul>
      )}

      {onSubmit && (
        <div className="grid gap-1.5">
          <button
            ref={submitRef}
            type="button"
            disabled={submitting}
            aria-describedby={armed ? `${id}-confirm` : undefined}
            onClick={submit}
            className={cn(
              "inline-flex h-9 w-fit max-w-full items-center gap-2 rounded-md px-4 text-sm font-medium shadow-xs outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-60",
              armed ? "bg-destructive text-white hover:bg-destructive/90" : "bg-primary text-primary-foreground hover:bg-primary/90",
            )}
          >
            {submitting && <Loader2 aria-hidden className="size-4 animate-spin" />}
            {submitting ? m.submitting : armed ? m.submitAnyway : m.submit}
          </button>
          {armed && (
            <p id={`${id}-confirm`} role="alert" className="text-xs text-red-700 dark:text-red-400">
              {fill(m.confirm, { count: bad + unverified })}
            </p>
          )}
        </div>
      )}
      <span role="status" className="sr-only">{status}</span>
    </div>
  )
}
