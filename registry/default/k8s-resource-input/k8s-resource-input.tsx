"use client"

// Bollard UI — k8s-resource-input · MIT licence · https://bollard-ui.vercel.app/components/k8s-resource-input

import * as React from "react"
import { CircleAlert, CircleCheck, Cpu, Info, MemoryStick, TriangleAlert } from "lucide-react"

import { cn } from "@/lib/utils"
import { checkResources, describeCpu, describeMemory, parseQuantity, parseResourcesYaml, qosClass, type FieldKey, type K8sResources, type NodeCapacity, type ResourceIssue, type ResourceKind, type ResourceSide } from "@/registry/default/k8s-resource-input/k8s-quantity"

export { checkResources, cleanQuantity, describeCpu, describeMemory, formatCpu, formatMemory, parseQuantity, parseResourcesYaml, qosClass, suggestUnit, type FieldKey, type K8sResources, type NodeCapacity, type QosClass, type Quantity, type ResourceFix, type ResourceIssue, type ResourceIssueKind, type ResourceKind, type ResourcePair, type ResourceSide } from "@/registry/default/k8s-resource-input/k8s-quantity"

export const K8S_RESOURCE_INPUT_MESSAGES = {
  legend: "Container resources",
  "cpu.request": "CPU request",
  "cpu.limit": "CPU limit",
  "memory.request": "Memory request",
  "memory.limit": "Memory limit",
  cpuPlaceholder: "250m",
  memoryPlaceholder: "256Mi",
  unset: "Not set",
  copied: "Same as the limit",
  pasted: "Filled from the pasted YAML (first container only).",
  clean: "Valid. The scheduler and kubelet will read these as shown.",
  toFix: "{count} to fix",
  toNote: "{count} to note",
  use: "Use {value}",
  swap: "Swap with memory",
  "raise-limit": "Raise limit to {value}",
  "lower-request": "Lower request to {value}",
  Guaranteed: "QoS Guaranteed: requests equal limits, so it's evicted last under node pressure.",
  Burstable: "QoS Burstable: can use more than it requests, and is evicted before Guaranteed pods.",
  BestEffort: "QoS BestEffort: nothing set, so it's the first to be evicted and can use the whole node.",
  invalid: "{field}: Kubernetes can't read “{value}”, so the manifest is rejected.",
  "unit-typo": "{field}: “{value}” isn't a Kubernetes unit, so the manifest is rejected. Units are case-sensitive: Mi, Gi, M, G, k.",
  "cpu-memory-unit": "{field}: “{value}” is a memory size. CPU is in cores (1, 0.5) or millicores (500m).",
  "cpu-whole-cores": "{field}: {value} means {cores} whole cores, not millicores, so the pod waits for a node that big. Did you mean {milli} ({meant})?",
  "cpu-precision": "{field}: Kubernetes doesn't support CPU finer than 1m, so {value} is rounded up to {fixed} when it runs.",
  "memory-millibytes": "{field}: lowercase m, u and n mean milli, micro and nano, so {value} is {bytes} of memory. You probably meant {binary} or {decimal}.",
  "memory-bytes": "{field}: a number with no unit is bytes, so {value} is just {bytes}. Add a unit.",
  "limit-below-request": "{field}: the limit ({limitRead}) is below the request ({requestRead}), so the API rejects the pod.",
  "limit-below-request-units": "{field}: {limit} is less than {request}. G and M are powers of 1000, Gi and Mi of 1024, so this limit ({limitRead}) is below the request ({requestRead}) and the API rejects it.",
  "too-big-for-node": "{field}: {value} is more than your largest node has ({node}), so the pod stays Pending forever.",
  "limit-copies-request": "{field}: not set, so Kubernetes copies the limit ({limit}) and reserves all of it.",
  "no-memory-limit": "{field}: none, so this container can use all the node's memory before anything stops it.",
}
export type K8sResourceInputMessages = typeof K8S_RESOURCE_INPUT_MESSAGES

