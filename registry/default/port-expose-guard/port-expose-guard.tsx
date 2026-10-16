"use client"

import * as React from "react"
import { ArrowRight, Globe, Info, Loader2, Lock, ShieldAlert, TriangleAlert } from "lucide-react"

import { cn } from "@/lib/utils"
import { bindAddressFor, checkPorts, fixPort, reachOf, type CheckPortsOptions, type PortFinding, type PortMapping } from "./ports"

export { bindAddressFor, checkPorts, detectSource, fixPort, imageName, IMAGE_PORTS, isAllInterfaces, isLoopback, isVariable, parsePortSpec, reachOf, resolveVar, SENSITIVE_PORTS, sexagesimal, type CheckPortsOptions, type PortFinding, type PortMapping, type PortReport, type PortSource } from "./ports"

/** Every visible string. `{what}`, `{port}`, `{type}`, `{expected}`, `{raw}`, `{parsed}`, `{ip}`, `{node}` and `{count}` are filled in. */
export const PORT_EXPOSE_MESSAGES = {
  label: "Ports",
  placeholder: "docker run -p …, a compose file, or a Kubernetes Service",
  source: { docker: "Reading docker run", compose: "Reading a compose file", k8s: "Reading a Kubernetes Service" },
  nothing: "Paste a docker run command, compose ports or a Service to see who can reach each port.",
  reach: {
    anyone: "Any network", local: "This machine only", address: "Only via {ip}", variable: "Depends on {ip}", cluster: "Inside the cluster", nodes: "Every node{node}",
    internet: "Public load balancer", internal: "Private load balancer", ranges: "Load balancer, allowed ranges", host: "Host network",
  },
  exposed: "{what} on port {port} is open on every network interface. Docker publishes it ahead of ufw, so a firewall deny rule won't block it.",
  hostNetwork: "Host networking ignores the port list: every port the app opens sits on the host's own interfaces, with no isolation.",
  publishAll: "-P publishes every port the image declares, on random host ports, on every interface.",
  serviceNodes: "{what} is a NodePort Service, so it answers on every node's IP. Internal services usually want ClusterIP.",
  serviceInternet: "{what} gets a public cloud load balancer. Internal services usually want ClusterIP or an internal load balancer.",
  mismatch: "This image listens on {expected}, but traffic goes to container port {port}, so connections will be refused.",
  base60: "Unquoted, YAML reads {raw} as the number {parsed}. Quote port mappings.",
  bind: "Bind to {ip}",
  clusterIp: "Make it ClusterIP",
  usePort: "Use {expected}",
  quote: "Add quotes",
  keep: "Keep",
  summary: "{count} to check",
  summaryOne: "1 to check",
  clear: "Nothing exposed by mistake",
  oldEngine: "On Docker Engine older than 28, other machines on the same local network can still reach ports bound to 127.0.0.1. Upgrade Docker or firewall the host.",
  fixed: "Fixed. {count} left.",
  apply: "Apply",
  applyAnyway: "Apply anyway",
}

export type PortExposeMessages = Omit<typeof PORT_EXPOSE_MESSAGES, "source" | "reach"> & { source: Record<keyof typeof PORT_EXPOSE_MESSAGES.source, string>; reach: Record<keyof typeof PORT_EXPOSE_MESSAGES.reach, string> }

const fill = (template: string, values: Record<string, string | number>) =>
  template.replace(/\{(\w+)\}/g, (match, key: string) => String(values[key] ?? match))

const keyOf = (f: PortFinding) => `${f.kind}:${"mapping" in f ? `${f.mapping.service ?? ""}:${f.mapping.raw}` : f.span.start}`
const danger = (f: PortFinding) => f.kind === "exposed" || f.kind === "serviceType" || f.kind === "hostNetwork"

