"use client"

import { WebhookTest, type WebhookTestResponse } from "@/registry/default/webhook-test/webhook-test"

/** A stand-in for your backend's test sender: the server redirects http and the missing slash. */
function fakeSend(url: string, signal: AbortSignal): Promise<WebhookTestResponse> {
  const { protocol, pathname } = new URL(url)
  const reply: WebhookTestResponse =
    protocol === "http:" ? { status: 301, location: url.replace("http:", "https:"), body: "<html><body>Moved</body></html>", latencyMs: 84 }
    : !pathname.endsWith("/") ? { status: 308, location: `${pathname}/`, body: "Redirecting…", latencyMs: 92 }
    : { status: 200, body: '{"received":true}', latencyMs: 7400 }
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => resolve(reply), 700)
    signal.addEventListener("abort", () => (clearTimeout(timer), reject(new Error("aborted"))))
  })
}

export function Demo() {
  return <WebhookTest label="Stripe webhook URL" defaultValue="http://hooks.acme.dev/stripe" onSendTest={fakeSend} />
}
