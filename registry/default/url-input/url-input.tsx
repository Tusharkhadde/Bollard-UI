"use client"

// Bollard UI — url-input · MIT licence · https://bollard-ui.vercel.app/components/url-input

import * as React from "react"
import { Lock, LockOpen, Scissors, ShieldAlert, TriangleAlert } from "lucide-react"

import { cn } from "@/lib/utils"

/** Query parameters that only exist to track who clicked. `*` matches a prefix. */
export const DEFAULT_TRACKING_PARAMS = [
  "utm_*", "fbclid", "gclid", "dclid", "msclkid", "si", "igshid", "mc_eid", "yclid", "ttclid", "twclid",
]

/** Non-Latin letters that render almost exactly like a Latin one. */
const LOOKALIKES: Record<string, string> = {
  "\u0430": "a", "\u0435": "e", "\u043e": "o", "\u0440": "p", "\u0441": "c", "\u0443": "y",
  "\u0445": "x", "\u0456": "i", "\u0458": "j", "\u0501": "d", "\u0455": "s", "\u04bb": "h",
  "\u04cf": "l", "\u03bf": "o", "\u03b1": "a", "\u03bd": "v", "\u03b9": "i", "\u0261": "g",
}

const SCRIPTS: [RegExp, string][] = [
  [/\p{Script=Cyrillic}/u, "Cyrillic"],
  [/\p{Script=Greek}/u, "Greek"],
  [/\p{Script=Armenian}/u, "Armenian"],
  [/\p{Script=Latin}/u, "accented Latin"],
]

/** RFC 3492 decoder for one `xn--` label, so the field can show what a hostname really spells. */
export function decodePunycode(label: string): string | null {
  const digits = "abcdefghijklmnopqrstuvwxyz0123456789"
  const input = label.slice(4).toLowerCase()
  const adapt = (delta: number, points: number, first: boolean) => {
    delta = first ? Math.floor(delta / 700) : delta >> 1
    delta += Math.floor(delta / points)
    let k = 0
    for (; delta > 455; k += 36) delta = Math.floor(delta / 35)
    return k + Math.floor((36 * delta) / (delta + 38))
  }
  const dash = input.lastIndexOf("-")
  const output = dash >= 0 ? [...input.slice(0, dash)] : []
  let pos = dash >= 0 ? dash + 1 : 0
  let n = 128, i = 0, bias = 72
  while (pos < input.length) {
    const oldI = i
    for (let w = 1, k = 36; ; k += 36) {
      const digit = digits.indexOf(input[pos++] ?? "")
      if (digit < 0) return null
      i += digit * w
      const t = k <= bias ? 1 : k >= bias + 26 ? 26 : k - bias
      if (digit < t) break
      w *= 36 - t
    }
    bias = adapt(i - oldI, output.length + 1, oldI === 0)
    n += Math.floor(i / (output.length + 1))
    i %= output.length + 1
    output.splice(i++, 0, String.fromCodePoint(n))
  }
  return output.join("")
}

const isTracker = (key: string, params: string[]) =>
  params.some((p) => (p.endsWith("*") ? key.toLowerCase().startsWith(p.slice(0, -1)) : key.toLowerCase() === p))

export interface UrlAnalysis {
  url?: URL
  error?: string
  /** The text had no scheme, so https:// was assumed. */
  addedScheme: boolean
  trackers: string[]
  /** Hostname with punycode decoded, when it contains international letters. */
  unicodeHost?: string
  /** The plain ASCII hostname it imitates, when every odd letter has a Latin twin. */
  imitates?: string
  /** Human descriptions of the non-ASCII letters, e.g. Cyrillic “а” (looks like Latin “a”). */
  oddLetters: string[]
  /** Text before an "@" in the address (https://paypal.com@evil.example), which browsers treat as a login, not the site. */
  credentials?: string
  /** The address with a mistyped ending fixed (example.con → example.com), when the ending isn't a real one. */
  tldFix?: string
  /** Why the text isn't usable, for your own copy. */
  errorKind?: "scheme" | "invalid" | "no-domain"
}

/** Endings that are typos of .com, .net and .org, none of which is a real top-level domain. */
const TLD_TYPOS: Record<string, string> = {
  con: "com", cmo: "com", ocm: "com", vom: "com", xom: "com", comm: "com", coom: "com", cpm: "com", c0m: "com",
  nte: "net", nett: "net", ner: "net", ogr: "org", rog: "org", orgg: "org", prg: "org",
}

/**
 * Cleans what tends to ride along when a link is copied out of a sentence: the words
 * around it, wrapping <…>, (…) or quotes, a trailing full stop or unmatched ")", and a
 * doubled "https://https://".
 */
