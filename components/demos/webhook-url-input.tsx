"use client"

import { WebhookUrlInput } from "@/registry/default/webhook-url-input/webhook-url-input"

export function Demo() {
  return (
    <form className="grid w-full max-w-md gap-4" onSubmit={(event) => event.preventDefault()}>
      <WebhookUrlInput
        label="Live endpoint"
        environment="production"
        previousValue="https://api.acme.in/webhooks/stripe"
        defaultValue="https://3f2a-49-36-112-8.ngrok-free.app/webhooks/stripe"
      />
      <WebhookUrlInput label="Test endpoint" environment="test" defaultValue="http://localhost:3000/api/webhooks" />
    </form>
  )
}
