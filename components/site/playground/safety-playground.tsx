"use client"

import * as React from "react"
import { AmountInput } from "@/registry/default/amount-input/amount-input"
import { EmailInput } from "@/registry/default/email-input/email-input"
import { HomoglyphGuard } from "@/registry/default/homoglyph-guard/homoglyph-guard"
import { SafeSubmit } from "@/registry/default/safe-submit/safe-submit"
import { SecretPasteGuard } from "@/registry/default/secret-paste-guard/secret-paste-guard"
import { AccountDeletionReadback } from "@/registry/default/account-deletion-readback/account-deletion-readback"

const chaos = "rounded-md border px-2.5 py-1.5 text-xs font-medium outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50"

export function SafetyPlayground() {
  const [caught, setCaught] = React.useState(0)
  const [amount, setAmount] = React.useState<number | null>(10000)
  const [email, setEmail] = React.useState("priya@example.com")
  const [secret, setSecret] = React.useState("")
  const [handle, setHandle] = React.useState("paypal-team")
  const record = () => setCaught((n) => n + 1)
  return <div className="mx-auto max-w-6xl"><header className="max-w-2xl"><p className="font-mono text-xs font-medium tracking-[0.14em] text-brand uppercase">Interactive playground</p><h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Break this form.</h1><p className="mt-3 text-muted-foreground">Use the chaos controls. Each routes a common mistake into the real Bollard component that catches it.</p><output aria-live="polite" className="mt-5 inline-flex rounded-full border bg-surface px-3 py-1.5 text-sm font-medium">{caught} mistakes caught</output></header>
    <div className="mt-8 grid gap-5 lg:grid-cols-3">
      <section className="rounded-xl border bg-card p-5"><div className="flex items-center justify-between gap-3"><h2 className="font-medium">Transfer Money</h2><button type="button" onClick={() => { setAmount(100000); record() }} className={chaos}>Add extra 0</button></div><form className="mt-5 grid gap-3" onSubmit={(event) => event.preventDefault()}><AmountInput label="Amount (₹)" value={amount} onValueChange={(value) => setAmount(value)} typical={10000} /><SafeSubmit onSubmit={async () => { record(); await new Promise((resolve) => setTimeout(resolve, 250)) }} successLabel="One request sent">Submit 5 times fast</SafeSubmit></form></section>
      <section className="rounded-xl border bg-card p-5"><div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-medium">Sign Up</h2><div className="flex flex-wrap gap-1"><button type="button" onClick={() => { setEmail("priya@gmial.con"); record() }} className={chaos}>Type gmial.con</button><button type="button" onClick={() => { setSecret("sk-demo-NOT-A-REAL-KEY-1234567890-abcdef"); record() }} className={chaos}>Paste an API key</button><button type="button" onClick={() => { setHandle("pаypal-team"); record() }} className={chaos}>Cyrillic lookalike</button></div></div><div className="mt-5 grid gap-4"><EmailInput label="Work email" value={email} onValueChange={setEmail} /><HomoglyphGuard label="Team handle" value={handle} onValueChange={setHandle} protectedNames={["paypal"]} /><SecretPasteGuard value={secret} onValueChange={setSecret} onDetect={(matches) => { if (matches.length) record() }}><label className="grid gap-1.5 text-sm font-medium">Invite note<textarea value={secret} onChange={(event) => setSecret(event.target.value)} className="min-h-20 rounded-md border bg-background p-2 text-sm font-normal outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50" /></label></SecretPasteGuard></div></section>
      <section className="rounded-xl border bg-card p-5"><h2 className="font-medium">Delete Workspace</h2><p className="mt-1 text-sm text-muted-foreground">The real deletion readback blocks removal until its confirmation is complete.</p><div className="mt-4 scale-[.9] origin-top"><AccountDeletionReadback email="owner@example.test" confirmPhrase="DELETE" items={[{ label: "Projects", detail: "12" }]} teams={[{ id: "workspace", name: "Fictional workspace", members: 4, soleOwner: true }]} orphanTeams="delete" graceDays={30} onDelete={() => record()} /></div></section>
    </div></div>
}
