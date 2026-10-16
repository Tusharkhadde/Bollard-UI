"use client"

import * as React from "react"
import { Building2, CircleCheck, FileText, Globe, LoaderCircle, Lock, ShieldAlert, UserX } from "lucide-react"

import { cn } from "@/lib/utils"
import { findDocLinks, fixesFor, linkIssues, type DocLink, type DocProvider, type LinkAccess, type LinkFix, type LinkIssue, type Recipient } from "./links"

export { findDocLinks, fixesFor, isInternal, linkIssues, type AccessRole, type DocLink, type DocProvider, type GeneralAccess, type LinkAccess, type LinkFix, type LinkIssue, type Recipient } from "./links"

/** Every visible string. `{…}` placeholders are filled in. */
export const LINK_ACCESS_MESSAGES = {
  heading: "Shared links",
  checking: "Checking who can open it…",
  checkError: "Couldn't check who can open it.",
  retry: "Retry",
  allCan: "Everyone on this message can open it.",
  restricted: "Restricted",
  organization: "{org} only",
  anyone: "Anyone with the link",
  noAccess: "{names} can't open it.",
  unverified: "Couldn't confirm access for {names}.",
  publicExternal: "Anyone with the link can {role} it, and this goes outside {org} to {names}. They can pass it on.",
  role_view: "view",
  role_comment: "comment on",
  role_edit: "edit",
  grantView: "Give them view access",
  companyOnly: "Open to anyone at {org}",
  limit: "Limit to {org} and these recipients",
  requestAccess: "Ask {owner} to share it",
  owner: "the owner",
  keep: "Keep",
  done_grantView: "Gave {names} view access.",
  done_companyOnly: "The link now opens for {org} only.",
  done_requestAccess: "Asked {owner} to share it with {names}.",
  fixError: "That didn't work. Try again.",
  more: "{names} and {count} more",
  yourOrg: "your organisation",
  send: "Send",
  sendAnyway: "Send anyway",
  sendBlocked: "Some people can't open a link. Fix it, keep it, or press Send anyway.",
  stillChecking: "Still checking who can open the links. Press Send anyway to send now.",
}

export type LinkAccessMessages = typeof LINK_ACCESS_MESSAGES

type Result = { status: "checking" | "done" | "error"; access?: LinkAccess }

const fill = (template: string, values: Record<string, string | number>) => template.replace(/\{(\w+)\}/g, (m, k: string) => String(values[k] ?? m))
const fixClass = "inline-flex min-h-6 items-center gap-1 rounded-md border border-amber-500/40 px-2 py-0.5 text-left font-medium text-amber-900 transition-colors hover:bg-amber-500/10 dark:text-amber-200 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-60"
const ghostClass = "inline-flex min-h-6 items-center rounded-md px-2 font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-60"

export interface LinkAccessCheckProps extends Omit<React.ComponentProps<"div">, "onChange"> {
  /** The message body. Links to Google Drive, OneDrive/SharePoint, Dropbox, Notion, Figma and Box are found in it. */
  text: string
  /** Everyone the message goes to. */
  recipients: (Recipient | string)[]
  /** Your organisation's domains. Subdomains match too. */
  orgDomains?: string[]
  /** Reads a link's sharing for these recipients from your storage API. Aborted when the input changes. */
  checkAccess: (link: DocLink, recipients: Recipient[], options: { signal: AbortSignal }) => Promise<LinkAccess>
  /** Applies a fix. Resolve with the new access, or nothing to have the link checked again. */
  onFix?: (fix: LinkFix) => Promise<LinkAccess | void> | LinkAccess | void
  /** More hosts to treat as cloud docs, e.g. { "files.acme.com": "box" }. */
  extraHosts?: Record<string, DocProvider>
  /** Pause after typing before checking, in ms. */
  delay?: number
  /** Called on Send. With problems left the first click jumps to them and the second sends. */
  onSend?: () => void | Promise<void>
  /** Where focus goes once the last fix is done, usually the message body. */
  returnFocusRef?: React.RefObject<HTMLElement | null>
  /** Any visible string. */
  messages?: Partial<LinkAccessMessages>
}

/**
 * Stops "I can't open the link": before a message goes out it checks every cloud doc link in it
 * against the recipients, names who can't open each one with one-tap fixes (give view access, open
 * it to the company, or ask the owner when you can't share it), and warns when an "anyone with the
 * link" doc is going to someone outside the organisation.
 */
