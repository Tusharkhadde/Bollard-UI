"use client"

import * as React from "react"
import { Check, Copy, Eye, Globe, Radar, ShieldAlert, TriangleAlert, X } from "lucide-react"

import { cn } from "@/lib/utils"
import {
  buildEmbedSnippet,
  findEmbedRisks,
  normalizeDomain,
  removeParam,
  type EmbedOptions,
  type EmbedResource,
} from "@/registry/default/embed-code/embed-snippet"

export * from "@/registry/default/embed-code/embed-snippet"

const field =
  "h-9 w-full min-w-0 rounded-md border bg-transparent px-3 text-base shadow-xs transition-[color,box-shadow] outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 md:text-sm dark:bg-input/30 aria-invalid:border-amber-500"
const btn =
  "inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-md px-3 text-sm font-medium whitespace-nowrap outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50"
const fixClass =
  "inline-flex h-6 items-center rounded-md border border-current/30 px-2 text-xs font-medium outline-none hover:bg-current/10 focus-visible:ring-[3px] focus-visible:ring-ring/50"

const DEFAULT_OPTIONS: EmbedOptions = { responsive: true, width: 640, height: 360, privacy: false, allowedDomains: [] }
const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a)

export interface EmbedCodeProps extends Omit<React.ComponentProps<"div">, "defaultValue" | "onCopy" | "resource"> {
  /** What is being embedded, and what it exposes. */
  resource: EmbedResource
  /** Controlled embed options. */
  value?: EmbedOptions
  /** Initial options when uncontrolled. */
  defaultValue?: Partial<EmbedOptions>
  onValueChange?: (options: EmbedOptions) => void
  /** Called with the snippet after it is copied. */
  onCopy?: (snippet: string) => void
  /** Renders the live preview for a src. Defaults to a titled placeholder at the chosen size. */
  renderPreview?: (src: string) => React.ReactNode
  labels?: Partial<typeof DEFAULT_LABELS>
}

const DEFAULT_LABELS = {
  exposes: "Anyone on the page sees",
  tracking: "Tracking",
  noTracking: "None",
  privacy: "Privacy mode (no cookies until played)",
  responsive: "Responsive",
  width: "Width",
  height: "Height",
  domains: "Allowed sites",
  domainsHint: "Only these sites can show it.",
  anySite: "Any site can embed this.",
  add: "Add",
  removeSecret: "Remove it",
  copy: "Copy",
  copyAnyway: "Copy anyway",
  copied: "Copied",
  copyFailed: "Your browser blocked copying. The code is selected, so press Ctrl+C or ⌘C.",
  snippet: "Embed code",
}

/**
 * An embed-snippet generator that says what the embed gives away before you paste it on a
 * public page. It reads back what visitors see and what it tracks, offers a privacy mode,
 * normalises allowed domains, and catches drafts, private resources and secrets in the URL
 * (token=, sig=) with a one-tap strip; copying a risky snippet takes a second, deliberate click.
 */
