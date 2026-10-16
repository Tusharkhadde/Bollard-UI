// Bollard UI — cert-paste-check · MIT licence · https://bollard-ui.vercel.app/components/cert-paste-check

// Pure PEM / X.509 reading (RFC 7468 PEM, RFC 5280 certificates, RFC 2986 CSRs,
// RFC 5208/5958 PKCS#8, RFC 8017 PKCS#1, RFC 5915 SEC1) and the checks a TLS paste needs.
// A small DER reader, no crypto: signatures are not verified.

export type PemKind = "certificate" | "csr" | "private-key" | "encrypted-key" | "public-key" | "other"

export interface CertInfo {
  subject: string
  issuer: string
  /** Raw DER of subject and issuer, hex, for exact chaining. */
  subjectDer: string
  issuerDer: string
  serial: string
  notBefore: number
  notAfter: number
  dnsNames: string[]
  ipAddresses: string[]
  isCa: boolean
  selfSigned: boolean
  keyId?: string
  authorityKeyId?: string
  /** "RSA 2048", "EC P-256", "Ed25519". */
  keyLabel: string
  keyBits?: number
  /** Public key fingerprint material (RSA modulus or EC point, hex) for matching a private key. */
  publicKey?: string
  sha1Signature: boolean
}

export interface PemBlock {
  kind: PemKind
  label: string
  /** Start and end offsets in the normalised text. */
  start: number
  end: number
  text: string
  cert?: CertInfo
  /** For keys and CSRs. */
  keyLabel?: string
  publicKey?: string
  /** For CSRs. */
  subject?: string
  dnsNames?: string[]
  broken?: boolean
}

export type CertIssueCode =
  | "no-pem"
  | "der-base64"
  | "truncated"
  | "broken-block"
  | "key-in-cert-field"
  | "csr-not-cert"
  | "public-key"
  | "wrong-order"
  | "not-in-chain"
  | "missing-intermediate"
  | "root-included"
  | "expired"
  | "not-yet-valid"
  | "expires-soon"
  | "too-long"
  | "host-mismatch"
  | "cn-only"
  | "self-signed"
  | "key-mismatch"
  | "key-match"
  | "key-encrypted"
  | "key-unknown"
  | "weak-key"
  | "sha1"
  | "escaped-newlines"
  | "pkcs7"
  | "ca-as-leaf"

export interface CertIssue {
  code: CertIssueCode
  severity: "danger" | "error" | "warning" | "info" | "ok"
  /** Index of the block it is about. */
  block?: number
  detail?: string
  days?: number
  /** Replacement text for a one-tap fix. */
  fix?: string
}

export interface CertCheckOptions {
  /** What the field is for. "chain" (default) takes a certificate plus intermediates. */
  expect?: "chain" | "certificate" | "private-key" | "csr"
  /** The domain the certificate must cover. */
  hostname?: string
  /** A private key from another field to match against the certificate. */
  privateKey?: string
  /** Self-signed certificates are errors in production. */
  production?: boolean
  now: number
  /** Warn when fewer days than this remain. Default 30. */
  warnDays?: number
}

export interface CertAnalysis {
  blocks: PemBlock[]
  /** Index of the server (leaf) certificate, if found. */
  leaf: number
  issues: CertIssue[]
}

// ---------- DER ----------
interface Node {
  tag: number
  start: number
  header: number
  length: number
  bytes: Uint8Array
}
const contentOf = (node: Node) => node.bytes.subarray(node.start + node.header, node.start + node.header + node.length)

function readNode(bytes: Uint8Array, offset = 0): Node {
  if (offset + 2 > bytes.length) throw new RangeError("der")
  const tag = bytes[offset]
  let length = bytes[offset + 1]
  let header = 2
  if (length & 0x80) {
    const count = length & 0x7f
    if (count < 1 || count > 4 || offset + 2 + count > bytes.length) throw new RangeError("der")
    length = 0
    for (let i = 0; i < count; i++) length = length * 256 + bytes[offset + 2 + i]
    header += count
  }
  if (offset + header + length > bytes.length) throw new RangeError("der")
  return { tag, start: offset, header, length, bytes }
}

