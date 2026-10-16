"use client"

import * as React from "react"
import { ArrowUp, Eye, EyeOff, FileText, Loader2, ShieldAlert, ShieldCheck, X } from "lucide-react"
import { AnimatePresence, animate, motion, useReducedMotion } from "motion/react"

import { cn } from "@/lib/utils"
import { detectSecrets as defaultSecrets } from "@/registry/default/secret-paste-guard/secret-paste-guard"

import { DATA_KINDS, applyStandIns, scanPrompt, type DataKind, type NameDetector, type SecretDetector } from "./stand-ins"

export { DATA_KINDS, applyStandIns, restoreStandIns, scanPrompt, type DataKind, type DataMatch, type NameDetector, type PromptScan, type ScanOptions, type SecretDetector } from "./stand-ins"

export const PROMPT_DATA_GUARD_MESSAGES = {
  label: "Message",
  willGo: "{list} will go to {dest}",
  kept: ", kept {retention}",
  training: ", and may be used to train its models",
  rows: "{count} customer row|{count} customer rows",
  kind: {
    secret: "{count} API key or token|{count} API keys or tokens",
    card: "{count} card number|{count} card numbers",
    aadhaar: "{count} Aadhaar number|{count} Aadhaar numbers",
    pan: "{count} PAN|{count} PANs",
    email: "{count} email address|{count} email addresses",
    phone: "{count} phone number|{count} phone numbers",
    address: "{count} home address|{count} home addresses",
    name: "{count} name|{count} names",
  } satisfies Record<DataKind, string>,
  chip: { secret: "Keys", card: "Cards", aadhaar: "Aadhaar", pan: "PAN", email: "Emails", phone: "Phones", address: "Addresses", name: "Names" } satisfies Record<DataKind, string>,
  marked: "a {marking} doc",
  and: " and ",
  preview: "See what {dest} gets",
  hidePreview: "Hide preview",
  standIns: "Send with stand-ins",
  standInsHint: "Real values stay on this device and come back in the reply.",
  sendReal: "Send real data",
  confirmReal: "Press again to send the real data to {dest}.",
  sendRealAgain: "Send real data anyway",
  send: "Send",
  sending: "Sending…",
  remove: "Remove {name}",
  sent: "Sent with {count} stand-in. The reply will show the real value.|Sent with {count} stand-ins. The reply will show the real values.",
  sentReal: "Sent.",
  failed: "That didn't send. Your message is still here.",
}

type Messages = Omit<typeof PROMPT_DATA_GUARD_MESSAGES, "kind" | "chip"> & { kind: Record<DataKind, string>; chip: Record<DataKind, string> }

export interface PromptAttachment {
  id: string
  name: string
  /** Text content, when you have it. Only text is scanned and stood in for. */
  text?: string
}

export interface PromptSendPayload {
  text: string
  attachments: PromptAttachment[]
  /** Stand-in → real value. Keep it on the device and pass it to `restoreStandIns(reply, mapping)`. */
  mapping: Record<string, string>
  /** True when stand-ins replaced the real data. */
  protected: boolean
}

export interface PromptDataGuardProps extends Omit<React.ComponentProps<"textarea">, "value" | "defaultValue" | "onChange"> {
  value?: string
  defaultValue?: string
  onValueChange?: (value: string) => void
  /** Files attached to the message. */
  attachments?: PromptAttachment[]
  onRemoveAttachment?: (id: string) => void
  /** Who receives the message and for how long they keep it, e.g. { name: "OpenAI", retention: "30 days" }. */
  destination?: { name: string; retention?: string; training?: boolean }
  /** Sends the message. May return a Promise: the button shows a pending state and can't fire twice. */
  onSend?: (payload: PromptSendPayload) => void | Promise<void>
  /** Secret finder. Defaults to secret-paste-guard's; pass false to skip secrets. */
  detectSecrets?: SecretDetector | false
  /** Optional name finder for free text (an NER model, your CRM's contact list). Names in table name columns are always caught. */
  detectNames?: NameDetector
  className?: string
  textareaClassName?: string
  messages?: Partial<Omit<Messages, "kind" | "chip">> & { kind?: Partial<Record<DataKind, string>>; chip?: Partial<Record<DataKind, string>> }
}

const fill = (t: string, v: Record<string, string | number>) =>
  (t.includes("|") ? t.split("|")[Number(v.count) === 1 ? 0 : 1] : t).replace(/\{(\w+)\}/g, (k, key: string) => String(v[key] ?? k))
