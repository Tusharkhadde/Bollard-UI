"use client"

import { EnvPaste } from "@/registry/default/env-paste/env-paste"

const pasted = [
  "# Copied from the staging dashboard",
  "DATABASE_URL=postgres://app@db.internal:5432/shop",
  'STRIPE_SECRET_KEY="sk_test_51Hx9Qa2LmVt8rP',
  "STRIPE_WEBHOOK_SECRET=whsec_9fK2mQ7xL4  ",
  "app-name = Acme #1 Store",
  "PORT=3000",
  "SENTRY_DSN=",
  "PORT=8080",
].join("\n")

export function Demo() {
  return <EnvPaste label="Production config" environment="production" defaultValue={pasted} />
}
