"use client"

// Bollard UI — kube-context-guard · MIT licence · https://bollard-ui.vercel.app/components/kube-context-guard

import * as React from "react"
import { Loader2, Server, TriangleAlert } from "lucide-react"

import { cn } from "@/lib/utils"
import { checkKubeCommand, readManifests, rewriteCommand, shortCluster, type KubeContext, type KubeIssue, type ManifestObject } from "./kube"

export { checkKubeCommand, isProductionName, parseKubeCommand, readManifests, rewriteCommand, shellWords, shortCluster, type KubeCheck, type KubeCommand, type KubeContext, type KubeIssue, type ManifestObject } from "./kube"

/** Every visible string. `{context}`, `{cluster}`, `{namespace}`, `{from}`, `{to}`, `{manifest}`, `{target}`, `{current}`, `{path}` are filled in. */
export const KUBE_CONTEXT_MESSAGES = {
  context: "Context",
  namespace: "Namespace",
  prod: "Production",
  overrides: "--context in the command overrides your current context, {current}.",
  commandLabel: "Command",
  production: "This changes production ({context}).",
  dryRun: "Dry run first",
  contextChanged: "Context changed since your last command: was {from}, now {to}.",
  useContext: "Use {from}",
  defaultNamespace: "This deploys into the default namespace.",
  useNamespace: "Use {namespace}",
  mismatchKubectl: "The manifest says {manifest} but the command says {target}. kubectl will refuse this.",
  mismatchHelm: "Helm will create these objects in {manifest} but record the release in {target}.",
  elsewhere: "Objects land in {manifest} (set in the manifest), not {target}.",
  makeExplicit: "Add -n {manifest}",
  otherKubeconfig: "This reads the kubeconfig at {path}, so the context shown here may not be the one it uses.",
  typeLabel: "Type {context} to run on production",
  run: "Run on {context}",
  pending: "Running…",
  found: "{count} things to check before running.",
}

export type KubeContextMessages = typeof KUBE_CONTEXT_MESSAGES

const fill = (template: string, values: Record<string, string | number>) =>
  template.replace(/\{(\w+)\}/g, (match, key: string) => String(values[key] ?? match))

export interface KubeContextGuardProps extends Omit<React.ComponentProps<"div">, "children"> {
  /** The current kubeconfig context. */
  context: KubeContext
  /** Other contexts, so a --context flag can be shown with its cluster and namespace. */
  contexts?: KubeContext[]
  /** Controlled command. */
  value?: string
  /** Initial command when uncontrolled. */
  defaultValue?: string
  /** Called with the command on every change, including one-tap fixes. */
  onValueChange?: (command: string) => void
  /** Objects being applied, or their YAML. */
  manifests?: ManifestObject[] | string
  /** Where the previous command ran, to catch a context switched in between. */
  lastRun?: { context: string; namespace?: string }
  /** Namespace to suggest instead of "default". */
  expectedNamespace?: string
  /** Your own production test. Defaults to reading context and cluster names word by word. */
  isProduction?: (context: KubeContext) => boolean
  /** Ask for the context name before a production change. */
  confirmProduction?: boolean
  /** Pause in ms before warnings refresh while typing. */
  delay?: number
  /** Called on Run. May return a Promise; shows a pending state and ignores repeat clicks. */
  onRun?: (command: string) => void | Promise<void>
  /** Any visible string. */
  messages?: Partial<KubeContextMessages>
}

/**
 * Stops kubectl and helm commands landing on the wrong cluster or namespace. It shows the context, cluster and
 * namespace the command will really use (a --context flag included) and flags production, a deploy into "default",
 * a manifest namespace that disagrees with -n (which kubectl refuses and helm silently splits), and a context that
 * changed since the last command, each with a one-tap fix.
 */
