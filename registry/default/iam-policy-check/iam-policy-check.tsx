"use client"

// Bollard UI — iam-policy-check · MIT licence · https://bollard-ui.vercel.app/components/iam-policy-check

import * as React from "react"
import { Ban, CircleAlert, CircleCheck, Info, KeyRound, TriangleAlert, WandSparkles } from "lucide-react"

import { cn } from "@/lib/utils"
import { checkPolicy, readPolicy, type IamIssue } from "@/registry/default/iam-policy-check/iam-policy"

export { checkPolicy, parsePolicy, readPolicy, statementsOf, type IamContext, type IamIssue, type IamIssueKind, type Policy, type PolicyStatement, type Readback } from "@/registry/default/iam-policy-check/iam-policy"

export const IAM_POLICY_CHECK_MESSAGES = {
  label: "Policy JSON",
  placeholder: '{\n  "Version": "2012-10-17",\n  "Statement": []\n}',
  clean: "No problems found.",
  problems: "{errors} to fix · {warnings} to review",
  line: "Line {line}",
  selectLine: "Select line {line}",
  fixAll: "Fix {count}",
  readback: "In plain words",
  can: "can",
  cannot: "can't",
  on: "on",
  onlyIf: "only if",
  statement: "Statement {n}",
  parse: "This isn't valid JSON, so AWS will reject it: {detail}",
  "scp-full-access": "Allow \"*\" on \"*\" is AWS's FullAWSAccess baseline: in an SCP it only sets the ceiling, and the Deny statements do the limiting.",
  "principal-wildcard": "{detail}: AWS doesn't support wildcards inside a Principal ARN and rejects the policy. Use Principal \"*\" with an aws:PrincipalArn ArnLike condition.",
  "oidc-no-sub": "Anyone who can get a token from {detail} can assume this role: there's no :sub condition naming your repo or project (or it's a wildcard). Add StringEquals or StringLike on {detail}:sub, such as repo:my-org/my-repo:ref:refs/heads/main.",
  "service-no-source": "{detail} can use this from any AWS account, so another customer's resource could trigger it (the confused deputy problem). Add aws:SourceArn or aws:SourceAccount.",
  "not-resource": "Allow with NotResource grants these actions on every resource except {detail}, including ones created later.",
  admin: "Every action on every resource: this is full administrator access. List only what it calls; IAM Access Analyzer can generate that from CloudTrail.",
  "action-wildcard": "Action \"*\" allows every action in every AWS service, including ones added later.",
  "service-wildcard": "{detail} allows every action in that service, deletes and permission changes included.",
  "resource-wildcard": "{detail} applies to every resource in the account. Scope Resource to the ARNs it needs, such as arn:aws:s3:::my-bucket/*.",
  "public-write": "Anyone on the internet can {detail} here. Nothing limits Principal \"*\": conditions like aws:SecureTransport or a /1 IP range don't count, only fixed values such as aws:SourceVpc, aws:SourceAccount or aws:PrincipalOrgID.",
  "public-principal": "Principal \"*\" with no limiting condition: anyone, including anonymous users, can {detail}.",
  "public-read": "Anyone on the internet can read these objects. Fine for a public website; otherwise limit the Principal or serve it through CloudFront.",
  "not-action": "NotAction with Allow grants every action in every AWS service except {detail}, including services added later.",
  "not-principal-allow": "NotPrincipal only works with Deny; AWS doesn't support it with Allow.",
  "not-principal-deny": "AWS advises against NotPrincipal: it's easy to deny your own role sessions or the account root. Use Principal \"*\" with an aws:PrincipalArn condition.",
  passrole: "iam:PassRole on every role lets this identity give any role, even an admin one, to a service it controls.",
  version: "Policy variables like ${aws:username} only work under Version 2012-10-17; under \"{detail}\" they're literal text.",
  "fix-used-actions": "Use the {count} actions it uses",
  "fix-account": "Limit to account {account}",
  "fix-org": "Limit to my organization",
  "fix-deny-condition": "Rewrite as a condition",
  "fix-passed-to-service": "Only pass to {detail}",
  "fix-version": "Use 2012-10-17",
  "fix-source-account": "Only from account {account}",
}
export type IamPolicyCheckMessages = typeof IAM_POLICY_CHECK_MESSAGES

const fill = (text: string, values: Record<string, string | number>) => text.replace(/\{(\w+)\}/g, (match, key: string) => String(values[key] ?? match))
const tones = { error: "text-red-700 dark:text-red-400", warning: "text-amber-700 dark:text-amber-400", info: "text-muted-foreground" }
const icons = { error: CircleAlert, warning: TriangleAlert, info: Info }
const fixClass = (error: boolean) =>
  cn(
    "inline-flex min-h-6 max-w-full items-center gap-1 rounded-md border px-2 text-left font-medium [overflow-wrap:anywhere] transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
    error ? "border-red-500/40 text-red-800 hover:bg-red-500/10 dark:text-red-200" : "border-amber-500/40 text-amber-900 hover:bg-amber-500/10 dark:text-amber-200",
  )
