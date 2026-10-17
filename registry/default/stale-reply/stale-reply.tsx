"use client"

// Bollard UI — stale-reply · MIT licence · https://bollard-ui.vercel.app/components/stale-reply

import * as React from "react"
import { ChevronDown, CircleCheck, History, Quote, Reply, X } from "lucide-react"

import { cn } from "@/lib/utils"

export interface ThreadMessage {
  id: string
  author: string
  text: string
  sentAt: Date | number | string
  /** Id of the message this one replies to, if any. */
  replyTo?: string
}

const DAY = 86_400_000
const UNITS: [number, string][] = [[365 * DAY, "year"], [30 * DAY, "month"], [7 * DAY, "week"], [DAY, "day"], [3_600_000, "hour"], [60_000, "minute"]]

/** "3 weeks ago", "1 day ago", "just now". */
export function describeAge(ms: number) {
  for (const [size, unit] of UNITS) {
    const n = Math.floor(ms / size)
    if (n >= 1) return `${n} ${unit}${n === 1 ? "" : "s"} ago`
  }
  return "just now"
}

const STOP = new Set(["that", "this", "with", "from", "have", "will", "what", "when", "your", "about", "there", "they", "them", "just", "like", "would", "could", "should", "been", "were", "thanks"])
const words = (text: string) => new Set((text.toLowerCase().match(/[\p{L}\p{N}]{4,}/gu) ?? []).filter((word) => !STOP.has(word)))
const RESOLVED = /\b(fixed|resolved|sorted|shipped|merged|closed|done|never ?mind|nvm|figured it out|all set|no longer needed)\b/i
const time = (message: ThreadMessage) => new Date(message.sentAt).getTime()

/**
 * Newer messages that bear on the one you're replying to, newest first: direct replies, the
 * same author, or shared keywords. Falls back to the newest messages when none match.
 */
export function findRelevant(original: ThreadMessage, newer: ThreadMessage[], limit = 3) {
  const topic = words(original.text)
  const scored = newer.map((message) => {
    let score = message.replyTo === original.id ? 3 : 0
    if (message.author === original.author) score += 1
    for (const word of words(message.text)) if (topic.has(word)) score += 1
    return { message, score }
  })
  const relevant = scored.filter((entry) => entry.score > 0).map((entry) => entry.message)
  return [...(relevant.length ? relevant : newer)].sort((a, b) => time(b) - time(a)).slice(0, limit)
}

/** The newest relevant message that sounds like the matter was settled ("fixed", "merged", "nvm"). */
export const findResolution = (relevant: ThreadMessage[]) => relevant.find((message) => RESOLVED.test(message.text))

const fill = (template: string, values: Record<string, string | number>) => template.replace(/\{(\w+)\}/g, (match, key: string) => String(values[key] ?? match))

const action =
  "inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-md px-3 text-sm font-medium whitespace-nowrap outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50"

export interface StaleReplyProps extends Omit<React.ComponentProps<"div">, "children"> {
  /** The message you're replying to. */
  replyingTo: ThreadMessage
  /** Every message posted after it in the thread or channel. */
  newer: ThreadMessage[]
  /** Current time in ms. Defaults to the clock, read after mount. */
  now?: number
  /** Warn when the message is older than this (ms)… */
  staleAfter?: number
  /** …or when at least this many messages followed it. */
  minNewer?: number
  /** How many newer messages to show. */
  show?: number
  /** Called with the newest relevant message to reply to it instead. */
  onReplyToLatest?: (message: ThreadMessage) => void
  /** Reply here, quoting the original so readers have context. */
  onQuote?: (original: ThreadMessage) => void
  /** Called when the notice is dismissed. */
  onDismiss?: () => void
  /** Templates: `{age}`, `{count}`, `{author}`, `{text}`, `{when}` are filled in. */
  message?: string
  /** Marks a message that seems to have settled it. */
  resolvedText?: string
  /** Label of the reply-to-latest button. */
  latestLabel?: string
  /** Label of the quote-original button. */
  quoteLabel?: string
  /** Label of the newer-messages toggle. */
  newestLabel?: string
  /** Accessible label of the dismiss button. */
  dismissLabel?: string
  /** Accessible name of the banner. */
  regionLabel?: string
}

/**
 * Warns before you reply to a message the conversation has moved past: "This was 3 weeks ago and
 * 14 newer messages followed." It surfaces the newest messages that bear on it, spots when one
 * already settled it ("Fixed in 2.4.1"), and offers to reply to the latest or quote the original.
 */
