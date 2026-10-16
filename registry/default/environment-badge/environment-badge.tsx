"use client"

import * as React from "react"
import { Code, FlaskConical, ShieldAlert } from "lucide-react"

import { cn } from "@/lib/utils"

export type Environment = "production" | "staging" | "development"

const aliases: Record<string, Environment> = {
  prod: "production",
  production: "production",
  live: "production",
  prd: "production",
  stage: "staging",
  staging: "staging",
  stg: "staging",
  uat: "staging",
  preview: "staging",
  qa: "staging",
  dev: "development",
  development: "development",
  local: "development",
  test: "development",
}

/**
 * Maps loose names ("prod", "uat", "local", "prod-eu-1", "api.staging") to one of three environments.
 * Every word is checked and production wins, so "prod-test" reads as production. A name it can't
 * place falls back to `fallback` (staging by default): an unknown environment is never called
 * "safe to experiment".
 */
export function normalizeEnvironment(env: string, fallback: Environment = "staging"): Environment {
  return matchEnvironment(env) ?? fallback
}

/** Like `normalizeEnvironment`, but undefined when no word of the name is a known alias. */
export function matchEnvironment(env: string): Environment | undefined {
  const words = env.trim().toLowerCase().split(/[^a-z0-9]+/).filter(Boolean)
  const found = new Set(words.map((word) => aliases[word.replace(/\d+$/, "")]).filter(Boolean))
  return (["production", "staging", "development"] as const).find((environment) => found.has(environment))
}

// Same hues as the banner tones: production = danger (red), staging = warning (amber), development = success (emerald).
// Solid fills on purpose: this one has to be louder than any other banner.
const config = {
  production: {
    label: "Production",
    short: "PROD",
    icon: ShieldAlert,
    color: "#b91c1c",
    accent: "text-red-700 dark:text-red-400",
    className: "bg-red-700 text-white bg-[repeating-linear-gradient(135deg,transparent_0_10px,rgb(0_0_0/0.16)_10px_20px)]",
  },
  staging: {
    label: "Staging",
    short: "STG",
    icon: FlaskConical,
    color: "#f59e0b",
    accent: "text-amber-700 dark:text-amber-400",
    className: "bg-amber-400 text-amber-950",
  },
  development: {
    label: "Development",
    short: "DEV",
    icon: Code,
    color: "#047857",
    accent: "text-emerald-700 dark:text-emerald-400",
    className: "bg-emerald-700 text-white",
  },
} as const

const defaultMessages: Record<Environment, string> = {
  production: "Changes affect real customers",
  staging: "Test environment, not real customers",
  development: "Safe to experiment",
}

export interface EnvironmentBadgeProps extends Omit<React.ComponentProps<"div">, "children"> {
  /** The environment this app is running in. Accepts aliases like "prod", "uat", "local" or "prod-eu-1". */
  env: string
  /** How to treat a name that matches no known alias. Defaults to staging, so an unknown env is never shown as safe. */
  fallback?: Environment
  /** Display names per environment, e.g. to translate them. The short tags (PROD, STG, DEV) stay as they are. */
  labels?: Partial<Record<Environment, string>>
  /** Read after the name by screen readers: "Production environment". */
  envSuffix?: string
  /** Strip message for a name that matched no alias; the name itself is shown as the label. */
  unknownMessage?: string
  /** `strip` is a full-width bar for the top of an admin layout, `ribbon` a corner sash, `badge` an inline pill. */
  variant?: "strip" | "ribbon" | "badge"
  /** What the environment means, shown in the strip after its name. */
  message?: string
  /** Extra detail shown in the strip, e.g. a region or database name. Hidden on small screens. */
  detail?: string
  /** Prefix the tab title with the environment, e.g. "[PROD] Orders". Kept when the app changes the title; removed on unmount. */
  prefixTitle?: boolean
  /** Paint a colored band onto the favicon so the tab itself shows where you are. Restored on unmount. */
  markFavicon?: boolean
}

