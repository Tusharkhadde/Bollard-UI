"use client"

import * as React from "react"
import { CircleCheck, OctagonAlert, TriangleAlert } from "lucide-react"

import { cn } from "@/lib/utils"
import { byteCapacity, decodeQr, encodeQr, type QrCode } from "./qr-encode"

export { byteCapacity, decodeQr, encodeQr, type QrCode } from "./qr-encode"

export interface QrIssue {
  id: "hidden" | "local" | "staging" | "http" | "dense" | "too-long"
  tone: "warning" | "danger"
  message: string
  /** One-tap fix: the corrected URL and the button label. */
  fix?: { label: string; value: string }
}

const LOCAL = /^(localhost|127\.\d+\.\d+\.\d+|0\.0\.0\.0|\[::1\]|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)$|\.(local|localhost|internal|lan|home\.arpa)$/i
const STAGING = /(^|[.-])(staging|stage|stg|dev|preview|uat|qa|test|sandbox)([.-]|\d|$)|-git-|deploy-preview-/i
const TRACKING = /^(utm_\w+|fbclid|gclid|dclid|msclkid|mc_eid|igshid|ttclid|yclid)$/i
const HIDDEN = /[\s\u00a0\u200b-\u200f\u2028\u2029\u2060\ufeff]/g

/** Default issue messages; `{host}` and `{modules}` are filled in. Override any of them via `messages`. */
export const QR_MESSAGES = {
  hidden: "The link contains hidden spaces or invisible characters, so the code won't open what you see.",
  hiddenFix: "Remove them",
  local: "{host} only exists on your computer or network. A phone that scans this gets an error.",
  staging: "{host} looks like a staging site, not the live one.",
  publicFix: "Use {host}",
  http: "It opens over plain http, so phones may warn and the page can be tampered with.",
  httpFix: "Use https",
  dense: "Long link, dense code ({modules} dots): it needs printing large and scans slowly.",
  denseFix: "Remove tracking ({modules})",
  tooLong: "This link is too long to fit in a QR code at all.",
}

const fill = (template: string, values: Record<string, string>) =>
  template.replace(/\{(\w+)\}/g, (match, key: string) => values[key] ?? match)

const versionFor = (text: string) => {
  const bytes = new TextEncoder().encode(text).length
  for (let v = 1; v <= 40; v++) if (bytes <= byteCapacity(v)) return v
  return null
}

/** The URL with tracking parameters (utm_*, fbclid, gclid…) removed. */
export function withoutTracking(url: string) {
  try {
    const parsed = new URL(url)
    for (const key of [...parsed.searchParams.keys()]) if (TRACKING.test(key)) parsed.searchParams.delete(key)
    return parsed.toString()
  } catch {
    return url
  }
}

/**
 * What would go wrong if this URL were printed as a QR code: hidden characters,
 * hosts a phone can't reach, staging, plain http, and codes too dense to scan.
 */
export function checkQrUrl(
  url: string,
  { publicOrigin, denseVersion = 7, messages }: { publicOrigin?: string; denseVersion?: number; messages?: Partial<typeof QR_MESSAGES> } = {},
): QrIssue[] {
  const t = { ...QR_MESSAGES, ...messages }
  const issues: QrIssue[] = []
  const clean = url.replace(HIDDEN, "")
  if (clean !== url) issues.push({ id: "hidden", tone: "danger", message: t.hidden, fix: { label: t.hiddenFix, value: clean } })
  let parsed: URL | null = null
  try {
    parsed = new URL(clean)
  } catch {
    // Not a URL: the remaining checks still apply.
  }
  const swap = () =>
    parsed && publicOrigin
      ? { label: fill(t.publicFix, { host: new URL(publicOrigin).host }), value: new URL(parsed.pathname + parsed.search + parsed.hash, publicOrigin).toString() }
      : undefined
  if (parsed && LOCAL.test(parsed.hostname)) {
    issues.push({ id: "local", tone: "danger", message: fill(t.local, { host: parsed.host }), fix: swap() })
  } else if (parsed && STAGING.test(parsed.hostname.split(".").slice(0, -1).join("."))) {
    issues.push({ id: "staging", tone: "warning", message: fill(t.staging, { host: parsed.hostname }), fix: swap() })
  }
  if (parsed?.protocol === "http:" && !LOCAL.test(parsed.hostname)) {
    issues.push({ id: "http", tone: "warning", message: t.http, fix: { label: t.httpFix, value: clean.replace(/^http:/i, "https:") } })
  }
  const version = versionFor(clean)
  if (version === null) {
    issues.push({ id: "too-long", tone: "danger", message: t.tooLong })
  } else if (version >= denseVersion) {
    const stripped = withoutTracking(clean)
    const after = versionFor(stripped)
    const modules = (v: number) => `${v * 4 + 17}×${v * 4 + 17}`
    issues.push({
      id: "dense",
      tone: "warning",
      message: fill(t.dense, { modules: modules(version) }),
      fix: after && after < version ? { label: fill(t.denseFix, { modules: modules(after) }), value: stripped } : undefined,
    })
  }
  return issues
}