const list = (parts: string[], and: string) => (parts.length < 2 ? parts.join("") : `${parts.slice(0, -1).join(", ")}${and}${parts[parts.length - 1]}`)
const btn = "inline-flex h-8 items-center justify-center gap-1.5 rounded-md px-3 text-sm font-medium outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-60"
const NO_ATTACHMENTS: PromptAttachment[] = []
const clean = (s: string) => s.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n")

/** Scans the message and attachments together and builds the stand-in payload, numbered consistently across both. */
function analyse(text: string, attachments: PromptAttachment[], detectSecrets?: SecretDetector, detectNames?: NameDetector) {
  let prompt = scanPrompt(clean(text), { detectSecrets, detectNames })
  let files = attachments.map((a) => ({ a, scan: scanPrompt(clean(a.text ?? ""), { detectSecrets, detectNames }) }))
  // A name found in one place (the pasted table) is stood in wherever else it appears (the question, a file).
  const knownNames = [...new Set([prompt, ...files.map((f) => f.scan)].flatMap((s) => s.matches.filter((m) => m.kind === "name").map((m) => m.value)))]
  if (knownNames.length) {
    prompt = scanPrompt(clean(text), { detectSecrets, detectNames, knownNames })
    files = attachments.map((a) => ({ a, scan: scanPrompt(clean(a.text ?? ""), { detectSecrets, detectNames, knownNames }) }))
  }
  const all = [prompt, ...files.map((f) => f.scan)]
  const unique = (k: DataKind) => new Set(all.flatMap((s) => s.matches.filter((x) => x.kind === k).map((x) => x.value.toLowerCase().replace(/\s/g, "")))).size
  const counts = DATA_KINDS.map((k) => [k, unique(k)] as const).filter(([, n]) => n > 0)
  const markings = [...new Set(all.flatMap((s) => s.markings))]
  let mapping: Record<string, string> = {}
  const p = applyStandIns(clean(text), prompt.matches, mapping)
  mapping = p.mapping
  const stood = files.map(({ a, scan }) => {
    if (!a.text) return a
    const r = applyStandIns(clean(a.text), scan.matches, mapping)
    mapping = r.mapping
    return { ...a, text: r.text }
  })
  return {
    files,
    counts,
    rows: all.reduce((n, s) => n + s.rows, 0),
    markings,
    risky: counts.length > 0 || markings.length > 0,
    standable: counts.length > 0,
    payload: { text: p.text, attachments: stood, mapping },
  }
}

/**
 * Stops customer data, secrets and confidential documents going into an AI chat by saying, before send,
 * exactly what goes where ("248 customer rows and a CONFIDENTIAL doc will go to OpenAI, kept up to 30 days"), then
 * sending in one tap with consistent stand-ins (‹EMAIL_1›) whose mapping stays on the device, so
 * `restoreStandIns()` can put the real values back into the reply. Sending the real data takes a second press.
 */
