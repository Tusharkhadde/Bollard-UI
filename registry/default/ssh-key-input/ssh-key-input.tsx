"use client"

// Bollard UI — ssh-key-input · MIT licence · https://bollard-ui.vercel.app/components/ssh-key-input

import * as React from "react"
import { CircleAlert, CircleCheck, Info, KeyRound, ShieldAlert, TriangleAlert } from "lucide-react"

import { cn } from "@/lib/utils"
import { analyzeSshKey, type ExistingSshKey, type ParsedSshKey, type SshIssue, type SshKeyAnalysis } from "@/registry/default/ssh-key-input/ssh-key"

export { analyzeSshKey, decodeBase64, encodeBase64, fromRfc4716, publicFromOpenSshPrivate, readKeyBlob, sha256, sshFingerprint, type ExistingSshKey, type ParsedSshKey, type SshIssue, type SshIssueCode, type SshKeyAnalysis, type SshKeyOptions, type SshKeyType } from "@/registry/default/ssh-key-input/ssh-key"

export const SSH_KEY_INPUT_MESSAGES = {
  label: "Public key",
  placeholder: "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAA… you@laptop",
  hint: "Paste the contents of your .pub file, such as ~/.ssh/id_ed25519.pub.",
  privateTitle: "This is your private key. Don't paste it here.",
  privateBody: "Only the .pub file ever goes on a website. If this key has been sent, saved or shared anywhere, treat it as leaked: make a new key pair and remove this one from every server and account.",
  usePublic: "Use its public key",
  clear: "Clear it",
  cleared: "Private key removed from the field. If it ever left this computer, rotate it.",
  valid: "Valid {name} key",
  bits: "{bits}-bit",
  fingerprint: "Fingerprint",
  comment: "Comment",
  noComment: "none",
  verify: "Compare with ssh-keygen -lf on your computer before you trust it.",
  problems: "{count} problems with this key",
  "pem-public": "This is a PEM public key. Convert it first with ssh-keygen -i -m PKCS8 -f key.pem.",
  rfc4716: "This is the multi-line SSH2 export (PuTTYgen, some routers). Servers expect the one-line OpenSSH form.",
  certificate: "This is an SSH certificate ({detail}), not a public key. Paste the plain .pub file.",
  "line-breaks": "The key is split across lines, so no server will match it. A key must be one line.",
  "missing-type": "The type is missing from the start. This is a {detail} key.",
  "type-mismatch": "The label says one type but the key inside is {detail}.",
  truncated: "The key is cut off or damaged. Copy the whole line again.",
  "not-base64": "This isn't an SSH public key.",
  "unknown-type": "{detail} isn't a key type SSH servers accept.",
  dsa: "DSA keys no longer work: OpenSSH 10 removed them and GitHub stopped accepting them in 2022. Make an Ed25519 key.",
  "rsa-weak": "A {detail}-bit RSA key is too weak. Use at least {min} bits, or better, Ed25519.",
  "rsa-short": "A {detail}-bit RSA key is below {recommended} bits. Some hosts refuse it: GitHub has rejected new RSA keys under 3072 bits since 14 Oct 2026. Ed25519 is shorter and stronger.",
  duplicate: "You've already added this key as “{detail}”.",
  "several-keys": "There's more than one key here. Add them one at a time.",
  options: "Starts with authorized_keys options ({detail}). Paste just the key.",
  "known-hosts": "This line is from known_hosts, so it's a server's key ({detail}), not yours. Paste your own .pub file instead.",
  invisible: "There are invisible or non-standard spaces in the key, usually from a chat app or a document. Servers won't match it.",
  quoted: "The key is wrapped in quotes, which would be saved as part of it.",
  "fix-rfc4716": "Convert to one line",
  "fix-line-breaks": "Join into one line",
  "fix-missing-type": "Add {detail}",
  "fix-type-mismatch": "Use {detail}",
  "fix-several-keys": "Keep the first",
  "fix-options": "Remove options",
  "fix-invisible": "Clean it up",
  "fix-quoted": "Remove quotes",
}
export type SshKeyInputMessages = typeof SSH_KEY_INPUT_MESSAGES

const NAMES: Record<string, string> = {
  "ssh-ed25519": "Ed25519",
  "ssh-rsa": "RSA",
  "ssh-dss": "DSA",
  "ecdsa-sha2-nistp256": "ECDSA P-256",
  "ecdsa-sha2-nistp384": "ECDSA P-384",
  "ecdsa-sha2-nistp521": "ECDSA P-521",
  "sk-ssh-ed25519@openssh.com": "Ed25519 security key",
  "sk-ecdsa-sha2-nistp256@openssh.com": "ECDSA security key",
}
const fill = (text: string, values: Record<string, string | number>) => text.replace(/\{(\w+)\}/g, (match, key: string) => String(values[key] ?? match))
const tones = { danger: "text-red-700 dark:text-red-400", error: "text-red-700 dark:text-red-400", warning: "text-amber-700 dark:text-amber-400", info: "text-muted-foreground" }
const icons = { danger: ShieldAlert, error: CircleAlert, warning: TriangleAlert, info: Info }
const fixClass = (strong: boolean) =>
  cn(
    "inline-flex min-h-6 items-center rounded-md border px-2 font-medium transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
    strong ? "border-red-500/40 text-red-800 hover:bg-red-500/10 dark:text-red-200" : "border-amber-500/40 text-amber-900 hover:bg-amber-500/10 dark:text-amber-200",
  )
