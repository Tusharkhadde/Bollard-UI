"use client"

import * as React from "react"
import { EyeOff, Globe, Loader2, ShieldAlert } from "lucide-react"

import { cn } from "@/lib/utils"
import { detectPii, maskMatches, maskPii, PII_KINDS, type PiiKind, type PiiMatch } from "./pii"

export { detectPii, luhn, maskMatches, maskPii, PII_KINDS, verhoeff, type PiiKind, type PiiMatch } from "./pii"

/** Who will see the post. */
export interface PostAudience {
  /** Short name shown as the audience, e.g. "Public" or "Followers". */
  label: string
  /** Who that is, read in a sentence: "anyone on the internet", "your 1,204 followers". */
  who: string
  /** One extra line of consequence, e.g. about search engines. */
  note?: string
}

/** Every visible string. `{label}`, `{who}`, `{list}` and `{kind}` are filled in. */
export const PII_POST_MESSAGES = {
  /** Label used when the `label` prop is not set. */
  label: "Write a post",
  audienceLine: "{label} · visible to {who}",
  summary: "Your {list} will be visible to {who}.",
  kinds: { otp: "OTP", card: "card number", aadhaar: "Aadhaar number", pan: "PAN", email: "email address", address: "address", phone: "phone number" } as Record<PiiKind, string>,
  why: {
    otp: "No genuine company asks for an OTP in a comment. Anyone who reads it can use it.",
    card: "A card number is half of what fraud needs. Post the last 4 at most.",
    aadhaar: "UIDAI's own rule: show only the last 4 digits.",
    pan: "PAN plus a name is enough to attempt loans in your name.",
    email: "Public addresses get scraped for spam and phishing.",
    address: "Tells strangers where you live or will be.",
    phone: "Public numbers get scraped for spam and fake KYC calls.",
  } as Record<PiiKind, string>,
  addressMask: "[address removed]",
  mask: "Mask",
  maskAll: "Mask all",
  keep: "Keep",
  masked: "Masked {kind}.",
  maskedAll: "Masked everything. Check the post still reads right.",
  post: "Post",
  postAnyway: "Post anyway",
}

export type PiiPostMessages = typeof PII_POST_MESSAGES

const fill = (template: string, values: Record<string, string | number>) =>
  template.replace(/\{(\w+)\}/g, (match, key: string) => String(values[key] ?? match))

const SEVERE: PiiKind[] = ["otp", "card", "aadhaar"]
const keyOf = (m: Pick<PiiMatch, "kind" | "value">) => `${m.kind}:${m.value}`

export interface PiiPostGuardProps extends Omit<React.ComponentProps<"textarea">, "value" | "defaultValue" | "onChange"> {
  /** Visible label. */
  label?: string
  /** Controlled text. */
  value?: string
  /** Initial text when uncontrolled. */
  defaultValue?: string
  /** Called with the text on every change, including masking. */
  onValueChange?: (text: string) => void
  /** Who will see the post. Defaults to the public internet. */
  audience?: PostAudience
  /** Which details to look for. Defaults to all of them. */
  kinds?: PiiKind[]
  /** Your own masking, e.g. to match a house style. Defaults to `maskPii`. */
  mask?: (match: PiiMatch) => string
  /** Pause in ms before findings refresh while typing, so nothing is announced per keystroke. */
  delay?: number
  /** Locale for joining the list of kinds ("phone number and PAN"). */
  locale?: string
  /** Called on Post. With details left, the first click jumps to them and the second posts. May return a Promise. */
  onPost?: (text: string) => void | Promise<void>
  /** Any visible string; `kinds` and `why` may be partial. */
  messages?: Partial<Omit<PiiPostMessages, "kinds" | "why">> & { kinds?: Partial<PiiPostMessages["kinds"]>; why?: Partial<PiiPostMessages["why"]> }
  /** Class for the outer wrapper. */
  className?: string
}

/**
 * Stops people posting their phone number, email, address, Aadhaar, PAN, card number or an OTP
 * to a public feed, comment or review. It says who will see the post, finds each detail with real
 * checks (Verhoeff, Luhn, PAN holder type) instead of loose digit runs, and masks one or all of
 * them in one tap using each format's own convention.
 */
