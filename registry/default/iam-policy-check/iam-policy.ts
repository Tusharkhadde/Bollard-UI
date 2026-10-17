// Bollard UI — iam-policy-check · MIT licence · https://bollard-ui.vercel.app/components/iam-policy-check

/**
 * AWS IAM and S3 bucket policy review, following the IAM JSON policy element reference (Action, NotAction,
 * Principal, NotPrincipal, Condition), the iam:PassRole guide and S3 Block Public Access's definition of "public".
 * Pure functions; any input is safe.
 */

type OneOrMany = string | string[]
export interface PolicyStatement {
  Sid?: string
  Effect?: string
  Action?: OneOrMany
  NotAction?: OneOrMany
  Resource?: OneOrMany
  NotResource?: OneOrMany
  Principal?: "*" | Record<string, OneOrMany>
  NotPrincipal?: "*" | Record<string, OneOrMany>
  Condition?: Record<string, Record<string, OneOrMany>>
}
export interface Policy {
  Version?: string
  Statement?: PolicyStatement | PolicyStatement[]
}

export type IamIssueKind = "parse" | "scp-full-access" | "principal-wildcard" | "oidc-no-sub" | "service-no-source" | "not-resource" | "admin" | "action-wildcard" | "service-wildcard" | "resource-wildcard" | "public-write" | "public-read" | "public-principal" | "not-action" | "not-principal-allow" | "not-principal-deny" | "passrole" | "version"

export interface IamIssue {
  kind: IamIssueKind
  severity: "error" | "warning" | "info"
  /** Statement index, or -1 for the whole policy. */
  statement: number
  /** 0-based line of the statement in the text. */
  line: number
  detail?: string
  /** The whole policy, re-serialised with the fix. */
  fix?: string
  /** Short label of what the fix does, for the button. */
  fixKind?: "used-actions" | "account" | "org" | "deny-condition" | "passed-to-service" | "version" | "source-account"
}

export interface IamContext {
  /** Your AWS account ID; lets a public Principal be narrowed to the account. */
  accountId?: string
  /** Your AWS Organizations ID (o-…); lets a public Principal be limited with aws:PrincipalOrgID. */
  orgId?: string
  /** The actions the principal really uses (e.g. from IAM Access Analyzer policy generation); replaces wildcards. */
  usedActions?: string[]
  /** What the policy is attached as. "scp": an Organizations service control policy, where Allow "*" on "*" is the normal FullAWSAccess baseline. */
  policyType?: "identity" | "resource" | "scp"
}

export interface Readback {
  statement: number
  line: number
  sid?: string
  allow: boolean
  who: string
  what: string
  on: string
  when: string[]
}

