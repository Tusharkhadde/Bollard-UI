"use client"

// Bollard UI — jwt-inspect · MIT licence · https://bollard-ui.vercel.app/components/jwt-inspect

import * as React from "react"
import { CircleAlert, CircleCheck, Clock, Info, Lock, ShieldAlert, TriangleAlert, X } from "lucide-react"

import { cn } from "@/lib/utils"
import { formatSpan, inspectJwt, type JwtAnalysis, type JwtIssue } from "@/registry/default/jwt-inspect/jwt"

export { cleanToken, decodeBase64Url, formatSpan, inspectJwt, type DecodedJwt, type JwtAnalysis, type JwtIssue, type JwtIssueCode, type JwtOptions } from "@/registry/default/jwt-inspect/jwt"

export const JWT_INSPECT_MESSAGES = {
  label: "JSON Web Token",
  placeholder: "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9…",
  local: "Decoded in this browser only. Nothing is sent. Never paste production tokens into online decoders: whoever holds a token can use it until it expires.",
  clear: "Clear",
  clearLabel: "Clear the token",
  header: "Header",
  payload: "Payload",
  unchecked: "Signature not checked. Decoding shows what a token says, not who made it.",
  validFor: "Valid for {span} more",
  expiredAgo: "Expired {span} ago",
  notYetChip: "Not valid for {span}",
  noExpiry: "Never expires",
  problems: "{errors} to fix · {warnings} to review",
  clean: "Nothing to flag in the claims",
  "not-jwt": "A JWT has three parts separated by dots. This has {detail}.",
  "bad-part": "The {detail} isn't valid base64url JSON. The token may be cut off.",
  encrypted: "This is an encrypted token (JWE {detail}). Only the key holder can read its claims.",
  "alg-none": "alg is “{detail}”: there is no signature, so anyone could have written this. Reject it.",
  "alg-missing": "The header has no alg.",
  "alg-unexpected": "Signed with {detail}, which your verifier doesn't allow ({allowed}).",
  "alg-confusion": "Signed with {detail}, a shared-secret algorithm, but you expect {allowed}. This is the key-confusion attack: a verifier that trusts alg checks it using your public key as the secret.",
  "key-in-header": "The header names its own key ({claim}). Never fetch or trust a key the token picks.",
  expired: "Expired {span} ago, at {time}.",
  "not-yet": "Not valid until {time}, {span} from now.",
  "iat-future": "Issued in the future ({time}). A clock is wrong somewhere.",
  milliseconds: "“{claim}” is in milliseconds. JWT times are seconds, so libraries read it as thousands of years away.",
  "no-exp": "No exp, so this token never expires. A leaked copy works forever.",
  "bad-time": "“{claim}” must be a number of seconds.",
  "long-life": "Lives for {span}. If it leaks, it works that long. Access tokens usually last minutes.",
  "no-aud": "No aud, so any service that trusts this issuer would accept it.",
  "aud-mismatch": "Meant for {detail}, not {audience}.",
  "no-iss": "No iss, so you can't tell who issued it.",
  "iss-mismatch": "Issued by {detail}, not {issuer}.",
  "secret-claim": "“{claim}” looks like a secret. A JWT is encoded, not encrypted: anyone holding it can read this.",
  "personal-claim": "“{claim}” is personal data that anyone holding the token can read.",
  wrapped: "Spaces and line breaks were ignored.",
  extracted: "Read the token out of the surrounding text.",
  "no-signature": "alg says {detail} but the signature is missing. Only a verifier that skips empty signatures would accept this. Reject it.",
  crit: "The header marks {detail} as critical. A verifier that doesn't support all of them must reject the token.",
  "kid-suspicious": "The key ID “{detail}” has quotes, slashes or dots. kid is used to look up a key, so this looks like an injection attempt.",
  "typ-mismatch": "typ is “{detail}”, not {type}. This may be a different kind of token (an ID token used as an access token, say).",
  nested: "This token wraps another JWT. Verify the inner one too.",
}
export type JwtInspectMessages = typeof JWT_INSPECT_MESSAGES

