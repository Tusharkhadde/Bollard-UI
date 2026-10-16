/**
 * Kubernetes resource quantities, read the way the API server reads them
 * (k8s.io/apimachinery resource.Quantity) and checked for the mistakes the
 * docs warn about: https://kubernetes.io/docs/concepts/configuration/manage-resources-containers/
 */

export type ResourceKind = "cpu" | "memory"
export type ResourceSide = "request" | "limit"
export interface ResourcePair {
  request: string
  limit: string
}
export interface K8sResources {
  cpu: ResourcePair
  memory: ResourcePair
}
export type FieldKey = `${ResourceKind}.${ResourceSide}`
export interface NodeCapacity {
  /** Allocatable CPU on the largest node, as a quantity ("4", "3920m"). */
  cpu?: string
  /** Allocatable memory on the largest node ("16Gi", "15843Mi"). */
  memory?: string
}

export type ResourceIssueKind =
  | "invalid"
  | "unit-typo"
  | "cpu-memory-unit"
  | "cpu-whole-cores"
  | "cpu-precision"
  | "memory-millibytes"
  | "memory-bytes"
  | "limit-below-request"
  | "limit-below-request-units"
  | "too-big-for-node"
  | "limit-copies-request"
  | "no-memory-limit"
export interface ResourceFix {
  /** What the button does, for its label: use a value, swap two fields, raise the limit or lower the request. */
  action: "use" | "swap" | "raise-limit" | "lower-request"
  /** The value the button puts in. */
  label: string
  /** Field values to set. */
  set: Partial<Record<FieldKey, string>>
}
export interface ResourceIssue {
  kind: ResourceIssueKind
  severity: "error" | "warning" | "info"
  field: FieldKey
  /** Values filled into the message template. */
  detail: Record<string, string>
  fixes: ResourceFix[]
}

const BINARY: Record<string, number> = { Ki: 2 ** 10, Mi: 2 ** 20, Gi: 2 ** 30, Ti: 2 ** 40, Pi: 2 ** 50, Ei: 2 ** 60 }
const DECIMAL: Record<string, number> = { n: 1e-9, u: 1e-6, m: 1e-3, "": 1, k: 1e3, M: 1e6, G: 1e9, T: 1e12, P: 1e15, E: 1e18 }
const QUANTITY = /^([+-]?(?:\d+(?:\.\d*)?|\.\d+))(?:([eE][+-]?\d+)|(Ki|Mi|Gi|Ti|Pi|Ei|n|u|m|k|M|G|T|P|E))?$/

export interface Quantity {
  /** Value in base units: cores for CPU, bytes for memory. */
  value: number
  number: string
  suffix: string
}

