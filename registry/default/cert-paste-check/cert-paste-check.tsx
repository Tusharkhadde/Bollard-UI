"use client"

import * as React from "react"
import { CircleAlert, CircleCheck, FileBadge, FileQuestion, Info, KeyRound, ShieldAlert, TriangleAlert } from "lucide-react"

import { cn } from "@/lib/utils"
import { checkCertPaste, normalizeHost, type CertCheckOptions, type CertIssue, type PemBlock } from "@/registry/default/cert-paste-check/pem"

export { base64ToBytes, checkCertPaste, hostMatches, maxPublicValidityDays, normalizeHost, parseCertificate, readPemBlocks, validityDays, type CertAnalysis, type CertCheckOptions, type CertInfo, type CertIssue, type CertIssueCode, type PemBlock, type PemKind } from "@/registry/default/cert-paste-check/pem"

export const CERT_PASTE_CHECK_MESSAGES = {
  label: "Certificate",
  placeholder: "-----BEGIN CERTIFICATE-----",
  hint: "Server certificate first, then its intermediates. Leave out the root.",
  forHost: "for {host}",
  production: "production",
  leaf: "Server certificate",
  intermediate: "Intermediate",
  root: "Root",
  stray: "Unrelated certificate",
  "kind-certificate": "Certificate",
  "kind-private-key": "Private key",
  "kind-encrypted-key": "Encrypted private key",
  "kind-csr": "Signing request",
  "kind-public-key": "Public key",
  "kind-other": "{label}",
  issuedBy: "Issued by {issuer}",
  validUntil: "until {date}",
  left: "{span} left",
  expiredAgo: "expired {span} ago",
  covers: "Covers {names}",
  more: "+{count} more",
  today: "today",
  day: "1 day",
  days: "{count} days",
  problems: "{errors} to fix · {warnings} to review",
  clean: "Ready to install",
  keyTitle: "A private key is in the certificate field.",
  keyBody: "Anyone who sees this form, a log or a support ticket could impersonate your site. Paste it only into the private key field. If it has been shared or saved anywhere else, get the certificate reissued with a new key.",
  "no-pem": "No certificate found. Paste the text that starts with -----BEGIN CERTIFICATE-----.",
  "der-base64": "This is a certificate without its BEGIN and END lines.",
  truncated: "The {detail} block has no END line, so it's cut off. Copy the whole file again.",
  "broken-block": "The {name} is damaged and won't decode. Copy it again.",
  "csr-not-cert": "This is a signing request, not a certificate. Send it to your CA and paste the certificate they return.",
  "public-key": "This is a bare public key, not a certificate.",
  "wrong-order": "Out of order. The server certificate must come first, then each issuer. Servers send the chain as pasted, and many clients reject it.",
  "not-in-chain": "The certificate for {subject} isn't part of this chain.",
  "missing-intermediate": "Only the server certificate is here. Add the intermediate from {detail}, or phones, curl and APIs will fail even when your browser works.",
  "root-included": "The root is included. Clients already have it, so it only adds bytes.",
  expired: "The {name} expired {span} ago, on {date}.",
  "not-yet-valid": "The {name} isn't valid until {date}.",
  "expires-soon": "The {name} expires in {span}, on {date}. Renew it now.",
  "too-long": "Valid for {days} days, counted as the CA/Browser Forum counts them (both ends included). Public CAs may now issue at most {detail} days, so this one comes from a private CA or breaks the rules browsers enforce.",
  "host-mismatch": "Doesn't cover {host}. It covers {detail}.",
  wildcardApex: "Doesn't cover {host}. A wildcard covers one level only: {wildcard} covers www.{host} but not {host} itself.",
  "cn-only": "{host} is only in the Common Name. Browsers ignore that and look only at Subject Alternative Names.",
  "self-signed": "Self-signed. Fine for local testing; browsers won't trust it.",
  selfSignedProduction: "Self-signed, and this is production. Every visitor will see a security warning.",
  "key-in-cert-field": "Private key in the certificate field.",
  "key-mismatch": "The private key ({detail}) doesn't belong to this certificate. The server will refuse to start.",
  "key-match": "The private key matches this certificate.",
  "key-encrypted": "The private key is encrypted, so it can't be matched here. Your server will need its passphrase.",
  "key-unknown": "This {detail} key can't be matched here. Check it with openssl on the server.",
  "weak-key": "{detail} is too weak. Browsers and CAs require 2048-bit RSA or more.",
  sha1: "Signed with SHA-1, which browsers reject.",
  "escaped-newlines": "The line breaks are written as \\n, as in JSON or an env var. Servers need real line breaks.",
  pkcs7: "This is a PKCS#7 bundle (.p7b). Convert it with openssl pkcs7 -print_certs -in bundle.p7b and paste the result.",
  "ca-as-leaf": "The first certificate ({subject}) is a CA certificate, not your server certificate. Paste the one issued for your domain, then this one.",
  "fix-der-base64": "Add PEM lines",
  "fix-escaped-newlines": "Fix line breaks",
  "fix-key-in-cert-field": "Remove the key",
  "fix-csr-not-cert": "Remove the request",
  "fix-wrong-order": "Put in order",
  "fix-not-in-chain": "Remove it",
  "fix-root-included": "Remove the root",
}
export type CertPasteCheckMessages = typeof CERT_PASTE_CHECK_MESSAGES

