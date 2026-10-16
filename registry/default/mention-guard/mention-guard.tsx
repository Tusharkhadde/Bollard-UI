"use client"

import * as React from "react"
import { BellRing, LoaderCircle, SendHorizontal, UserX } from "lucide-react"

import { cn } from "@/lib/utils"

export interface MentionAudience {
  /** How many people it notifies. */
  count: number
  /** How many of them are in a different time zone from you. */
  otherTimeZones?: number
}
export interface MentionPerson {
  handle: string
  name: string
  /** Already a member of this conversation. */
  inConversation: boolean
  /** False when they can't open this conversation at all (a private channel). */
  canAccess?: boolean
}
export interface MentionContext {
  /** Audiences for @channel, @here, @everyone and group handles ("design-team"), keyed without the @. */
  audiences: Record<string, MentionAudience>
  people?: MentionPerson[]
}
export type MentionIssue = { kind: "broadcast"; handle: string; audience: MentionAudience } | { kind: "outsider"; handle: string; person: MentionPerson }

/**
 * Finds @mentions that need a second look: anything reaching a large audience and
 * people who aren't in the conversation. Ignores emails (a@here.com) and code
 * (`@channel` in backticks doesn't notify anyone). Largest audience first.
 */
export function findMentionIssues(text: string, ctx: MentionContext, threshold = 6): MentionIssue[] {
  const prose = text.replace(/```[\s\S]*?```|`[^`\n]*`/g, (code) => " ".repeat(code.length))
  const seen = new Set<string>()
  const issues: MentionIssue[] = []
  for (const [, raw] of prose.matchAll(/(?<![\w@.])@([\w][\w.-]*)/g)) {
    const handle = raw.replace(/[.-]+$/, "")
    const key = handle.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    const audience = Object.entries(ctx.audiences).find(([k]) => k.toLowerCase() === key)?.[1]
    if (audience && audience.count >= threshold) issues.push({ kind: "broadcast", handle, audience })
    const person = ctx.people?.find((p) => p.handle.toLowerCase() === key)
    if (person && !person.inConversation) issues.push({ kind: "outsider", handle, person })
  }
  return issues.sort((a, b) => (b.kind === "broadcast" ? b.audience.count : 0) - (a.kind === "broadcast" ? a.audience.count : 0))
}

/** Replaces every live `@handle` with `replacement` (default: the bare word, so nobody is notified). */
export function replaceMention(text: string, handle: string, replacement = handle) {
  const escaped = handle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  return text.replace(new RegExp(`(?<![\\w@.])@${escaped}(?![\\w])`, "gi"), replacement)
}

const fill = (template: string, values: Record<string, string>) => template.replace(/\{(\w+)\}/g, (m, k: string) => values[k] ?? m)
const fixClass =
  "inline-flex h-6 items-center gap-1 rounded-md border border-amber-500/40 px-2 font-medium text-amber-900 transition-colors hover:bg-amber-500/10 dark:text-amber-200 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
const btn =
  "inline-flex h-8 items-center justify-center gap-1.5 rounded-md px-3 text-sm font-medium whitespace-nowrap outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50"

export interface MentionGuardProps extends Omit<React.ComponentProps<"div">, "defaultValue" | "onSubmit"> {
  /** Controlled message text. */
  value?: string
  /** Initial text when uncontrolled. */
  defaultValue?: string
  /** Called with the text on every change. */
  onValueChange?: (value: string) => void
  /** Sends the message. Return a promise to show a pending state; the text clears when it resolves. */
  onSend: (text: string) => void | Promise<void>
  /** Invites a mentioned person into the conversation. Without it, only "Remove mention" is offered. */
  onInvite?: (person: MentionPerson) => void
  /** Where the message goes, e.g. "#launch". */
  conversation: string
  /** Who each @handle reaches, plus the people directory. */
  context: MentionContext
  /** Audiences at or above this size need a confirm before sending. Slack uses 6. */
  threshold?: number
  /** Handle to suggest instead of a broadcast, e.g. "here" (only people online). */
  softerHandle?: string
  /** Enter sends and Shift+Enter adds a line. Off: only Ctrl/⌘+Enter sends. */
  sendOnEnter?: boolean
  /** Visible label. */
  label?: string
  /** Textarea placeholder. */
  placeholder?: string
  /** Templates. `{handle}`, `{count}`, `{zones}`, `{name}` and `{conversation}` are filled in. */
  broadcastText?: string
  /** Template for how many are in other time zones. */
  zonesText?: string
  /** Shown for a mentioned person not in the conversation. */
  outsiderText?: string
  /** Shown when a mentioned person can't open the conversation. */
  noAccessText?: string
  /** Button text to swap for the softer handle. */
  softerLabel?: string
  /** Button text to mention without notifying. */
  silenceLabel?: string
  /** Button text to invite a mentioned person. */
  inviteLabel?: string
  /** Button text to remove a mention. */
  removeLabel?: string
  /** Send button text. */
  sendLabel?: string
  /** Confirm button template for a broadcast. */
  confirmLabel?: string
  /** Confirm button text when outsiders are mentioned. */
  confirmOutsiderLabel?: string
  /** Cancel button text while armed. */
  cancelLabel?: string
  /** Button text while sending. */
  sendingLabel?: string
  /** Read to screen readers when Send asks for a second press. */
  armedHint?: string
}

/**
 * A composer that won't ping 1,240 people by accident. As you type it says who
 * each @channel, @everyone or group mention reaches, and how many are in other
 * time zones, with one-tap fixes (@here, or don't notify). It flags anyone
 * mentioned who isn't in the conversation, and turns Send into an explicit
 * "Notify 1,240 people" that a double press or held Enter can't confirm.
 */
export function MentionGuard({
  value,
  defaultValue = "",
  onValueChange,
  onSend,
  onInvite,
  conversation,
  context,
  threshold = 6,
  softerHandle = "here",
  sendOnEnter = true,
  label = "Message",
  placeholder,
  broadcastText = "@{handle} notifies {count} people",
  zonesText = ", {zones} in other time zones",
  outsiderText = "{name} isn't in {conversation} and won't be notified.",
  noAccessText = "{name} can't see {conversation}, so they won't see this.",
  softerLabel = "Use @{handle} ({count})",
  silenceLabel = "Don't notify",
  inviteLabel = "Invite {name}",
  removeLabel = "Remove mention",
  sendLabel = "Send",
  confirmLabel = "Notify {count} people",
  confirmOutsiderLabel = "Send anyway",
  cancelLabel = "Edit",
  sendingLabel = "Sending…",
  armedHint = "Check the warnings, then press Send again. Escape to keep editing.",
  className,
  ...props
}: MentionGuardProps) {
  const [inner, setInner] = React.useState(defaultValue)
  const text = value ?? inner
  const [armedFor, setArmedFor] = React.useState<string>()
  const [pending, setPending] = React.useState(false)
  const armedAt = React.useRef(0)
  const areaRef = React.useRef<HTMLTextAreaElement>(null)
  const noticeRef = React.useRef<HTMLDivElement>(null)
  const id = React.useId()
  const fmt = (n: number) => n.toLocaleString()

  const update = (next: string) => {
    if (value === undefined) setInner(next)
    onValueChange?.(next)
  }
  const issues = React.useMemo(() => findMentionIssues(text, context, threshold), [text, context, threshold])
  const broadcast = issues.find((i) => i.kind === "broadcast")
  const armed = armedFor === text && issues.length > 0
  const softer = context.audiences[softerHandle]

  React.useEffect(() => {
    if (!armed || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return
    noticeRef.current?.animate(
      [{ transform: "translateX(0)" }, { transform: "translateX(-3px)" }, { transform: "translateX(3px)" }, { transform: "translateX(0)" }],
      { duration: 240, easing: "ease-out" },
    )
  }, [armed])

  const send = async () => {
    if (pending || !text.trim()) return
    if (issues.length && !armed) {
      armedAt.current = performance.now()
      setArmedFor(text)
      return
    }
    if (armed && performance.now() - armedAt.current < 400) return // a double press can't confirm
    setPending(true)
    try {
      await onSend(text)
      update("")
      setArmedFor(undefined)
    } catch {
      // The caller shows the error; the draft stays.
    } finally {
      setPending(false)
    }
  }
  const fix = (next: string) => {
    update(next)
    areaRef.current?.focus()
  }

  return (
    <div data-slot="mention-guard" data-state={armed ? "confirming" : "idle"} className={cn("grid w-full max-w-md gap-1.5 text-sm", className)} {...props}>
      <label htmlFor={id} className="w-fit font-medium">
        {label}
      </label>
      <textarea
        ref={areaRef}
        id={id}
        rows={3}
        value={text}
        placeholder={placeholder ?? `Message ${conversation}`}
        onChange={(event) => update(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Escape" && armed) return setArmedFor(undefined)
          if (event.key !== "Enter" || event.nativeEvent.isComposing) return
          if (!(event.metaKey || event.ctrlKey || (sendOnEnter && !event.shiftKey))) return
          event.preventDefault()
          if (!event.repeat) void send()
        }}
        aria-describedby={`${id}-notice`}
        data-warning={issues.length ? "" : undefined}
        className="min-h-16 w-full resize-y rounded-md border bg-transparent px-3 py-2 text-base shadow-xs transition-[color,box-shadow] outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 md:text-sm dark:bg-input/30 data-warning:border-amber-500 dark:data-warning:border-amber-400"
      />
      <div ref={noticeRef} id={`${id}-notice`} aria-live="polite" className="grid gap-1 text-xs empty:hidden">
        {issues.map((issue) => {
          const isBroadcast = issue.kind === "broadcast"
          const zones = isBroadcast && issue.audience.otherTimeZones ? fill(zonesText, { zones: fmt(issue.audience.otherTimeZones) }) : ""
          const message = isBroadcast
            ? `${fill(broadcastText, { handle: issue.handle, count: fmt(issue.audience.count) })}${zones}.`
            : fill(issue.person.canAccess === false ? noAccessText : outsiderText, { name: issue.person.name, conversation })
          const Icon = isBroadcast ? BellRing : UserX
          return (
            <p key={`${issue.kind}-${issue.handle}`} className="flex gap-1.5 text-amber-700 dark:text-amber-400">
              <span className="flex h-6 shrink-0 items-center">
                <Icon aria-hidden className="size-3.5" />
              </span>
              <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                <span className="py-1">{message}</span>
                <span className="flex flex-wrap gap-1.5">
                  {isBroadcast && softer && issue.handle.toLowerCase() !== softerHandle && softer.count < issue.audience.count && (
                    <button type="button" className={fixClass} onClick={() => fix(replaceMention(text, issue.handle, `@${softerHandle}`))}>
                      {fill(softerLabel, { handle: softerHandle, count: fmt(softer.count) })}
                    </button>
                  )}
                  {!isBroadcast && onInvite && issue.person.canAccess !== false && (
                    <button type="button" className={fixClass} onClick={() => onInvite(issue.person)}>
                      {fill(inviteLabel, { name: issue.person.name.split(" ")[0] })}
                    </button>
                  )}
                  <button
                    type="button"
                    className={fixClass}
                    onClick={() => fix(replaceMention(text, issue.handle, isBroadcast ? issue.handle : issue.person.name))}
                  >
                    {isBroadcast ? silenceLabel : removeLabel}
                  </button>
                </span>
              </span>
            </p>
          )
        })}
      </div>
      <span aria-live="polite" className="sr-only">
        {armed ? armedHint : ""}
      </span>
      <div className="flex justify-end gap-2">
        {armed && (
          <button
            type="button"
            onClick={() => (setArmedFor(undefined), areaRef.current?.focus())}
            className={cn(btn, "border bg-background hover:bg-accent dark:bg-transparent")}
          >
            {cancelLabel}
          </button>
        )}
        <button
          type="button"
          onClick={() => void send()}
          disabled={!text.trim()}
          aria-busy={pending || undefined}
          className={cn(
            btn,
            armed
              ? "bg-amber-700 text-white hover:bg-amber-800 dark:bg-amber-400 dark:text-amber-950 dark:hover:bg-amber-300"
              : "bg-primary text-primary-foreground hover:bg-primary/90",
          )}
        >
          {pending ? <LoaderCircle aria-hidden className="size-4 animate-spin" /> : <SendHorizontal aria-hidden className="size-4" />}
          {pending
            ? sendingLabel
            : armed
              ? broadcast?.kind === "broadcast"
                ? fill(confirmLabel, { count: fmt(broadcast.audience.count) })
                : confirmOutsiderLabel
              : sendLabel}
        </button>
      </div>
    </div>
  )
}
