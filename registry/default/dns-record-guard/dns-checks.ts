// Bollard UI — dns-record-guard · MIT licence · https://bollard-ui.vercel.app/components/dns-record-guard

/** A record in the zone. `name` is relative ("@", "www", "s1._domainkey") or fully qualified. */
export interface DnsRecord {
  id: string
  type: string
  name: string
  value: string
  /** Seconds. */
  ttl: number
  priority?: number
}

export type DnsChange =
  | { kind: "delete"; id: string }
  | { kind: "edit"; id: string; next: Partial<Omit<DnsRecord, "id">> }

export interface DnsFinding {
  /** Stable key, also used to tell findings the change creates from ones the zone already had. */
  key: string
  /** `breaks`: something stops working. `risk`: worth knowing before saving. */
  severity: "breaks" | "risk"
  title: string
  detail: string
}

const ADDRESS = new Set(["A", "AAAA", "CNAME", "ALIAS", "ANAME"])

/** "@" and relative names to lowercase FQDNs without the trailing dot. */
export const fqdn = (name: string, zone: string) => {
  const n = name.trim().toLowerCase().replace(/\.$/, "")
  const z = zone.toLowerCase().replace(/\.$/, "")
  return n === "@" || n === "" || n === z ? z : n.endsWith(`.${z}`) ? n : `${n}.${z}`
}
/** FQDN back to the name a DNS panel shows ("@", "www"). */
export const shortName = (name: string, zone: string) => {
  const f = fqdn(name, zone)
  return f === zone ? "@" : f.endsWith(`.${zone}`) ? f.slice(0, -zone.length - 1) : f
}
/** TXT values arrive quoted and split ("v=spf1 " "include:…"); join them. */
const txt = (value: string) => (/^\s*"/.test(value) ? [...value.matchAll(/"((?:[^"\\]|\\.)*)"/g)].map((m) => m[1]).join("") : value.trim())
const target = (value: string, zone: string) => fqdn(value.trim().split(/\s+/).pop() ?? "", zone)

/** Applies a change to a copy of the zone. */
export function applyDnsChange(records: DnsRecord[], change: DnsChange) {
  return change.kind === "delete"
    ? records.filter((r) => r.id !== change.id)
    : records.map((r) => (r.id === change.id ? { ...r, ...change.next } : r))
}

/** DNS lookups an SPF record spends (include, a, mx, ptr, exists, redirect); nested includes add more. */
export const spfLookups = (spf: string) =>
  spf.split(/\s+/).filter((t) => /^[+\-~?]?(include:|exists:|ptr\b|a\b|a[:/]|mx\b|mx[:/])|^redirect=/i.test(t)).length

/** The DMARC policy (none, quarantine, reject) that applies to a domain, checking the zone root as fallback. */
function dmarcPolicy(records: DnsRecord[], zone: string, domain: string) {
  for (const host of [`_dmarc.${domain}`, `_dmarc.${zone}`]) {
    const rec = records.find((r) => r.type === "TXT" && fqdn(r.name, zone) === host && /^v=DMARC1/i.test(txt(r.value)))
    const p = rec && /;\s*p=(\w+)/i.exec(txt(rec.value))?.[1]?.toLowerCase()
    if (p) return p
  }
  return "none"
}

/** Problems a zone has on its own: CNAME clashes, broken SPF and DMARC, names pointing at nothing. */
export function zoneIssues(zone: string, records: DnsRecord[]): DnsFinding[] {
  const out: DnsFinding[] = []
  const byName = new Map<string, DnsRecord[]>()
  for (const r of records) byName.set(fqdn(r.name, zone), [...(byName.get(fqdn(r.name, zone)) ?? []), r])
  const hasAddress = (name: string) => (byName.get(name) ?? []).some((r) => ADDRESS.has(r.type))

  for (const [name, set] of byName) {
    const short = shortName(name, zone)
    const others = set.filter((r) => r.type !== "CNAME")
    if (set.some((r) => r.type === "CNAME")) {
      if (name === zone)
        out.push({ key: `cname-apex`, severity: "breaks", title: `A CNAME can't sit at the root of ${zone}`,
          detail: "The root must also hold NS and SOA records, so resolvers drop records here, including MX and SPF. Use your provider's ALIAS or CNAME flattening, or an A record." })
      else if (others.length)
        out.push({ key: `cname-with:${name}`, severity: "breaks", title: `${short} has a CNAME and ${[...new Set(others.map((r) => r.type))].join(", ")} records`,
          detail: "A CNAME must be the only record at its name. Resolvers answer with one or the other, so these work only some of the time." })
    }
    const spf = set.filter((r) => r.type === "TXT" && /^v=spf1(\s|$)/i.test(txt(r.value)))
    if (spf.length > 1)
      out.push({ key: `spf-multiple:${name}`, severity: "breaks", title: `${name} has ${spf.length} SPF records`,
        detail: "Receivers treat more than one v=spf1 record as an error (permerror), so SPF fails for all mail. Merge them into one." })
    const lookups = spf.length === 1 ? spfLookups(txt(spf[0].value)) : 0
    if (lookups > 10)
      out.push({ key: `spf-lookups:${name}`, severity: "breaks", title: `SPF for ${name} needs ${lookups}+ DNS lookups`,
        detail: "The limit is 10. Past it, SPF returns permerror and receivers may reject your mail." })
    const dmarc = set.find((r) => r.type === "TXT" && name.startsWith("_dmarc.") && /dmarc/i.test(txt(r.value)))
    if (dmarc && !/^v=DMARC1\s*;\s*(.*;\s*)?p=(none|quarantine|reject)\b/i.test(txt(dmarc.value)))
      out.push({ key: `dmarc-invalid:${name}`, severity: "breaks", title: `Receivers will ignore the DMARC record`,
        detail: "It must start with v=DMARC1; and include p=none, quarantine or reject." })
    for (const r of set.filter((r) => ["MX", "CNAME", "SRV"].includes(r.type))) {
      const to = target(r.value, zone)
      if ((to === zone || to.endsWith(`.${zone}`)) && !hasAddress(to))
        out.push({ key: `dangling:${r.id}`, severity: "breaks", title: `${r.type} ${short} points to ${shortName(to, zone)}, which has no address`,
          detail: r.type === "MX" ? "Senders can't reach that mail server, so mail queues and then bounces." : "Anything using this name stops resolving." })
      else if (r.type === "MX" && (byName.get(to) ?? []).some((x) => x.type === "CNAME"))
        out.push({ key: `mx-cname:${r.id}`, severity: "risk", title: `MX points to a CNAME (${shortName(to, zone)})`,
          detail: "The standard (RFC 2181) forbids it and some senders refuse to deliver. Point MX at a name with an A record." })
    }
  }
  return out
}

/** Email that stops working because records were removed or changed: MX, SPF senders, DKIM selectors, DMARC. */
function lostEmail(zone: string, before: DnsRecord[], after: DnsRecord[]): DnsFinding[] {
  const out: DnsFinding[] = []
  const at = (set: DnsRecord[], name: string, test: (r: DnsRecord) => boolean) => set.filter((r) => fqdn(r.name, zone) === name && test(r))
  const names = [...new Set(before.map((r) => fqdn(r.name, zone)))]
  const enforce = (domain: string) => {
    const p = dmarcPolicy(after, zone, domain)
    return p === "none" ? "" : ` Your DMARC policy (p=${p}) tells receivers to ${p} mail that fails both SPF and DKIM.`
  }
  for (const name of names) {
    const isMx = (r: DnsRecord) => r.type === "MX"
    const mxBefore = at(before, name, isMx)
    const mxAfter = at(after, name, isMx)
    if (mxBefore.length && !mxAfter.length)
      out.push({ key: `mx-gone:${name}`, severity: "breaks", title: `Email to @${name} stops arriving`,
        detail: "No MX record is left, so senders can't find your mail server. Mail queues for a few days, then bounces." })
    else if (mxAfter.length && mxAfter.length < mxBefore.length)
      out.push({ key: `mx-fewer:${name}`, severity: "risk", title: `One fewer mail server for @${name}`,
        detail: `If ${mxAfter.map((r) => target(r.value, zone)).join(", ")} is down, incoming mail waits instead of failing over.` })
    for (const r of mxAfter) {
      const old = mxBefore.find((b) => b.id === r.id)
      if (old && target(old.value, zone) !== target(r.value, zone))
        out.push({ key: `mx-moved:${r.id}`, severity: "risk", title: `Mail for @${name} starts going to ${target(r.value, zone)}`,
          detail: `Instead of ${target(old.value, zone)}. Make sure the new server accepts mail for this domain before saving.` })
    }

    const isSpf = (r: DnsRecord) => r.type === "TXT" && /^v=spf1(\s|$)/i.test(txt(r.value))
    const spfBefore = at(before, name, isSpf)[0]
    const spfAfter = at(after, name, isSpf)
    const domain = name
    if (spfBefore && !spfAfter.length)
      out.push({ key: `spf-gone:${name}`, severity: enforce(domain) ? "breaks" : "risk", title: `Mail from @${name} no longer passes SPF`,
        detail: `Receivers can't tell which servers may send for you.${enforce(domain)}` })
    else if (spfBefore && spfAfter.length === 1) {
      const kept = new Set(txt(spfAfter[0].value).toLowerCase().split(/\s+/))
      const lost = txt(spfBefore.value).toLowerCase().split(/\s+/).filter((t) => /^[+?~]?(include:|ip[46]:|a\b|mx\b|a:|mx:)/.test(t) && !kept.has(t))
      if (lost.length)
        out.push({ key: `spf-lost:${name}`, severity: "risk", title: `SPF stops approving ${lost.map((t) => t.replace(/^[+?~]?(include:)?/, "")).join(", ")}`,
          detail: `Mail sent through ${lost.length === 1 ? "it" : "them"} fails SPF.${enforce(domain)}` })
      if (/(^|\s)\+?all(\s|$)/i.test(txt(spfAfter[0].value)))
        out.push({ key: `spf-all:${name}`, severity: "risk", title: `SPF ends in +all`, detail: "That approves every server on the internet to send as you. Use ~all or -all." })
    }

    if (name.includes("._domainkey.")) {
      const isKey = (r: DnsRecord) => r.type === "CNAME" || (r.type === "TXT" && /(^|;)\s*p=/i.test(txt(r.value)))
      const selector = name.split("._domainkey.")[0]
      const signer = name.split("._domainkey.")[1]
      const keyBefore = at(before, name, isKey)[0]
      const keyAfter = at(after, name, isKey)[0]
      if (keyBefore && !keyAfter)
        out.push({ key: `dkim-gone:${name}`, severity: enforce(signer) ? "breaks" : "risk", title: `Mail signed with DKIM selector “${selector}” fails DKIM`,
          detail: `Including mail already sent and still in transit.${enforce(signer)}` })
      else if (keyBefore && keyAfter && txt(keyBefore.value) !== txt(keyAfter.value))
        out.push({ key: `dkim-key:${name}`, severity: "risk", title: `Mail signed with the old “${selector}” key fails DKIM`,
          detail: "Until your mail server signs with the new key. Safer: publish the new key under a new selector, switch signing, then remove this one." })
    }

    if (name.startsWith("_dmarc.")) {
      const isDmarc = (r: DnsRecord) => r.type === "TXT" && /^v=DMARC1/i.test(txt(r.value))
      if (at(before, name, isDmarc).length && !at(after, name, isDmarc).length)
        out.push({ key: `dmarc-gone:${name}`, severity: "risk", title: `@${name.slice(7)} loses its DMARC policy`,
          detail: "Receivers stop rejecting mail that spoofs your domain, and you stop getting DMARC reports." })
    }
  }
  return out
}

/**
 * What a DNS edit or delete breaks: email (MX, SPF, DKIM, DMARC, escalated by
 * the DMARC policy in force), CNAME clashes and names left pointing at
 * nothing. Only problems the change introduces are returned, breaks first.
 */
export function checkDnsChange(zone: string, records: DnsRecord[], change: DnsChange): DnsFinding[] {
  const z = zone.toLowerCase().replace(/\.$/, "")
  const after = applyDnsChange(records, change)
  const existing = new Set(zoneIssues(z, records).map((f) => f.key))
  const findings = [...lostEmail(z, records, after), ...zoneIssues(z, after).filter((f) => !existing.has(f.key))]
  return findings.sort((a, b) => (a.severity === b.severity ? 0 : a.severity === "breaks" ? -1 : 1))
}

/** "5 min", "1 h", "24 h", "2 days". */
export const formatTtl = (seconds: number) =>
  seconds < 3600 ? `${Math.max(1, Math.round(seconds / 60))} min` : seconds < 172_800 ? `${Math.round(seconds / 3600)} h` : `${Math.round(seconds / 86_400)} days`
