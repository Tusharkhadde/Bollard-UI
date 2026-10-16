"use client"

import * as React from "react"

import { analyzeUrl, UrlInput } from "@/registry/default/url-input/url-input"

const shared = "shop.example.com/sneakers?size=42&utm_source=newsletter&utm_medium=email&fbclid=IwAR3x"

export function Demo() {
  const [saved, setSaved] = React.useState(() => analyzeUrl(shared).url?.href ?? null)
  return (
    <div className="grid w-full max-w-sm gap-4">
      <UrlInput label="Link to share" defaultValue={shared} onUrlChange={setSaved} />
      <UrlInput label="Bank login page" defaultValue="https://xn--pple-43d.com/signin" />
      <UrlInput label="Payment link from a text" defaultValue="https://paypal.com@secure-pay.example/login" />
      <UrlInput label="Webhook endpoint" defaultValue="http://hooks.acme.con/orders" />
      <p className="text-xs text-muted-foreground">
        First field saves <code className="font-mono break-all text-foreground">{saved ?? "nothing yet"}</code>
      </p>
    </div>
  )
}
