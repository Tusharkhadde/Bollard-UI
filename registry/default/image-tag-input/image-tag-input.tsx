"use client"

import * as React from "react"
import { CircleAlert, Info, LoaderCircle, Pin, TriangleAlert } from "lucide-react"

import { cn } from "@/lib/utils"
import { checkImageRef, isMovingTag, parseImageRef, type ImageContext, type ImageIssue } from "@/registry/default/image-tag-input/parse-image-ref"

export { checkImageRef, isMovingTag, parseImageRef, type ImageContext, type ImageIssue, type ImageIssueKind, type ImageRef } from "@/registry/default/image-tag-input/parse-image-ref"

const DEFAULT_MESSAGES = {
  label: "Container image",
  placeholder: "ghcr.io/acme/api:1.4.2",
  production: "prod",
  pulls: "Pulls",
  implied: "implied",
  invalid: "This isn't a valid image reference{detail}.",
  scheme: "Image references have no https://. Docker can't pull this.",
  uppercase: "Repository names must be lowercase, so Docker rejects this.",
  "hub-website": "That's the Docker Hub web page, not a pullable image.",
  "registry-typo": "Unknown registry. Did you mean {detail}?",
  "deprecated-registry": "This registry is frozen and gets no new versions. Use {detail}.",
  "missing-registry": "No registry, so this pulls from Docker Hub, where anyone can publish under that name. Your image is on {detail}.",
  localhost: "localhost only exists on your machine. Production nodes can't pull from it.",
  "digest-format": "Digests look like sha256: followed by 64 hex characters. This one won't resolve.",
  "no-tag": "No tag means :latest, which changes whenever someone pushes.",
  latest: ":latest changes whenever someone pushes, so two nodes can run different code.",
  "mutable-tag": ":{detail} moves to each new release. Pin a full version or a digest.",
  "tag-and-digest": "The digest decides what's pulled. The tag is only a label here.",
  "arch-mismatch": "This is a {detail} image, but the target is {platform}. It will fail with exec format error.",
  "arch-pinned": "Pinned to {detail}. Nodes on another architecture fail with exec format error.",
  use: "Use {fix}",
  useMultiArch: "Use multi-arch {fix}",
  pin: "Pin digest",
  pinning: "Resolving…",
  pinFailed: "Couldn't resolve the digest. Check the registry login and try again.",
}
export type ImageTagInputMessages = typeof DEFAULT_MESSAGES

const fill = (text: string, values: Record<string, string | number>) => text.replace(/\{(\w+)\}/g, (match, key: string) => String(values[key] ?? match))
const tones = { error: "text-red-700 dark:text-red-400", warning: "text-amber-700 dark:text-amber-400", info: "text-muted-foreground" }
const icons = { error: CircleAlert, warning: TriangleAlert, info: Info }
const fixClass = (error: boolean) =>
  cn(
    "inline-flex min-h-6 max-w-full items-center gap-1 rounded-md border px-2 text-left font-medium [overflow-wrap:anywhere] transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-60",
    error ? "border-red-500/40 text-red-800 hover:bg-red-500/10 dark:text-red-200" : "border-amber-500/40 text-amber-900 hover:bg-amber-500/10 dark:text-amber-200",
  )
const shortDigest = (digest: string) => (digest.length > 20 ? `${digest.slice(0, 11)}…${digest.slice(-4)}` : digest)

/** Announces `text` only after typing settles, so screen readers don't chatter on every keystroke. */
function useSettled(text: string, delay = 900) {
  const [settled, setSettled] = React.useState(text)
  React.useEffect(() => {
    const timer = setTimeout(() => setSettled(text), delay)
    return () => clearTimeout(timer)
  }, [text, delay])
  return settled
}

export interface ImageTagInputProps extends Omit<React.ComponentProps<"input">, "value" | "defaultValue" | "onChange">, ImageContext {
  /** Controlled reference. */
  value?: string
  /** Initial reference when uncontrolled. */
  defaultValue?: string
  /** Called with the new reference on every edit or fix. */
  onValueChange?: (value: string) => void
  /** Known tags for this image, newest first. The first full version is offered instead of :latest or a moving tag. */
  tags?: string[]
  /** Looks up the digest a reference points to now (e.g. via your registry API). Enables one-tap "Pin digest". */
  resolveDigest?: (reference: string) => Promise<string>
  /** Visible label; shorthand for `messages.label`. */
  label?: string
  /** Every visible string. `{fix}`, `{detail}`, `{platform}` are filled in. */
  messages?: Partial<ImageTagInputMessages>
}

