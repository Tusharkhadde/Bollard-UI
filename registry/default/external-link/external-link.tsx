"use client"

import * as React from "react"
import { ExternalLink as ExternalIcon, ShieldAlert } from "lucide-react"

import { cn } from "@/lib/utils"

const STORAGE_KEY = "bollard-ui:external-link:trusted"
const MULTI_PART_SUFFIXES = new Set(["co.uk", "org.uk", "ac.uk", "co.in", "net.in", "org.in", "gov.in", "com.au", "co.jp", "com.br", "co.nz", "com.sg", "com.mx", "co.za"])
const DEFAULT_TRUSTED = ["paypal.com", "google.com", "apple.com", "microsoft.com", "amazon.com", "github.com", "facebook.com", "netflix.com", "stripe.com", "linkedin.com"]
const WEB_TLDS = /\.(?:com|net|org|io|in|co|dev|app|ai|uk|me|gov|edu|info|xyz|us|eu|de|au|sg)$/i
const CONFUSABLES: Record<string, string> = { а: "a", е: "e", о: "o", р: "p", с: "c", у: "y", х: "x", і: "i", ј: "j", ԁ: "d", ɡ: "g", "0": "o", "1": "l", "5": "s" }

/** RFC 3492 punycode decoder for one xn-- label. */
function decodeLabel(label: string) {
  if (!label.startsWith("xn--")) return label
  try {
    const input = label.slice(4)
    const out: number[] = []
    const basic = input.lastIndexOf("-")
    for (let j = 0; j < basic; j++) out.push(input.charCodeAt(j))
    let [n, i, bias, pos] = [128, 0, 72, basic > 0 ? basic + 1 : 0]
    while (pos < input.length) {
      const old = i
      for (let w = 1, k = 36; ; k += 36) {
        const c = input.charCodeAt(pos++)
        const digit = c < 58 ? c - 22 : c < 91 ? c - 65 : c - 97
        if (digit < 0 || digit >= 36 || Number.isNaN(digit)) return label
        i += digit * w
        const t = k <= bias ? 1 : k >= bias + 26 ? 26 : k - bias
        if (digit < t) break
        w *= 36 - t
      }
      let delta = old === 0 ? Math.floor((i - old) / 700) : Math.floor((i - old) / 2)
      delta += Math.floor(delta / (out.length + 1))
      let k = 0
      for (; delta > 455; k += 36) delta = Math.floor(delta / 35)
      bias = k + Math.floor((36 * delta) / (delta + 38))
      n += Math.floor(i / (out.length + 1))
      i %= out.length + 1
      out.splice(i++, 0, n)
    }
    return String.fromCodePoint(...out)
  } catch {
    return label
  }
}

const unicodeHost = (host: string) => host.split(".").map(decodeLabel).join(".")
const skeleton = (s: string) => Array.from(s.toLowerCase(), (ch) => CONFUSABLES[ch] ?? ch).join("").replace(/rn/g, "m").replace(/vv/g, "w")

/** "login.secure.paypal.co.uk" → "paypal.co.uk". */
export function registrableDomain(host: string) {
  if (/^[\d.]+$/.test(host) || host.startsWith("[")) return host
  const labels = host.toLowerCase().split(".")
  const lastTwo = labels.slice(-2).join(".")
  return labels.slice(MULTI_PART_SUFFIXES.has(lastTwo) ? -3 : -2).join(".")
}

/** One phishing tell, with the values its message needs. */
export type LinkIssue =
  | { kind: "mixedScript"; host: string }
  | { kind: "punycode"; host: string }
  | { kind: "lookalike"; twin: string }
  | { kind: "buried"; brand: string; domain: string }
  | { kind: "textMismatch"; shown: string; domain: string }
  | { kind: "rawIp" }
  | { kind: "http" }

/** English text for each tell. `{host}`, `{twin}`, `{brand}`, `{domain}` and `{shown}` are filled in. */
export const LINK_WARNING_MESSAGES: Record<LinkIssue["kind"], string> = {
  mixedScript: "Mixes Latin with Greek or Cyrillic letters, so it displays as {host}.",
  punycode: "Uses international characters and displays as {host}.",
  lookalike: "Looks like {twin}, but it isn't.",
  buried: "{brand} is only part of the address. You'd land on {domain}.",
  textMismatch: "The link says {shown} but goes to {domain}.",
  rawIp: "Goes to a raw IP address, not a named site.",
  http: "Not encrypted (http). Anything you type there can be read in transit.",
}

/** The sentence for one tell, from `messages` (any subset of `LINK_WARNING_MESSAGES`). */
export function describeLinkIssue(issue: LinkIssue, messages: Partial<Record<LinkIssue["kind"], string>> = {}) {
  const template = messages[issue.kind] ?? LINK_WARNING_MESSAGES[issue.kind]
  return template.replace(/\{(\w+)\}/g, (m, key: string) => String((issue as Record<string, unknown>)[key] ?? m))
}

