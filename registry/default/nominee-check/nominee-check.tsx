"use client"

// Bollard UI — nominee-check · MIT licence · https://bollard-ui.vercel.app/components/nominee-check

import * as React from "react"
import { CircleCheck, Plus, Trash2, TriangleAlert, Users } from "lucide-react"

import { cn } from "@/lib/utils"
import { NOMINATION_RULES, checkNomination, equalShares, whoGetsWhat, type HoldingKind, type HoldingRules, type Nomination, type NominationIssue, type NominationMode, type Nominee } from "./nomination"

export { NOMINATION_RULES, checkNomination, equalShares, whoGetsWhat, type HoldingKind, type HoldingRules, type Nomination, type NominationIssue, type NominationMode, type Nominee } from "./nomination"

/** Every visible string. `{name}`, `{n}`, `{max}`, `{left}`, `{total}`, `{share}` and `{names}` are filled in. */
export const NOMINEE_CHECK_MESSAGES = {
  heading: "Nominees",
  modes: { simultaneous: "Split by %", successive: "In order" } as Record<NominationMode, string>,
  name: "Name",
  relation: "Relation",
  share: "Share %",
  minor: "Under 18",
  guardian: "Adult who receives",
  guardianDemat: "Guardian",
  dob: "Date of birth",
  remove: "Remove {name}",
  unnamed: "nominee {n}",
  add: "Add nominee",
  maxReached: "Up to {max} nominees.",
  notCounted: "Not counted",
  readbackTitle: "If something happens to you",
  readbackShare: "{name} gets {share}%",
  readbackFirst: "{name} gets everything.",
  readbackNext: "If {prev} has died too, {name} gets it.",
  readbackEqual: "Split equally, {share}% each. Any odd unit goes to {name}.",
  readbackEmpty: "No one is named, so your family will need legal heir or succession papers to claim.",
  none: "No nominee. Without one, your family needs extra legal documents to claim, and unclaimed money can end up with the RBI or IEPF.",
  tooMany: "Only the first {max} count. {names} won't be recognised.",
  tooManyNotAccepted: "Up to {max} nominees are allowed here, so {names} can't be added.",
  mode: "Nominees here can only be {mode}. A locker or safe custody article goes to one person at a time.",
  noName: "Add a name for nominee {n}, or remove the row.",
  duplicate: "{name} is listed twice.",
  total: "Shares add up to {total}%, not 100%.",
  over: "{left}% too much.",
  under: "{left}% left to give.",
  blankShare: "Give every nominee a share, so they add up to 100%.",
  someBlank: "Some shares are blank. Fill in all of them, or none for an equal split.",
  zeroShare: "{name} gets 0%, so they get nothing.",
  badShare: "{name}'s share must be between 0% and 100%.",
  noRelation: "Add how {name} is related to you. It's required here.",
  minorNoGuardian: "{name} is under 18. Name an adult to receive the money for them until they turn 18; without one, the family may need extra papers to claim.",
  minorNoDob: "{name} is under 18, so their date of birth is required.",
  giveRest: "Give {left}% to {name}",
  takeOver: "Take {left}% from {name}",
  splitEqually: "Split equally",
  clearShares: "Clear all shares",
  removeExtra: "Remove the extra",
  switchMode: "Switch to {mode}",
  removeDuplicate: "Remove the repeat",
  addGuardian: "Add their name",
  addDob: "Add date of birth",
  addRelation: "Add relation",
  addFirst: "Add a nominee",
  ok: "Nomination is complete.",
  removed: "Removed {name}.",
  changed: "Shares updated.",
}

export type NomineeCheckMessages = typeof NOMINEE_CHECK_MESSAGES

const fill = (template: string, values: Record<string, string | number>) =>
  template.replace(/\{(\w+)\}/g, (match, key: string) => String(values[key] ?? match))

const inputClass =
  "h-9 w-full min-w-0 rounded-md border bg-transparent px-3 text-base shadow-xs outline-none transition-[color,box-shadow] placeholder:text-muted-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-destructive dark:bg-input/30 md:text-sm"