function children(node: Node): Node[] {
  const content = contentOf(node)
  const out: Node[] = []
  let offset = 0
  while (offset < content.length && out.length < 500) {
    const child = readNode(content, offset)
    out.push(child)
    offset += child.header + child.length
  }
  return out
}

const hex = (bytes: Uint8Array) => Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("")
const rawOf = (node: Node) => node.bytes.subarray(node.start, node.start + node.header + node.length)
const stripZeros = (bytes: Uint8Array) => {
  let i = 0
  while (i < bytes.length - 1 && bytes[i] === 0) i++
  return bytes.subarray(i)
}

function oid(node: Node): string {
  const bytes = contentOf(node)
  if (!bytes.length) return ""
  const parts = [Math.floor(bytes[0] / 40), bytes[0] % 40]
  let value = 0
  for (let i = 1; i < bytes.length; i++) {
    value = value * 128 + (bytes[i] & 0x7f)
    if (bytes[i] & 0x80) continue
    parts.push(value)
    value = 0
  }
  return parts.join(".")
}

const text = (node: Node) => {
  const bytes = contentOf(node)
  if (node.tag === 0x1e) {
    let out = ""
    for (let i = 0; i + 1 < bytes.length; i += 2) out += String.fromCharCode((bytes[i] << 8) | bytes[i + 1])
    return out
  }
  return new TextDecoder().decode(bytes)
}

function readTime(node: Node): number {
  const value = text(node)
  const match = node.tag === 0x17 ? value.match(/^(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})?Z$/) : value.match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})?(?:\.\d+)?Z$/)
  if (!match) return Number.NaN
  let year = Number(match[1])
  if (node.tag === 0x17) year += year < 50 ? 2000 : 1900
  return Date.UTC(year, Number(match[2]) - 1, Number(match[3]), Number(match[4]), Number(match[5]), Number(match[6] ?? 0))
}

const NAME_OIDS: Record<string, string> = { "2.5.4.3": "CN", "2.5.4.10": "O", "2.5.4.11": "OU", "2.5.4.6": "C", "2.5.4.7": "L", "2.5.4.8": "ST" }
function readName(node: Node): { label: string; cn?: string } {
  const parts: string[] = []
  let cn: string | undefined
  for (const set of children(node))
    for (const pair of children(set)) {
      const [type, value] = children(pair)
      if (!type || !value) continue
      const key = NAME_OIDS[oid(type)]
      if (!key) continue
      const valueText = text(value)
      if (key === "CN") cn ??= valueText
      parts.push(`${key}=${valueText}`)
    }
  return { label: cn ?? parts.join(", "), cn }
}

const CURVES: Record<string, [string, number]> = { "1.2.840.10045.3.1.7": ["P-256", 256], "1.3.132.0.34": ["P-384", 384], "1.3.132.0.35": ["P-521", 521] }

/** Reads a SubjectPublicKeyInfo into a label and comparable key material. */
function readSpki(node: Node): { label: string; bits?: number; material?: string } {
  const [algorithm, keyBits] = children(node)
  const [algOid, params] = children(algorithm)
  const id = oid(algOid)
  const key = contentOf(keyBits).subarray(1)
  if (id === "1.2.840.113549.1.1.1") {
    const [modulus] = children(readNode(key))
    const n = stripZeros(contentOf(modulus))
    const bits = n.length * 8 - (Math.clz32(n[0]) - 24)
    return { label: `RSA ${bits}`, bits, material: `rsa:${hex(n)}` }
  }
  if (id === "1.2.840.10045.2.1") {
    const [name, bits] = (params && CURVES[oid(params)]) || ["EC", undefined]
    return { label: `EC ${name}`, bits, material: `ec:${hex(key)}` }
  }
  if (id === "1.3.101.112") return { label: "Ed25519", bits: 256, material: `ed:${hex(key)}` }
  if (id === "1.3.101.113") return { label: "Ed448", bits: 448, material: `ed:${hex(key)}` }
  return { label: "Unknown key" }
}