function useTitlePrefix(env: Environment, enabled: boolean) {
  React.useEffect(() => {
    if (!enabled) return
    const prefix = `[${config[env].short}] `
    const strip = (title: string) => title.replace(/^\[(PROD|STG|DEV)\] /, "")
    const apply = () => {
      if (!document.title.startsWith(prefix)) document.title = prefix + strip(document.title)
    }
    apply()
    // Routers rewrite the title on navigation; put the prefix back each time.
    const observer = new MutationObserver(apply)
    observer.observe(document.head, { subtree: true, childList: true, characterData: true })
    return () => {
      observer.disconnect()
      document.title = strip(document.title)
    }
  }, [env, enabled])
}

function useFaviconBand(env: Environment, enabled: boolean) {
  React.useEffect(() => {
    if (!enabled) return
    const existing = document.querySelector<HTMLLinkElement>("link[rel~='icon']")
    const icon = existing ?? Object.assign(document.createElement("link"), { rel: "icon" })
    if (!existing) document.head.appendChild(icon)
    const original = existing?.getAttribute("href") ?? null
    const canvas = Object.assign(document.createElement("canvas"), { width: 32, height: 32 })
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    const paint = (image?: HTMLImageElement) => {
      ctx.clearRect(0, 0, 32, 32)
      if (image) ctx.drawImage(image, 0, 0, 32, 32)
      ctx.fillStyle = config[env].color
      ctx.fillRect(0, image ? 22 : 0, 32, image ? 10 : 32)
      icon.href = canvas.toDataURL("image/png")
    }
    const image = new Image()
    image.crossOrigin = "anonymous"
    image.onload = () => paint(image)
    image.onerror = () => paint()
    if (existing && original) image.src = existing.href
    else paint()
    return () => {
      image.onload = image.onerror = null
      if (!existing) icon.remove()
      else if (original === null) icon.removeAttribute("href")
      else icon.setAttribute("href", original)
    }
  }, [env, enabled])
}

/**
 * Makes the current environment impossible to miss, so nobody edits
 * production thinking it's staging. Production gets a hatched red treatment,
 * and the tab title and favicon can be marked too, because that's where
 * people actually look when they have six admin tabs open.
 */
export function EnvironmentBadge({
  env,
  fallback = "staging",
  labels,
  envSuffix = "environment",
  unknownMessage = "Unrecognised environment, so treat it as live",
  variant = "strip",
  message,
  detail,
  prefixTitle = false,
  markFavicon = false,
  className,
  ...props
}: EnvironmentBadgeProps) {
  const environment = normalizeEnvironment(env, fallback)
  const { short, icon: Icon, className: tone } = config[environment]
  const known = matchEnvironment(env) !== undefined
  const label = known ? (labels?.[environment] ?? config[environment].label) : env.trim()
  useTitlePrefix(environment, prefixTitle)
  useFaviconBand(environment, markFavicon)
  const name = <span className="sr-only">{`${label} ${envSuffix}`}</span>

  if (variant === "badge") {
    return (
      <span
        data-slot="environment-badge"
        data-env={environment}
        className={cn("inline-flex h-6 items-center gap-1 rounded-full px-2.5 text-xs font-semibold tracking-wide", tone, className)}
        {...(props as React.ComponentProps<"span">)}
      >
        <Icon aria-hidden className="size-3.5" />
        <span aria-hidden>{short}</span>
        {name}
      </span>
    )
  }

  if (variant === "ribbon") {
    return (
      <div
        data-slot="environment-badge"
        data-env={environment}
        className={cn("pointer-events-none absolute top-0 right-0 size-24 overflow-hidden", className)}
        {...props}
      >
        <span className={cn("absolute top-5 -right-10 w-40 rotate-45 py-1 text-center text-xs font-bold tracking-widest shadow-md", tone)}>
          <span aria-hidden>{short}</span>
          {name}
        </span>
      </div>
    )
  }

  return (
    <div
      data-slot="environment-badge"
      data-env={environment}
      className={cn(
        "flex min-h-11 w-full flex-wrap items-center justify-center gap-x-2 gap-y-0.5 px-4 py-1.5 text-center text-sm",
        tone,
        className,
      )}
      {...props}
    >
      <Icon aria-hidden className="size-4 shrink-0" />
      <span className="font-semibold tracking-wider uppercase">{label}</span>
      <span aria-hidden className="hidden opacity-70 sm:inline">
        ·
      </span>
      <span>{message ?? (known ? defaultMessages[environment] : unknownMessage)}</span>
      {detail && <span className="hidden font-mono text-xs opacity-80 sm:inline">{detail}</span>}
    </div>
  )
}

