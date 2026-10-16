"use client"

import * as React from "react"
import { AtSign, Eye, Forward, LoaderCircle, Paperclip, StickyNote } from "lucide-react"

import { cn } from "@/lib/utils"

export interface ThreadAttachment {
  id: string
  name: string
  /** Shown next to the name, e.g. "2.4 MB". */
  size?: string
}

export interface ThreadMessage {
  id: string
  from: { name?: string; email: string }
  to: string[]
  cc?: string[]
  /** Display date, e.g. "12 Oct, 4:10 pm". */
  date: string
  body: string
  /** A team-only note in the thread (helpdesks, shared inboxes). Trimmed by default. */
  internal?: boolean
  attachments?: ThreadAttachment[]
}

export interface ForwardSelection {
  messageIds: string[]
  attachmentIds: string[]
  /** Replace other people's addresses with their names in the forward. */
  hideAddresses: boolean
}

const EMAIL = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g
const lower = (list: string[]) => list.map((e) => e.toLowerCase())

/** Who on the new recipient list was already on this message. */
export const seenBy = (message: ThreadMessage, recipients: string[]) => {
  const on = lower([message.from.email, ...message.to, ...(message.cc ?? [])])
  return recipients.filter((r) => on.includes(r.toLowerCase()))
}

/** What the forward newly shows: messages, notes, files and other people's addresses that at least one new recipient wasn't on. */
export function forwardExposure(messages: ThreadMessage[], recipients: string[], selection: ForwardSelection, self?: string) {
  const fresh = messages.filter((m) => selection.messageIds.includes(m.id) && seenBy(m, recipients).length < recipients.length)
  const skip = lower([...recipients, ...(self ? [self] : [])])
  const addresses = new Set<string>()
  for (const m of fresh)
    for (const email of [m.from.email, ...m.to, ...(m.cc ?? []), ...(m.body.match(EMAIL) ?? [])])
      if (!skip.includes(email.toLowerCase())) addresses.add(email.toLowerCase())
  return {
    messages: fresh.filter((m) => !m.internal).length,
    notes: fresh.filter((m) => m.internal).length,
    attachments: fresh.flatMap((m) => m.attachments ?? []).filter((a) => selection.attachmentIds.includes(a.id)).length,
    addresses: selection.hideAddresses ? 0 : addresses.size,
    hiddenAddresses: addresses.size,
  }
}

/** Everything except internal notes (and their files). */
export const defaultForwardSelection = (messages: ThreadMessage[]): ForwardSelection => {
  const kept = messages.filter((m) => !m.internal)
  return { messageIds: kept.map((m) => m.id), attachmentIds: kept.flatMap((m) => (m.attachments ?? []).map((a) => a.id)), hideAddresses: false }
}

export interface ForwardGuardProps extends Omit<React.ComponentProps<"div">, "defaultValue"> {
  /** The thread, oldest first. */
  messages: ThreadMessage[]
  /** Addresses the thread is being forwarded or shared to. */
  recipients: string[]
  /** Your own address, never counted as exposed. */
  self?: string
  /** What goes along (controlled). */
  value?: ForwardSelection
  /** Starting selection. Defaults to everything except internal notes. */
  defaultValue?: ForwardSelection
  onValueChange?: (value: ForwardSelection) => void
  /** Sends the forward. Return a promise to show a pending state. */
  onForward?: (selection: ForwardSelection) => void | Promise<void>
  /** Templates: `{who}` is the new recipients. */
  headline?: string
  forwardLabel?: string
  hideAddressesLabel?: string
  /** Override any other string, including the plural forms. */
  labels?: Partial<typeof FORWARD_GUARD_LABELS>
}

const plural = (one: string, many: string) => (count: number) => `${count} ${count === 1 ? one : many}`

