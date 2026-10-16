"use client"

import * as React from "react"

import { PiiPostGuard } from "@/registry/default/pii-post-guard/pii-post-guard"

const REVIEW =
  "Refund still not processed after 3 weeks! Order #48213. Call me on 98765 43210 or check my Aadhaar 2345 6789 0124. They even asked for the OTP 482913 on chat."

export function Demo() {
  const [posted, setPosted] = React.useState(false)
  return (
    <div className="w-full max-w-md space-y-2">
      <PiiPostGuard
        label="Your review of QuickKart"
        defaultValue={REVIEW}
        delay={0}
        rows={5}
        aria-describedby="review-tip"
        onPost={() => setPosted(true)}
        audience={{ label: "Public review", who: "anyone on the internet", note: "Reviews are indexed by search engines." }}
      />
      <p id="review-tip" className="text-xs text-muted-foreground">Say what happened and when. Reviews help other shoppers.</p>
      {posted && <p className="text-xs text-muted-foreground">Review posted.</p>}
    </div>
  )
}
