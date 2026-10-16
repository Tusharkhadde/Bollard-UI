"use client"

import * as React from "react"
import { CircleCheck, CircleX, LoaderCircle, Send, TriangleAlert } from "lucide-react"

import { cn } from "@/lib/utils"
import { checkWebhookUrl, interpretResponse, statusText, type WebhookNote, type WebhookTestResponse } from "./webhook-rules"

export { checkWebhookUrl, interpretResponse, isPrivateHost, statusText } from "./webhook-rules"
export type { WebhookNote, WebhookTestResponse, WebhookTone } from "./webhook-rules"

type Result = (WebhookTestResponse & { latencyMs: number; url: string; note: WebhookNote }) | { url: string; note: WebhookNote; failed: true }

export interface WebhookTestProps extends Omit<React.ComponentProps<"input">, "value" | "defaultValue" | "onChange" | "type"> {
  /** Visible label. */
  label?: string
  /** Controlled URL text. */
  value?: string
  /** Initial URL text when uncontrolled. */
  defaultValue?: string
  /** Called with the text on every change, including one-tap fixes. */
  onValueChange?: (value: string) => void
  /** Sends one test delivery, usually through your backend. Abort when the signal fires. */
  onSendTest?: (url: string, signal: AbortSignal) => Promise<WebhookTestResponse>
  /** How long the real sender waits, in ms (GitHub: 10 s). Slow replies are flagged against it. */
  timeout?: number
  /** Label of the send-test button. */
  sendLabel?: string
  /** Label of the fix that switches to a corrected URL. */
  useUrlLabel?: string
  /** Shown when the test didn't answer in time; `{seconds}` is filled in. */
  timeoutMessage?: string
  /** Shown when the sender itself failed (network error). */
  errorMessage?: string
  /** Shown over a result for a URL that has since changed. */
  staleMessage?: string
}

const fieldClass =
  "h-9 w-full min-w-0 rounded-md border bg-transparent px-3 text-base shadow-xs transition-[color,box-shadow] outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm dark:bg-input/30 data-warning:border-amber-500 dark:data-warning:border-amber-400 data-danger:border-red-500 dark:data-danger:border-red-400"
const fixClass =
  "inline-flex h-6 max-w-full items-center gap-1 rounded-md border border-amber-500/40 px-2 font-medium text-amber-900 transition-colors hover:bg-amber-500/10 dark:text-amber-200 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
const tones = {
  ok: { text: "text-emerald-700 dark:text-emerald-400", bar: "bg-emerald-500", icon: CircleCheck },
  warning: { text: "text-amber-700 dark:text-amber-400", bar: "bg-amber-500", icon: TriangleAlert },
  danger: { text: "text-red-700 dark:text-red-400", bar: "bg-red-500", icon: CircleX },
}

function Note({ note, onFix, fixLabel }: { note: WebhookNote; onFix: (url: string) => void; fixLabel: string }) {
  const tone = tones[note.tone]
  return (
    <p role={note.tone === "danger" ? "alert" : undefined} className={cn("flex gap-1.5", tone.text)}>
      <span className="flex h-6 shrink-0 items-center"><tone.icon aria-hidden className="size-3.5" /></span>
      <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
        <span className="min-w-0 py-1 [overflow-wrap:anywhere]">{note.message}</span>
        {note.fix ? (
          <button type="button" onClick={() => onFix(note.fix!)} className={fixClass}>
            <span className="truncate">{fixLabel}</span>
          </button>
        ) : null}
      </span>
    </p>
  )
}

/**
 * A webhook URL field with a pluggable "Send test" that judges the reply the way the real sender
 * will: only a 2xx inside the timeout counts. It catches localhost and private IPs before you
 * send, plain http, a missing path and tunnel URLs, then shows status, latency against the
 * timeout and a response snippet, flagging redirects (senders don't follow them, with a one-tap
 * switch to the final URL), slow replies near the timeout and 200 login pages.
 */
