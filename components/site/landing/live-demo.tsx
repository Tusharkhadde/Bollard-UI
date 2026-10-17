"use client"

import * as React from "react"

import { Deferred } from "./deferred"

// Every example comes from one lazy chunk, fetched only as the grid nears the viewport.
const load = () => import("./showcase-demos")
const pick = (key: keyof Awaited<ReturnType<typeof load>>) => React.lazy(() => load().then((mod) => ({ default: mod[key] })))

const demos = {
  "amount-input": pick("AmountDemo"),
  "email-input": pick("EmailDemo"),
  "phone-input": pick("PhoneDemo"),
  "password-input": pick("PasswordDemo"),
  "upi-id-input": pick("UpiDemo"),
  "card-expiry-input": pick("ExpiryDemo"),
}

export type ShowcaseName = keyof typeof demos
export const isShowcaseName = (name: string): name is ShowcaseName => name in demos

export function LiveDemo({ name }: { name: ShowcaseName }) {
  const Demo = demos[name]
  return (
    <Deferred
      margin="400px 0px"
      className="flex w-full justify-center"
      fallback={<div aria-hidden className="h-20 w-full animate-pulse rounded-lg bg-muted motion-reduce:animate-none" />}
    >
      <Demo />
    </Deferred>
  )
}