const fill = (text: string, values: Record<string, string | number>) => text.replace(/\{(\w+)\}/g, (match, key: string) => String(values[key] ?? match))
const tones = { danger: "text-red-700 dark:text-red-400", error: "text-red-700 dark:text-red-400", warning: "text-amber-700 dark:text-amber-400", info: "text-muted-foreground" }
const icons = { danger: ShieldAlert, error: CircleAlert, warning: TriangleAlert, info: Info }

function useSettled(text: string, delay = 800) {
  const [settled, setSettled] = React.useState(text)
  React.useEffect(() => {
    const timer = setTimeout(() => setSettled(text), delay)
    return () => clearTimeout(timer)
  }, [text, delay])
  return settled
}

/** "now", ticking every 15 s once mounted. Null during SSR so server and client render the same. */
function useNow(fixed?: Date | number) {
  const [now, setNow] = React.useState<number | null>(null)
  React.useEffect(() => {
    if (fixed !== undefined) return
    setNow(Date.now())
    const timer = setInterval(() => setNow(Date.now()), 15_000)
    return () => clearInterval(timer)
  }, [fixed])
  if (fixed === undefined) return now
  const value = typeof fixed === "number" ? fixed : fixed.getTime()
  return Number.isFinite(value) ? value : now
}

export interface JwtInspectProps extends Omit<React.ComponentProps<"textarea">, "value" | "defaultValue" | "onChange"> {
  /** Controlled token text. */
  value?: string
  /** Initial text when uncontrolled. */
  defaultValue?: string
  /** Called with the new text on every edit or clear. */
  onValueChange?: (value: string) => void
  /** Algorithms your verifier allows, e.g. ["RS256"]. Others are flagged, and HS* against asymmetric as key confusion. */
  algorithms?: string[]
  /** The audience this token should carry. */
  audience?: string
  /** The issuer this token should come from. */
  issuer?: string
  /** The typ the header must carry, e.g. "at+jwt" (RFC 8725 explicit typing). Off by default. */
  type?: string
  /** IANA time zone for readable times. Defaults to the user's own. */
  timeZone?: string
  /** Locale for readable times. Defaults to the user's own. */
  locale?: string
  /** Fixed "now" (for tests and demos). Otherwise the clock, ticking quietly. */
  now?: Date | number
  /** Clock skew allowed, in seconds. Default 60. */
  leeway?: number
  /** Lifetimes longer than this many seconds are flagged. Default one day. */
  maxLifetime?: number
  /** Visible label; shorthand for `messages.label`. */
  label?: string
  /** Every visible string. `{detail}`, `{claim}`, `{span}`, `{time}`, `{allowed}`, `{audience}`, `{issuer}`, `{type}` are filled in. */
  messages?: Partial<JwtInspectMessages>
}

/**
 * A JWT inspector that decodes on the page and never sends the token anywhere,
 * so nobody pastes a live token into an online decoder. It flags alg none and
 * HS-vs-RS key confusion, an expired token or a future nbf in the reader's own
 * time zone, millisecond timestamps, a missing aud or iss, a very long life and
 * secrets or personal data sitting readable in the payload.
 */