export function KubeContextGuard({
  context: current,
  contexts,
  value,
  defaultValue = "",
  onValueChange,
  manifests,
  lastRun,
  expectedNamespace,
  isProduction,
  confirmProduction = true,
  delay = 400,
  onRun,
  messages,
  className,
  ...props
}: KubeContextGuardProps) {
  const t = { ...KUBE_CONTEXT_MESSAGES, ...messages }
  const [inner, setInner] = React.useState(defaultValue)
  const command = typeof (value ?? inner) === "string" ? (value ?? inner) : ""
  const [settled, setSettled] = React.useState(command)
  const [typed, setTyped] = React.useState("")
  const [pending, setPending] = React.useState(false)
  const [status, setStatus] = React.useState("")
  const busy = React.useRef(false)
  const rootRef = React.useRef<HTMLDivElement>(null)
  const inputRef = React.useRef<HTMLInputElement>(null)
  const id = React.useId()

  React.useEffect(() => {
    const timer = setTimeout(() => setSettled(command), delay)
    return () => clearTimeout(timer)
  }, [command, delay])

  const objects = typeof manifests === "string" ? readManifests(manifests) : manifests ?? []
  const check = checkKubeCommand({ command: settled, current, contexts, manifests: objects, last: lastRun, isProduction })
  const live = checkKubeCommand({ command, current, contexts, manifests: objects, last: lastRun, isProduction })
  const ctx = live.context
  const values = { context: ctx.name, cluster: shortCluster(ctx.cluster ?? ctx.name), namespace: live.namespace, current: current?.name ?? "" }
  const needsTyping = confirmProduction && live.production && live.command.mutating
  const ready = !!command.trim() && (!needsTyping || typed.trim() === ctx.name)

  // Typing the context name is a yes to that context only.
  React.useEffect(() => setTyped(""), [ctx.name])

  React.useEffect(() => {
    setStatus(check.issues.length ? fill(t.found, { count: check.issues.length }) : "")
  }, [check.issues.length, t.found])

  const setCommand = (next: string, focusIndex?: number) => {
    if (value === undefined) setInner(next)
    setSettled(next)
    onValueChange?.(next)
    if (focusIndex === undefined) return
    requestAnimationFrame(() => {
      const fixes = rootRef.current?.querySelectorAll<HTMLElement>("[data-fix]")
      ;(fixes?.[Math.min(focusIndex, (fixes?.length ?? 1) - 1)] ?? inputRef.current)?.focus()
    })
  }

  const suggestNs = expectedNamespace || objects.find((o) => o.namespace)?.namespace
  const describe = (issue: KubeIssue): { text: string; fix?: { label: string; apply: () => string } } => {
    switch (issue.kind) {
      case "production":
        return { text: fill(t.production, values), fix: { label: t.dryRun, apply: () => rewriteCommand(command, { dryRun: true }) } }
      case "context-changed":
        return { text: fill(t.contextChanged, issue), fix: { label: fill(t.useContext, issue), apply: () => rewriteCommand(command, { context: issue.from }) } }
      case "default-namespace":
        return { text: t.defaultNamespace, fix: suggestNs ? { label: fill(t.useNamespace, { namespace: suggestNs }), apply: () => rewriteCommand(command, { namespace: suggestNs }) } : undefined }
      case "namespace-mismatch":
        return { text: fill(issue.tool === "helm" ? t.mismatchHelm : t.mismatchKubectl, issue), fix: { label: fill(t.useNamespace, { namespace: issue.manifest }), apply: () => rewriteCommand(command, { namespace: issue.manifest }) } }
      case "manifest-elsewhere":
        return { text: fill(t.elsewhere, issue), fix: { label: fill(t.makeExplicit, issue), apply: () => rewriteCommand(command, { namespace: issue.manifest }) } }
      case "other-kubeconfig":
        return { text: fill(t.otherKubeconfig, issue) }
    }
  }

  const run = async () => {
    if (!ready || busy.current || !onRun) return
    busy.current = true
    setPending(true)
    try {
      await onRun(command)
    } catch {
      // The caller reports command failures; the button becomes usable again.
    } finally {
      busy.current = false
      setPending(false)
    }
  }

  const field = "h-9 w-full min-w-0 rounded-md border bg-transparent px-3 font-mono text-base shadow-xs outline-none transition-[color,box-shadow] placeholder:text-muted-foreground/60 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 md:text-sm dark:bg-input/30"

  return (
    <div ref={rootRef} data-slot="kube-context-guard" data-production={live.production ? "" : undefined} className={cn("w-full max-w-lg overflow-hidden rounded-xl border bg-background text-sm", className)} {...props}>
      <div
        id={`${id}-target`}
        className={cn(
          "space-y-1 border-b px-4 py-3",
          live.production ? "border-red-500/40 bg-[repeating-linear-gradient(135deg,rgb(239_68_68/0.12)_0_8px,transparent_8px_16px)]" : "bg-muted/40",
        )}
      >
        <div className="flex flex-wrap items-center gap-2">
          <Server aria-hidden className={cn("size-4 shrink-0", live.production ? "text-red-700 dark:text-red-400" : "text-muted-foreground")} />
          <span className="min-w-0 flex-1 text-base font-semibold [overflow-wrap:anywhere]">{values.cluster || "—"}</span>
          {live.production && <span className="rounded-md bg-red-700 px-1.5 py-0.5 text-xs font-semibold tracking-wide text-white uppercase dark:bg-red-500 dark:text-red-950">{t.prod}</span>}
        </div>
        <dl className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
          <div className="flex min-w-0 gap-1"><dt className="text-muted-foreground">{t.context}</dt><dd className="min-w-0 font-mono [overflow-wrap:anywhere]">{ctx.name || "—"}</dd></div>
          <div className="flex min-w-0 gap-1">
            <dt className="text-muted-foreground">{t.namespace}</dt>
            <dd className={cn("min-w-0 font-mono [overflow-wrap:anywhere]", live.namespace === "default" && "font-semibold text-amber-800 dark:text-amber-300")}>{live.command.allNamespaces ? "*" : live.namespace}</dd>
          </div>
        </dl>
        {live.command.context && live.command.context !== current?.name && <p className="text-xs text-muted-foreground">{fill(t.overrides, values)}</p>}
      </div>

      <div className="space-y-3 px-4 py-3">
        <div className="grid gap-1.5">
          <label htmlFor={`${id}-cmd`} className="font-medium">{t.commandLabel}</label>
          <input
            ref={inputRef}
            id={`${id}-cmd`}
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            aria-describedby={[`${id}-target`, check.issues.length ? `${id}-issues` : ""].filter(Boolean).join(" ")}
            className={field}
          />
        </div>

        {check.issues.length > 0 && (
          <ul id={`${id}-issues`} className="space-y-1.5">
            {check.issues.map((issue, i) => {
              const { text, fix } = describe(issue)
              const red = issue.kind === "production" || issue.kind === "context-changed" || issue.kind === "other-kubeconfig" || (issue.kind === "namespace-mismatch" && issue.tool === "helm")
              return (
                <li key={`${issue.kind}-${i}`} className={cn("flex flex-wrap items-start gap-x-2 gap-y-1 text-xs", red ? "text-red-800 dark:text-red-300" : "text-amber-800 dark:text-amber-300")}>
                  <span className="flex min-w-0 flex-1 basis-56 gap-1.5"><TriangleAlert aria-hidden className="mt-0.5 size-3.5 shrink-0" /><span className="min-w-0 break-words">{text}</span></span>
                  {fix && (
                    <button type="button" data-fix onClick={() => setCommand(fix.apply(), i)} className="inline-flex h-6 shrink-0 items-center rounded-md border border-current/25 px-2 text-xs font-medium outline-none transition-colors hover:bg-current/10 focus-visible:ring-[3px] focus-visible:ring-ring/50">
                      {fix.label}
                    </button>
                  )}
                </li>
              )
            })}
          </ul>
        )}

        {needsTyping && (
          <div className="grid gap-1.5">
            <label htmlFor={`${id}-type`} className="font-medium [overflow-wrap:anywhere]">{fill(t.typeLabel, values)}</label>
            <input id={`${id}-type`} value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" spellCheck={false} placeholder={ctx.name} className={field} />
          </div>
        )}
      </div>

      <span role="status" className="sr-only">{status}</span>
      {onRun && (
        <div className="flex justify-end border-t px-4 py-3">
          <button
            type="button"
            onClick={run}
            disabled={!ready || pending}
            aria-describedby={`${id}-target`}
            className={cn(
              "inline-flex h-9 max-w-full items-center gap-2 rounded-md px-4 text-sm font-medium outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50",
              live.production && live.command.mutating ? "bg-destructive text-white hover:bg-destructive/90" : "bg-primary text-primary-foreground hover:bg-primary/90",
            )}
          >
            {pending && <Loader2 aria-hidden className="size-4 shrink-0 animate-spin" />}
            <span className="truncate">{pending ? t.pending : fill(t.run, values)}</span>
          </button>
        </div>
      )}
    </div>
  )
}
