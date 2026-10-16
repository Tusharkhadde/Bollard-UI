"use client"

// Bollard UI — terms-changes · MIT licence · https://bollard-ui.vercel.app/components/terms-changes

import * as React from "react"
import { ArrowDown, Check, Hash, LoaderCircle } from "lucide-react"

import { cn } from "@/lib/utils"
import { diffWords, summarizeDiff } from "@/registry/default/text-diff/text-diff"

export interface TermsVersion {
  /** Version label, e.g. "v3.0". Recorded on accept. */
  version: string
  /** Full text of this version. */
  text: string
  /** When it was accepted (previous version) or takes effect (new version), e.g. "4 Mar 2025". */
  date: string
}

/** What `onAccept` receives: store it as the consent record. */
export interface TermsAcceptance {
  version: string
  previousVersion: string
  acceptedAt: string
  /** How many changes were on screen long enough to read before accepting. */
  changesViewed: number
}

type Segment = { type: "equal"; text: string } | { type: "change"; removed: string; added: string }

/** Turns a word diff into unchanged runs and changes, each change being one removal and/or its replacement. */
export function termsSegments(before: string, after: string): Segment[] {
  const segments: Segment[] = []
  for (const part of diffWords(before, after)) {
    const last = segments[segments.length - 1]
    if (part.type === "equal") segments.push({ type: "equal", text: part.value })
    else if (last?.type === "change" && part.type === "insert" && !last.added) last.added = part.value
    else segments.push({ type: "change", removed: part.type === "delete" ? part.value : "", added: part.type === "insert" ? part.value : "" })
  }
  return segments
}

const fill = (template: string, values: Record<string, string | number>) =>
  template.replace(/\{(\w+)\}/g, (match, key: string) => String(values[key] ?? match))

const action =
  "inline-flex h-9 items-center justify-center gap-1.5 rounded-md px-4 text-sm font-medium whitespace-nowrap outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50"

export interface TermsChangesProps extends Omit<React.ComponentProps<"section">, "children"> {
  /** Document name, e.g. "Terms of Service". */
  title: string
  /** The version this person accepted last. */
  accepted: TermsVersion
  /** The version they're asked to accept. */
  current: TermsVersion
  /** Plain-language bullets. They must match the wording changes shown below them. */
  summary: string[]
  /** Records consent. Return a promise to show a pending state; a rejection lets them try again. */
  onAccept: (record: TermsAcceptance) => void | Promise<void>
  /** Optional "Not now" action. */
  onDecline?: () => void
  /** How long (ms) a change must stay on screen to count as viewed, so scrolling past doesn't count. */
  dwell?: number
  /** Unchanged runs longer than this many words are folded. */
  foldAfter?: number
  /** Templates: `{title}`, `{from}`, `{fromDate}`, `{to}`, `{toDate}`, `{seen}`, `{total}`, `{count}` are filled in. */
  headingText?: string
  /** Intro line above the changes. */
  introText?: string
  /** Heading of the plain-language summary. */
  summaryLabel?: string
  /** Accessible label of the changes region. */
  changesLabel?: string
  /** Progress text. `{seen}` and `{total}` are filled in. */
  progressText?: string
  /** Label of the jump-to-next-unread button. */
  nextLabel?: string
  /** Label of the Accept button. */
  acceptLabel?: string
  /** Says how many changes are still unread. */
  remainingText?: string
  /** Shown after accepting. */
  acceptedText?: string
  /** Label of the Decline button. */
  declineLabel?: string
  /** Label for folded unchanged text. */
  foldText?: string
}

/**
 * Stops people re-accepting updated terms blind, and gives you proof they
 * didn't. It shows the summary and the exact word changes since the version
 * they accepted, calls out changed numbers (30 days → 14 days), and keeps
 * Accept locked until every change has stayed on screen long enough to read.
 * Tapping Accept early jumps to the next unread change. `onAccept` receives
 * the version accepted, the one it replaced, a timestamp and the count viewed.
 */
