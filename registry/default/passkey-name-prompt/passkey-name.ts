// Pure passkey naming helpers. Names come from the AAGUID first, the user agent second
// (web.dev "Determine the passkey provider with AAGUID"). Never a trust decision: display only.

export interface PasskeyProvider {
  name: string
  /** "manager" syncs across the user's devices; "browser" lives in one browser profile or OS. */
  kind: "manager" | "browser"
}

/**
 * A small built-in table from the community list github.com/passkeydeveloper/passkey-authenticator-aaguids
 * (names as listed there, checked Oct 2026). Pass `providers` for anything else.
 */
export const PASSKEY_PROVIDERS: Record<string, PasskeyProvider> = {
  "fbfc3007-154e-4ecc-8c0b-6e020557d7bd": { name: "Apple Passwords", kind: "manager" },
  "dd4ec289-e01d-41c9-bb89-70fa845d4bf2": { name: "iCloud Keychain (Managed)", kind: "manager" },
  "ea9b8d66-4d01-1d21-3ce4-b6b48cb575d4": { name: "Google Password Manager", kind: "manager" },
  "d3452668-01fd-4c12-926c-83a4204853aa": { name: "Microsoft Password Manager", kind: "manager" },
  "adce0002-35bc-c60a-648b-0b25f1f05503": { name: "Chrome", kind: "browser" },
  "771b48fd-d3d4-4f74-9232-fc157ab0507a": { name: "Edge", kind: "browser" },
  "08987058-cadc-4b81-b6e1-30de50dcbe96": { name: "Windows Hello", kind: "browser" },
  "9ddd1817-af5a-4672-a2b9-3e3dd95000a9": { name: "Windows Hello", kind: "browser" },
  "6028b017-b1d4-4c02-b4b3-afcdafc96bb2": { name: "Windows Hello", kind: "browser" },
  "bada5566-a7aa-401f-bd96-45619a55120d": { name: "1Password", kind: "manager" },
  "d548826e-79b4-db40-a3d8-11116f7e8349": { name: "Bitwarden", kind: "manager" },
  "531126d6-e717-415c-9320-3d9aa6981239": { name: "Dashlane", kind: "manager" },
  "50726f74-6f6e-5061-7373-50726f746f6e": { name: "Proton Pass", kind: "manager" },
  "53414d53-554e-4700-0000-000000000000": { name: "Samsung Pass", kind: "manager" },
  "b84e4048-15dc-4dd0-8640-f4f60813c8af": { name: "NordPass", kind: "manager" },
  "0ea242b4-43c4-4a1b-8b17-dd6d0b6baec6": { name: "Keeper", kind: "manager" },
  "f3809540-7f14-49c1-a8b3-8f813b225541": { name: "Enpass", kind: "manager" },
  "b78a0a55-6ef8-d246-a042-ba0f6d55050c": { name: "LastPass", kind: "manager" },
  "fdb141b2-5d84-443e-8a35-4698c205a502": { name: "KeePassXC", kind: "manager" },
}

/** Looks up an AAGUID (any case, with or without dashes). The all-zero AAGUID names nothing. */
export function passkeyProvider(aaguid: string | undefined, extra: Record<string, PasskeyProvider> = {}): PasskeyProvider | undefined {
  const hex = (aaguid ?? "").toLowerCase().replace(/[^0-9a-f]/g, "")
  if (hex.length !== 32 || /^0+$/.test(hex)) return undefined
  const id = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
  return extra[id] ?? PASSKEY_PROVIDERS[id]
}

/** "Mac" and "Chrome" from a user agent. iPads that ask for the desktop site report as a Mac; pass touchPoints to tell. */
export function describeDevice(userAgent = "", touchPoints = 0): { device?: string; browser?: string } {
  const ua = userAgent
  const device = /iPhone/.test(ua) ? "iPhone"
    : /iPad/.test(ua) || (/Macintosh/.test(ua) && touchPoints > 1) ? "iPad"
    : /Android/.test(ua) ? "Android"
    : /CrOS/.test(ua) ? "Chromebook"
    : /Macintosh|Mac OS X/.test(ua) ? "Mac"
    : /Windows/.test(ua) ? "Windows"
    : /Linux/.test(ua) ? "Linux" : undefined
  const browser = /Edg(e|A|iOS)?\//.test(ua) ? "Edge"
    : /OPR\/|Opera/.test(ua) ? "Opera"
    : /SamsungBrowser/.test(ua) ? "Samsung Internet"
    : /Firefox|FxiOS/.test(ua) ? "Firefox"
    : /Chrome|CriOS/.test(ua) ? "Chrome"
    : /Safari/.test(ua) ? "Safari" : undefined
  return { device, browser }
}

