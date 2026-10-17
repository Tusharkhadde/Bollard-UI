"use client"

// Bollard UI — chat-audience-check · MIT licence · https://bollard-ui.vercel.app/components/chat-audience-check

import * as React from "react"
import { Building2, Check, LoaderCircle, SendHorizontal, ShieldAlert, UserRoundSearch, Users, UserX } from "lucide-react"

import { cn } from "@/lib/utils"
import { DEFAULT_CHAT_SENSITIVE_TERMS, findSensitive, flagMembers, type ChatMember, type FlaggedMember } from "./audience"

export * from "./audience"

const list = (items: string[]) => (items.length < 2 ? items.join("") : `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`)

/** Every visible string. */
export const CHAT_AUDIENCE_CHECK_MESSAGES = {
  label: (conversation: string) => `Message ${conversation}`,
  audience: (count: number) => `${count} ${count === 1 ? "person" : "people"} will read this`,
  toCheck: (count: number) => `${count} to check`,
  outsideSummary: (count: number, orgs: string[]) => `${count} ${count === 1 ? "is" : "are"} from ${list(orgs)}.`,
  outsideUnknown: "outside your organisation",
  sensitive: (terms: string[]) => `This mentions ${list(terms.map((t) => `“${t}”`))}. Check who's here before it goes.`,
  mismatch: (_name: string, savedAs: string) => `You saved this account as “${savedAs}”, a different person's name.`,
  unclear: "The name doesn't say who this is.",
  outside: (org: string) => `From ${org}.`,
  joined: (when: string, by?: string) => `Joined ${when}${by ? `, added by ${by}` : ""}, after your last message.`,
  profile: "View profile",
  remove: "Remove",
  vouch: "I know them",
  removed: (name: string) => `${name} removed from the chat.`,
  vouched: (name: string) => `${name} marked as known.`,
  send: "Send",
  confirm: (count: number) => `Send to ${count} anyway`,
  edit: "Edit",
  sending: "Sending…",
  armedHint: "Check who's in the chat, then press send again. Escape to keep editing.",
  summary: (check: number) => (check ? `${check} ${check === 1 ? "person" : "people"} in this chat to check before sending.` : ""),
  failed: "It didn't send. Your message is still here.",
}
export type ChatAudienceCheckMessages = typeof CHAT_AUDIENCE_CHECK_MESSAGES

export interface ChatAudienceCheckProps extends Omit<React.ComponentProps<"div">, "defaultValue" | "onSubmit"> {
  /** Controlled message text. */
  value?: string
  /** Initial message text when uncontrolled. */
  defaultValue?: string
  /** Called with the text on every change. */
  onValueChange?: (text: string) => void
  /** Everyone in the chat, you included (mark yourself with `isYou`). */
  members: ChatMember[]
  /** Your organisation's name as members' `org` spells it. */
  organization: string
  /** The chat's name, e.g. "#q4-deals" or "Launch core team". */
  conversation: string
  /** When you last posted here; people who joined later are called out. */
  lastPostedAt?: Date | string | number
  /** Forces the careful path (a confidential channel, a file marked internal). Otherwise the text decides. */
  sensitive?: boolean
  /** Words that make a message worth a second look. Replaces the default list. */
  sensitiveTerms?: string[]
  /** Pass for deterministic "joined 2 days ago" text. */
  now?: Date
  /** BCP 47 locale for dates. */
  locale?: string
  /** Sends the message. Return a promise for a pending state; the text clears when it resolves. */
  onSend: (text: string) => void | Promise<void>
  /** Removes someone from the chat. Without it there's no Remove button. */
  onRemove?: (member: ChatMember) => void | Promise<void>
  /** Opens someone's profile so you can see who they really are. */
  onViewProfile?: (member: ChatMember) => void
  /** Enter sends and Shift+Enter adds a line. Off: only Ctrl/⌘+Enter sends. */
  sendOnEnter?: boolean
  /** Override any visible string. */
  messages?: Partial<ChatAudienceCheckMessages>
}

const smallBtn =
  "inline-flex h-7 items-center gap-1 rounded-md border border-amber-500/40 px-2 text-xs font-medium text-amber-900 transition-colors hover:bg-amber-500/10 dark:text-amber-200 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-50"
const btn =
  "inline-flex h-9 items-center justify-center gap-2 rounded-md px-4 text-sm font-medium whitespace-nowrap shadow-xs transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50"

/**
 * A group-chat composer that shows who will actually read the message before it goes.
 * It flags members whose name disagrees with what you saved them as, names nobody
 * can identify (a bare "JG"), people who joined after your last message and people
 * from outside your organisation. Ordinary messages just get a quiet line; when the
 * text looks sensitive, or someone's identity doesn't add up, those people are listed
 * with Remove, View profile and "I know them", and sending takes a second, deliberate press.
 */