/** RFC 5952 text form: lowercase, no leading zeros, the longest run of zero groups as "::". */
function compressIpv6(groups: number[]): string {
  let best = [-1, 0]
  for (let i = 0; i < groups.length; i++) {
    let j = i
    while (j < groups.length && groups[j] === 0) j++
    if (j - i > Math.max(1, best[1])) best = [i, j - i]
    i = j
  }
  const hexes = groups.map((group) => group.toString(16))
  if (best[0] < 0) return hexes.join(":")
  return `${hexes.slice(0, best[0]).join(":")}::${hexes.slice(best[0] + best[1]).join(":")}`
}

/** An IPv6 address in RFC 5952 form, or null when the text isn't one. */
function normalizeIpv6(text: string): string | null {
  const [head, tail, extra] = text.split("::")
  if (extra !== undefined) return null
  const parse = (part: string) => (part ? part.split(":") : [])
  const left = parse(head)
  const right = tail === undefined ? [] : parse(tail)
  const missing = 8 - left.length - right.length
  if ((tail === undefined && missing !== 0) || missing < 0) return null
  const all = [...left, ...Array(tail === undefined ? 0 : missing).fill("0"), ...right]
  if (all.length !== 8 || all.some((group) => !/^[0-9a-f]{1,4}$/i.test(group))) return null
  return compressIpv6(all.map((group) => Number.parseInt(group, 16)))
}

/** What people type for a host: "https://Shop.acme.com:443/cart" means "shop.acme.com". */
export function normalizeHost(input: string): string {
  let host = input.trim().toLowerCase().replace(/^[a-z][a-z0-9+.-]*:\/\//, "").replace(/[/?#].*$/, "").replace(/^[^@]*@/, "")
  const bracketed = host.match(/^\[([^\]]+)\](:\d+)?$/)
  if (bracketed) host = bracketed[1]
  else if (/^[^:]+:\d+$/.test(host)) host = host.replace(/:\d+$/, "")
  if (host.includes(":")) return normalizeIpv6(host) ?? host
  return host.replace(/\.$/, "")
}

function readSan(extensionValue: Uint8Array, dns: string[], ips: string[]) {
  for (const name of children(readNode(extensionValue))) {
    const content = contentOf(name)
    if (name.tag === 0x82) dns.push(new TextDecoder().decode(content).toLowerCase())
    else if (name.tag === 0x87) ips.push(content.length === 4 ? Array.from(content).join(".") : compressIpv6(Array.from({ length: content.length / 2 }, (_, i) => (content[i * 2] << 8) | content[i * 2 + 1])))
  }
}

export function parseCertificate(der: Uint8Array): CertInfo {
  const [tbs, sigAlg] = children(readNode(der))
  const fields = children(tbs)
  let index = fields[0]?.tag === 0xa0 ? 1 : 0
  const serial = hex(contentOf(fields[index++]))
  index++ // signature algorithm inside tbs
  const issuerNode = fields[index++]
  const [notBefore, notAfter] = children(fields[index++])
  const subjectNode = fields[index++]
  const spki = readSpki(fields[index++])
  const dnsNames: string[] = []
  const ipAddresses: string[] = []
  let isCa = false
  let keyId: string | undefined
  let authorityKeyId: string | undefined
  const extensions = fields.find((field) => field.tag === 0xa3)
  if (extensions)
    for (const extension of children(children(extensions)[0])) {
      const parts = children(extension)
      const id = oid(parts[0])
      const value = contentOf(parts[parts.length - 1])
      if (id === "2.5.29.17") readSan(value, dnsNames, ipAddresses)
      else if (id === "2.5.29.19") isCa = children(readNode(value)).some((child) => child.tag === 0x01 && contentOf(child)[0] !== 0)
      else if (id === "2.5.29.14") keyId = hex(contentOf(readNode(value)))
      else if (id === "2.5.29.35") {
        const first = children(readNode(value)).find((child) => child.tag === 0x80)
        if (first) authorityKeyId = hex(contentOf(first))
      }
    }
  const subjectDer = hex(rawOf(subjectNode))
  const issuerDer = hex(rawOf(issuerNode))
  const sigOid = oid(children(sigAlg)[0])
  return {
    subject: readName(subjectNode).label,
    issuer: readName(issuerNode).label,
    subjectDer,
    issuerDer,
    serial,
    notBefore: readTime(notBefore),
    notAfter: readTime(notAfter),
    dnsNames,
    ipAddresses,
    isCa,
    selfSigned: subjectDer === issuerDer && (!authorityKeyId || !keyId || authorityKeyId === keyId),
    keyId,
    authorityKeyId,
    keyLabel: spki.label,
    keyBits: spki.bits,
    publicKey: spki.material,
    sha1Signature: sigOid === "1.2.840.113549.1.1.5" || sigOid === "1.2.840.10045.4.1",
  }
}

