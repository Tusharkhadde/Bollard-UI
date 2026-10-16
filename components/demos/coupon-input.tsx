"use client"

import * as React from "react"

import { CouponInput, type CouponResult } from "@/registry/default/coupon-input/coupon-input"

const CART = 849

/** A pretend checkout API: the same rules a real promo engine would return. */
function check(code: string): Promise<CouponResult> {
  const result: CouponResult =
    code === "SAVE100" ? { status: "min-cart", code, minimum: 999, cartTotal: CART }
    : code === "WELCOME20" ? { status: "applied", code, saving: 150, uncapped: 169.8, description: "20% off, up to ₹150", excludedItems: ["Gift card"] }
    : code === "FEST10" ? { status: "applied", code, saving: 84.9, description: "10% off" }
    : code === "MONSOON15" ? { status: "expired", code, endedAt: "2026-09-30T23:59:00+05:30" }
    : { status: "not-found", code }
  return new Promise((resolve) => setTimeout(() => resolve(result), 400))
}

export function Demo() {
  return (
    <div className="grid w-full max-w-sm gap-3">
      <CouponInput
        onApply={check}
        defaultCode="save1OO"
        knownCodes={["SAVE100", "WELCOME20", "FEST10"]}
        timeZone="Asia/Kolkata"
      />
      <p className="text-xs text-muted-foreground">Cart ₹849. Try WELCOME20, then FEST10, or MONSOON15.</p>
    </div>
  )
}
