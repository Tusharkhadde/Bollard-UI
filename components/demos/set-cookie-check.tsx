"use client"

import { SetCookieCheck } from "@/registry/default/set-cookie-check/set-cookie-check"

const fromTheLoginRoute = [
  "Set-Cookie: session=8f2c41ad9e; Domain=acme.com; Path=/; SameSite=None",
  "Set-Cookie: __Host-csrf=7d1e0b; Secure; Path=/app",
  "Set-Cookie: remember_me=u_41; Max-Age=315360000; Expires=Wed, 21 Oct 2026 07:28:00 GMT; Secure; HttpOnly; SameSite=Lax",
].join("\n")

export function Demo() {
  return <SetCookieCheck host="app.acme.com" defaultValue={fromTheLoginRoute} now={Date.UTC(2026, 9, 14)} />
}
