"use client"

import { CodeInput } from "@/registry/default/code-input/code-input"

export function Demo() {
  return (
    <div className="grid w-full max-w-sm gap-4">
      <CodeInput
        label="Deploy command (pasted from a doc)"
        rows={4}
        defaultValue={"git push —force origin main\nexport API_KEY=“sk_live_51H\u200b8xQ”"}
      />
      <CodeInput
        label="Webhook payload"
        json
        rows={5}
        defaultValue={'{\n  "event": "order.paid",\n  "amount": 4999,\n  "currency": "INR",\n}'}
      />
    </div>
  )
}