export function ChatAudienceCheck({
  value,
  defaultValue = "",
  onValueChange,
  members,
  organization,
  conversation,
  lastPostedAt,
  sensitive: forced,
  sensitiveTerms = DEFAULT_CHAT_SENSITIVE_TERMS,
  now: nowProp,
  locale = "en-IN",
  onSend,
  onRemove,
  onViewProfile,
  sendOnEnter = true,
  messages,
  className,
  "aria-describedby": describedBy,
  ...props
}: ChatAudienceCheckProps) {
  const t = { ...CHAT_AUDIENCE_CHECK_MESSAGES, ...messages }
  const [inner, setInner] = React.useState(defaultValue)
  const text = value ?? inner
  const [vouched, setVouched] = React.useState<string[]>([])
  const [busy, setBusy] = React.useState<string>()
  const [armedFor, setArmedFor] = React.useState<string>()
  const [state, setState] = React.useState<"idle" | "sending" | "failed">("idle")
  const [status, setStatus] = React.useState("")
  const [clock, setClock] = React.useState<Date>()
  const armedAt = React.useRef(0)
  const refocus = React.useRef(false)
  const listRef = React.useRef<HTMLUListElement>(null)
  const areaRef = React.useRef<HTMLTextAreaElement>(null)
  const id = React.useId()

  React.useEffect(() => {
    if (!nowProp) setClock(new Date())
  }, [nowProp])
  const now = nowProp ?? clock

  const flagged = React.useMemo(() => flagMembers(members, organization, lastPostedAt, vouched), [members, organization, lastPostedAt, vouched])
  const terms = React.useMemo(() => findSensitive(text, sensitiveTerms), [text, sensitiveTerms])
  const careful = forced || terms.length > 0
  const attention = careful ? flagged : flagged.filter((f) => f.flags.includes("mismatch"))
  const readers = (members ?? []).filter((m) => m && !m.isYou).length
  const needsConfirm = text.trim() !== "" && attention.length > 0
  const armed = needsConfirm && armedFor === text
  const outsiders = flagged.filter((f) => f.flags.includes("outside"))
  const orgs = [...new Set(outsiders.map((f) => f.member.org?.trim() || t.outsideUnknown))]

  // One calm, debounced summary; nothing is read out per keystroke.
  const summary = t.summary(attention.length)
  const [spoken, setSpoken] = React.useState("")
  React.useEffect(() => {
    const timer = setTimeout(() => setSpoken(status || summary), 1200)
    return () => clearTimeout(timer)
  }, [summary, status])
  React.useEffect(() => {
    if (!refocus.current) return
    refocus.current = false
    ;(listRef.current?.querySelector<HTMLButtonElement>("button:not(:disabled)") ?? areaRef.current)?.focus()
  }, [flagged])

  const update = (next: string) => {
    if (value === undefined) setInner(next)
    onValueChange?.(next)
    if (state === "failed") setState("idle")
  }
  const ago = (v: ChatMember["joinedAt"]) => {
    const ms = v instanceof Date ? v.getTime() : typeof v === "number" ? v : Date.parse(String(v))
    if (!now || !Number.isFinite(ms)) return ""
    const mins = Math.round((ms - now.getTime()) / 60_000)
    const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" })
    if (Math.abs(mins) < 60) return rtf.format(mins, "minute")
    if (Math.abs(mins) < 60 * 24) return rtf.format(Math.round(mins / 60), "hour")
    return rtf.format(Math.round(mins / 1440), "day")
  }
  const reasons = ({ member, flags }: FlaggedMember) =>
    [
      flags.includes("mismatch") && t.mismatch(member.name, member.savedAs ?? ""),
      flags.includes("unclear") && t.unclear,
      flags.includes("outside") && t.outside(member.org?.trim() || t.outsideUnknown),
      flags.includes("new") && t.joined(ago(member.joinedAt), member.addedBy),
    ].filter(Boolean).join(" ")

  const remove = async (member: ChatMember) => {
    if (!onRemove || busy) return
    setBusy(member.id)
    try {
      await onRemove(member)
      refocus.current = true
      setStatus(t.removed(member.name))
    } catch {
      // The caller shows why; the member stays listed.
    } finally {
      setBusy(undefined)
    }
  }
  const vouch = (member: ChatMember) => {
    refocus.current = true
    setVouched((v) => [...v, member.id])
    setStatus(t.vouched(member.name))
  }
  const send = async () => {
    if (state === "sending" || !text.trim()) return
    if (needsConfirm && !armed) {
      armedAt.current = performance.now()
      setArmedFor(text)
      setStatus(t.armedHint)
      return
    }
    if (armed && performance.now() - armedAt.current < 400) return // a double press can't confirm
    setState("sending")
    try {
      await onSend(text)
      update("")
      setArmedFor(undefined)
      setState("idle")
    } catch {
      setState("failed")
    }
  }

  return (
    <div data-slot="chat-audience-check" data-state={armed ? "confirming" : state} className={cn("grid w-full min-w-0 max-w-md grid-cols-1 gap-2 text-sm", className)} {...props}>
      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
        <Users aria-hidden className="size-3.5" />
        <span>{t.audience(readers)}</span>
        {attention.length > 0 && <span className="rounded-full bg-amber-500/15 px-2 py-0.5 font-medium text-amber-900 dark:text-amber-200">{t.toCheck(attention.length)}</span>}
      </p>

      {attention.length > 0 && (
        <ul ref={listRef} id={`${id}-people`} className="grid gap-2 rounded-lg border border-amber-500/40 bg-amber-500/5 p-2.5">
          {attention.map((f) => (
            <li key={f.member.id} className="flex min-w-0 gap-2.5">
              <span aria-hidden className="grid size-8 shrink-0 place-items-center rounded-full max-[420px]:hidden bg-amber-500/20 text-xs font-semibold text-amber-900 dark:text-amber-200">
                {f.member.name.trim().slice(0, 2).toUpperCase() || "?"}
              </span>
              <div className="grid min-w-0 gap-1">
                <p className="break-words">
                  <span className="font-medium">{f.member.name}</span>{" "}
                  <span className="text-amber-800 dark:text-amber-300">{reasons(f)}</span>
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {onViewProfile && (
                    <button type="button" className={smallBtn} onClick={() => onViewProfile(f.member)}>
                      <UserRoundSearch aria-hidden className="size-3.5" />
                      {t.profile}
                    </button>
                  )}
                  {onRemove && (
                    <button type="button" className={smallBtn} disabled={!!busy} aria-busy={busy === f.member.id || undefined} onClick={() => void remove(f.member)}>
                      {busy === f.member.id ? <LoaderCircle aria-hidden className="size-3.5 animate-spin" /> : <UserX aria-hidden className="size-3.5" />}
                      {t.remove}
                    </button>
                  )}
                  <button type="button" className={smallBtn} onClick={() => vouch(f.member)}>
                    <Check aria-hidden className="size-3.5" />
                    {t.vouch}
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
      {attention.length === 0 && outsiders.length > 0 && (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Building2 aria-hidden className="size-3.5 shrink-0" />
          {t.outsideSummary(outsiders.length, orgs)}
        </p>
      )}

      <label htmlFor={id} className="sr-only">{t.label(conversation)}</label>
      <textarea
        ref={areaRef}
        id={id}
        rows={3}
        value={text}
        placeholder={t.label(conversation)}
        onChange={(e) => update(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape" && armed) return setArmedFor(undefined)
          if (e.key !== "Enter" || e.nativeEvent.isComposing) return
          if (!(e.metaKey || e.ctrlKey || (sendOnEnter && !e.shiftKey))) return
          e.preventDefault()
          if (!e.repeat) void send()
        }}
        aria-describedby={[describedBy, terms.length && flagged.length ? `${id}-sensitive` : null, attention.length ? `${id}-people` : null].filter(Boolean).join(" ") || undefined}
        data-warning={needsConfirm ? "" : undefined}
        className="min-h-16 w-full resize-y rounded-md border bg-transparent px-3 py-2 text-base shadow-xs transition-[color,box-shadow] outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 md:text-sm dark:bg-input/30 data-warning:border-amber-500 dark:data-warning:border-amber-400"
      />
      {terms.length > 0 && flagged.length > 0 && (
        <p id={`${id}-sensitive`} className="flex gap-1.5 text-xs text-amber-700 dark:text-amber-400">
          <ShieldAlert aria-hidden className="mt-px size-3.5 shrink-0" />
          {t.sensitive(terms)}
        </p>
      )}
      {state === "failed" && <p role="alert" className="text-xs text-red-700 dark:text-red-400">{t.failed}</p>}

      <div className="flex justify-end gap-2">
        {armed && (
          <button type="button" onClick={() => (setArmedFor(undefined), areaRef.current?.focus())} className={cn(btn, "h-8 border bg-background px-3 hover:bg-accent dark:bg-input/30")}>
            {t.edit}
          </button>
        )}
        <button
          type="button"
          onClick={() => void send()}
          disabled={!text.trim()}
          aria-busy={state === "sending" || undefined}
          className={cn(
            btn,
            "h-8 px-3",
            armed ? "bg-amber-700 text-white hover:bg-amber-800 dark:bg-amber-400 dark:text-amber-950 dark:hover:bg-amber-300" : "bg-primary text-primary-foreground hover:bg-primary/90",
          )}
        >
          {state === "sending" ? <LoaderCircle aria-hidden className="size-4 animate-spin" /> : <SendHorizontal aria-hidden className="size-4" />}
          {state === "sending" ? t.sending : armed ? t.confirm(readers) : t.send}
        </button>
      </div>
      <p role="status" className="sr-only">{spoken}</p>
    </div>
  )
}
