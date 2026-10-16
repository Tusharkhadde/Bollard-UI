"use client"

import * as React from "react"
import { ImageOff, Link2, LoaderCircle, OctagonAlert, TriangleAlert } from "lucide-react"

import { cn } from "@/lib/utils"

export interface UnfurlPreview {
  /** Where the link finally lands after redirects. */
  url: string
  title?: string
  description?: string
  /** Absolute image URL from og:image or twitter:image. */
  image?: string
  imageWidth?: number
  imageHeight?: number
  siteName?: string
}

/** Fetches a page the way an unfurl bot would (server side, following redirects) and returns its tags. */
export type UnfurlFetcher = (url: string, signal: AbortSignal) => Promise<UnfurlPreview>

const decode = (text: string) =>
  text
    .replace(/&#x([\da-f]+);/gi, (_, h: string) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d: string) => String.fromCodePoint(Number(d)))
    .replace(/&(amp|quot|apos|lt|gt|#39);/g, (_, e: string) => ({ amp: "&", quot: '"', apos: "'", "#39": "'", lt: "<", gt: ">" })[e] ?? "")

/**
 * Reads Open Graph / Twitter card tags from HTML the way Slack, X and LinkedIn
 * do (og:* first, then twitter:*, then <title> and meta description). For a fetcher.
 */
export function parseOpenGraph(html: string, pageUrl: string): UnfurlPreview {
  const tags = new Map<string, string>()
  for (const [tag] of html.matchAll(/<meta\b[^>]*>/gi)) {
    const key = tag.match(/(?:property|name)\s*=\s*["']([^"']+)["']/i)?.[1].toLowerCase()
    const content = tag.match(/content\s*=\s*(?:"([^"]*)"|'([^']*)')/i)
    if (key && content && !tags.has(key)) tags.set(key, decode(content[1] ?? content[2]).trim())
  }
  const pick = (...keys: string[]) => keys.map((k) => tags.get(k)).find(Boolean)
  const image = pick("og:image", "og:image:url", "twitter:image")
  const size = (k: string) => Number(tags.get(k)) || undefined
  return {
    url: pick("og:url") ?? pageUrl,
    title: pick("og:title", "twitter:title") ?? (decode(html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1] ?? "").trim() || undefined),
    description: pick("og:description", "twitter:description", "description"),
    image: image ? new URL(image, pageUrl).toString() : undefined,
    imageWidth: size("og:image:width"),
    imageHeight: size("og:image:height"),
    siteName: pick("og:site_name"),
  }
}

const LOCAL = /^(localhost|127\.\d+\.\d+\.\d+|0\.0\.0\.0|\[::1\]|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)$|\.(local|localhost|internal|lan|home\.arpa)$/i
const STAGING = /(^|[.-])(staging|stage|stg|dev|preview|uat|qa|test|sandbox)([.-]|\d|$)|-git-|deploy-preview-/i
const TRACKING = /^(utm_\w+|fbclid|gclid|dclid|msclkid|mc_eid|igshid|ttclid|twclid|yclid|_hsenc|_hsmi|mkt_tok)$/i
const SIGN_IN = /\/(login|log-in|signin|sign-in|sso|auth|oauth|session)(\/|$|\?)/i

/** Default messages; `{host}`, `{params}`, `{count}`, `{size}` are filled in. */
export const UNFURL_MESSAGES = {
  local: "{host} only works on your machine. Nobody else can open it, and no preview will show.",
  staging: "{host} looks like a staging site, not the live one.",
  publicFix: "Use {host}",
  tracking: "Tracking parameters ride along: {params}.",
  trackingFix: "Remove {count}",
  redirect: "Redirects to {host}. Readers, and the preview, land there.",
  redirectFix: "Use final link",
  signIn: "Redirects to a sign-in page on {host}, so the preview shows a login screen, not your page.",
  noImage: "No og:image, so it posts as a small text-only card.",
  smallImage: "The image is {size}. Under 600×315, most apps shrink it to a thumbnail.",
  noTitle: "No title tag, so the preview shows the bare URL.",
  failed: "Couldn't read the page, so it will probably post as a plain link.",
}
type Messages = typeof UNFURL_MESSAGES

export interface LinkIssue {
  id: "local" | "staging" | "tracking" | "redirect" | "sign-in" | "no-image" | "small-image" | "no-title"
  tone: "warning" | "danger"
  message: string
  fix?: { label: string; value: string }
}

const fill = (template: string, values: Record<string, string | number>) =>
  template.replace(/\{(\w+)\}/g, (match, key: string) => String(values[key] ?? match))

const tryUrl = (text: string) => {
  try {
    return /^https?:\/\//i.test(text.trim()) ? new URL(text.trim()) : null
  } catch {
    return null
  }
}

/** True when an unfurl bot on the internet could never reach the host. */
export const isPrivateHost = (url: string) => LOCAL.test(tryUrl(url)?.hostname ?? "")

/** The URL without tracking parameters, and the names that were removed. */
export function stripTracking(url: string) {
  const parsed = tryUrl(url)
  if (!parsed) return { url, removed: [] as string[] }
  const removed = [...parsed.searchParams.keys()].filter((k) => TRACKING.test(k))
  removed.forEach((k) => parsed.searchParams.delete(k))
  return { url: parsed.toString(), removed: [...new Set(removed)] }
}

/** Everything wrong with posting `url`, given what the fetcher found (when it found anything). */
export function checkLink(url: string, preview?: UnfurlPreview, { publicOrigin, messages }: { publicOrigin?: string; messages?: Partial<Messages> } = {}) {
  const t = { ...UNFURL_MESSAGES, ...messages }
  const parsed = tryUrl(url)
  if (!parsed) return []
  const issues: LinkIssue[] = []
  const swap = publicOrigin
    ? { label: fill(t.publicFix, { host: new URL(publicOrigin).host }), value: new URL(parsed.pathname + parsed.search + parsed.hash, publicOrigin).toString() }
    : undefined
  if (LOCAL.test(parsed.hostname)) issues.push({ id: "local", tone: "danger", message: fill(t.local, { host: parsed.host }), fix: swap })
  else if (STAGING.test(parsed.hostname.split(".").slice(0, -1).join("."))) issues.push({ id: "staging", tone: "warning", message: fill(t.staging, { host: parsed.hostname }), fix: swap })
  const { url: stripped, removed } = stripTracking(url)
  if (removed.length) issues.push({ id: "tracking", tone: "warning", message: fill(t.tracking, { params: removed.join(", ") }), fix: { label: fill(t.trackingFix, { count: removed.length }), value: stripped } })
  if (!preview) return issues
  const final = tryUrl(preview.url)
  const same = (a: URL, b: URL) => a.host === b.host && a.pathname.replace(/\/$/, "") === b.pathname.replace(/\/$/, "")
  if (final && !same(final, parsed)) {
    // A sign-in redirect is the whole story; image and title warnings about the login page would only distract.
    if (SIGN_IN.test(final.pathname + "/")) return [...issues, { id: "sign-in", tone: "danger", message: fill(t.signIn, { host: final.host }) } as LinkIssue]
    else issues.push({ id: "redirect", tone: "warning", message: fill(t.redirect, { host: final.host + final.pathname }), fix: { label: t.redirectFix, value: stripTracking(final.toString()).url } })
  }
  if (!preview.title) issues.push({ id: "no-title", tone: "warning", message: t.noTitle })
  if (!preview.image) issues.push({ id: "no-image", tone: "warning", message: t.noImage })
  else if (preview.imageWidth && preview.imageHeight && (preview.imageWidth < 600 || preview.imageHeight < 315))
    issues.push({ id: "small-image", tone: "warning", message: fill(t.smallImage, { size: `${preview.imageWidth}×${preview.imageHeight}` }) })
  return issues
}

const fieldClass =
  "h-9 w-full min-w-0 rounded-md border bg-transparent px-3 text-base shadow-xs transition-[color,box-shadow] outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 md:text-sm dark:bg-input/30 data-warning:border-amber-500 dark:data-warning:border-amber-400"
const fixTone = {
  warning: "border-amber-500/40 text-amber-900 hover:bg-amber-500/10 dark:text-amber-200",
  danger: "border-red-500/40 text-red-900 hover:bg-red-500/10 dark:text-red-200",
}
const keyframes = "@keyframes cui-link-unfurl-check-in{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:none}}"

export interface LinkUnfurlCheckProps extends Omit<React.ComponentProps<"input">, "value" | "defaultValue" | "onChange" | "type"> {
  /** Visible label. */
  label?: string
  /** Controlled URL. */
  value?: string
  /** Initial URL when uncontrolled. */
  defaultValue?: string
  /** Called with the URL on every change and when a fix is applied. */
  onValueChange?: (value: string) => void
  /** Reads the page's tags, usually through your server (see `parseOpenGraph`). */
  fetchPreview: UnfurlFetcher
  /** The live origin offered in place of localhost or staging, e.g. "https://acme.com". */
  publicOrigin?: string
  /** Pause in ms after typing before the page is fetched. */
  delay?: number
  /** Overrides for the messages in `UNFURL_MESSAGES`. */
  messages?: Partial<Messages>
  /** Heading above the predicted card. */
  previewLabel?: string
}

/**
 * Shows how a link will unfurl before you post it, and catches what makes it
 * embarrassing: a localhost or staging URL, tracking parameters (stripped in
 * one tap), a redirect, especially to a sign-in page, and a page with no
 * image or title. Private hosts are never fetched: no bot could reach them.
 */
export function LinkUnfurlCheck({
  label = "Link",
  value,
  defaultValue = "",
  onValueChange,
  fetchPreview,
  publicOrigin,
  delay = 500,
  messages,
  previewLabel = "How it will unfurl",
  id,
  className,
  ...props
}: LinkUnfurlCheckProps) {
  const [inner, setInner] = React.useState(defaultValue)
  const [result, setResult] = React.useState<{ url: string; preview?: UnfurlPreview; failed?: boolean }>()
  const autoId = React.useId()
  const inputId = id ?? autoId
  const url = (value ?? inner).trim()
  const fetchable = tryUrl(url) !== null && !isPrivateHost(url)

  React.useEffect(() => {
    if (!fetchable) return
    const controller = new AbortController()
    const timer = setTimeout(() => {
      fetchPreview(url, controller.signal).then(
        (preview) => setResult({ url, preview }),
        () => !controller.signal.aborted && setResult({ url, failed: true }),
      )
    }, delay)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [url, fetchable, fetchPreview, delay])

  const update = (next: string) => {
    if (value === undefined) setInner(next)
    onValueChange?.(next)
  }

  const current = result?.url === url ? result : undefined
  const loading = fetchable && !current
  const preview = current?.preview
  const issues = checkLink(url, preview, { publicOrigin, messages })
  const t = { ...UNFURL_MESSAGES, ...messages }
  const host = tryUrl(preview?.url ?? url)?.hostname.replace(/^www\./, "")

  return (
    <div data-slot="link-unfurl-check" className={cn("grid w-full max-w-sm gap-1.5", className)}>
      <style>{keyframes}</style>
      <label htmlFor={inputId} className="w-fit text-sm font-medium">
        {label}
      </label>
      <input
        id={inputId}
        type="url"
        inputMode="url"
        autoComplete="off"
        spellCheck={false}
        value={value ?? inner}
        onChange={(event) => update(event.target.value)}
        aria-describedby={`${inputId}-issues`}
        data-warning={issues.length ? "" : undefined}
        className={fieldClass}
        {...props}
      />
      <ul id={`${inputId}-issues`} aria-live="polite" className="grid gap-1 text-xs empty:hidden">
        {issues.map((issue) => {
          const Icon = issue.tone === "danger" ? OctagonAlert : TriangleAlert
          return (
            <li key={issue.id} className={cn("flex gap-1.5", issue.tone === "danger" ? "text-red-700 dark:text-red-400" : "text-amber-700 dark:text-amber-400")}>
              <span className="flex h-6 shrink-0 items-center">
                <Icon aria-hidden className="size-3.5" />
              </span>
              <span className="flex min-w-0 flex-wrap items-center gap-x-2">
                <span className="py-1 break-words">{issue.message}</span>
                {issue.fix && (
                  <button
                    type="button"
                    onClick={() => issue.fix && update(issue.fix.value)}
                    className={cn("inline-flex h-6 items-center rounded-md border px-2 font-medium whitespace-nowrap transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50", fixTone[issue.tone])}
                  >
                    {issue.fix.label}
                  </button>
                )}
              </span>
            </li>
          )
        })}
      </ul>
      {url && (
        <section aria-label={previewLabel} aria-busy={loading} className="mt-1.5 grid gap-1.5">
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            {previewLabel}
            {loading && <LoaderCircle aria-hidden className="size-3 animate-spin" />}
          </span>
          {loading ? (
            <div className="grid gap-2 rounded-md border border-l-4 p-3">
              <div className="h-3 w-1/3 rounded bg-muted motion-safe:animate-pulse" />
              <div className="h-4 w-4/5 rounded bg-muted motion-safe:animate-pulse" />
              <div className="aspect-[1.91/1] w-full rounded bg-muted motion-safe:animate-pulse" />
            </div>
          ) : preview ? (
            <div className="grid gap-1 overflow-hidden rounded-md border border-l-4 border-l-muted-foreground/30 p-3 text-sm motion-safe:animate-[cui-link-unfurl-check-in_250ms_ease-out]">
              <span className="truncate text-xs font-medium text-muted-foreground">{preview.siteName ?? host}</span>
              <span className={cn("line-clamp-2 font-semibold", preview.title ? "text-sky-700 dark:text-sky-400" : "break-all text-muted-foreground")}>
                {preview.title ?? preview.url}
              </span>
              {preview.description && <span className="line-clamp-2 text-xs text-muted-foreground">{preview.description}</span>}
              {preview.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={preview.image} alt="" className="mt-1.5 aspect-[1.91/1] w-full rounded border object-cover" />
              ) : (
                <span className="mt-1.5 flex h-12 items-center justify-center gap-1.5 rounded border border-dashed text-xs text-muted-foreground">
                  <ImageOff aria-hidden className="size-3.5" />
                  No image
                </span>
              )}
            </div>
          ) : (
            <p className="flex items-center gap-1.5 rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground">
              <Link2 aria-hidden className="size-3.5 shrink-0" />
              <span className="min-w-0 break-all">{current?.failed ? t.failed : url}</span>
            </p>
          )}
        </section>
      )}
    </div>
  )
}
