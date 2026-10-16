"use client"

import * as React from "react"

import { EmailChangeGuard } from "@/registry/default/email-change-guard/email-change-guard"

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

export function Demo() {
  return (
    <EmailChangeGuard
      currentEmail="tushar.k@outlook.com"
      defaultValue="tushar.khadde@gmial.con"
      onRequestChange={() => wait(700)}
      onResend={() => wait(400)}
      onCancelChange={() => wait(300)}
    />
  )
}
