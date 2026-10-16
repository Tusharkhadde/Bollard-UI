"use client"

import * as React from "react"

import { cn } from "@/lib/utils"
import {
  DependentResetNotice,
  clearedFieldClass,
  useDependentReset,
  type DependentRules,
} from "@/registry/default/dependent-reset/dependent-reset"

const PLACES: Record<string, Record<string, string[]>> = {
  India: { Maharashtra: ["Pune", "Mumbai"], Karnataka: ["Bengaluru", "Mysuru"] },
  "United States": { California: ["San Francisco", "Los Angeles"], "New York": ["New York City", "Buffalo"] },
}
const PLANS: Record<string, string[]> = {
  Starter: ["Priority support"],
  Pro: ["Priority support", "Analytics"],
  Business: ["Priority support", "Analytics", "SSO"],
}

type Order = { country: string; state: string; city: string; plan: string; addons: string[] }

const rules: DependentRules<Order> = {
  state: { dependsOn: ["country"], isValid: (state, v) => state in (PLACES[v.country] ?? {}) },
  city: { dependsOn: ["country", "state"], isValid: (city, v) => (PLACES[v.country]?.[v.state] ?? []).includes(city) },
  addons: { dependsOn: ["plan"], prune: (addons, v) => addons.filter((a) => PLANS[v.plan].includes(a)) },
}

const select = cn(
  "h-9 w-full min-w-0 rounded-md border bg-background px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30",
  clearedFieldClass,
)

export function Demo() {
  const form = useDependentReset<Order>({
    defaultValue: { country: "India", state: "Maharashtra", city: "Pune", plan: "Business", addons: ["Priority support", "SSO"] },
    rules,
    labels: { country: "Country", state: "State", city: "City", plan: "Plan", addons: "Add-ons" },
  })
  const { values, setField } = form
  const id = React.useId()

  // The demo opens right after someone switched the country.
  React.useEffect(() => setField("country", "United States"), []) // eslint-disable-line react-hooks/exhaustive-deps

  const field = (name: "country" | "state" | "city", label: string, options: string[]) => (
    <div className="grid gap-1.5">
      <label htmlFor={`${id}-${name}`} className="w-fit text-sm font-medium">{label}</label>
      <select id={`${id}-${name}`} value={values[name]} onChange={(e) => setField(name, e.target.value)} data-cleared={form.isCleared(name) ? "" : undefined} className={cn(select, !values[name] && "text-muted-foreground")}>
        <option value="" disabled>{form.previousValue(name) ? `Was ${form.previousValue(name)}` : `Choose ${label.toLowerCase()}`}</option>
        {options.map((o) => <option key={o}>{o}</option>)}
      </select>
    </div>
  )

  return (
    <form className="grid w-full max-w-sm gap-3" onSubmit={(e) => e.preventDefault()}>
      <DependentResetNotice notice={form.notice} onUndo={form.undo} onDismiss={form.dismiss} />
      {field("country", "Country", Object.keys(PLACES))}
      <div className="grid grid-cols-2 gap-3">
        {field("state", "State", Object.keys(PLACES[values.country] ?? {}))}
        {field("city", "City", PLACES[values.country]?.[values.state] ?? [])}
      </div>
      <fieldset className="grid gap-1.5">
        <legend className="mb-1.5 text-sm font-medium">Plan</legend>
        <div className="grid grid-cols-3 gap-1 rounded-md bg-muted p-1">
          {Object.keys(PLANS).map((plan) => (
            <button
              key={plan}
              type="button"
              aria-pressed={values.plan === plan}
              onClick={() => setField("plan", plan)}
              className="h-7 rounded-sm text-sm font-medium text-muted-foreground outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-pressed:bg-background aria-pressed:text-foreground aria-pressed:shadow-xs"
            >
              {plan}
            </button>
          ))}
        </div>
      </fieldset>
      <fieldset data-cleared={form.isCleared("addons") ? "" : undefined} className={cn("grid gap-2 rounded-md border p-3", clearedFieldClass)}>
        <legend className="px-1 text-sm font-medium">Add-ons</legend>
        {PLANS.Business.map((addon) => {
          const available = PLANS[values.plan].includes(addon)
          return (
            <label key={addon} className={cn("flex items-center gap-2 text-sm", !available && "text-muted-foreground")}>
              <input
                type="checkbox"
                disabled={!available}
                checked={values.addons.includes(addon)}
                onChange={(e) => setField("addons", e.target.checked ? [...values.addons, addon] : values.addons.filter((a) => a !== addon))}
                className="size-4 accent-primary"
              />
              {addon}
              {!available && <span className="text-xs">· not on {values.plan}</span>}
            </label>
          )
        })}
      </fieldset>
    </form>
  )
}
