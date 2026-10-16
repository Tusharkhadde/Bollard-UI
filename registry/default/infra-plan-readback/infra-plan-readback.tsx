"use client"

import * as React from "react"
import { Database, Loader2, TriangleAlert } from "lucide-react"

import { cn } from "@/lib/utils"
import { isProductionName, readPlan, type PlanAction, type PlanChange } from "./plan"

export { actionOf, isProductionName, readPlan, STATEFUL_TYPES, type PlanAction, type PlanChange, type PlanReadback } from "./plan"

/** Every visible string. `{workspace}`, `{count}`, `{name}`, `{value}`, `{address}` are filled in. */
export const INFRA_PLAN_MESSAGES = {
  title: "Plan for {workspace}",
  noWorkspace: "Plan",
  prod: "Production",
  envMismatch: "Workspace is {workspace}, but var.{name} = \"{value}\".",
  actions: { create: "Create", update: "Update", replace: "Replace", destroy: "Destroy" } as Record<PlanAction, string>,
  imports: "{import} to import",
  moves: "{moved} moved",
  review: "Destroyed or replaced",
  stateful: "Holds data",
  forces: "forces replacement",
  destroyFirst: "Destroyed before its replacement exists.",
  createFirst: "New one is created first (create_before_destroy).",
  ack: "I understand what's in {address} is lost",
  ackAll: "I've reviewed the {count} destroyed or replaced resources",
  typeLabel: "Type {workspace} to apply in production",
  others: "{count} other changes",
  deposed: "Deposed copy",
  nothing: "No changes. Your infrastructure matches the configuration.",
  notApplyable: "This plan errored or isn't applyable. Fix it and plan again.",
  apply: "Apply",
  applyDestroys: "Apply · destroys {count}",
  pending: "Applying…",
  unlocked: "Ready to apply.",
}

export type InfraPlanMessages = typeof INFRA_PLAN_MESSAGES

const fill = (template: string, values: Record<string, string | number>) =>
  template.replace(/\{(\w+)\}/g, (match, key: string) => String(values[key] ?? match))

const ACTION_TONE: Record<PlanAction, string> = {
  create: "text-emerald-700 dark:text-emerald-400",
  update: "text-amber-700 dark:text-amber-400",
  replace: "text-red-700 dark:text-red-400",
  destroy: "text-red-700 dark:text-red-400",
}
const SIGN: Record<PlanAction, string> = { create: "+", update: "~", replace: "±", destroy: "−" }

export interface InfraPlanReadbackProps extends Omit<React.ComponentProps<"div">, "children"> {
  /** `terraform show -json <planfile>` output, parsed or as text. */
  plan: unknown
  /** Workspace name (`terraform workspace show`) or an environment label. */
  workspace?: string
  /** Force production handling on or off. Defaults to reading the workspace name and var.environment. */
  production?: boolean
  /** More resource types that hold data. */
  statefulTypes?: string[]
  /** Your own stateful test; overrides the built-in list. */
  isStateful?: (type: string) => boolean
  /** Called on Apply. May return a Promise; shows a pending state and ignores repeat clicks. */
  onApply?: () => void | Promise<void>
  /** Any visible string; `actions` may be partial. */
  messages?: Partial<Omit<InfraPlanMessages, "actions">> & { actions?: Partial<InfraPlanMessages["actions"]> }
}

/**
 * Stops an apply that quietly destroys data. It reads a Terraform/OpenTofu JSON plan back as create, update, replace
 * and destroy counts, puts destroys and replacements of databases, buckets and volumes first with the attribute that
 * forces each replacement and its before → after, flags production workspaces (and a var.environment that says prod
 * when the workspace doesn't), and keeps Apply locked until every data-holding loss is acknowledged.
 */