const capital = (text: string) => text.charAt(0).toUpperCase() + text.slice(1)

function useSettled(text: string, delay = 900) {
  const [settled, setSettled] = React.useState(text)
  React.useEffect(() => {
    const timer = setTimeout(() => setSettled(text), delay)
    return () => clearTimeout(timer)
  }, [text, delay])
  return settled
}

export interface IamPolicyCheckProps extends Omit<React.ComponentProps<"textarea">, "value" | "defaultValue" | "onChange"> {
  /** Controlled policy JSON. */
  value?: string
  /** Initial JSON when uncontrolled. */
  defaultValue?: string
  /** Called with the new text on every edit or fix. Fixes re-format the JSON with 2-space indents. */
  onValueChange?: (value: string) => void
  /** Your 12-digit AWS account ID; enables "Limit to account" on public principals. */
  accountId?: string
  /** Your AWS Organizations ID (o-…); enables "Limit to my organization" when no account ID is given. */
  orgId?: string
  /** Actions the principal really uses (e.g. from IAM Access Analyzer); enables replacing wildcards with them. */
  usedActions?: string[]
  /** What the policy is attached as; "scp" treats Allow "*" on "*" as the FullAWSAccess baseline. */
  policyType?: "identity" | "resource" | "scp"
  /** Visible label; shorthand for `messages.label`. */
  label?: string
  /** Every visible string. `{line}`, `{detail}`, `{count}`, `{account}`, `{n}` are filled in. */
  messages?: Partial<IamPolicyCheckMessages>
}

/**
 * An IAM / S3 bucket policy editor that reads each statement back as who can do what, on what, and when, and
 * flags the grants that leak: "*" actions and service:* wildcards, Resource "*", Principal "*" that S3 would call
 * public (conditions that don't narrow it are named), NotAction and NotPrincipal traps, and iam:PassRole on every
 * role, with scoped one-tap fixes (your used actions, your account or organization, iam:PassedToService).
 */
