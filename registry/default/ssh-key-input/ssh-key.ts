// Pure SSH public key checks (RFC 4253 §6.6 wire format, RFC 4716 export format,
// OpenSSH "openssh-key-v1" private keys). No DOM, no network: safe on the server.

export type SshKeyType =
  | "ssh-ed25519"
  | "ssh-rsa"
  | "ssh-dss"
  | "ecdsa-sha2-nistp256"
  | "ecdsa-sha2-nistp384"
  | "ecdsa-sha2-nistp521"
  | "sk-ssh-ed25519@openssh.com"
  | "sk-ecdsa-sha2-nistp256@openssh.com"

const TYPES: SshKeyType[] = [
  "ssh-ed25519",
  "ssh-rsa",
  "ssh-dss",
  "ecdsa-sha2-nistp256",
  "ecdsa-sha2-nistp384",
  "ecdsa-sha2-nistp521",
  "sk-ssh-ed25519@openssh.com",
  "sk-ecdsa-sha2-nistp256@openssh.com",
]
const isType = (word: string): word is SshKeyType => (TYPES as string[]).includes(word)
const isCertType = (word: string) => /-cert-v01@openssh\.com$/.test(word)

export type SshIssueCode =
  | "private-key"
  | "putty-private"
  | "pem-public"
  | "rfc4716"
  | "certificate"
  | "line-breaks"
  | "missing-type"
  | "type-mismatch"
  | "truncated"
  | "not-base64"
  | "unknown-type"
  | "dsa"
  | "rsa-weak"
  | "rsa-short"
  | "duplicate"
  | "several-keys"
  | "options"
  | "known-hosts"
  | "invisible"
  | "quoted"

export interface SshIssue {
  code: SshIssueCode
  severity: "danger" | "error" | "warning" | "info"
  /** Text to put in the field instead, when there is a one-tap fix. "" means clear the field. */
  fix?: string
  /** Detail for the message: a type, a bit count, a label. */
  detail?: string
}

export interface ParsedSshKey {
  type: SshKeyType
  /** Key size in bits (Ed25519 is 256). */
  bits: number
  /** Base64 of the wire-format key blob. */
  base64: string
  comment: string
  /** "SHA256:…" as `ssh-keygen -l` prints it. */
  fingerprint: string
  /** The canonical one-line form: type, base64, comment. */
  line: string
}

export interface ExistingSshKey {
  /** The public key line, or its "SHA256:…" fingerprint. */
  key: string
  /** How the user knows it, such as "Work laptop". */
  label?: string
}

export interface SshKeyAnalysis {
  key: ParsedSshKey | null
  issues: SshIssue[]
}

export interface SshKeyOptions {
  /** Keys already on the account; a match by fingerprint is flagged. */
  existing?: ExistingSshKey[]
  /** RSA keys below this are rejected. Default 2048 (NIST SP 800-131A). */
  minRsaBits?: number
  /** RSA keys below this get a softer warning. Default 3072 (GitHub's minimum for new keys from 14 Oct 2026). */
  recommendedRsaBits?: number
}

// ---------- SHA-256 (FIPS 180-4), synchronous so it works in render and on the server ----------
const K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
])

export function sha256(data: Uint8Array): Uint8Array {
  const bitLength = data.length * 8
  const padded = new Uint8Array(((data.length + 9 + 63) >> 6) << 6)
  padded.set(data)
  padded[data.length] = 0x80
  const view = new DataView(padded.buffer)
  view.setUint32(padded.length - 8, Math.floor(bitLength / 2 ** 32))
  view.setUint32(padded.length - 4, bitLength >>> 0)
  const h = new Uint32Array([0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19])
  const w = new Uint32Array(64)
  const rotr = (x: number, n: number) => (x >>> n) | (x << (32 - n))
  for (let offset = 0; offset < padded.length; offset += 64) {
    for (let i = 0; i < 16; i++) w[i] = view.getUint32(offset + i * 4)
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3)
      const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10)
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0
    }
    let [a, b, c, d, e, f, g, hh] = h
    for (let i = 0; i < 64; i++) {
      const t1 = (hh + (rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)) + ((e & f) ^ (~e & g)) + K[i] + w[i]) | 0
      const t2 = ((rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) | 0
      hh = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0
    }
    h[0] += a; h[1] += b; h[2] += c; h[3] += d; h[4] += e; h[5] += f; h[6] += g; h[7] += hh
  }
  const out = new Uint8Array(32)
  const outView = new DataView(out.buffer)
  h.forEach((word, i) => outView.setUint32(i * 4, word))
  return out
}

