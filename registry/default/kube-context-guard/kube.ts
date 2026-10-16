/** The kubeconfig context a command will run against. */
export interface KubeContext {
  /** Context name (`kubectl config current-context`). */
  name: string
  /** Cluster the context points at. EKS ARNs and GKE gke_project_zone_name forms are shortened for display. */
  cluster?: string
  /** The context's default namespace; Kubernetes uses "default" when it has none. */
  namespace?: string
  /** User or auth entry. */
  user?: string
}

/** One object from the manifest being applied. */
export interface ManifestObject {
  kind: string
  name?: string
  namespace?: string
}

export interface KubeCommand {
  tool: "kubectl" | "helm" | "other"
  /** Subcommand words, e.g. ["apply"], ["rollout", "restart"], ["upgrade"]. */
  verb: string[]
  /** --context (kubectl) or --kube-context (helm) when given. */
  context?: string
  /** -n / --namespace when given (or HELM_NAMESPACE=… before a helm command). */
  namespace?: string
  /** --cluster: kubectl talks to this kubeconfig cluster whatever the context says. */
  cluster?: string
  /** --kubeconfig or a KUBECONFIG=… prefix: the command reads another kubeconfig, so the current context may not apply. */
  kubeconfig?: string
  allNamespaces: boolean
  dryRun: boolean
  /** Changes the cluster (apply, delete, scale, helm upgrade…) and isn't a dry run. */
  mutating: boolean
}

export type KubeIssue =
  | { kind: "production"; context: string }
  | { kind: "context-changed"; from: string; to: string }
  | { kind: "default-namespace" }
  | { kind: "namespace-mismatch"; manifest: string; target: string; tool: "kubectl" | "helm" }
  | { kind: "manifest-elsewhere"; manifest: string; target: string }
  | { kind: "other-kubeconfig"; path: string }

const MUTATING_KUBECTL = new Set(["apply", "create", "delete", "replace", "patch", "edit", "scale", "set", "label", "annotate", "rollout", "drain", "cordon", "uncordon", "taint", "expose", "run", "autoscale", "debug"])
// `rollout status` and `rollout history` only read.
const READ_ONLY_ROLLOUT = new Set(["status", "history"])
const MUTATING_HELM = new Set(["install", "upgrade", "uninstall", "delete", "rollback", "test"])
// Flags that take a value as the next word, so the value isn't mistaken for the subcommand.
const TAKES_VALUE = new Set([
  "-n", "--namespace", "--context", "--kube-context", "-f", "--filename", "--kubeconfig", "-o", "--output", "-l", "--selector", "--values", "-k", "--kustomize",
  "--set", "--set-string", "--set-file", "--set-json", "--version", "-c", "--container", "--cluster", "--user", "--token", "-s", "--server", "--as", "--as-group",
  "--request-timeout", "--timeout", "--cache-dir", "--certificate-authority", "--client-certificate", "--client-key", "--tls-server-name", "-p", "--patch",
  "--type", "--field-manager", "--image", "--replicas", "--repo", "--description", "--post-renderer", "--kube-apiserver", "--kube-token", "--kube-as-user",
  "--kube-as-group", "--kube-ca-file", "--registry-config", "--repository-config", "--repository-cache", "--burst-limit", "--qps",
])
// A shell operator ends the kubectl/helm part of a line (`kubectl apply -f x.yaml | tee log`).
const OPERATOR = /^(?:\||\|\||&&|;|&|>|>>|<|2>|2>&1)$/
const DEPLOY = new Set(["apply", "create", "replace", "run", "expose", "install", "upgrade"])
const CLUSTER_SCOPED = new Set([
  "namespace", "node", "persistentvolume", "clusterrole", "clusterrolebinding", "customresourcedefinition", "storageclass", "priorityclass",
  "ingressclass", "runtimeclass", "csidriver", "csinode", "apiservice", "mutatingwebhookconfiguration", "validatingwebhookconfiguration", "volumeattachment",
  "certificatesigningrequest", "validatingadmissionpolicy", "validatingadmissionpolicybinding", "clusterissuer", "podsecuritypolicy",
])

/** Splits a shell command into words, honouring quotes. */
export function shellWords(command: string) {
  const words: string[] = []
  for (const m of String(command ?? "").replace(/\\\r?\n/g, " ").matchAll(/"((?:\\.|[^"\\])*)"|'([^']*)'|(\S+)/g)) words.push(m[1] ?? m[2] ?? m[3] ?? "")
  return words
}

