"use client"

import * as React from "react"
import { CalendarClock, CircleCheck, Download, ExternalLink, Loader2, Trash2, TriangleAlert, Users } from "lucide-react"

import { cn } from "@/lib/utils"

/** Something that is deleted with the account. */
export interface DeletionItem {
  label: string
  /** Size or count, e.g. "1,284 files · 3.2 GB". */
  detail?: string
}

/** A team or workspace the user belongs to. */
export interface DeletionTeam {
  id: string
  name: string
  members?: number
  /** The user is its only owner, so deleting leaves it with none. */
  soleOwner?: boolean
}

/** A paid plan tied to the account. */
export interface DeletionSubscription {
  id: string
  name: string
  /** Shown as is, e.g. "₹499/month". */
  price?: string
  /** Where it is billed. App store plans keep billing until cancelled there. */
  store: "apple" | "google" | "web"
  /** True once cancelled in the store (e.g. from the App Store Server API). */
  cancelled?: boolean
  /** Override the store's manage-subscriptions link. */
  manageUrl?: string
  /** When the paid period ends. Lets the user schedule deletion for then instead of losing time they paid for. */
  endsOn?: string | number | Date
}

/** What the user chose: delete now, or when the paid period ends (Apple's HIG suggests offering both). */
export type DeletionTiming = { when: "now" } | { when: "periodEnd"; at: number }

const STORE_URLS = { apple: "https://apps.apple.com/account/subscriptions", google: "https://play.google.com/store/account/subscriptions" }

/** Every visible string. Values in `{braces}` are filled in. */
export const ACCOUNT_DELETION_MESSAGES = {
  heading: "Delete your account",
  account: "Signed in as {email}",
  goes: "Deleted with your account",
  teams: "Teams",
  orphan: "{team} ({members}) will have no owner. Nobody will be able to manage billing or members.",
  orphanDeleted: "{team} ({members}) has no other owner, so it's deleted too.",
  leave: "You'll leave {team}.",
  members: "{n} members",
  transfer: "Transfer ownership",
  subscriptions: "Subscriptions",
  webEnds: "{name} ends with your account. No more charges.",
  storeBills: "{name}{price} keeps billing through {store} until you cancel it there. Deleting your account doesn't stop it.",
  storeCancelled: "{name} is cancelled in {store}. No more charges.",
  storeName: { apple: "the App Store", google: "Google Play" },
  manage: "Cancel in {store}",
  confirmCancelled: "I've cancelled it",
  when: "When",
  now: "Delete now",
  nowHint: "Paid time left on {name} is lost.",
  atEnd: "Delete on {date}, when {name} ends",
  atEndHint: "Keep using everything until then. You can cancel the deletion any time before.",
  scheduledHeading: "Deleted on {date}",
  scheduledGrace: "After that you can still restore it until {date}.",
  graceHeading: "Restore until {date}",
  grace: "Sign back in before then to restore everything. After that it's deleted for good.",
  immediate: "Deletion is immediate. It can't be undone.",
  retained: "We're required to keep",
  export: "Download your data",
  exporting: "Preparing…",
  exported: "Your data is downloaded.",
  exportFailed: "Download failed. Try again.",
  type: "Type {phrase} to confirm",
  typeMismatch: "That doesn't match {phrase}.",
  blockedTeams: "Transfer {teams} first.",
  blockedStore: "Cancel {names} in the store first.",
  blockedType: "Type the confirmation to continue.",
  delete: "Delete account",
  deleteNoExport: "Delete without export",
  schedule: "Schedule deletion",
  scheduleNoExport: "Schedule without export",
  deleting: "Deleting…",
}

export type AccountDeletionMessages = Omit<typeof ACCOUNT_DELETION_MESSAGES, "storeName"> & { storeName: Record<"apple" | "google", string> }

const fill = (template: string, values: Record<string, string | number>) =>
  template.replace(/\{(\w+)\}/g, (match, key: string) => String(values[key] ?? match))