const EMPTY: K8sResources = { cpu: { request: "", limit: "" }, memory: { request: "", limit: "" } }
const FIELDS: [ResourceKind, ResourceSide][] = [["cpu", "request"], ["cpu", "limit"], ["memory", "request"], ["memory", "limit"]]
const fill = (text: string, values: Record<string, string | number>) => text.replace(/\{(\w+)\}/g, (match, key: string) => String(values[key] ?? match))
const tones = { error: "text-red-700 dark:text-red-400", warning: "text-amber-700 dark:text-amber-400", info: "text-muted-foreground" }
const icons = { error: CircleAlert, warning: TriangleAlert, info: Info }
const fixClass = (error: boolean) =>
  cn(
    "inline-flex min-h-6 items-center rounded-md border px-2 font-medium transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
    error ? "border-red-500/40 text-red-800 hover:bg-red-500/10 dark:text-red-200" : "border-amber-500/40 text-amber-900 hover:bg-amber-500/10 dark:text-amber-200",
  )

function useSettled(text: string, delay = 900) {
  const [settled, setSettled] = React.useState(text)
  React.useEffect(() => {
    const timer = setTimeout(() => setSettled(text), delay)
    return () => clearTimeout(timer)
  }, [text, delay])
  return settled
}

function normalize(value: K8sResources | undefined | null): K8sResources {
  const pick = (kind: ResourceKind, side: ResourceSide) => String(value?.[kind]?.[side] ?? "")
  return { cpu: { request: pick("cpu", "request"), limit: pick("cpu", "limit") }, memory: { request: pick("memory", "request"), limit: pick("memory", "limit") } }
}

export interface K8sResourceInputProps extends Omit<React.ComponentProps<"fieldset">, "defaultValue" | "onChange"> {
  /** Controlled requests and limits for one container. */
  value?: K8sResources
  /** Initial requests and limits when uncontrolled. */
  defaultValue?: K8sResources
  /** Called with all four values on every edit, fix or YAML paste. */
  onValueChange?: (value: K8sResources) => void
  /** Allocatable CPU and memory of your largest node; requests above it are flagged as never schedulable. */
  node?: NodeCapacity
  /** Every visible string. `{field}`, `{value}` and the other placeholders are filled in. */
  messages?: Partial<K8sResourceInputMessages>
}

/**
 * Requests and limits for a Kubernetes container that read every value back
 * in plain units and catch the unit slips the API either rejects or silently
 * accepts: 500 meaning 500 cores, 400m of memory meaning 0.4 bytes, 512MB,
 * a 1G limit under a 1Gi request, and requests no node can fit. Pasting a
 * `resources:` block fills all four fields.
 */