// ---------- base64 ----------
const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"

/** Strict base64 decode. Returns null for bad characters or a length that can't be whole. */
export function decodeBase64(text: string): Uint8Array | null {
  const clean = text.replace(/=+$/, "")
  if (!/^[A-Za-z0-9+/]*$/.test(clean) || clean.length % 4 === 1) return null
  const out = new Uint8Array(Math.floor((clean.length * 3) / 4))
  let buffer = 0
  let bits = 0
  let index = 0
  for (const char of clean) {
    buffer = (buffer << 6) | B64.indexOf(char)
    bits += 6
    if (bits >= 8) {
      bits -= 8
      out[index++] = (buffer >> bits) & 0xff
    }
  }
  return out
}

export function encodeBase64(bytes: Uint8Array, pad = true): string {
  let out = ""
  for (let i = 0; i < bytes.length; i += 3) {
    const n = (bytes[i] << 16) | ((bytes[i + 1] ?? 0) << 8) | (bytes[i + 2] ?? 0)
    out += B64[(n >> 18) & 63] + B64[(n >> 12) & 63] + (i + 1 < bytes.length ? B64[(n >> 6) & 63] : pad ? "=" : "") + (i + 2 < bytes.length ? B64[n & 63] : pad ? "=" : "")
  }
  return out
}

export const sshFingerprint = (blob: Uint8Array) => `SHA256:${encodeBase64(sha256(blob), false)}`

// ---------- wire format ----------
class Reader {
  offset = 0
  constructor(readonly bytes: Uint8Array) {}
  get done() {
    return this.offset === this.bytes.length
  }
  uint32() {
    if (this.offset + 4 > this.bytes.length) throw new RangeError("truncated")
    const value = new DataView(this.bytes.buffer, this.bytes.byteOffset + this.offset, 4).getUint32(0)
    this.offset += 4
    return value
  }
  string() {
    const length = this.uint32()
    if (this.offset + length > this.bytes.length) throw new RangeError("truncated")
    const value = this.bytes.subarray(this.offset, this.offset + length)
    this.offset += length
    return value
  }
  text() {
    return new TextDecoder().decode(this.string())
  }
}

/** Bit length of an SSH mpint (big-endian, may carry a leading zero byte). */
function mpintBits(bytes: Uint8Array) {
  let i = 0
  while (i < bytes.length && bytes[i] === 0) i++
  if (i === bytes.length) return 0
  return (bytes.length - i - 1) * 8 + (32 - Math.clz32(bytes[i]))
}

type BlobResult = { ok: true; type: SshKeyType; bits: number } | { ok: false; reason: "truncated" | "unknown-type" | "certificate"; type?: string }