export function TermsChanges({
  title,
  accepted,
  current,
  summary,
  onAccept,
  onDecline,
  dwell = 800,
  foldAfter = 80,
  headingText = "Our {title} changed",
  introText = "You accepted {from} ({fromDate}). Here's exactly what changed in {to}, effective {toDate}.",
  summaryLabel = "In short",
  changesLabel = "Exact wording changes",
  progressText = "{seen} of {total} read",
  nextLabel = "Next change",
  acceptLabel = "Accept {to}",
  remainingText = "Read the highlighted changes first ({count} left).",
  acceptedText = "You accepted {to}.",
  declineLabel = "Not now",
  foldText = "{count} unchanged words",
  className,
  ...props
}: TermsChangesProps) {
  const segments = React.useMemo(() => termsSegments(accepted.text, current.text), [accepted.text, current.text])
  const numbers = React.useMemo(() => summarizeDiff(diffWords(accepted.text, current.text)).numbers, [accepted.text, current.text])
  const total = segments.filter((s) => s.type === "change").length
  const [seen, setSeen] = React.useState<ReadonlySet<number>>(new Set())
  const [unfolded, setUnfolded] = React.useState<ReadonlySet<number>>(new Set())
  const [nudge, setNudge] = React.useState(false)
  const [status, setStatus] = React.useState<"idle" | "pending" | "accepted">("idle")
  const scrollRef = React.useRef<HTMLDivElement>(null)
  const changeRefs = React.useRef(new Map<number, HTMLElement>())
  const headingId = React.useId()

  // A change counts once it has stayed in view for `dwell` ms.
  React.useEffect(() => {
    const root = scrollRef.current
    if (!root) return
    if (typeof IntersectionObserver === "undefined") return setSeen(new Set(changeRefs.current.keys()))
    const timers = new Map<Element, ReturnType<typeof setTimeout>>()
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const index = Number((entry.target as HTMLElement).dataset.change)
          clearTimeout(timers.get(entry.target))
          if (entry.isIntersecting) timers.set(entry.target, setTimeout(() => setSeen((s) => new Set(s).add(index)), dwell))
        }
      },
      { root, threshold: 0.9 },
    )
    changeRefs.current.forEach((el) => observer.observe(el))
    return () => {
      observer.disconnect()
      timers.forEach(clearTimeout)
    }
  }, [segments, unfolded, dwell])

  const left = total - seen.size
  const values = { title, from: accepted.version, fromDate: accepted.date, to: current.version, toDate: current.date, seen: seen.size, total, count: left }

  const jumpToUnseen = () => {
    const root = scrollRef.current
    const target = [...changeRefs.current].sort(([a], [b]) => a - b).find(([index]) => !seen.has(index))?.[1]
    if (!root || !target) return
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    root.scrollTo({ top: target.offsetTop - root.clientHeight / 3, behavior: reduce ? "auto" : "smooth" })
    if (!reduce) target.animate({ outlineColor: ["rgb(245 158 11 / 0.9)", "rgb(245 158 11 / 0)"] }, { duration: 900, easing: "ease-out" })
  }

  const accept = async () => {
    if (status === "pending") return
    if (left > 0) {
      setNudge(true)
      return jumpToUnseen()
    }
    setStatus("pending")
    try {
      await onAccept({ version: current.version, previousVersion: accepted.version, acceptedAt: new Date().toISOString(), changesViewed: seen.size })
      setStatus("accepted")
    } catch {
      setStatus("idle")
    }
  }

  const fold = (text: string, index: number) => {
    const words = text.split(/(\s+)/)
    if (unfolded.has(index) || words.length <= foldAfter * 2) return text
    const keep = 10
    return (
      <>
        {words.slice(0, keep).join("")}
        <button
          type="button"
          onClick={() => setUnfolded((u) => new Set(u).add(index))}
          className="mx-1 rounded-sm bg-muted px-1.5 text-xs font-medium text-muted-foreground outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          {fill(foldText, { count: Math.round((words.length - keep * 2) / 2) })}
        </button>
        {words.slice(-keep).join("")}
      </>
    )
  }

  return (
    <section data-slot="terms-changes" data-state={status === "accepted" ? "accepted" : left ? "reviewing" : "ready"} aria-labelledby={headingId} className={cn("grid gap-3 rounded-xl border bg-card p-4 text-sm text-card-foreground", className)} {...props}>
      <div className="grid gap-1">
        <h2 id={headingId} className="text-base font-semibold">{fill(headingText, values)}</h2>
        <p className="text-muted-foreground">{fill(introText, values)}</p>
      </div>
      <div className="grid gap-1.5">
        <h3 className="text-xs font-medium text-muted-foreground">{summaryLabel}</h3>
        <ul className="grid list-disc gap-1 pl-5 marker:text-muted-foreground">
          {summary.map((item) => <li key={item}>{item}</li>)}
        </ul>
      </div>
      <div className="overflow-hidden rounded-lg border">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b bg-muted/40 px-3 py-2 text-xs font-medium">
          <span>{changesLabel}</span>
          {numbers.length > 0 && (
            <span className="inline-flex items-center gap-1 rounded-md bg-amber-100 px-2 py-0.5 text-amber-900 dark:bg-amber-500/15 dark:text-amber-200">
              <Hash aria-hidden className="size-3" />
              <span className="font-mono">{numbers.map((n) => `${n.from} → ${n.to}`).join(", ")}</span>
            </span>
          )}
          <span className="ml-auto text-muted-foreground tabular-nums" aria-live="polite">{fill(progressText, values)}</span>
        </div>
        <div className="h-0.5 bg-muted" aria-hidden>
          <div className="h-full bg-emerald-500 transition-[width] duration-300 ease-out motion-reduce:transition-none" style={{ width: `${total ? (seen.size / total) * 100 : 100}%` }} />
        </div>
        <div ref={scrollRef} tabIndex={0} aria-label={changesLabel} className="relative max-h-48 overflow-y-auto px-3 py-2.5 leading-relaxed whitespace-pre-wrap outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:ring-inset">
          {segments.map((segment, index) =>
            segment.type === "equal" ? (
              <span key={index}>{fold(segment.text, index)}</span>
            ) : (
              <span
                key={index}
                data-change={index}
                data-seen={seen.has(index) || undefined}
                ref={(el) => {
                  if (el) changeRefs.current.set(index, el)
                  else changeRefs.current.delete(index)
                }}
                className="rounded-sm outline-2 outline-offset-1 outline-transparent"
              >
                {segment.removed && (
                  <del className="rounded-sm bg-red-500/15 text-red-800 decoration-red-500/60 dark:text-red-300">
                    <span className="sr-only">removed: </span>
                    {segment.removed}
                  </del>
                )}
                {segment.removed && segment.added && " "}
                {segment.added && (
                  <ins className="rounded-sm bg-emerald-500/15 text-emerald-800 no-underline dark:text-emerald-300">
                    <span className="sr-only">added: </span>
                    {segment.added}
                  </ins>
                )}
                {seen.has(index) && <Check aria-label="read" className="ml-0.5 inline size-3 align-baseline text-emerald-600 dark:text-emerald-400" />}
              </span>
            ),
          )}
        </div>
      </div>
      {status === "accepted" ? (
        <p className="flex items-center gap-1.5 font-medium text-emerald-700 dark:text-emerald-400" role="status">
          <Check aria-hidden className="size-4" />
          {fill(acceptedText, values)}
        </p>
      ) : (
        <div className="grid gap-1.5">
          <div className="flex flex-wrap items-center justify-end gap-2">
            {left > 0 && (
              <button type="button" onClick={jumpToUnseen} className={cn(action, "mr-auto px-2 hover:bg-accent")}>
                <ArrowDown aria-hidden className="size-4" />
                {nextLabel}
              </button>
            )}
            {onDecline && (
              <button type="button" onClick={onDecline} className={cn(action, "border bg-background shadow-xs hover:bg-accent dark:bg-input/30")}>
                {declineLabel}
              </button>
            )}
            <button
              type="button"
              aria-disabled={left > 0 || status === "pending"}
              aria-describedby={left > 0 ? `${headingId}-left` : undefined}
              onClick={accept}
              className={cn(action, "bg-primary text-primary-foreground shadow-xs hover:bg-primary/90 aria-disabled:opacity-50")}
            >
              {status === "pending" && <LoaderCircle aria-hidden className="size-4 animate-spin" />}
              {fill(acceptLabel, values)}
            </button>
          </div>
          {left > 0 && (
            <p id={`${headingId}-left`} aria-live="polite" className={cn("text-right text-xs", nudge ? "text-amber-800 dark:text-amber-300" : "text-muted-foreground")}>
              {fill(remainingText, values)}
            </p>
          )}
        </div>
      )}
    </section>
  )
}
