// Bollard UI — upi-id-input · MIT licence · https://bollard-ui.vercel.app/components/upi-id-input

/** Who issued a UPI handle. The handle names the app and its sponsor bank, not where the payee banks. */
export interface UpiHandleInfo {
  app: string
  bank?: string
  /** Shown as a caution, e.g. for a handle that is being retired. */
  note?: string
}

/** Well-known handles (NPCI's TPAP list as published by the apps; not exhaustive). */
export const UPI_HANDLES: Record<string, UpiHandleInfo> = {
  okaxis: { app: "Google Pay", bank: "Axis Bank" }, oksbi: { app: "Google Pay", bank: "SBI" },
  okhdfcbank: { app: "Google Pay", bank: "HDFC Bank" }, okicici: { app: "Google Pay", bank: "ICICI Bank" },
  ybl: { app: "PhonePe", bank: "Yes Bank" }, ibl: { app: "PhonePe", bank: "ICICI Bank" }, axl: { app: "PhonePe", bank: "Axis Bank" },
  paytm: { app: "Paytm", bank: "Paytm Payments Bank", note: "Older Paytm ID. Paytm moved users to @ptyes, @ptaxis, @pthdfc and @ptsbi in 2024, so check it still works." },
  ptyes: { app: "Paytm", bank: "Yes Bank" }, ptaxis: { app: "Paytm", bank: "Axis Bank" }, pthdfc: { app: "Paytm", bank: "HDFC Bank" }, ptsbi: { app: "Paytm", bank: "SBI" },
  apl: { app: "Amazon Pay", bank: "Axis Bank" }, yapl: { app: "Amazon Pay", bank: "Yes Bank" }, rapl: { app: "Amazon Pay", bank: "RBL Bank" },
  waaxis: { app: "WhatsApp", bank: "Axis Bank" }, wahdfcbank: { app: "WhatsApp", bank: "HDFC Bank" }, waicici: { app: "WhatsApp", bank: "ICICI Bank" }, wasbi: { app: "WhatsApp", bank: "SBI" },
  upi: { app: "BHIM" }, ikwik: { app: "MobiKwik" }, freecharge: { app: "Freecharge" }, yesg: { app: "Groww" },
  sbi: { app: "SBI" }, icici: { app: "ICICI Bank" }, hdfcbank: { app: "HDFC Bank" }, axisbank: { app: "Axis Bank" }, kotak: { app: "Kotak" },
  pnb: { app: "PNB" }, barodampay: { app: "Bank of Baroda" }, cnrb: { app: "Canara Bank" }, unionbank: { app: "Union Bank" },
  indus: { app: "IndusInd Bank" }, federal: { app: "Federal Bank" }, idfcfirst: { app: "IDFC First Bank" }, aubank: { app: "AU Bank" }, dbs: { app: "DBS" }, rbl: { app: "RBL Bank" },
}

/** App names people type where the handle goes, mapped to the handles that app really uses. */
export const UPI_APP_ALIASES: Record<string, string[]> = {
  gpay: ["okaxis", "oksbi", "okhdfcbank", "okicici"], googlepay: ["okaxis", "oksbi", "okhdfcbank", "okicici"], okhdfc: ["okhdfcbank"],
  phonepe: ["ybl", "ibl", "axl"], phonepay: ["ybl", "ibl", "axl"], amazonpay: ["apl", "yapl"], bhim: ["upi"], whatsapp: ["waaxis", "wahdfcbank", "waicici", "wasbi"],
}

/**
 * Cleans a typed or pasted UPI ID: trims, lowercases, drops spaces around the @
 * and pulls `pa` out of a pasted upi://pay link. Also returns the link's `pn` (payee name).
 */