/** Reads the parts of a kubectl or helm command that decide where it lands. */
export function parseKubeCommand(command: string): KubeCommand {
  const words = shellWords(command)
  const start = words.findIndex((w) => /(^|\/)(kubectl|helm|k|oc)(\.exe)?$/.test(w))
  const head = start >= 0 ? words[start] : ""
  const tool: KubeCommand["tool"] = /helm(\.exe)?$/.test(head) ? "helm" : head ? "kubectl" : "other"
  const end = words.findIndex((w, i) => i > start && OPERATOR.test(w))
  const rest = start >= 0 ? words.slice(start + 1, end > start ? end : undefined) : []
  // VAR=value words right before the tool (`KUBECONFIG=~/.kube/prod kubectl …`, `HELM_NAMESPACE=x helm …`).
  const env: Record<string, string> = {}
  for (let i = start - 1; i >= 0 && /^[A-Z_][A-Z0-9_]*=/.test(words[i]); i--) env[words[i].slice(0, words[i].indexOf("="))] = words[i].slice(words[i].indexOf("=") + 1)
  const verb: string[] = []
  let context = tool === "helm" ? env.HELM_KUBECONTEXT || undefined : undefined
  let namespace = tool === "helm" ? env.HELM_NAMESPACE || undefined : undefined
  let cluster: string | undefined
  let kubeconfig = env.KUBECONFIG || undefined
  let allNamespaces = false
  let dryRun = false
  for (let i = 0; i < rest.length; i++) {
    const w = rest[i]
    if (w === "--") break
    const [flag, inline] = w.startsWith("--") && w.includes("=") ? [w.slice(0, w.indexOf("=")), w.slice(w.indexOf("=") + 1)] : [w, undefined]
    const value = () => inline ?? rest[++i]
    if (flag === "-n" || flag === "--namespace") namespace = value()
    else if (/^-n\S/.test(w)) namespace = w.slice(2).replace(/^=/, "")
    else if (flag === "--context" || flag === "--kube-context") context = value()
    else if (flag === "--cluster" && tool === "kubectl") cluster = value()
    else if (flag === "--kubeconfig") kubeconfig = value()
    else if (flag === "-A" || flag === "--all-namespaces") allNamespaces = true
    else if (flag === "--dry-run") dryRun = inline === undefined ? true : !/^(none|false)$/i.test(inline)
    else if (flag.startsWith("-")) {
      if (inline === undefined && TAKES_VALUE.has(flag)) i++
    } else if (verb.length < (verb[0] === "rollout" || verb[0] === "set" ? 2 : 1)) verb.push(w)
  }
  const readOnly = verb[0] === "rollout" && READ_ONLY_ROLLOUT.has(verb[1] ?? "")
  const mutating = !dryRun && !readOnly && (tool === "helm" ? MUTATING_HELM.has(verb[0] ?? "") : tool === "kubectl" && MUTATING_KUBECTL.has(verb[0] ?? ""))
  return { tool, verb, context, namespace, cluster, kubeconfig, allNamespaces, dryRun, mutating }
}

