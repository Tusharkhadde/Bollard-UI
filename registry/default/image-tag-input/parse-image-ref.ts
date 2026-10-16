export type ImageIssueKind =
  | "invalid" | "scheme" | "uppercase" | "hub-website" | "registry-typo" | "deprecated-registry" | "missing-registry" | "localhost"
  | "digest-format" | "no-tag" | "latest" | "mutable-tag" | "tag-and-digest" | "arch-mismatch" | "arch-pinned"

export interface ImageIssue {
  kind: ImageIssueKind
  severity: "error" | "warning" | "info"
  /** The corrected reference for a one-tap fix. Undefined: no safe fix. */
  fix?: string
  /** Filled into the message: the registry meant, the arch found, the bad part. */
  detail?: string
}

export interface ImageRef {
  /** Registry host as written, or "" when Docker falls back to docker.io. */
  registry: string
  /** Repository path as written (without the implied library/). */
  path: string
  tag: string
  digest: string
  /** What Docker, containerd and Kubernetes actually pull: docker.io/library/nginx:latest. */
  canonical: string
}

export interface ImageContext {
  /** The reference is for production: :latest, a missing tag and moving tags are flagged. */
  production?: boolean
  /** Target platform, e.g. "linux/amd64". Compared with arch hints in the reference. */
  platform?: string
  /** Your private registry with its namespace, e.g. "ghcr.io/acme". A bare "acme/api" then pulls from Docker Hub instead. */
  privateRegistry?: string | string[]
}

const KNOWN = ["docker.io", "ghcr.io", "quay.io", "gcr.io", "mcr.microsoft.com", "registry.gitlab.com", "public.ecr.aws", "registry.k8s.io", "nvcr.io", "us.gcr.io", "eu.gcr.io", "asia.gcr.io"]
const SUFFIXES = ["pkg.dev", "azurecr.io", "amazonaws.com"]
const DEPRECATED: Record<string, string> = { "k8s.gcr.io": "registry.k8s.io", "docker.pkg.github.com": "ghcr.io", "index.docker.io": "docker.io", "registry-1.docker.io": "docker.io" }
const COMPONENT = /^[a-z0-9]+(?:(?:[._]|__|-+)[a-z0-9]+)*$/
const TAG = /^[\w][\w.-]{0,127}$/
// A major or major.minor version, or a channel/distro name, optionally with a variant suffix (lts-alpine, 1.25-slim, stable-bookworm).
const MOVING = /^(v?\d{1,3}(\.\d+)?|latest|stable|lts|edge|main|master|dev|develop|nightly|canary|beta|rc|current|alpine|slim|bookworm|bullseye|trixie|jammy|noble|focal)([-_.][a-z][\w.-]*)?$/i
const ARCH = /(?:^|[-_.])(arm64v8|arm64|aarch64|amd64|x86_64|armv7|arm32v7|armhf|ppc64le|s390x|i386)(?=$|[-_.])/i
const ARCH_NS = /^(amd64|arm64v8|arm32v7|arm32v6|ppc64le|s390x|i386|riscv64)$/
const ARCH_ALIAS: Record<string, string> = { arm64v8: "arm64", aarch64: "arm64", x86_64: "amd64", armv7: "arm", arm32v7: "arm", armhf: "arm", arm32v6: "arm" }

/** Edit distance where swapping two neighbouring letters (ghrc → ghcr) counts as one edit. */
function distance(a: string, b: string) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)))
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++) {
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1)
    }
  return d[a.length][b.length]
}

/** True for tags that are re-pointed at each new release (latest, 20, 1.25, lts-alpine, stable-slim). A full version like 1.25.3 is not. */
export function isMovingTag(tag: string) {
  return MOVING.test(tag)
}

const join = (registry: string, path: string, tag: string, digest: string) => `${registry ? `${registry}/` : ""}${path}${tag ? `:${tag}` : ""}${digest ? `@${digest}` : ""}`

/** Splits a reference with Docker's rules: the first part is a registry only if it has a dot, a colon, or is localhost. Never throws. */
export function parseImageRef(input: string): ImageRef | null {
  const value = input.trim()
  if (!value || /\s/.test(value)) return null
  const [beforeDigest, digest = "", extra] = value.split("@")
  if (extra !== undefined) return null
  const slash = beforeDigest.indexOf("/")
  const first = slash > 0 ? beforeDigest.slice(0, slash) : ""
  const registry = first && (/[.:]/.test(first) || first === "localhost") ? first : ""
  const rest = registry ? beforeDigest.slice(slash + 1) : beforeDigest
  const colon = rest.lastIndexOf(":")
  const path = colon > rest.lastIndexOf("/") && colon >= 0 ? rest.slice(0, colon) : rest
  const tag = path === rest ? "" : rest.slice(colon + 1)
  if (!path) return null
  const host = registry || "docker.io"
  const fullPath = host === "docker.io" && !path.includes("/") ? `library/${path}` : path
  return { registry, path, tag, digest, canonical: `${host}/${fullPath}${tag ? `:${tag}` : digest ? "" : ":latest"}${digest ? `@${digest}` : ""}` }
}