export function JwtInspect({
  value,
  defaultValue = "",
  onValueChange,
  algorithms,
  audience,
  issuer,
  type,
  timeZone,
  locale,
  now: fixedNow,
  leeway = 60,
  maxLifetime = 86_400,
  label,
  messages,
  rows = 3,
  id,
  className,
  ref,
  "aria-describedby": describedBy,
  ...props
}: JwtInspectProps) {
  const t = { ...JWT_INSPECT_MESSAGES, ...messages, ...(label !== undefined && { label }) }
  const [inner, setInner] = React.useState(defaultValue)
  const field = React.useRef<HTMLTextAreaElement>(null)
  const autoId = React.useId()
  const inputId = id ?? autoId
  const text = value ?? inner
  const now = useNow(fixedNow)
  React.useImperativeHandle(ref, () => field.current as HTMLTextAreaElement)

  const analysis: JwtAnalysis = React.useMemo(
    () => inspectJwt(text, { algorithms, audience, issuer, type, now: now ?? Number.NaN, leeway, maxLifetime }),
    [text, algorithms, audience, issuer, type, now, leeway, maxLifetime],
  )
  const { decoded, issues } = analysis
  const formatter = React.useMemo(() => {
    const options: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" }
    try {
      return new Intl.DateTimeFormat(locale, { ...options, timeZone })
    } catch {
      return new Intl.DateTimeFormat(undefined, options)
    }
  }, [locale, timeZone])
  const at = (seconds: unknown) => (typeof seconds === "number" && Number.isFinite(seconds) && Math.abs(seconds) < 1e11 ? formatter.format(seconds * 1000) : "")

  const counted = issues.filter((issue) => issue.severity !== "info")
  const errors = counted.filter((issue) => issue.severity !== "warning").length
  const summary = !text.trim() ? "" : counted.length ? fill(t.problems, { errors, warnings: counted.length - errors }) : t.clean
  const announced = useSettled(summary)
  const flagged = new Map(issues.filter((issue) => issue.claim).map((issue) => [issue.claim?.split(".")[0], issue.severity]))

  const message = (issue: JwtIssue) =>
    fill(t[issue.code], {
      detail: issue.detail ?? "",
      claim: issue.claim ?? "",
      span: issue.seconds === undefined ? "" : formatSpan(issue.seconds),
      time: at(issue.claim ? decoded?.payload?.[issue.claim] : undefined),
      allowed: algorithms?.join(", ") ?? "",
      audience: audience ?? "",
      issuer: issuer ?? "",
      type: type ?? "",
    })

  const payload = decoded?.payload
  const exp = typeof payload?.exp === "number" && payload.exp < 1e11 ? payload.exp : undefined
  const nbf = typeof payload?.nbf === "number" && payload.nbf < 1e11 ? payload.nbf : undefined
  const left = exp !== undefined && now !== null ? exp - now / 1000 : undefined
  const chip =
    !payload || now === null
      ? null
      : nbf !== undefined && nbf - leeway > now / 1000
        ? { tone: "error", text: fill(t.notYetChip, { span: formatSpan(nbf - now / 1000) }) }
        : left === undefined
          ? exp === undefined && !("exp" in payload) ? { tone: "warning", text: t.noExpiry } : null
          : left + leeway <= 0
            ? { tone: "error", text: fill(t.expiredAgo, { span: formatSpan(left) }) }
            : { tone: left < 300 ? "warning" : "ok", text: fill(t.validFor, { span: formatSpan(left) }) }

  const update = (next: string) => {
    if (value === undefined) setInner(next)
    onValueChange?.(next)
  }

  return (
    <div data-slot="jwt-inspect" className={cn("grid w-full max-w-xl min-w-0 grid-cols-[minmax(0,1fr)] gap-1.5 text-sm", className)}>
      <p className="flex gap-1.5 rounded-md border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
        <Lock aria-hidden className="mt-px size-3.5 shrink-0" />
        <span id={`${inputId}-local`}>{t.local}</span>
      </p>
      <div className="mt-1.5 flex items-center justify-between gap-2">
        <label htmlFor={inputId} className="font-medium">
          {t.label}
        </label>
        {text && (
          <button
            type="button"
            onClick={() => {
              update("")
              field.current?.focus()
            }}
            aria-label={t.clearLabel}
            className="inline-flex h-7 items-center gap-1 rounded-md px-2 text-xs text-muted-foreground transition-colors outline-none hover:bg-accent hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            <X aria-hidden className="size-3.5" />
            {t.clear}
          </button>
        )}
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
        data-1p-ignore=""
        aria-invalid={errors > 0 || undefined}
        aria-describedby={[describedBy, `${inputId}-local`, `${inputId}-report`].filter(Boolean).join(" ")}
        className="w-full min-w-0 resize-y rounded-md border bg-transparent px-3 py-2 font-mono text-base leading-5 break-all shadow-xs transition-[color,box-shadow] outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-destructive md:text-xs dark:bg-input/30"
        {...props}
      />
      <span role="status" className="sr-only">
        {announced}
      </span>
      <div id={`${inputId}-report`} className="grid gap-1.5 text-xs empty:hidden">
        {(chip || summary) && (
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            {chip && (
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 font-medium tabular-nums",
                  chip.tone === "ok" ? "border-emerald-500/40 text-emerald-700 dark:text-emerald-400" : chip.tone === "warning" ? "border-amber-500/40 text-amber-700 dark:text-amber-400" : "border-red-500/40 text-red-700 dark:text-red-400",
                )}
              >
                <Clock aria-hidden className="size-3.5" />
                {chip.text}
              </span>
            )}
            {summary && (
              <span className={cn("flex items-center gap-1.5", counted.length ? "text-muted-foreground" : "text-emerald-700 dark:text-emerald-400")}>
                {!counted.length && <CircleCheck aria-hidden className="size-3.5" />}
                {summary}
              </span>
            )}
          </div>
        )}
        {issues.length > 0 && (
          <ul className="grid gap-1">
            {issues.map((issue) => {
              const Icon = icons[issue.severity]
              return (
                <li key={`${issue.code}-${issue.claim ?? ""}`} className={cn("flex gap-1.5", tones[issue.severity], issue.severity === "danger" && "font-medium")}>
                  <Icon aria-hidden className="mt-px size-3.5 shrink-0" />
                  <span className="min-w-0 [overflow-wrap:anywhere]">{message(issue)}</span>
                </li>
              )
            })}
          </ul>
        )}
        {decoded && (
          <>
            <ClaimBlock title={t.header} data={decoded.header} flagged={flagged} at={() => ""} />
            {payload ? (
              <ClaimBlock title={t.payload} data={payload} flagged={flagged} at={at} />
            ) : (
              decoded.payloadText !== undefined && <ClaimBlock title={t.payload} raw={decoded.payloadText} flagged={flagged} at={at} />
            )}
            {decoded.signature && <p className="text-muted-foreground">{t.unchecked}</p>}
          </>
        )}
      </div>
    </div>
  )
}