const arr = (value: unknown): string[] => (Array.isArray(value) ? value.map(String) : value === undefined || value === null ? [] : [String(value)])
const SERVICE: Record<string, string> = { s3: "S3", iam: "IAM", ec2: "EC2", lambda: "Lambda", dynamodb: "DynamoDB", sqs: "SQS", sns: "SNS", kms: "KMS", sts: "STS", rds: "RDS", ecs: "ECS", ecr: "ECR", logs: "CloudWatch Logs", cloudwatch: "CloudWatch", secretsmanager: "Secrets Manager", ssm: "Systems Manager", cloudformation: "CloudFormation" }
const VERBS: Record<string, string> = {
  "s3:getobject": "read objects", "s3:putobject": "upload or overwrite objects", "s3:deleteobject": "delete objects", "s3:listbucket": "list objects", "s3:putbucketpolicy": "change the bucket policy", "s3:deletebucket": "delete", "s3:putobjectacl": "change object ACLs",
  "iam:passrole": "hand a role to an AWS service", "iam:createuser": "create IAM users", "iam:attachuserpolicy": "attach policies to users", "iam:createaccesskey": "create access keys",
  "sts:assumerole": "assume the role", "kms:decrypt": "decrypt with the key", "secretsmanager:getsecretvalue": "read secrets", "dynamodb:getitem": "read items", "dynamodb:putitem": "write items", "lambda:invokefunction": "invoke the function", "sqs:sendmessage": "send messages",
}
const WRITE = /^(\*|s3:\*|s3:(Put|Delete|Restore|Replicate|Abort)\w*|s3:\w*\*)$/i
const READ = /^s3:(Get|List)\w*\*?$/i
/** Condition keys that make a `"Principal": "*"` statement non-public when given fixed values (S3 Block Public Access). */
const NARROWING = /^(aws:(SourceArn|SourceVpce?|SourceOwner|SourceAccount|PrincipalOrgID|PrincipalAccount|PrincipalArn|userid|SourceIp)|s3:DataAccessPoint(Arn|Account))$/i
const PASSED_TO: [RegExp, string][] = [[/^lambda:/i, "lambda.amazonaws.com"], [/^ec2:/i, "ec2.amazonaws.com"], [/^ecs:/i, "ecs-tasks.amazonaws.com"], [/^glue:/i, "glue.amazonaws.com"], [/^sagemaker:/i, "sagemaker.amazonaws.com"], [/^states:/i, "states.amazonaws.com"], [/^cloudformation:/i, "cloudformation.amazonaws.com"], [/^codebuild:/i, "codebuild.amazonaws.com"], [/^batch:/i, "batch.amazonaws.com"]]

const principals = (p: PolicyStatement["Principal"], type: string) => (p && typeof p === "object" ? arr((p as Record<string, OneOrMany>)[type]) : [])
/** Only this account's root (or a bare account ID): a delegation to the account's own IAM policies, as in the default KMS key policy. */
const ownAccountOnly = (s: PolicyStatement) => !!s.Principal && typeof s.Principal === "object" && Object.keys(s.Principal).every((k) => k === "AWS") && principals(s.Principal, "AWS").length > 0 && principals(s.Principal, "AWS").every((v) => /^(\d{12}|arn:aws[\w-]*:iam::\d{12}:root)$/.test(v))
const conditionKeys = (s: PolicyStatement) => Object.values(s.Condition && typeof s.Condition === "object" ? s.Condition : {}).flatMap((keys) => Object.keys(keys && typeof keys === "object" ? keys : {}).map((k) => k.toLowerCase()))
const isPublicPrincipal = (p: PolicyStatement["Principal"]) => p === "*" || (typeof p === "object" && p !== null && arr((p as Record<string, OneOrMany>).AWS).includes("*"))