export interface UseEnvironmentGuardOptions {
  /** The environment the app is running in. */
  env: string
  /** How to treat an unknown name; see `normalizeEnvironment`. */
  fallback?: Environment
  /** Display names per environment, used in the dialog. */
  labels?: Partial<Record<Environment, string>>
  /** Environments that need confirmation before an action runs. */
  confirmIn?: Environment | Environment[]
  /** Dialog copy; `{action}` and `{env}` are filled in. */
  title?: string
  description?: string
  cancelLabel?: string
  confirmLabel?: string
}

/**
 * Wraps actions so they ask for confirmation only in the environments you
 * name (production by default) and run instantly everywhere else. Render the
 * returned `dialog` once; call `guard(label, fn)` to get a guarded handler.
 */
export function useEnvironmentGuard({
  env,
  fallback = "staging",
  labels,
  confirmIn = "production",
  title = "{action} in {env}?",
  description = "This runs against live data and affects real customers right away.",
  cancelLabel = "Cancel",
  confirmLabel = "Yes, run in {env}",
}: UseEnvironmentGuardOptions) {
  const environment = normalizeEnvironment(env, fallback)
  const needsConfirm = ([] as Environment[]).concat(confirmIn).includes(environment)
  const [pending, setPending] = React.useState<{ run: () => void; label: string } | null>(null)
  const ref = React.useRef<HTMLDialogElement>(null)
  const titleId = React.useId()

  React.useEffect(() => {
    const dialog = ref.current
    if (pending && dialog && !dialog.open) dialog.showModal()
    if (!pending && dialog?.open) dialog.close()
  }, [pending])

  const guard = React.useCallback(
    <Args extends unknown[]>(label: string, action: (...args: Args) => void) =>
      (...args: Args) => {
        if (!needsConfirm) return action(...args)
        setPending({ label, run: () => action(...args) })
      },
    [needsConfirm],
  )

  const { short, accent, className: tone } = config[environment]
  const envName = labels?.[environment] ?? config[environment].label.toLowerCase()
  const [before, after = ""] = title.replace("{action}", pending?.label ?? "").split("{env}")
  const dialog = (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={() => setPending(null)}
      onClick={(event) => event.target === event.currentTarget && setPending(null)}
      className="m-auto w-[calc(100%-2rem)] max-w-sm overflow-hidden rounded-xl border bg-popover p-0 text-popover-foreground shadow-xl backdrop:bg-black/50"
    >
      <div className={cn("px-5 py-2 text-xs font-bold tracking-widest", tone)}>{short}</div>
      <div className="space-y-4 p-5">
        <h2 id={titleId} className="font-medium">
          {before}
          {title.includes("{env}") && <span className={accent}>{envName}</span>}
          {after}
        </h2>
        <p className="text-sm text-muted-foreground">{description}</p>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            autoFocus
            onClick={() => setPending(null)}
            className="h-9 rounded-md border px-4 text-sm font-medium hover:bg-accent outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={() => {
              pending?.run()
              setPending(null)
            }}
            className="h-9 rounded-md bg-destructive px-4 text-sm font-medium text-white hover:bg-destructive/90 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            {confirmLabel.replace("{env}", envName)}
          </button>
        </div>
      </div>
    </dialog>
  )

  return { guard, dialog, needsConfirm, environment }
}
