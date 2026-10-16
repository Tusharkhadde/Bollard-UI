"use client"

import * as React from "react"

import { cn } from "@/lib/utils"
import type { DependentRules } from "@/registry/default/dependent-reset/dependent-reset"
import {
  StepInvalidationNav,
  StepInvalidationNotice,
  StepInvalidationRail,
  invalidatedFieldClass,
  useStepInvalidation,
  type WizardStep,
} from "@/registry/default/step-invalidation/step-invalidation"

const PLANS = {
  Basic: { seats: 5, regions: ["Mumbai"], addons: [] as string[] },
  Pro: { seats: 50, regions: ["Mumbai", "Frankfurt"], addons: ["SSO", "Audit log"] },
}
type Plan = keyof typeof PLANS
type Setup = { plan: Plan; workspace: string; seats: string; region: string; addons: string[] }

const steps: WizardStep<Setup>[] = [
  { id: "plan", title: "Plan", fields: ["plan"] },
  { id: "team", title: "Team", fields: ["workspace", "seats"] },
  { id: "region", title: "Region", fields: ["region"] },
  { id: "addons", title: "Add-ons", fields: ["addons"] },
]
const rules: DependentRules<Setup> = {
  seats: { dependsOn: ["plan"], isValid: (seats, v) => Number(seats) <= PLANS[v.plan].seats },
  region: { dependsOn: ["plan"], isValid: (region, v) => PLANS[v.plan].regions.includes(region) },
  addons: { dependsOn: ["plan"], prune: (addons, v) => addons.filter((a) => PLANS[v.plan].addons.includes(a)) },
}
const field = cn(
  "h-9 w-full min-w-0 rounded-md border bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30",
  invalidatedFieldClass,
)

export function Demo() {
  const wizard = useStepInvalidation<Setup>({
    steps,
    rules,
    labels: { plan: "Plan", workspace: "Workspace", seats: "Seats", region: "Region", addons: "Add-ons" },
    defaultValue: { plan: "Pro", workspace: "Acme Labs", seats: "4", region: "Frankfurt", addons: ["SSO", "Audit log"] },
  })
  const { values, change } = wizard
  const [finished, setFinished] = React.useState(false)
  const id = React.useId()

  // The demo opens as someone downgrades on step 1, after filling in everything else.
  React.useEffect(() => change("plan", "Basic"), []) // eslint-disable-line react-hooks/exhaustive-deps

  const flag = (name: keyof Setup) => (wizard.isInvalidated(name) ? "" : undefined)
  const was = (name: keyof Setup) => wizard.lostFor(name).join(", ")
  const plan = PLANS[values.plan]

  const body: Record<string, React.ReactNode> = {
    plan: (
      <fieldset className="grid gap-1.5">
        <legend className="mb-1.5 text-sm font-medium">Plan</legend>
        <div className="grid grid-cols-2 gap-1 rounded-md bg-muted p-1">
          {(Object.keys(PLANS) as Plan[]).map((p) => (
            <button
              key={p}
              type="button"
              aria-pressed={values.plan === p}
              onClick={() => change("plan", p)}
              className={cn(
                "h-7 rounded-sm text-sm font-medium text-muted-foreground outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-pressed:bg-background aria-pressed:text-foreground aria-pressed:shadow-xs",
                wizard.pending?.to === p && "outline-1 outline-amber-500 outline-dashed",
              )}
            >
              {p} · {PLANS[p].seats} seats
            </button>
          ))}
        </div>
      </fieldset>
    ),
    team: (
      <div className="grid gap-3">
        <div className="grid gap-1.5">
          <label htmlFor={`${id}-ws`} className="w-fit text-sm font-medium">Workspace name</label>
          <input id={`${id}-ws`} value={values.workspace} onChange={(e) => change("workspace", e.target.value)} className={field} />
        </div>
        <div className="grid gap-1.5">
          <label htmlFor={`${id}-seats`} className="w-fit text-sm font-medium">Seats (up to {plan.seats})</label>
          <input id={`${id}-seats`} inputMode="numeric" value={values.seats} placeholder={was("seats") && `Was ${was("seats")}`} onChange={(e) => change("seats", e.target.value)} data-invalidated={flag("seats")} className={field} />
        </div>
      </div>
    ),
    region: (
      <div className="grid gap-1.5">
        <label htmlFor={`${id}-region`} className="w-fit text-sm font-medium">Data region</label>
        <select id={`${id}-region`} value={values.region} onChange={(e) => change("region", e.target.value)} data-invalidated={flag("region")} className={cn(field, "bg-background", !values.region && "text-muted-foreground")}>
          <option value="" disabled>{was("region") ? `Was ${was("region")} · pick again` : "Choose a region"}</option>
          {plan.regions.map((r) => <option key={r}>{r}</option>)}
        </select>
      </div>
    ),
    addons: (
      <fieldset data-invalidated={flag("addons")} className={cn("grid gap-2 rounded-md border p-3", invalidatedFieldClass)}>
        <legend className="px-1 text-sm font-medium">Add-ons</legend>
        {PLANS.Pro.addons.map((addon) => {
          const available = plan.addons.includes(addon)
          return (
            <label key={addon} className={cn("flex items-center gap-2 text-sm", !available && "text-muted-foreground")}>
              <input type="checkbox" disabled={!available} checked={values.addons.includes(addon)} onChange={(e) => change("addons", e.target.checked ? [...values.addons, addon] : values.addons.filter((a) => a !== addon))} className="size-4 accent-primary" />
              {addon}
              {!available && <span className="text-xs">· Pro only</span>}
            </label>
          )
        })}
      </fieldset>
    ),
  }

  return (
    <form className="grid w-full max-w-sm gap-4" onSubmit={(e) => e.preventDefault()}>
      <StepInvalidationRail wizard={wizard} />
      <StepInvalidationNotice wizard={wizard} />
      <div className="min-h-24">{body[wizard.current]}</div>
      <StepInvalidationNav wizard={wizard} onFinish={() => setFinished(true)} />
      {finished && <p role="status" className="text-sm text-emerald-700 dark:text-emerald-400">Workspace created on {values.plan}.</p>}
    </form>
  )
}