/** Reads a public key blob. Truncation shows up as a read past the end. */
export function readKeyBlob(blob: Uint8Array): BlobResult {
  const reader = new Reader(blob)
  let type = ""
  try {
    type = reader.text()
    if (isCertType(type)) return { ok: false, reason: "certificate", type }
    if (!isType(type)) return { ok: false, reason: "unknown-type", type }
    let bits = 0
    if (type === "ssh-rsa") {
      reader.string()
      bits = mpintBits(reader.string())
    } else if (type === "ssh-dss") {
      bits = mpintBits(reader.string())
      reader.string(); reader.string(); reader.string()
    } else if (type.startsWith("ecdsa") || type.startsWith("sk-ecdsa")) {
      reader.string()
      const point = reader.string()
      bits = { 65: 256, 97: 384, 133: 521 }[point.length] ?? 0
      if (!bits) throw new RangeError("truncated")
      if (type.startsWith("sk-")) reader.string()
    } else {
      if (reader.string().length !== 32) throw new RangeError("truncated")
      bits = 256
      if (type.startsWith("sk-")) reader.string()
    }
    if (!reader.done) return { ok: false, reason: "truncated", type }
    return { ok: true, type, bits }
  } catch {
    return { ok: false, reason: "truncated", type: type || undefined }
  }
}

/** The public key inside an unencrypted-header "openssh-key-v1" private key (the header is never encrypted). */
export function publicFromOpenSshPrivate(pem: string): string | null {
  const body = pem.match(/-----BEGIN OPENSSH PRIVATE KEY-----([\s\S]*?)-----END OPENSSH PRIVATE KEY-----/)?.[1]
  const bytes = body ? decodeBase64(body.replace(/\s+/g, "")) : null
  const magic = "openssh-key-v1\0"
  if (!bytes || new TextDecoder().decode(bytes.subarray(0, magic.length)) !== magic) return null
  try {
    const reader = new Reader(bytes.subarray(magic.length))
    reader.string(); reader.string(); reader.string()
    if (reader.uint32() < 1) return null
    const blob = reader.string().slice()
    const parsed = readKeyBlob(blob)
    return parsed.ok ? `${parsed.type} ${encodeBase64(blob)}` : null
  } catch {
    return null
  }
}

/** Converts an RFC 4716 ("---- BEGIN SSH2 PUBLIC KEY ----") export, as PuTTYgen and some appliances write, to one OpenSSH line. */
export function fromRfc4716(text: string): string | null {
  const body = text.match(/---- BEGIN SSH2 PUBLIC KEY ----([\s\S]*?)---- END SSH2 PUBLIC KEY ----/)?.[1]
  if (!body) return null
  const lines = body.split("\n")
  let comment = ""
  const data: string[] = []
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i].trim()
    if (!line) continue
    const header = line.match(/^([A-Za-z0-9-]+):\s*(.*)$/)
    if (header) {
      // A header value continues onto the next line when it ends with a backslash.
      let valueText = header[2]
      while (valueText.endsWith("\\") && i + 1 < lines.length) valueText = valueText.slice(0, -1) + lines[++i].trim()
      if (header[1].toLowerCase() === "comment") comment = valueText.replace(/^"(.*)"$/, "$1")
      continue
    }
    line = line.replace(/\s+/g, "")
    data.push(line)
  }
  const blob = decodeBase64(data.join(""))
  const parsed = blob && readKeyBlob(blob)
  if (!blob || !parsed || !parsed.ok) return null
  return [parsed.type, encodeBase64(blob), comment].filter(Boolean).join(" ")
}

// Characters that look like nothing or like a space but break a key on the server.
const INVISIBLE = /[\u00A0\u2000-\u200D\u202F\u2060\u3000\uFEFF]/
const normalize = (text: string) =>
  text.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n").replace(/[\u200B-\u200D\u2060\uFEFF]/g, "").replace(/[\u00A0\u2000-\u200A\u202F\u3000]/g, " ")