/** Strips the clutter a pasted value brings along: quotes, `cpu:` keys, spaces, CR and BOM. */
export function cleanQuantity(raw: string): string {
  return String(raw ?? "")
    .replace(/^\uFEFF/, "")
    .replace(/^\s*(?:cpu|memory)\s*:\s*/i, "")
    .trim()
    .replace(/^(["'])(.*)\1$/, "$2")
    .trim()
}

/** Parses one quantity with the API server's grammar (suffixes n u m "" k M G T P E, Ki…Ei, or e/E exponents), or returns null when it would reject it. */
export function parseQuantity(raw: string): Quantity | null {
  const text = cleanQuantity(raw)
  const match = QUANTITY.exec(text)
  if (!match) return null
  const [, number, exponent, suffix = ""] = match
  const base = Number(number)
  const value = exponent ? base * 10 ** Number(exponent.slice(1)) : base * (BINARY[suffix] ?? DECIMAL[suffix])
  if (!Number.isFinite(value) || value < 0) return null
  return { value, number, suffix: exponent ?? suffix }
}

/** Guesses what an unparseable quantity meant: 512MB → 512Mi, 1g → 1Gi, 2 GB → 2Gi, 0.5 cores → 500m. */
export function suggestUnit(raw: string, kind: ResourceKind): string[] {
  const text = cleanQuantity(raw).replace(/\s+/g, "")
  const match = /^(\d+(?:\.\d+)?)([a-zA-Z]+)$/.exec(text)
  if (!match) return []
  const [, number, unit] = match
  if (kind === "cpu") {
    if (/^(cores?|cpus?|vcpus?)$/i.test(unit)) return [toMilli(Number(number))]
    if (/^(mc|millicores?|millicpus?)$/i.test(unit)) return [`${number}m`]
    return []
  }
  const letter = unit[0].toUpperCase()
  if (!"KMGTPE".includes(letter) || !/^[kKmMgGtTpPeE](i?[bB]?|[bB]|iB)$/.test(unit)) return []
  const binary = `${number}${letter}i`
  const decimal = `${number}${letter === "K" ? "k" : letter}`
  return /i/.test(unit) || unit.length === 1 ? [binary] : [binary, decimal]
}

function toMilli(cores: number) {
  const milli = Math.round(cores * 1000)
  return milli % 1000 === 0 ? String(milli / 1000) : `${milli}m`
}

/** Reads a CPU amount back in words: 0.5 → "half a core", 250m → "a quarter of a core", 2 → "2 cores". */
export function describeCpu(cores: number): string {
  if (cores === 0) return "no CPU"
  const named: Record<number, string> = { 0.25: "a quarter of a core", 0.5: "half a core", 0.75: "three quarters of a core", 1: "1 core" }
  if (named[cores]) return named[cores]
  if (cores < 1) return `${trim(cores * 100, 1)}% of a core`
  return `${trim(cores, 3)} cores`
}

/** Reads a memory amount back in both systems: 512Mi → "512 MiB · 537 MB". */
export function describeMemory(bytes: number): string {
  if (bytes < 1024) return `${trim(bytes, 3)} bytes`
  const units = ["KiB", "MiB", "GiB", "TiB", "PiB"]
  let binary = bytes / 1024
  let index = 0
  while (binary >= 1024 && index < units.length - 1) {
    binary /= 1024
    index++
  }
  const decimalUnits = ["kB", "MB", "GB", "TB", "PB"]
  let decimal = bytes / 1000
  let dIndex = 0
  while (decimal >= 1000 && dIndex < decimalUnits.length - 1) {
    decimal /= 1000
    dIndex++
  }
  return `${trim(binary, 1)} ${units[index]} · ${trim(decimal, 1)} ${decimalUnits[dIndex]}`
}

function trim(value: number, digits: number) {
  return Number(value.toFixed(digits)).toLocaleString("en-US", { maximumFractionDigits: digits })
}

/** Formats a CPU amount in base units back to a quantity string ("1500m", "2"). */
export function formatCpu(cores: number) {
  return toMilli(cores)
}

/** Formats bytes as the largest exact binary quantity ("512Mi", "1536Mi"), falling back to plain bytes. */
export function formatMemory(bytes: number) {
  for (const suffix of ["Ei", "Pi", "Ti", "Gi", "Mi", "Ki"]) {
    const scaled = bytes / BINARY[suffix]
    if (scaled >= 1 && Number.isInteger(scaled)) return `${scaled}${suffix}`
  }
  return String(Math.ceil(bytes))
}

/** Pulls cpu and memory requests and limits out of a pasted `resources:` YAML block (CRLF safe). */
export function parseResourcesYaml(text: string): K8sResources | null {
  if (!/requests\s*:|limits\s*:/.test(text)) return null
  const result: K8sResources = { cpu: { request: "", limit: "" }, memory: { request: "", limit: "" } }
  let side: ResourceSide | null = null
  let found = false
  for (const line of text.replace(/^\uFEFF/, "").split(/\r?\n/)) {
    const content = line.replace(/#.*$/, "").trim()
    // Only the first container's block: a second `resources:` or `- name:` would mix two containers' values.
    if (found && /^(?:-\s*name\s*:|resources\s*:)/.test(content)) break
    if (/^requests\s*:/.test(content)) side = "request"
    else if (/^limits\s*:/.test(content)) side = "limit"
    const pair = /^(?:requests\s*:|limits\s*:)?\s*\{?\s*(.*)$/.exec(content)?.[1] ?? ""
    for (const [, key, value] of pair.matchAll(/(cpu|memory)\s*:\s*("[^"]*"|'[^']*'|[^,}\s]+)/g)) {
      if (!side) continue
      result[key as ResourceKind][side] = cleanQuantity(value)
      found = true
    }
  }
  return found ? result : null
}

const field = (kind: ResourceKind, side: ResourceSide): FieldKey => `${kind}.${side}`

/** Checks one container's requests and limits and returns every mistake, most serious first. */
export function checkResources(resources: K8sResources, node?: NodeCapacity): ResourceIssue[] {
  const issues: ResourceIssue[] = []
  const parsed: Partial<Record<FieldKey, Quantity>> = {}
  const safe = (kind: ResourceKind, side: ResourceSide) => String(resources?.[kind]?.[side] ?? "")
  const nodeCpu = node?.cpu ? parseQuantity(node.cpu) : null

  for (const kind of ["cpu", "memory"] as const) {
    for (const side of ["request", "limit"] as const) {
      const raw = cleanQuantity(safe(kind, side))
      const key = field(kind, side)
      if (!raw) continue
      const quantity = parseQuantity(raw)
      if (!quantity) {
        const guesses = suggestUnit(raw, kind)
        issues.push({
          kind: guesses.length ? "unit-typo" : "invalid",
          severity: "error",
          field: key,
          detail: { value: raw },
          fixes: guesses.map((guess) => ({ action: "use", label: guess, set: { [key]: guess } })),
        })
        continue
      }
      const before = issues.length
      if (kind === "cpu") {
        if (/i$/.test(quantity.suffix) || /^[MGTPE]$/.test(quantity.suffix)) {
          const swap = safe("memory", side)
          issues.push({ kind: "cpu-memory-unit", severity: "error", field: key, detail: { value: raw }, fixes: swap && !parseQuantity(swap)?.suffix.match(/i$|^[MGTPE]$/) ? [{ action: "swap", label: raw, set: { [key]: swap, [field("memory", side)]: raw } }] : [] })
        } else if (quantity.suffix !== "m" && Number.isInteger(quantity.value) && quantity.value >= 50 && !(nodeCpu && quantity.value <= nodeCpu.value)) {
          issues.push({ kind: "cpu-whole-cores", severity: "error", field: key, detail: { value: raw, cores: String(quantity.value), milli: `${quantity.value}m`, meant: describeCpu(quantity.value / 1000) }, fixes: [{ action: "use", label: `${quantity.value}m`, set: { [key]: `${quantity.value}m` } }] })
        } else if (quantity.value > 0 && Math.abs(quantity.value * 1000 - Math.round(quantity.value * 1000)) > 1e-9) {
          const up = formatCpu(Math.max(0.001, Math.ceil(quantity.value * 1000) / 1000))
          issues.push({ kind: "cpu-precision", severity: "warning", field: key, detail: { value: raw, fixed: up }, fixes: [{ action: "use", label: up, set: { [key]: up } }] })
        }
      } else if (/^[mun]$/.test(quantity.suffix) && quantity.value < 2 ** 20) {
        const n = quantity.number
        issues.push({ kind: "memory-millibytes", severity: "error", field: key, detail: { value: raw, bytes: describeMemory(quantity.value), binary: `${n}Mi`, decimal: `${n}M` }, fixes: [{ action: "use", label: `${n}Mi`, set: { [key]: `${n}Mi` } }, { action: "use", label: `${n}M`, set: { [key]: `${n}M` } }] })
      } else if (quantity.value > 0 && quantity.value < 2 ** 20) {
        const n = quantity.number
        const guesses = Number(n) <= 64 ? [`${n}Gi`, `${n}Mi`] : [`${n}Mi`]
        issues.push({ kind: "memory-bytes", severity: "error", field: key, detail: { value: raw, bytes: describeMemory(quantity.value) }, fixes: guesses.map((guess) => ({ action: "use", label: guess, set: { [key]: guess } })) })
      }
      // A value with a unit slip is judged on its own; comparing it with the other side would only repeat the same mistake.
      if (issues.length === before) parsed[key] = quantity
    }

    const request = parsed[field(kind, "request")]
    const limit = parsed[field(kind, "limit")]
    const format = kind === "cpu" ? formatCpu : formatMemory
    if (request && limit && limit.value < request.value - 1e-12) {
      const mixed = kind === "memory" && /i$/.test(request.suffix) !== /i$/.test(limit.suffix) && limit.value / request.value > 0.9
      issues.push({
        kind: mixed ? "limit-below-request-units" : "limit-below-request",
        severity: "error",
        field: field(kind, "limit"),
        detail: { request: cleanQuantity(safe(kind, "request")), limit: cleanQuantity(safe(kind, "limit")), requestRead: kind === "cpu" ? describeCpu(request.value) : describeMemory(request.value), limitRead: kind === "cpu" ? describeCpu(limit.value) : describeMemory(limit.value) },
        fixes: [
          { action: "raise-limit", label: cleanQuantity(safe(kind, "request")), set: { [field(kind, "limit")]: cleanQuantity(safe(kind, "request")) } },
          { action: "lower-request", label: cleanQuantity(safe(kind, "limit")), set: { [field(kind, "request")]: cleanQuantity(safe(kind, "limit")) } },
        ],
      })
    }
    const capacity = node?.[kind] ? parseQuantity(node[kind] as string) : null
    const asked = request ?? limit
    if (capacity && asked && asked.value > capacity.value) {
      issues.push({ kind: "too-big-for-node", severity: "error", field: field(kind, request ? "request" : "limit"), detail: { value: cleanQuantity(safe(kind, request ? "request" : "limit")), node: cleanQuantity(node?.[kind] ?? "") }, fixes: [{ action: "use", label: format(capacity.value), set: { [field(kind, request ? "request" : "limit")]: format(capacity.value) } }] })
    }
    if (limit && !cleanQuantity(safe(kind, "request"))) {
      issues.push({ kind: "limit-copies-request", severity: "info", field: field(kind, "request"), detail: { limit: cleanQuantity(safe(kind, "limit")) }, fixes: [] })
    }
  }
  if (parsed["memory.request"] && !cleanQuantity(safe("memory", "limit"))) {
    issues.push({ kind: "no-memory-limit", severity: "info", field: "memory.limit", detail: {}, fixes: [{ action: "use", label: cleanQuantity(safe("memory", "request")), set: { "memory.limit": cleanQuantity(safe("memory", "request")) } }] })
  }
  const order = { error: 0, warning: 1, info: 2 }
  return issues.sort((a, b) => order[a.severity] - order[b.severity])
}

export type QosClass = "Guaranteed" | "Burstable" | "BestEffort"

/**
 * The Pod QoS class a single-container pod with these resources gets
 * (https://kubernetes.io/docs/concepts/workloads/pods/pod-qos/). A missing
 * request copies the limit, so limits alone can still be Guaranteed.
 */
export function qosClass(resources: K8sResources): QosClass {
  const read = (kind: ResourceKind, side: ResourceSide) => parseQuantity(String(resources?.[kind]?.[side] ?? ""))?.value
  const anySet = (["cpu", "memory"] as const).some((kind) => read(kind, "request") !== undefined || read(kind, "limit") !== undefined)
  if (!anySet) return "BestEffort"
  const guaranteed = (["cpu", "memory"] as const).every((kind) => {
    const limit = read(kind, "limit")
    const request = read(kind, "request") ?? limit
    return limit !== undefined && request !== undefined && Math.abs(limit - request) < 1e-9
  })
  return guaranteed ? "Guaranteed" : "Burstable"
}