/** Every other user-visible string. Counts are functions so languages can pluralise their own way. */
export const FORWARD_GUARD_LABELS = {
  newPeople: (count: number) => `${count} new people`,
  messages: plural("message", "messages"),
  notes: plural("internal note", "internal notes"),
  attachments: plural("attachment", "attachments"),
  addresses: plural("other address", "other addresses"),
  nothingNew: "Nothing they haven't seen.",
  internal: "Internal note",
  alreadySeen: "Already seen",
  seenBy: (names: string) => `Seen by ${names}`,
  include: (name: string) => `Include ${name}`,
  /** Follows `forwardLabel` on the button: "Forward all", "Forward 3 of 4". */
  scope: (kept: number, total: number) => (kept === total ? "all" : `${kept} of ${total}`),
}
const checkbox = "size-4 shrink-0 accent-primary rounded outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"

/**
 * Before a thread is forwarded or shared, lists what the new recipients will
 * see that they didn't before: earlier messages, internal notes, attachments
 * and other people's addresses. Messages they were already on don't count,
 * internal notes start trimmed, and each item can be dropped in one tap.
 */
export function ForwardGuard({
  messages,
  recipients,
  self,
  value,
  defaultValue,
  onValueChange,
  onForward,
  headline = "{who} will see for the first time:",
  forwardLabel = "Forward",
  hideAddressesLabel = "Hide other people's addresses",
  labels,
  className,
  ...props
}: ForwardGuardProps) {
  const [inner, setInner] = React.useState(() => defaultValue ?? defaultForwardSelection(messages))
  const [pending, setPending] = React.useState(false)
  const baseId = React.useId()
  const t = { ...FORWARD_GUARD_LABELS, ...labels }
  const selection = value ?? inner
  const update = (patch: Partial<ForwardSelection>) => {
    const next = { ...selection, ...patch }
    if (value === undefined) setInner(next)
    onValueChange?.(next)
  }
  const toggle = (list: string[], id: string, on: boolean) => (on ? [...list, id] : list.filter((x) => x !== id))
  const toggleMessage = (m: ThreadMessage, on: boolean) =>
    update({
      messageIds: toggle(selection.messageIds, m.id, on),
      attachmentIds: (m.attachments ?? []).reduce((ids, a) => toggle(ids.filter((x) => x !== a.id), a.id, on), selection.attachmentIds),
    })

  const exposure = forwardExposure(messages, recipients, selection, self)
  const who = recipients.length === 1 ? recipients[0] : t.newPeople(recipients.length)
  const kept = selection.messageIds.length
  const chips = [
    { key: "messages", icon: Eye, label: t.messages(exposure.messages), count: exposure.messages, danger: false },
    { key: "notes", icon: StickyNote, label: t.notes(exposure.notes), count: exposure.notes, danger: true },
    { key: "attachments", icon: Paperclip, label: t.attachments(exposure.attachments), count: exposure.attachments, danger: false },
    { key: "addresses", icon: AtSign, label: t.addresses(exposure.addresses), count: exposure.addresses, danger: false },
  ].filter((c) => c.count > 0)

  const forward = async () => {
    setPending(true)
    try {
      await onForward?.(selection)
    } catch {
      // The caller reports the error; the guard becomes usable again.
    } finally {
      setPending(false)
    }
  }

  return (
    <div data-slot="forward-guard" className={cn("w-full max-w-lg overflow-hidden rounded-lg border bg-background text-sm", className)} {...props}>
      <style>{`@keyframes cui-forward-guard-pop{from{transform:scale(1.25)}}`}</style>
      <div
        aria-live="polite"
        className={cn(
          "border-b px-3 py-2.5 transition-colors",
          exposure.notes ? "bg-red-500/10 text-red-950 dark:text-red-50" : "bg-amber-500/10 text-amber-950 dark:text-amber-50"
        )}
      >
        <p className="font-medium break-all">{headline.replace("{who}", who)}</p>
        <ul className="mt-1.5 flex flex-wrap gap-1.5">
          {chips.map(({ key, icon: Icon, label, count, danger }) => (
            <li
              key={key}
              className={cn(
                "inline-flex h-6 items-center gap-1 rounded-full border px-2 text-xs font-medium",
                danger ? "border-red-500/40 text-red-800 dark:text-red-200" : "border-amber-500/40 text-amber-900 dark:text-amber-100"
              )}
            >
              <Icon aria-hidden className="size-3.5" />
              <span key={count} className="inline-block motion-safe:animate-[cui-forward-guard-pop_250ms_ease-out]">
                {label}
              </span>
            </li>
          ))}
          {chips.length === 0 && <li className="text-xs">{t.nothingNew}</li>}
        </ul>
      </div>

      <ol className="divide-y">
        {messages.map((m) => {
          const on = selection.messageIds.includes(m.id)
          const seen = seenBy(m, recipients)
          const id = `${baseId}-${m.id}`
          return (
            <li key={m.id} className={cn("px-3 py-2 transition-[opacity,background-color] duration-200", m.internal && on && "bg-red-500/5", !on && "opacity-55")}>
              <div className="flex items-start gap-2.5">
                <input id={id} type="checkbox" checked={on} onChange={(e) => toggleMessage(m, e.target.checked)} className={cn(checkbox, "mt-0.5")} />
                <label htmlFor={id} className="min-w-0 flex-1 cursor-pointer">
                  <span className="flex flex-wrap items-baseline gap-x-2">
                    <span className={cn("font-medium transition-colors", !on && "line-through decoration-foreground/40")}>{m.from.name ?? m.from.email}</span>
                    <span className="text-xs text-muted-foreground">{m.date}</span>
                    {m.internal && <span className="text-xs font-medium text-red-700 dark:text-red-400">{t.internal}</span>}
                    {seen.length > 0 && (
                      <span className="text-xs text-muted-foreground">{seen.length === recipients.length ? t.alreadySeen : t.seenBy(seen.join(", "))}</span>
                    )}
                  </span>
                  <span
                    className={cn(
                      "grid transition-[grid-template-rows] duration-200 ease-out motion-reduce:transition-none",
                      on ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
                    )}
                  >
                    <span className="truncate overflow-hidden text-muted-foreground">{m.body}</span>
                  </span>
                </label>
              </div>
              {on && (m.attachments?.length ?? 0) > 0 && (
                <div className="mt-1.5 flex flex-wrap gap-1.5 pl-6.5">
                  {m.attachments!.map((a) => {
                    const attached = selection.attachmentIds.includes(a.id)
                    return (
                      <label
                        key={a.id}
                        className={cn(
                          "inline-flex h-7 max-w-full cursor-pointer items-center gap-1.5 rounded-md border px-2 text-xs transition-opacity has-focus-visible:ring-[3px] has-focus-visible:ring-ring/50",
                          !attached && "opacity-55"
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={attached}
                          onChange={(e) => update({ attachmentIds: toggle(selection.attachmentIds, a.id, e.target.checked) })}
                          aria-label={t.include(a.name)}
                          className="sr-only"
                        />
                        <Paperclip aria-hidden className="size-3.5 shrink-0" />
                        <span className={cn("truncate", !attached && "line-through")}>{a.name}</span>
                        {a.size && <span className="shrink-0 text-muted-foreground">{a.size}</span>}
                      </label>
                    )
                  })}
                </div>
              )}
            </li>
          )
        })}
      </ol>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-t bg-muted/40 px-3 py-2">
        <label className={cn("flex min-w-0 flex-1 basis-48 cursor-pointer items-center gap-2 text-xs", exposure.hiddenAddresses === 0 && "opacity-55")}>
          <input
            type="checkbox"
            checked={selection.hideAddresses}
            disabled={exposure.hiddenAddresses === 0}
            onChange={(e) => update({ hideAddresses: e.target.checked })}
            className={checkbox}
          />
          {hideAddressesLabel}
          {exposure.hiddenAddresses > 0 && <span className="text-muted-foreground">({exposure.hiddenAddresses})</span>}
        </label>
        <button
          type="button"
          disabled={kept === 0 || pending}
          aria-busy={pending || undefined}
          onClick={() => void forward()}
          className="ml-auto inline-flex h-9 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium whitespace-nowrap text-primary-foreground shadow-xs transition-colors outline-none hover:bg-primary/90 focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50"
        >
          {pending ? <LoaderCircle aria-hidden className="size-4 animate-spin" /> : <Forward aria-hidden className="size-4" />}
          {forwardLabel} {t.scope(kept, messages.length)}
        </button>
      </div>
    </div>
  )
}