const fill = (text: string, values: Record<string, string | number>) => text.replace(/\{(\w+)\}/g, (match, key: string) => String(values[key] ?? match))
const tones = { danger: "text-red-700 dark:text-red-400", error: "text-red-700 dark:text-red-400", warning: "text-amber-700 dark:text-amber-400", info: "text-muted-foreground", ok: "text-emerald-700 dark:text-emerald-400" }
const icons = { danger: ShieldAlert, error: CircleAlert, warning: TriangleAlert, info: Info, ok: CircleCheck }
const rank = { danger: 0, error: 1, warning: 2, info: 3, ok: 4 }
const fixClass = (strong: boolean) =>
  cn(
    "inline-flex min-h-6 items-center rounded-md border px-2 font-medium transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
    strong ? "border-red-500/40 text-red-800 hover:bg-red-500/10 dark:text-red-200" : "border-amber-500/40 text-amber-900 hover:bg-amber-500/10 dark:text-amber-200",
  )
const DAY = 86_400_000

function useSettled(text: string, delay = 800) {
  const [settled, setSettled] = React.useState(text)
  React.useEffect(() => {
    const timer = setTimeout(() => setSettled(text), delay)
    return () => clearTimeout(timer)
  }, [text, delay])
  return settled
}

export interface CertPasteCheckProps extends Omit<React.ComponentProps<"textarea">, "value" | "defaultValue" | "onChange"> {
  /** Controlled PEM text. */
  value?: string
  /** Initial text when uncontrolled. */
  defaultValue?: string
  /** Called with the new text on every edit or fix. */
  onValueChange?: (value: string) => void
  /** What the field is for. "chain" (default) takes a certificate plus intermediates. */
  expect?: CertCheckOptions["expect"]
  /** The domain the certificate must cover, e.g. "acme.com". */
  hostname?: string
  /** The private key from a sibling field, matched against the certificate. Never shown. */
  privateKey?: string
  /** Self-signed certificates become errors. */
  production?: boolean
  /** Warn when fewer days than this remain. Default 30. */
  warnDays?: number
  /** Fixed "now" for tests and demos. Otherwise the clock once mounted. */
  now?: Date | number
  /** IANA time zone for dates. Defaults to the user's own. */
  timeZone?: string
  /** Locale for dates. */
  locale?: string
  /** Visible label; shorthand for `messages.label`. */
  label?: string
  /** Every visible string. `{name}`, `{host}`, `{date}`, `{span}`, `{days}`, `{detail}`, `{subject}`, `{count}` are filled in. */
  messages?: Partial<CertPasteCheckMessages>
}