/** S3's rule: broad IPv4 ranges (shorter than /8, outside RFC 1918) and wildcards or policy variables keep it public. */
function narrows(condition: PolicyStatement["Condition"]) {
  if (!condition || typeof condition !== "object") return false
  // ForAllValues passes when the key is missing, and IfExists/Not* operators pass for everyone else, so none of them narrow.
  return Object.entries(condition).some(([operator, keys]) => !/Not|IfExists|ForAllValues/.test(operator) && typeof keys === "object" && keys !== null && Object.entries(keys).some(([key, values]) => {
    if (!NARROWING.test(key)) return false
    const list = arr(values)
    // S3 lets a bucket policy wildcard the access point name as long as the account is fixed.
    const fixedAccessPoint = (v: string) => /^s3:DataAccessPointArn$/i.test(key) && /^arn:aws[\w-]*:s3:[\w-]+:\d{12}:accesspoint\/\*$/.test(v)
    if (!list.length || list.some((v) => /[*?]|\$\{/.test(v) && !fixedAccessPoint(v))) return false
    if (/SourceIp/i.test(key)) return list.every((v) => { const [ip, bits = "32"] = v.split("/"); const v6 = ip.includes(":"); const n = Number(bits); return v6 ? n >= 32 : n >= 8 || /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(ip) })
    return true
  }))
}

/** 0-based line of each statement object in the text, found by walking the JSON. */
function statementLines(text: string): number[] {
  const at = text.search(/"Statement"\s*:/)
  if (at < 0) return []
  const lines: number[] = []
  let depth = 0
  let inString = false
  const startArray = text.indexOf("[", at)
  const startObject = text.indexOf("{", at)
  const isArray = startArray >= 0 && (startObject < 0 || startArray < startObject)
  for (let i = isArray ? startArray + 1 : startObject; i < text.length; i++) {
    const ch = text[i]
    if (inString) { if (ch === "\\") i++; else if (ch === '"') inString = false; continue }
    if (ch === '"') inString = true
    else if (ch === "{") { if (depth === 0) lines.push(text.slice(0, i).split("\n").length - 1); depth++ }
    else if (ch === "}") { depth--; if (depth === 0 && !isArray) break }
    else if (ch === "]" && depth === 0) break
  }
  return lines
}

export function parsePolicy(text: string): { policy: Policy | null; error?: { message: string; line: number } } {
  const source = (typeof text === "string" ? text : "").replace(/^\uFEFF/, "")
  if (!source.trim()) return { policy: null }
  try {
    const value = JSON.parse(source)
    if (!value || typeof value !== "object" || Array.isArray(value)) return { policy: null, error: { message: "not an object", line: 0 } }
    return { policy: value as Policy }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const position = Number(/position (\d+)/.exec(message)?.[1] ?? /line (\d+)/.exec(message)?.[1] ?? NaN)
    const line = /line (\d+)/.test(message) ? Number(/line (\d+)/.exec(message)![1]) - 1 : Number.isFinite(position) ? source.slice(0, position).split("\n").length - 1 : 0
    // The engine's wording varies by browser; name the two mistakes people make most, where they are.
    const comma = /,\s*[}\]]/.exec(source)
    if (comma) return { policy: null, error: { message: "a trailing comma before } or ] (JSON doesn't allow one)", line: source.slice(0, comma.index).split("\n").length - 1 } }
    if (/'[^'\n]*'\s*:/.test(source)) return { policy: null, error: { message: "single quotes (JSON needs double quotes)", line: Math.max(0, line) } }
    return { policy: null, error: { message, line: Math.max(0, line) } }
  }
}

export const statementsOf = (policy: Policy | null): PolicyStatement[] => (!policy ? [] : (Array.isArray(policy.Statement) ? policy.Statement : policy.Statement ? [policy.Statement] : []).filter((s): s is PolicyStatement => !!s && typeof s === "object"))

function serialise(original: string, policy: Policy) {
  const json = JSON.stringify(policy, null, 2)
  return (original.startsWith("\uFEFF") ? "\uFEFF" : "") + (/\r\n/.test(original) ? json.replace(/\n/g, "\r\n") : json)
}
/** Applies `change` to a deep copy of statement `index` and returns the new policy text. */
function edit(original: string, policy: Policy, index: number, change: (statement: PolicyStatement, all: PolicyStatement[]) => void) {
  const copy = JSON.parse(JSON.stringify(policy)) as Policy
  const all = statementsOf(copy)
  change(all[index], all)
  copy.Statement = all.length === 1 && !Array.isArray(policy.Statement) ? all[0] : all
  return serialise(original, copy)
}