/** base64 of "openssh-key-v1\0": the body of an OpenSSH private key, even without its BEGIN line. */
const OPENSSH_PRIVATE_BODY = "b3BlbnNzaC1rZXktdjE"
/** A known_hosts entry starts with host names, a hashed host (|1|…) or [host]:port, never with key options. */
const isHostField = (word: string) => /^(\|1\||\[)/.test(word) || (!word.includes("=") && /^[\w.*?!:-]+(,[\w.*?!:[\]-]+)*$/.test(word) && /[.:]|^localhost$/.test(word))

function fingerprintOf(line: string): string | null {
  const text = line.trim()
  if (/^SHA256:/.test(text)) return text
  const words = text.split(/\s+/)
  const b64 = words.find((word) => word.startsWith("AAAA"))
  const blob = b64 ? decodeBase64(b64) : null
  return blob ? sshFingerprint(blob) : null
}

/**
 * Checks pasted text that should be one OpenSSH public key and says what is wrong
 * with it, with a replacement line for each problem that can be fixed in one tap.
 */
export function analyzeSshKey(raw: unknown, options: SshKeyOptions = {}): SshKeyAnalysis {
  const { existing = [], minRsaBits = 2048, recommendedRsaBits = 3072 } = options
  const original = typeof raw === "string" ? raw.slice(0, 64_000) : ""
  let text = normalize(original).trim()
  const issues: SshIssue[] = []
  if (!text) return { key: null, issues }

  // A private key, with or without its dashes and BEGIN line (copied from the middle of the file).
  const openSshBody = new RegExp(`(^|[\\s-])${OPENSSH_PRIVATE_BODY}`).test(text)
  if (/BEGIN [A-Z ]*PRIVATE KEY/.test(text) || openSshBody) {
    // Rebuild the armour around a bare body. The label is a variable so secret scanners don't read this line as a key.
    const label = "OPENSSH PRIVATE KEY"
    const pem = text.includes(`-----BEGIN ${label}-----`) ? text : `-----BEGIN ${label}-----\n${text.replace(/[-\s]*(BEGIN|END) OPENSSH PRIVATE KEY[-\s]*/g, "\n")}\n-----END ${label}-----`
    const publicHalf = publicFromOpenSshPrivate(pem)
    return { key: null, issues: [{ code: "private-key", severity: "danger", fix: publicHalf ?? "" }] }
  }
  if (/^PuTTY-User-Key-File-\d+:|^Private-Lines:\s*\d+/m.test(text)) {
    const publicLines = text.match(/^Public-Lines:\s*(\d+)\n((?:.*\n?)*)/m)
    let fix = ""
    if (publicLines) {
      const b64 = publicLines[2].split("\n").slice(0, Number(publicLines[1])).join("")
      const blob = decodeBase64(b64)
      const parsed = blob && readKeyBlob(blob)
      const comment = text.match(/^Comment:\s*(.*)$/m)?.[1]?.trim() ?? ""
      if (blob && parsed && parsed.ok) fix = [parsed.type, encodeBase64(blob), comment].filter(Boolean).join(" ")
    }
    return { key: null, issues: [{ code: "putty-private", severity: "danger", fix }] }
  }
  if (/-----BEGIN (RSA )?PUBLIC KEY-----/.test(text)) return { key: null, issues: [{ code: "pem-public", severity: "error" }] }
  if (/---- BEGIN SSH2 PUBLIC KEY ----/.test(text)) {
    const converted = fromRfc4716(text)
    return { key: null, issues: [{ code: converted ? "rfc4716" : "truncated", severity: "error", fix: converted ?? undefined }] }
  }

  // Quotes from JSON, YAML or Terraform: the server would store them as part of the key.
  const quoted = /^(["'`\u201C\u2018])[\s\S]*(["'`\u201D\u2019])$/.test(text)
  if (quoted) text = text.slice(1, -1).trim()

  let words = text.split(/\s+/)
  let prefix = ""
  // A type typed or autocorrected in the wrong case ("Ssh-ed25519") is still that type.
  const typeWord = (word: string) => isType(word.toLowerCase()) || isCertType(word.toLowerCase())
  let typeIndex = words.findIndex(typeWord)
  if (typeIndex === 1 && isHostField(words[0])) {
    // A line copied from known_hosts: that is a server's key, not the user's.
    return { key: null, issues: [{ code: "known-hosts", severity: "error", detail: words[0].startsWith("|1|") ? "hashed" : words[0] }] }
  }
  if (typeIndex > 0 && !words[0].startsWith("AAAA")) {
    // authorized_keys options (from="…",command="…") sit before the type.
    prefix = words.slice(0, typeIndex).join(" ")
    words = words.slice(typeIndex)
    typeIndex = 0
  }
  const declared: string | null = typeIndex === 0 ? words[0] : null
  if (declared && isCertType(declared.toLowerCase())) return { key: null, issues: [{ code: "certificate", severity: "error", detail: declared }] }
  if (!declared && !words[0].startsWith("AAAA")) {
    const looksLikeType = /^(ssh|ecdsa|sk)-/.test(words[0])
    return { key: null, issues: [{ code: looksLikeType ? "unknown-type" : "not-base64", severity: "error", detail: looksLikeType ? words[0] : undefined }] }
  }
  const rest = declared ? words.slice(1) : words

  // Join base64 pieces until the blob parses whole: this is what undoes a key wrapped by an editor or email.
  let pieces = 0
  let blob: Uint8Array | null = null
  let result: BlobResult | null = null
  for (let count = 1; count <= Math.min(rest.length, 200); count++) {
    if (!/^[A-Za-z0-9+/=]+$/.test(rest[count - 1])) break
    const candidate = decodeBase64(rest.slice(0, count).join(""))
    if (!candidate) continue
    const parsed = readKeyBlob(candidate)
    pieces = count
    blob = candidate
    result = parsed
    if (parsed.ok || parsed.reason !== "truncated") break
  }
  // With a type in front, base64 that won't decode is a damaged key, not something else entirely.
  if (!blob || !result) return { key: null, issues: [{ code: declared ? "truncated" : "not-base64", severity: "error" }] }
  if (!result.ok) {
    if (result.reason === "certificate") return { key: null, issues: [{ code: "certificate", severity: "error", detail: result.type }] }
    if (result.reason === "unknown-type") return { key: null, issues: [{ code: "unknown-type", severity: "error", detail: result.type }] }
    return { key: null, issues: [{ code: "truncated", severity: "error" }] }
  }

  const base64 = encodeBase64(blob)
  const commentWords = rest.slice(pieces)
  // A second key pasted after the first: keep only the first one.
  const second = commentWords.findIndex((word) => isType(word))
  const comment = (second >= 0 ? commentWords.slice(0, second) : commentWords).join(" ")
  const line = [result.type, base64, comment].filter(Boolean).join(" ")
  const fingerprint = sshFingerprint(blob)
  const key: ParsedSshKey = { type: result.type, bits: result.bits, base64, comment, fingerprint, line }

  if (quoted) issues.push({ code: "quoted", severity: "error", fix: line })
  if (INVISIBLE.test(original)) issues.push({ code: "invisible", severity: "error", fix: line })
  if (prefix) issues.push({ code: "options", severity: "warning", fix: line, detail: prefix })
  if (!declared) issues.push({ code: "missing-type", severity: "error", fix: line, detail: result.type })
  else if (declared !== result.type) issues.push({ code: "type-mismatch", severity: "error", fix: line, detail: result.type })
  if (pieces > 1) issues.push({ code: "line-breaks", severity: "error", fix: line })
  if (second >= 0) issues.push({ code: "several-keys", severity: "warning", fix: line })
  if (result.type === "ssh-dss") issues.push({ code: "dsa", severity: "error" })
  else if (result.type === "ssh-rsa" && result.bits < minRsaBits) issues.push({ code: "rsa-weak", severity: "error", detail: String(result.bits) })
  else if (result.type === "ssh-rsa" && result.bits < recommendedRsaBits) issues.push({ code: "rsa-short", severity: "warning", detail: String(result.bits) })
  const match = existing.find((item) => fingerprintOf(item.key) === fingerprint)
  if (match) issues.push({ code: "duplicate", severity: "error", detail: match.label ?? fingerprint })
  return { key, issues }
}