const toTime = (d: unknown) => {
  const time = d instanceof Date ? d.getTime() : typeof d === "string" || typeof d === "number" ? new Date(d).getTime() : NaN
  return Number.isFinite(time) ? time : null
}
const norm = (s: string) => s.normalize("NFC").trim().replace(/\s+/g, " ").toLowerCase()

export interface AccountDeletionReadbackProps extends React.ComponentProps<"section"> {
  /** The account being deleted. */
  email: string
  /** What is deleted: data, files, projects. */
  items?: DeletionItem[]
  /** Teams or workspaces the user belongs to; sole-owner ones get a transfer prompt. */
  teams?: DeletionTeam[]
  /** Paid plans tied to the account, including app store plans. */
  subscriptions?: DeletionSubscription[]
  /** What the law makes you keep, e.g. "Invoices, for 8 years (tax law)". */
  retained?: string[]
  /** Days the account can still be restored. 0 means immediate. */
  graceDays?: number
  /** "Now" in epoch ms, for deterministic rendering. Read from the clock after mount when omitted. */
  now?: number
  /** BCP 47 locale used for dates. Defaults to the browser locale. */
  locale?: string
  /** What must be typed to confirm. Defaults to the email, matched without case. */
  confirmPhrase?: string
  /** Sole-owner teams block deletion until transferred ("block"), or are deleted with the account ("delete"). */
  orphanTeams?: "block" | "delete"
  /** Offer "delete when the paid period ends" when a subscription has a future `endsOn`. Immediate deletion stays the default. */
  scheduleOption?: boolean
  /** Starts the export. May return a Promise; the button shows progress. */
  onExport?: () => void | Promise<void>
  /** Opens or performs a transfer. Update `teams` when it is done. May return a Promise. */
  onTransfer?: (teamId: string) => void | Promise<void>
  /** Deletes the account now, or schedules it (`timing.when === "periodEnd"`). May return a Promise; double submits are ignored. */
  onDelete?: (timing: DeletionTiming) => void | Promise<void>
  /** Any visible string. */
  messages?: Partial<Omit<AccountDeletionMessages, "storeName">> & { storeName?: Partial<AccountDeletionMessages["storeName"]> }
}

/**
 * The readback before "Delete account": what is deleted, teams it leaves without an owner (with a
 * transfer button), App Store and Google Play subscriptions that keep billing unless cancelled
 * there (Apple asks apps to say so), the date it can be restored until, what the law keeps, and an
 * export. Delete unlocks only after the typed confirmation, and says when no export was taken.
 */