export function StaleReply({
  replyingTo,
  newer,
  now: nowProp,
  staleAfter = 7 * DAY,
  minNewer = 10,
  show = 3,
  onReplyToLatest,
  onQuote,
  onDismiss,
  message = "This was {age} and {count} followed.",
  resolvedText = "{author} may have settled it {when}: “{text}”",
  latestLabel = "Reply to latest",
  quoteLabel = "Quote & reply",
  newestLabel = "Newest related",
  dismissLabel = "Reply here anyway",
  regionLabel = "Old message",
  className,
  ...props
}: StaleReplyProps) {
  const [clock, setClock] = React.useState<number>()
  const [open, setOpen] = React.useState(true)
  const listId = React.useId()
  React.useEffect(() => {
    if (nowProp === undefined) setClock(Date.now())
  }, [nowProp])
  const now = nowProp ?? clock
  const relevant = React.useMemo(() => findRelevant(replyingTo, newer, show), [replyingTo, newer, show])
  if (now === undefined) return null

  const age = now - time(replyingTo)
  if (age < staleAfter && newer.length < minNewer) return null
  const resolution = findResolution(relevant)
  const values = { age: describeAge(age), count: `${newer.length} newer ${newer.length === 1 ? "message" : "messages"}` }

  return (
    <div
      data-slot="stale-reply"
      role="region"
      aria-label={regionLabel}
      className={cn("overflow-hidden rounded-lg border border-amber-500/30 bg-background bg-linear-to-r from-amber-500/10 to-amber-500/10 text-sm text-amber-950 dark:text-amber-50", className)}
      {...props}
    >
      <div className="flex min-h-11 items-center gap-3 px-3 py-1.5">
        <History aria-hidden className="size-4 shrink-0 text-amber-600 dark:text-amber-400" />
        <p aria-live="polite" className="min-w-0 flex-1 font-medium">{fill(message, values)}</p>
        {onDismiss && (
          <button type="button" onClick={onDismiss} aria-label={dismissLabel} title={dismissLabel} className="grid size-8 shrink-0 place-items-center rounded-md outline-none hover:bg-amber-500/15 focus-visible:ring-[3px] focus-visible:ring-ring/50">
            <X aria-hidden className="size-4" />
          </button>
        )}
      </div>

      {resolution && (
        <p className="flex gap-2 px-3 pb-2 text-xs text-amber-900/80 dark:text-amber-100/80">
          <CircleCheck aria-hidden className="mt-px size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
          <span className="min-w-0">{fill(resolvedText, { author: resolution.author, when: describeAge(now - time(resolution)), text: resolution.text.length > 60 ? `${resolution.text.slice(0, 57)}…` : resolution.text })}</span>
        </p>
      )}

      <div className="border-t border-amber-500/20 bg-background text-foreground">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={listId}
          onClick={() => setOpen((value) => !value)}
          className="flex w-full items-center justify-between px-3 py-2 text-xs font-medium text-muted-foreground outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-inset focus-visible:ring-ring/50"
        >
          {newestLabel}
          <ChevronDown aria-hidden className={cn("size-4 transition-transform duration-200 motion-reduce:transition-none", open && "rotate-180")} />
        </button>
        <div id={listId} className={cn("grid transition-[grid-template-rows] duration-250 ease-out motion-reduce:transition-none", open ? "grid-rows-[1fr]" : "grid-rows-[0fr]")} inert={!open}>
          <ul className="min-h-0 divide-y overflow-hidden">
            {relevant.map((item) => (
              <li key={item.id} className="flex gap-2.5 px-3 py-2">
                <span aria-hidden className="grid size-6 shrink-0 place-items-center rounded-full bg-muted text-xs font-medium">{item.author.charAt(0)}</span>
                <div className="min-w-0 flex-1">
                  <p className="flex items-baseline gap-2 text-xs">
                    <span className="font-medium">{item.author}</span>
                    <span className="text-muted-foreground">{describeAge(now - time(item))}</span>
                  </p>
                  <p className="line-clamp-2 text-sm text-muted-foreground">{item.text}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
        <div className="flex flex-wrap justify-end gap-2 border-t px-3 py-2">
          {onQuote && (
            <button type="button" onClick={() => onQuote(replyingTo)} className={cn(action, "border hover:bg-accent")}>
              <Quote aria-hidden className="size-4" />
              {quoteLabel}
            </button>
          )}
          {onReplyToLatest && relevant[0] && (
            <button type="button" onClick={() => onReplyToLatest(relevant[0])} className={cn(action, "bg-amber-700 text-white hover:bg-amber-800 dark:bg-amber-400 dark:text-amber-950 dark:hover:bg-amber-300")}>
              <Reply aria-hidden className="size-4" />
              {latestLabel}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