export function PromptDataGuard({
  value: valueProp, defaultValue = "", onValueChange, attachments = NO_ATTACHMENTS, onRemoveAttachment, destination = { name: "the AI provider" }, onSend,
  detectSecrets = defaultSecrets, detectNames, className, textareaClassName, messages, id: idProp, "aria-describedby": describedBy, onPaste, ...props
}: PromptDataGuardProps) {
  const m: Messages = { ...PROMPT_DATA_GUARD_MESSAGES, ...messages, kind: { ...PROMPT_DATA_GUARD_MESSAGES.kind, ...messages?.kind }, chip: { ...PROMPT_DATA_GUARD_MESSAGES.chip, ...messages?.chip } }
  const [inner, setInner] = React.useState(defaultValue)
  const value = valueProp ?? inner
  const [checked, setChecked] = React.useState(value)
  const [preview, setPreview] = React.useState(false)
  const [armed, setArmed] = React.useState(false)
  const [pending, setPending] = React.useState(false)
  const [note, setNote] = React.useState<{ text: string; error?: boolean } | null>(null)
  const reduce = useReducedMotion()
  const auto = React.useId()
  const id = idProp ?? auto
  const fieldRef = React.useRef<HTMLTextAreaElement>(null)
  const realRef = React.useRef<HTMLButtonElement>(null)
  const detector = detectSecrets || undefined

  React.useEffect(() => {
    if (value === checked) return
    const t = setTimeout(() => setChecked(value), 300)
    return () => clearTimeout(t)
  }, [value, checked])

  const result = React.useMemo(() => analyse(checked, attachments, detector, detectNames), [checked, attachments, detector, detectNames])
  const { counts, rows, markings, risky, standable } = result
  const parts: string[] = []
  if (rows) parts.push(fill(m.rows, { count: rows }))
  for (const [k, n] of counts) if (!rows || !["name", "email", "phone", "address"].includes(k)) parts.push(fill(m.kind[k], { count: n }))
  for (const mk of markings) parts.push(fill(m.marked, { marking: mk }))
  const sentence = risky
    ? fill(m.willGo, { list: list(parts, m.and), dest: destination.name }) + (destination.retention ? fill(m.kept, { retention: destination.retention }) : "") + (destination.training ? m.training : "") + "."
    : ""

  const filesSig = attachments.map((a) => `${a.id}:${a.text?.length ?? 0}`).join("|")
  React.useEffect(() => setArmed(false), [checked, filesSig])

  const set = (next: string) => {
    if (valueProp === undefined) setInner(next)
    onValueChange?.(next)
  }

  const send = async (useStandIns: boolean) => {
    if (pending) return
    // Typing may have moved on since the last check: send what's in the box now, and show anything new first.
    const live = value === checked ? result : analyse(value, attachments, detector, detectNames)
    if (value !== checked) setChecked(value)
    if (live.risky && !risky) return
    if (!useStandIns && live.risky && !armed) {
      setArmed(true)
      if (!reduce && realRef.current) animate(realRef.current, { x: [0, -5, 5, -3, 0] }, { duration: 0.3 })
      return
    }
    setPending(true)
    setNote(null)
    const payload: PromptSendPayload = useStandIns
      ? { ...live.payload, protected: true }
      : { text: clean(value), attachments, mapping: {}, protected: false }
    try {
      await onSend?.(payload)
      setNote({ text: useStandIns ? fill(m.sent, { count: Object.keys(payload.mapping).length }) : m.sentReal })
      if (valueProp === undefined) setInner("")
      setChecked(valueProp ?? "")
      setPreview(false)
      requestAnimationFrame(() => fieldRef.current?.focus())
    } catch {
      setNote({ text: m.failed, error: true })
    } finally {
      setPending(false)
      setArmed(false)
    }
  }

  const previewText = [result.payload.text, ...result.payload.attachments.filter((a) => a.text).map((a) => `── ${a.name} ──\n${a.text}`)].join("\n\n")

  return (
    <div data-slot="prompt-data-guard" data-state={risky ? "found" : "clear"} className={cn("grid w-full min-w-0 grid-cols-[minmax(0,1fr)] gap-2", className)}>
      <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-2 rounded-lg border bg-background p-2 shadow-xs focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50 dark:bg-input/30">
        {attachments.length > 0 && (
          <ul className="flex flex-wrap gap-1.5">
            <AnimatePresence initial={false}>
              {result.files.map(({ a, scan }) => {
                const flagged = scan.matches.length > 0 || scan.markings.length > 0
                return (
                  <motion.li key={a.id} layout={!reduce} exit={{ opacity: 0, scale: 0.95 }} className={cn("flex h-7 max-w-full min-w-0 items-center gap-1.5 rounded-md border pl-2 text-xs", flagged ? "border-amber-500/50 bg-amber-500/10" : "bg-muted/50")}>
                    <FileText aria-hidden className="size-3.5 shrink-0" />
                    <span className="min-w-0 truncate">{a.name}</span>
                    {scan.markings[0] && <span className="shrink-0 font-semibold text-amber-700 dark:text-amber-400">{scan.markings[0]}</span>}
                    {onRemoveAttachment && (
                      <button
                        type="button"
                        aria-label={fill(m.remove, { name: a.name })}
                        onClick={() => {
                          onRemoveAttachment(a.id)
                          requestAnimationFrame(() => fieldRef.current?.focus())
                        }}
                        className="grid size-7 shrink-0 place-items-center rounded-md outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50"
                      >
                        <X aria-hidden className="size-3.5" />
                      </button>
                    )}
                  </motion.li>
                )
              })}
            </AnimatePresence>
          </ul>
        )}
        <label htmlFor={id} className="sr-only">
          {m.label}
        </label>
        <textarea
          ref={fieldRef}
          id={id}
          value={value}
          rows={4}
          aria-describedby={[describedBy, risky ? `${id}-readback` : null].filter(Boolean).join(" ") || undefined}
          onChange={(e) => {
            set(e.target.value)
            setNote(null)
          }}
          onPaste={(e) => {
            onPaste?.(e)
            requestAnimationFrame(() => setChecked(fieldRef.current?.value ?? ""))
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault()
              send(standable)
            }
          }}
          className={cn("max-h-60 min-h-20 w-full min-w-0 resize-y bg-transparent px-1.5 py-1 text-base outline-none placeholder:text-muted-foreground md:text-sm", textareaClassName)}
          {...props}
        />
        {!risky && (
          <div className="flex justify-end">
            <button type="button" disabled={pending || !value.trim()} onClick={() => send(false)} className={cn(btn, "bg-primary text-primary-foreground hover:bg-primary/90")}>
              {pending ? <Loader2 aria-hidden className="size-4 animate-spin" /> : <ArrowUp aria-hidden className="size-4" />}
              {m.send}
            </button>
          </div>
        )}
      </div>

      <AnimatePresence initial={false}>
        {risky && (
          <motion.div
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="grid min-w-0 gap-2 rounded-lg border border-amber-500/40 bg-amber-500/5 p-2.5 dark:bg-amber-500/10"
          >
            <p id={`${id}-readback`} className="flex min-w-0 gap-2 text-sm">
              <ShieldAlert aria-hidden className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
              <span className="min-w-0 font-medium break-words">{sentence}</span>
            </p>
            {counts.length > 0 && (
              <ul className="flex flex-wrap gap-1 pl-6">
                {counts.map(([k, n]) => (
                  <li key={k} className="inline-flex h-6 items-center gap-1 rounded-full border bg-background px-2 text-xs dark:bg-input/30">
                    {m.chip[k]} <span className="font-semibold tabular-nums">{n}</span>
                  </li>
                ))}
              </ul>
            )}
            {standable && (
              <>
                <button type="button" aria-expanded={preview} aria-controls={`${id}-preview`} onClick={() => setPreview((p) => !p)} className={cn(btn, "h-7 w-fit px-2 text-xs text-muted-foreground hover:bg-accent hover:text-foreground sm:ml-4")}>
                  {preview ? <EyeOff aria-hidden className="size-3.5" /> : <Eye aria-hidden className="size-3.5" />}
                  {preview ? m.hidePreview : fill(m.preview, { dest: destination.name })}
                </button>
                {preview && (
                  <pre id={`${id}-preview`} tabIndex={0} className="max-h-48 overflow-auto rounded-md border bg-background p-2 font-mono text-xs whitespace-pre-wrap break-all outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30">
                    {previewText.split(/(‹[A-Z]+_\d+›)/).map((s, i) =>
                      i % 2 ? (
                        <span key={i} className="rounded-sm bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
                          {s}
                        </span>
                      ) : (
                        s
                      ),
                    )}
                  </pre>
                )}
              </>
            )}
            <div className="flex flex-wrap items-center gap-2">
              {standable && (
                <button type="button" disabled={pending} onClick={() => send(true)} aria-describedby={`${id}-hint`} className={cn(btn, "bg-primary text-primary-foreground hover:bg-primary/90")}>
                  {pending ? <Loader2 aria-hidden className="size-4 animate-spin" /> : <ShieldCheck aria-hidden className="size-4" />}
                  {pending ? m.sending : m.standIns}
                </button>
              )}
              <button
                ref={realRef}
                type="button"
                disabled={pending}
                aria-describedby={armed ? `${id}-confirm` : undefined}
                onClick={() => send(false)}
                className={cn(btn, armed ? "bg-destructive text-white hover:bg-destructive/90" : standable ? "border bg-background hover:bg-accent dark:bg-input/30" : "bg-primary text-primary-foreground hover:bg-primary/90")}
              >
                {armed ? m.sendRealAgain : standable ? m.sendReal : m.send}
              </button>
            </div>
            {standable && !armed && (
              <p id={`${id}-hint`} className="text-xs text-muted-foreground">
                {m.standInsHint}
              </p>
            )}
            {armed && (
              <p id={`${id}-confirm`} role="alert" className="text-xs text-red-700 dark:text-red-400">
                {fill(m.confirmReal, { dest: destination.name })}
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
      {note && (
        <p role={note.error ? "alert" : "status"} className={cn("text-xs", note.error ? "text-red-700 dark:text-red-400" : "text-muted-foreground")}>
          {note.text}
        </p>
      )}
    </div>
  )
}
