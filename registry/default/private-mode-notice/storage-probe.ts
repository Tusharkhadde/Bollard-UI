// Bollard UI — private-mode-notice · MIT licence · https://bollard-ui.vercel.app/components/private-mode-notice

/**
 * What will happen to anything this site saves in the browser.
 * - `private`: kept for now, erased when the private window closes.
 * - `blocked`: nothing can be saved at all (cookies/site data blocked, or storage disabled).
 * - `full`: this site's storage is nearly out of space, so new saves may fail.
 */
export type StorageRisk = "ok" | "private" | "blocked" | "full"

export interface StorageReport {
  risk: StorageRisk
  /** `certain` when a write actually failed; `likely` when it's inferred from browser behaviour. */
  confidence: "certain" | "likely"
  /** Human-readable reasons, for logs or a "why" tooltip. */
  signals: string[]
  quota?: number
  usage?: number
}

const GiB = 2 ** 30
/** Private windows report small quotas (Safari 18 ≈ 1 GB, older Chrome Incognito ≈ 100 MB); normal ones report many GB. */
const PRIVATE_QUOTA = 1.2 * GiB
/** Above this share of the quota, a draft save can hit QuotaExceededError. */
const FULL_RATIO = 0.9

const errorName = (error: unknown) => (error instanceof Error || error instanceof DOMException ? error.name : "")
const errorMessage = (error: unknown) => (error instanceof Error || error instanceof DOMException ? error.message : "")

/** Classifies a failed localStorage write. Old Safari private windows had a zero-byte quota. */
export function classifyWriteError(error: unknown, storedItems: number): StorageReport {
  const name = errorName(error)
  if (name === "QuotaExceededError" || name === "NS_ERROR_DOM_QUOTA_REACHED") {
    return storedItems === 0
      ? { risk: "private", confidence: "certain", signals: ["localStorage has no space at all (private window)"] }
      : { risk: "full", confidence: "certain", signals: ["localStorage is full"] }
  }
  return { risk: "blocked", confidence: "certain", signals: [`localStorage is blocked (${name || "unavailable"})`] }
}

/** Classifies a storage estimate. Pure, so it can be unit tested with fixed numbers. */
export function classifyEstimate(quota?: number, usage = 0): StorageReport | null {
  if (!quota) return null
  if (usage / quota >= FULL_RATIO)
    return { risk: "full", confidence: "likely", signals: ["site storage is over 90% full"], quota, usage }
  if (quota < PRIVATE_QUOTA)
    return { risk: "private", confidence: "likely", signals: ["storage quota is unusually small"], quota, usage }
  return null
}

/**
 * Probes, in order of certainty: a real localStorage write/read/delete, the
 * Origin Private File System (rejected in Firefox and Safari private windows),
 * then the quota estimate. Browser-only; call it from an effect.
 */
export async function probeStorage(): Promise<StorageReport> {
  try {
    const key = "__bollard-ui:probe__"
    localStorage.setItem(key, "1")
    const readBack = localStorage.getItem(key)
    localStorage.removeItem(key)
    if (readBack !== "1")
      return { risk: "private", confidence: "certain", signals: ["localStorage forgets what's written"] }
  } catch (error) {
    let items = 0
    try {
      items = localStorage.length
    } catch {
      // Blocked entirely.
    }
    return classifyWriteError(error, items)
  }

  const storage = typeof navigator !== "undefined" ? navigator.storage : undefined
  let estimate: StorageEstimate | undefined
  try {
    estimate = await storage?.estimate?.()
  } catch {
    // Not available here; fall through.
  }

  const byEstimate = classifyEstimate(estimate?.quota, estimate?.usage)
  if (byEstimate?.risk === "full") return byEstimate

  try {
    await storage?.getDirectory?.()
  } catch (error) {
    const message = errorMessage(error)
    if (errorName(error) === "SecurityError" || /transient reason/i.test(message)) {
      return {
        risk: "private",
        confidence: "likely",
        signals: ["private file storage is refused"],
        quota: estimate?.quota,
        usage: estimate?.usage,
      }
    }
  }

  return byEstimate ?? { risk: "ok", confidence: "likely", signals: [], quota: estimate?.quota, usage: estimate?.usage }
}