export function LinkAccessCheck({ text, recipients, orgDomains = [], checkAccess, onFix, extraHosts, delay = 500, onSend, returnFocusRef, messages, className, ...props }: LinkAccessCheckProps) {
  const t = { ...LINK_ACCESS_MESSAGES, ...messages }
  const org = orgDomains[0]?.replace(/^@/, "") || t.yourOrg
  const links = findDocLinks(text, extraHosts)
  const people = (Array.isArray(recipients) ? recipients : [])
    .map((r) => (typeof r === "string" ? { email: r.trim() } : r))
    .filter((r): r is Recipient => !!r && typeof r.email === "string" && r.email.includes("@"))
  const linkSig = links.map((l) => l.key).join("|")
  const peopleSig = people.map((p) => p.email.toLowerCase()).sort().join("|")

  const [results, setResults] = React.useState<Record<string, Result>>({})
  const [kept, setKept] = React.useState<Set<string>>(() => new Set())
  const [asked, setAsked] = React.useState<Set<string>>(() => new Set())
  const [busy, setBusy] = React.useState<string>()
  /** `${link.key}:${issue.kind}` of the fix that failed. */
  const [failed, setFailed] = React.useState<string>()
  const [announcement, setAnnouncement] = React.useState("")
  const [sendAsked, setSendAsked] = React.useState(false)
  const [sending, setSending] = React.useState(false)
  const [nonce, setNonce] = React.useState(0)
  const rootRef = React.useRef<HTMLDivElement>(null)
  const sendRef = React.useRef<HTMLButtonElement>(null)
  const latest = React.useRef({ links, people, checkAccess })
  latest.current = { links, people, checkAccess }

  React.useEffect(() => {
    const { links, people, checkAccess } = latest.current
    if (!links.length) return
    setResults((r) => Object.fromEntries(links.map((l) => [l.key, { status: "checking", access: r[l.key]?.access }])))
    setSendAsked(false)
    const controller = new AbortController()
    const timer = setTimeout(() => {
      for (const link of links) {
        Promise.resolve()
          .then(() => checkAccess(link, people, { signal: controller.signal }))
          .then(
            (access) => !controller.signal.aborted && setResults((r) => ({ ...r, [link.key]: { status: "done", access } })),
            () => !controller.signal.aborted && setResults((r) => ({ ...r, [link.key]: { status: "error" } })),
          )
      }
    }, delay)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [linkSig, peopleSig, delay, nonce])

  const issuesOf = (link: DocLink) => {
    const access = results[link.key]?.access
    if (!access || results[link.key]?.status !== "done") return []
    return linkIssues(access, people, orgDomains).filter((issue) => !kept.has(`${link.key}:${issue.kind}`))
  }
  const blocking = links.some((l) => results[l.key]?.status === "checking") || links.some((l) => issuesOf(l).some((i) => i.kind !== "unverified" && !(i.kind === "noAccess" && i.recipients.every((r) => asked.has(`${l.key}:${r.email}`)))))

  const names = (list: Recipient[]) => {
    const shown = list.slice(0, 3).map((r) => r.name || r.email).join(", ")
    return list.length > 3 ? fill(t.more, { names: shown, count: list.length - 3 }) : shown
  }

  /** After a fix, go to the next fix button, else Send, else the message body, else this list. */
  const focusNext = () =>
    requestAnimationFrame(() => {
      const next = rootRef.current?.querySelector<HTMLElement>("[data-fix]:not(:disabled)")
      ;(next ?? sendRef.current ?? returnFocusRef?.current ?? rootRef.current)?.focus()
    })

  const runFix = async (fix: LinkFix, issue: LinkIssue) => {
    if (!onFix || busy) return
    setBusy(`${fix.link.key}:${fix.type}`)
    setFailed(undefined)
    try {
      const next = await onFix(fix)
      const owner = results[fix.link.key]?.access?.ownerName || t.owner
      if (fix.type === "requestAccess") setAsked((s) => new Set([...s, ...fix.emails.map((e) => `${fix.link.key}:${e}`)]))
      if (next) setResults((r) => (fix.link.key in r ? { ...r, [fix.link.key]: { status: "done", access: next } } : r))
      else if (fix.type !== "requestAccess") setNonce((n) => n + 1)
      setAnnouncement(fill(t[`done_${fix.type}`], { names: names(issue.recipients), org, owner }))
      focusNext()
    } catch {
      setFailed(`${fix.link.key}:${issue.kind}`)
    } finally {
      setBusy(undefined)
    }
  }

  const send = async () => {
    if (blocking && !sendAsked) {
      setSendAsked(true)
      const checking = links.some((l) => results[l.key]?.status !== "done" && results[l.key]?.status !== "error")
      setAnnouncement(checking ? t.stillChecking : t.sendBlocked)
      rootRef.current?.querySelector<HTMLElement>("[data-fix]")?.focus()
      return
    }
    if (!onSend || sending) return
    setSending(true)
    try {
      await onSend()
    } catch {
      // The caller reports send failures; the button becomes usable again.
    } finally {
      setSending(false)
    }
  }

  if (!links.length) return null

  const general = (access?: LinkAccess) =>
    !access ? null : access.general === "anyone" ? { icon: Globe, text: t.anyone } : access.general === "organization" ? { icon: Building2, text: fill(t.organization, { org }) } : { icon: Lock, text: t.restricted }
  const fixLabel = (fix: LinkFix, access: LinkAccess) =>
    fix.type === "grantView" ? t.grantView : fix.type === "requestAccess" ? fill(t.requestAccess, { owner: access.ownerName || t.owner }) : fix.alsoGrant.length || access.general === "anyone" ? fill(t.limit, { org }) : fill(t.companyOnly, { org })

  return (
    <div ref={rootRef} tabIndex={-1} data-slot="link-access-check" data-state={blocking ? "issues" : "ok"} className={cn("w-full max-w-md space-y-2 text-sm outline-none", className)} {...props}>
      <span aria-live="polite" className="sr-only">{announcement}</span>
      <h3 className="text-xs font-medium text-muted-foreground">{t.heading}</h3>
      <ul className="space-y-2">
        {links.map((link) => {
          const result = results[link.key]
          const access = result?.access
          const issues = issuesOf(link)
          const chip = general(access)
          const host = (() => {
            try {
              return new URL(link.url).hostname
            } catch {
              return link.url
            }
          })()
          return (
            <li key={link.key} data-row className={cn("rounded-md border p-3", issues.some((i) => i.kind === "publicExternal") ? "border-red-500/40" : issues.some((i) => i.kind === "noAccess") && "border-amber-500/40")}>
              <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                <FileText aria-hidden className="size-4 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1 basis-32 font-medium [overflow-wrap:anywhere]" title={link.url}>{access?.title || host}</span>
                {chip && (
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                    <chip.icon aria-hidden className="size-3" />
                    {chip.text}
                  </span>
                )}
              </div>
              <div className="mt-1.5 space-y-1.5 text-xs">
                {result?.status === "checking" || !result ? (
                  <p className="flex items-center gap-1.5 text-muted-foreground"><LoaderCircle aria-hidden className="size-3.5 animate-spin motion-reduce:animate-none" />{t.checking}</p>
                ) : result.status === "error" ? (
                  <p className="flex flex-wrap items-center gap-x-2 text-muted-foreground">
                    {t.checkError}
                    <button type="button" onClick={() => setNonce((n) => n + 1)} className={ghostClass}>{t.retry}</button>
                  </p>
                ) : !issues.length ? (
                  <p className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400"><CircleCheck aria-hidden className="size-3.5 shrink-0" />{t.allCan}</p>
                ) : (
                  issues.map((issue) => {
                    const fixes = access ? fixesFor(issue, link, access, orgDomains) : []
                    const handled = issue.kind === "noAccess" && issue.recipients.every((r) => asked.has(`${link.key}:${r.email}`))
                    const Icon = issue.kind === "publicExternal" ? ShieldAlert : UserX
                    return (
                      <div key={issue.kind} className={cn("flex gap-1.5", issue.kind === "publicExternal" ? "text-red-700 dark:text-red-400" : issue.kind === "unverified" ? "text-muted-foreground" : "text-amber-700 dark:text-amber-400")}>
                        <Icon aria-hidden className="mt-0.5 size-3.5 shrink-0" />
                        <div className="min-w-0 space-y-1">
                          <p className="break-words">
                            {handled
                              ? fill(t.done_requestAccess, { owner: access?.ownerName || t.owner, names: names(issue.recipients) })
                              : issue.kind === "publicExternal"
                                ? fill(t.publicExternal, { role: t[`role_${issue.role}`], org, names: names(issue.recipients) })
                                : fill(issue.kind === "noAccess" ? t.noAccess : t.unverified, { names: names(issue.recipients) })}
                          </p>
                          {!handled && issue.kind !== "unverified" && (
                            <div className="flex flex-wrap gap-2 pt-0.5">
                              {access && onFix && fixes.map((fix) => (
                                <button key={fix.type} type="button" data-fix disabled={!!busy} onClick={() => runFix(fix, issue)} className={fixClass}>
                                  {busy === `${link.key}:${fix.type}` && <LoaderCircle aria-hidden className="size-3.5 animate-spin" />}
                                  {fixLabel(fix, access)}
                                </button>
                              ))}
                              <button
                                type="button"
                                data-fix={onFix && fixes.length ? undefined : ""}
                                disabled={!!busy}
                                onClick={() => {
                                  setKept((k) => new Set([...k, `${link.key}:${issue.kind}`]))
                                  focusNext()
                                }}
                                className={ghostClass}
                              >
                                {t.keep}
                              </button>
                            </div>
                          )}
                          {failed === `${link.key}:${issue.kind}` && <p role="alert" className="text-red-700 dark:text-red-400">{t.fixError}</p>}
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </li>
          )
        })}
      </ul>
      {onSend && (
        <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-2 pt-1">
          {sendAsked && blocking && <p className="mr-auto min-w-0 flex-1 basis-48 text-xs break-words text-amber-700 dark:text-amber-400">{links.some((l) => results[l.key]?.status !== "done" && results[l.key]?.status !== "error") ? t.stillChecking : t.sendBlocked}</p>}
          <button
            ref={sendRef}
            type="button"
            onClick={send}
            disabled={sending}
            aria-busy={sending}
            className={cn(
              "inline-flex h-9 items-center gap-2 rounded-md px-4 text-sm font-medium outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-60",
              sendAsked && blocking ? "bg-amber-700 text-white hover:bg-amber-800 dark:bg-amber-400 dark:text-amber-950" : "bg-primary text-primary-foreground hover:bg-primary/90",
            )}
          >
            {sending && <LoaderCircle aria-hidden className="size-4 animate-spin" />}
            {sendAsked && blocking ? t.sendAnyway : t.send}
          </button>
        </div>
      )}
    </div>
  )
}
