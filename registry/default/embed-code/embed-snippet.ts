// Bollard UI — embed-code · MIT licence · https://bollard-ui.vercel.app/components/embed-code

export type EmbedVisibility = "public" | "unlisted" | "private" | "draft"

export interface EmbedResource {
  /** URL the iframe loads. */
  url: string
  /** Becomes the iframe's `title`, which screen readers announce. */
  title: string
  visibility?: EmbedVisibility
  /** What anyone viewing the host page can see, e.g. "Video", "Your name", "Comment count". */
  exposes?: string[]
  /** What the embed tracks, e.g. "Sets YouTube cookies on load". */
  tracking?: string[]
  /** Same embed without tracking (e.g. youtube-nocookie.com). Enables the privacy toggle. */
  privacyUrl?: string
}

export interface EmbedOptions {
  responsive: boolean
  /** Width / height, used as the aspect ratio when responsive. */
  width: number
  height: number
  /** Load the tracking-free `privacyUrl` instead of `url`. */
  privacy: boolean
  /** Sites allowed to frame it (enforced on your side with CSP frame-ancestors). Empty means any site. */
  allowedDomains: string[]
}

export interface EmbedRisk {
  level: "danger" | "warning"
  message: string
  /** Query parameter that a one-tap fix can strip. */
  param?: string
}

const SECRET_PARAMS = /^(token|access_token|auth|key|api_key|apikey|secret|sig|signature|x-amz-signature|share_token|password)$/i

const escapeAttr = (value: string) => value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;")

/** A copy-ready iframe: titled for screen readers, lazy-loaded, with a strict referrer policy. */
export function buildEmbedSnippet(src: string, title: string, options: EmbedOptions) {
  const size = options.responsive
    ? `style="width:100%;aspect-ratio:${options.width}/${options.height};border:0"`
    : `width="${options.width}" height="${options.height}" style="border:0"`
  return [
    `<iframe src="${escapeAttr(src)}"`,
    `  title="${escapeAttr(title)}"`,
    `  ${size}`,
    `  loading="lazy" referrerpolicy="strict-origin-when-cross-origin"`,
    `  allow="fullscreen; picture-in-picture"></iframe>`,
  ].join("\n")
}

/** Draft or private resources, secrets in the URL, drafts by path, and plain http. */
export function findEmbedRisks(src: string, visibility: EmbedVisibility = "public"): EmbedRisk[] {
  const risks: EmbedRisk[] = []
  if (visibility === "draft") risks.push({ level: "danger", message: "This is a draft. Visitors will see an error, or the unfinished version once it goes live." })
  if (visibility === "private") risks.push({ level: "danger", message: "This is private. Visitors outside your workspace will hit a sign-in wall." })
  let url: URL
  try {
    url = new URL(src)
  } catch {
    return [...risks, { level: "danger", message: "The embed URL isn't a valid address." }]
  }
  for (const key of url.searchParams.keys()) {
    if (SECRET_PARAMS.test(key)) risks.push({ level: "danger", message: `The URL carries a secret (${key}=…). Anyone who views the page source can reuse it.`, param: key })
  }
  if (visibility !== "draft" && /\/(drafts?|preview)(\/|$)|[?&]preview=/i.test(url.pathname + url.search)) {
    risks.push({ level: "warning", message: "The URL looks like a draft or preview link, not the published one." })
  }
  if (url.protocol === "http:") risks.push({ level: "warning", message: "Browsers block http:// embeds on https:// pages." })
  return risks
}

/** Strips a query parameter, keeping the rest of the URL intact. */
export function removeParam(src: string, param: string) {
  try {
    const url = new URL(src)
    url.searchParams.delete(param)
    return url.toString()
  } catch {
    return src
  }
}

/** "https://www.Example.com/blog" → "example.com"; flags wildcards and local hosts. */
export function normalizeDomain(input: string): { domain: string; problem?: string } {
  const trimmed = input.trim().toLowerCase()
  if (trimmed === "*") return { domain: "*", problem: "A lone * lets every site embed this." }
  const host = trimmed.replace(/^[a-z]+:\/\//, "").replace(/[/?#].*$/, "").replace(/:\d+$/, "").replace(/^www\./, "")
  if (!host) return { domain: "", problem: "Enter a domain like example.com." }
  if (host === "localhost" || /^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return { domain: host, problem: "Local addresses won't work for your visitors." }
  if (!/^(\*\.)?([a-z0-9-]+\.)+[a-z]{2,}$/.test(host)) return { domain: host, problem: "That doesn't look like a domain." }
  return { domain: host }
}