const NONE: ExistingSshKey[] = []

/** Holds a value back until typing pauses, so the screen reader hears one summary, not every keystroke. */
function useSettled(text: string, delay = 800) {
  const [settled, setSettled] = React.useState(text)
  React.useEffect(() => {
    const timer = setTimeout(() => setSettled(text), delay)
    return () => clearTimeout(timer)
  }, [text, delay])
  return settled
}

export interface SshKeyInputProps extends Omit<React.ComponentProps<"textarea">, "value" | "defaultValue" | "onChange"> {
  /** Controlled text. */
  value?: string
  /** Initial text when uncontrolled. */
  defaultValue?: string
  /** Called with the new text on every edit or fix. */
  onValueChange?: (value: string) => void
  /** Called whenever the reading changes, so a form can enable its Add button only for a clean key. */
  onAnalysisChange?: (analysis: SshKeyAnalysis) => void
  /** Keys already on the account (line or "SHA256:…" fingerprint, with a label). A repeat is flagged by name. */
  existing?: ExistingSshKey[]
  /** RSA keys below this are rejected. Default 2048. */
  minRsaBits?: number
  /** RSA keys below this get a softer warning. Default 3072, GitHub's minimum for new keys. */
  recommendedRsaBits?: number
  /** Visible label; shorthand for `messages.label`. */
  label?: string
  /** Every visible string. `{detail}`, `{bits}`, `{min}`, `{recommended}`, `{name}`, `{count}` are filled in. */
  messages?: Partial<SshKeyInputMessages>
}

/**
 * A public key field that catches the paste that should never happen: a private
 * key, said loudly, with the public half pulled out in one tap and a reminder to
 * rotate. It also catches DSA and short RSA keys, a key wrapped across lines or
 * cut off, a missing or wrong type prefix, the SSH2 export format, extra keys and
 * a key already on the account, and shows the SHA256 fingerprint and comment
 * exactly as `ssh-keygen -l` prints them.
 */
