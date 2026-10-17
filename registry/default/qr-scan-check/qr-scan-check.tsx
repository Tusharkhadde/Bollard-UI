"use client"

// Bollard UI — qr-scan-check · MIT licence · https://bollard-ui.vercel.app/components/qr-scan-check

import * as React from "react"
import { CircleCheck, Globe, IndianRupee, Loader2, Mail, MessageSquare, Phone, QrCode, ShieldAlert, TriangleAlert, Type, Wifi } from "lucide-react"

import { cn } from "@/lib/utils"
import { checkQr, DANGER_ISSUES, parseQr, QR_TRUSTED_DOMAINS, upiAmount, URL_SHORTENERS, type QrIssue, type QrPayload } from "./qr"

export { checkQr, DANGER_ISSUES, domainIn, isLookalike, parseQr, QR_TRUSTED_DOMAINS, registrableDomain, SHARED_HOST_SUFFIXES, upiAmount, URL_SHORTENERS, type QrIssue, type QrPayload } from "./qr"

/** Every visible string. Issue texts fill in `{printed}`, `{actual}`, `{twin}`, `{brand}`, `{shown}`, `{host}`, `{amount}` and `{recurText}`. */
export const QR_SCAN_MESSAGES = {
  heading: "Scanned code",
  types: { url: "Website", upi: "UPI payment", script: "Hidden script", tel: "Phone call", sms: "Text message", email: "Email", wifi: "Wi-Fi network", text: "Text", empty: "Empty" } as Record<QrPayload["type"], string>,
  mandate: "UPI AutoPay",
  goesTo: "Goes to",
  pays: "Pays",
  printed: "Printed or shown beside it",
  nameInCode: "Name in the code",
  nameNote: "Typed by whoever made the code. Your UPI app shows the bank's name before you enter your PIN.",
  amount: "Amount",
  note: "Note",
  verdict: { danger: "Don't open this yet", warning: "Check before you open", ok: "Goes where it says" },
  issues: {
    notPrinted: "The sign says {printed}, but this code goes to {actual}. Stickers over real codes do exactly this.",
    notPrintedLookalike: "The sign says {printed}, but this code goes to {actual}, a lookalike one letter off.",
    lookalike: "{actual} looks like {twin}, but it isn't.",
    brandInName: "{actual} uses {brand}'s name but isn't {brand}.",
    loginTrick: "The link starts with “{shown}@”, which hides the real site: {actual}.",
    script: "This code runs a script or opens a file instead of a web page.",
    apk: "Downloads an Android app. Install apps only from the Play Store.",
    shortener: "{host} is a link shortener, so the real destination is hidden.",
    punycode: "The address uses international characters ({host}) that can imitate familiar letters.",
    rawIp: "Goes to a bare IP address, not a named site.",
    http: "Not encrypted (http). Don't enter card details or passwords there.",
    upiReceive: "Scanning a UPI code only ever sends money. You never scan to receive a refund or prize.",
    upiNameMismatch: "The sign says {printed}, but the code pays {name}.",
    upiAmount: "{amount} is already filled in. Check it against the bill before you enter your PIN.",
    upiMandate: "This sets up AutoPay: repeated debits{recurText}, not a one-time payment. Only accept it for a subscription you chose.",
    smsBody: "Sends a text with a message already written. Read it before you send.",
  } as Record<Exclude<QrIssue["kind"], "notPrinted"> | "notPrinted" | "notPrintedLookalike", string>,
  resolving: "Following the short link…",
  resolvedTo: "Ends at {actual}",
  resolveFailed: "Couldn't follow the short link. Treat its destination as unknown.",
  empty: "Nothing readable in this code.",
  cancel: "Don't open",
  open: "Open {actual}",
  openAnyway: "Open anyway",
  pay: "Pay in UPI app",
  payAnyway: "Pay anyway",
  useAction: "Continue",
  goPrinted: "Go to {printed}",
}

export type QrScanMessages = typeof QR_SCAN_MESSAGES

const fill = (template: string, values: Record<string, unknown>) =>
  template.replace(/\{(\w+)\}/g, (match, key: string) => (values[key] === undefined ? match : String(values[key])))

const ICONS = { url: Globe, upi: IndianRupee, script: ShieldAlert, tel: Phone, sms: MessageSquare, email: Mail, wifi: Wifi, text: Type, empty: QrCode }
const button =
  "inline-flex h-9 items-center justify-center gap-2 rounded-md px-4 text-sm font-medium outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-60"