const normalize = (name: string) => name.toLowerCase().replace(/\s*[·•|/–—-]\s*/g, " · ").replace(/\s+/g, " ").trim()

/** True when `name` reads the same as an existing name (case, spacing and separators ignored). */
export const isDuplicateName = (name: string, existing: string[]) => existing.some((e) => normalize(e) === normalize(name))

/** "Mac · Chrome" → "Mac · Chrome (2)", or the next number that is free. */
export function nextFreeName(name: string, existing: string[]): string {
  const base = name.trim().replace(/\s*\(\d+\)$/, "")
  if (!isDuplicateName(base, existing)) return base
  for (let n = 2; n < 1000; n++) if (!isDuplicateName(`${base} (${n})`, existing)) return `${base} (${n})`
  return base
}

export interface SuggestOptions {
  aaguid?: string
  userAgent?: string
  touchPoints?: number
  /** "cross-platform" with no known provider means a hardware security key. */
  attachment?: "platform" | "cross-platform"
  /** `response.getTransports()`. "hybrid" means it was made on a phone over a QR code, not on this device. */
  transports?: string[]
  existing?: string[]
  providers?: Record<string, PasskeyProvider>
  /** Used when nothing is known. */
  fallback?: string
  securityKey?: string
  /** Used for a passkey made on a phone over a QR code ("hybrid"). */
  hybrid?: string
}

/** Where a passkey with no known provider lives: on this device, a phone (hybrid) or a security key. */
export function passkeyLocation(attachment?: "platform" | "cross-platform", transports: string[] = []): "device" | "phone" | "security-key" {
  if (transports.includes("hybrid")) return "phone"
  return attachment === "cross-platform" ? "security-key" : "device"
}

/**
 * Suggests a name that tells this passkey apart: a syncing manager by its name
 * ("iCloud Keychain"), a browser or device-bound passkey by where it lives
 * ("Mac · Chrome"), and never a name that already exists.
 */
export function suggestPasskeyName({ aaguid, userAgent, touchPoints, attachment, transports, existing = [], providers, fallback = "Passkey", securityKey = "Security key", hybrid = "Passkey on your phone" }: SuggestOptions): string {
  const provider = passkeyProvider(aaguid, providers)
  const { device, browser } = describeDevice(userAgent, touchPoints)
  const where = [device, browser].filter(Boolean).join(" · ")
  let name: string
  const location = passkeyLocation(attachment, transports)
  if (provider?.kind === "manager") name = !isDuplicateName(provider.name, existing) || !device || location !== "device" ? provider.name : `${provider.name} · ${device}`
  // Made on a phone or a key, so this computer's user agent says nothing about where it lives.
  else if (location === "phone") name = hybrid
  else if (provider?.name === "Windows Hello") name = [provider.name, browser].filter(Boolean).join(" · ")
  else if (provider) name = [device, provider.name].filter(Boolean).join(" · ")
  else if (location === "security-key") name = securityKey
  else name = where || fallback
  return nextFreeName(name, existing)
}

export type PasskeyNameIssue = "empty" | "duplicate" | "generic" | "long"

const GENERIC = new Set(["passkey", "my passkey", "new passkey", "key", "my key", "test", "device", "my device", "phone", "my phone", "laptop", "my laptop", "computer", "default", "asdf", "a", "x", "1"])

/** The first problem with a name, if any. */
export function checkPasskeyName(name: string, existing: string[] = [], maxLength = 64): PasskeyNameIssue | undefined {
  const value = name.trim()
  if (!value) return "empty"
  if (isDuplicateName(value, existing)) return "duplicate"
  if (value.length > maxLength) return "long"
  if (GENERIC.has(normalize(value))) return "generic"
  return undefined
}