export interface PortExposeGuardProps extends Omit<React.ComponentProps<"textarea">, "value" | "defaultValue" | "onChange"> {
  /** Visible label. */
  label?: string
  /** Controlled config text. */
  value?: string
  /** Initial text when uncontrolled. */
  defaultValue?: string
  /** Called with the text on every edit and one-tap fix. */
  onValueChange?: (text: string) => void
  /** Ports your own images listen on, keyed by image or Service name, for the mismatch check. */
  listening?: CheckPortsOptions["listening"]
  /** Extra sensitive ports, e.g. `{ 9000: "the MinIO API" }`. */
  sensitivePorts?: CheckPortsOptions["sensitivePorts"]
  /** Docker Engine version on the host, e.g. "27.5.1". Below 28 (or unknown) a note says 127.0.0.1 binds are reachable from the LAN. */
  dockerVersion?: string
  /** Pause in ms before the readback refreshes while typing. */
  delay?: number
  /** Called on Apply. With findings left, the first click jumps to them and the second applies. May return a Promise. */
  onApply?: (text: string) => void | Promise<void>
  /** Any visible string; `source` and `reach` may be partial. */
  messages?: Partial<Omit<PortExposeMessages, "source" | "reach">> & { source?: Partial<PortExposeMessages["source"]>; reach?: Partial<PortExposeMessages["reach"]> }
  /** Class for the outer wrapper. */
  className?: string
}

/**
 * Stops a database or admin port being published to the whole internet by accident. It reads a
 * docker run command, compose `ports:` or a Kubernetes Service back as "who can reach this", flags
 * databases bound to 0.0.0.0 (which Docker opens ahead of ufw), host networking, `-P`, NodePort or
 * public LoadBalancer for internal services, a container port the image doesn't listen on and
 * unquoted `22:22` that YAML reads as 1342, and fixes each in one tap.
 */