/** Shows the URL with the host in bold and every invisible character made visible. */
function Readback({ url }: { url: string }) {
  const match = url.match(/^([a-z][\w+.-]*:\/\/)([^/?#]*)(.*)$/is)
  const mark = (text: string) =>
    text.split(/([\s\u00a0\u200b-\u200f\u2028\u2029\u2060\ufeff])/).map((part, i) =>
      i % 2 ? (
        <mark key={i} title={`U+${part.charCodeAt(0).toString(16).toUpperCase().padStart(4, "0")}`} className="rounded-sm bg-red-500/20 px-0.5 text-red-700 dark:text-red-300">
          ␣
        </mark>
      ) : (
        part
      ),
    )
  if (!match) return <>{mark(url)}</>
  return (
    <>
      <span className="text-muted-foreground">{mark(match[1])}</span>
      <span className="font-semibold text-foreground">{mark(match[2])}</span>
      {mark(match[3])}
    </>
  )
}

const fixClass = {
  warning: "border-amber-500/40 text-amber-900 hover:bg-amber-500/10 dark:text-amber-200",
  danger: "border-red-500/40 text-red-900 hover:bg-red-500/10 dark:text-red-200",
}

export interface QrShareProps extends Omit<React.ComponentProps<"div">, "children" | "defaultValue"> {
  /** Controlled URL. */
  value?: string
  /** Initial URL when uncontrolled. */
  defaultValue?: string
  /** Called with the new URL when a one-tap fix is used. */
  onValueChange?: (value: string) => void
  /** The live origin (e.g. "https://acme.com") offered in place of localhost or staging. */
  publicOrigin?: string
  /** Rendered width of the code in px, quiet zone included. */
  size?: number
  /** Version from which a code counts as dense (7 = 45×45 dots). */
  denseVersion?: number
  /** Overrides for the issue messages in `QR_MESSAGES`. */
  messages?: Partial<typeof QR_MESSAGES>
  /** Templates: `{count}` (characters), `{modules}` and `{print}` are filled in. */
  verifiedText?: string
  /** Shown when the drawn code doesn't decode back to the URL. */
  mismatchText?: string
}

/**
 * Stops a QR code going out that opens the wrong thing. It reads the exact URL
 * back under the code, decodes the code it drew to prove nothing was cut off,
 * and warns when the link points at localhost or staging, uses http, hides
 * invisible characters, or is long enough to make a dense, slow-scanning code.
 */
export function QrShare({
  value,
  defaultValue = "",
  onValueChange,
  publicOrigin,
  size = 176,
  denseVersion = 7,
  messages,
  verifiedText = "Scans back as exactly these {count} characters · {modules} · print ≥ {print}",
  mismatchText = "This code doesn't scan back as the link above. Don't share it.",
  className,
  ...props
}: QrShareProps) {
  const [inner, setInner] = React.useState(defaultValue)
  const url = value ?? inner
  const svgRef = React.useRef<SVGSVGElement>(null)

  const code = React.useMemo<QrCode | null>(() => {
    try {
      return url ? encodeQr(url) : null
    } catch {
      return null
    }
  }, [url])
  const verified = code ? decodeQr(code.modules) === url : false
  const issues = checkQrUrl(url, { publicOrigin, denseVersion, messages })

  // A quick fade tells you the code itself changed after a fix.
  React.useEffect(() => {
    if (!svgRef.current || matchMedia("(prefers-reduced-motion: reduce)").matches) return
    svgRef.current.animate([{ opacity: 0.25, transform: "scale(0.97)" }, { opacity: 1, transform: "scale(1)" }], { duration: 250, easing: "ease-out" })
  }, [code])

  const update = (next: string) => {
    if (value === undefined) setInner(next)
    onValueChange?.(next)
  }

  const quiet = 4
  const total = code ? code.size + quiet * 2 : 0
  const path = code
    ? code.modules.flatMap((row, y) => row.map((dark, x) => (dark ? `M${x + quiet} ${y + quiet}h1v1h-1z` : ""))).join("")
    : ""
  const values = code
    ? {
        count: String([...url].length),
        modules: `${code.size}×${code.size}`,
        print: `${(((code.size + 8) * 0.4) / 10).toFixed(1)} cm`,
      }
    : null

  return (
    <div data-slot="qr-share" className={cn("grid w-full max-w-sm justify-items-center gap-3 text-sm", className)} {...props}>
      {code && (
        // Always dark on white: many scanners can't read an inverted code, so this ignores dark mode.
        <div className="rounded-lg border bg-white p-1 shadow-xs">
          <svg ref={svgRef} role="img" aria-label={`QR code for ${url}`} viewBox={`0 0 ${total} ${total}`} width={size} height={size} shapeRendering="crispEdges">
            <path d={path} fill="#000" />
          </svg>
        </div>
      )}
      <div className="grid w-full gap-1.5">
        <p className="rounded-md border bg-muted/40 px-3 py-2 font-mono text-xs leading-relaxed break-all">
          <Readback url={url} />
        </p>
        {code && values && (verified ? (
          <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
            <CircleCheck aria-hidden className="mt-px size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
            <span>{fill(verifiedText, values)}</span>
          </p>
        ) : (
          <p role="alert" className="flex items-start gap-1.5 text-xs text-red-700 dark:text-red-400">
            <OctagonAlert aria-hidden className="mt-px size-3.5 shrink-0" />
            {mismatchText}
          </p>
        ))}
      </div>
      <ul aria-live="polite" className="grid w-full gap-1.5 text-xs empty:hidden">
        {issues.map((issue) => {
          const Icon = issue.tone === "danger" ? OctagonAlert : TriangleAlert
          return (
            <li key={issue.id} className={cn("flex gap-1.5", issue.tone === "danger" ? "text-red-700 dark:text-red-400" : "text-amber-700 dark:text-amber-400")}>
              <span className="flex h-6 shrink-0 items-center">
                <Icon aria-hidden className="size-3.5" />
              </span>
              <span className="flex min-w-0 flex-wrap items-center gap-x-2">
                <span className="py-1">{issue.message}</span>
                {issue.fix && (
                  <button
                    type="button"
                    onClick={() => issue.fix && update(issue.fix.value)}
                    className={cn("inline-flex h-6 items-center rounded-md border px-2 font-medium whitespace-nowrap transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50", fixClass[issue.tone])}
                  >
                    {issue.fix.label}
                  </button>
                )}
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