export function SshKeyInput({
  value,
  defaultValue = "",
  onValueChange,
  onAnalysisChange,
  existing = NONE,
  minRsaBits = 2048,
  recommendedRsaBits = 3072,
  label,
  messages,
  rows = 4,
  id,
  className,
  ref,
  "aria-describedby": describedBy,
  ...props
}: SshKeyInputProps) {
  const t = { ...SSH_KEY_INPUT_MESSAGES, ...messages, ...(label !== undefined && { label }) }
  const [inner, setInner] = React.useState(defaultValue)
  const [cleared, setCleared] = React.useState(false)
  const field = React.useRef<HTMLTextAreaElement>(null)
  const panel = React.useRef<HTMLDivElement>(null)
  const refocus = React.useRef<number | null>(null)
  const autoId = React.useId()
  const inputId = id ?? autoId
  const text = value ?? inner
  React.useImperativeHandle(ref, () => field.current as HTMLTextAreaElement)

  const analysis = React.useMemo(() => analyzeSshKey(text, { existing, minRsaBits, recommendedRsaBits }), [text, existing, minRsaBits, recommendedRsaBits])
  const { key, issues } = analysis
  const secret = issues.find((issue) => issue.code === "private-key" || issue.code === "putty-private")
  const listed = secret ? [] : issues
  const blocking = issues.some((issue) => issue.severity === "error" || issue.severity === "danger")
  const name = key ? (NAMES[key.type] ?? key.type) : ""
  const values = { min: minRsaBits, recommended: recommendedRsaBits }
  const message = (issue: SshIssue) => fill(t[issue.code as keyof SshKeyInputMessages] ?? "", { ...values, detail: issue.detail ?? "" })
  const fixLabel = (issue: SshIssue) => fill(t[`fix-${issue.code}` as keyof SshKeyInputMessages] ?? "", { detail: NAMES[issue.detail ?? ""] ?? issue.detail ?? "" })

  const summary = !text.trim()
    ? ""
    : secret
      ? t.privateTitle
      : listed.length === 1
        ? message(listed[0])
        : listed.length
          ? fill(t.problems, { count: listed.length })
          : key
            ? `${fill(t.valid, { name })}. ${t.fingerprint} ${key.fingerprint}`
            : ""
  const announced = useSettled(summary)

  const onAnalysis = React.useRef(onAnalysisChange)
  onAnalysis.current = onAnalysisChange
  React.useEffect(() => onAnalysis.current?.(analysis), [analysis])

  const update = (next: string) => {
    if (value === undefined) setInner(next)
    onValueChange?.(next)
  }
  // A fix removes its own button, so focus moves on to the next fix or back to the field, never to the page.
  React.useEffect(() => {
    if (refocus.current === null) return
    const buttons = panel.current?.querySelectorAll<HTMLButtonElement>("button[data-fix]") ?? []
    ;(buttons[Math.min(refocus.current, buttons.length - 1)] ?? field.current)?.focus()
    refocus.current = null
  }, [text])
  const apply = (fix: string, button: HTMLElement, fromSecret = false) => {
    refocus.current = fix && !fromSecret ? [...(panel.current?.querySelectorAll("button[data-fix]") ?? [])].indexOf(button) : -1
    if (fromSecret) setCleared(true)
    update(fix)
    if (fix === text) field.current?.focus()
  }

  return (
    <div data-slot="ssh-key-input" className={cn("grid w-full max-w-md min-w-0 grid-cols-[minmax(0,1fr)] gap-1.5 text-sm", className)}>
      <label htmlFor={inputId} className="w-fit font-medium">
        {t.label}
      </label>
      <textarea
        ref={field}
        id={inputId}
        rows={rows}
        value={text}
        onChange={(event) => {
          setCleared(false)
          update(event.target.value)
        }}
        placeholder={t.placeholder}
        // Spellcheck and grammar extensions can send field text to a server. Never for key material.
        spellCheck={false}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="none"
        data-gramm="false"
        data-1p-ignore=""
        aria-invalid={blocking || undefined}
        aria-describedby={[describedBy, `${inputId}-hint`, `${inputId}-report`].filter(Boolean).join(" ")}
        className="w-full min-w-0 resize-y rounded-md border bg-transparent px-3 py-2 font-mono text-base leading-5 break-all shadow-xs transition-[color,box-shadow] outline-none placeholder:font-sans placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-destructive md:text-xs dark:bg-input/30"
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
          <div role="alert" className="grid gap-2 rounded-md border border-red-500/50 bg-red-500/10 p-3 text-red-800 dark:text-red-200">
            <p className="flex gap-2 text-sm font-semibold">
              <ShieldAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
              {t.privateTitle}
            </p>
            <p>{t.privateBody}</p>
            <div className="flex flex-wrap gap-2">
              {secret.fix && (
                <button type="button" data-fix="" onClick={(event) => apply(secret.fix ?? "", event.currentTarget, true)} className={cn(fixClass(true), "bg-background")}>
                  {t.usePublic}
                </button>
              )}
              <button type="button" data-fix="" onClick={(event) => apply("", event.currentTarget, true)} className={cn(fixClass(true), "bg-background")}>
                {t.clear}
              </button>
            </div>
          </div>
        )}
        {cleared && !secret && (
          <p className="flex gap-1.5 text-amber-700 dark:text-amber-400">
            <ShieldAlert aria-hidden className="mt-px size-3.5 shrink-0" />
            {t.cleared}
          </p>
        )}
        {listed.map((issue) => {
          const Icon = icons[issue.severity]
          return (
            <p key={issue.code} className={cn("flex gap-1.5", tones[issue.severity])}>
              <span className="flex h-6 shrink-0 items-center">
                <Icon aria-hidden className="size-3.5" />
              </span>
              <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                <span className="py-1 [overflow-wrap:anywhere]">{message(issue)}</span>
                {issue.fix !== undefined && (
                  <button type="button" data-fix="" onClick={(event) => apply(issue.fix ?? "", event.currentTarget)} className={fixClass(issue.severity === "error")}>
                    {fixLabel(issue)}
                  </button>
                )}
              </span>
            </p>
          )
        })}
        {key && !secret && <KeySummary parsed={key} name={name} ok={!blocking} t={t} />}
      </div>
    </div>
  )
}

function KeySummary({ parsed, name, ok, t }: { parsed: ParsedSshKey; name: string; ok: boolean; t: SshKeyInputMessages }) {
  return (
    <div className="mt-1 grid gap-1.5 rounded-md border bg-muted/40 p-3">
      <p className={cn("flex flex-wrap items-center gap-x-2 gap-y-1 font-medium", ok ? "text-emerald-700 dark:text-emerald-400" : "text-foreground")}>
        {ok ? <CircleCheck aria-hidden className="size-3.5" /> : <KeyRound aria-hidden className="size-3.5" />}
        {ok ? fill(t.valid, { name }) : name}
        <span className="rounded border px-1.5 py-px font-mono text-[11px] font-normal text-muted-foreground">{fill(t.bits, { bits: parsed.bits })}</span>
      </p>
      <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1">
        <dt className="text-muted-foreground">{t.fingerprint}</dt>
        <dd className="font-mono break-all">{parsed.fingerprint}</dd>
        <dt className="text-muted-foreground">{t.comment}</dt>
        <dd className={cn("font-mono [overflow-wrap:anywhere]", !parsed.comment && "font-sans text-muted-foreground italic")}>{parsed.comment || t.noComment}</dd>
      </dl>
      <p className="text-muted-foreground">{t.verify}</p>
    </div>
  )
}
