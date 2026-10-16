"use client"

import * as React from "react"

import { CommitSecretGuard } from "@/registry/default/commit-secret-guard/commit-secret-guard"

// Built from parts so this demo file never trips a real secret scanner.
const STRIPE = ["sk", "live", "51NzQ8vKp2Lm4Rt7Wx9Yb3Cd"].join("_")
const DIFF = [
  "diff --git a/src/lib/payments.ts b/src/lib/payments.ts",
  "--- a/src/lib/payments.ts",
  "+++ b/src/lib/payments.ts",
  "@@ -1,4 +1,5 @@",
  ' import Stripe from "stripe"',
  "-const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)",
  `+const stripe = new Stripe("${STRIPE}")`,
  " export async function charge(amount: number) {",
  "diff --git a/.env.local b/.env.local",
  "new file mode 100644",
  "--- /dev/null",
  "+++ b/.env.local",
  "@@ -0,0 +1,2 @@",
  "+DATABASE_URL=postgres://app:" + "Sup3rS3cret!" + "@db.internal:5432/app",
  "+NEXT_PUBLIC_SITE_URL=https://shop.example.in",
  "diff --git a/src/__tests__/login.test.ts b/src/__tests__/login.test.ts",
  "--- a/src/__tests__/login.test.ts",
  "+++ b/src/__tests__/login.test.ts",
  "@@ -8,2 +8,3 @@",
  ' it("rejects a wrong password", async () => {',
  '+  const password = "Tr0ub4dor&3xyzQ"',
].join("\n")

export function Demo() {
  const [pushed, setPushed] = React.useState(false)
  const [log, setLog] = React.useState("")

  return (
    <div className="grid w-full max-w-lg gap-2">
      <div role="group" aria-label="Where this diff is" className="flex flex-wrap gap-1.5">
        {[false, true].map((p) => (
          <button key={String(p)} type="button" aria-pressed={pushed === p} onClick={() => (setPushed(p), setLog(""))} className="rounded-md border px-2 py-1 text-xs outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-pressed:bg-accent aria-pressed:font-medium">
            {p ? "Pull request" : "Pre-commit hook"}
          </button>
        ))}
      </div>
      <CommitSecretGuard
        key={String(pushed)}
        diff={DIFF}
        pushed={pushed}
        onResolve={(_, __, fix) => setLog(fix.kind === "replace-line" ? `Patched ${fix.file}:${fix.line}` : fix.kind === "remove-line" ? `Dropped ${fix.file}:${fix.line}` : fix.kind === "command" ? `Ran: ${fix.command}` : "Added to the allowlist.")}
        onCommit={() => new Promise<void>((resolve) => setTimeout(() => (setLog("Committed with no secrets."), resolve()), 700))}
      />
      <p aria-live="polite" className="min-h-4 font-mono text-xs text-muted-foreground [overflow-wrap:anywhere]">{log}</p>
    </div>
  )
}
