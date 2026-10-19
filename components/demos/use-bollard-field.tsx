"use client"

import * as React from "react"

import { useBollardField } from "@/registry/default/use-bollard-field/use-bollard-field"

const fieldClass =
  "h-10 w-full rounded-md border bg-background px-3 text-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:ring-[3px] focus-visible:ring-ring/40 aria-invalid:border-destructive"

export function Demo() {
  const [validationFailure, setValidationFailure] = React.useState<string>()
  const email = useBollardField({
    initialValue: "priya@acme",
    validate: (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) ? undefined : "Enter a complete email address, such as priya@example.com.",
    onError: (error) => setValidationFailure(error.code),
  })

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    await email.validate()
  }

  return (
    <form noValidate onSubmit={submit} className="w-full max-w-md space-y-3 rounded-lg border bg-card p-4 text-left">
      <div className="space-y-1">
        <label htmlFor="bollard-email-demo" className="text-sm font-medium">Work email</label>
        <input
          id="bollard-email-demo"
          type="email"
          autoComplete="email"
          value={email.value}
          onChange={(event) => {
            setValidationFailure(undefined)
            email.setValue(event.target.value)
          }}
          onBlur={email.onBlur}
          {...email.ariaProps}
          className={fieldClass}
        />
      </div>
      <div className="flex items-center justify-between gap-3">
        <p id={email.errorId} role={email.invalid ? "alert" : undefined} className="min-h-5 text-xs text-destructive">
          {email.error}
        </p>
        <button
          type="submit"
          disabled={email.isValidating}
          className="h-8 shrink-0 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground outline-none hover:bg-primary/90 focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-wait disabled:opacity-60"
        >
          {email.isValidating ? "Checking…" : "Continue"}
        </button>
      </div>
      {validationFailure && <p role="status" className="text-xs text-muted-foreground">Check failed ({validationFailure}). The field remains editable; retry validation after recovery.</p>}
      <p className="border-t pt-3 text-xs text-muted-foreground">The input stays yours. Bollard supplies field state and accessible error props.</p>
    </form>
  )
}