export function PiiPostGuard({
  label,
  value,
  defaultValue = "",
  onValueChange,
  audience,
  kinds = PII_KINDS,
  mask,
  delay = 600,
  locale,
  onPost,
  messages,
  className,
  id,
  rows = 4,
  onBlur,
  onPaste,
  ref,
  "aria-describedby": describedBy,
  ...props
}: PiiPostGuardProps) {
  const t = { ...PII_POST_MESSAGES, ...messages, kinds: { ...PII_POST_MESSAGES.kinds, ...messages?.kinds }, why: { ...PII_POST_MESSAGES.why, ...messages?.why } }
  const who: PostAudience = audience ?? { label: "Public", who: "anyone on the internet", note: "Search engines can index it, and screenshots outlive a delete." }
  const [inner, setInner] = React.useState(defaultValue)
  const text = typeof (value ?? inner) === "string" ? (value ?? inner) : ""
  const [settled, setSettled] = React.useState(text)
  const [kept, setKept] = React.useState<Set<string>>(() => new Set())
  const [announcement, setAnnouncement] = React.useState("")
  const [asked, setAsked] = React.useState(false)
  const [pending, setPending] = React.useState(false)
  const fieldRef = React.useRef<HTMLTextAreaElement>(null)
  const panelRef = React.useRef<HTMLDivElement>(null)
  const autoId = React.useId()
  const fieldId = id ?? autoId
  const audienceId = `${fieldId}-audience`
  const findingsId = `${fieldId}-findings`

  React.useImperativeHandle(ref, () => fieldRef.current as HTMLTextAreaElement)

  React.useEffect(() => {
    const timer = setTimeout(() => setSettled(text), delay)
    return () => clearTimeout(timer)
  }, [text, delay])

  // Findings come from the settled text, so the panel doesn't flicker mid-word; any the user has
  // since edited away drop out at once.
  const findings = React.useMemo(() => {
    const seen = new Set<string>()
    return detectPii(settled, kinds).filter((m) => {
      const key = keyOf(m)
      if (kept.has(key) || seen.has(key) || !text.includes(m.value)) return false
      seen.add(key)
      return true
    })
  }, [settled, kinds, kept, text])
  const severe = findings.some((m) => SEVERE.includes(m.kind))
  const kindList = [...new Set(findings.map((m) => t.kinds[m.kind]))]
  const list = typeof Intl.ListFormat === "function" ? new Intl.ListFormat(locale, { type: "conjunction" }).format(kindList) : kindList.join(", ")
  const summary = findings.length ? fill(t.summary, { list, who: who.who }) : ""

  // A mask announces what it did; the summary it changes is not read over it.
  const actedAt = React.useRef(0)
  React.useEffect(() => {
    if (Date.now() - actedAt.current > 500) setAnnouncement(summary)
  }, [summary])

  const commit = (next: string) => {
    if (value === undefined) setInner(next)
    setSettled(next)
    onValueChange?.(next)
    setAsked(false)
  }
  const masked = (m: PiiMatch) => (mask ? mask(m) : maskPii(m, t.addressMask))

  const maskOne = (m: PiiMatch, index: number) => {
    actedAt.current = Date.now()
    // Mask by position in the current text: every copy of this detail, nothing that merely contains its digits.
    commit(maskMatches(text, detectPii(text, kinds).filter((d) => keyOf(d) === keyOf(m)), masked))
    setAnnouncement(fill(t.masked, { kind: t.kinds[m.kind] }))
    requestAnimationFrame(() => {
      const buttons = panelRef.current?.querySelectorAll<HTMLElement>("[data-mask]")
      ;(buttons?.[Math.min(index, buttons.length - 1)] ?? fieldRef.current)?.focus()
    })
  }

  const maskAll = () => {
    const open = new Set(findings.map(keyOf))
    const next = maskMatches(text, detectPii(text, kinds).filter((d) => open.has(keyOf(d))), masked)
    actedAt.current = Date.now()
    commit(next)
    setAnnouncement(t.maskedAll)
    fieldRef.current?.focus()
  }

  const post = async () => {
    if (findings.length && !asked) {
      setAsked(true)
      panelRef.current?.querySelector<HTMLElement>("[data-mask-all]")?.focus()
      return
    }
    if (!onPost || pending) return
    setPending(true)
    try {
      await onPost(text)
    } catch {
      // The caller reports posting failures; the button becomes usable again.
    } finally {
      setPending(false)
    }
  }

  const tone = severe
    ? { box: "border-red-500/30 bg-red-500/5", text: "text-red-800 dark:text-red-300", solid: "bg-red-700 text-white hover:bg-red-800 dark:bg-red-400 dark:text-red-950" }
    : { box: "border-amber-500/30 bg-amber-500/5", text: "text-amber-800 dark:text-amber-300", solid: "bg-amber-700 text-white hover:bg-amber-800 dark:bg-amber-400 dark:text-amber-950" }
  const small = "inline-flex h-6 shrink-0 items-center rounded-md px-2 text-xs font-medium outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50"

  return (
    <div data-slot="pii-post-guard" data-state={findings.length ? (severe ? "danger" : "warning") : "ok"} className={cn("grid w-full max-w-md gap-1.5 text-sm", className)}>
      <label htmlFor={fieldId} className="font-medium">{label ?? t.label}</label>
      <textarea
        ref={fieldRef}
        id={fieldId}
        rows={rows}
        value={text}
        onChange={(event) => {
          if (value === undefined) setInner(event.target.value)
          onValueChange?.(event.target.value)
          setAsked(false)
        }}
        onPaste={(event) => {
          onPaste?.(event)
          requestAnimationFrame(() => setSettled(fieldRef.current?.value ?? ""))
        }}
        onBlur={(event) => {
          onBlur?.(event)
          setSettled(event.target.value)
        }}
        aria-describedby={[describedBy, audienceId, findings.length ? findingsId : ""].filter(Boolean).join(" ")}
        data-warning={findings.length ? "" : undefined}
        className="min-h-20 w-full min-w-0 resize-y rounded-md border bg-transparent px-3 py-2 text-base shadow-xs outline-none transition-[color,box-shadow] placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 data-warning:border-amber-500 md:text-sm dark:bg-input/30 dark:data-warning:border-amber-400"
        {...props}
      />
      <p id={audienceId} className="flex gap-1.5 text-xs text-muted-foreground">
        <Globe aria-hidden className="mt-0.5 size-3.5 shrink-0" />
        <span className="min-w-0">
          {fill(t.audienceLine, { label: who.label, who: who.who })}
          {who.note && <>. {who.note}</>}
        </span>
      </p>
      <span aria-live="polite" className="sr-only">{announcement}</span>
      {findings.length > 0 && (
        <div ref={panelRef} className={cn("mt-1.5 space-y-2 rounded-md border p-3", tone.box)}>
          <div className={cn("flex flex-wrap items-start gap-x-3 gap-y-2", tone.text)}>
            <p className="flex min-w-0 flex-1 basis-48 gap-1.5 font-medium">
              <ShieldAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
              <span id={findingsId} className="min-w-0">{summary}</span>
            </p>
            <button type="button" data-mask-all onClick={maskAll} aria-describedby={findingsId} className={cn(small, "h-8 gap-1.5 px-3 text-sm", tone.solid)}>
              <EyeOff aria-hidden className="size-4" />
              {t.maskAll}
            </button>
          </div>
          <ul className="space-y-2">
            {findings.map((m, index) => (
              <li key={keyOf(m)} className="grid gap-1 border-t border-current/10 pt-2 text-xs">
                <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="inline-block font-medium first-letter:uppercase">{t.kinds[m.kind]}</span>
                  <span className="flex min-w-0 flex-wrap gap-x-1.5 font-mono">
                    <span className="break-all line-through decoration-current/50 sm:whitespace-nowrap">{m.value}</span>
                    <span aria-hidden>→</span>
                    <span className="sr-only">, becomes </span>
                    <span className="break-all sm:whitespace-nowrap">{masked(m)}</span>
                  </span>
                  <span className="ml-auto flex gap-1">
                    <button type="button" data-mask onClick={() => maskOne(m, index)} className={cn(small, "border border-current/25 hover:bg-current/10")} aria-label={`${t.mask} ${t.kinds[m.kind]}`}>
                      {t.mask}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setKept((k) => new Set(k).add(keyOf(m)))
                        requestAnimationFrame(() => (panelRef.current?.querySelectorAll<HTMLElement>("[data-mask]")[index] ?? fieldRef.current)?.focus())
                      }}
                      className={cn(small, "text-muted-foreground hover:bg-accent hover:text-foreground")}
                      aria-label={`${t.keep} ${t.kinds[m.kind]}`}
                    >
                      {t.keep}
                    </button>
                  </span>
                </div>
                <p className="text-muted-foreground">{t.why[m.kind]}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
      {onPost && (
        <div className="mt-1.5 flex justify-end">
          <button
            type="button"
            onClick={post}
            disabled={pending || !text.trim()}
            className={cn(
              "inline-flex h-9 items-center gap-2 rounded-md px-4 text-sm font-medium outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-60",
              asked && findings.length ? tone.solid : "bg-primary text-primary-foreground hover:bg-primary/90",
            )}
          >
            {pending && <Loader2 aria-hidden className="size-4 animate-spin" />}
            {asked && findings.length ? t.postAnyway : t.post}
          </button>
        </div>
      )}
    </div>
  )
}
