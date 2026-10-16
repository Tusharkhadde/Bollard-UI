"use client"

import * as React from "react"
import { CircleX, Info, TriangleAlert } from "lucide-react"

import { cn } from "@/lib/utils"

export type WebhookEnvironment = "production" | "test"
export type WebhookUrlTone = "danger" | "warning" | "info"
export interface WebhookUrlNote {
  kind: "invalid" | "scheme" | "tunnel" | "inspector" | "private" | "metadata" | "staging" | "http" | "path" | "redirect" | "host" | "route"
  tone: WebhookUrlTone
  message: string
  /** A corrected URL the user can switch to in one tap. */
  fix?: string
}

/** Hostnames handed out by development tunnels, matched as suffixes so "ngrok-tools.example.com" is fine. */
export const TUNNEL_HOSTS = [
  "ngrok.io", "ngrok.app", "ngrok.dev", "ngrok-free.app", "ngrok-free.dev", "trycloudflare.com", "loca.lt", "localtunnel.me",
  "serveo.net", "serveousercontent.com", "localhost.run", "lhr.life", "pinggy.link", "devtunnels.ms", "tunnelmole.net", "loophole.site", "localtonet.com",
]

/** Public request inspectors: anyone holding the link can read what is posted there. */
export const INSPECTOR_HOSTS = ["webhook.site", "requestbin.com", "pipedream.net", "requestcatcher.com", "beeceptor.com", "hookbin.com", "webhook.cool", "typedwebhook.tools", "smee.io"]

const endsWith = (host: string, suffix: string) => host === suffix || host.endsWith(`.${suffix}`)

/** "private" for addresses only your own network can reach, "metadata" for the cloud metadata IP, else null. */
export function hostReach(host: string): "private" | "metadata" | null {
  let h = host.toLowerCase().replace(/^\[|\]$/g, "").replace(/\.$/, "")
  // The URL parser writes ::ffff:127.0.0.1 as ::ffff:7f00:1; read it back as IPv4.
  const mapped = h.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/)
  if (mapped) {
    const [hi, lo] = mapped.slice(1).map((x) => parseInt(x, 16))
    h = [hi >> 8, hi & 255, lo >> 8, lo & 255].join(".")
  } else h = h.replace(/^::ffff:(?=\d+\.)/, "")
  if (h === "169.254.169.254" || h === "fd00:ec2::254" || h === "metadata.google.internal" || h === "100.100.100.200") return "metadata"
  if (h === "localhost" || /\.(localhost|local|internal|lan|home\.arpa)$/.test(h)) return "private"
  const v4 = h.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/)?.slice(1).map(Number)
  if (v4) {
    const [a, b] = v4
    return a === 0 || a === 10 || a === 127 || a >= 224 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || (a === 198 && (b === 18 || b === 19)) ? "private" : null
  }
  return h === "::" || h === "::1" || /^f[cd][0-9a-f]{2}:/.test(h) || /^fe[89ab][0-9a-f]:/.test(h) ? "private" : null
}

/** The staging-looking label in a hostname ("api-staging", "dev"), ignoring the TLD so ".dev" domains pass. */
export function stagingLabel(host: string) {
  return host.toLowerCase().split(".").slice(0, -1).find((l) => /(^|-)(staging|stage|stg|dev|test|qa|sandbox|uat|preview)(-|$)/.test(l)) ?? null
}

