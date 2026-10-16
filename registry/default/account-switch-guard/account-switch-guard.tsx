"use client"

import * as React from "react"
import { ArrowLeftRight, LoaderCircle } from "lucide-react"

import { cn } from "@/lib/utils"
import { orgHue } from "@/registry/default/acting-as-banner/acting-as-banner"

export interface GuardAccount {
  id: string
  /** Display name, e.g. "Acme Corp" or "Tushar". */
  name: string
}

const DEFAULT_CHANNEL = "bollard-ui:active-account"

/**
 * Call from your account switcher. Every open tab hears it (BroadcastChannel, with a localStorage
 * `storage` event as fallback) and tabs opened later read it on mount.
 */
export function announceActiveAccount(id: string, channel = DEFAULT_CHANNEL) {
  try {
    localStorage.setItem(channel, id)
  } catch {}
  if (typeof BroadcastChannel === "undefined") return
  const bc = new BroadcastChannel(channel)
  bc.postMessage(id)
  bc.close()
}

/** The account most recently made active in any tab of this browser. */
export function useActiveAccount(initial: string, channel = DEFAULT_CHANNEL) {
  const [active, setActive] = React.useState(initial)
  React.useEffect(() => {
    try {
      const stored = localStorage.getItem(channel)
      if (stored) setActive(stored)
    } catch {}
    const onStorage = (event: StorageEvent) => event.key === channel && event.newValue && setActive(event.newValue)
    window.addEventListener("storage", onStorage)
    const bc = typeof BroadcastChannel === "undefined" ? null : new BroadcastChannel(channel)
    if (bc) bc.onmessage = (event: MessageEvent) => typeof event.data === "string" && setActive(event.data)
    return () => {
      window.removeEventListener("storage", onStorage)
      bc?.close()
    }
  }, [channel])
  return active
}

const fill = (template: string, values: Record<string, string>) =>
  template.replace(/\{(\w+)\}/g, (match, key: string) => values[key] ?? match)

function Mark({ name, className }: { name: string; className?: string }) {
  const initials = name.split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("")
  return (
    <span aria-hidden style={{ backgroundColor: `oklch(0.55 0.16 ${orgHue(name)})` }} className={cn("grid size-5 shrink-0 place-items-center rounded-[4px] text-[10px] font-semibold text-white", className)}>
      {initials}
    </span>
  )
}

export interface AccountSwitchGuardProps extends React.ComponentProps<"div"> {
  /** Every account signed in on this browser, most recently used first. */
  accounts: GuardAccount[]
  /** The account this page was loaded as. Its data is what the user is looking at. */
  pageAccountId: string
  /** Controlled active account. Omit to follow `announceActiveAccount` across tabs. */
  activeAccountId?: string
  /** Channel shared with `announceActiveAccount`. */
  channel?: string
  /** Runs the action. Receives the page's account id: scope the request to it, not to the session cookie. */
  onAction: (accountId: string) => void | Promise<void>
  /** Reloads this page as the newly active account. Hidden when omitted. */
  onSwitchPage?: (accountId: string) => void
  /** Identity line. `{account}` and `{other}` are filled in. */
  identityText?: string
  /** Shown after the identity, naming the account most easily confused with it. */
  notText?: string
  /** Warning when another tab switched accounts. `{active}` and `{account}` are filled in. */
  switchedText?: string
  actionLabel?: string
  /** Action label while the accounts disagree, so the click names its account. */
  explicitActionLabel?: string
  switchPageLabel?: string
}

/**
 * Stops acting as the wrong account when several are signed in. The action always says who it acts
 * as and who it is not ("Posting as Acme Corp, not Tushar"), and if another tab switches accounts
 * the page says so at once and the button changes to name its account, so a page opened in A is
 * never silently acted on as B.
 */
