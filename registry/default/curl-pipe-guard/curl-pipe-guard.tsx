"use client"

// Bollard UI — curl-pipe-guard · MIT licence · https://bollard-ui.vercel.app/components/curl-pipe-guard

import * as React from "react"
import { Check, CircleAlert, Copy, Info, Loader2, Lock, LockOpen, Play, ShieldCheck, Terminal, TriangleAlert } from "lucide-react"

import { cn } from "@/lib/utils"
import { codeHostSource, parsePipeInstall, registrableDomain, reviewPipeInstall, safeInstallSteps, type PipeIssueKind, type PipeReviewOptions } from "./curl-pipe"

export { codeHostSource, isIpHost, parsePipeInstall, registrableDomain, reviewPipeInstall, safeInstallSteps, type PipeInstall, type PipeIssue, type PipeIssueKind, type PipeReviewOptions } from "./curl-pipe"

/** Every visible string. `{host}`, `{docs}`, `{site}`, `{repo}`, `{runner}` are filled in. */
export const CURL_PIPE_MESSAGES = {
  title: "Install command",
  runsFrom: "Runs a script from",
  matchesDocs: "Same site as the {docs} docs",
  noHost: "No host found",
  http: "Plain http: anyone on the network (café Wi-Fi, a proxy) can swap the script on its way to your shell.",
  "implied-http": "No https:// in the URL, so {fetcher} fetches it over plain http, where it can be swapped on the way.",
  ip: "A raw IP address instead of a domain. There's no name to check against the product, and no certificate tying it to them.",
  shortener: "A shortened link. You can't see where the script really comes from, and the link can be repointed at any time.",
  "other-domain": "{host} isn't {docs}, where the docs live. Check that the docs really point here.",
  "code-host": "Hosted on {site} under {repo}, not on {docs}. Anyone can publish there; check it's the product's own repo.",
  sudo: "Runs as root. Everything in the script can change any file on this machine.",
  insecure: "Certificate checks are off (-k / --insecure), so a fake server would be accepted.",
  "no-checksum": "The docs give no checksum or signature, so you can't confirm the script is the one they published.",
  "no-fail": "Without -f, an error page (404, 500) is fed to {runner} as if it were the script.",
  unparsed: "This isn't a download piped into a shell, so there's nothing to check here.",
  oneLine: "One line",
  steps: "Download, inspect, run",
  stepsHint: "Saves the script first, so a dropped connection can't run half of it and the server can't send a different script to a pipe than to a file. Read it in the pager (q to quit), then run it.",
  upgraded: "Switched to https in the steps. If the download fails, the host doesn't serve https.",
  copy: "Copy",
  copyAnyway: "Copy anyway",
  confirmHint: "Tap again to copy the one-liner with these risks.",
  copied: "Copied",
  copiedStatus: "Copied to the clipboard.",
  copyFailed: "Couldn't reach the clipboard. Select the text and copy it.",
  run: "Run",
  runAnyway: "Run anyway",
  running: "Running…",
  modeLabel: "How to copy it",
}
export type CurlPipeMessages = typeof CURL_PIPE_MESSAGES
export type CurlPipeMode = "one-line" | "steps"

const fill = (template: string, values: Record<string, string | number>) => template.replace(/\{(\w+)\}/g, (match, key: string) => String(values[key] ?? match))
const tone = {
  danger: "text-red-700 dark:text-red-400",
  warning: "text-amber-800 dark:text-amber-300",
  info: "text-muted-foreground",
}
// `. <(curl …)` reads best as "source".
const runnerName = (runner?: string) => (!runner ? "sh" : runner === "." ? "source" : runner)
const icons = { danger: CircleAlert, warning: TriangleAlert, info: Info }
const button = "inline-flex h-8 items-center justify-center gap-1.5 rounded-md px-3 text-sm font-medium outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50"

export interface CurlPipeGuardProps extends PipeReviewOptions, Omit<React.ComponentProps<"div">, "onCopy"> {
  /** The install one-liner as the docs show it, e.g. `curl -fsSL https://bun.sh/install | bash`. */
  command: string
  /** Controlled copy mode. */
  mode?: CurlPipeMode
  /** Initial mode when uncontrolled. Defaults to the safer steps whenever something is flagged. */
  defaultMode?: CurlPipeMode
  /** Called when the user switches between the one-liner and the steps. */
  onModeChange?: (mode: CurlPipeMode) => void
  /** Called after a successful copy with exactly what was copied. */
  onCopy?: (text: string, mode: CurlPipeMode) => void
  /** Shows a Run button (for terminals and IDEs). May return a Promise; the button shows a pending state and ignores repeat clicks. */
  onRun?: (text: string, mode: CurlPipeMode) => void | Promise<void>
  /** Any visible string. */
  messages?: Partial<CurlPipeMessages>
}