export function AccountDeletionReadback({
  email,
  items = [],
  teams = [],
  subscriptions = [],
  retained = [],
  graceDays = 30,
  now: nowProp,
  locale,
  confirmPhrase,
  orphanTeams = "block",
  scheduleOption = true,
  onExport,
  onTransfer,
  onDelete,
  messages,
  className,
  ...props
}: AccountDeletionReadbackProps) {
  const t = { ...ACCOUNT_DELETION_MESSAGES, ...messages, storeName: { ...ACCOUNT_DELETION_MESSAGES.storeName, ...messages?.storeName } }
  const [clock, setClock] = React.useState<number>()
  const [typed, setTyped] = React.useState("")
  const [ticked, setTicked] = React.useState<Set<string>>(() => new Set())
  const [exportState, setExportState] = React.useState<"idle" | "pending" | "done" | "failed">("idle")
  const [transferring, setTransferring] = React.useState<string>()
  const [deleting, setDeleting] = React.useState(false)
  const [timing, setTiming] = React.useState<"now" | "periodEnd">("now")
  const rootRef = React.useRef<HTMLElement>(null)
  const typeRef = React.useRef<HTMLInputElement>(null)
  const id = React.useId()

  React.useEffect(() => {
    if (nowProp === undefined) setClock(Date.now())
  }, [nowProp])

  const list = (xs: string[]) => (typeof Intl.ListFormat === "function" ? new Intl.ListFormat(locale, { type: "conjunction" }).format(xs) : xs.join(", "))
  const safeTeams = (Array.isArray(teams) ? teams : []).filter((x) => x && typeof x.name === "string")
  const safeSubs = (Array.isArray(subscriptions) ? subscriptions : []).filter((x) => x && typeof x.name === "string")
  const orphans = safeTeams.filter((x) => x.soleOwner)
  const storeOpen = safeSubs.filter((s) => s.store !== "web" && !s.cancelled && !ticked.has(s.id))
  const phrase = typeof confirmPhrase === "string" && confirmPhrase.trim() ? confirmPhrase : String(email ?? "")
  const matched = norm(typed) === norm(phrase) && phrase !== ""
  const typedWrong = typed !== "" && !norm(phrase).startsWith(norm(typed))
  const now = nowProp ?? clock
  const days = Number.isFinite(graceDays) && graceDays > 0 ? Math.floor(graceDays) : 0
  const longDate = (ms: number) => new Intl.DateTimeFormat(locale, { day: "numeric", month: "long", year: "numeric" }).format(ms)
  // The latest paid period still running decides the scheduled date.
  const paidUntil = safeSubs
    .map((s) => ({ s, at: toTime(s.endsOn) }))
    .filter((x): x is { s: DeletionSubscription; at: number } => x.at !== null && now !== undefined && x.at > now)
    .sort((a, b) => b.at - a.at)[0]
  const offerSchedule = scheduleOption && !!paidUntil
  const scheduled = offerSchedule && timing === "periodEnd"
  const deleteAt = scheduled ? paidUntil.at : now
  const restoreBy = deleteAt !== undefined && days ? longDate(deleteAt + days * 86_400_000) : ""

  const blockers = [
    orphanTeams === "block" && orphans.length ? fill(t.blockedTeams, { teams: list(orphans.map((x) => x.name)) }) : "",
    storeOpen.length ? fill(t.blockedStore, { names: list(storeOpen.map((s) => s.name)) }) : "",
    !matched ? t.blockedType : "",
  ].filter(Boolean)

  /** After a transfer or tick, focus the next open fix, else the confirmation field. */
  const focusNext = () =>
    requestAnimationFrame(() => (rootRef.current?.querySelector<HTMLElement>("[data-fix]:not(:disabled)") ?? typeRef.current)?.focus())

  const transfer = async (teamId: string) => {
    if (!onTransfer || transferring) return
    setTransferring(teamId)
    try {
      await onTransfer(teamId)
    } catch {
      // The caller shows transfer errors; the team stays listed.
    } finally {
      setTransferring(undefined)
      focusNext()
    }
  }
  const runExport = async () => {
    if (!onExport || exportState === "pending") return
    setExportState("pending")
    try {
      await onExport()
      setExportState("done")
    } catch {
      setExportState("failed")
    }
  }
  const remove = async () => {
    if (!onDelete || deleting || blockers.length) return
    setDeleting(true)
    try {
      await onDelete(scheduled ? { when: "periodEnd", at: paidUntil.at } : { when: "now" })
    } catch {
      // The caller reports failures; the button becomes usable again.
    } finally {
      setDeleting(false)
    }
  }

  const sub = "text-xs font-medium text-muted-foreground"
  const fixClass = "inline-flex h-7 items-center gap-1.5 rounded-md border px-2.5 text-xs font-medium outline-none transition-colors hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-60"
  const noExport = !!onExport && exportState !== "done"
  const [typeBefore, typeAfter = ""] = t.type.split("{phrase}")

  return (
    <section ref={rootRef} data-slot="account-deletion-readback" data-state={blockers.length ? "blocked" : "ready"} aria-labelledby={`${id}-h`} className={cn("w-full max-w-md space-y-4 rounded-lg border bg-card p-4 text-sm text-card-foreground", className)} {...props}>
      <div>
        <h3 id={`${id}-h`} className="font-semibold">{t.heading}</h3>
        <p className="text-xs break-all text-muted-foreground">{fill(t.account, { email })}</p>
      </div>
      {items.length > 0 && (
        <div className="space-y-1.5">
          <p className={sub}>{t.goes}</p>
          <ul className="space-y-1">
            {items.map((item) => (
              <li key={item.label} className="flex items-start gap-2">
                <Trash2 aria-hidden className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1 break-words">{item.label}</span>
                {item.detail && <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{item.detail}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
      {safeTeams.length > 0 && (
        <div className="space-y-1.5">
          <p className={sub}>{t.teams}</p>
          <ul className="space-y-1.5">
            {safeTeams.map((team) => {
              const members = fill(t.members, { n: team.members ?? 0 })
              return (
                <li key={team.id} className={cn("flex gap-2 text-xs", team.soleOwner ? "text-amber-700 dark:text-amber-400" : "text-muted-foreground")}>
                  {team.soleOwner ? <TriangleAlert aria-hidden className="mt-0.5 size-3.5 shrink-0" /> : <Users aria-hidden className="mt-0.5 size-3.5 shrink-0" />}
                  <div className="min-w-0 flex-1 space-y-1">
                    <p className="break-words">{team.soleOwner ? fill(orphanTeams === "delete" ? t.orphanDeleted : t.orphan, { team: team.name, members }) : fill(t.leave, { team: team.name })}</p>
                    {team.soleOwner && onTransfer && (
                      <button type="button" data-fix disabled={!!transferring} onClick={() => transfer(team.id)} aria-label={`${t.transfer}: ${team.name}`} className={cn(fixClass, "border-amber-500/40 text-amber-900 dark:text-amber-200")}>
                        {transferring === team.id && <Loader2 aria-hidden className="size-3.5 animate-spin" />}
                        {t.transfer}
                      </button>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
      )}
      {safeSubs.length > 0 && (
        <div className="space-y-1.5">
          <p className={sub}>{t.subscriptions}</p>
          <ul className="space-y-1.5">
            {safeSubs.map((s) => {
              const store = s.store === "web" ? "" : t.storeName[s.store]
              const done = s.store === "web" || s.cancelled
              const price = s.price ? ` (${s.price})` : ""
              return (
                <li key={s.id} className={cn("flex gap-2 text-xs", done ? "text-muted-foreground" : "text-red-700 dark:text-red-400")}>
                  {done ? <CircleCheck aria-hidden className="mt-0.5 size-3.5 shrink-0" /> : <TriangleAlert aria-hidden className="mt-0.5 size-3.5 shrink-0" />}
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <p className="break-words">{s.store === "web" ? fill(t.webEnds, { name: s.name }) : s.cancelled ? fill(t.storeCancelled, { name: s.name, store }) : fill(t.storeBills, { name: s.name, price, store })}</p>
                    {!done && s.store !== "web" && (
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                        <a href={s.manageUrl ?? STORE_URLS[s.store]} target="_blank" rel="noreferrer" data-fix={ticked.has(s.id) ? undefined : ""} className={cn(fixClass, "border-red-500/40 text-red-900 dark:text-red-200")}>
                          {fill(t.manage, { store })}
                          <ExternalLink aria-hidden className="size-3.5" />
                        </a>
                        <label className="inline-flex items-center gap-1.5 text-foreground">
                          <input
                            type="checkbox"
                            checked={ticked.has(s.id)}
                            onChange={(e) => {
                              const on = e.target.checked
                              setTicked((prev) => { const next = new Set(prev); if (on) next.add(s.id); else next.delete(s.id); return next })
                              if (on) focusNext()
                            }}
                            className="size-4 accent-foreground"
                          />
                          {t.confirmCancelled}
                        </label>
                      </div>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
      )}
      {offerSchedule && (
        <fieldset className="space-y-1.5">
          <legend className={cn(sub, "mb-1.5")}>{t.when}</legend>
          {(["now", "periodEnd"] as const).map((key) => (
            <label key={key} className="flex cursor-pointer gap-2.5 rounded-md border px-3 py-2 text-xs has-[:checked]:border-foreground/40 has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-ring/50">
              <input type="radio" name={`${id}-when`} value={key} checked={timing === key} onChange={() => setTiming(key)} aria-describedby={`${id}-when-${key}`} className="mt-0.5 size-4 shrink-0 accent-foreground outline-none" />
              <span className="min-w-0">
                <span className="block font-medium text-foreground">{key === "now" ? t.now : fill(t.atEnd, { date: longDate(paidUntil.at), name: paidUntil.s.name })}</span>
                <span id={`${id}-when-${key}`} className="block text-muted-foreground">{key === "now" ? fill(t.nowHint, { name: paidUntil.s.name }) : t.atEndHint}</span>
              </span>
            </label>
          ))}
        </fieldset>
      )}
      <div className="flex gap-2 rounded-md bg-muted/50 p-3 text-xs">
        <CalendarClock aria-hidden className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
        <div className="min-w-0 space-y-1">
          {scheduled ? (
            <>
              <p className="font-medium text-foreground">{fill(t.scheduledHeading, { date: longDate(paidUntil.at) })}</p>
              {restoreBy && <p className="text-muted-foreground">{fill(t.scheduledGrace, { date: restoreBy })}</p>}
            </>
          ) : days ? (
            <>
              {restoreBy && <p className="font-medium text-foreground">{fill(t.graceHeading, { date: restoreBy })}</p>}
              <p className="text-muted-foreground">{t.grace}</p>
            </>
          ) : (
            <p className="font-medium text-foreground">{t.immediate}</p>
          )}
          {retained.length > 0 && <p className="text-muted-foreground">{t.retained}: {list(retained)}.</p>}
        </div>
      </div>
      {onExport && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <button type="button" onClick={runExport} disabled={exportState === "pending"} className={fixClass}>
            {exportState === "pending" ? <Loader2 aria-hidden className="size-3.5 animate-spin" /> : <Download aria-hidden className="size-3.5" />}
            {exportState === "pending" ? t.exporting : t.export}
          </button>
          <span aria-live="polite" className={cn("text-xs", exportState === "failed" ? "text-red-700 dark:text-red-400" : "text-emerald-700 dark:text-emerald-400")}>
            {exportState === "done" ? t.exported : exportState === "failed" ? t.exportFailed : ""}
          </span>
        </div>
      )}
      <div className="grid gap-1.5">
        <label htmlFor={`${id}-type`} className="text-xs">
          {typeBefore}
          <span className="font-mono font-medium break-all">{phrase}</span>
          {typeAfter}
        </label>
        <input
          ref={typeRef}
          id={`${id}-type`}
          value={typed}
          onChange={(e) => setTyped(e.target.value.slice(0, 500))}
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          aria-invalid={typedWrong || undefined}
          aria-describedby={typedWrong ? `${id}-mismatch` : undefined}
          className="h-9 w-full min-w-0 rounded-md border bg-transparent px-3 font-mono text-base shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-destructive md:text-sm dark:bg-input/30"
        />
        {typedWrong && <p id={`${id}-mismatch`} className="text-xs text-destructive">{fill(t.typeMismatch, { phrase })}</p>}
      </div>
      {onDelete && (
        <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-1.5">
          {blockers.length > 0 && <p id={`${id}-why`} className="min-w-0 flex-1 basis-48 text-xs text-muted-foreground">{blockers[0]}</p>}
          <button
            type="button"
            onClick={remove}
            disabled={blockers.length > 0 || deleting}
            aria-describedby={blockers.length ? `${id}-why` : undefined}
            className="inline-flex h-9 items-center gap-2 rounded-md bg-destructive px-4 text-sm font-medium text-white outline-none transition-colors hover:bg-destructive/90 focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {deleting ? <Loader2 aria-hidden className="size-4 animate-spin" /> : <Trash2 aria-hidden className="size-4" />}
            {deleting ? t.deleting : scheduled ? (noExport ? t.scheduleNoExport : t.schedule) : noExport ? t.deleteNoExport : t.delete}
          </button>
        </div>
      )}
    </section>
  )
}
