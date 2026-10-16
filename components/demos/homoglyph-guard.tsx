"use client"

import { HomoglyphGuard } from "@/registry/default/homoglyph-guard/homoglyph-guard"

// "pаypal.com" below uses a Cyrillic "а" (U+0430); the username hides a zero-width space.
export function Demo() {
  return (
    <form className="grid w-full max-w-sm gap-3" onSubmit={(event) => event.preventDefault()}>
      <HomoglyphGuard label="Payout domain" defaultValue={"p\u0430ypal.com"} protectedNames={["paypal"]} />
      <HomoglyphGuard label="Username" defaultValue={"rahul\u200b_sharma"} hint="Try g00gle, ѕсоре or ｐａｙ." />
    </form>
  )
}
