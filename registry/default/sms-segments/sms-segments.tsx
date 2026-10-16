"use client"

import * as React from "react"
import { TriangleAlert, WandSparkles } from "lucide-react"

import { cn } from "@/lib/utils"

const GSM_BASIC = "@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà"
const GSM_EXTENDED = "\f^{}\\[~]|€"

/** Look-alikes that force Unicode, with the plain GSM-7 character to send instead ("" removes it). */
export const SMS_REPLACEMENTS: Record<string, { name: string; to: string }> = {
  "’": { name: "curly apostrophe", to: "'" }, "‘": { name: "curly quote", to: "'" }, "‚": { name: "low quote", to: "'" },
  "“": { name: "curly quote", to: '"' }, "”": { name: "curly quote", to: '"' }, "„": { name: "low quote", to: '"' },
  "–": { name: "en dash", to: "-" }, "—": { name: "em dash", to: "-" }, "‐": { name: "hyphen", to: "-" }, "−": { name: "minus sign", to: "-" },
  "…": { name: "ellipsis", to: "..." }, "•": { name: "bullet", to: "-" }, "×": { name: "times sign", to: "x" }, "`": { name: "backtick", to: "'" },
  "\u00a0": { name: "non-breaking space", to: " " }, "\u202f": { name: "narrow space", to: " " }, "\u2009": { name: "thin space", to: " " },
  "\t": { name: "tab", to: " " }, "\u200b": { name: "zero-width space", to: "" }, "\ufeff": { name: "invisible BOM", to: "" },
}

export interface SmsSegment {
  /** UTF-16 offsets into the text, ready for `setSelectionRange`. */
  start: number
  end: number
  /** Septets (GSM-7) or code units (UCS-2) used. */
  used: number
}

const isGsm = (char: string) => GSM_BASIC.includes(char) || GSM_EXTENDED.includes(char)
const graphemes = (text: string): string[] =>
  typeof Intl !== "undefined" && "Segmenter" in Intl
    ? Array.from(new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(text), (s) => s.segment)
    : Array.from(text)

/**
 * Splits text into the SMS parts a carrier actually sends: 160/153 per part in GSM-7, 70/67 in UCS-2.
 * A 2-septet extended character (€, [, ~) or a surrogate pair is never split across parts.
 */
export function splitSms(text: string) {
  const ucs2 = Array.from(text).some((char) => !isGsm(char))
  const [single, multi] = ucs2 ? [70, 67] : [160, 153]
  const units = Array.from(text, (char) => ({ char, size: ucs2 ? char.length : GSM_EXTENDED.includes(char) ? 2 : 1 }))
  const total = units.reduce((sum, unit) => sum + unit.size, 0)
  const segments: SmsSegment[] = []
  if (total > 0 && total <= single) segments.push({ start: 0, end: text.length, used: total })
  else if (total > single) {
    let current: SmsSegment = { start: 0, end: 0, used: 0 }
    for (const { char, size } of units) {
      if (current.used + size > multi) {
        segments.push(current)
        current = { start: current.end, end: current.end, used: 0 }
      }
      current.used += size
      current.end += char.length
    }
    segments.push(current)
  }
  return { encoding: ucs2 ? ("UCS-2" as const) : ("GSM-7" as const), total, capacity: segments.length > 1 ? multi : single, segments }
}

/** Each distinct character that forces UCS-2, with how often it appears and the count once it alone is fixed. */
export function findSmsCulprits(text: string) {
  const seen = new Map<string, number>()
  for (const g of graphemes(text)) if (Array.from(g).some((char) => !isGsm(char))) seen.set(g, (seen.get(g) ?? 0) + 1)
  return [...seen].map(([char, count]) => {
    const fix = SMS_REPLACEMENTS[char]
    const fixedText = text.split(char).join(fix?.to ?? "")
    return { char, count, name: fix?.name ?? (/\p{Extended_Pictographic}/u.test(char) ? "emoji" : `U+${char.codePointAt(0)?.toString(16).toUpperCase().padStart(4, "0")}`), replacement: fix?.to, fixedText }
  })
}

