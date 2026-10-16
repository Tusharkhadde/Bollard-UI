"use client"

import * as React from "react"
import { KeyRound } from "lucide-react"

import { cn } from "@/lib/utils"

export interface SecretMatch {
  /** Human name, e.g. "Stripe live secret key". */
  label: string
  /** The matched text. */
  value: string
  start: number
  end: number
  /** True for the generic high-entropy rule, which is a guess rather than a known format. */
  heuristic: boolean
}

const RULES: [string, RegExp][] = [
  ["Private key", /-----BEGIN (?:[A-Z0-9]+ )*PRIVATE KEY-----[\s\S]*?(?:-----END (?:[A-Z0-9]+ )*PRIVATE KEY-----|$)/g],
  ["AWS access key", /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/g],
  ["GitHub token", /\bgh[pousr]_[A-Za-z0-9]{36,}\b/g],
  ["GitHub fine-grained token", /\bgithub_pat_[A-Za-z0-9_]{22,}/g],
  ["Stripe live secret key", /\bsk_live_[A-Za-z0-9]{16,}/g],
  ["Stripe restricted key", /\brk_live_[A-Za-z0-9]{16,}/g],
  ["Slack token", /\bxox[abprs]-[A-Za-z0-9-]{10,}/g],
  ["Anthropic API key", /\bsk-ant-[A-Za-z0-9_-]{20,}/g],
  ["OpenAI API key", /\bsk-(?:proj-|svcacct-|admin-)?[A-Za-z0-9_-]{20,}/g],
  ["Google API key", /\bAIza[0-9A-Za-z_-]{35}/g],
  ["JSON Web Token", /\beyJ[A-Za-z0-9_-]{8,}\.eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{10,}/g],
]

/** Shannon entropy in bits per character. Random base64 sits near 5-6; English words near 3-4. */
export function shannonEntropy(text: string) {
  const counts = new Map<string, number>()
  for (const ch of text) counts.set(ch, (counts.get(ch) ?? 0) + 1)
  let bits = 0
  for (const n of counts.values()) bits -= (n / text.length) * Math.log2(n / text.length)
  return bits
}

/**
 * Finds likely secrets in text: known token formats first, then long
 * mixed-case-and-digit strings with high Shannon entropy. Matches never overlap.
 */
export function detectSecrets(text: string): SecretMatch[] {
  const found: SecretMatch[] = []
  const overlaps = (start: number, end: number) => found.some((m) => start < m.end && end > m.start)
  for (const [label, pattern] of RULES) {
    for (const m of text.matchAll(pattern)) {
      const end = m.index + m[0].length
      if (!overlaps(m.index, end)) found.push({ label, value: m[0], start: m.index, end, heuristic: false })
    }
  }
  const urls = Array.from(text.matchAll(/https?:\/\/\S+/g), (m) => [m.index, m.index + m[0].length])
  for (const m of text.matchAll(/[A-Za-z0-9+/=_-]{32,}/g)) {
    const token = m[0]
    const end = m.index + token.length
    // A URL path like /assets/SomeLongName isn't a secret, but a token in its query string can be.
    const isPath = token.includes("/") && urls.some(([s, e]) => m.index >= s && end <= e)
    const mixed = /[a-z]/.test(token) && /[A-Z]/.test(token) && /\d/.test(token)
    if (mixed && !isPath && shannonEntropy(token) >= 4.2 && !overlaps(m.index, end))
      found.push({ label: "High-entropy string", value: token, start: m.index, end, heuristic: true })
  }
  return found.sort((a, b) => a.start - b.start)
}

/** "•••" plus the last 4 characters, so people can still tell which key it was. */
export function redactSecret(match: SecretMatch) {
  return match.label === "Private key" ? "••• [private key removed]" : `•••${match.value.slice(-4)}`
}

export interface SecretPasteGuardProps extends Omit<React.ComponentProps<"div">, "onChange"> {
  /** The field's value. The guard scans it whether it was typed or pasted. */
  value: string
  /** Called with the redacted text when the user chooses Redact. */
  onValueChange: (value: string) => void
  /** Your input, textarea or chat box, controlled by the same value. */
  children: React.ReactNode
  /** Notified whenever the set of unresolved secrets changes, e.g. to hold a Send button. */
  onDetect?: (matches: SecretMatch[]) => void
  /** Label of the button that replaces every secret with its last 4 characters. */
  redactLabel?: string
  /** Label of the button that dismisses the warning for these values. */
  keepLabel?: string
}

