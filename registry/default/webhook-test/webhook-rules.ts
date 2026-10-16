export type WebhookTone = "ok" | "warning" | "danger"

export interface WebhookNote {
  tone: WebhookTone
  message: string
  /** A corrected URL the user can switch to in one tap. */
  fix?: string
}

/** What a pluggable sender reports back from one test delivery. */
export interface WebhookTestResponse {
  status: number
  /** Response body, or the start of it. */
  body?: string
  /** The Location header of a redirect. */
  location?: string
  /** Measured by the sender; the component measures it when left out. */
  latencyMs?: number
}

const TUNNELS = /(^|\.)(ngrok-free\.app|ngrok\.app|ngrok\.io|trycloudflare\.com|loca\.lt|localtunnel\.me|serveo\.net)$/i

/** True for hosts a webhook sender on the internet can never reach (or must refuse to). */
export function isPrivateHost(host: string) {
  const h = host.toLowerCase().replace(/^\[|\]$/g, "")
  if (h === "localhost" || /\.(localhost|local|internal|lan|home\.arpa)$/.test(h)) return true
  const v4 = h.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/)?.slice(1).map(Number)
  if (v4) {
    const [a, b] = v4
    return a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127)
  }
  return h === "::" || h === "::1" || /^f[cd][0-9a-f]{2}:/.test(h) || /^fe[89ab][0-9a-f]:/.test(h) || /^::ffff:(127|10|192\.168)\./.test(h)
}

/** Checks a webhook URL before anything is sent: reachability, https, a real path and tunnels. */
export function checkWebhookUrl(raw: string): { url?: URL; notes: WebhookNote[] } {
  const text = raw.trim()
  if (!text) return { notes: [] }
  let url: URL
  try {
    url = new URL(/^[a-z][\w+.-]*:\/\//i.test(text) ? text : `https://${text}`)
  } catch {
    return { notes: [{ tone: "danger", message: "That isn't a valid URL." }] }
  }
  if (!/^https?:$/.test(url.protocol)) return { notes: [{ tone: "danger", message: "Webhooks need an http or https URL." }] }
  const notes: WebhookNote[] = []
  if (isPrivateHost(url.hostname))
    notes.push({ tone: "danger", message: `${url.hostname} is only reachable from your own network, so the sender can't deliver to it. Use a public URL or a tunnel.` })
  else if (TUNNELS.test(url.hostname))
    notes.push({ tone: "warning", message: "Tunnel URLs change when the tunnel restarts; deliveries will silently stop." })
  if (url.protocol === "http:") {
    const secure = new URL(url.href)
    secure.protocol = "https:"
    notes.push({ tone: "warning", message: "Plain http sends every payload and signature in the clear, and many senders refuse it.", fix: secure.href })
  }
  if (url.pathname === "/" && !url.search) notes.push({ tone: "warning", message: "No path: this posts to the site's home page, not your handler." })
  return { url, notes }
}

const REASONS: Record<number, string> = {
  200: "OK", 201: "Created", 202: "Accepted", 204: "No Content", 301: "Moved Permanently", 302: "Found", 303: "See Other",
  307: "Temporary Redirect", 308: "Permanent Redirect", 400: "Bad Request", 401: "Unauthorized", 403: "Forbidden",
  404: "Not Found", 405: "Method Not Allowed", 408: "Request Timeout", 413: "Payload Too Large", 415: "Unsupported Media Type",
  429: "Too Many Requests", 500: "Internal Server Error", 502: "Bad Gateway", 503: "Service Unavailable", 504: "Gateway Timeout",
}
export const statusText = (status: number) => `${status} ${REASONS[status] ?? ""}`.trim()

const seconds = (ms: number) => `${(ms / 1000).toFixed(ms < 10_000 ? 1 : 0)} s`

/**
 * Reads one test delivery the way a webhook sender would: only a 2xx inside the timeout counts.
 * Redirects fail (senders don't follow them, and a 301 can turn the POST into a GET), slow 2xx
 * responses are flagged before they cross the timeout, and a 200 HTML login page is caught.
 */
export function interpretResponse(response: WebhookTestResponse & { latencyMs: number }, url: string, timeoutMs: number): WebhookNote {
  const { status, latencyMs, location, body = "" } = response
  if (status >= 300 && status < 400) {
    const target = location ? new URL(location, url).href : undefined
    return { tone: "danger", message: `Redirects${target ? ` to ${target}` : ""}. Webhook senders don't follow redirects, so every delivery fails.`, fix: target }
  }
  if (status === 401 || status === 403) return { tone: "danger", message: "Rejected. Check the signing secret, and exempt this route from login and CSRF checks." }
  if (status === 404) return { tone: "danger", message: "Nothing handles this path. Check it against your route." }
  if (status === 405) return { tone: "danger", message: "The path exists but doesn't accept POST." }
  if (status >= 500) return { tone: "danger", message: "Your handler errored. Check its logs for this request." }
  if (status < 200 || status >= 300) return { tone: "danger", message: "Only a 2xx response counts as delivered." }
  if (/<(html|!doctype)/i.test(body) && /log ?in|sign ?in|password/i.test(body))
    return { tone: "warning", message: "Returned 200, but with a login page. The request never reached your handler." }
  if (latencyMs > timeoutMs * 0.6)
    return { tone: "warning", message: `Took ${seconds(latencyMs)}; the sender gives up at ${seconds(timeoutMs)}. Reply first, then do the work in the background.` }
  return { tone: "ok", message: "Delivered. The sender will count this as a success." }
}