export function IamPolicyCheck({ value, defaultValue = "", onValueChange, accountId, orgId, usedActions, policyType, label, messages, rows = 12, id, className, ref, "aria-describedby": describedBy, ...props }: IamPolicyCheckProps) {
  const t = { ...IAM_POLICY_CHECK_MESSAGES, ...messages, ...(label !== undefined && { label }) }
  const [inner, setInner] = React.useState(defaultValue)
  const textarea = React.useRef<HTMLTextAreaElement>(null)
  const list = React.useRef<HTMLUListElement>(null)
  const refocus = React.useRef<number | null>(null)
  const autoId = React.useId()
  const inputId = id ?? autoId
  const raw = value ?? inner
  const text = typeof raw === "string" ? raw : ""
  React.useImperativeHandle(ref, () => textarea.current as HTMLTextAreaElement)

  const context = React.useMemo(() => ({ accountId, orgId, usedActions, policyType }), [accountId, orgId, usedActions, policyType])
  const issues = React.useMemo(() => checkPolicy(text, context), [text, context])
  const readback = React.useMemo(() => readPolicy(text), [text])
  const counted = issues.filter((issue) => issue.severity !== "info")
  const errors = counted.filter((issue) => issue.severity === "error").length
  const fixable = counted.filter((issue) => issue.fix !== undefined)
  const summary = !text.trim() ? "" : counted.length ? fill(t.problems, { errors, warnings: counted.length - errors }) : t.clean
  const settled = useSettled(summary)

  const update = (next: string) => {
    if (value === undefined) setInner(next)
    onValueChange?.(next)
  }
  React.useEffect(() => {
    if (refocus.current === null) return
    const buttons = list.current?.querySelectorAll<HTMLButtonElement>("button[data-fix]") ?? []
    ;(buttons[Math.min(refocus.current, buttons.length - 1)] ?? textarea.current)?.focus()
    refocus.current = null
  }, [text])
  const fix = (issue: IamIssue, button: HTMLElement) => {
    refocus.current = [...(list.current?.querySelectorAll("button[data-fix]") ?? [])].indexOf(button)
    update(issue.fix ?? text)
  }
  const fixAll = () => {
    let next = text
    for (let round = 0; round < 30; round++) {
      const first = checkPolicy(next, context).find((issue) => issue.severity !== "info" && issue.fix)
      if (!first?.fix || first.fix === next) break
      next = first.fix
    }
    refocus.current = 0
    update(next)
  }
  const reveal = (line: number) => {
    const el = textarea.current
    if (!el) return
    const rowsText = text.replace(/^\uFEFF/, "").split(/\r\n|\r|\n/)
    const newline = text.includes("\r\n") ? 2 : 1
    const start = rowsText.slice(0, line).reduce((sum, row) => sum + row.length + newline, text.startsWith("\uFEFF") ? 1 : 0)
    el.focus()
    el.setSelectionRange(start, start + (rowsText[line]?.length ?? 0))
  }
  const lineButton = (line: number) => (
    <button type="button" onClick={() => reveal(line)} aria-label={fill(t.selectLine, { line: line + 1 })} className="mr-1 rounded font-mono whitespace-nowrap text-muted-foreground tabular-nums underline-offset-2 outline-none hover:text-foreground hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50">
      {fill(t.line, { line: line + 1 })}
    </button>
  )

  return (
    <div data-slot="iam-policy-check" className={cn("grid w-full max-w-xl min-w-0 grid-cols-[minmax(0,1fr)] gap-1.5 text-sm", className)}>
      <label htmlFor={inputId} className="w-fit font-medium">
        {t.label}
      </label>
      <textarea
        ref={textarea}
        id={inputId}
        rows={rows}
        value={text}
        onChange={(event) => update(event.target.value)}
        spellCheck={false}
        autoCapitalize="none"
        autoCorrect="off"
        wrap="off"
        placeholder={t.placeholder}
        aria-invalid={errors > 0 || undefined}
        aria-describedby={[describedBy, `${inputId}-status`].filter(Boolean).join(" ")}
        className="w-full min-w-0 resize-y rounded-md border bg-transparent px-3 py-2 font-mono text-base leading-5 shadow-xs transition-[color,box-shadow] outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-destructive md:text-xs dark:bg-input/30"
        {...props}
      />
      <span role="status" className="sr-only">
        {settled}
      </span>
      <div id={`${inputId}-status`} className="mt-1.5 flex min-h-6 flex-wrap items-center justify-between gap-2 text-xs empty:hidden">
        {summary && (
          <span className={cn("flex items-center gap-1.5", counted.length ? "text-muted-foreground" : "text-emerald-700 dark:text-emerald-400")}>
            {counted.length ? <TriangleAlert aria-hidden className="size-3.5 text-amber-600 dark:text-amber-400" /> : <CircleCheck aria-hidden className="size-3.5" />}
            {summary}
          </span>
        )}
        {fixable.length > 1 && (
          <button type="button" onClick={fixAll} className={fixClass(false)}>
            <WandSparkles aria-hidden className="size-3.5" />
            {fill(t.fixAll, { count: fixable.length })}
          </button>
        )}
      </div>
      {issues.length > 0 && (
        <ul ref={list} className="grid gap-1.5 text-xs">
          {issues.map((issue) => {
            const Icon = icons[issue.severity]
            return (
              <li key={`${issue.statement}-${issue.kind}-${issue.line}`} className={cn("flex gap-1.5", tones[issue.severity])}>
                <span className="flex h-6 shrink-0 items-center">
                  <Icon aria-hidden className="size-3.5" />
                </span>
                <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="min-w-0 py-1 [overflow-wrap:anywhere]">
                    {lineButton(issue.line)}
                    {fill(t[issue.kind], { detail: issue.detail ?? "" })}
                  </span>
                  {issue.fix !== undefined && issue.fixKind && (
                    <button type="button" data-fix="" onClick={(event) => fix(issue, event.currentTarget)} className={fixClass(issue.severity === "error")}>
                      {fill(t[`fix-${issue.fixKind}`], { count: usedActions?.length ?? 0, account: accountId ?? "", detail: issue.detail ?? "" })}
                    </button>
                  )}
                </span>
              </li>
            )
          })}
        </ul>
      )}
      {readback.length > 0 && (
        <section aria-labelledby={`${inputId}-readback`} className="mt-2 grid gap-1.5 border-t pt-3">
          <h3 id={`${inputId}-readback`} className="text-xs font-medium">
            {t.readback}
          </h3>
          <ol className="grid gap-2 text-xs">
            {readback.map((row) => {
              const risky = issues.some((issue) => issue.statement === row.statement && issue.severity === "error")
              return (
                <li key={row.statement} className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-1.5">
                  {row.allow ? <KeyRound aria-hidden className={cn("mt-0.5 size-3.5", risky ? "text-red-600 dark:text-red-400" : "text-muted-foreground")} /> : <Ban aria-hidden className="mt-0.5 size-3.5 text-muted-foreground" />}
                  <span className="min-w-0 [overflow-wrap:anywhere]">
                    <span className="font-mono text-muted-foreground">{row.sid ?? fill(t.statement, { n: row.statement + 1 })}: </span>
                    <span className={cn(risky && "text-red-700 dark:text-red-400")}>
                      {capital(row.who)} <strong className="font-semibold">{row.allow ? t.can : t.cannot}</strong> {row.what} {t.on} {row.on}
                      {row.when.length > 0 && `, ${t.onlyIf} ${row.when.join("; ")}`}.
                    </span>
                  </span>
                </li>
              )
            })}
          </ol>
        </section>
      )}
    </div>
  )
}