export function InfraPlanReadback({ plan, workspace, production, statefulTypes, isStateful, onApply, messages, className, ...props }: InfraPlanReadbackProps) {
  const t = { ...INFRA_PLAN_MESSAGES, ...messages, actions: { ...INFRA_PLAN_MESSAGES.actions, ...messages?.actions } }
  const extraTypes = (statefulTypes ?? []).join(",")
  const read = React.useMemo(() => readPlan(plan, { statefulTypes: extraTypes ? extraTypes.split(",") : [], isStateful }), [plan, extraTypes, isStateful])
  const [acked, setAcked] = React.useState<Set<string>>(() => new Set())
  const [typed, setTyped] = React.useState("")
  const [pending, setPending] = React.useState(false)
  const [status, setStatus] = React.useState("")
  const busy = React.useRef(false)
  const id = React.useId()

  // A new plan is a new question: earlier acknowledgements don't carry over.
  const keyOf = (c: PlanChange) => (c.deposed ? `${c.address}#${c.deposed}` : c.address)
  const signature = `${read.ok}|${read.changes.map((c) => `${c.action}:${keyOf(c)}`).join("|")}`
  React.useEffect(() => {
    setAcked(new Set())
    setTyped("")
  }, [signature])

  const envVar = read.environmentVar
  const prod = production ?? (isProductionName(workspace ?? "") || (envVar ? isProductionName(envVar.value) : false))
  const mismatch = envVar && workspace && isProductionName(envVar.value) !== isProductionName(workspace)
  const losses = read.changes.filter((c) => c.action === "destroy" || c.action === "replace")
  const rest = read.changes.filter((c) => !losses.includes(c))
  const statefulLosses = losses.filter((c) => c.stateful)
  const ackKeys = statefulLosses.length ? statefulLosses.map(keyOf) : losses.length ? ["*all*"] : []
  const allAcked = ackKeys.every((k) => acked.has(k))
  // With no workspace name, a production var.environment is what gets typed.
  const target = workspace || (prod && envVar ? envVar.value : "")
  const needsTyping = prod && losses.length > 0 && !!target
  const typedOk = !needsTyping || typed.trim() === target
  const ready = read.ok && !read.notApplyable && allAcked && typedOk
  const values = { workspace: target, count: losses.length, name: envVar?.name ?? "", value: envVar?.value ?? "", import: read.counts.import, moved: read.counts.moved }

  React.useEffect(() => {
    const timer = setTimeout(() => setStatus(ready && losses.length ? t.unlocked : ""), 500)
    return () => clearTimeout(timer)
  }, [ready, losses.length, t.unlocked])

  // Focus stays on the box: moving it on check is an unexpected change of context (WCAG 3.2.2) and skips the next item's details.
  const toggle = (key: string, on: boolean) => {
    const next = new Set(acked)
    if (on) next.add(key)
    else next.delete(key)
    setAcked(next)
  }

  const apply = async () => {
    if (!ready || busy.current || !onApply) return
    busy.current = true
    setPending(true)
    try {
      await onApply()
    } catch {
      // The caller reports apply failures; the button becomes usable again.
    } finally {
      busy.current = false
      setPending(false)
    }
  }

  const address = (c: PlanChange) => <code className="min-w-0 font-mono text-xs [overflow-wrap:anywhere]">{c.address}</code>

  return (
    <div data-slot="infra-plan-readback" data-state={pending ? "pending" : ready ? "ready" : "locked"} className={cn("w-full max-w-lg overflow-hidden rounded-xl border bg-background text-sm", className)} {...props}>
      <div className={cn("flex flex-wrap items-center gap-2 border-b px-4 py-3", prod && "bg-[repeating-linear-gradient(135deg,rgb(239_68_68/0.10)_0_8px,transparent_8px_16px)]")}>
        <h3 id={`${id}-title`} className="min-w-0 flex-1 font-medium [overflow-wrap:anywhere]">{workspace ? fill(t.title, values) : t.noWorkspace}</h3>
        {prod && <span className="rounded-md bg-red-700 px-1.5 py-0.5 text-xs font-semibold tracking-wide text-white uppercase dark:bg-red-500 dark:text-red-950">{t.prod}</span>}
      </div>

      <div className="space-y-3 px-4 py-3">
        {!read.ok && <p role="alert" className="flex gap-1.5 text-destructive"><TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />{read.error}</p>}
        {read.ok && read.notApplyable && <p role="alert" className="flex gap-1.5 text-destructive"><TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />{t.notApplyable}</p>}
        {mismatch && <p className="flex gap-1.5 text-xs font-medium text-amber-800 dark:text-amber-300"><TriangleAlert aria-hidden className="mt-0.5 size-3.5 shrink-0" />{fill(t.envMismatch, values)}</p>}

        {read.ok && (
          <dl className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
            {(["create", "update", "replace", "destroy"] as PlanAction[]).map((a) => (
              <div key={a} className={cn("flex flex-col-reverse rounded-md border px-2 py-1.5 text-center", read.counts[a] && (a === "destroy" || a === "replace") && "border-red-500/40 bg-red-500/5")}>
                <dt className="truncate text-xs text-muted-foreground">{t.actions[a]}</dt>
                <dd className={cn("text-lg font-semibold tabular-nums", read.counts[a] ? ACTION_TONE[a] : "text-muted-foreground")}>{read.counts[a]}</dd>
              </div>
            ))}
          </dl>
        )}
        {(read.counts.import > 0 || read.counts.moved > 0) && <p className="text-xs text-muted-foreground">{[read.counts.import ? fill(t.imports, values) : "", read.counts.moved ? fill(t.moves, values) : ""].filter(Boolean).join(" · ")}</p>}
        {read.ok && !read.changes.length && <p className="text-muted-foreground">{t.nothing}</p>}

        {losses.length > 0 && (
          <section aria-labelledby={`${id}-losses`} className="space-y-1.5">
            <h4 id={`${id}-losses`} className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{t.review}</h4>
            <ul className="divide-y rounded-md border">
              {losses.map((c) => (
                <li key={keyOf(c)} className={cn("space-y-1 px-3 py-2", c.stateful && "bg-red-500/5")}>
                  <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                    <span className={cn("font-mono text-xs font-semibold", ACTION_TONE[c.action])} aria-hidden>{SIGN[c.action]}</span>
                    <span className={cn("text-xs font-medium", ACTION_TONE[c.action])}>{t.actions[c.action]}</span>
                    {address(c)}
                    {c.stateful && <span className="inline-flex items-center gap-1 rounded border border-red-500/30 px-1 text-[11px] font-medium text-red-700 dark:text-red-300"><Database aria-hidden className="size-3" />{t.stateful}</span>}
                    {c.deposed && <span className="rounded border px-1 text-[11px] text-muted-foreground">{t.deposed}</span>}
                  </div>
                  {c.forcedBy.map((f) => (
                    <p key={f.path} className="text-xs break-words">
                      <code className="font-mono">{f.path}</code>
                      {(f.before !== undefined || f.after !== undefined) && <span className="font-mono text-muted-foreground"> {f.before ?? "null"} → {f.after ?? "(known after apply)"}</span>}
                      <span className="font-medium text-red-700 dark:text-red-300"> {t.forces}</span>
                    </p>
                  ))}
                  {c.reason && <p className="text-xs text-muted-foreground">{c.reason}</p>}
                  {c.action === "replace" && c.stateful && <p className="text-xs text-muted-foreground">{c.order === "create-first" ? t.createFirst : t.destroyFirst}</p>}
                  {c.notes.map((n) => <p key={n} className="text-xs font-medium text-amber-800 dark:text-amber-300">{n}</p>)}
                  {c.stateful && (
                    <label className="flex items-start gap-2 pt-1 text-xs">
                      <input type="checkbox" data-ack checked={acked.has(keyOf(c))} onChange={(e) => toggle(keyOf(c), e.target.checked)} className="mt-0.5 size-4 shrink-0 accent-red-600" />
                      <span className="min-w-0 [overflow-wrap:anywhere]">{fill(t.ack, { address: c.address })}</span>
                    </label>
                  )}
                </li>
              ))}
            </ul>
            {!statefulLosses.length && (
              <label className="flex items-start gap-2 text-xs">
                <input type="checkbox" data-ack checked={acked.has("*all*")} onChange={(e) => toggle("*all*", e.target.checked)} className="mt-0.5 size-4 shrink-0 accent-red-600" />
                <span>{fill(t.ackAll, values)}</span>
              </label>
            )}
          </section>
        )}

        {rest.length > 0 && (
          <details className="group rounded-md border">
            <summary className="cursor-pointer px-3 py-2 text-xs font-medium outline-none select-none focus-visible:ring-[3px] focus-visible:ring-ring/50">{fill(t.others, { count: rest.length })}</summary>
            <ul className="divide-y border-t">
              {rest.map((c) => (
                <li key={keyOf(c)} className="flex min-w-0 items-baseline gap-2 px-3 py-1.5">
                  <span className={cn("w-3 shrink-0 font-mono text-xs font-semibold", ACTION_TONE[c.action])} aria-hidden>{SIGN[c.action]}</span>
                  <span className="sr-only">{t.actions[c.action]}</span>
                  {address(c)}
                </li>
              ))}
            </ul>
          </details>
        )}

        {needsTyping && (
          <div className="grid gap-1.5">
            <label htmlFor={`${id}-type`} className="font-medium [overflow-wrap:anywhere]">{fill(t.typeLabel, values)}</label>
            <input id={`${id}-type`} value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" spellCheck={false} autoCapitalize="off" placeholder={target} className="h-9 w-full min-w-0 rounded-md border bg-transparent px-3 font-mono text-base shadow-xs outline-none transition-[color,box-shadow] placeholder:text-muted-foreground/60 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 md:text-sm dark:bg-input/30" />
          </div>
        )}
      </div>

      <span role="status" className="sr-only">{status}</span>
      {onApply && (
        <div className="flex justify-end border-t px-4 py-3">
          <button
            type="button"
            onClick={apply}
            disabled={!ready || pending}
            aria-describedby={`${id}-title`}
            className={cn(
              "inline-flex h-9 items-center gap-2 rounded-md px-4 text-sm font-medium outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50",
              losses.length ? "bg-destructive text-white hover:bg-destructive/90" : "bg-primary text-primary-foreground hover:bg-primary/90",
            )}
          >
            {pending && <Loader2 aria-hidden className="size-4 animate-spin" />}
            {pending ? t.pending : losses.length ? fill(t.applyDestroys, values) : t.apply}
          </button>
        </div>
      )}
    </div>
  )
}