/** Public key material from a private key, so it can be matched to a certificate. */
function privateKeyMaterial(label: string, der: Uint8Array): { label: string; material?: string } {
  const root = readNode(der)
  const parts = children(root)
  if (label === "RSA PRIVATE KEY") {
    const n = stripZeros(contentOf(parts[1]))
    return { label: `RSA ${n.length * 8 - (Math.clz32(n[0]) - 24)}`, material: `rsa:${hex(n)}` }
  }
  if (label === "EC PRIVATE KEY") {
    const publicKey = parts.find((part) => part.tag === 0xa1)
    const curve = parts.find((part) => part.tag === 0xa0)
    const name = curve ? (CURVES[oid(children(curve)[0])]?.[0] ?? "EC") : "EC"
    return { label: `EC ${name}`, material: publicKey ? `ec:${hex(contentOf(children(publicKey)[0]).subarray(1))}` : undefined }
  }
  // PKCS#8 / OneAsymmetricKey: version, algorithm, privateKey OCTET STRING, [0] attributes, [1] publicKey
  const [algOid, params] = children(parts[1])
  const id = oid(algOid)
  const inner = contentOf(parts[2])
  if (id === "1.2.840.113549.1.1.1") return privateKeyMaterial("RSA PRIVATE KEY", inner)
  if (id === "1.2.840.10045.2.1") {
    const sec1 = privateKeyMaterial("EC PRIVATE KEY", inner)
    const name = params ? (CURVES[oid(params)]?.[0] ?? "EC") : "EC"
    return { label: `EC ${name}`, material: sec1.material }
  }
  if (id === "1.3.101.112") {
    const publicKey = parts.find((part) => part.tag === 0x81 || part.tag === 0xa1)
    return { label: "Ed25519", material: publicKey ? `ed:${hex(contentOf(publicKey).subarray(publicKey.tag === 0x81 ? 1 : 0))}` : undefined }
  }
  return { label: "Private key" }
}

function readCsr(der: Uint8Array) {
  const [info] = children(readNode(der))
  const [, subject, spki, attributes] = children(info)
  const key = readSpki(spki)
  const dnsNames: string[] = []
  if (attributes?.tag === 0xa0)
    for (const attribute of children(attributes)) {
      const [type, values] = children(attribute)
      if (oid(type) !== "1.2.840.113549.1.9.14") continue
      for (const extension of children(children(values)[0])) {
        const parts = children(extension)
        if (oid(parts[0]) === "2.5.29.17") readSan(contentOf(parts[parts.length - 1]), dnsNames, [])
      }
    }
  return { subject: readName(subject).label, keyLabel: key.label, publicKey: key.material, dnsNames }
}

const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"
export function base64ToBytes(input: string): Uint8Array | null {
  const clean = input.replace(/\s+/g, "").replace(/=+$/, "")
  if (!clean || !/^[A-Za-z0-9+/]*$/.test(clean) || clean.length % 4 === 1) return null
  const out = new Uint8Array(Math.floor((clean.length * 3) / 4))
  let buffer = 0
  let bits = 0
  let index = 0
  for (const char of clean) {
    buffer = ((buffer << 6) | B64.indexOf(char)) & 0xffffff
    bits += 6
    if (bits >= 8) {
      bits -= 8
      out[index++] = (buffer >> bits) & 0xff
    }
  }
  return out
}

