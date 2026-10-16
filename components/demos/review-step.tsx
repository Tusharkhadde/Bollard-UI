"use client"

import * as React from "react"

import { ReviewStep, type ReviewGroup } from "@/registry/default/review-step/review-step"

type Answers = Record<string, string>
const labels: Answers = { name: "Full name", email: "Email", address: "Delivery address", instructions: "Delivery instructions", plan: "Plan", gstin: "GSTIN" }
const optional = ["instructions", "gstin"]
const layout = [
  { id: "contact", title: "1. Contact", fields: ["name", "email"] },
  { id: "delivery", title: "2. Delivery", fields: ["address", "instructions"] },
  { id: "billing", title: "3. Billing", fields: ["plan", "gstin"] },
]
/** What was submitted last month. */
const lastTime: Answers = { name: "Priya Sharma", email: "priya@acme.in", address: "12 MG Road, Pune 411001", instructions: "", plan: "Monthly · ₹499", gstin: "" }

const field =
  "h-9 w-full min-w-0 rounded-md border bg-transparent px-3 text-base shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 md:text-sm dark:bg-input/30"
const button = "h-9 rounded-md px-4 text-sm font-medium outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"

export function Demo() {
  const [answers, setAnswers] = React.useState<Answers>({ ...lastTime, address: "4 Baner Road, Pune 411045", plan: "Yearly · ₹4,990" })
  const [editing, setEditing] = React.useState<{ step: string; field?: string }>()

  if (editing) {
    const step = layout.find((s) => s.id === editing.step)!
    return (
      <form className="grid w-full max-w-sm gap-3" onSubmit={(event) => (event.preventDefault(), setEditing(undefined))}>
        <h2 className="text-base font-semibold">{step.title}</h2>
        {step.fields.map((name) => (
          <label key={name} className="grid gap-1.5 text-sm font-medium">
            {labels[name]}
            {optional.includes(name) && <span className="-mt-1 text-xs font-normal text-muted-foreground">Optional</span>}
            <input
              autoFocus={name === (editing.field ?? step.fields[0])}
              value={answers[name]}
              onChange={(event) => setAnswers({ ...answers, [name]: event.target.value })}
              className={field}
            />
          </label>
        ))}
        <button type="submit" className={`${button} bg-primary text-primary-foreground hover:bg-primary/90`}>
          Back to review
        </button>
      </form>
    )
  }

  const steps: ReviewGroup[] = layout.map((s) => ({
    ...s,
    fields: s.fields.map((name) => ({ id: name, label: labels[name], value: answers[name], optional: optional.includes(name) })),
  }))
  return (
    <ReviewStep
      steps={steps}
      previous={lastTime}
      onEdit={(step, field) => setEditing({ step, field })}
      onSubmit={() => new Promise((resolve) => setTimeout(resolve, 900))}
      submitLabel="Confirm and pay ₹4,990"
    />
  )
}
