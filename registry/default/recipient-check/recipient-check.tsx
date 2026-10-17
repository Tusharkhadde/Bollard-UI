"use client"

// Bollard UI — recipient-check · MIT licence · https://bollard-ui.vercel.app/components/recipient-check

import * as React from "react"
import { CircleAlert, TriangleAlert, Undo2, X } from "lucide-react"

import { cn } from "@/lib/utils"

export interface Recipient {
  email: string
  name?: string
}

export interface RecipientIssue {
  kind: "invalid" | "typo" | "mismatch" | "external"
  /** Errors are likely mistakes; warnings are worth a second look. */
  severity: "error" | "warning"
  text: string
  /** A one-tap correction: the address to use instead. */
  fix?: { label: string; email: string }
}

/** Real consumer domains, so they are never "corrected" and their typos are caught. */
const COMMON_DOMAINS = ["gmail.com", "googlemail.com", "yahoo.com", "yahoo.co.in", "ymail.com", "outlook.com", "hotmail.com", "live.com", "msn.com", "icloud.com", "me.com", "aol.com", "mail.com", "proton.me", "protonmail.com", "rediffmail.com"]
const EMAIL = /^[^\s@<>]+@[^\s@<>]+\.[a-z]{2,}$/i

/** Edit distance where swapping two neighbours (gmial → gmail) counts as one edit. */
function distance(a: string, b: string) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)))
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1)
    }
  }
  return d[a.length][b.length]
}

/** Splits pasted text on commas, semicolons and newlines; reads "Priya Sharma <priya@acme.com>" or a bare address. */
export function parseRecipients(text: string): Recipient[] {
  return text
    .split(/[,;\n]+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const match = part.match(/^"?([^"<]*?)"?\s*<([^>]+)>$/)
      return match ? { name: match[1].trim() || undefined, email: match[2].trim() } : { email: part }
    })
}

const domainOf = (email: string) => email.split("@")[1]?.toLowerCase() ?? ""
const same = (a = "", b = "") => a.toLowerCase() === b.toLowerCase()

/** Every user-visible string, so the field can be themed and translated. */
export const RECIPIENT_MESSAGES = {
  invalid: "Not a valid address",
  typo: (domain: string) => `Did you mean ${domain}?`,
  useDomain: (domain: string) => `Use ${domain}`,
  usuallyAt: (name: string, email: string) => `${name} is usually ${email}`,
  useThatAddress: "Use that address",
  belongsTo: (name: string) => `This address belongs to ${name}`,
  external: (domain: string) => `External: ${domain}`,
  tooMany: (count: number) => `This goes to ${count} people.`,
  externalCount: (count: number) => `${count} external`,
  removeExternal: "Remove external",
  alreadyAdded: (emails: string) => `Already added: ${emails}`,
  removed: (what: string) => `Removed ${what}`,
  changed: (email: string) => `Changed to ${email}`,
  removeLabel: (email: string) => `Remove ${email}`,
  pressAgain: (email: string) => `Press Backspace again to remove ${email}`,
  undo: "Undo",
}
export type RecipientMessages = typeof RECIPIENT_MESSAGES

/** Everything worth flagging about one recipient, errors first. */
export function checkRecipient(
  recipient: Recipient,
  internalDomains: string[],
  contacts: Required<Recipient>[] = [],
  messages: Partial<RecipientMessages> = {}
): RecipientIssue[] {
  const say = { ...RECIPIENT_MESSAGES, ...messages }
  if (!EMAIL.test(recipient.email)) return [{ kind: "invalid", severity: "error", text: say.invalid }]
  const internal = internalDomains.map((d) => d.toLowerCase())
  const known = [...internal, ...COMMON_DOMAINS]
  const domain = domainOf(recipient.email)
  const issues: RecipientIssue[] = []
  // Lookalikes of your own domain get more slack: acrne.com passing as acme.com is the costly one.
  const near = known.includes(domain)
    ? undefined
    : known.find((d) => distance(d, domain) <= (internal.includes(d) && d.length >= 7 ? 2 : 1))
  if (near) {
    const email = `${recipient.email.split("@")[0]}@${near}`
    issues.push({ kind: "typo", severity: "error", text: say.typo(near), fix: { label: say.useDomain(near), email } })
  }
  const byName = recipient.name ? contacts.find((c) => same(c.name, recipient.name)) : undefined
  const byEmail = contacts.find((c) => same(c.email, recipient.email))
  if (byName && !same(byName.email, recipient.email)) {
    issues.push({ kind: "mismatch", severity: "error", text: say.usuallyAt(byName.name, byName.email), fix: { label: say.useThatAddress, email: byName.email } })
  } else if (byEmail && recipient.name && !same(byEmail.name, recipient.name)) {
    issues.push({ kind: "mismatch", severity: "error", text: say.belongsTo(byEmail.name) })
  }
  if (!internal.some((d) => domain === d || domain.endsWith(`.${d}`))) issues.push({ kind: "external", severity: "warning", text: say.external(domain) })
  return issues
}