const fixClass =
  "inline-flex h-6 shrink-0 items-center rounded-md border border-amber-500/40 px-2 text-xs font-medium text-amber-900 outline-none transition-colors hover:bg-amber-500/10 focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:text-amber-200"

export interface NomineeCheckProps extends Omit<React.ComponentProps<"div">, "defaultValue" | "onChange"> {
  /** Controlled nomination. */
  value?: Nomination
  /** Initial nomination when uncontrolled. */
  defaultValue?: Nomination
  /** Called on every edit and fix. */
  onValueChange?: (value: Nomination) => void
  /** What is being nominated for: bank deposit (4, split or in order), locker (4, in order) or demat/MF (3, split). */
  holding?: HoldingKind
  /** Override the limits, e.g. for another country or a change in the rules. */
  rules?: HoldingRules
  /** Any visible string. */
  messages?: Partial<NomineeCheckMessages>
}

/**
 * Stops a nomination that won't do what the holder thinks: shares that add to 90% or 110%, a fifth nominee the bank
 * will ignore, a split on a locker (which can only go in order), a minor with nobody to receive for them, the same
 * person twice, or no nominee at all. It reads back in plain words who gets what, with one-tap fixes.
 */
export function NomineeCheck({ value, defaultValue, onValueChange, holding = "deposit", rules: rulesProp, messages, className, "aria-describedby": describedBy, ...props }: NomineeCheckProps) {
  const t = { ...NOMINEE_CHECK_MESSAGES, ...messages, modes: { ...NOMINEE_CHECK_MESSAGES.modes, ...messages?.modes } }
  const rules = rulesProp ?? NOMINATION_RULES[holding]
  const [inner, setInner] = React.useState<Nomination>(defaultValue ?? { mode: rules.modes[0], nominees: [] })
  const [status, setStatus] = React.useState("")
  const rootRef = React.useRef<HTMLDivElement>(null)
  const addRef = React.useRef<HTMLButtonElement>(null)
  const counter = React.useRef(0)
  const id = React.useId()
  const raw = value && typeof value === "object" ? value : inner
  const nomination: Nomination = { mode: raw.mode, nominees: Array.isArray(raw.nominees) ? raw.nominees.filter(Boolean) : [] }
  const list = nomination.nominees
  const mode: NominationMode = rules.modes.includes(nomination.mode) ? nomination.mode : rules.modes[0]
  const issues = checkNomination(nomination, holding, rules)
  const story = whoGetsWhat(nomination, holding, rules)
  const label = (n: Nominee, i: number) => n.name?.trim() || fill(t.unnamed, { n: i + 1 })

  const commit = (next: Nomination, announce?: string) => {
    if (value === undefined) setInner(next)
    onValueChange?.(next)
    if (announce) setStatus(announce)
  }
  const patch = (rowId: string, change: Partial<Nominee>) => commit({ ...nomination, nominees: list.map((n) => (n.id === rowId ? { ...n, ...change } : n)) })
  // Focus goes to the target, else the first field, else Add; never lost (Add may be disabled at the limit).
  const focus = (selector: string) =>
    requestAnimationFrame(() => (rootRef.current?.querySelector<HTMLElement>(selector) ?? rootRef.current?.querySelector<HTMLElement>("[data-row] input") ?? addRef.current)?.focus())
  const focusNextFix = () => focus("[data-fix]")

  const remove = (rowId: string) => {
    const at = list.findIndex((n) => n.id === rowId)
    const next = list.filter((n) => n.id !== rowId)
    commit({ ...nomination, nominees: next }, fill(t.removed, { name: at >= 0 ? label(list[at], at) : "" }))
    // Focus the row that moved into this place, else Add; never lost.
    const target = next[Math.min(at, next.length - 1)]
    focus(target ? `[data-row="${CSS.escape(target.id)}"] input` : "[data-none]")
  }
  const add = () => {
    counter.current += 1
    const rowId = `new-${counter.current}-${list.length}`
    commit({ ...nomination, nominees: [...list, { id: rowId, name: "", share: null }] })
    requestAnimationFrame(() => rootRef.current?.querySelector<HTMLElement>(`[data-row="${CSS.escape(rowId)}"] input`)?.focus())
  }
  const setShares = (shares: (number | null)[]) => {
    commit({ ...nomination, nominees: list.map((n, i) => (i < rules.max ? { ...n, share: shares[i] ?? null } : n)) }, t.changed)
    focusNextFix()
  }

  const counted = list.slice(0, rules.max)
  const total = Math.round(counted.reduce((s, n) => s + (Number.isFinite(n.share) ? Number(n.share) : 0), 0) * 100) / 100
  const describe = (issue: NominationIssue): string => {
    const nameOf = (rowId: string) => { const i = list.findIndex((n) => n.id === rowId); return i >= 0 ? label(list[i], i) : "" }
    switch (issue.kind) {
      case "none": return t.none
      case "tooMany": return fill(rules.extrasIgnored ?? holding !== "demat" ? t.tooMany : t.tooManyNotAccepted, { max: issue.max, names: issue.dropped.join(", ") })
      case "mode": return fill(t.mode, { mode: t.modes[issue.allowed].toLowerCase() })
      case "noName": return fill(t.noName, { n: list.findIndex((n) => n.id === issue.id) + 1 })
      case "duplicate": return fill(t.duplicate, { name: issue.name })
      case "total": return `${fill(t.total, { total: issue.total })} ${fill(issue.total > 100 ? t.over : t.under, { left: Math.abs(Math.round((100 - issue.total) * 100) / 100) })}`
      case "blankShare": return t.blankShare
      case "someBlank": return t.someBlank
      case "zeroShare": return fill(t.zeroShare, { name: issue.name || nameOf(issue.id) })
      case "badShare": return fill(t.badShare, { name: issue.name || nameOf(issue.id) })
      case "noRelation": return fill(t.noRelation, { name: issue.name || nameOf(issue.id) })
      case "minorNoGuardian": return fill(t.minorNoGuardian, { name: issue.name || nameOf(issue.id) })
      case "minorNoDob": return fill(t.minorNoDob, { name: issue.name || nameOf(issue.id) })
    }
  }
  const fixesFor = (issue: NominationIssue): { label: string; run: () => void }[] => {
    const left = Math.round((100 - total) * 100) / 100
    switch (issue.kind) {
      case "none": return [{ label: t.addFirst, run: add }]
      case "tooMany": return [{ label: t.removeExtra, run: () => { commit({ ...nomination, nominees: list.slice(0, rules.max) }, t.changed); focusNextFix() } }]
      case "mode": return [{ label: fill(t.switchMode, { mode: t.modes[issue.allowed].toLowerCase() }), run: () => { commit({ mode: issue.allowed, nominees: issue.allowed === "successive" ? list.map((n) => ({ ...n, share: null })) : list }, t.changed); focusNextFix() } }]
      case "duplicate": return [{ label: t.removeDuplicate, run: () => remove(issue.id) }]
      case "total": {
        const target = [...counted].reverse().find((n) => left > 0 || (Number(n.share) || 0) >= -left) ?? counted[counted.length - 1]
        const i = list.indexOf(target)
        return [
          { label: fill(left > 0 ? t.giveRest : t.takeOver, { left: Math.abs(left), name: label(target, i) }), run: () => setShares(counted.map((n) => (n === target ? Math.round(((Number(n.share) || 0) + left) * 100) / 100 : (n.share ?? null)))) },
          { label: t.splitEqually, run: () => setShares(equalShares(counted.length)) },
        ]
      }
      case "blankShare": return [{ label: t.splitEqually, run: () => setShares(equalShares(counted.length)) }]
      case "someBlank": return [{ label: t.splitEqually, run: () => setShares(equalShares(counted.length)) }, { label: t.clearShares, run: () => setShares([]) }]
      case "minorNoGuardian": return [{ label: t.addGuardian, run: () => focus(`[data-row="${CSS.escape(issue.id)}"] [data-guardian]`) }]
      case "minorNoDob": return [{ label: t.addDob, run: () => focus(`[data-row="${CSS.escape(issue.id)}"] [data-dob]`) }]
      case "noRelation": return [{ label: t.addRelation, run: () => focus(`[data-row="${CSS.escape(issue.id)}"] [data-relation]`) }]
      default: return []
    }
  }

  const bad = new Set(issues.flatMap((i) => ("id" in i ? [i.id] : "ids" in i ? i.ids : [])))
  const summary = issues.map(describe).join(" ")
  React.useEffect(() => {
    const timer = setTimeout(() => setStatus(summary), 700)
    return () => clearTimeout(timer)
  }, [summary])

  return (
    <div
      ref={rootRef}
      role="group"
      aria-labelledby={`${id}-heading`}
      aria-describedby={[describedBy, issues.length ? `${id}-issues` : ""].filter(Boolean).join(" ") || undefined}
      data-slot="nominee-check"
      data-state={issues.length ? "warning" : "ok"}
      className={cn("w-full max-w-md space-y-3 rounded-xl border bg-card p-4 text-sm text-card-foreground", className)} {...props}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 id={`${id}-heading`} className="flex items-center gap-1.5 font-medium"><Users aria-hidden className="size-4" />{t.heading}</h3>
        {rules.modes.length > 1 && (
          <div role="group" aria-label={t.heading} className="inline-flex rounded-md border p-0.5 text-xs">
            {rules.modes.map((m) => (
              <button key={m} type="button" aria-pressed={mode === m} onClick={() => commit({ mode: m, nominees: list })} className="h-7 rounded-sm px-2.5 font-medium outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-pressed:bg-accent">
                {t.modes[m]}
              </button>
            ))}
          </div>
        )}
      </div>

      <ol className="space-y-2">
        {list.map((n, i) => {
          const out = i >= rules.max
          const rowLabel = label(n, i)
          return (
            <li key={n.id} data-row={n.id} className={cn("grid grid-cols-[auto_1fr_auto] items-start gap-2 rounded-md border p-2", out && "border-dashed opacity-60", bad.has(n.id) && !out && "border-amber-500/40")}>
              <span aria-hidden className="mt-2 grid size-5 place-items-center rounded-full bg-muted text-xs font-medium tabular-nums">{i + 1}</span>
              <div className="grid min-w-0 gap-2">
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <input aria-label={`${t.name} ${i + 1}`} placeholder={t.name} value={n.name ?? ""} onChange={(e) => patch(n.id, { name: e.target.value.slice(0, 120) })} aria-invalid={issues.some((x) => x.kind === "noName" && x.id === n.id) || undefined} className={inputClass} />
                  <input data-relation aria-label={`${t.relation} ${i + 1}`} placeholder={t.relation} value={n.relation ?? ""} onChange={(e) => patch(n.id, { relation: e.target.value.slice(0, 60) })} aria-invalid={issues.some((x) => x.kind === "noRelation" && x.id === n.id) || undefined} className={inputClass} />
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  {mode === "simultaneous" && (
                    <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      {t.share}
                      <input
                        inputMode="decimal"
                        value={n.share ?? ""}
                        onChange={(e) => { const v = e.target.value.replace(/[^\d.]/g, "").slice(0, 6); patch(n.id, { share: v === "" || !Number.isFinite(Number(v)) ? null : Number(v) }) }}
                        aria-invalid={issues.some((x) => (x.kind === "total" || ("ids" in x && x.ids.includes(n.id)) || ((x.kind === "zeroShare" || x.kind === "badShare") && x.id === n.id))) || undefined}
                        aria-label={`${t.share} ${rowLabel}`}
                        className={cn(inputClass, "h-8 w-16 px-2 text-right tabular-nums")}
                      />
                    </label>
                  )}
                  <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <input type="checkbox" checked={!!n.minor} onChange={(e) => patch(n.id, { minor: e.target.checked })} className="size-4 accent-primary" />
                    {t.minor}
                  </label>
                  {out && <span className="text-xs font-medium text-amber-800 dark:text-amber-300">{t.notCounted}</span>}
                </div>
                {n.minor && (
                  <div className={cn("grid grid-cols-1 gap-2", holding === "demat" && "sm:grid-cols-2")}>
                    <input data-guardian aria-label={`${holding === "demat" ? t.guardianDemat : t.guardian}, ${rowLabel}`} placeholder={holding === "demat" ? t.guardianDemat : t.guardian} value={n.guardian ?? ""} onChange={(e) => patch(n.id, { guardian: e.target.value.slice(0, 120) })} className={inputClass} />
                    {holding === "demat" && <input data-dob type="date" aria-label={`${t.dob}, ${rowLabel}`} value={n.dob ?? ""} onChange={(e) => patch(n.id, { dob: e.target.value })} className={inputClass} />}
                  </div>
                )}
              </div>
              <button type="button" onClick={() => remove(n.id)} aria-label={fill(t.remove, { name: rowLabel })} className="mt-1 grid size-7 place-items-center rounded-md text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50">
                <Trash2 aria-hidden className="size-4" />
              </button>
            </li>
          )
        })}
      </ol>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <button ref={addRef} type="button" onClick={add} aria-disabled={list.length >= rules.max || undefined} disabled={list.length >= rules.max} className="inline-flex h-8 items-center gap-1.5 rounded-md border px-3 text-sm font-medium outline-none transition-colors hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-50 dark:bg-input/30">
          <Plus aria-hidden className="size-4" />{t.add}
        </button>
        {list.length >= rules.max && <span className="text-xs text-muted-foreground">{fill(t.maxReached, { max: rules.max })}</span>}
        {mode === "simultaneous" && counted.length > 1 && !story.equal && (
          <span className={cn("text-xs tabular-nums", total === 100 ? "text-emerald-700 dark:text-emerald-400" : "text-amber-800 dark:text-amber-300")}>{total}% / 100%</span>
        )}
      </div>

      <div className="rounded-md border bg-muted/40 p-3">
        <p className="text-xs text-muted-foreground">{t.readbackTitle}</p>
        <p className="mt-1 break-words">
          {!story.rows.length ? t.readbackEmpty
            : story.mode === "successive" || story.rows.length === 1
              ? story.rows.map((r, i) => (i === 0 ? fill(t.readbackFirst, { name: r.name }) : fill(t.readbackNext, { prev: story.rows[i - 1].name, name: r.name }))).join(" ")
              : story.equal ? fill(t.readbackEqual, { share: story.rows[0].share ?? 0, name: story.rows[0].name })
                : story.rows.map((r) => fill(t.readbackShare, { name: r.name, share: r.share ?? "?" })).join(" · ")}
        </p>
      </div>

      {issues.length > 0 ? (
        <ul id={`${id}-issues`} className="space-y-2">
          {issues.map((issue, i) => (
            <li key={issue.kind + i} className={cn("flex flex-wrap items-center gap-x-2 gap-y-1 text-xs", issue.kind === "none" || issue.kind === "tooMany" ? "text-red-700 dark:text-red-400" : "text-amber-800 dark:text-amber-300")}>
              <TriangleAlert aria-hidden className="size-3.5 shrink-0" />
              <span id={`${id}-i${i}`} className="min-w-0 flex-1 basis-40 break-words">{describe(issue)}</span>
              {fixesFor(issue).map((fix) => <button key={fix.label} type="button" data-fix onClick={fix.run} aria-describedby={`${id}-i${i}`} className={fixClass}>{fix.label}</button>)}
            </li>
          ))}
        </ul>
      ) : (
        <p className="flex items-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-400"><CircleCheck aria-hidden className="size-3.5" />{t.ok}</p>
      )}
      <span role="status" className="sr-only">{status}</span>
    </div>
  )
}