export interface QrScanCheckProps extends Omit<React.ComponentProps<"div">, "children"> {
  /** The decoded text of the scanned code. */
  payload: string
  /** What is printed or shown beside the code: a domain ("paybyphone.com") or a merchant name. */
  printed?: string
  /** Brands to test for lookalikes. */
  trusted?: string[]
  /** Hosts treated as link shorteners. */
  shorteners?: string[]
  /** Follows a short link and resolves to its final URL (on your server; redirects can't be read from the browser). */
  resolveRedirect?: (url: string) => Promise<string>
  /** Called with what to open: the URL, the `upi://` link, or the tel/sms/mailto text. */
  onOpen?: (target: string) => void
  /** Called when the user decides not to open it. */
  onCancel?: () => void
  /** Locale for amounts. */
  locale?: string
  /** Any visible string; `types`, `verdict` and `issues` may be partial. */
  messages?: Partial<Omit<QrScanMessages, "types" | "verdict" | "issues">> & {
    types?: Partial<QrScanMessages["types"]>
    verdict?: Partial<QrScanMessages["verdict"]>
    issues?: Partial<QrScanMessages["issues"]>
  }
}

/**
 * Shows where a scanned QR code really goes before anything opens: the registrable domain in bold,
 * compared with what is printed beside the code (the sticker-over-the-real-code trick), lookalike
 * and brand-borrowing domains, hidden short links (followed through `resolveRedirect`), app
 * downloads, and for UPI codes the payee, a pre-filled amount and "scan to receive" refund scams.
 */