export interface LinkInspection {
  url: URL
  /** Hostname with punycode decoded, as a browser might display it. */
  host: string
  registrable: string
  /** Each tell as data, for your own wording or logging. */
  issues: LinkIssue[]
  /** The same tells as sentences, in `messages` or English. */
  warnings: string[]
}

/**
 * Inspects a URL (and the text shown for it) for the classic phishing tells. `messages` translates
 * the `warnings` sentences; `issues` carries the same findings as data.
 */
export function inspectLink(
  href: string,
  visibleText = "",
  trusted = DEFAULT_TRUSTED,
  messages?: Partial<Record<LinkIssue["kind"], string>>
): LinkInspection | null {
  let url: URL
  try {
    url = new URL(href)
  } catch {
    return null
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null
  const host = unicodeHost(url.hostname)
  const registrable = registrableDomain(host)
  const issues: LinkIssue[] = []
  if (url.hostname.includes("xn--"))
    issues.push({ kind: /[a-z]/i.test(host) && /[\u0370-\u03ff\u0400-\u04ff]/.test(host) ? "mixedScript" : "punycode", host })
  const twin = trusted.find((t) => t !== registrable && skeleton(t) === skeleton(registrable))
  if (twin) issues.push({ kind: "lookalike", twin })
  const buried = trusted.find((t) => t !== registrable && host.includes(`${t}.`))
  if (buried) issues.push({ kind: "buried", brand: buried, domain: registrable })
  const shown = visibleText.match(/(?:[a-z0-9-]+\.)+[a-z]{2,}/i)?.[0]
  // Only treat text as a domain when it ends in a familiar TLD, so "README.md" isn't read as one.
  if (shown && WEB_TLDS.test(shown) && registrableDomain(unicodeHost(shown)) !== registrable)
    issues.push({ kind: "textMismatch", shown: shown.toLowerCase(), domain: registrable })
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(url.hostname) || url.hostname.startsWith("[")) issues.push({ kind: "rawIp" })
  if (url.protocol === "http:") issues.push({ kind: "http" })
  return { url, host, registrable, issues, warnings: issues.map((issue) => describeLinkIssue(issue, messages)) }
}

/** Domains the user chose not to be asked about again this session. sessionStorage can be blocked or hold junk. */
function readTrusted(): string[] {
  try {
    const saved: unknown = JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? "[]")
    return Array.isArray(saved) ? saved.filter((d): d is string => typeof d === "string") : []
  } catch {
    return []
  }
}

function rememberTrusted(domain: string) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify([...new Set([...readTrusted(), domain])]))
  } catch {
    // Storage unavailable: the link simply asks again next time.
  }
}

const textOf = (node: React.ReactNode): string =>
  typeof node === "string" || typeof node === "number" ? String(node) : Array.isArray(node) ? node.map(textOf).join("") : ""

/** Every user-visible string. `{domain}` is filled in. */
export const EXTERNAL_LINK_LABELS = {
  leaving: "You're leaving for",
  check: "Check this link before you go",
  remember: "Don't ask for {domain} again this session",
  cancel: "Cancel",
  goBack: "Go back",
  open: "Open site",
  openAnyway: "Open anyway",
}

export interface ExternalLinkProps extends Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "href"> {
  /** Absolute destination URL. Same-host links render as plain links. */
  href: string
  /** Domains people are likely to be impersonating, used for lookalike checks. */
  trustedDomains?: string[]
  /**
   * When to stop and show the destination. "always" confirms every external link; "risky" lets
   * clean links through untouched and only stops for ones with a warning, so trusted content
   * (docs, your own footer) never nags.
   */
  confirm?: "always" | "risky"
  /** Override any label. */
  labels?: Partial<typeof EXTERNAL_LINK_LABELS>
  /** Override any warning sentence (see `LINK_WARNING_MESSAGES`). */
  warningMessages?: Partial<Record<LinkIssue["kind"], string>>
}

/**
 * A link that confirms before leaving your site. The popover shows the real
 * destination with its registrable domain in bold and flags punycode,
 * lookalike domains, link text that disagrees with the href, and plain http.
 * With `confirm="risky"` clean links open straight away and only suspicious ones stop.
 */
