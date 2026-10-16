"use client"

import * as React from "react"

import { ErrorSummary, useFormErrors } from "@/registry/default/error-summary/error-summary"

const input =
  "h-9 w-full rounded-md border bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-destructive dark:bg-input/30"

export function Demo() {
  const [sent, setSent] = React.useState(false)
  const form = useFormErrors({
    validate: (values) => ({
      fullName: values.fullName.trim() ? undefined : "Enter your full name",
      email: !values.email.trim()
        ? "Enter your email address"
        : /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)
          ? undefined
          : "Enter an email address like name@example.com",
      plan: values.plan ? undefined : "Select a plan",
      terms: values.terms ? undefined : "Accept the terms to continue",
    }),
  })

  // Open on a form that was already submitted once, without stealing focus on page load.
  const shown = React.useRef(false)
  React.useEffect(() => {
    if (shown.current) return
    shown.current = true
    form.report()
  })

  const error = (name: string) =>
    form.errorFor(name) && (
      <p id={form.errorId(name)} className="text-xs font-medium text-destructive">
        {form.errorFor(name)}
      </p>
    )

  return (
    <form noValidate onSubmit={form.handleSubmit(() => setSent(true))} className="w-full max-w-sm space-y-4">
      <ErrorSummary {...form.summaryProps} prefixTitle={false} />
      <div className="space-y-1.5">
        <label htmlFor={form.fieldId("fullName")} className="text-sm font-medium">
          Full name
        </label>
        <input {...form.register("fullName")} className={input} autoComplete="name" />
        {error("fullName")}
      </div>
      <div className="space-y-1.5">
        <label htmlFor={form.fieldId("email")} className="text-sm font-medium">
          Email
        </label>
        <input {...form.register("email")} type="email" defaultValue="priya@acme" className={input} autoComplete="email" />
        {error("email")}
      </div>
      <fieldset className="space-y-1.5">
        <legend className="text-sm font-medium">Plan</legend>
        <div className="flex gap-4 text-sm">
          {["Starter", "Team"].map((plan) => (
            <label key={plan} className="flex items-center gap-2">
              <input {...form.register("plan", { id: `demo-plan-${plan}` })} type="radio" value={plan} />
              {plan}
            </label>
          ))}
        </div>
        {error("plan")}
      </fieldset>
      <div className="space-y-1.5">
        <label className="flex items-center gap-2 text-sm">
          <input {...form.register("terms")} type="checkbox" value="yes" />I accept the terms
        </label>
        {error("terms")}
      </div>
      <button
        type="submit"
        className="h-9 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground outline-none hover:bg-primary/90 focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        Create account
      </button>
      {sent && <p className="text-sm text-emerald-700 dark:text-emerald-400">Account created.</p>}
    </form>
  )
}