export function normalizeUpiId(raw: string): { vpa: string; linkName?: string } {
  const text = raw.trim()
  if (/^upi:\/\/pay\?/i.test(text)) {
    const params = new URLSearchParams(text.slice(text.indexOf("?") + 1))
    return { vpa: (params.get("pa") ?? "").toLowerCase().replace(/\s/g, ""), linkName: params.get("pn") ?? undefined }
  }
  return { vpa: text.toLowerCase().replace(/\s+/g, "").replace(/＠/g, "@") }
}

/** Damerau-Levenshtein (optimal string alignment): a swapped pair costs 1. */
function distance(a: string, b: string) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array<number>(b.length).fill(0)])
  for (let j = 1; j <= b.length; j++) d[0][j] = j
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++) {
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1)
    }
  return d[a.length][b.length]
}

export type UpiIssue =
  | { kind: "email"; message: string }
  | { kind: "no-handle"; message: string }
  | { kind: "bad-chars"; message: string }
  | { kind: "typo" | "app-name"; message: string; suggestions: string[] }
  | { kind: "phone-length"; message: string; fix?: string }
  | { kind: "unknown"; message: string }

/** Finds the likeliest slip in a cleaned UPI ID, or null when it looks right. */
export function findUpiIssue(vpa: string, handles: Record<string, UpiHandleInfo> = UPI_HANDLES): UpiIssue | null {
  if (!vpa) return null
  const at = vpa.lastIndexOf("@")
  if (at < 0) return /^\+?\d{10,12}$/.test(vpa) ? { kind: "no-handle", message: "Add the app handle after the number, like @ybl or @okaxis." } : null
  const [local, handle] = [vpa.slice(0, at), vpa.slice(at + 1)]
  if (!handle) return null
  if (handle.includes(".")) return { kind: "email", message: "That's an email address. UPI IDs end in a handle with no dot, like @oksbi." }
  if (!/^[a-z0-9._-]+$/.test(local) || !/^[a-z0-9]+$/.test(handle) || vpa.indexOf("@") !== at)
    return { kind: "bad-chars", message: "A UPI ID has one @ and only letters, digits, dots, dashes or underscores." }
  if (/^\d+$/.test(local) && local.length !== 10) {
    const trimmed = local.replace(/^(91|0)(?=[6-9]\d{9}$)/, "")
    return trimmed.length === 10
      ? { kind: "phone-length", message: "Drop the country code or 0: mobile UPI IDs use the 10-digit number.", fix: `${trimmed}@${handle}` }
      : { kind: "phone-length", message: `Mobile numbers have 10 digits; this has ${local.length}.` }
  }
  if (handles[handle]) return null
  if (UPI_APP_ALIASES[handle]) return { kind: "app-name", message: "That's the app's name, not its handle. Ask the payee which one theirs ends in:", suggestions: UPI_APP_ALIASES[handle] }
  const close = Object.keys(handles)
    .map((h) => [h, distance(handle, h)] as const)
    .filter(([h, d]) => d <= (h.length >= 6 ? 2 : 1))
    .sort((a, b) => a[1] - b[1])
  if (close.length) return { kind: "typo", message: "Looks like a typo in the handle.", suggestions: close.filter(([, d]) => d === close[0][1]).map(([h]) => h).slice(0, 3) }
  return { kind: "unknown", message: `@${handle} isn't a handle we know. It may be new; check it with the payee.` }
}

/** Name tokens for a loose comparison: lowercase, no titles or initials. */
const tokens = (name: string) =>
  name.toLowerCase().replace(/[^a-z\s]/g, " ").split(/\s+/).filter((t) => t.length > 1 && !["mr", "mrs", "ms", "dr", "shri", "smt"].includes(t))

/** True when every word of the expected name appears in the registered one (or the other way round). */
export function upiNamesMatch(expected: string, registered: string) {
  const [a, b] = [tokens(expected), tokens(registered)]
  if (!a.length || !b.length) return false
  const [short, long] = a.length <= b.length ? [a, b] : [b, a]
  return short.every((t) => long.includes(t))
}