export function ExternalLink({ href, trustedDomains = DEFAULT_TRUSTED, confirm = "always", labels, warningMessages, target = "_blank", children, className, onClick, ...props }: ExternalLinkProps) {
  const t = { ...EXTERNAL_LINK_LABELS, ...labels }
  const [open, setOpen] = React.useState(false)
  const [shift, setShift] = React.useState(0)
  const [remember, setRemember] = React.useState(false)
  const [currentHost, setCurrentHost] = React.useState<string>()
  const wrapperRef = React.useRef<HTMLSpanElement>(null)
  const linkRef = React.useRef<HTMLAnchorElement>(null)
  const primaryRef = React.useRef<HTMLButtonElement>(null)
  const titleId = React.useId()
  const info = inspectLink(href, textOf(children), trustedDomains, warningMessages)
  const risky = (info?.warnings.length ?? 0) > 0
  // Until mount we can't know our own host, so absolute links count as external (no icon pop-in).
  const external = info !== null && info.url.hostname !== currentHost

  React.useEffect(() => setCurrentHost(window.location.hostname), [])

  React.useLayoutEffect(() => {
    if (!open) return
    // Slide the popover left as far as needed so it never runs off a narrow screen.
    const rect = wrapperRef.current?.getBoundingClientRect()
    if (rect) {
      const width = Math.min(320, window.innerWidth - 16)
      setShift(Math.max(8 - rect.left, Math.min(0, window.innerWidth - 8 - width - rect.left)))
    }
    primaryRef.current?.focus()
    const onPointerDown = (event: PointerEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener("pointerdown", onPointerDown)
    return () => document.removeEventListener("pointerdown", onPointerDown)
  }, [open])

  const close = () => {
    setOpen(false)
    linkRef.current?.focus()
  }

  const go = () => {
    if (!info) return
    if (remember && !risky) rememberTrusted(info.registrable)
    setOpen(false)
    if (target === "_blank") window.open(info.url.href, "_blank", "noopener,noreferrer")
    else window.location.assign(info.url.href)
  }

  // Show the ASCII hostname: for punycode that is the honest form, not the lookalike it renders as.
  const shownHost = info?.url.hostname ?? ""
  const shownDomain = registrableDomain(shownHost)
  const subdomain = shownHost.slice(0, shownHost.length - shownDomain.length)
  const button = "inline-flex h-8 items-center rounded-md px-3 text-sm font-medium outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50"

  return (
    <span
      ref={wrapperRef}
      data-slot="external-link"
      className="relative inline-block"
      onBlur={(event) => {
        if (open && !event.currentTarget.contains(event.relatedTarget)) setOpen(false)
      }}
    >
      <a
        ref={linkRef}
        href={href}
        target={target}
        rel="noopener noreferrer"
        aria-haspopup={external && (risky || confirm === "always") ? "dialog" : undefined}
        aria-expanded={external && (risky || confirm === "always") ? open : undefined}
        onClick={(event) => {
          onClick?.(event)
          if (event.defaultPrevented || !external || !info) return
          if (!risky && (confirm === "risky" || readTrusted().includes(info.registrable))) return
          event.preventDefault()
          setOpen((o) => !o)
        }}
        className={cn("inline-flex items-center gap-1 rounded-sm font-medium underline underline-offset-4 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50", className)}
        {...props}
      >
        {children}
        {external && <ExternalIcon className="size-3.5 opacity-60" aria-hidden />}
      </a>

      {open && info && (
        <div
          role="dialog"
          aria-labelledby={titleId}
          onKeyDown={(event) => event.key === "Escape" && close()}
          className={cn(
            "absolute top-full z-50 mt-2 w-80 max-w-[calc(100vw-1rem)] space-y-3 rounded-lg border bg-popover p-3 text-left text-sm font-normal text-popover-foreground shadow-md"
          )}
          style={{ left: shift }}
        >
          <div>
            <p id={titleId} className="text-xs text-muted-foreground">
              {risky ? t.check : t.leaving}
            </p>
            <p className="mt-1 break-all font-mono text-[15px]">
              <span className="text-muted-foreground">{subdomain}</span>
              <strong className="font-semibold text-foreground">{shownDomain}</strong>
              <span className="text-xs text-muted-foreground">{info.url.pathname === "/" ? "" : info.url.pathname}</span>
            </p>
          </div>
          {risky && (
            <ul className="space-y-1 rounded-md border border-red-300 bg-red-50 p-2 text-xs text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
              {info.warnings.map((warning) => (
                <li key={warning} className="flex gap-1.5">
                  <ShieldAlert className="mt-px size-3.5 shrink-0" aria-hidden /> {warning}
                </li>
              ))}
            </ul>
          )}
          {!risky && (
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="size-3.5 accent-(--primary)" />
              {t.remember.replace("{domain}", info.registrable)}
            </label>
          )}
          <div className="flex justify-end gap-2">
            <button ref={risky ? primaryRef : undefined} type="button" onClick={close} className={cn(button, "border bg-background hover:bg-accent")}>
              {risky ? t.goBack : t.cancel}
            </button>
            <button
              ref={risky ? undefined : primaryRef}
              type="button"
              onClick={go}
              className={cn(button, risky ? "bg-destructive text-white hover:bg-destructive/90" : "bg-primary text-primary-foreground hover:bg-primary/90")}
            >
              {risky ? t.openAnyway : t.open}
            </button>
          </div>
        </div>
      )}
    </span>
  )
}