/** The text with every known look-alike swapped for plain characters and every other Unicode character removed. */
export function toGsm7(text: string) {
  return graphemes(text).map((g) => (Array.from(g).every(isGsm) ? g : (SMS_REPLACEMENTS[g]?.to ?? ""))).join("")
}

const fill = (template: string, values: Record<string, string | number>) =>
  template.replace(/\{(\w+)\}/g, (match, key: string) => String(values[key] ?? match))

export interface SmsSegmentsProps extends Omit<React.ComponentProps<"textarea">, "value" | "defaultValue" | "onChange"> {
  /** Visible label. */
  label?: string
  /** Controlled text. */
  value?: string
  /** Initial text when uncontrolled. */
  defaultValue?: string
  /** Called on every edit, including one-tap fixes. */
  onValueChange?: (value: string) => void
  /** How many people receive it; every part is billed per recipient. */
  recipients?: number
  /** Price of one part to one recipient. Omit to hide money and show message counts only. */
  pricePerSegment?: number
  /** ISO currency code for the price. */
  currency?: string
  /** Locale for numbers and money; defaults to the browser's. */
  locale?: string
  /** Shown when one character is the cause. `{name}` ("curly apostrophe"), `{char}`, `{count}`, `{plain}` are filled in. */
  oneCulpritMessage?: string
  /** Shown when several characters are the cause. */
  manyCulpritsMessage?: string
  /** Shown when Unicode costs nothing extra yet. */
  freeUnicodeMessage?: string
  /** Label of the button that fixes every culprit at once. */
  fixAllLabel?: string
  /** Accessible names of the one-tap fixes; `{name}` and `{to}` are filled in. */
  replaceLabel?: string
  removeLabel?: string
  /** Shown in a fix chip when the character is simply dropped. */
  removeText?: string
  /** Message counts: `{n}` is filled in. */
  messageText?: string
  messagesText?: string
  /** Accessible name of the part meter, and its captions. `{capacity}` and `{left}` are filled in. */
  partsLabel?: string
  perPartText?: string
  onePartText?: string
  leftText?: string
  /** Cost readback: `{messages}`, `{recipients}`, `{sms}` and `{price}` are filled in. */
  costText?: string
  pricedCostText?: string
  /** Saving after the fix: `{sms}` and `{saving}` are filled in. */
  fixedText?: string
  pricedFixedText?: string
  /** Recipient counts: `{n}` is filled in. */
  recipientText?: string
  recipientsText?: string
}

const fieldClass =
  "min-h-24 w-full min-w-0 resize-y rounded-md border bg-transparent px-3 py-2 text-base shadow-xs transition-[color,box-shadow] outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm dark:bg-input/30 data-warning:border-amber-500 dark:data-warning:border-amber-400"
const fixClass =
  "inline-flex h-6 items-center gap-1 rounded-md border border-amber-500/40 px-2 font-medium text-amber-900 transition-colors hover:bg-amber-500/10 dark:text-amber-200 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
const show = (char: string) => (char === "\u00a0" || char === "\u202f" || char === "\u2009" ? "␣" : char === "\t" ? "⇥" : char === "\u200b" || char === "\ufeff" ? "¦" : char)

/**
 * An SMS composer that shows what a bulk send will really cost. It splits the text into the parts
 * carriers bill, names the one curly quote or emoji that flipped it to UCS-2 ("this ’ makes it
 * 3 messages instead of 2"), fixes it in one tap, and reads the total back per recipient count.
 */
