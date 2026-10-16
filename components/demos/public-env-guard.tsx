"use client"

import { PublicEnvGuard } from "@/registry/default/public-env-guard/public-env-guard"

// Fake, non-working values shaped like the real thing.
const env = [
  "# .env.production",
  "NEXT_PUBLIC_API_URL=https://api.acme.dev",
  "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_51Hx9QaFakeFakeFake",
  "NEXT_PUBLIC_STRIPE_SECRET_KEY=sk_live_51Hx9QaFakeFakeFakeFake",
  "NEXT_PUBLIC_DATABASE_URL=postgres://app:hunter2@db.acme.dev:5432/shop",
  "VITE_SENTRY_DSN=https://4f9c2a@o1234.ingest.sentry.io/42",
  "DATABASE_URL=postgres://app:hunter2@db.acme.dev:5432/shop",
  "RESEND_API_KEY=re_FakeFakeFakeFakeFake12",
].join("\n")

export function Demo() {
  return <PublicEnvGuard framework="next" defaultValue={env} />
}
