"use client"

// The hero's preview screens. Each is a small, realistic screen built only from
// real Bollard UI registry components, pre-filled with a mistake so the guard shows.
import * as React from "react"
import { Database, MessageSquare } from "lucide-react"

import { cn } from "@/lib/utils"
import { AccountDeletionReadback } from "@/registry/default/account-deletion-readback/account-deletion-readback"
import { AmountInput } from "@/registry/default/amount-input/amount-input"
import { ConnectionStringInput } from "@/registry/default/connection-string-input/connection-string-input"
import { DuplicatePaymentGuard, type PastPayment, type PaymentStatus } from "@/registry/default/duplicate-payment-guard/duplicate-payment-guard"
import { EmailInput } from "@/registry/default/email-input/email-input"
import { PasswordInput } from "@/registry/default/password-input/password-input"
import { PhoneInput } from "@/registry/default/phone-input/phone-input"
import { SafeSubmit } from "@/registry/default/safe-submit/safe-submit"
import { SecretPasteGuard } from "@/registry/default/secret-paste-guard/secret-paste-guard"

const card = "w-full rounded-xl border bg-card text-card-foreground shadow-sm"
const note = "text-xs text-muted-foreground"
const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

function CardHead({ title, description, icon }: { title: string; description: string; icon?: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 border-b px-5 py-4">
      {icon && <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-md border bg-background text-muted-foreground [&_svg]:size-4">{icon}</span>}
      <div className="min-w-0">
        <h3 className="leading-tight font-bold">{title}</h3>
        <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
      </div>
    </div>
  )
}

/** Payments: 2,400 is the usual; 24,000 has an extra zero. Fixing it then trips the duplicate check. */
export function PaymentsScreen() {
  const [amount, setAmount] = React.useState<number | null>(24000)
  const [history, setHistory] = React.useState<PastPayment[]>()
  const [log, setLog] = React.useState("")
  React.useEffect(() => {
    setHistory([{ payeeId: "ravi.kumar@okaxis", amount: 2400, at: Date.now() - 12 * 60_000, status: "success", reference: "UTR 428113907245" }])
  }, [])
  return (
    <div className={cn(card, "max-w-md")}>
      <CardHead title="Send money" description="Monthly rent share" />
      <div className="grid gap-4 p-5">
        <div className="flex items-center gap-3 rounded-lg border bg-background px-3 py-2.5 text-sm">
          <span aria-hidden className="grid size-8 shrink-0 place-items-center rounded-full bg-muted text-xs font-bold">
            RK
          </span>
          <div className="min-w-0">
            <p className="font-medium">Ravi Kumar</p>
            <p className="truncate text-xs text-muted-foreground">ravi.kumar@okaxis</p>
          </div>
        </div>
        <AmountInput label="Amount" value={amount} onValueChange={setAmount} typical={2400} className="max-w-none" />
        {history && amount ? (
          <DuplicatePaymentGuard
            payee={{ id: "ravi.kumar@okaxis", name: "Ravi" }}
            amount={amount}
            payments={history}
            onPay={() => wait(700).then(() => setLog(`Sent ₹${amount.toLocaleString("en-IN")} to Ravi.`))}
            onCheckStatus={() => wait(600).then((): PaymentStatus => (setLog("The first one went through."), "success"))}
          />
        ) : null}
        <p aria-live="polite" className={`${note} empty:hidden`}>
          {log}
        </p>
      </div>
    </div>
  )
}

/** Sign-up: a typo'd domain, the country code typed twice, and a password typed on a Russian layout. */
export function SignUpScreen() {
  const [created, setCreated] = React.useState(0)
  return (
    <div className={cn(card, "max-w-md")}>
      <CardHead title="Create your account" description="Start your 14-day trial. No card needed." />
      <div className="grid gap-4 p-5">
        <EmailInput label="Work email" defaultValue="priya.sharma@gmial.con" className="max-w-none" />
        <PhoneInput label="Mobile" defaultValue="+91 +91 98765 43210" preferredCountries={["IN", "US", "GB", "AE", "SG"]} className="max-w-none" />
        <PasswordInput label="Password" defaultValue={"\u044b\u0433\u044c\u044c\u0443\u043a2026!"} autoComplete="new-password" className="max-w-none" />
        <SafeSubmit onSubmit={() => wait(900).then(() => setCreated((n) => n + 1))} pendingLabel="Creating…" successLabel="Account created" className="w-full">
          Create account
        </SafeSubmit>
        <p className={cn(note, "text-center")} aria-live="polite">
          Double-click it: one account, never two. Server saw <span className="font-mono text-foreground tabular-nums">{created}</span>.
        </p>
      </div>
    </div>
  )
}

const settingsNav = ["General", "Members", "Billing", "Danger zone"]

/** Danger zone: the user owns a team alone and has an App Store plan that keeps billing. */
export function DangerZoneScreen() {
  const [done, setDone] = React.useState("")
  return (
    <div className="flex w-full max-w-[38.5rem] gap-6">
      <nav aria-label="Settings" className="hidden w-36 shrink-0 sm:block">
        <p className="px-2 pb-2 text-xs font-bold text-muted-foreground">Settings</p>
        <ul className="grid gap-0.5 text-sm">
          {settingsNav.map((item) => (
            <li
              key={item}
              aria-current={item === "Danger zone" ? "page" : undefined}
              className={cn("rounded-md px-2 py-1.5", item === "Danger zone" ? "bg-muted font-bold" : "text-muted-foreground")}
            >
              {item}
            </li>
          ))}
        </ul>
      </nav>
      <div className="min-w-0 max-w-md flex-1 space-y-2">
        <AccountDeletionReadback
          email="priya@acme.dev"
          items={[
            { label: "12 projects and their deploys", detail: "3.2 GB" },
            { label: "API keys and webhooks", detail: "7" },
          ]}
          teams={[{ id: "acme", name: "Acme Studio", members: 8, soleOwner: true }]}
          subscriptions={[{ id: "pro", name: "Pro", price: "₹1,499/mo", store: "apple" }]}
          scheduleOption={false}
          onTransfer={() => wait(500)}
          onDelete={() => wait(600).then(() => setDone("Demo only: nothing was deleted."))}
          className="max-w-none shadow-sm"
        />
        <p aria-live="polite" className={`${note} empty:hidden`}>
          {done}
        </p>
      </div>
    </div>
  )
}

// AWS's documented example key, split so secret scanners leave this file alone.
const fakeKey = ["AKIA", "IOSFODNN7", "EXAMPLE"].join("")

/** Developer: a key pasted into a support chat, and a production URL with an unencoded # and sslmode=disable. */
export function DeveloperScreen() {
  const [message, setMessage] = React.useState(`Deploy keeps failing, here's my env:\nAWS_ACCESS_KEY_ID=${fakeKey}`)
  const id = React.useId()
  return (
    <div className="grid w-full max-w-[40rem] gap-4 md:grid-cols-2">
      <div className={card}>
        <CardHead title="Contact support" description="We reply within a day." icon={<MessageSquare />} />
        <div className="grid gap-1.5 p-5">
          <label htmlFor={id} className="text-sm font-medium">
            Message
          </label>
          <SecretPasteGuard value={message} onValueChange={setMessage}>
            <textarea
              id={id}
              rows={4}
              value={message}
              spellCheck={false}
              onChange={(event) => setMessage(event.target.value)}
              className="block w-full resize-none rounded-md border bg-transparent px-3 py-2 font-mono text-[12px] leading-5 shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30"
            />
          </SecretPasteGuard>
        </div>
      </div>
      <div className={card}>
        <CardHead title="Environment" description="Production · orders-api" icon={<Database />} />
        <div className="p-5">
          <ConnectionStringInput
            label="DATABASE_URL"
            environment="production"
            defaultValue="postgresql://app:Tr0ub4dor#9@db.acme.io:5432/orders?sslmode=disable"
          />
        </div>
      </div>
    </div>
  )
}