const preview = (m: SecretMatch) =>
  m.label === "Private key" ? "BEGIN … PRIVATE KEY" : `${m.value.slice(0, Math.min(8, Math.floor(m.value.length / 4)))}…${m.value.slice(-4)}`

/**
 * Wraps any text field and warns when its content looks like a credential
 * (cloud, Git, payment and AI keys, JWTs, private keys, or random-looking
 * strings) before it is sent or saved. One tap redacts, keeping the last 4.
 */
export function SecretPasteGuard({
  value,
  onValueChange,
  children,
  onDetect,
  redactLabel = "Redact",
  keepLabel = "Keep",
  className,
  onPasteCapture,
  onKeyDownCapture,
  ...props
}: SecretPasteGuardProps) {
  const [kept, setKept] = React.useState<ReadonlySet<string>>(() => new Set())
  const [pasted, setPasted] = React.useState(false)
  const rootRef = React.useRef<HTMLDivElement>(null)
  const lastSignature = React.useRef<string>(undefined)
  const matches = React.useMemo(() => detectSecrets(value).filter((m) => !kept.has(m.value)), [value, kept])

  // Report only when the set of secrets changes, not on every keystroke.
  React.useEffect(() => {
    const signature = matches.map((m) => m.value).join("\n")
    if (signature === lastSignature.current) return
    lastSignature.current = signature
    onDetect?.(matches)
  })

  // The warning (and the button just pressed) unmounts on resolve, so put the caret back in the field.
  const refocusField = () =>
    requestAnimationFrame(() => rootRef.current?.querySelector<HTMLElement>("textarea, input, [contenteditable=true]")?.focus())

  const redact = () => {
    let next = value
    for (const m of [...matches].reverse()) next = next.slice(0, m.start) + redactSecret(m) + next.slice(m.end)
    onValueChange(next)
    refocusField()
  }
  const keep = () => {
    setKept((prev) => new Set([...prev, ...matches.map((m) => m.value)]))
    refocusField()
  }

  const button =
    "inline-flex h-8 items-center rounded-md px-3 text-sm font-medium outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50"
  const allHeuristic = matches.every((m) => m.heuristic)

  return (
    <div
      ref={rootRef}
      data-slot="secret-paste-guard"
      className={cn("w-full", className)}
      onPasteCapture={(event) => {
        onPasteCapture?.(event)
        setPasted(true)
      }}
      onKeyDownCapture={(event) => {
        onKeyDownCapture?.(event)
        if (!event.metaKey && !event.ctrlKey) setPasted(false)
      }}
      {...props}
    >
      {children}
      <div aria-live="polite">
        {matches.length > 0 && (
          <div className="mt-1.5 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2.5 text-sm dark:border-amber-800 dark:bg-amber-950/40">
            <div className="flex items-start gap-2">
              <KeyRound className="mt-0.5 size-4 shrink-0 text-amber-700 dark:text-amber-400" aria-hidden />
              <div className="min-w-0 flex-1 space-y-1.5">
                <p className="font-medium text-amber-900 dark:text-amber-100">
                  {pasted ? "You pasted" : "This contains"}{" "}
                  {allHeuristic ? "something that looks like a secret" : matches.length === 1 ? "a secret" : `${matches.length} secrets`}
                </p>
                <ul className="space-y-0.5">
                  {matches.map((m) => (
                    <li key={`${m.start}-${m.value}`} className="flex flex-wrap items-baseline gap-x-2 text-xs text-amber-900/80 dark:text-amber-100/80">
                      <span>{m.label}</span>
                      <code className="rounded bg-background/70 px-1 font-mono break-all">{preview(m)}</code>
                      {m.heuristic && <span className="opacity-70">{shannonEntropy(m.value).toFixed(1)} bits/char</span>}
                    </li>
                  ))}
                </ul>
                <div className="flex gap-2 pt-0.5">
                  <button type="button" onClick={redact} className={cn(button, "bg-primary text-primary-foreground hover:bg-primary/90")}>
                    {redactLabel}
                  </button>
                  <button type="button" onClick={keep} className={cn(button, "border bg-background hover:bg-accent")}>
                    {keepLabel}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