/**
 * A container image field that reads the reference back the way Docker,
 * containerd and Kubernetes resolve it (docker.io/library/…:latest included),
 * and catches the ones that pull the wrong thing: :latest or no tag in
 * production, tags that move, a typo'd or frozen registry, a private image
 * that silently falls back to Docker Hub, malformed digests and an arch that
 * won't run on the target. Fixes are one tap, including pinning a digest.
 */
export function ImageTagInput({
  value,
  defaultValue = "",
  onValueChange,
  production = false,
  platform,
  privateRegistry,
  tags = [],
  resolveDigest,
  label,
  messages,
  id,
  className,
  ref,
  "aria-describedby": describedBy,
  ...props
}: ImageTagInputProps) {
  const t = { ...DEFAULT_MESSAGES, ...messages, ...(label !== undefined && { label }) }
  const [inner, setInner] = React.useState(defaultValue)
  const [pin, setPin] = React.useState<"idle" | "pending" | "failed">("idle")
  const input = React.useRef<HTMLInputElement>(null)
  const list = React.useRef<HTMLUListElement>(null)
  const refocus = React.useRef<number | null>(null)
  const latest = React.useRef("")
  const request = React.useRef(0)
  const autoId = React.useId()
  const inputId = id ?? autoId
  const text = value ?? inner
  React.useImperativeHandle(ref, () => input.current as HTMLInputElement)
  React.useEffect(() => {
    latest.current = text
  }, [text])

  const parsed = parseImageRef(text)
  const issues = React.useMemo(() => checkImageRef(text, { production, platform, privateRegistry }), [text, production, platform, privateRegistry])
  const errors = issues.filter((issue) => issue.severity === "error")
  const announced = useSettled(issues.filter((issue) => issue.severity !== "info").map((issue) => fill(t[issue.kind], { detail: issue.detail ?? "", platform: platform ?? "" })).join(" "))
  const suggested = tags.find((tag) => !isMovingTag(tag))
  // Pinning while the reference is wrong (say, falling back to Docker Hub) would lock in the wrong image.
  const canPin = Boolean(resolveDigest) && errors.length === 0

  const update = (next: string) => {
    if (value === undefined) setInner(next)
    onValueChange?.(next)
    setPin("idle")
    request.current++
  }
  // A fix removes its own button, so focus moves to the next fix (or back to the field) instead of the page.
  React.useEffect(() => {
    if (refocus.current === null) return
    const buttons = list.current?.querySelectorAll<HTMLButtonElement>("button[data-fix]") ?? []
    ;(buttons[Math.min(refocus.current, buttons.length - 1)] ?? input.current)?.focus()
    refocus.current = null
  }, [text])
  const apply = (next: string, button: HTMLElement) => {
    refocus.current = [...(list.current?.querySelectorAll("button[data-fix]") ?? [])].indexOf(button)
    update(next)
  }
  const pinDigest = async (button: HTMLElement) => {
    if (!resolveDigest || !parsed) return
    const asked = text
    const id = ++request.current
    setPin("pending")
    try {
      const digest = (await resolveDigest(asked.trim())).trim()
      // The user kept typing: this digest is for a reference that's no longer in the field.
      if (id !== request.current || latest.current !== asked) return
      if (!/^sha256:[a-f0-9]{64}$|^sha512:[a-f0-9]{128}$/.test(digest)) throw new Error("bad digest")
      apply(`${asked.trim().split("@")[0]}${parsed.tag ? "" : ":latest"}@${digest}`, button)
    } catch {
      if (id === request.current) setPin("failed")
    }
  }
  const readable = parsed && !issues.some((issue) => issue.kind === "invalid" || issue.kind === "scheme" || issue.kind === "hub-website" || issue.kind === "uppercase") ? parsed : null
  const implied = "text-muted-foreground underline decoration-dotted underline-offset-2"

  return (
    <div data-slot="image-tag-input" className={cn("grid w-full grid-cols-[minmax(0,1fr)] max-w-md min-w-0 gap-1.5 text-sm", className)}>
      <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
        <label htmlFor={inputId} className="font-medium">
          {t.label}
        </label>
        {(production || platform) && (
          <span className="font-mono text-xs text-muted-foreground">
            {[production && t.production, platform].filter(Boolean).join(" · ")}
          </span>
        )}
      </div>
      <input
        ref={input}
        id={inputId}
        value={text}
        onChange={(event) => update(event.target.value)}
        placeholder={t.placeholder}
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        aria-invalid={errors.length > 0 || undefined}
        aria-describedby={[describedBy, `${inputId}-readback`, `${inputId}-issues`].filter(Boolean).join(" ")}
        className="h-9 w-full min-w-0 rounded-md border bg-transparent px-3 font-mono text-base shadow-xs transition-[color,box-shadow] outline-none placeholder:font-sans placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-destructive md:text-sm dark:bg-input/30"
        {...props}
      />
      <p id={`${inputId}-readback`} className="mt-1.5 flex min-w-0 items-baseline gap-2 text-xs empty:hidden">
        {readable && (
          <>
            <span className="shrink-0 text-muted-foreground">{t.pulls}</span>
            <code className="min-w-0 font-mono break-all">
              {readable.registry ? `${readable.registry}/` : <span className={implied} title={t.implied}>docker.io/</span>}
              {!readable.registry && !readable.path.includes("/") && <span className={implied} title={t.implied}>library/</span>}
              <span className="font-medium">{readable.path}</span>
              {readable.tag ? `:${readable.tag}` : !readable.digest && <span className="text-amber-700 underline decoration-dotted underline-offset-2 dark:text-amber-400" title={t.implied}>:latest</span>}
              {readable.digest && <span className="text-emerald-700 dark:text-emerald-400" title={readable.digest}>@{shortDigest(readable.digest)}</span>}
            </code>
          </>
        )}
      </p>
      <span role="status" className="sr-only">
        {announced}
      </span>
      <ul ref={list} id={`${inputId}-issues`} className="grid gap-1.5 text-xs empty:hidden">
        {issues.map((issue: ImageIssue) => {
          const Icon = icons[issue.severity]
          const moving = issue.kind === "latest" || issue.kind === "no-tag" || issue.kind === "mutable-tag"
          return (
            <li key={issue.kind} className={cn("flex gap-1.5", tones[issue.severity])}>
              <span className="flex h-6 shrink-0 items-center">
                <Icon aria-hidden className="size-3.5" />
              </span>
              <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                <span className="py-1">{fill(t[issue.kind], { detail: issue.kind === "invalid" && issue.detail ? `: ${issue.detail}` : (issue.detail ?? ""), platform: platform ?? "" })}</span>
                {issue.fix !== undefined && (
                  <button type="button" data-fix="" onClick={(event) => apply(issue.fix as string, event.currentTarget)} className={cn(fixClass(issue.severity === "error"), "font-mono")}>
                    {fill(issue.kind.startsWith("arch") ? t.useMultiArch : t.use, { fix: issue.fix })}
                  </button>
                )}
                {moving && suggested && parsed && (
                  <button type="button" data-fix="" onClick={(event) => apply(`${text.trim().replace(/:[^:/@]*$/, "")}:${suggested}`, event.currentTarget)} className={cn(fixClass(false), "font-mono")}>
                    {fill(t.use, { fix: `:${suggested}` })}
                  </button>
                )}
                {moving && canPin && (
                  <button type="button" data-fix="" disabled={pin === "pending"} aria-busy={pin === "pending" || undefined} onClick={(event) => pinDigest(event.currentTarget)} className={fixClass(false)}>
                    {pin === "pending" ? <LoaderCircle aria-hidden className="size-3.5 animate-spin motion-reduce:animate-none" /> : <Pin aria-hidden className="size-3.5" />}
                    {pin === "pending" ? t.pinning : t.pin}
                  </button>
                )}
                {moving && pin === "failed" && (
                  <span role="alert" className="w-full text-red-700 dark:text-red-400">
                    {t.pinFailed}
                  </span>
                )}
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