/**
 * A PEM paste field for TLS certificates that catches what breaks an install:
 * a private key or CSR pasted as the certificate, a chain out of order or
 * missing its intermediate, an expired or soon-expiring certificate, a domain
 * the SANs don't cover (wildcard and CN-only traps included), a self-signed
 * certificate in production and a private key that doesn't match.
 */
export function CertPasteCheck({
  value,
  defaultValue = "",
  onValueChange,
  expect = "chain",
  hostname,
  privateKey,
  production = false,
  warnDays = 30,
  now: fixedNow,
  timeZone,
  locale,
  label,
  messages,
  rows = 6,
  id,
  className,
  ref,
  "aria-describedby": describedBy,
  ...props
}: CertPasteCheckProps) {
  const t = { ...CERT_PASTE_CHECK_MESSAGES, ...messages, ...(label !== undefined && { label }) }
  const [inner, setInner] = React.useState(defaultValue)
  const [clock, setClock] = React.useState<number | null>(null)
  const field = React.useRef<HTMLTextAreaElement>(null)
  const panel = React.useRef<HTMLDivElement>(null)
  const refocus = React.useRef<number | null>(null)
  const autoId = React.useId()
  const inputId = id ?? autoId
  const text = value ?? inner
  React.useImperativeHandle(ref, () => field.current as HTMLTextAreaElement)
  React.useEffect(() => {
    if (fixedNow !== undefined) return
    setClock(Date.now())
    const timer = setInterval(() => setClock(Date.now()), 3_600_000)
    return () => clearInterval(timer)
  }, [fixedNow])
  const fixedMs = fixedNow === undefined ? Number.NaN : typeof fixedNow === "number" ? fixedNow : fixedNow.getTime()
  const now = Number.isFinite(fixedMs) ? fixedMs : (clock ?? Number.NaN)

  const { blocks, leaf, issues } = React.useMemo(
    () => checkCertPaste(text, { expect, hostname, privateKey, production, now, warnDays }),
    [text, expect, hostname, privateKey, production, now, warnDays],
  )
  const sorted = [...issues].sort((a, b) => rank[a.severity] - rank[b.severity])
  const secret = sorted.find((issue) => issue.code === "key-in-cert-field")
  const listed = sorted.filter((issue) => issue !== secret)
  const counted = issues.filter((issue) => issue.severity !== "info" && issue.severity !== "ok")
  const errors = counted.filter((issue) => issue.severity !== "warning").length
  const summary = !text.trim() ? "" : counted.length ? fill(t.problems, { errors, warnings: counted.length - errors }) : leaf >= 0 ? t.clean : ""
  const announced = useSettled(summary)

  const dateFormat = React.useMemo(() => {
    try {
      return new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", year: "numeric", timeZone })
    } catch {
      return new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short", year: "numeric" })
    }
  }, [locale, timeZone])
  const date = (ms: number | undefined) => (ms !== undefined && Number.isFinite(ms) ? dateFormat.format(ms) : "")
  const span = (days: number) => (days <= 0 ? t.today : days === 1 ? t.day : fill(t.days, { count: days }))

  // Name each block by its role, so messages say "the intermediate", not "block 2".
  const chainOrder = blocks.map((block, index) => index).filter((index) => blocks[index].cert)
  const roleOf = (block: PemBlock, index: number) => {
    if (!block.cert) return fill(t[`kind-${block.kind}`], { label: block.label })
    if (index === leaf) return t.leaf
    if (block.cert.selfSigned) return t.root
    const strayIssue = issues.some((issue) => issue.code === "not-in-chain" && issue.block === index)
    return strayIssue ? t.stray : t.intermediate
  }

  const message = (issue: CertIssue) => {
    const block = issue.block !== undefined ? blocks[issue.block] : undefined
    const host = hostname ? normalizeHost(hostname) : ""
    const wildcard = block?.cert?.dnsNames.find((name) => name === `*.${host}`)
    if (issue.code === "host-mismatch" && wildcard) return fill(t.wildcardApex, { host, wildcard })
    const template = issue.code === "self-signed" && issue.severity === "error" ? t.selfSignedProduction : t[issue.code]
    return fill(template, {
      name: block ? roleOf(block, issue.block ?? 0).toLowerCase() : "",
      subject: block?.cert?.subject ?? "",
      host,
      detail: issue.detail ?? "",
      days: issue.days ?? "",
      span: span(issue.days ?? 0),
      date: date(issue.code === "not-yet-valid" ? block?.cert?.notBefore : block?.cert?.notAfter),
    })
  }

  const update = (next: string) => {
    if (value === undefined) setInner(next)
    onValueChange?.(next)
  }
  React.useEffect(() => {
    if (refocus.current === null) return
    const buttons = panel.current?.querySelectorAll<HTMLButtonElement>("button[data-fix]") ?? []
    ;(buttons[Math.min(refocus.current, buttons.length - 1)] ?? field.current)?.focus()
    refocus.current = null
  }, [text])
  const apply = (issue: CertIssue, button: HTMLElement) => {
    refocus.current = [...(panel.current?.querySelectorAll("button[data-fix]") ?? [])].indexOf(button)
    update(issue.fix ?? "")
  }
  const fixButton = (issue: CertIssue, className?: string) =>
    issue.fix !== undefined && (
      <button type="button" data-fix="" onClick={(event) => apply(issue, event.currentTarget)} className={cn(fixClass(issue.severity === "error" || issue.severity === "danger"), className)}>
        {t[`fix-${issue.code}` as keyof CertPasteCheckMessages]}
      </button>
    )

  return (
    <div data-slot="cert-paste-check" className={cn("grid w-full max-w-xl min-w-0 grid-cols-[minmax(0,1fr)] gap-1.5 text-sm", className)}>
      <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
        <label htmlFor={inputId} className="font-medium">
          {t.label}
        </label>
        <span className="flex flex-wrap gap-1.5 text-xs">
          {hostname && <span className="rounded-md border px-1.5 py-0.5 font-mono text-muted-foreground">{fill(t.forHost, { host: hostname })}</span>}
          {production && <span className="rounded-md border border-red-500/40 px-1.5 py-0.5 font-mono text-red-700 dark:text-red-300">{t.production}</span>}
        </span>
      </div>
      <textarea
        ref={field}
        id={inputId}
        rows={rows}
        value={text}
        onChange={(event) => update(event.target.value)}
        placeholder={t.placeholder}
        spellCheck={false}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="none"
        data-gramm="false"
        wrap="off"
        aria-invalid={errors > 0 || undefined}
        aria-describedby={[describedBy, `${inputId}-hint`, `${inputId}-report`].filter(Boolean).join(" ")}
        className="w-full min-w-0 resize-y rounded-md border bg-transparent px-3 py-2 font-mono text-base leading-5 shadow-xs transition-[color,box-shadow] outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-destructive md:text-xs dark:bg-input/30"
        {...props}
      />
      <p id={`${inputId}-hint`} className="text-xs text-muted-foreground">
        {t.hint}
      </p>
      <span role="status" className="sr-only">
        {announced}
      </span>
      <div ref={panel} id={`${inputId}-report`} className="grid gap-1.5 text-xs empty:hidden">
        {secret && (
          <div role="alert" className="mt-1.5 grid gap-2 rounded-md border border-red-500/50 bg-red-500/10 p-3 text-red-800 dark:text-red-200">
            <p className="flex gap-2 text-sm font-semibold">
              <ShieldAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
              {t.keyTitle}
            </p>
            <p>{t.keyBody}</p>
            <div>{fixButton(secret, "bg-background")}</div>
          </div>
        )}
        {summary && (
          <p className={cn("mt-1.5 flex items-center gap-1.5", counted.length ? "text-muted-foreground" : "text-emerald-700 dark:text-emerald-400")}>
            {counted.length ? <TriangleAlert aria-hidden className="size-3.5 text-amber-600 dark:text-amber-400" /> : <CircleCheck aria-hidden className="size-3.5" />}
            {summary}
          </p>
        )}
        {listed.length > 0 && (
          <ul className="grid gap-1.5">
            {listed.map((issue, index) => {
              const Icon = icons[issue.severity]
              return (
                <li key={`${issue.code}-${issue.block ?? index}`} className={cn("flex gap-1.5", tones[issue.severity])}>
                  <span className="flex h-6 shrink-0 items-center">
                    <Icon aria-hidden className="size-3.5" />
                  </span>
                  <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="py-1 [overflow-wrap:anywhere]">{message(issue)}</span>
                    {fixButton(issue)}
                  </span>
                </li>
              )
            })}
          </ul>
        )}
        {blocks.length > 0 && (
          <ol className="mt-1.5 grid gap-1.5">
            {blocks.map((block, index) => {
              const cert = block.cert
              const daysLeft = cert && Number.isFinite(now) ? Math.floor((cert.notAfter - now) / DAY) : undefined
              const Icon = cert ? FileBadge : block.kind === "csr" ? FileQuestion : KeyRound
              const tone = daysLeft === undefined ? "text-muted-foreground" : daysLeft < 0 ? "text-red-700 dark:text-red-400" : daysLeft < warnDays ? "text-amber-700 dark:text-amber-400" : "text-emerald-700 dark:text-emerald-400"
              const names = [...(cert?.dnsNames ?? block.dnsNames ?? []), ...(cert?.ipAddresses ?? [])]
              return (
                <li key={`${index}-${block.start}`} className={cn("grid gap-0.5 rounded-md border bg-muted/30 px-3 py-2", (block.kind === "private-key" || block.kind === "encrypted-key") && "border-red-500/40")}>
                  <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                    <Icon aria-hidden className="size-3.5 shrink-0 text-muted-foreground" />
                    <span className="font-medium">
                      {chainOrder.indexOf(index) >= 0 ? `${chainOrder.indexOf(index) + 1}. ` : ""}
                      {roleOf(block, index)}
                    </span>
                    {(cert?.keyLabel ?? block.keyLabel) && <span className="rounded border px-1.5 font-mono text-[11px] text-muted-foreground">{cert?.keyLabel ?? block.keyLabel}</span>}
                  </p>
                  {(cert?.subject ?? block.subject) && <p className="font-mono [overflow-wrap:anywhere]">{cert?.subject ?? block.subject}</p>}
                  {cert && !cert.selfSigned && <p className="text-muted-foreground [overflow-wrap:anywhere]">{fill(t.issuedBy, { issuer: cert.issuer })}</p>}
                  {cert && Number.isFinite(cert.notAfter) && (
                    <p className={tone}>
                      {fill(t.validUntil, { date: date(cert.notAfter) })}
                      {daysLeft !== undefined && ` · ${daysLeft < 0 ? fill(t.expiredAgo, { span: span(-daysLeft) }) : fill(t.left, { span: span(daysLeft) })}`}
                    </p>
                  )}
                  {names.length > 0 && (
                    <p className="text-muted-foreground [overflow-wrap:anywhere]">
                      {fill(t.covers, { names: names.slice(0, 4).join(", ") })}
                      {names.length > 4 && ` ${fill(t.more, { count: names.length - 4 })}`}
                    </p>
                  )}
                </li>
              )
            })}
          </ol>
        )}
      </div>
    </div>
  )
}