export function checkPolicy(text: string, context: IamContext = {}): IamIssue[] {
  const source = typeof text === "string" ? text : ""
  const { policy, error } = parsePolicy(source)
  if (error) return [{ kind: "parse", severity: "error", statement: -1, line: error.line, detail: error.message }]
  if (!policy) return []
  const issues: IamIssue[] = []
  const statements = statementsOf(policy)
  const lines = statementLines(source.replace(/^\uFEFF/, ""))
  const allActions = statements.flatMap((s) => arr(s.Action))
  if (policy.Version !== "2012-10-17" && /\$\{aws:/.test(source)) issues.push({ kind: "version", severity: "error", statement: -1, line: 0, detail: policy.Version ?? "", fix: serialise(source, { ...policy, Version: "2012-10-17" }), fixKind: "version" })

  statements.forEach((s, index) => {
    const line = lines[index] ?? 0
    const allow = String(s.Effect).toLowerCase() === "allow"
    const actions = arr(s.Action)
    const resources = arr(s.Resource)
    const anyResource = resources.includes("*")
    // Your own account's root: when the account is known, another account's root is a real cross-account grant.
    const delegated = ownAccountOnly(s) && (!context.accountId || principals(s.Principal, "AWS").every((v) => v.includes(context.accountId!)))
    if (allow && actions.some((a) => a === "*" || a === "*:*") && anyResource && context.policyType === "scp") issues.push({ kind: "scp-full-access", severity: "info", statement: index, line })
    else if (allow && actions.some((a) => a === "*" || a === "*:*") && anyResource) issues.push({ kind: "admin", severity: delegated ? "info" : "error", statement: index, line, ...used(index) })
    else if (allow && actions.some((a) => a === "*" || a === "*:*")) issues.push({ kind: "action-wildcard", severity: "error", statement: index, line, ...used(index) })
    else if (allow && actions.some((a) => /^[\w-]+:\*$/.test(a))) issues.push({ kind: "service-wildcard", severity: delegated ? "info" : "warning", statement: index, line, detail: actions.filter((a) => /:\*$/.test(a)).join(", "), ...used(index) })
    if (allow && anyResource && actions.length && !actions.some((a) => a === "*") && !actions.every((a) => /:(Describe|List|Get\w*CallerIdentity)\w*\*?$/i.test(a)) && !s.Principal) issues.push({ kind: "resource-wildcard", severity: "warning", statement: index, line, detail: actions.slice(0, 3).join(", ") })

    if (allow && s.NotResource) issues.push({ kind: "not-resource", severity: "warning", statement: index, line, detail: arr(s.NotResource).slice(0, 2).join(", ") })

    // Wildcards inside a Principal ARN aren't supported: AWS rejects the policy (Access Analyzer: "Unsupported wildcard in principal").
    const partial = Object.values(s.Principal && typeof s.Principal === "object" ? s.Principal : {}).flatMap(arr).find((v) => v !== "*" && v.includes("*"))
    if (partial) issues.push({ kind: "principal-wildcard", severity: "error", statement: index, line, detail: partial })

    // An OIDC trust (GitHub Actions, GitLab, …) with no :sub condition lets any repo or project on that provider assume the role.
    const oidc = principals(s.Principal, "Federated").find((v) => /oidc-provider\//.test(v))
    if (allow && oidc) {
      const host = oidc.split("oidc-provider/")[1] ?? ""
      // Only a positive match narrows it: StringNotLike on :sub still lets every other repo in.
      const subs = Object.entries(s.Condition && typeof s.Condition === "object" ? s.Condition : {}).filter(([operator]) => !/Not|ForAllValues/.test(operator)).map(([, keys]) => keys).flatMap((keys) => Object.entries(keys && typeof keys === "object" ? keys : {}).filter(([k]) => k.toLowerCase() === `${host.toLowerCase()}:sub`).flatMap(([, v]) => arr(v)))
      if (!subs.length || subs.some((v) => /^(\*|repo:\*.*|[^:]*:\*)$/.test(v))) issues.push({ kind: "oidc-no-sub", severity: "error", statement: index, line, detail: host })
    }

    // A service principal with no source condition: any customer's resource in that service can use this grant (confused deputy).
    const services = principals(s.Principal, "Service")
    const keys = conditionKeys(s)
    if (allow && services.length && !actions.every((a) => /^sts:/i.test(a)) && !keys.some((k) => /^aws:source(arn|account|orgid|orgpaths|owner)$/.test(k))) {
      const fix = context.accountId && /^\d{12}$/.test(context.accountId) ? { fixKind: "source-account" as const, fix: edit(source, policy, index, (st) => { st.Condition = { ...st.Condition, StringEquals: { ...st.Condition?.StringEquals, "aws:SourceAccount": context.accountId! } } }) } : {}
      issues.push({ kind: "service-no-source", severity: "warning", statement: index, line, detail: services.join(", "), ...fix })
    }

    if (allow && s.NotAction) issues.push({ kind: "not-action", severity: anyResource ? "error" : "warning", statement: index, line, detail: arr(s.NotAction).join(", ") })

    if (s.NotPrincipal && allow) issues.push({ kind: "not-principal-allow", severity: "error", statement: index, line })
    else if (s.NotPrincipal) {
      const np = s.NotPrincipal
      const arns = typeof np === "object" ? arr(np.AWS) : []
      const onlyAws = typeof np === "object" && Object.keys(np).every((k) => k === "AWS") && arns.length > 0
      issues.push({ kind: "not-principal-deny", severity: "warning", statement: index, line, fixKind: "deny-condition", fix: onlyAws ? edit(source, policy, index, (st) => { delete st.NotPrincipal; st.Principal = "*"; st.Condition = { ...st.Condition, ArnNotEquals: { "aws:PrincipalArn": arns.length === 1 ? arns[0] : arns } } }) : undefined })
    }

    if (allow && isPublicPrincipal(s.Principal) && !narrows(s.Condition)) {
      const kind: IamIssueKind = actions.some((a) => WRITE.test(a)) ? "public-write" : actions.length && actions.every((a) => READ.test(a)) ? "public-read" : "public-principal"
      const fix = context.accountId && /^\d{12}$/.test(context.accountId)
        ? { fixKind: "account" as const, fix: edit(source, policy, index, (st) => { st.Principal = { AWS: `arn:aws:iam::${context.accountId}:root` } }) }
        : context.orgId ? { fixKind: "org" as const, fix: edit(source, policy, index, (st) => { st.Condition = { ...st.Condition, StringEquals: { ...st.Condition?.StringEquals, "aws:PrincipalOrgID": context.orgId! } } }) } : {}
      issues.push({ kind, severity: kind === "public-read" ? "warning" : "error", statement: index, line, detail: listed([...new Set(actions.map(verb))]), ...fix })
    }

    // iam:PassRole on every role lets the holder give any role (even admin) to a service it controls.
    const passes = actions.some((a) => /^iam:(PassRole|\*|Pass\*)$/i.test(a))
    const scoped = s.Condition && JSON.stringify(s.Condition).includes("iam:PassedToService")
    if (allow && passes && anyResource && !scoped) {
      const service = PASSED_TO.find(([re]) => allActions.some((a) => re.test(a)))?.[1]
      const fix = service && actions.some((a) => /^iam:PassRole$/i.test(a))
        ? edit(source, policy, index, (st, all) => {
            const rest = arr(st.Action).filter((a) => !/^iam:PassRole$/i.test(a))
            const pass: PolicyStatement = { Effect: "Allow", Action: "iam:PassRole", Resource: "*", Condition: { StringEquals: { "iam:PassedToService": service } } }
            if (rest.length) { st.Action = rest.length === 1 ? rest[0] : rest; all.splice(index + 1, 0, pass) }
            else Object.assign(st, pass)
          })
        : undefined
      issues.push({ kind: "passrole", severity: "error", statement: index, line, detail: service, fix, fixKind: fix ? "passed-to-service" : undefined })
    }
  })
  return issues

  function used(index: number) {
    const list = (context.usedActions ?? []).filter((a) => /^[\w-]+:[\w*]+$/.test(a))
    if (!list.length) return {}
    return { fixKind: "used-actions" as const, fix: edit(source, policy!, index, (st) => { st.Action = list.length === 1 ? list[0] : list }) }
  }
}

const shortArn = (arn: string) => {
  const s3 = /^arn:aws[\w-]*:s3:::([^/]+)(\/(.*))?$/.exec(arn)
  if (s3) return s3[3] === "*" ? `every object in ${s3[1]}` : s3[3] ? `${s3[3]} in ${s3[1]}` : `the ${s3[1]} bucket`
  const iam = /^arn:aws[\w-]*:iam::(\d+):(root|role\/.+|user\/.+)$/.exec(arn)
  if (iam) return iam[2] === "root" ? `account ${iam[1]}` : `${iam[2].replace("/", " ")} (account ${iam[1]})`
  return arn
}
const verb = (action: string) => {
  if (action === "*" || action === "*:*") return "do anything in every AWS service"
  const [service = "", name = ""] = action.split(":")
  const label = SERVICE[service.toLowerCase()] ?? service.toUpperCase()
  if (name === "*") return `do anything in ${label}`
  if (name.endsWith("*")) return `every ${label} ${name.slice(0, -1)}… action`
  return VERBS[action.toLowerCase()] ?? action
}
const listed = (items: string[], max = 3) => (items.length <= max ? items.join(", ") : `${items.slice(0, max).join(", ")} and ${items.length - max} more`)
const OPS: Record<string, string> = { StringEquals: "is", StringLike: "matches", StringNotEquals: "isn't", StringNotLike: "doesn't match", ArnEquals: "is", ArnLike: "matches", ArnNotEquals: "isn't", ArnNotLike: "doesn't match", IpAddress: "is in", NotIpAddress: "isn't in", Bool: "is", NumericLessThan: "<", NumericLessThanEquals: "≤", NumericGreaterThan: ">", DateLessThan: "is before", DateGreaterThan: "is after", Null: "is missing:" }

function who(s: PolicyStatement, resourcePolicy: boolean) {
  if (s.NotPrincipal) return `everyone except ${listed(Object.values(s.NotPrincipal === "*" ? {} : s.NotPrincipal).flatMap(arr).map(shortArn))}`
  if (!resourcePolicy) return "whoever has this policy"
  if (isPublicPrincipal(s.Principal)) return narrows(s.Condition) && String(s.Effect).toLowerCase() === "allow" ? "any principal that meets the conditions" : "anyone, including anonymous internet users"
  const p = s.Principal
  if (!p || typeof p !== "object") return "no one (no Principal)"
  return listed(Object.entries(p).flatMap(([type, values]) => arr(values).map((v) => (type === "Service" ? `the ${v} service` : type === "Federated" ? `users signed in via ${v}` : shortArn(/^\d{12}$/.test(v) ? `arn:aws:iam::${v}:root` : v)))))
}

/** The policy in plain words: who can (or can't) do what, on what, and when. */
export function readPolicy(text: string): Readback[] {
  const { policy } = parsePolicy(text)
  const statements = statementsOf(policy)
  const lines = statementLines((typeof text === "string" ? text : "").replace(/^\uFEFF/, ""))
  const resourcePolicy = statements.some((s) => s.Principal || s.NotPrincipal)
  return statements.slice(0, 50).map((s, index) => {
    const actions = arr(s.Action)
    const what = s.NotAction ? `do everything except ${listed(arr(s.NotAction).map((a) => (/^[\w-]+:\*$/.test(a) ? `${SERVICE[a.split(":")[0].toLowerCase()] ?? a.split(":")[0].toUpperCase()} actions` : verb(a))))}` : actions.length ? listed([...new Set(actions.map(verb))]) : "nothing (no Action)"
    const resources = arr(s.Resource)
    const on = s.NotResource ? `everything except ${listed(arr(s.NotResource).map(shortArn))}` : resources.includes("*") ? "every resource" : resources.length ? listed(resources.map(shortArn)) : "—"
    const when = Object.entries(s.Condition && typeof s.Condition === "object" ? s.Condition : {}).flatMap(([op, keys]) => Object.entries(keys && typeof keys === "object" ? keys : {}).map(([key, values]) => `${key} ${OPS[op.replace(/^(ForAnyValue|ForAllValues):/, "").replace(/IfExists$/, "")] ?? op} ${listed(arr(values), 2)}`))
    return { statement: index, line: lines[index] ?? 0, sid: typeof s.Sid === "string" ? s.Sid : undefined, allow: String(s.Effect).toLowerCase() === "allow", who: who(s, resourcePolicy), what, on, when }
  })
}
