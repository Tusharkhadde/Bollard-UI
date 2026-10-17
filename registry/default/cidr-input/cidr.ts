// Bollard UI — cidr-input · MIT licence · https://bollard-ui.vercel.app/components/cidr-input

/** Pure CIDR maths for IPv4 and IPv6, using BigInt so /0 and /128 are exact. */

export type IpFamily = 4 | 6

export interface ExistingRange {
  /** A CIDR such as "10.0.0.0/16". */
  cidr: string
  /** What it is, e.g. "prod-vpc". */
  label?: string
}

export interface CidrOverlap extends ExistingRange {
  /** How the typed range relates to the existing one. */
  relation: "same" | "inside" | "contains"
}

export type CidrAnalysis =
  | { ok: false; error: string; fix?: string; fixLabel?: string }
  | {
      ok: true
      family: IpFamily
      prefix: number
      /** Address bits as typed, before the mask is applied. */
      address: bigint
      network: bigint
      last: bigint
      /** Canonical form, e.g. "10.0.0.0/8". */
      canonical: string
      /** Number of addresses in the range. */
      size: bigint
      /** Typed address had bits set past the prefix: the canonical network and the single-host reading. */
      hostBitsSet: boolean
      /** 0.0.0.0/0 or ::/0. */
      anywhere: boolean
      /** Octets with leading zeros, which some parsers read as octal (010 = 8). */
      leadingZeros: boolean
      /** No "/prefix" was typed. */
      missingPrefix: boolean
      overlaps: CidrOverlap[]
    }

const bitsOf = (family: IpFamily) => (family === 4 ? 32 : 128)

function parseIPv4(text: string): { value: bigint; leadingZeros: boolean } | null {
  const parts = text.split(".")
  if (parts.length !== 4 || parts.some((part) => !/^\d{1,3}$/.test(part) || Number(part) > 255)) return null
  return {
    value: parts.reduce((acc, part) => (acc << BigInt(8)) | BigInt(Number(part)), BigInt(0)),
    leadingZeros: parts.some((part) => part.length > 1 && part.startsWith("0")),
  }
}

function parseIPv6(text: string): bigint | null {
  let groups: string[]
  // An embedded IPv4 tail (::ffff:10.0.0.1) counts as two groups.
  const tail = text.match(/:(\d+\.\d+\.\d+\.\d+)$/)
  if (tail) {
    const v4 = parseIPv4(tail[1])
    if (!v4) return null
    text = `${text.slice(0, -tail[1].length)}${(v4.value >> BigInt(16)).toString(16)}:${(v4.value & BigInt(0xffff)).toString(16)}`
  }
  const halves = text.split("::")
  if (halves.length > 2) return null
  const head = halves[0] ? halves[0].split(":") : []
  const rest = halves.length === 2 && halves[1] ? halves[1].split(":") : []
  if (halves.length === 2) {
    if (head.length + rest.length > 7) return null
    groups = [...head, ...Array<string>(8 - head.length - rest.length).fill("0"), ...rest]
  } else groups = head
  if (groups.length !== 8 || groups.some((group) => !/^[0-9a-f]{1,4}$/i.test(group))) return null
  return groups.reduce((acc, group) => (acc << BigInt(16)) | BigInt(parseInt(group, 16)), BigInt(0))
}

/** Formats an address: dotted IPv4, or RFC 5952 IPv6 (lowercase, longest zero run as ::). */
export function formatAddress(value: bigint, family: IpFamily): string {
  if (family === 4) return [24, 16, 8, 0].map((shift) => Number((value >> BigInt(shift)) & BigInt(255))).join(".")
  const groups = Array.from({ length: 8 }, (_, i) => Number((value >> BigInt(112 - i * 16)) & BigInt(0xffff)))
  let best = { start: -1, length: 1 }
  for (let i = 0; i < 8; i++) {
    let j = i
    while (j < 8 && groups[j] === 0) j++
    if (j - i > best.length) best = { start: i, length: j - i }
    i = j
  }
  const hex = groups.map((group) => group.toString(16))
  if (best.start < 0) return hex.join(":")
  return `${hex.slice(0, best.start).join(":")}::${hex.slice(best.start + best.length).join(":")}`
}

function parseCidr(input: string) {
  const [addressText, prefixText, ...extra] = input.trim().split("/")
  if (extra.length) return null
  const family: IpFamily = addressText.includes(":") ? 6 : 4
  const v4 = family === 4 ? parseIPv4(addressText) : null
  const address = family === 4 ? v4?.value : parseIPv6(addressText)
  if (address === undefined || address === null) return null
  const bits = bitsOf(family)
  const prefix = prefixText === undefined ? bits : /^\d{1,3}$/.test(prefixText) ? Number(prefixText) : NaN
  return {
    family,
    address,
    prefix,
    bits,
    leadingZeros: !!v4?.leadingZeros,
    missingPrefix: prefixText === undefined,
  }
}

const maskOf = (prefix: number, bits: number) =>
  ((BigInt(1) << BigInt(bits)) - BigInt(1)) ^ ((BigInt(1) << BigInt(bits - prefix)) - BigInt(1))

/** Validates a CIDR and describes its range, host-bit slips, open-to-everyone blocks and overlaps. */
export function analyzeCidr(input: string, existing: ExistingRange[] = []): CidrAnalysis {
  const text = input.trim()
  const parsed = parseCidr(text)
  if (!parsed) {
    if (/^[\d.]+\s*-\s*[\d.]+$/.test(text))
      return {
        ok: false,
        error: "Use CIDR notation (10.0.0.0/24), not a dash range.",
      }
    return {
      ok: false,
      error: text.includes(":") ? "That isn't a valid IPv6 address." : "That isn't a valid IP address.",
    }
  }
  const { family, address, prefix, bits } = parsed
  if (!Number.isInteger(prefix) || prefix > bits) {
    return {
      ok: false,
      error: `The prefix after / must be 0–${bits} for IPv${family}.`,
    }
  }
  const mask = maskOf(prefix, bits)
  const network = address & mask
  const last = network | (((BigInt(1) << BigInt(bits)) - BigInt(1)) ^ mask)
  const overlaps: CidrOverlap[] = []
  for (const range of existing) {
    const other = parseCidr(range.cidr)
    if (!other || other.family !== family || !Number.isInteger(other.prefix)) continue
    const otherNetwork = other.address & maskOf(other.prefix, bits)
    const otherLast = otherNetwork | (((BigInt(1) << BigInt(bits)) - BigInt(1)) ^ maskOf(other.prefix, bits))
    // Two CIDR blocks are either disjoint or one sits inside the other.
    if (otherLast < network || otherNetwork > last) continue
    const relation = other.prefix === prefix ? "same" : other.prefix < prefix ? "inside" : "contains"
    overlaps.push({ ...range, relation })
  }
  return {
    ok: true,
    family,
    prefix,
    address,
    network,
    last,
    canonical: `${formatAddress(network, family)}/${prefix}`,
    size: BigInt(1) << BigInt(bits - prefix),
    hostBitsSet: network !== address,
    anywhere: prefix === 0,
    leadingZeros: parsed.leadingZeros,
    missingPrefix: parsed.missingPrefix,
    overlaps,
  }
}

const superscript = (n: number) => String(n).replace(/\d/g, (d) => "⁰¹²³⁴⁵⁶⁷⁸⁹"[Number(d)])

/** "65,536", or "2⁶⁴" once the exact number stops being readable. */
export function formatSize(size: bigint): string {
  const exponent = size.toString(2).length - 1
  return exponent > 32 ? `2${superscript(exponent)}` : size.toLocaleString("en-US")
}