const normalize = (input: unknown) => (typeof input === "string" ? input : "").replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n").slice(0, 200_000)

const kindOf = (label: string): PemKind =>
  label === "CERTIFICATE" || label === "TRUSTED CERTIFICATE" || label === "X509 CERTIFICATE"
    ? "certificate"
    : /CERTIFICATE REQUEST/.test(label)
      ? "csr"
      : label === "ENCRYPTED PRIVATE KEY"
        ? "encrypted-key"
        : /PRIVATE KEY/.test(label)
          ? "private-key"
          : /PUBLIC KEY/.test(label)
            ? "public-key"
            : "other"

/** Finds every PEM block, reading each one it understands. A block that won't parse is marked broken. */
export function readPemBlocks(input: unknown): PemBlock[] {
  const source = normalize(input)
  const blocks: PemBlock[] = []
  const pattern = /-----BEGIN ([A-Z0-9 ]+)-----([\s\S]*?)-----END ([A-Z0-9 ]+)-----/g
  for (const match of source.matchAll(pattern)) {
    if (blocks.length >= 20) break
    const label = match[1]
    let kind = kindOf(label)
    const block: PemBlock = { kind, label, start: match.index ?? 0, end: (match.index ?? 0) + match[0].length, text: match[0] }
    const body = match[2]
    if (match[3] !== label) block.broken = true
    if (/Proc-Type:\s*4,ENCRYPTED/.test(body)) kind = block.kind = "encrypted-key"
    const der = base64ToBytes(body.replace(/^[A-Za-z-]+:.*$/gm, ""))
    try {
      if (!der) throw new RangeError("base64")
      if (kind === "certificate") block.cert = parseCertificate(der)
      else if (kind === "csr") Object.assign(block, readCsr(der))
      else if (kind === "private-key" && label !== "OPENSSH PRIVATE KEY") {
        const key = privateKeyMaterial(label, der)
        block.keyLabel = key.label
        block.publicKey = key.material
      }
    } catch {
      block.broken = true
    }
    blocks.push(block)
  }
  return blocks
}

/** RFC 6125 §6.4.3: a wildcard is the whole left-most label and stands for exactly one label. */
export function hostMatches(pattern: string, host: string): boolean {
  const name = pattern.toLowerCase().replace(/\.$/, "")
  const target = host.toLowerCase().replace(/\.$/, "")
  if (!name.startsWith("*.")) return name === target
  const rest = name.slice(2)
  const dot = target.indexOf(".")
  return dot > 0 && target.slice(dot + 1) === rest && rest.includes(".")
}

/**
 * Validity period in days as the Baseline Requirements count it: notBefore through notAfter
 * inclusive (RFC 5280), where any part of a day beyond 86,400 seconds counts as another day (§6.3.2).
 */
export function validityDays(notBefore: number, notAfter: number): number {
  return Math.ceil((notAfter - notBefore + 1000) / 86_400_000)
}

/** Maximum lifetime for a publicly trusted TLS certificate (CA/Browser Forum Baseline Requirements §6.3.2, ballot SC-081). */
export function maxPublicValidityDays(issued: number): number {
  if (issued >= Date.UTC(2029, 2, 15)) return 47
  if (issued >= Date.UTC(2027, 2, 15)) return 100
  if (issued >= Date.UTC(2026, 2, 15)) return 200
  return 398
}

const DAY = 86_400_000
const issuedBy = (child: CertInfo, parent: CertInfo) =>
  child.issuerDer === parent.subjectDer && (!child.authorityKeyId || !parent.keyId || child.authorityKeyId === parent.keyId)