export function WebhookTest({
  label = "Webhook URL",
  value,
  defaultValue = "",
  onValueChange,
  onSendTest,
  timeout = 10_000,
  sendLabel = "Send test",
  useUrlLabel = "Use this URL",
  timeoutMessage = "No reply in {seconds} s. The sender would mark this delivery failed.",
  errorMessage = "The test couldn't connect to this URL.",
  staleMessage = "URL changed since this test.",
  placeholder = "https://api.example.com/webhooks",
  id,
  className,
  ...props
}: WebhookTestProps) {
  const [inner, setInner] = React.useState(defaultValue)
  const [pending, setPending] = React.useState(false)
  const [result, setResult] = React.useState<Result | null>(null)
  const [filling, setFilling] = React.useState(false)
  const abortRef = React.useRef<AbortController | null>(null)
  const autoId = React.useId()
  const inputId = id ?? autoId
  const text = value ?? inner
  const { url, notes } = React.useMemo(() => checkWebhookUrl(text), [text])
  const worst = notes.some((n) => n.tone === "danger") ? "danger" : notes.length ? "warning" : null

  React.useEffect(() => () => abortRef.current?.abort(), [])
  // Start the timeout bar one frame after it mounts, so it transitions from empty.
  React.useEffect(() => {
    if (!pending) return setFilling(false)
    const frame = requestAnimationFrame(() => setFilling(true))
    return () => cancelAnimationFrame(frame)
  }, [pending])

  const update = (next: string) => {
    if (value === undefined) setInner(next)
    onValueChange?.(next)
  }

  const send = async () => {
    if (!url || !onSendTest) return
    const target = url.href
    const controller = new AbortController()
    abortRef.current = controller
    setPending(true)
    const started = performance.now()
    const timer = setTimeout(() => controller.abort(), timeout)
    try {
      const response = await Promise.race([
        onSendTest(target, controller.signal),
        new Promise<never>((_, reject) => controller.signal.addEventListener("abort", () => reject(new Error("timeout"))))
      ])
      const latencyMs = response.latencyMs ?? performance.now() - started
      setResult({ ...response, latencyMs, url: target, note: interpretResponse({ ...response, latencyMs }, target, timeout) })
    } catch {
      const timedOut = controller.signal.aborted
      setResult({ url: target, failed: true, note: { tone: "danger", message: timedOut ? timeoutMessage.replace("{seconds}", String(timeout / 1000)) : errorMessage } })
    } finally {
      clearTimeout(timer)
      setPending(false)
    }
  }

  const stale = result && url?.href !== result.url
  const done = result && !("failed" in result) ? result : null

  return (
    <div data-slot="webhook-test" className={cn("grid w-full max-w-sm gap-1.5", className)}>
      <label htmlFor={inputId} className="w-fit text-sm font-medium">{label}</label>
      <div className="flex gap-2">
        <input
          id={inputId}
          type="url"
          inputMode="url"
          autoComplete="off"
          spellCheck={false}
          value={text}
          placeholder={placeholder}
          onChange={(event) => update(event.target.value)}
          aria-describedby={`${inputId}-status`}
          data-warning={worst === "warning" ? "" : undefined}
          data-danger={worst === "danger" ? "" : undefined}
          className={fieldClass}
          {...props}
        />
        <button
          type="button"
          onClick={send}
          disabled={!url || !onSendTest || pending}
          className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-md border bg-background px-3 text-sm font-medium shadow-xs transition-colors hover:bg-accent disabled:pointer-events-none disabled:opacity-50 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:border-input dark:bg-input/30 dark:hover:bg-input/50"
        >
          {pending ? <LoaderCircle aria-hidden className="size-4 animate-spin" /> : <Send aria-hidden className="size-4" />}
          {sendLabel}
        </button>
      </div>
      <div id={`${inputId}-status`} aria-live="polite" className="grid gap-1 text-xs">
        {notes.map((note) => <Note key={note.message} note={note} onFix={update} fixLabel={note.fix?.startsWith("https:") ? "Use https" : useUrlLabel} />)}
        {pending || result ? (
          <div className={cn("mt-1.5 grid gap-1.5 rounded-md border bg-muted/30 p-2.5 transition-opacity", stale && "opacity-60")}>
            <div className="flex items-center justify-between gap-2 font-medium tabular-nums">
              <span className={cn(done && tones[done.note.tone].text)}>
                {pending ? "Waiting for a reply…" : done ? statusText(done.status) : "No response"}
              </span>
              {done ? <span className="text-muted-foreground">{done.latencyMs < 1000 ? `${Math.round(done.latencyMs)} ms` : `${(done.latencyMs / 1000).toFixed(1)} s`}</span> : null}
            </div>
            {/* Latency against the sender's timeout: fills live while waiting, the end is the cut-off. */}
            <div aria-hidden className="relative h-1.5 overflow-hidden rounded-full bg-muted">
              <div
                className={cn("h-full rounded-full", pending ? "bg-muted-foreground/40 ease-linear motion-safe:transition-[width]" : cn(tones[result!.note.tone].bar, "motion-safe:transition-[width] motion-safe:duration-300 motion-safe:ease-out"))}
                style={{
                  width: pending ? (filling ? "100%" : "0%") : `${Math.min(100, Math.max(2, done ? (done.latencyMs / timeout) * 100 : 100))}%`,
                  transitionDuration: pending ? `${timeout}ms` : undefined,
                }}
              />
            </div>
            {result && !pending ? (
              <>
                {stale ? <p className="text-muted-foreground">{staleMessage}</p> : null}
                <Note note={result.note} onFix={update} fixLabel={useUrlLabel} />
                {done?.body ? (
                  <pre className="max-h-16 overflow-hidden rounded border bg-background px-2 py-1 font-mono text-[11px] leading-4 whitespace-pre-wrap text-muted-foreground [overflow-wrap:anywhere]">
                    {done.body.slice(0, 240)}
                  </pre>
                ) : null}
              </>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  )
}