export function PortExposeGuard({
  label,
  value,
  defaultValue = "",
  onValueChange,
  listening,
  sensitivePorts,
  dockerVersion,
  delay = 500,
  onApply,
  messages,
  className,
  id,
  rows = 7,
  onBlur,
  ref,
  "aria-describedby": describedBy,
  ...props
}: PortExposeGuardProps) {
  const t = { ...PORT_EXPOSE_MESSAGES, ...messages, source: { ...PORT_EXPOSE_MESSAGES.source, ...messages?.source }, reach: { ...PORT_EXPOSE_MESSAGES.reach, ...messages?.reach } }
  const [inner, setInner] = React.useState(defaultValue)
  const text = typeof (value ?? inner) === "string" ? (value ?? inner) : ""
  const [settled, setSettled] = React.useState(text)
  const [kept, setKept] = React.useState<Set<string>>(() => new Set())
  const [announcement, setAnnouncement] = React.useState("")
  const [asked, setAsked] = React.useState(false)
  const [pending, setPending] = React.useState(false)
  const fieldRef = React.useRef<HTMLTextAreaElement>(null)
  const panelRef = React.useRef<HTMLDivElement>(null)
  const actedAt = React.useRef(0)
  const autoId = React.useId()
  const fieldId = id ?? autoId
  const readbackId = `${fieldId}-readback`

  React.useImperativeHandle(ref, () => fieldRef.current as HTMLTextAreaElement)
  React.useEffect(() => {
    const timer = setTimeout(() => setSettled(text), delay)
    return () => clearTimeout(timer)
  }, [text, delay])

  const report = React.useMemo(() => checkPorts(settled, { listening, sensitivePorts }), [settled, listening, sensitivePorts])
  const findings = report.findings.filter((f) => !kept.has(keyOf(f)))
  const hostNet = report.findings.some((f) => f.kind === "hostNetwork")
  const summary = report.source ? (findings.length ? (findings.length === 1 ? t.summaryOne : fill(t.summary, { count: findings.length })) : t.clear) : ""

  React.useEffect(() => {
    if (Date.now() - actedAt.current > 600) setAnnouncement(summary)
  }, [summary])

  const commit = (next: string) => {
    if (value === undefined) setInner(next)
    setSettled(next)
    onValueChange?.(next)
    setAsked(false)
  }

  const describe = (f: PortFinding) => {
    switch (f.kind) {
      case "exposed": return fill(t.exposed, { what: f.what, port: f.mapping.hostPort ?? f.mapping.containerPort ?? "" })
      case "hostNetwork": return t.hostNetwork
      case "publishAll": return t.publishAll
      case "serviceType": return fill(f.mapping.serviceType === "NodePort" ? t.serviceNodes : t.serviceInternet, { what: f.what })
      case "mismatch": return fill(t.mismatch, { expected: f.expected.join(", "), port: f.mapping.containerPort ?? "" })
      case "base60": return fill(t.base60, { raw: f.mapping.raw, parsed: f.parsed })
    }
  }
  const fixLabel = (f: PortFinding) =>
    f.kind === "exposed" ? fill(t.bind, { ip: bindAddressFor(f) }) : f.kind === "serviceType" ? t.clusterIp : f.kind === "mismatch" ? fill(t.usePort, { expected: f.expected[0] }) : t.quote

  /** After a fix or keep, focus the next finding's first button, else the field. */
  const focusAfter = (index: number) =>
    // Two frames: the first lets React drop the fixed row, so focus never lands on a removed button.
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const rows = panelRef.current?.querySelectorAll<HTMLElement>("[data-finding]")
      const row = rows?.[Math.min(index, rows.length - 1)]
      ;(row?.querySelector<HTMLElement>("button") ?? fieldRef.current)?.focus()
    }))

  const fix = (f: PortFinding, index: number) => {
    // Re-read the live text so a fix never lands on offsets from before the last keystroke.
    const live = checkPorts(text, { listening, sensitivePorts }).findings.find((g) => keyOf(g) === keyOf(f))
    const next = live ? fixPort(text, live) : null
    if (next === null) return setSettled(text)
    actedAt.current = Date.now()
    commit(next)
    setAnnouncement(fill(t.fixed, { count: Math.max(0, checkPorts(next, { listening, sensitivePorts }).findings.filter((g) => !kept.has(keyOf(g))).length) }))
    focusAfter(index)
  }

  const apply = async () => {
    if (findings.length && !asked) {
      setAsked(true)
      panelRef.current?.querySelector<HTMLElement>("[data-finding] button")?.focus()
      return
    }
    if (!onApply || pending) return
    setPending(true)
    try {
      await onApply(text)
    } catch {
      // The caller reports failures; the button becomes usable again.
    } finally {
      setPending(false)
    }
  }

  const flagged = new Set(findings.filter(danger).map((f) => ("mapping" in f ? f.mapping : null)))
  const reachText = (m: PortMapping) => {
    const reach = reachOf(m, hostNet && m.source === "docker")
    return { reach, label: fill(t.reach[reach], { ip: m.hostIp ?? "", node: m.nodePort ? ` :${m.nodePort}` : "" }) }
  }
  const major = Number(/^\s*v?(\d+)/.exec(dockerVersion ?? "")?.[1])
  const loopbackLan = !(major >= 28) && report.mappings.some((m) => m.source !== "k8s" && reachOf(m) === "local")
  const small = "inline-flex h-6 shrink-0 items-center rounded-md px-2 text-xs font-medium outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50"

  return (
    <div data-slot="port-expose-guard" data-state={findings.some(danger) ? "danger" : findings.length ? "warning" : "ok"} className={cn("grid w-full max-w-lg gap-1.5 text-sm", className)}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
        <label htmlFor={fieldId} className="font-medium">{label ?? t.label}</label>
        {report.source && <span className="text-xs text-muted-foreground">{t.source[report.source]}</span>}
      </div>
      <textarea
        ref={fieldRef}
        id={fieldId}
        rows={rows}
        value={text}
        spellCheck={false}
        autoCapitalize="off"
        autoComplete="off"
        placeholder={t.placeholder}
        onChange={(event) => {
          if (value === undefined) setInner(event.target.value)
          onValueChange?.(event.target.value)
          setAsked(false)
        }}
        onBlur={(event) => {
          onBlur?.(event)
          setSettled(event.target.value)
        }}
        aria-describedby={[describedBy, readbackId].filter(Boolean).join(" ")}
        data-warning={findings.length ? "" : undefined}
        className="min-h-24 w-full min-w-0 resize-y rounded-md border bg-transparent px-3 py-2 font-mono text-[13px] leading-5 shadow-xs outline-none transition-[color,box-shadow] placeholder:font-sans placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 data-warning:border-amber-500 dark:bg-input/30 dark:data-warning:border-amber-400"
        {...props}
      />
      <span aria-live="polite" className="sr-only">{announcement}</span>
      <div id={readbackId} className="mt-1.5">
        {report.mappings.length === 0 ? (
          <p className="text-xs text-muted-foreground">{t.nothing}</p>
        ) : (
          <ul className="divide-y rounded-md border text-xs">
            {report.mappings.map((m, i) => {
              const { reach, label: reachLabel } = reachText(m)
              const open = reach === "anyone" || reach === "internet" || reach === "nodes" || reach === "host"
              const bad = flagged.has(m) || (hostNet && m.source === "docker")
              return (
                <li key={`${m.raw}-${i}`} className="flex flex-wrap items-center gap-x-2 gap-y-1 px-3 py-2">
                  <span className="flex min-w-0 flex-1 basis-40 items-center gap-1.5 font-mono">
                    <span className="break-all">{m.source === "k8s" ? `:${m.hostPort}` : `${m.hostIp ?? "0.0.0.0"}:${m.hostPort ?? "random"}`}</span>
                    <ArrowRight aria-hidden className="size-3 shrink-0 text-muted-foreground" />
                    <span className="sr-only">to</span>
                    <span className="break-all">{m.service ? `${m.service}:` : ""}{m.containerPort ?? "?"}/{m.protocol}</span>
                  </span>
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium",
                      bad ? "bg-red-500/10 text-red-800 dark:text-red-300" : open ? "bg-muted text-foreground" : "bg-emerald-500/10 text-emerald-800 dark:text-emerald-300",
                    )}
                  >
                    {open ? <Globe aria-hidden className="size-3" /> : <Lock aria-hidden className="size-3" />}
                    {reachLabel}
                  </span>
                </li>
              )
            })}
          </ul>
        )}
      </div>
      {loopbackLan && t.oldEngine && (
        <p className="mt-1.5 flex gap-1.5 text-xs text-muted-foreground">
          <Info aria-hidden className="mt-0.5 size-3.5 shrink-0" />
          {t.oldEngine}
        </p>
      )}
      {report.source && (
        <p className={cn("mt-1.5 flex items-center gap-1.5 text-xs", findings.length ? "text-amber-700 dark:text-amber-400" : "text-emerald-700 dark:text-emerald-400")}>
          {findings.length ? <TriangleAlert aria-hidden className="size-3.5 shrink-0" /> : <Lock aria-hidden className="size-3.5 shrink-0" />}
          {summary}
        </p>
      )}
      {findings.length > 0 && (
        <div ref={panelRef} className="space-y-2">
          {findings.map((f, index) => {
            const tone = danger(f) ? "border-red-500/30 bg-red-500/5 text-red-800 dark:text-red-300" : "border-amber-500/30 bg-amber-500/5 text-amber-800 dark:text-amber-300"
            const canFix = fixPort(text, f) !== null
            const descId = `${fieldId}-f${index}`
            return (
              <div key={keyOf(f)} data-finding className={cn("flex gap-2 rounded-md border p-3 text-xs", tone)}>
                <ShieldAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
                <div className="min-w-0 flex-1 space-y-2">
                  <p id={descId} className="break-words">
                    {"mapping" in f && <code className="mr-1.5 rounded bg-current/10 px-1 font-mono">{f.mapping.raw}</code>}
                    {describe(f)}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {canFix && (
                      <button type="button" onClick={() => fix(f, index)} aria-describedby={descId} className={cn(small, "border border-current/30 hover:bg-current/10")}>
                        {fixLabel(f)}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setKept((k) => new Set(k).add(keyOf(f)))
                        focusAfter(index)
                      }}
                      aria-describedby={descId}
                      className={cn(small, "text-muted-foreground hover:bg-accent hover:text-foreground")}
                    >
                      {t.keep}
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
      {onApply && (
        <div className="mt-1.5 flex justify-end">
          <button
            type="button"
            onClick={apply}
            disabled={pending || !text.trim()}
            className={cn(
              "inline-flex h-9 items-center gap-2 rounded-md px-4 text-sm font-medium outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-60",
              asked && findings.length ? "bg-red-700 text-white hover:bg-red-800 dark:bg-red-400 dark:text-red-950" : "bg-primary text-primary-foreground hover:bg-primary/90",
            )}
          >
            {pending && <Loader2 aria-hidden className="size-4 animate-spin" />}
            {asked && findings.length ? t.applyAnyway : t.apply}
          </button>
        </div>
      )}
    </div>
  )
}