/** Orders certificates leaf first, each followed by its issuer. */
function orderChain(certs: { index: number; cert: CertInfo }[]): number[] {
  const leaf = certs.find(({ cert }) => !certs.some((other) => other.cert !== cert && issuedBy(other.cert, cert) && !other.cert.selfSigned)) ?? certs[0]
  const order = [leaf.index]
  let current = leaf.cert
  while (order.length < certs.length) {
    const next = certs.find(({ index, cert }) => !order.includes(index) && !current.selfSigned && issuedBy(current, cert))
    if (!next) break
    order.push(next.index)
    current = next.cert
  }
  return order
}

/** Reads a PEM paste and lists every problem a server or browser would hit, with fixes where the text can be rewritten. */
export function checkCertPaste(input: unknown, options: CertCheckOptions): CertAnalysis {
  const { expect = "chain", hostname, privateKey, production = false, now, warnDays = 30 } = options
  let source = normalize(input)
  const issues: CertIssue[] = []
  if (!source.trim()) return { blocks: [], leaf: -1, issues }
  // PEM copied out of JSON, an env var or a Kubernetes secret: "\n" written as two characters.
  if (/-----BEGIN [A-Z0-9 ]+-----(?:\\r)?\\n/.test(source)) {
    source = source.trim().replace(/^(["'])([\s\S]*)\1$/, "$2").replace(/\\r\\n|\\n/g, "\n").trim() + "\n"
    issues.push({ code: "escaped-newlines", severity: "error", fix: source })
  }
  const blocks = readPemBlocks(source)

  if (!blocks.length) {
    const begin = source.match(/-----BEGIN ([A-Z0-9 ]+)-----/)
    if (begin) return { blocks, leaf: -1, issues: [{ code: "truncated", severity: "error", detail: begin[1] }] }
    const der = base64ToBytes(source)
    if (der && der[0] === 0x30) {
      try {
        parseCertificate(der)
        const body = source.replace(/\s+/g, "").match(/.{1,64}/g)?.join("\n") ?? ""
        return { blocks, leaf: -1, issues: [{ code: "der-base64", severity: "error", fix: `-----BEGIN CERTIFICATE-----\n${body}\n-----END CERTIFICATE-----\n` }] }
      } catch {
        // not a certificate; fall through
      }
    }
    return { blocks, leaf: -1, issues: [{ code: "no-pem", severity: "error" }] }
  }
  const lastEnd = blocks[blocks.length - 1].end
  if (/-----BEGIN [A-Z0-9 ]+-----/.test(source.slice(lastEnd))) issues.push({ code: "truncated", severity: "error", detail: source.slice(lastEnd).match(/-----BEGIN ([A-Z0-9 ]+)-----/)?.[1] })
  blocks.forEach((block, index) => block.broken && issues.push({ code: "broken-block", severity: "error", block: index, detail: block.label }))

  const without = (index: number) => {
    const block = blocks[index]
    return (source.slice(0, block.start) + source.slice(block.end)).replace(/\n{3,}/g, "\n\n").trim() + "\n"
  }
  blocks.forEach((block, index) => {
    if ((block.kind === "private-key" || block.kind === "encrypted-key") && expect !== "private-key") issues.push({ code: "key-in-cert-field", severity: "danger", block: index, fix: without(index) })
    if (block.kind === "csr" && expect !== "csr") issues.push({ code: "csr-not-cert", severity: "error", block: index, fix: blocks.length > 1 ? without(index) : undefined })
    if (block.kind === "public-key") issues.push({ code: "public-key", severity: "error", block: index })
    if (/^(PKCS7|CMS)$/.test(block.label)) issues.push({ code: "pkcs7", severity: "error", block: index })
  })

  const certs = blocks.flatMap((block, index) => (block.cert && !block.broken ? [{ index, cert: block.cert }] : []))
  let leaf = -1
  if (certs.length) {
    const order = orderChain(certs)
    leaf = order[0]
    const leafCert = blocks[leaf].cert as CertInfo
    const strays = certs.filter(({ index }) => !order.includes(index))
    strays.forEach(({ index }) => issues.push({ code: "not-in-chain", severity: "warning", block: index, fix: without(index) }))
    const positions = certs.map(({ index }) => index).filter((index) => order.includes(index))
    if (order.some((index, i) => positions[i] !== index)) {
      // Rebuild the text with the certificates in chain order, other blocks after them.
      const rest = blocks.filter((_, index) => !order.includes(index)).map((block) => block.text)
      issues.push({ code: "wrong-order", severity: "error", fix: [...order.map((index) => blocks[index].text), ...rest].join("\n") + "\n" })
    }
    const top = blocks[order[order.length - 1]].cert as CertInfo
    if (leafCert.isCa && !leafCert.selfSigned && expect !== "private-key") issues.push({ code: "ca-as-leaf", severity: "error", block: leaf })
    else if (order.length === 1 && !leafCert.selfSigned && expect === "chain") issues.push({ code: "missing-intermediate", severity: "warning", detail: leafCert.issuer })
    if (order.length > 1 && top.selfSigned) issues.push({ code: "root-included", severity: "info", block: order[order.length - 1], fix: without(order[order.length - 1]) })

    order.forEach((index) => {
      const cert = blocks[index].cert as CertInfo
      const daysLeft = Math.floor((cert.notAfter - now) / DAY)
      if (cert.notAfter <= now) issues.push({ code: "expired", severity: "error", block: index, days: -daysLeft })
      else if (cert.notBefore > now) issues.push({ code: "not-yet-valid", severity: "error", block: index, days: Math.ceil((cert.notBefore - now) / DAY) })
      else if (daysLeft < warnDays) issues.push({ code: "expires-soon", severity: "warning", block: index, days: daysLeft })
      if (cert.keyLabel.startsWith("RSA") && (cert.keyBits ?? 0) < 2048) issues.push({ code: "weak-key", severity: "error", block: index, detail: cert.keyLabel })
      if (cert.sha1Signature && !cert.selfSigned) issues.push({ code: "sha1", severity: "error", block: index })
    })
    const lifetime = validityDays(leafCert.notBefore, leafCert.notAfter)
    const limit = maxPublicValidityDays(leafCert.notBefore)
    if (!leafCert.selfSigned && !leafCert.isCa && lifetime > limit) issues.push({ code: "too-long", severity: "info", block: leaf, days: lifetime, detail: String(limit) })

    const host = hostname ? normalizeHost(hostname) : ""
    if (host) {
      const isIp = /^[\d.]+$|:/.test(host)
      const covered = isIp ? leafCert.ipAddresses.includes(host) : leafCert.dnsNames.some((name) => hostMatches(name, host))
      if (!covered) {
        const cnMatch = !leafCert.dnsNames.length && hostMatches(leafCert.subject, host)
        issues.push(cnMatch ? { code: "cn-only", severity: "error", block: leaf } : { code: "host-mismatch", severity: "error", block: leaf, detail: [...leafCert.dnsNames, ...leafCert.ipAddresses].join(", ") || leafCert.subject })
      }
    }
    if (leafCert.selfSigned) issues.push({ code: "self-signed", severity: production ? "error" : "info", block: leaf })

    const keyBlocks = [...blocks.filter((block) => block.kind === "private-key" || block.kind === "encrypted-key"), ...readPemBlocks(privateKey).filter((block) => block.kind === "private-key" || block.kind === "encrypted-key")]
    for (const key of keyBlocks.slice(0, 3)) {
      if (key.kind === "encrypted-key") issues.push({ code: "key-encrypted", severity: "info" })
      else if (!key.publicKey || key.broken) issues.push({ code: "key-unknown", severity: "info", detail: key.keyLabel ?? key.label })
      else if (key.publicKey === leafCert.publicKey) issues.push({ code: "key-match", severity: "ok", detail: key.keyLabel })
      else issues.push({ code: "key-mismatch", severity: "error", detail: key.keyLabel })
    }
  } else if (expect !== "private-key" && expect !== "csr" && !issues.some((issue) => issue.code !== "escaped-newlines")) issues.push({ code: "no-pem", severity: "error" })
  return { blocks, leaf, issues }
}
