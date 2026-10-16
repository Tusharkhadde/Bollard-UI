"use client"

import * as React from "react"
import { CircleCheck, Link2, LoaderCircle, TriangleAlert } from "lucide-react"

import { cn } from "@/lib/utils"

/** Letters Unicode normalisation can't take apart (a naive slugify turns Straße into "strae"). */
export const SLUG_CHARS: Record<string, string> = {
  ß: "ss", æ: "ae", œ: "oe", ø: "o", ł: "l", đ: "d", ð: "d", þ: "th", ı: "i", ħ: "h", "&": " and ", "@": " at ",
}

/**
 * Makes a URL-safe slug: transliterates (é→e, ß→ss), drops apostrophes so "don't" stays "dont",
 * turns anything else into single hyphens and cuts at a word boundary. Pass `partial` when the
 * user has just typed a separator, to keep the trailing hyphen they are about to type past.
 */
export function slugify(text: string, { maxLength = 60, partial = false, chars = SLUG_CHARS } = {}) {
  let slug = text
    .toLowerCase()
    .replace(/./gu, (char) => chars[char] ?? char)
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .replace(/['’`]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+/, "")
  if (slug.length > maxLength) slug = slug.slice(0, maxLength).replace(/-[^-]*$/, "") || slug.slice(0, maxLength)
  return partial && slug.length < maxLength ? slug : slug.replace(/-+$/, "")
}

type Availability = { state: "idle" | "checking" | "available" | "error" } | { state: "taken"; suggestion?: string }

export interface SlugInputProps extends Omit<React.ComponentProps<"input">, "value" | "defaultValue" | "onChange"> {
  /** The title the slug follows until the user edits the slug (or it has been published). */
  title?: string
  /** Visible label. */
  label?: string
  /** Controlled slug. */
  value?: string
  /** Initial slug when uncontrolled. Defaults to the published slug, or one made from the title. */
  defaultValue?: string
  /** Called with the slug on every change. */
  onValueChange?: (value: string) => void
  /** Where the slug lives, e.g. "https://acme.com/blog/". */
  baseUrl?: string
  /** The slug that is live now. Changing away from it warns that links will break. */
  publishedSlug?: string
  /** Controlled "keep a redirect from the old URL" choice. */
  keepRedirect?: boolean
  /** Initial redirect choice when uncontrolled. On by default, like Shopify's pre-ticked box. */
  defaultKeepRedirect?: boolean
  /** Called when the redirect choice changes. */
  onKeepRedirectChange?: (keep: boolean) => void
  /** Resolves `true` when the slug is free. Called after a pause in typing; stale answers are ignored. */
  checkAvailability?: (slug: string) => boolean | Promise<boolean>
  /** Most characters in a slug. */
  maxLength?: number
  /** Warning after a published slug changes; `{path}` is the old path. */
  breaksLinksText?: string
  /** Label of the redirect checkbox; `{path}` is the old path. */
  redirectLabel?: string
  /** Shown when the redirect is unticked; `{path}` is the old path. */
  noRedirectText?: string
  /** Label of the one-tap fix that restores the published slug. */
  restoreLabel?: string
  /** Shown when `checkAvailability` says the slug is taken. */
  takenText?: string
  /** Label of the fix that applies the next free slug; `{slug}` is filled in. */
  useSuggestionLabel?: string
  /** Shown when the slug is free. */
  availableText?: string
  /** Shown while the check runs. */
  checkingText?: string
  /** Shown when the check fails. */
  checkErrorText?: string
  /** Label of the button that goes back to following the title. */
  fromTitleLabel?: string
}

const fixClass =
  "inline-flex h-6 items-center gap-1 rounded-md border border-amber-500/40 px-2 font-medium text-amber-900 transition-colors hover:bg-amber-500/10 dark:text-amber-200 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"

/**
 * A URL slug field that won't break links. It follows the title (transliterating and stripping
 * unsafe characters) until you edit it, reads back the full URL, checks for collisions as you
 * type and offers the next free slug. Once a page is published it stops following the title,
 * and editing the slug warns which link breaks, with a redirect kept by default.
 */
export function SlugInput({
  title = "",
  label = "URL slug",
  value,
  defaultValue,
  onValueChange,
  baseUrl = "https://example.com/blog/",
  publishedSlug,
  keepRedirect,
  defaultKeepRedirect = true,
  onKeepRedirectChange,
  checkAvailability,
  maxLength = 60,
  breaksLinksText = "Changing this breaks links to {path}.",
  redirectLabel = "Redirect {path} to the new URL",
  noRedirectText = "Visitors to {path} will get a 404.",
  restoreLabel = "Keep the old slug",
  takenText = "That URL is already used.",
  useSuggestionLabel = "Use {slug}",
  availableText = "Available",
  checkingText = "Checking…",
  checkErrorText = "Couldn't check if this URL is free.",
  fromTitleLabel = "Match the title",
  id,
  className,
  onBlur,
  ref,
  ...props
}: SlugInputProps) {
  const fromTitle = slugify(title, { maxLength })
  const [inner, setInner] = React.useState(defaultValue ?? publishedSlug ?? fromTitle)
  const [edited, setEdited] = React.useState(defaultValue !== undefined || publishedSlug !== undefined)
  const [innerRedirect, setInnerRedirect] = React.useState(defaultKeepRedirect)
  const [availability, setAvailability] = React.useState<Availability>({ state: "idle" })
  const autoId = React.useId()
  const inputId = id ?? autoId
  const slug = value ?? (edited ? inner : fromTitle)
  const redirect = keepRedirect ?? innerRedirect
  const prefix = baseUrl.replace(/^[a-z]+:\/\/[^/]+/i, "") || "/"
  const oldPath = `${prefix}${publishedSlug}`
  const fill = (template: string, values: Record<string, string>) => template.replace(/\{(\w+)\}/g, (m, k: string) => values[k] ?? m)

  const update = (next: string, manual = true) => {
    if (manual) setEdited(true)
    if (value === undefined) setInner(next)
    onValueChange?.(next)
  }

  // Tell a controlled parent when the title moves an untouched slug.
  React.useEffect(() => {
    if (!edited && value !== undefined && value !== fromTitle) onValueChange?.(fromTitle)
  }, [edited, fromTitle, value, onValueChange])

  React.useEffect(() => {
    const final = slug.replace(/-+$/, "")
    if (!checkAvailability || !final || final === publishedSlug) return setAvailability({ state: "idle" })
    let live = true
    setAvailability({ state: "checking" })
    const timer = setTimeout(async () => {
      try {
        if (await checkAvailability(final)) return live && setAvailability({ state: "available" })
        let suggestion: string | undefined
        for (let n = 2; n <= 5 && !suggestion && live; n++) if (await checkAvailability(`${final}-${n}`)) suggestion = `${final}-${n}`
        if (live) setAvailability({ state: "taken", suggestion })
      } catch {
        if (live) setAvailability({ state: "error" })
      }
    }, 400)
    return () => {
      live = false
      clearTimeout(timer)
    }
  }, [slug, publishedSlug, checkAvailability])

  const changedPublished = publishedSlug !== undefined && slug.replace(/-+$/, "") !== publishedSlug
  const setRedirect = (keep: boolean) => {
    if (keepRedirect === undefined) setInnerRedirect(keep)
    onKeepRedirectChange?.(keep)
  }

  return (
    <div data-slot="slug-input" className={cn("grid w-full max-w-sm gap-1.5", className)}>
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={inputId} className="text-sm font-medium">
          {label}
        </label>
        {edited && !publishedSlug && fromTitle && slug !== fromTitle && (
          <button type="button" onClick={() => { setEdited(false); update(fromTitle, false) }} className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 rounded-sm">
            {fromTitleLabel}
          </button>
        )}
      </div>
      <div
        data-warning={changedPublished || availability.state === "taken" ? "" : undefined}
        className="flex h-9 w-full min-w-0 items-center rounded-md border shadow-xs transition-[color,box-shadow] focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50 dark:bg-input/30 data-warning:border-amber-500 dark:data-warning:border-amber-400"
      >
        <span aria-hidden className="max-w-[45%] shrink-0 truncate border-r bg-muted/50 px-2.5 font-mono text-sm leading-9 text-muted-foreground rounded-l-md">
          {prefix}
        </span>
        <input
          ref={ref}
          id={inputId}
          type="text"
          inputMode="url"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          value={slug}
          onChange={(event) => update(slugify(event.target.value, { maxLength, partial: /[\s_-]$/.test(event.target.value) }))}
          onBlur={(event) => {
            if (/-$/.test(slug)) update(slug.replace(/-+$/, ""))
            onBlur?.(event)
          }}
          aria-describedby={`${inputId}-status`}
          className="h-full w-full min-w-0 bg-transparent px-2.5 font-mono text-base outline-none md:text-sm"
          {...props}
        />
      </div>
      <div id={`${inputId}-status`} aria-live="polite" className="grid gap-1.5 text-xs">
        <p className="flex min-w-0 items-start gap-1.5 text-muted-foreground">
          <Link2 aria-hidden className="mt-px size-3.5 shrink-0" />
          <span className="min-w-0 font-mono [overflow-wrap:anywhere]">
            {baseUrl}
            <span className="font-medium text-foreground">{slug.replace(/-+$/, "")}</span>
          </span>
        </p>
        {availability.state === "checking" && (
          <p className="flex items-center gap-1.5 text-muted-foreground"><LoaderCircle aria-hidden className="size-3.5 animate-spin" />{checkingText}</p>
        )}
        {availability.state === "available" && (
          <p className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400"><CircleCheck aria-hidden className="size-3.5" />{availableText}</p>
        )}
        {availability.state === "error" && <p className="text-muted-foreground">{checkErrorText}</p>}
        {availability.state === "taken" && (
          <p data-warning-id="taken" className="flex gap-1.5 text-amber-700 dark:text-amber-400">
            <span className="flex h-6 shrink-0 items-center"><TriangleAlert aria-hidden className="size-3.5" /></span>
            <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
              <span className="py-1">{takenText}</span>
              {availability.suggestion && (
                <button type="button" onClick={() => update(availability.suggestion as string)} className={cn(fixClass, "font-mono")}>
                  {fill(useSuggestionLabel, { slug: availability.suggestion })}
                </button>
              )}
            </span>
          </p>
        )}
        {changedPublished && (
          <div data-warning-id="published" className="grid gap-1.5 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-amber-950 dark:text-amber-50">
            <p className="flex gap-1.5">
              <span className="flex h-6 shrink-0 items-center"><TriangleAlert aria-hidden className="size-3.5 text-amber-600 dark:text-amber-400" /></span>
              <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                <span className="py-1">{fill(breaksLinksText, { path: oldPath })}</span>
                <button type="button" onClick={() => update(publishedSlug ?? "")} className={fixClass}>{restoreLabel}</button>
              </span>
            </p>
            <label className="flex w-fit cursor-pointer items-center gap-2 pl-5">
              <input type="checkbox" checked={redirect} onChange={(event) => setRedirect(event.target.checked)} className="size-3.5 accent-amber-700 dark:accent-amber-400" />
              <span className="[overflow-wrap:anywhere]">{fill(redirectLabel, { path: oldPath })}</span>
            </label>
            {!redirect && <p className="pl-5 font-medium">{fill(noRedirectText, { path: oldPath })}</p>}
          </div>
        )}
      </div>
    </div>
  )
}