export function AccountSwitchGuard({
  accounts,
  pageAccountId,
  activeAccountId,
  channel = DEFAULT_CHANNEL,
  onAction,
  onSwitchPage,
  identityText = "Posting as {account}",
  notText = "not {other}",
  switchedText = "You switched to {active} in another tab. This page still belongs to {account}.",
  actionLabel = "Post",
  explicitActionLabel = "Post as {account}",
  switchPageLabel = "Open as {active}",
  className,
  children,
  ...props
}: AccountSwitchGuardProps) {
  const synced = useActiveAccount(pageAccountId, channel)
  const activeId = activeAccountId ?? synced
  const [pending, setPending] = React.useState(false)
  const chipRef = React.useRef<HTMLSpanElement>(null)
  const identityId = React.useId()
  const nameOf = (id: string) => accounts.find((a) => a.id === id)?.name ?? id
  const mismatch = activeId !== pageAccountId
  // The account you would mistake this one for: the one just switched to, or the one used most recently.
  const otherId = mismatch ? activeId : accounts.find((a) => a.id !== pageAccountId)?.id
  const values = { account: nameOf(pageAccountId), active: nameOf(activeId), other: otherId ? nameOf(otherId) : "" }

  React.useEffect(() => {
    if (!mismatch || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return
    chipRef.current?.animate(
      [{ boxShadow: "0 0 0 4px rgb(245 158 11 / 0.55)" }, { boxShadow: "0 0 0 0 rgb(245 158 11 / 0)" }],
      { duration: 400, easing: "ease-out", iterations: 2 },
    )
  }, [mismatch, activeId])

  const act = async () => {
    setPending(true)
    try {
      await onAction(pageAccountId)
    } catch {
      // The caller reports its own failure; the button just becomes usable again.
    } finally {
      setPending(false)
    }
  }

  return (
    <div data-slot="account-switch-guard" data-state={mismatch ? "switched" : "matched"} className={cn("overflow-hidden rounded-lg border bg-card text-card-foreground", className)} {...props}>
      {children}
      <div aria-live="polite">
        {mismatch && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-t border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-950 dark:text-amber-50">
            <div className="flex min-w-0 flex-1 basis-48 items-center gap-3">
              <ArrowLeftRight aria-hidden className="size-4 shrink-0 text-amber-600 dark:text-amber-400" />
              <p className="min-w-0 flex-1 font-medium">{fill(switchedText, values)}</p>
            </div>
            {onSwitchPage && (
              <button
                type="button"
                onClick={() => onSwitchPage(activeId)}
                className="inline-flex h-8 shrink-0 items-center rounded-md border border-amber-700/25 px-3 text-sm font-medium whitespace-nowrap transition-colors hover:bg-amber-500/15 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:border-amber-300/25"
              >
                {fill(switchPageLabel, values)}
              </button>
            )}
          </div>
        )}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-t px-3 py-2">
        <p id={identityId} className="flex min-w-0 items-center gap-2 text-sm">
          <span ref={chipRef} className="rounded-[5px]">
            <Mark name={values.account} />
          </span>
          <span className="min-w-0">
            {fill(identityText, values).split(values.account).flatMap((part, index) => (index ? [<strong key={index} className="font-semibold">{values.account}</strong>, part] : [part]))}
            {values.other && <span className="text-muted-foreground">, {fill(notText, values)}</span>}
          </span>
        </p>
        <button
          type="button"
          onClick={act}
          disabled={pending}
          aria-describedby={identityId}
          className={cn(
            "inline-flex h-9 shrink-0 items-center gap-2 rounded-md px-4 text-sm font-medium whitespace-nowrap transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-60",
            mismatch ? "bg-amber-700 text-white hover:bg-amber-800 dark:bg-amber-400 dark:text-amber-950 dark:hover:bg-amber-300" : "bg-primary text-primary-foreground hover:bg-primary/90",
          )}
        >
          {pending ? <LoaderCircle aria-hidden className="size-4 animate-spin" /> : mismatch && <Mark name={values.account} className="size-4 text-[8px]" />}
          {mismatch ? fill(explicitActionLabel, values) : actionLabel}
        </button>
      </div>
    </div>
  )
}