export function EmbedCode({ resource, value, defaultValue, onValueChange, onCopy, renderPreview, labels: labelOverrides, className, ...props }: EmbedCodeProps) {
  const labels = { ...DEFAULT_LABELS, ...labelOverrides }
  const [inner, setInner] = React.useState<EmbedOptions>({ ...DEFAULT_OPTIONS, ...defaultValue })
  const [stripped, setStripped] = React.useState<string[]>([])
  const [draftDomain, setDraftDomain] = React.useState("")
  const [domainProblem, setDomainProblem] = React.useState<string>()
  const [copyState, setCopyState] = React.useState<"idle" | "confirm" | "copied" | "failed">("idle")
  const snippetRef = React.useRef<HTMLPreElement>(null)
  const options = value ?? inner
  const id = React.useId()

  const base = options.privacy && resource.privacyUrl ? resource.privacyUrl : resource.url
  const src = stripped.reduce(removeParam, base)
  const snippet = buildEmbedSnippet(src, resource.title, options)
  const risks = findEmbedRisks(src, resource.visibility)
  const dangerous = risks.some((risk) => risk.level === "danger")
  const tracking = options.privacy && resource.privacyUrl ? [] : (resource.tracking ?? [])
  const divisor = gcd(options.width, options.height) || 1

  React.useEffect(() => setCopyState("idle"), [snippet])
  React.useEffect(() => {
    if (copyState !== "copied") return
    const timer = setTimeout(() => setCopyState("idle"), 1600)
    return () => clearTimeout(timer)
  }, [copyState])

  const update = (patch: Partial<EmbedOptions>) => {
    const next = { ...options, ...patch }
    if (value === undefined) setInner(next)
    onValueChange?.(next)
  }

  const addDomain = () => {
    const { domain, problem } = normalizeDomain(draftDomain)
    setDomainProblem(problem)
    if (problem) return
    if (!options.allowedDomains.includes(domain)) update({ allowedDomains: [...options.allowedDomains, domain] })
    setDraftDomain("")
  }

  const copy = async () => {
    if (dangerous && copyState !== "confirm") return setCopyState("confirm")
    try {
      await navigator.clipboard.writeText(snippet)
    } catch {
      // Clipboard can be blocked (insecure context, permissions). Never claim it worked:
      // select the snippet so a manual copy is one keystroke away.
      const pre = snippetRef.current
      const selection = window.getSelection()
      if (pre && selection) {
        const range = document.createRange()
        range.selectNodeContents(pre)
        selection.removeAllRanges()
        selection.addRange(range)
      }
      return setCopyState("failed")
    }
    setCopyState("copied")
    onCopy?.(snippet)
  }

  return (
    <div data-slot="embed-code" data-state={dangerous ? "risky" : "ok"} className={cn("w-full max-w-md space-y-4 text-sm", className)} {...props}>
      <style>{`@keyframes cui-embed-code-flash { from { background-color: color-mix(in oklab, var(--color-amber-400) 30%, transparent) } }`}</style>

      <figure className="space-y-1.5">
        <div
          className="mx-auto max-h-56 max-w-full overflow-hidden rounded-md border bg-muted/40 transition-[aspect-ratio,width] duration-300 ease-out motion-reduce:transition-none"
          style={{ aspectRatio: `${options.width} / ${options.height}`, width: options.responsive ? "100%" : Math.min(options.width, 448) }}
        >
          {renderPreview ? renderPreview(src) : (
            <div className="grid size-full place-items-center p-3 text-center text-xs text-muted-foreground">{resource.title}</div>
          )}
        </div>
        <figcaption className="text-center text-xs text-muted-foreground tabular-nums">
          {options.responsive ? `${labels.responsive} · ${options.width / divisor}:${options.height / divisor}` : `${options.width} × ${options.height}px`}
        </figcaption>
      </figure>

      <div className="space-y-2 rounded-md border p-3">
        <ReadbackRow icon={<Eye aria-hidden className="size-3.5" />} label={labels.exposes} items={resource.exposes ?? []} empty="—" />
        <ReadbackRow icon={<Radar aria-hidden className="size-3.5" />} label={labels.tracking} items={tracking} empty={labels.noTracking} warn />
        {resource.privacyUrl && (
          <label className="flex items-center gap-2 text-xs">
            <input type="checkbox" checked={options.privacy} onChange={(event) => update({ privacy: event.target.checked })} className="size-4 accent-primary" />
            {labels.privacy}
          </label>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-[auto_1fr_1fr] sm:items-end">
        <label className="col-span-2 flex h-9 items-center gap-2 text-sm font-medium sm:col-span-1">
          <input type="checkbox" checked={options.responsive} onChange={(event) => update({ responsive: event.target.checked })} className="size-4 accent-primary" />
          {labels.responsive}
        </label>
        {(["width", "height"] as const).map((key) => (
          <label key={key} className="grid gap-1.5 text-xs font-medium">
            {labels[key]}
            <input type="number" min={1} value={options[key]} onChange={(event) => update({ [key]: Math.max(1, Number(event.target.value) || 1) })} className={field} />
          </label>
        ))}
      </div>

      <div className="grid gap-1.5">
        <label htmlFor={`${id}-domain`} className="text-sm font-medium">{labels.domains}</label>
        <div className="flex gap-2">
          <input
            id={`${id}-domain`}
            value={draftDomain}
            placeholder="example.com"
            aria-invalid={domainProblem ? true : undefined}
            aria-describedby={`${id}-domain-hint`}
            onChange={(event) => {
              setDraftDomain(event.target.value)
              setDomainProblem(undefined)
            }}
            onKeyDown={(event) => {
              if (event.key !== "Enter") return
              event.preventDefault()
              addDomain()
            }}
            className={field}
          />
          <button type="button" onClick={addDomain} className={cn(btn, "h-9 border hover:bg-accent")}>{labels.add}</button>
        </div>
        {options.allowedDomains.length > 0 && (
          <ul className="flex flex-wrap gap-1.5">
            {options.allowedDomains.map((domain) => (
              <li key={domain} className="inline-flex h-6 items-center gap-1 rounded-full border pl-2 text-xs">
                <Globe aria-hidden className="size-3 text-muted-foreground" />
                {domain}
                <button type="button" aria-label={`Remove ${domain}`} onClick={() => update({ allowedDomains: options.allowedDomains.filter((d) => d !== domain) })} className="grid size-6 place-items-center rounded-full outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50">
                  <X aria-hidden className="size-3" />
                </button>
              </li>
            ))}
          </ul>
        )}
        <p id={`${id}-domain-hint`} aria-live="polite" className={cn("text-xs", domainProblem || !options.allowedDomains.length ? "text-amber-700 dark:text-amber-400" : "text-muted-foreground")}>
          {domainProblem ?? (options.allowedDomains.length ? labels.domainsHint : labels.anySite)}
        </p>
      </div>

      <div className="space-y-2">
        {risks.length > 0 && (
          <ul aria-live="polite" className="space-y-1.5">
            {risks.map((risk) => (
              <li key={risk.message} className={cn("flex gap-1.5 rounded-md border px-3 py-2 text-xs", risk.level === "danger" ? "border-red-500/30 bg-red-500/10 text-red-800 dark:text-red-300" : "border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-300")}>
                {risk.level === "danger" ? <ShieldAlert aria-hidden className="mt-0.5 size-3.5 shrink-0" /> : <TriangleAlert aria-hidden className="mt-0.5 size-3.5 shrink-0" />}
                <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                  <span>{risk.message}</span>
                  {risk.param && (
                    <button type="button" onClick={() => setStripped((prev) => [...prev, risk.param!])} className={fixClass}>{labels.removeSecret}</button>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
        <pre
          ref={snippetRef}
          key={snippet}
          aria-label={labels.snippet}
          className="max-h-40 overflow-auto rounded-md border bg-muted/40 p-3 font-mono text-xs leading-relaxed whitespace-pre-wrap break-all motion-safe:animate-[cui-embed-code-flash_400ms_ease-out]"
        >
          {snippet}
        </pre>
        <button
          type="button"
          onClick={copy}
          onBlur={() => copyState === "confirm" && setCopyState("idle")}
          className={cn(btn, "h-9 w-full", copyState === "confirm" ? "bg-destructive text-white hover:bg-destructive/90 dark:bg-destructive/60" : "bg-primary text-primary-foreground hover:bg-primary/90")}
        >
          {copyState === "copied" ? <Check aria-hidden className="size-4" /> : <Copy aria-hidden className="size-4" />}
          <span aria-live="polite">{copyState === "copied" ? labels.copied : copyState === "confirm" ? labels.copyAnyway : labels.copy}</span>
        </button>
        {copyState === "failed" && (
          <p role="alert" className="flex gap-1.5 text-xs text-destructive">
            <TriangleAlert aria-hidden className="mt-px size-3.5 shrink-0" />
            {labels.copyFailed}
          </p>
        )}
      </div>
    </div>
  )
}

function ReadbackRow({ icon, label, items, empty, warn }: { icon: React.ReactNode; label: string; items: string[]; empty: string; warn?: boolean }) {
  return (
    <div className="grid gap-1">
      <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">{icon}{label}</p>
      <p className="flex flex-wrap gap-1.5 text-xs">
        {items.length ? items.map((item) => (
          <span key={item} className={cn("rounded-full px-2 py-0.5", warn ? "bg-amber-500/15 text-amber-800 dark:text-amber-300" : "bg-muted")}>{item}</span>
        )) : <span className="text-emerald-700 dark:text-emerald-400">{empty}</span>}
      </p>
    </div>
  )
}