export function cleanPastedUrl(text: string) {
  const unwrap = (t: string) => {
    for (;;) {
      const next = t
        .replace(/^<(.*)>$/s, "$1")
        .replace(/^["'“‘](.*)["'”’]$/s, "$1")
        .replace(/^\((.*)\)$/s, "$1")
        .replace(/^[("'“‘<]+(?=https?:|www\.)/i, "")
      const last = next.at(-1)
      const opens = next.match(/\(/g)?.length ?? 0
      const closes = next.match(/\)/g)?.length ?? 0
      const trimmed = last && (".,;:!?'\"”’>".includes(last) || (last === ")" && closes > opens)) ? next.slice(0, -1) : next
      if (trimmed === t) return t
      t = trimmed
    }
  }
  let t = unwrap(text.trim())
  if (/\s/.test(t)) {
    const links = t.split(/\s+/).filter((word) => /^[("'“‘<]*(https?:\/\/|www\.)/i.test(word))
    t = links.length === 1 ? unwrap(links[0]) : t.replace(/\s+/g, "")
  }
  return t.replace(/^(https?:\/\/)+(https?:\/\/)/i, "$2")
}

/** Every visible string. Templates: `{host}`, `{imitates}`, `{letters}`, `{login}`, `{tld}`, `{fixed}`, `{removed}`. */
export const URL_INPUT_MESSAGES = {
  scheme: "Only web addresses (http or https) work here.",
  invalid: "That isn't a valid web address.",
  noDomain: "Add the full domain, like example.com.",
  opens: "Opens",
  schemeAdded: "https:// added",
  insecure: "Not secure: http:// sends data unencrypted.",
  tracking: "Tracking:",
  lookalike: "This is not {imitates}. It is spelled with {letters}.",
  international: "Uses international letters: shows as {host}. Make sure that's the site you expect.",
  credentials: "Everything before the “@” (“{login}”) is a sign-in name, not the site. This opens {host}.",
  removeLogin: "Remove “{login}@”",
  tldTypo: "“.{tld}” isn't a real ending. Did you mean {fixed}?",
  useFixed: "Use {fixed}",
  cleaned: "Removed {removed} picked up with the paste.",
  extra: "extra text",
  and: " and ",
}

const fill = (template: string, values: Record<string, string>) => template.replace(/\{(\w+)\}/g, (m, key: string) => values[key] ?? m)

/** Parses typed or pasted text into a web address and lists everything suspicious about it. */
export function analyzeUrl(raw: string, trackingParams = DEFAULT_TRACKING_PARAMS): UrlAnalysis {
  const empty: UrlAnalysis = { addedScheme: false, trackers: [], oddLetters: [] }
  const text = raw.trim()
  if (!text) return empty
  if (/^[a-z][\w+.-]*:/i.test(text) && !/^https?:\/\//i.test(text) && !/^[^:/]+:\d/.test(text))
    return { ...empty, error: URL_INPUT_MESSAGES.scheme, errorKind: "scheme" }
  const addedScheme = !/^https?:\/\//i.test(text)
  let url: URL
  try {
    url = new URL(addedScheme ? `https://${text.replace(/^\/\//, "")}` : text)
  } catch {
    return { ...empty, error: URL_INPUT_MESSAGES.invalid, errorKind: "invalid" }
  }
  if (!url.hostname.includes(".") && url.hostname !== "localhost")
    return { ...empty, error: URL_INPUT_MESSAGES.noDomain, errorKind: "no-domain" }
  const trackers = [...new Set([...url.searchParams.keys()].filter((k) => isTracker(k, trackingParams)))]
  const result: UrlAnalysis = { url, addedScheme, trackers, oddLetters: [] }
  if (url.username || url.password) result.credentials = decodeURIComponent(url.username + (url.password ? `:${url.password}` : ""))
  const tld = url.hostname.split(".").pop() ?? ""
  if (TLD_TYPOS[tld]) {
    const fixed = new URL(url.href)
    fixed.hostname = url.hostname.slice(0, -tld.length) + TLD_TYPOS[tld]
    result.tldFix = fixed.href
  }
  if (!url.hostname.split(".").some((label) => label.startsWith("xn--"))) return result
  const unicodeHost = url.hostname
    .split(".")
    .map((label) => (label.startsWith("xn--") ? decodePunycode(label) ?? label : label))
    .join(".")
  const skeleton = [...unicodeHost].map((char) => LOOKALIKES[char] ?? char).join("")
  result.unicodeHost = unicodeHost
  result.imitates = /^[\x00-\x7f]+$/.test(skeleton) ? skeleton : undefined
  result.oddLetters = [...new Set([...unicodeHost].filter((char) => char > "\u007f"))].map((char) => {
    const script = SCRIPTS.find(([pattern]) => pattern.test(char))?.[1] ?? "non-Latin"
    return LOOKALIKES[char] ? `${script} “${char}” (looks like Latin “${LOOKALIKES[char]}”)` : `${script} “${char}”`
  })
  return result
}

/** Removes the tracking parameters `analyzeUrl` found and returns the clean href. */
export function stripTracking(href: string, trackers: string[]) {
  const clean = new URL(href)
  trackers.forEach((key) => clean.searchParams.delete(key))
  return clean.href
}

export interface UrlInputProps
  extends Omit<React.ComponentProps<"input">, "value" | "defaultValue" | "onChange" | "type"> {
  /** Visible label. */
  label?: string
  /** Helper text shown under the field while there is nothing to warn about. */
  hint?: string
  /** Controlled text. */
  value?: string
  /** Initial text when uncontrolled. */
  defaultValue?: string
  /** Called with the raw text on every change, including one-tap fixes. */
  onValueChange?: (value: string) => void
  /** Called with the normalized absolute URL, or `null` while the text isn't a usable address. */
  onUrlChange?: (url: string | null) => void
  /** Parameter names treated as tracking; `utm_*` style prefixes are supported. */
  trackingParams?: string[]
  /** Label of the fix that strips tracking parameters. */
  removeTrackingLabel?: string
  /** Label of the fix that upgrades http:// to https://. */
  useHttpsLabel?: string
  /** Override any other visible string. */
  messages?: Partial<typeof URL_INPUT_MESSAGES>
}

const fieldClass =
  "h-9 w-full min-w-0 rounded-md border bg-transparent px-3 text-base shadow-xs transition-[color,box-shadow] outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm dark:bg-input/30 data-warning:border-amber-500 dark:data-warning:border-amber-400 data-danger:border-red-500 dark:data-danger:border-red-400"
const fixClass =
  "inline-flex h-6 items-center gap-1 rounded-md border border-amber-500/40 px-2 font-medium text-amber-900 transition-colors hover:bg-amber-500/10 dark:text-amber-200 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"

function Line({ icon: Icon, tone, children }: { icon: React.ElementType; tone: "muted" | "warn" | "danger"; children: React.ReactNode }) {
  const color = { muted: "text-muted-foreground", warn: "text-amber-700 dark:text-amber-400", danger: "text-red-700 dark:text-red-400" }[tone]
  return (
    <p className={cn("flex gap-1.5", color)}>
      <span className="flex h-6 shrink-0 items-center"><Icon aria-hidden className="size-3.5" /></span>
      <span className="flex min-w-0 flex-wrap items-center gap-x-2 [&>span]:py-1">{children}</span>
    </p>
  )
}

/**
 * A web address field that catches the mistakes people make when pasting links: a missing
 * https://, an insecure http:// link, tracking junk (utm_*, fbclid, gclid…), lookalike
 * hostnames spelled with Cyrillic or Greek letters, a "site@" login prefix that hides the real
 * host, a mistyped ending (.con) and the full stop or bracket a copied sentence leaves behind.
 * It always reads back the real hostname the link opens, so a disguised domain can't hide.
 */
export function UrlInput({
  label = "Website",
  hint,
  value,
  defaultValue = "",
  onValueChange,
  onUrlChange,
  trackingParams = DEFAULT_TRACKING_PARAMS,
  removeTrackingLabel = "Remove tracking",
  useHttpsLabel = "Use https",
  messages,
  placeholder = "example.com",
  id,
  className,
  onBlur,
  onPaste,
  ...props
}: UrlInputProps) {
  const t = { ...URL_INPUT_MESSAGES, ...messages }
  const [inner, setInner] = React.useState(defaultValue)
  const [touched, setTouched] = React.useState(false)
  const [cleaned, setCleaned] = React.useState<{ text: string; removed: string } | null>(null)
  const autoId = React.useId()
  const inputId = id ?? autoId
  const text = value ?? inner
  const result = React.useMemo(() => analyzeUrl(text, trackingParams), [text, trackingParams])

  const update = (next: string) => {
    if (value === undefined) setInner(next)
    onValueChange?.(next)
    onUrlChange?.(analyzeUrl(next, trackingParams).url?.href ?? null)
  }

  const { url, trackers } = result
  const host = url?.hostname.replace(/^www\./, "") ?? ""
  const insecure = url?.protocol === "http:"
  const danger = !!result.imitates || !!result.credentials
  const error = touched && result.errorKind ? t[result.errorKind === "no-domain" ? "noDomain" : result.errorKind] : undefined
  const warning = !danger && (error || insecure || trackers.length > 0 || !!result.tldFix)
  const withoutLogin = () => {
    const clean = new URL(url!.href)
    clean.username = ""
    clean.password = ""
    return clean.href
  }

  return (
    <div data-slot="url-input" className={cn("grid w-full max-w-sm gap-1.5", className)}>
      <label htmlFor={inputId} className="w-fit text-sm font-medium">{label}</label>
      <input
        id={inputId}
        type="text"
        inputMode="url"
        autoComplete="url"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        value={text}
        placeholder={placeholder}
        aria-describedby={`${inputId}-hint`}
        aria-invalid={danger || !!error || undefined}
        data-warning={warning ? "" : undefined}
        data-danger={danger ? "" : undefined}
        onChange={(event) => update(event.target.value)}
        onPaste={(event) => {
          onPaste?.(event)
          const pasted = event.clipboardData.getData("text")
          const clean = cleanPastedUrl(pasted)
          // Only clean a paste that replaces the whole field; a paste into the middle is the user's edit.
          const whole = event.currentTarget.selectionStart === 0 && event.currentTarget.selectionEnd === text.length
          if (event.defaultPrevented || !whole || clean === pasted.trim() || !clean) return
          event.preventDefault()
          const original = pasted.trim()
          const at = original.indexOf(clean)
          const removed = at >= 0 ? [original.slice(0, at).trim(), original.slice(at + clean.length).trim()].filter(Boolean).map((part) => `“${part}”`).join(t.and) : t.extra
          setCleaned({ text: clean, removed })
          update(clean)
        }}
        onBlur={(event) => {
          setTouched(true)
          onBlur?.(event)
        }}
        className={fieldClass}
        {...props}
      />
      <div id={`${inputId}-hint`} aria-live="polite" className="min-h-6 text-xs">
        {error && <Line icon={TriangleAlert} tone="warn"><span>{error}</span></Line>}
        {url && !result.credentials && (
          <Line icon={insecure ? LockOpen : Lock} tone="muted">
            <span>
              {t.opens} <span className="font-mono font-semibold break-all text-foreground">{host}</span>
              {result.addedScheme && ` · ${t.schemeAdded}`}
            </span>
          </Line>
        )}
        {cleaned?.text === text && <Line icon={Scissors} tone="muted"><span>{fill(t.cleaned, { removed: cleaned.removed })}</span></Line>}
        {url && result.credentials && (
          <Line icon={ShieldAlert} tone="danger">
            <span>{fill(t.credentials, { login: result.credentials, host })}</span>
            <button type="button" className={fixClass} onClick={() => update(withoutLogin())}>
              {fill(t.removeLogin, { login: result.credentials })}
            </button>
          </Line>
        )}
        {result.unicodeHost && (
          <Line icon={ShieldAlert} tone={result.imitates ? "danger" : "muted"}>
            <span>
              {result.imitates
                ? fill(t.lookalike, { imitates: result.imitates, letters: result.oddLetters.join(", ") })
                : fill(t.international, { host: result.unicodeHost })}
            </span>
          </Line>
        )}
        {result.tldFix && (
          <Line icon={TriangleAlert} tone="warn">
            <span>{fill(t.tldTypo, { tld: url?.hostname.split(".").pop() ?? "", fixed: new URL(result.tldFix).hostname })}</span>
            <button type="button" className={fixClass} onClick={() => update(result.tldFix!)}>
              {fill(t.useFixed, { fixed: new URL(result.tldFix).hostname.replace(/^www\./, "") })}
            </button>
          </Line>
        )}
        {insecure && (
          <Line icon={LockOpen} tone="warn">
            <span>{t.insecure}</span>
            <button type="button" className={fixClass} onClick={() => update(url.href.replace(/^http:/, "https:"))}>
              {useHttpsLabel}
            </button>
          </Line>
        )}
        {url && trackers.length > 0 && (
          <Line icon={TriangleAlert} tone="warn">
            <span>{t.tracking} <span className="font-mono">{trackers.join(", ")}</span></span>
            <button type="button" className={fixClass} onClick={() => update(stripTracking(url.href, trackers))}>
              {removeTrackingLabel}
            </button>
          </Line>
        )}
        {!text.trim() && hint && <p className="py-1 text-muted-foreground">{hint}</p>}
      </div>
    </div>
  )
}