/** Catches image references that pull the wrong thing, a different thing next week, or nothing at all. */
export function checkImageRef(input: string, { production = false, platform, privateRegistry }: ImageContext = {}): ImageIssue[] {
  const raw = input.trim()
  if (!raw) return []
  if (/^[a-z]+:\/\//i.test(raw)) {
    // https://hub.docker.com/_/nginx needs both fixes, so do them in one tap.
    const rest = raw.replace(/^[a-z]+:\/\//i, "")
    const inner = checkImageRef(rest)[0]
    return [{ kind: "scheme", severity: "error", fix: inner?.kind === "hub-website" ? inner.fix : rest }]
  }
  const hub = raw.match(/^(?:www\.)?hub\.docker\.com\/(?:_\/|r\/)?([^?#]+?)(?:\/tags.*)?\/?$/i)
  if (hub) return [{ kind: "hub-website", severity: "error", fix: hub[1].replace(/^library\//, "").toLowerCase() }]
  const ref = parseImageRef(raw)
  if (!ref) return [{ kind: "invalid", severity: "error" }]
  const issues: ImageIssue[] = []
  const rebuild = (part: Partial<ImageRef>) => join(part.registry ?? ref.registry, part.path ?? ref.path, part.tag ?? ref.tag, part.digest ?? ref.digest)

  const parts = ref.path.split("/")
  if (parts.some((part) => !COMPONENT.test(part))) {
    const lower = ref.path.toLowerCase()
    return [lower.split("/").every((part) => COMPONENT.test(part)) ? { kind: "uppercase", severity: "error", fix: rebuild({ path: lower }) } : { kind: "invalid", severity: "error", detail: ref.path }]
  }
  if (ref.tag && !TAG.test(ref.tag)) return [{ kind: "invalid", severity: "error", detail: `:${ref.tag}` }]

  const host = ref.registry.toLowerCase().replace(/:\d+$/, "")
  if (DEPRECATED[host]) issues.push({ kind: "deprecated-registry", severity: "warning", detail: DEPRECATED[host], fix: rebuild({ registry: DEPRECATED[host] }) })
  else if (host && host !== "localhost" && !KNOWN.includes(host) && !SUFFIXES.some((suffix) => host.endsWith(`.${suffix}`))) {
    const near = KNOWN.find((known) => distance(known, host) <= (known.length > 7 ? 2 : 1))
    const suffix = !near && SUFFIXES.map((s) => [s, host.split(".").slice(-s.split(".").length).join(".")]).find(([s, tail]) => distance(s, tail) <= 2)
    const fixed = near ?? (suffix ? host.slice(0, host.length - suffix[1].length) + suffix[0] : "")
    if (fixed) issues.push({ kind: "registry-typo", severity: "error", detail: fixed, fix: rebuild({ registry: fixed }) })
  }
  if (production && /^(localhost|127\.0\.0\.1)$/.test(host)) issues.push({ kind: "localhost", severity: "error" })
  if (!ref.registry) {
    const owner = [privateRegistry ?? []].flat().find((full) => full.split("/").slice(1).join("/") && ref.path.startsWith(`${full.split("/").slice(1).join("/")}/`))
    if (owner) issues.push({ kind: "missing-registry", severity: "error", detail: owner.split("/")[0], fix: rebuild({ registry: owner.split("/")[0] }) })
  }

  if (ref.digest) {
    if (/^[a-f0-9]{64}$/i.test(ref.digest)) issues.push({ kind: "digest-format", severity: "error", detail: "sha256:", fix: rebuild({ digest: `sha256:${ref.digest.toLowerCase()}` }) })
    else if (!/^sha256:[a-f0-9]{64}$|^sha512:[a-f0-9]{128}$/.test(ref.digest)) issues.push({ kind: "digest-format", severity: "error", detail: ref.digest.split(":")[0] })
    else if (ref.tag) issues.push({ kind: "tag-and-digest", severity: "info" })
  } else if (production) {
    if (!ref.tag) issues.push({ kind: "no-tag", severity: "warning" })
    else if (ref.tag.toLowerCase() === "latest") issues.push({ kind: "latest", severity: "warning" })
    else if (isMovingTag(ref.tag)) issues.push({ kind: "mutable-tag", severity: "warning", detail: ref.tag })
  }

  const tagArch = ref.tag.match(ARCH)?.[1]?.toLowerCase()
  const nsArch = parts.length > 1 && !ref.registry && ARCH_NS.test(parts[0]) ? parts[0] : ""
  const found = tagArch ?? nsArch
  if (found) {
    const arch = ARCH_ALIAS[found] ?? found
    const want = platform?.split("/")[1]?.toLowerCase()
    const fix = tagArch ? rebuild({ tag: ref.tag.replace(ARCH, "").replace(/^[-_.]+/, "") || "latest" }) : rebuild({ path: parts.slice(1).join("/") })
    if (want && want !== arch) issues.push({ kind: "arch-mismatch", severity: "error", detail: arch, fix })
    else if (!want) issues.push({ kind: "arch-pinned", severity: "info", detail: arch, fix })
  }
  return issues
}