const withScheme = (text: string) => (/^[a-z][\w+.-]*:\/\//i.test(text) ? text : `https://${text}`)
const parse = (text: string) => { try { return new URL(withScheme(text.trim())) } catch { return null } }

/**
 * Checks a webhook URL for the environment it is being saved to, and against the URL saved last
 * time. The same ngrok URL is fine in test mode and an outage in production.
 */
export function checkWebhookTarget(raw: string, environment: WebhookEnvironment = "production", previous?: string): WebhookUrlNote[] {
  const text = raw.trim()
  if (!text) return []
  const url = parse(text)
  if (!url || !url.hostname) return [{ kind: "invalid", tone: "danger", message: "That isn't a valid URL." }]
  if (!/^https?:$/.test(url.protocol)) return [{ kind: "invalid", tone: "danger", message: "Webhooks need an http or https URL." }]
  const prod = environment === "production"
  const host = url.hostname.toLowerCase().replace(/\.$/, "")
  const notes: WebhookUrlNote[] = []
  const reach = hostReach(host)
  const tunnel = TUNNEL_HOSTS.find((s) => endsWith(host, s))
  const staging = stagingLabel(host)
  const inspector = INSPECTOR_HOSTS.find((s) => endsWith(host, s))

  if (!/^[a-z][\w+.-]*:\/\//i.test(text)) notes.push({ kind: "scheme", tone: "info", message: "No scheme, so https:// is assumed.", fix: url.href })
  if (reach === "metadata") notes.push({ kind: "metadata", tone: "danger", message: "This is the cloud metadata address. Senders block it, and it can leak server credentials." })
  else if (reach === "private")
    notes.push(prod
      ? { kind: "private", tone: "danger", message: `${host} is only reachable inside your own network. No event will ever arrive.` }
      : { kind: "private", tone: "warning", message: `The sender can't reach ${host} from the internet. Use a tunnel such as ngrok while testing.` })
  else if (tunnel)
    notes.push(prod
      ? { kind: "tunnel", tone: "danger", message: `${tunnel} is a development tunnel. It stops resolving when the tunnel closes, and senders like Stripe disable an endpoint after 3 days of failures.` }
      : { kind: "tunnel", tone: "info", message: "Tunnel URL: fine while testing, but don't copy it to production." })
  else if (inspector)
    notes.push(prod
      ? { kind: "inspector", tone: "danger", message: `${inspector} is a public request inspector. Anyone with the link can read live payloads, customer data included.` }
      : { kind: "inspector", tone: "info", message: "Request inspector: handy for seeing payloads, but never point production here." })
  else if (prod && staging) notes.push({ kind: "staging", tone: "warning", message: `“${staging}” looks like a staging server. Live events would go there.` })
  if (url.protocol === "http:" && !reach) {
    const secure = new URL(url.href)
    secure.protocol = "https:"
    notes.push({ kind: "http", tone: prod ? "warning" : "info", message: "Plain http sends payloads and signatures unencrypted. Stripe requires https in live mode.", fix: secure.href })
  }
  if (url.pathname === "/" && !url.search && !inspector) notes.push({ kind: "path", tone: "warning", message: "No path, so events post to the site's home page, not your handler." })

  const before = previous ? parse(previous) : null
  if (before && before.href !== url.href) {
    const bare = (u: URL) => u.hostname.replace(/^www\./, "") + u.pathname.replace(/\/$/, "") + u.search
    if (bare(before) === bare(url) && before.protocol === url.protocol)
      notes.push({ kind: "redirect", tone: "warning", message: "Only the www or trailing slash changed. If your server redirects between them, every delivery fails: senders treat redirects as failures.", fix: previous })
    else if (before.hostname !== url.hostname)
      notes.push({ kind: "host", tone: "warning", message: `Events will go to a different server than before (${before.hostname}).`, fix: previous })
    else if (before.pathname !== url.pathname)
      notes.push({ kind: "route", tone: "info", message: `Events will go to a different route than before (${before.pathname}).`, fix: previous })
  }
  const order = { danger: 0, warning: 1, info: 2 }
  return notes.sort((a, b) => order[a.tone] - order[b.tone])
}

/** Splits `next` into the part shared with `prev` and the part that changed. */
function changed(prev: string, next: string): [string, string, string] {
  let s = 0
  while (s < prev.length && prev[s] === next[s]) s++
  let e = 0
  while (e < Math.min(prev.length, next.length) - s && prev[prev.length - 1 - e] === next[next.length - 1 - e]) e++
  return [next.slice(0, s), next.slice(s, next.length - e), next.slice(next.length - e)]
}

const tones = {
  danger: { text: "text-red-700 dark:text-red-400", icon: CircleX },
  warning: { text: "text-amber-700 dark:text-amber-400", icon: TriangleAlert },
  info: { text: "text-muted-foreground", icon: Info },
}
const fieldClass =
  "h-9 w-full min-w-0 rounded-md border bg-transparent px-3 font-mono text-base shadow-xs transition-[color,box-shadow] outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm dark:bg-input/30 data-warning:border-amber-500 dark:data-warning:border-amber-400 data-danger:border-red-500 dark:data-danger:border-red-400"
const fixClass =
  "inline-flex h-6 max-w-full items-center gap-1 rounded-md border border-amber-500/40 px-2 font-medium text-amber-900 transition-colors hover:bg-amber-500/10 dark:text-amber-200 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"

export interface WebhookUrlInputProps extends Omit<React.ComponentProps<"input">, "value" | "defaultValue" | "onChange" | "type"> {
  /** Visible label. */
  label?: string
  /** Controlled URL text. */
  value?: string
  /** Initial URL text when uncontrolled. */
  defaultValue?: string
  /** Called with the URL on every change, including fixes. */
  onValueChange?: (value: string) => void
  /** Where this endpoint delivers. Tunnels and private hosts are errors in production, hints in test. */
  environment?: WebhookEnvironment
  /** The URL saved last time. A change is shown as a diff, with a one-tap revert. */
  previousValue?: string
  /** Pause in ms before notes appear while typing. Leaving the field shows them at once. */
  delay?: number
  /** Badge text per environment. */
  environmentLabels?: Record<WebhookEnvironment, string>
  /** Label before the last saved URL. */
  savedLabel?: string
  /** Fix button labels, by the kind of note they fix. */
  fixLabels?: Partial<Record<WebhookUrlNote["kind"], string>>
  /** Rewrites a note's message, e.g. to translate it. */
  formatNote?: (note: WebhookUrlNote) => string
}

/**
 * A webhook URL field that knows which environment it's saving to and what was saved before.
 * It turns an ngrok, localhost or private-IP URL into an error in production (and a hint in
 * test mode), flags staging hosts, plain http and a missing path, and shows exactly what changed
 * since the last save, with a one-tap revert when only a www or trailing slash moved.
 */
export function WebhookUrlInput({
  label = "Endpoint URL", value, defaultValue = "", onValueChange, environment = "production", previousValue, delay = 500,
  environmentLabels = { production: "Production", test: "Test mode" }, savedLabel = "Saved",
  fixLabels, formatNote = (n) => n.message, id, className, onBlur, ref, ...props
}: WebhookUrlInputProps) {
  const [inner, setInner] = React.useState(defaultValue)
  const text = value ?? inner
  const [settled, setSettled] = React.useState(text)
  const autoId = React.useId()
  const inputId = id ?? autoId
  const fixes = { scheme: "Use https://", http: "Use https", redirect: "Keep saved URL", host: "Revert", route: "Revert", ...fixLabels }

  React.useEffect(() => {
    const timer = setTimeout(() => setSettled(text), delay)
    return () => clearTimeout(timer)
  }, [text, delay])

  const update = (next: string) => {
    if (value === undefined) setInner(next)
    onValueChange?.(next)
  }
  const field = React.useRef<HTMLInputElement | null>(null)
  const setRef = (el: HTMLInputElement | null) => {
    field.current = el
    if (typeof ref === "function") ref(el)
    else if (ref) ref.current = el
  }
  const apply = (next: string) => { update(next); setSettled(next); field.current?.focus() }

  const notes = settled === text ? checkWebhookTarget(text, environment, previousValue) : []
  const worst = notes[0]?.tone
  const diff = previousValue && text.trim() && notes.some((n) => ["redirect", "host", "route"].includes(n.kind)) ? changed(previousValue, text.trim()) : null

  return (
    <div data-slot="webhook-url-input" className={cn("grid w-full max-w-md gap-1.5", className)}>
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={inputId} className="w-fit text-sm font-medium">{label}</label>
        <span className={cn("rounded-full border px-2 py-0.5 text-xs font-medium", environment === "production" ? "border-red-500/30 text-red-700 dark:text-red-400" : "text-muted-foreground")}>
          {environmentLabels[environment]}
        </span>
      </div>
      <input
        ref={setRef}
        id={inputId}
        type="text"
        inputMode="url"
        autoComplete="off"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        value={text}
        onChange={(e) => update(e.target.value)}
        onBlur={(e) => { setSettled(text); onBlur?.(e) }}
        aria-describedby={`${inputId}-notes`}
        aria-invalid={worst === "danger" || undefined}
        data-danger={worst === "danger" ? "" : undefined}
        data-warning={worst === "warning" ? "" : undefined}
        className={fieldClass}
        {...props}
      />
      <div id={`${inputId}-notes`} aria-live="polite" className="grid gap-0.5 text-xs">
        {diff && (
          <p className="grid gap-0.5 rounded-md bg-muted/60 px-2 py-1.5 font-mono [overflow-wrap:anywhere]">
            <span className="text-muted-foreground">{savedLabel}: {previousValue}</span>
            <span>
              {diff[0]}
              <mark className="rounded-sm bg-amber-300/50 px-px text-inherit dark:bg-amber-400/25">{diff[1] || "⌫"}</mark>
              {diff[2]}
            </span>
          </p>
        )}
        {notes.map((n) => {
          const tone = tones[n.tone]
          const fixLabel = fixes[n.kind as keyof typeof fixes]
          return (
            <p key={n.kind} className={cn("flex gap-1.5", tone.text)}>
              <span className="flex h-6 shrink-0 items-center"><tone.icon aria-hidden className="size-3.5" /></span>
              <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                <span className="min-w-0 py-1 [overflow-wrap:anywhere]">{formatNote(n)}</span>
                {n.fix && fixLabel && <button type="button" onClick={() => apply(n.fix!)} className={fixClass}>{fixLabel}</button>}
              </span>
            </p>
          )
        })}
      </div>
    </div>
  )
}