export function K8sResourceInput({ value, defaultValue = EMPTY, onValueChange, node, messages, className, ...props }: K8sResourceInputProps) {
  const t = { ...K8S_RESOURCE_INPUT_MESSAGES, ...messages }
  const [inner, setInner] = React.useState(() => normalize(defaultValue))
  const current = value ? normalize(value) : inner
  const [pasted, setPasted] = React.useState(false)
  const id = React.useId()
  const inputs = React.useRef<Partial<Record<FieldKey, HTMLInputElement | null>>>({})
  const list = React.useRef<HTMLUListElement>(null)
  const refocus = React.useRef<{ index: number; field: FieldKey } | null>(null)

  const update = (next: K8sResources) => {
    if (!value) setInner(next)
    onValueChange?.(next)
  }
  const setField = (key: FieldKey, text: string) => {
    const [kind, side] = key.split(".") as [ResourceKind, ResourceSide]
    setPasted(false)
    update({ ...current, [kind]: { ...current[kind], [side]: text } })
  }

  const issues = React.useMemo(() => checkResources(current, node), [current, node])
  const errors = issues.filter((issue) => issue.severity === "error").length
  const anything = FIELDS.some(([kind, side]) => current[kind][side].trim())
  const summary = !anything ? "" : errors ? [errors && fill(t.toFix, { count: errors }), issues.length - errors && fill(t.toNote, { count: issues.length - errors })].filter(Boolean).join(" · ") : t.clean
  const announced = useSettled(summary)
  const qos = qosClass(current)
  const flagged = new Set(issues.filter((issue) => issue.severity === "error").map((issue) => issue.field))

  // A fix removes its own button, so focus moves to the next fix, or back to the field it changed.
  React.useEffect(() => {
    if (!refocus.current) return
    const buttons = list.current?.querySelectorAll<HTMLButtonElement>("button[data-fix]") ?? []
    ;(buttons[Math.min(refocus.current.index, buttons.length - 1)] ?? inputs.current[refocus.current.field])?.focus()
    refocus.current = null
  })
  const applyFix = (issue: ResourceIssue, set: Partial<Record<FieldKey, string>>, button: HTMLElement) => {
    refocus.current = { index: [...(list.current?.querySelectorAll("button[data-fix]") ?? [])].indexOf(button), field: issue.field }
    const next = normalize(current)
    for (const [key, text] of Object.entries(set)) {
      const [kind, side] = key.split(".") as [ResourceKind, ResourceSide]
      next[kind][side] = text ?? ""
    }
    setPasted(false)
    update(next)
  }

  const readback = (kind: ResourceKind, side: ResourceSide) => {
    const raw = current[kind][side]
    if (!raw.trim()) return side === "request" && current[kind].limit.trim() ? t.copied : t.unset
    const quantity = parseQuantity(raw)
    if (!quantity) return ""
    return kind === "cpu" ? describeCpu(quantity.value) : describeMemory(quantity.value)
  }

  return (
    <fieldset data-slot="k8s-resource-input" className={cn("grid w-full max-w-md min-w-0 gap-3 text-sm", className)} {...props}>
      <legend className="mb-1.5 font-medium">{t.legend}</legend>
      <div className="grid grid-cols-2 gap-x-3 gap-y-3">
        {FIELDS.map(([kind, side]) => {
          const key: FieldKey = `${kind}.${side}`
          const Icon = kind === "cpu" ? Cpu : MemoryStick
          return (
            <div key={key} className="grid min-w-0 content-start gap-1.5">
              <label htmlFor={`${id}-${key}`} className="flex w-fit items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <Icon aria-hidden className="size-3.5" />
                {t[key]}
              </label>
              <input
                ref={(element) => {
                  inputs.current[key] = element
                }}
                id={`${id}-${key}`}
                value={current[kind][side]}
                onChange={(event) => setField(key, event.target.value)}
                onPaste={(event) => {
                  const yaml = parseResourcesYaml(event.clipboardData.getData("text"))
                  if (!yaml) return
                  event.preventDefault()
                  update(yaml)
                  setPasted(true)
                }}
                placeholder={kind === "cpu" ? t.cpuPlaceholder : t.memoryPlaceholder}
                spellCheck={false}
                autoCapitalize="none"
                autoCorrect="off"
                aria-invalid={flagged.has(key) || undefined}
                aria-describedby={`${id}-${key}-read`}
                className="h-9 w-full min-w-0 rounded-md border bg-transparent px-3 font-mono text-base shadow-xs transition-[color,box-shadow] outline-none placeholder:text-muted-foreground/70 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-destructive md:text-sm dark:bg-input/30"
              />
              <span id={`${id}-${key}-read`} className="min-h-4 text-xs text-muted-foreground">
                {readback(kind, side)}
              </span>
            </div>
          )
        })}
      </div>
      <span role="status" className="sr-only">
        {announced}
      </span>
      {pasted && <p className="text-xs text-muted-foreground">{t.pasted}</p>}
      {summary && (
        <p className={cn("flex items-center gap-1.5 text-xs", errors ? "text-muted-foreground" : "text-emerald-700 dark:text-emerald-400")}>
          {errors ? <TriangleAlert aria-hidden className="size-3.5 text-red-600 dark:text-red-400" /> : <CircleCheck aria-hidden className="size-3.5" />}
          {summary}
        </p>
      )}
      {issues.length > 0 && (
        <ul ref={list} className="grid gap-1.5 text-xs">
          {issues.map((issue, index) => {
            const Icon = icons[issue.severity]
            return (
              <li key={`${issue.kind}-${issue.field}-${index}`} className={cn("flex gap-1.5", tones[issue.severity])}>
                <span className="flex h-6 shrink-0 items-center">
                  <Icon aria-hidden className="size-3.5" />
                </span>
                <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="py-1">{fill(t[issue.kind], { field: t[issue.field], ...issue.detail })}</span>
                  {issue.fixes.map((fix) => (
                    <button key={`${fix.action}-${fix.label}`} type="button" data-fix="" onClick={(event) => applyFix(issue, fix.set, event.currentTarget)} className={fixClass(issue.severity === "error")}>
                      {fix.action === "swap" ? t.swap : fill(fix.action === "use" ? t.use : t[fix.action], { value: fix.label })}
                    </button>
                  ))}
                </span>
              </li>
            )
          })}
        </ul>
      )}
      {anything && <p className="rounded-md border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">{t[qos]}</p>}
    </fieldset>
  )
}