/**
 * Prevents running an install script from somewhere you didn't mean to trust. Before a `curl … | sh` (or wget, or
 * `iwr | iex`) is copied or run it shows the script's real host, flags plain http, raw IPs, shortened links, a host that
 * isn't the product's docs domain, sudo, -k/--insecure, a missing checksum and a missing -f, and offers the same install
 * as "download, inspect, then run" steps to copy instead. Risky one-liners need a second tap.
 */
export function CurlPipeGuard({
  command,
  docsDomain,
  checksum,
  verify,
  trustedSources,
  mode,
  defaultMode,
  onModeChange,
  onCopy,
  onRun,
  messages,
  className,
  ...props
}: CurlPipeGuardProps) {
  const t = { ...CURL_PIPE_MESSAGES, ...messages }
  const install = React.useMemo(() => parsePipeInstall(command), [command])
  const issues = React.useMemo(() => reviewPipeInstall(install, { docsDomain, checksum, verify, trustedSources }), [install, docsDomain, checksum, verify, trustedSources])
  const risky = issues.some((i) => i.severity !== "info") && !!install
  const [innerMode, setInnerMode] = React.useState<CurlPipeMode>(defaultMode ?? (risky ? "steps" : "one-line"))
  const current = install ? (mode ?? innerMode) : "one-line"
  const [armed, setArmed] = React.useState<"copy" | "run" | null>(null)
  const [copied, setCopied] = React.useState(false)
  const [pending, setPending] = React.useState(false)
  const [status, setStatus] = React.useState("")
  const busy = React.useRef(false)
  const id = React.useId()

  const steps = install ? safeInstallSteps(install, { checksum, verify }) : []
  const text = current === "steps" ? steps.join("\n") : String(command ?? "").replace(/^\uFEFF/, "").trim()
  const source = install ? codeHostSource(install.url) : null
  const docs = docsDomain ? registrableDomain(docsDomain.replace(/^https?:\/\//i, "").split("/")[0]) : ""
  const values = { host: install?.host ?? "", docs, site: source?.site ?? "", repo: source?.repo ?? "", runner: runnerName(install?.runner), fetcher: install?.fetcher ?? "curl" }
  const sameSite = !!docs && !!install?.host && registrableDomain(install.host) === docs
  const needsSecondTap = current === "one-line" && risky

  // A new command or mode is a new decision: disarm any half-confirmed copy.
  React.useEffect(() => setArmed(null), [command, current])
  React.useEffect(() => {
    if (!armed) return
    const timer = setTimeout(() => setArmed(null), 5000)
    return () => clearTimeout(timer)
  }, [armed])

  const describe = (action: "copy" | "run") => [issues.length > 0 && `${id}-issues`, armed === action && `${id}-armed`].filter(Boolean).join(" ") || undefined
  const choose = (next: CurlPipeMode) => {
    if (mode === undefined) setInnerMode(next)
    onModeChange?.(next)
  }
  const copy = async () => {
    if (needsSecondTap && armed !== "copy") return setArmed("copy")
    setArmed(null)
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setStatus(t.copiedStatus)
      onCopy?.(text, current)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      setStatus(t.copyFailed)
    }
  }
  const run = async () => {
    if (!onRun || busy.current) return
    if (needsSecondTap && armed !== "run") return setArmed("run")
    setArmed(null)
    busy.current = true
    setPending(true)
    try {
      await onRun(text, current)
    } catch {
      // The caller reports run failures; the button becomes usable again.
    } finally {
      busy.current = false
      setPending(false)
    }
  }

  return (
    <div data-slot="curl-pipe-guard" data-risk={risky ? "risky" : "ok"} className={cn("w-full max-w-lg min-w-0 overflow-hidden rounded-xl border bg-background text-sm", className)} {...props}>
      <div className="flex items-center gap-2 border-b px-4 py-3">
        <Terminal aria-hidden className="size-4 shrink-0 text-muted-foreground" />
        <h3 id={`${id}-title`} className="min-w-0 flex-1 font-medium">{t.title}</h3>
        {install && <span className="rounded-md border px-1.5 py-0.5 font-mono text-xs text-muted-foreground">{install.platform === "powershell" ? "PowerShell" : runnerName(install.runner)}</span>}
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-3 px-4 py-3">
        {install?.host && (
          <div className="grid gap-0.5">
            <span className="text-xs text-muted-foreground">{t.runsFrom}</span>
            <span className="flex min-w-0 items-center gap-1.5">
              {install.scheme === "https" && !install.impliedHttp ? <Lock aria-hidden className="size-4 shrink-0 text-muted-foreground" /> : <LockOpen aria-hidden className="size-4 shrink-0 text-red-600 dark:text-red-400" />}
              <strong className="min-w-0 font-mono text-base font-semibold [overflow-wrap:anywhere]">{install.host}</strong>
            </span>
            <span className="font-mono text-xs text-muted-foreground [overflow-wrap:anywhere]">{install.url}</span>
            {sameSite && (
              <span className="mt-0.5 flex items-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-400">
                <ShieldCheck aria-hidden className="size-3.5" />
                {fill(t.matchesDocs, values)}
              </span>
            )}
          </div>
        )}

        {issues.length > 0 && (
          <ul id={`${id}-issues`} className="grid gap-1.5">
            {issues.map((issue) => {
              const Icon = icons[issue.severity]
              return (
                <li key={issue.kind} data-kind={issue.kind} className={cn("flex gap-1.5 text-xs", tone[issue.severity])}>
                  <Icon aria-hidden className="mt-0.5 size-3.5 shrink-0" />
                  <span className="min-w-0 [overflow-wrap:anywhere]">{fill(t[issue.kind as PipeIssueKind], values)}</span>
                </li>
              )
            })}
          </ul>
        )}

        {install && (
          <div role="radiogroup" aria-label={t.modeLabel} className="grid grid-cols-2 gap-1 rounded-md bg-muted p-1">
            {(["one-line", "steps"] as const).map((m) => (
              <button
                key={m}
                type="button"
                role="radio"
                aria-checked={current === m}
                tabIndex={current === m ? 0 : -1}
                onClick={() => choose(m)}
                onKeyDown={(e) => {
                  if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) return
                  e.preventDefault()
                  const next = m === "one-line" ? "steps" : "one-line"
                  choose(next)
                  ;(e.currentTarget.parentElement?.querySelector(`[data-mode="${next}"]`) as HTMLElement | null)?.focus()
                }}
                data-mode={m}
                className={cn("min-h-8 rounded-[5px] px-2 py-1 text-xs font-medium outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50", current === m ? "bg-background text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground")}
              >
                {m === "one-line" ? t.oneLine : t.steps}
              </button>
            ))}
          </div>
        )}

        <pre className="overflow-x-auto rounded-md bg-muted px-3 py-2 font-mono text-xs leading-5 whitespace-pre-wrap [overflow-wrap:anywhere]">
          {current === "steps" ? steps.map((line, i) => <div key={i}>{line}</div>) : text}
        </pre>
        {current === "steps" && (
          <p className="-mt-1.5 text-xs text-muted-foreground">
            {t.stepsHint}
            {install && (install.scheme === "http" || install.impliedHttp) && ` ${t.upgraded}`}
          </p>
        )}
        {armed && <p id={`${id}-armed`} className="-mt-1.5 flex gap-1.5 text-xs font-medium text-red-700 dark:text-red-400"><TriangleAlert aria-hidden className="mt-0.5 size-3.5 shrink-0" />{t.confirmHint}</p>}
      </div>

      <span role="status" className="sr-only">{status}</span>
      <div className="flex flex-wrap justify-end gap-2 border-t px-4 py-3">
        {onRun && install && (
          <button type="button" onClick={run} disabled={pending} aria-busy={pending || undefined} aria-describedby={describe("run")} className={cn(button, "border bg-background hover:bg-accent", armed === "run" && "border-red-500/50 text-red-700 dark:text-red-400")}>
            {pending ? <Loader2 aria-hidden className="size-4 animate-spin" /> : <Play aria-hidden className="size-4" />}
            {pending ? t.running : armed === "run" ? t.runAnyway : t.run}
          </button>
        )}
        <button type="button" onClick={copy} aria-describedby={describe("copy")} className={cn(button, armed === "copy" ? "bg-destructive text-white hover:bg-destructive/90" : "bg-primary text-primary-foreground hover:bg-primary/90")}>
          {copied ? <Check aria-hidden className="size-4" /> : <Copy aria-hidden className="size-4" />}
          {copied ? t.copied : armed === "copy" ? t.copyAnyway : t.copy}
        </button>
      </div>
    </div>
  )
}