export function SmsSegments({
  label = "Message",
  value,
  defaultValue = "",
  onValueChange,
  recipients = 1,
  pricePerSegment,
  currency = "USD",
  locale,
  oneCulpritMessage = "The {name} ({char}) makes it {count} instead of {plain}.",
  manyCulpritsMessage = "These characters make it {count} instead of {plain}.",
  freeUnicodeMessage = "Sent as Unicode because of the {name} ({char}). Still {count}, but only 70 characters fit in each.",
  fixAllLabel = "Fix all",
  replaceLabel = "Replace {name} with {to}",
  removeLabel = "Remove {name}",
  removeText = "remove",
  messageText = "{n} message",
  messagesText = "{n} messages",
  partsLabel = "Message parts",
  perPartText = "{capacity} per part · tap a part to see it",
  onePartText = "{capacity} fit in one message",
  leftText = "{left} left",
  costText = "{messages} × {recipients} = {sms} SMS",
  pricedCostText = "{messages} × {recipients} = {sms} SMS · {price}",
  fixedText = "Fixed: {sms} SMS",
  pricedFixedText = "Fixed: {sms} SMS, saves {saving}",
  recipientText = "{n} recipient",
  recipientsText = "{n} recipients",
  rows = 4,
  id,
  className,
  ref,
  ...props
}: SmsSegmentsProps) {
  const [inner, setInner] = React.useState(defaultValue)
  const textareaRef = React.useRef<HTMLTextAreaElement>(null)
  const countRef = React.useRef<HTMLSpanElement>(null)
  const autoId = React.useId()
  const inputId = id ?? autoId
  const text = value ?? inner
  React.useImperativeHandle(ref, () => textareaRef.current as HTMLTextAreaElement)

  const sms = splitSms(text)
  const parts = sms.segments.length
  const culprits = findSmsCulprits(text)
  const plainParts = culprits.length ? splitSms(toGsm7(text)).segments.length : parts
  const last = sms.segments[parts - 1]
  const num = (n: number) => n.toLocaleString(locale)
  const msgs = (n: number) => fill(n === 1 ? messageText : messagesText, { n: num(n) })
  const money = (n: number) => new Intl.NumberFormat(locale, { style: "currency", currency }).format(n)
  const values = { name: culprits[0]?.name ?? "", char: show(culprits[0]?.char ?? ""), count: msgs(parts), plain: msgs(plainParts) }
  const cost = {
    messages: msgs(parts),
    recipients: fill(recipients === 1 ? recipientText : recipientsText, { n: num(recipients) }),
    sms: num(parts * recipients),
    price: pricePerSegment !== undefined ? money(parts * recipients * pricePerSegment) : "",
  }

  // Flash the count when it changes, so a jump from 2 to 3 is noticed.
  const previous = React.useRef(parts)
  React.useEffect(() => {
    if (previous.current === parts) return
    previous.current = parts
    if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches)
      countRef.current?.animate([{ transform: "scale(1.25)", backgroundColor: "rgb(245 158 11 / 0.35)" }, { transform: "scale(1)" }], { duration: 300, easing: "ease-out" })
  }, [parts])

  const update = (next: string) => {
    if (value === undefined) setInner(next)
    onValueChange?.(next)
  }
  const apply = (next: string) => {
    update(next)
    textareaRef.current?.focus()
  }
  const select = (segment: SmsSegment) => {
    textareaRef.current?.focus()
    textareaRef.current?.setSelectionRange(segment.start, segment.end)
  }

  return (
    <div data-slot="sms-segments" className={cn("grid w-full max-w-sm gap-1.5", className)}>
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={inputId} className="text-sm font-medium">{label}</label>
        <span className="text-xs text-muted-foreground">
          <span className={cn(sms.encoding === "UCS-2" && "text-amber-700 dark:text-amber-400")}>{sms.encoding}</span> ·{" "}
          <span ref={countRef} className="inline-block rounded-sm px-0.5 font-medium text-foreground tabular-nums">{msgs(parts)}</span>
        </span>
      </div>
      <textarea
        ref={textareaRef}
        id={inputId}
        rows={rows}
        value={text}
        aria-describedby={`${inputId}-meter ${inputId}-warning`}
        data-warning={plainParts < parts ? "" : undefined}
        onChange={(event) => update(event.target.value)}
        className={fieldClass}
        {...props}
      />
      <div id={`${inputId}-meter`} className="grid gap-1">
        <div className="flex gap-1" role="group" aria-label={partsLabel}>
          {(parts ? sms.segments : [{ start: 0, end: 0, used: 0 }]).map((segment, index) => (
            <button
              key={index}
              type="button"
              disabled={!parts}
              onClick={() => select(segment)}
              aria-label={`Select part ${index + 1}: ${segment.used} of ${sms.capacity}`}
              className="group h-4 min-w-3 flex-1 rounded-full py-1 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
            >
              <span className="block h-full overflow-hidden rounded-full bg-muted">
                <span
                  className={cn("block h-full rounded-full transition-[width] duration-300 ease-out motion-reduce:transition-none group-hover:opacity-80", sms.encoding === "UCS-2" && plainParts < parts ? "bg-amber-500" : "bg-emerald-500")}
                  style={{ width: `${(segment.used / sms.capacity) * 100}%` }}
                />
              </span>
            </button>
          ))}
        </div>
        <p className="flex justify-between gap-2 text-xs text-muted-foreground tabular-nums">
          <span>{fill(parts > 1 ? perPartText : onePartText, { capacity: num(sms.capacity) })}</span>
          <span className="shrink-0">{fill(leftText, { left: num(sms.capacity - (last?.used ?? 0)) })}</span>
        </p>
      </div>
      <div id={`${inputId}-warning`} aria-live="polite" className="text-xs">
        {culprits.length > 0 && (
          <div className={cn("flex gap-1.5", plainParts < parts ? "text-amber-700 dark:text-amber-400" : "text-muted-foreground")}>
            <span className="flex h-6 shrink-0 items-center"><TriangleAlert aria-hidden className="size-3.5" /></span>
            <div className="grid min-w-0 gap-1.5">
              <span className="py-1">{fill(plainParts < parts ? (culprits.length === 1 ? oneCulpritMessage : manyCulpritsMessage) : freeUnicodeMessage, values)}</span>
              <div className="flex flex-wrap gap-1.5">
                {culprits.map((culprit) => (
                  <button
                    key={culprit.char}
                    type="button"
                    onClick={() => apply(culprit.fixedText)}
                    aria-label={culprit.replacement ? fill(replaceLabel, { name: culprit.name, to: culprit.replacement }) : fill(removeLabel, { name: culprit.name })}
                    title={culprit.name}
                    className={cn(fixClass, "font-normal")}
                  >
                    <span className="font-mono text-sm font-semibold">{show(culprit.char)}</span>
                    {culprit.count > 1 && <span className="tabular-nums">×{culprit.count}</span>}
                    <span aria-hidden>→</span>
                    {culprit.replacement ? <span className="font-mono text-sm font-semibold">{culprit.replacement}</span> : <span>{removeText}</span>}
                  </button>
                ))}
                {culprits.length > 1 && (
                  <button type="button" onClick={() => apply(toGsm7(text))} className={fixClass}>
                    <WandSparkles aria-hidden className="size-3.5" />
                    {fixAllLabel}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
      {parts > 0 && (
        <p className="rounded-md bg-muted/60 px-3 py-2 text-xs tabular-nums">
          <span className="font-medium">{fill(pricePerSegment === undefined ? costText : pricedCostText, cost)}</span>
          {plainParts < parts && (
            <span className="block text-amber-700 dark:text-amber-400">
              {fill(pricePerSegment === undefined ? fixedText : pricedFixedText, {
                sms: num(plainParts * recipients),
                saving: pricePerSegment === undefined ? "" : money((parts - plainParts) * recipients * pricePerSegment),
              })}
            </span>
          )}
        </p>
      )}
    </div>
  )
}