export function QrScanCheck({
  payload,
  printed = "",
  trusted = QR_TRUSTED_DOMAINS,
  shorteners = URL_SHORTENERS,
  resolveRedirect,
  onOpen,
  onCancel,
  locale = "en-IN",
  messages,
  className,
  ...props
}: QrScanCheckProps) {
  const t = {
    ...QR_SCAN_MESSAGES,
    ...messages,
    types: { ...QR_SCAN_MESSAGES.types, ...messages?.types },
    verdict: { ...QR_SCAN_MESSAGES.verdict, ...messages?.verdict },
    issues: { ...QR_SCAN_MESSAGES.issues, ...messages?.issues },
  }
  const scanned = React.useMemo(() => parseQr(payload), [payload])
  const [final, setFinal] = React.useState<{ from: string; payload?: QrPayload; failed?: boolean }>()
  const headingId = React.useId()
  const isShort = scanned.type === "url" && (shorteners.includes(scanned.registrable) || shorteners.includes(scanned.url.hostname))

  React.useEffect(() => {
    if (!isShort || !resolveRedirect || scanned.type !== "url") return
    let live = true
    const from = scanned.url.href
    Promise.resolve()
      .then(() => resolveRedirect(from))
      .then((to) => live && setFinal({ from, payload: parseQr(to) }))
      .catch(() => live && setFinal({ from, failed: true }))
    return () => {
      live = false
    }
  }, [isShort, resolveRedirect, scanned])

  const resolved = final && scanned.type === "url" && final.from === scanned.url.href ? final : undefined
  const shown = resolved?.payload && resolved.payload.type !== "empty" ? resolved.payload : scanned
  const issues = checkQr(shown, printed, trusted, shorteners).filter((issue) => !(resolved?.payload && issue.kind === "shortener"))
  if (resolved?.failed && !issues.some((i) => i.kind === "shortener")) issues.push({ kind: "shortener", host: scanned.type === "url" ? scanned.url.hostname : "" })
  const danger = issues.some((issue) => DANGER_ISSUES.includes(issue.kind))
  const state = scanned.type === "empty" ? "warning" : danger ? "danger" : issues.length ? "warning" : "ok"
  const pending = isShort && !!resolveRedirect && !resolved
  const Icon = ICONS[shown.type]
  const printedDomain = issues.find((issue): issue is Extract<QrIssue, { kind: "notPrinted" }> => issue.kind === "notPrinted")?.printed

  const describe = (issue: QrIssue) =>
    fill(issue.kind === "notPrinted" && issue.lookalike ? t.issues.notPrintedLookalike : t.issues[issue.kind], {
      ...issue,
      recurText: issue.kind === "upiMandate" && issue.recur ? ` (${issue.recur.toLowerCase()})` : "",
    })

  const target = shown.type === "url" ? shown.url.href : shown.raw
  const openLabel =
    shown.type === "upi" ? (danger ? t.payAnyway : t.pay) : danger ? t.openAnyway : shown.type === "url" ? fill(t.open, { actual: shown.registrable }) : t.useAction

  const row = (label: string, children: React.ReactNode) => (
    <div className="grid gap-0.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words">{children}</dd>
    </div>
  )

  return (
    <div
      role="group"
      aria-labelledby={headingId}
      data-slot="qr-scan-check"
      data-state={state}
      className={cn(
        "w-full max-w-md space-y-3 rounded-lg border bg-card p-4 text-sm text-card-foreground shadow-xs",
        state === "danger" && "border-red-500/40",
        state === "warning" && "border-amber-500/40",
        className,
      )}
      {...props}
    >
      <div className="flex items-center justify-between gap-3">
        <h3 id={headingId} className="flex items-center gap-2 font-medium">
          <QrCode aria-hidden className="size-4 text-muted-foreground" />
          {t.heading}
        </h3>
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Icon aria-hidden className="size-3.5" />
          {shown.type === "upi" && shown.mandate ? t.mandate : t.types[shown.type]}
        </span>
      </div>

      {shown.type === "empty" ? (
        <p className="text-muted-foreground">{t.empty}</p>
      ) : (
        <dl className="grid gap-2">
          {shown.type === "url" &&
            row(
              t.goesTo,
              <span className="font-mono text-[13px] break-all">
                <span className="text-muted-foreground">{shown.url.hostname.slice(0, Math.max(0, shown.url.hostname.length - shown.registrable.length))}</span>
                <span className="text-base font-semibold text-foreground">{shown.registrable}</span>
                <span className="text-muted-foreground">{(shown.url.pathname === "/" ? "" : shown.url.pathname) + shown.url.search}</span>
              </span>,
            )}
          {shown.type === "upi" && (
            <>
              {row(t.pays, <span className="font-mono text-base font-semibold break-all">{shown.payee || "—"}</span>)}
              {shown.name && row(t.nameInCode, <span>{shown.name} <span className="block text-xs break-normal text-muted-foreground">{t.nameNote}</span></span>)}
              {upiAmount(shown.amount, shown.currency || "INR", locale) && row(t.amount, <span className="font-semibold">{upiAmount(shown.amount, shown.currency || "INR", locale)}</span>)}
              {shown.note && row(t.note, shown.note)}
            </>
          )}
          {(shown.type === "tel" || shown.type === "sms" || shown.type === "email" || shown.type === "wifi" || shown.type === "text") &&
            row(t.types[shown.type], <span className="font-mono">{shown.value}{shown.type === "sms" && shown.body && <span className="block font-sans text-muted-foreground">“{shown.body}”</span>}</span>)}
          {shown.type === "script" && row(t.types.script, <span className="font-mono text-xs">{shown.raw.slice(0, 80)}</span>)}
          {printed.trim() && row(t.printed, <span>{printed}</span>)}
        </dl>
      )}

      {pending && (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Loader2 aria-hidden className="size-3.5 animate-spin" />
          {t.resolving}
        </p>
      )}
      {resolved?.payload?.type === "url" && <p className="text-xs text-muted-foreground">{fill(t.resolvedTo, { actual: resolved.payload.registrable })}</p>}
      {resolved?.failed && <p className="text-xs text-muted-foreground">{t.resolveFailed}</p>}

      <div aria-live="polite" className="space-y-1.5">
        {!pending && (
          <p className={cn("flex items-center gap-1.5 font-medium", state === "danger" ? "text-red-700 dark:text-red-400" : state === "warning" ? "text-amber-700 dark:text-amber-400" : "text-emerald-700 dark:text-emerald-400")}>
            {state === "danger" ? <ShieldAlert aria-hidden className="size-4 shrink-0" /> : state === "warning" ? <TriangleAlert aria-hidden className="size-4 shrink-0" /> : <CircleCheck aria-hidden className="size-4 shrink-0" />}
            {t.verdict[state]}
          </p>
        )}
        {issues.length > 0 && (
          <ul className="space-y-1 text-xs">
            {issues.map((issue) => (
              <li key={issue.kind} className={cn("flex gap-1.5 break-words", DANGER_ISSUES.includes(issue.kind) ? "text-red-700 dark:text-red-400" : "text-amber-700 dark:text-amber-400")}>
                <span aria-hidden className="mt-1.5 size-1 shrink-0 rounded-full bg-current" />
                <span className="min-w-0">{describe(issue)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {printedDomain && onOpen && (
        <button type="button" onClick={() => onOpen(`https://${printedDomain}`)} className={cn(button, "w-full border border-amber-500/40 text-amber-900 hover:bg-amber-500/10 dark:text-amber-200")}>
          <span className="truncate">{fill(t.goPrinted, { printed: printedDomain })}</span>
        </button>
      )}
      {(onOpen || onCancel) && shown.type !== "empty" && (
        <div className="flex flex-wrap justify-end gap-2">
          {onCancel && (
            <button type="button" onClick={onCancel} className={cn(button, danger ? "bg-primary text-primary-foreground hover:bg-primary/90" : "border hover:bg-accent")}>
              {t.cancel}
            </button>
          )}
          {onOpen && (
            <button
              type="button"
              disabled={pending}
              onClick={() => onOpen(target)}
              className={cn(button, "max-w-full min-w-0", danger ? "border border-red-500/40 text-red-700 hover:bg-red-500/10 dark:text-red-400" : "bg-primary text-primary-foreground hover:bg-primary/90")}
            >
              <span className="truncate">{openLabel}</span>
            </button>
          )}
        </div>
      )}
    </div>
  )
}
