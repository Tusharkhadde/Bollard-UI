"use client"

import { EnvDiff } from "@/registry/default/env-diff/env-diff"

const staging = `DATABASE_URL=postgres://app:st4g1ng-pw@db.staging.acme.internal/app
REDIS_URL=redis://cache.staging.acme.internal:6379
STRIPE_SECRET_KEY=sk_test_51Hx9aZQeLm0
JWT_SECRET=4f9c2a7e1b0d8c3f
SENTRY_DSN=https://a1b2@o12.ingest.sentry.io/77
NEXT_PUBLIC_API_URL=https://api.staging.acme.com
SMTP_HOST=smtp.postmarkapp.com
LOG_LEVEL=debug
FEATURE_NEW_CHECKOUT=true`

const production = `DATABASE_URL=postgres://app:Pr0d-9xKq@db.prod.acme.internal/app
STRIPE_SECRET_KEY=sk_test_51Hx9aZQeLm0
JWT_SECRET=4f9c2a7e1b0d8c3f
SENTRY_DSN=
NEXT_PUBLIC_API_URL=https://api.staging.acme.com
SMTP_HOST=smtp.postmarkapp.com
LOG_LEVEL=warn
CDN_URL=https://cdn.acme.com`

export function Demo() {
  return <EnvDiff base={staging} target={production} baseName="staging" targetName="production" />
}