export interface RecipientCheckProps extends Omit<React.ComponentProps<"div">, "defaultValue" | "onChange"> {
  /** Recipients (controlled). */
  value?: Recipient[]
  /** Starting recipients when uncontrolled. */
  defaultValue?: Recipient[]
  /** Called with the full recipient list after every change. */
  onValueChange?: (value: Recipient[]) => void
  /** Your organisation's domains. Everyone else is marked external. */
  internalDomains: string[]
  /** Known people, used to catch a name paired with the wrong address. */
  contacts?: Required<Recipient>[]
  /** Warn when the message goes to more people than this. */
  warnAt?: number
  /** Field label, e.g. "To" or "Cc". */
  label?: string
  /** Placeholder while the field is empty. */
  placeholder?: string
  /** Override any user-visible string (see `RECIPIENT_MESSAGES`). */
  messages?: Partial<RecipientMessages>
  /** Ref to the text input, e.g. to focus it. */
  inputRef?: React.Ref<HTMLInputElement>
}

/**
 * A recipient chips input that catches the misaddressed email before it is
 * sent: external people in amber, typo'd and lookalike domains with a one-tap
 * fix, duplicates, a name paired with someone else's address, and "this goes
 * to 48 people". Removing is never a slip: Backspace marks the last chip
 * before it removes it, and every removal can be undone.
 */
