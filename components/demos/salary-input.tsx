"use client"

import { SalaryInput } from "@/registry/default/salary-input/salary-input"

export function Demo() {
  return (
    <form className="grid w-full max-w-sm gap-3" onSubmit={(event) => event.preventDefault()}>
      <SalaryInput label="Current CTC" defaultValue={{ text: "12", period: "year" }} />
      <SalaryInput label="Expected CTC" expectedRange={[800000, 1400000]} defaultValue={{ text: "1,00,000", period: "year" }} />
      <p className="text-xs text-muted-foreground">Try 1,20,00,000, 85k/month or 12 LPA.</p>
    </form>
  )
}