/** Pulls kind, name and namespace out of multi-document YAML (CRLF and BOM tolerated). Not a YAML parser; just enough to route objects. */
export function readManifests(yaml: string): ManifestObject[] {
  const out: ManifestObject[] = []
  for (const doc of String(yaml ?? "").replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n").split(/^---.*$/m)) {
    const kind = doc.match(/^kind:\s*["']?([\w.-]+)/m)?.[1]
    if (!kind) continue
    const meta = doc.match(/^metadata:[^\n]*\n((?:[ \t]+[^\n]*\n?|\n)*)/m)?.[1] ?? ""
    const indent = meta.match(/^([ \t]+)\S/)?.[1] ?? "  "
    const field = (key: string) => meta.match(new RegExp(`^${indent}${key}:\\s*["']?([^"'#\\s]+)`, "m"))?.[1]
    out.push({ kind, name: field("name"), namespace: field("namespace") })
  }
  return out
}

/** "prod-eu-1" from an EKS ARN or gke_project_zone_cluster name; anything else unchanged. */
export function shortCluster(cluster: string) {
  const c = String(cluster ?? "")
  const arn = c.match(/^arn:aws[\w-]*:eks:[^:]*:\d*:cluster\/(.+)$/)
  if (arn) return arn[1]
  const gke = c.match(/^gke_[^_]+_[^_]+_(.+)$/)
  return gke ? gke[1] : c
}

/** True for "prod", "eu-prod-2", "production", "live"; false for "nonprod", "pre-prod" and "preprod". */
export function isProductionName(name: string) {
  const words = String(name ?? "").toLowerCase().split(/[^a-z0-9]+/).filter(Boolean)
  return words.some((w, i) => /^(prod|prd|production|live)\d*$/.test(w) && !/^(pre|non|not)$/.test(words[i - 1] ?? ""))
}

export interface KubeCheck {
  command: KubeCommand
  /** The context the command will really use (its --context flag wins over current-context). */
  context: KubeContext
  /** Namespace namespaced objects without their own namespace land in. */
  namespace: string
  production: boolean
  issues: KubeIssue[]
}

/** Works out where a command lands and what's risky about it. */
export function checkKubeCommand({
  command,
  current,
  contexts = [],
  manifests = [],
  last,
  isProduction = (c: KubeContext) => isProductionName(c.name) || isProductionName(c.cluster ?? ""),
}: {
  command: string
  current: KubeContext
  contexts?: KubeContext[]
  manifests?: ManifestObject[]
  last?: { context: string; namespace?: string }
  isProduction?: (context: KubeContext) => boolean
}): KubeCheck {
  const cmd = parseKubeCommand(command)
  const safeCurrent: KubeContext = current && typeof current.name === "string" ? current : { name: "" }
  const named = cmd.context ? (contexts.find((c) => c.name === cmd.context) ?? { name: cmd.context }) : safeCurrent
  const context = cmd.cluster ? { ...named, cluster: cmd.cluster } : named
  const namespace = cmd.namespace || context.namespace || "default"
  const production = isProduction(context)
  const issues: KubeIssue[] = []
  if (production && cmd.mutating) issues.push({ kind: "production", context: context.name })
  if (cmd.kubeconfig) issues.push({ kind: "other-kubeconfig", path: cmd.kubeconfig })
  if (last?.context && last.context !== context.name) issues.push({ kind: "context-changed", from: last.context, to: context.name })
  const namespaced = (Array.isArray(manifests) ? manifests : []).filter((m) => m && typeof m.kind === "string" && !CLUSTER_SCOPED.has(m.kind.toLowerCase()))
  const pinned = [...new Set(namespaced.map((m) => m.namespace).filter((n): n is string => !!n))]
  const loose = namespaced.filter((m) => !m.namespace)
  if (cmd.mutating && !cmd.allNamespaces) {
    if (namespace === "default" && (loose.length > 0 || !namespaced.length) && DEPLOY.has(cmd.verb[0] ?? "")) issues.push({ kind: "default-namespace" })
    for (const ns of pinned) {
      if (cmd.namespace && ns !== cmd.namespace) issues.push({ kind: "namespace-mismatch", manifest: ns, target: cmd.namespace, tool: cmd.tool === "helm" ? "helm" : "kubectl" })
      else if (!cmd.namespace && ns !== namespace) issues.push({ kind: "manifest-elsewhere", manifest: ns, target: namespace })
    }
  }
  return { command: cmd, context, namespace, production, issues }
}

/** Returns the command with its namespace or context flag set (replacing any existing one), or --dry-run added. Flags go before `--`, a pipe or `&&`. */
export function rewriteCommand(command: string, change: { namespace?: string; context?: string; dryRun?: boolean }) {
  const cmd = parseKubeCommand(command)
  const full = String(command ?? "").trim()
  // Split off the tail that isn't this command's flags: `-- sh -c …` for exec, or a shell operator and what follows.
  const cut = full.search(/\s(?:--(?=\s|$)|\|\|?|&&|;|>{1,2}|2>)(?=\s|$)/)
  let out = cut >= 0 ? full.slice(0, cut) : full
  const tail = cut >= 0 ? full.slice(cut) : ""
  const quote = (s: string) => (/^[\w./:@-]+$/.test(s) ? s : `'${s.replace(/'/g, "'\\''")}'`)
  if (change.namespace !== undefined) {
    out = out.replace(/\s(?:-n|--namespace)(?:=|\s+)\S+|\s-n(?=[^\s-])\S+/g, "")
    out += ` -n ${quote(change.namespace)}`
  }
  if (change.context !== undefined) {
    out = out.replace(/\s--(?:kube-)?context(?:=|\s+)\S+/g, "")
    out += ` ${cmd.tool === "helm" ? "--kube-context" : "--context"} ${quote(change.context)}`
  }
  if (change.dryRun && !cmd.dryRun) out += cmd.tool === "helm" ? " --dry-run" : " --dry-run=server"
  return out + tail
}