export function RecipientCheck({
  value,
  defaultValue = [],
  onValueChange,
  internalDomains,
  contacts = [],
  warnAt = 25,
  label = "To",
  placeholder = "name@company.com",
  messages,
  inputRef: inputRefProp,
  className,
  ...props
}: RecipientCheckProps) {
  const [internal, setInternal] = React.useState(defaultValue)
  const [draft, setDraft] = React.useState("")
  const [notice, setNotice] = React.useState<{ text: string; undo?: Recipient[] }>()
  const [armed, setArmed] = React.useState(false)
  const inputRef = React.useRef<HTMLInputElement>(null)
  const inputId = React.useId()
  const recipients = value ?? internal
  const say = { ...RECIPIENT_MESSAGES, ...messages }

  React.useImperativeHandle(inputRefProp, () => inputRef.current as HTMLInputElement)

  const update = (next: Recipient[]) => {
    if (value === undefined) setInternal(next)
    setArmed(false)
    onValueChange?.(next)
  }

  const commit = (text: string) => {
    const parsed = parseRecipients(text)
    if (parsed.length === 0) return
    const next = [...recipients]
    const dupes: string[] = []
    for (const recipient of parsed) {
      if (next.some((r) => same(r.email, recipient.email))) dupes.push(recipient.email)
      else next.push(recipient)
    }
    update(next)
    setDraft("")
    setNotice(dupes.length ? { text: say.alreadyAdded(dupes.join(", ")) } : undefined)
  }

  /** Removes recipients and keeps the previous list one tap away. */
  const drop = (keep: (r: Recipient, i: number) => boolean, what: string) => {
    setNotice({ text: say.removed(what), undo: recipients })
    update(recipients.filter(keep))
  }
  const remove = (index: number) => drop((_, i) => i !== index, recipients[index].email)

  const replace = (index: number, email: string) => {
    if (recipients.some((r, i) => i !== index && same(r.email, email))) return remove(index)
    setNotice({ text: say.changed(email), undo: recipients })
    update(recipients.map((r, i) => (i === index ? { ...r, email } : r)))
  }

  const undo = () => {
    if (!notice?.undo) return
    update(notice.undo)
    setNotice(undefined)
    inputRef.current?.focus()
  }

  const checked = recipients.map((recipient) => ({ recipient, issues: checkRecipient(recipient, internalDomains, contacts, messages) }))
  const errors = checked.flatMap(({ recipient, issues }, index) =>
    issues.filter((issue) => issue.severity === "error").slice(0, 1).map((issue) => ({ recipient, issue, index }))
  )
  const external = checked.filter(({ issues }) => issues.some((i) => i.kind === "external")).map(({ recipient }) => recipient)
  const externalDomains = Array.from(new Set(external.map((r) => domainOf(r.email))))
  const last = recipients[recipients.length - 1]
  const link = "rounded-sm text-xs font-medium underline underline-offset-2 outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"

  return (
    <div data-slot="recipient-check" className={cn("w-full max-w-lg", className)} {...props}>
      <div
        onClick={() => inputRef.current?.focus()}
        className="flex min-h-9 flex-wrap items-center gap-1.5 rounded-md border bg-transparent px-2 py-1 shadow-xs focus-within:ring-[3px] focus-within:ring-ring/50 has-aria-invalid:border-destructive dark:bg-input/30"
      >
        <label htmlFor={inputId} className="pr-1 pl-1 text-sm text-muted-foreground">
          {label}
        </label>
        {checked.map(({ recipient, issues }, index) => {
          const error = issues.find((i) => i.severity === "error")
          const warning = !error && issues.length > 0
          const marked = armed && index === recipients.length - 1
          return (
            <span
              key={recipient.email}
              title={issues.map((i) => i.text).join(" · ") || recipient.email}
              data-state={marked ? "marked" : undefined}
              className={cn(
                "inline-flex max-w-full min-w-0 items-center gap-1 rounded-full border py-0.5 pr-0.5 pl-2.5 text-sm transition-shadow",
                error && "border-red-300 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200",
                warning && "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100",
                !error && !warning && "bg-muted",
                marked && "ring-2 ring-ring"
              )}
            >
              {error && <CircleAlert aria-hidden className="size-3.5 shrink-0" />}
              <span className="truncate">{recipient.name ? `${recipient.name} <${recipient.email}>` : recipient.email}</span>
              <span className="sr-only">{error ? `. ${error.text}` : warning ? `. ${issues[0].text}` : ""}</span>
              <button
                type="button"
                onClick={() => remove(index)}
                aria-label={say.removeLabel(recipient.email)}
                className="grid size-5 shrink-0 place-items-center rounded-full opacity-70 outline-none hover:bg-foreground/10 hover:opacity-100 focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                <X aria-hidden className="size-3" />
              </button>
            </span>
          )
        })}
        <input
          ref={inputRef}
          id={inputId}
          value={draft}
          type="text"
          inputMode="email"
          autoComplete="off"
          aria-invalid={errors.length > 0 || undefined}
          placeholder={recipients.length ? "" : placeholder}
          onChange={(event) => {
            setArmed(false)
            setDraft(event.target.value)
          }}
          onKeyDown={(event) => {
            if (["Enter", ",", ";", "Tab"].includes(event.key) && draft.trim()) {
              event.preventDefault()
              commit(draft)
            } else if (event.key === "Backspace" && !draft && last) {
              // First Backspace marks the last chip, the second removes it: no address vanishes on a held key.
              event.preventDefault()
              if (event.repeat) return
              if (armed) remove(recipients.length - 1)
              else setArmed(true)
            } else if (armed) setArmed(false)
          }}
          onPaste={(event) => {
            const text = event.clipboardData.getData("text")
            if (/[,;\n]/.test(text)) {
              event.preventDefault()
              commit(draft + text)
            }
          }}
          onBlur={() => {
            setArmed(false)
            commit(draft)
          }}
          className="h-7 min-w-32 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
      </div>
      <div aria-live="polite" className="mt-1.5 space-y-1.5 text-sm empty:hidden">
        {armed && last && <p className="sr-only">{say.pressAgain(last.email)}</p>}
        {errors.map(({ recipient, issue, index }) => (
          <p key={recipient.email} className="flex items-start gap-1.5 text-red-700 dark:text-red-400">
            <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
            <span className="min-w-0">
              <span className="font-medium break-all">{recipient.email}</span>: {issue.text}
              {issue.fix && (
                <button type="button" onClick={() => replace(index, issue.fix!.email)} className={cn(link, "ml-2")}>
                  {issue.fix.label}
                </button>
              )}
            </span>
          </p>
        ))}
        {recipients.length > warnAt && (
          <p className="flex items-center gap-1.5 font-medium text-amber-800 dark:text-amber-300">
            <TriangleAlert className="size-4 shrink-0" aria-hidden /> {say.tooMany(recipients.length)}
          </p>
        )}
        {external.length > 0 && (
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-muted-foreground">
            <span>
              <span className="font-medium text-amber-800 dark:text-amber-300">{say.externalCount(external.length)}</span> (
              {externalDomains.slice(0, 3).join(", ")}
              {externalDomains.length > 3 ? ", …" : ""})
            </span>
            <button type="button" onClick={() => drop((r) => !external.includes(r), say.externalCount(external.length))} className={link}>
              {say.removeExternal}
            </button>
          </p>
        )}
        {notice && (
          <p className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
            <span className="min-w-0 break-all">{notice.text}</span>
            {notice.undo && (
              <button type="button" onClick={undo} className={cn(link, "inline-flex items-center gap-1")}>
                <Undo2 aria-hidden className="size-3" />
                {say.undo}
              </button>
            )}
          </p>
        )}
      </div>
    </div>
  )
}