const lineTone = { danger: "bg-red-500/10 text-red-800 dark:text-red-200", error: "bg-red-500/10 text-red-800 dark:text-red-200", warning: "bg-amber-500/10 text-amber-900 dark:text-amber-200", info: "" }

/** Pretty JSON, one row per top-level claim, with time claims read out and flagged claims tinted. */
function ClaimBlock({ title, data, raw, flagged, at }: { title: string; data?: Record<string, unknown>; raw?: string; flagged: Map<string | undefined, JwtIssue["severity"]>; at: (seconds: unknown) => string }) {
  const entries = data ? Object.entries(data).slice(0, 200) : []
  return (
    <figure className="mt-1.5 grid min-w-0 gap-1">
      <figcaption className="font-medium text-muted-foreground">{title}</figcaption>
      <div className="overflow-hidden rounded-md border bg-muted/30 py-1.5 font-mono text-xs leading-5">
        {raw !== undefined ? (
          <p className="px-3 break-all whitespace-pre-wrap">{raw.slice(0, 4000)}</p>
        ) : (
          entries.map(([key, val]) => {
            const severity = flagged.get(key)
            const time = key === "exp" || key === "nbf" || key === "iat" || key === "auth_time" ? at(val) : ""
            return (
              <p key={key} className={cn("px-3 break-all whitespace-pre-wrap", severity && lineTone[severity])}>
                <span className="text-sky-700 dark:text-sky-300">&quot;{key}&quot;</span>: {(JSON.stringify(val, null, 2) ?? String(val)).slice(0, 2000)}
                {time && <span className="font-sans break-normal text-muted-foreground"> · <span className="whitespace-nowrap">{time}</span></span>}
              </p>
            )
          })
        )}
      </div>
    </figure>
  )
}
