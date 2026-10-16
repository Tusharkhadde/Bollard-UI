/**
 * GitHub Actions workflow review, following GitHub Security Lab ("Preventing pwn requests", "Untrusted input")
 * and GitHub's "Secure use reference" and workflow syntax docs. Includes a small, line-aware YAML reader
 * (block maps and sequences, block scalars, simple flow collections) that never throws.
 */

export type YNode =
  | { kind: "map"; line: number; indent: number; entries: { key: string; line: number; value: YNode | null }[] }
  | { kind: "seq"; line: number; items: YNode[] }
  | { kind: "scalar"; line: number; value: string; from: number; to: number }

interface Row { indent: number; text: string }

const toLines = (text: string) => text.replace(/^\uFEFF/, "").split(/\r\n|\r|\n/)
const rebuild = (original: string, lines: string[]) => (original.startsWith("\uFEFF") ? "\uFEFF" : "") + lines.join(/\r\n/.test(original) ? "\r\n" : "\n")

/** Drops a trailing ` # comment` that isn't inside quotes. */
function stripComment(text: string) {
  let quote = ""
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (quote) { if (ch === quote) quote = "" }
    else if (ch === "'" || ch === '"') quote = ch
    else if (ch === "#" && (i === 0 || /\s/.test(text[i - 1]))) return text.slice(0, i).trimEnd()
  }
  return text.trimEnd()
}
const unquote = (value: string) => value.trim().replace(/^"(.*)"$/s, "$1").replace(/^'(.*)'$/s, "$1")
const KEY = /^("[^"]*"|'[^']*'|[^\s:'"][^:]*?)\s*:(?:\s+(.*)|$)/

/** Whether every [ and { outside quotes is closed. */
function flowClosed(text: string) {
  let depth = 0
  let quote = ""
  for (const ch of text) {
    if (quote) { if (ch === quote) quote = "" }
    else if (ch === "'" || ch === '"') quote = ch
    else if (ch === "[" || ch === "{") depth++
    else if (ch === "]" || ch === "}") depth--
  }
  return depth <= 0
}
/** Splits a flow collection's body on top-level commas, respecting quotes and nesting. */
function splitFlow(text: string) {
  const parts: string[] = []
  let depth = 0
  let quote = ""
  let start = 0
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (quote) { if (ch === quote) quote = "" }
    else if (ch === "'" || ch === '"') quote = ch
    else if (ch === "[" || ch === "{") depth++
    else if (ch === "]" || ch === "}") depth--
    else if (ch === "," && depth === 0) { parts.push(text.slice(start, i)); start = i + 1 }
  }
  parts.push(text.slice(start))
  return parts.map((part) => part.trim()).filter(Boolean)
}
/** Parses `[a, {b: c}]` or `{a: [b]}` into nodes on one line. */
function flow(text: string, line: number, depth = 0): YNode {
  const v = text.trim()
  const open = v[0]
  const close = open === "[" ? "]" : "}"
  const inner = v.endsWith(close) ? v.slice(1, -1) : v.slice(1)
  const value = (part: string): YNode => (depth < 20 && /^[[{]/.test(part) ? flow(part, line, depth + 1) : { kind: "scalar", line, value: unquote(part), from: line, to: line })
  if (open === "[") return { kind: "seq", line, items: splitFlow(inner).map(value) }
  return {
    kind: "map", line, indent: 0,
    entries: splitFlow(inner).map((part) => {
      const at = /^("[^"]*"|'[^']*'|[^:]*?)\s*:(\s|$)/.exec(part)
      return at ? { key: unquote(at[1]), line, value: value(part.slice(at[0].length)) } : { key: unquote(part), line, value: null }
    }),
  }
}

/** Parses the YAML subset workflows use. Returns null for empty input. */
export function parseYaml(text: string): YNode | null {
  const raw = toLines(typeof text === "string" ? text : "")
  const rows: (Row | null)[] = raw.map((line) => {
    if (!line.trim() || /^\s*#/.test(line) || /^(---|\.\.\.)\s*$/.test(line)) return null
    return { indent: line.length - line.trimStart().length, text: stripComment(line.trimStart()) }
  })
  const next = (from: number) => { let i = from; while (i < rows.length && !rows[i]) i++; return i }
  let guard = 0
  // Anchors (&name) and aliases (*name), which GitHub Actions supports since September 2025. Merge keys (<<) it doesn't.
  const anchors = new Map<string, YNode>()
  const ANCHOR = /^&([^\s[\]{},]+)(?:\s+(.*))?$/
  const alias = (text: string) => { const m = /^\*([^\s[\]{},]+)$/.exec(text.trim()); return m ? anchors.get(m[1]) : undefined }
  const remember = (name: string | undefined, value: YNode | null) => { if (name && value) anchors.set(name, value) }

  /** Rows deeper than `indent` that continue a value (block scalar body, folded plain scalar, open flow collection). */
  function continuation(i: number, indent: number) {
    let end = i
    for (let j = i + 1; j < raw.length; j++) {
      if (!raw[j].trim()) continue
      if (raw[j].length - raw[j].trimStart().length <= indent) break
      end = j
    }
    return end
  }
  /** Lines from..to as one value: comment-only lines (YAML comments, not content) become blank, the common indent is removed. */
  function body(from: number, to: number, keepComments: boolean) {
    const rowsText = raw.slice(from, to + 1).map((line) => (!keepComments && /^\s*#/.test(line) ? "" : line))
    const pad = Math.min(...rowsText.filter((line) => line.trim()).map((line) => line.length - line.trimStart().length))
    return rowsText.map((line) => line.slice(Number.isFinite(pad) ? pad : 0)).join("\n")
  }
  function scalarAt(i: number, value: string, keyIndent: number): [YNode, number] {
    const v = value.trim()
    if (/^[|>][-+0-9]*$/.test(v)) {
      const end = continuation(i, keyIndent)
      return [{ kind: "scalar", line: i, value: body(i + 1, end, true), from: i + 1, to: end }, end + 1]
    }
    if (/^[[{]/.test(v)) {
      // A flow collection may run over several lines (`needs: [\n a,\n b ]`): gather until the brackets close.
      let text = v
      let end = i
      while (!flowClosed(text) && end + 1 < raw.length && end - i < 500) { end++; rows[end] = null; text += " " + stripComment(raw[end].trim()) }
      return [flow(text, i), end + 1]
    }
    // Plain or quoted scalars can fold onto deeper lines (`if: a\n  || b`).
    const end = continuation(i, keyIndent)
    if (end > i) for (let j = i + 1; j <= end; j++) rows[j] = null
    const folded = end > i ? `${v}\n${body(i + 1, end, false)}` : v
    return [{ kind: "scalar", line: i, value: unquote(folded), from: i, to: end }, end + 1]
  }
  function node(i: number, minIndent: number): [YNode | null, number] {
    i = next(i)
    const row = rows[i]
    if (!row || row.indent < minIndent || guard++ > 20000) return [null, i]
    return row.text === "-" || row.text.startsWith("- ") ? seq(i, row.indent) : map(i, row.indent)
  }
  function seq(i: number, indent: number): [YNode, number] {
    const out: YNode = { kind: "seq", line: i, items: [] }
    while (i < rows.length) {
      i = next(i)
      const row = rows[i]
      if (!row || row.indent !== indent || !(row.text === "-" || row.text.startsWith("- "))) break
      const rest = row.text.slice(1)
      const childIndent = indent + 1 + (rest.length - rest.trimStart().length)
      const anchored = ANCHOR.exec(rest.trim())
      const inner = anchored ? (anchored[2] ?? "").trim() : rest.trimStart()
      const reused = alias(inner)
      if (reused) { out.items.push(reused); i++; continue }
      if (!inner) { const [child, after] = node(i + 1, indent + 1); if (child) out.items.push(child); remember(anchored?.[1], child); i = after; continue }
      const [child, after] = KEY.test(inner) && !/^["'[{]/.test(inner) ? ((rows[i] = { indent: childIndent, text: inner }), map(i, childIndent)) : scalarAt(i, inner, indent)
      out.items.push(child)
      // `- &a key: v` anchors the key, not the map (YAML spec), so only a bare value is remembered.
      if (!KEY.test(inner)) remember(anchored?.[1], child)
      i = after
    }
    return [out, i]
  }
  function map(i: number, indent: number): [YNode, number] {
    const out: YNode = { kind: "map", line: i, indent, entries: [] }
    while (i < rows.length) {
      i = next(i)
      const row = rows[i]
      if (!row || row.indent !== indent || row.text.startsWith("- ")) break
      const m = KEY.exec(row.text)
      if (!m) { i++; continue }
      const key = unquote(m[1])
      const anchored = ANCHOR.exec((m[2] ?? "").trim())
      const rest = anchored ? (anchored[2] ?? "").trim() : (m[2] ?? "").trim()
      const reused = alias(rest)
      if (reused) { out.entries.push({ key, line: i, value: reused }); i++; continue }
      if (rest) {
        const [value, after] = scalarAt(i, rest, indent)
        out.entries.push({ key, line: i, value })
        remember(anchored?.[1], value)
        i = after
        continue
      }
      const j = next(i + 1)
      const child = rows[j]
      if (child && child.indent > indent && /^[[{]/.test(child.text)) {
        const [value, after] = scalarAt(j, child.text, indent)
        out.entries.push({ key, line: i, value })
        remember(anchored?.[1], value)
        i = after
      } else if (child && child.indent > indent && !(child.text === "-" || child.text.startsWith("- ")) && !KEY.test(child.text)) {
        const end = continuation(i, indent)
        for (let r = j; r <= end; r++) rows[r] = null
        const value: YNode = { kind: "scalar", line: j, value: body(j, end, false).trim(), from: j, to: end }
        out.entries.push({ key, line: i, value })
        remember(anchored?.[1], value)
        i = end + 1
      } else if (child && (child.indent > indent || (child.indent === indent && (child.text === "-" || child.text.startsWith("- "))))) {
        const [value, after] = child.indent === indent ? seq(j, indent) : node(j, indent + 1)
        out.entries.push({ key, line: i, value })
        remember(anchored?.[1], value)
        i = after
      } else {
        out.entries.push({ key, line: i, value: null })
        i++
      }
    }
    return [out, i]
  }
  return node(0, 0)[0]
}

export const get = (node: YNode | null | undefined, key: string) => (node?.kind === "map" ? node.entries.find((entry) => entry.key === key) : undefined)
const str = (node: YNode | null | undefined) => (node?.kind === "scalar" ? node.value : "")
const list = (node: YNode | null | undefined): string[] => (!node ? [] : node.kind === "scalar" ? [node.value] : node.kind === "seq" ? node.items.map(str) : node.entries.map((entry) => entry.key))

/** Fields an outside contributor controls (GitHub Security Lab's list), plus github.head_ref. */
const UNTRUSTED = /github\.(head_ref|event\.(issue\.(title|body)|pull_request\.(title|body|head\.(ref|label|repo\.default_branch))|comment\.body|review\.body|review_comment\.body|pages\.[^.]+\.page_name|commits\.[^.]+\.(message|author\.(email|name))|head_commit\.(message|author\.(email|name))|discussion\.(title|body)|workflow_run\.(head_branch|head_commit\.message|display_title)))/
const FORK_TRIGGERS = ["pull_request", "pull_request_target", "issue_comment", "pull_request_review", "pull_request_review_comment", "issues", "discussion", "discussion_comment", "workflow_run"]
const FIRST_PARTY = /^(actions|github)\//

export type WorkflowIssueKind = "pwn-request" | "injection" | "event-in-run" | "unpinned" | "permissions-missing" | "write-all" | "secret-dump" | "secret-echo" | "secret-transform" | "self-hosted"

export interface WorkflowIssue {
  kind: WorkflowIssueKind
  severity: "error" | "warning" | "info"
  line: number
  /** Filled into the message: an expression, an action, a secret name, a job. */
  detail?: string
  /** The whole workflow with the fix applied. */
  fix?: string
  /** For unpinned actions: the repo and ref to resolve to a commit SHA. */
  pin?: { action: string; ref: string }
}

export interface WorkflowContext {
  /** Whether the repository is public; self-hosted runners on public repos are errors. */
  visibility?: "public" | "private"
}

interface Step { node: YNode; job: string; jobNode: YNode }

function steps(root: YNode | null): Step[] {
  // A composite action (action.yml): its steps live under runs.steps.
  const runs = get(root, "runs")?.value
  const own = get(runs, "steps")?.value
  if (runs && own?.kind === "seq") return own.items.map((node) => ({ node, job: "action", jobNode: runs }))
  const jobs = get(root, "jobs")?.value
  if (jobs?.kind !== "map") return []
  return jobs.entries.flatMap((job) => {
    const list = get(job.value, "steps")?.value
    return list?.kind === "seq" ? list.items.map((node) => ({ node, job: job.key, jobNode: job.value! })) : []
  })
}

/** Last source line a node covers. */
export function endLine(node: YNode | null | undefined): number {
  if (!node) return -1
  if (node.kind === "scalar") return Math.max(node.line, node.to)
  if (node.kind === "seq") return Math.max(node.line, ...node.items.map(endLine))
  return Math.max(node.line, ...node.entries.map((e) => Math.max(e.line, endLine(e.value))))
}

/** The shell quote open at the end of `text`: `'`, `"` or "" (single-line, POSIX rules). */
function shellQuote(text: string) {
  let quote = ""
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (quote === "'") { if (ch === "'") quote = "" }
    else if (ch === "\\") i++
    else if (quote === '"') { if (ch === '"') quote = "" }
    else if (ch === "'" || ch === '"') quote = ch
  }
  return quote
}

const envName = (expr: string) => (expr.split(".").filter((part) => !/^(github|event|\*|\d+)$/.test(part)).slice(-2).join("_").toUpperCase().replace(/[^A-Z0-9_]/g, "_") || "VALUE")

/** Moves `${{ expr }}` out of the script into the step's env block, quoting the shell variable. */
function moveToEnv(source: string, step: YNode, script: YNode & { kind: "scalar" }, expr: string, name: string) {
  const lines = toLines(source)
  const pattern = new RegExp(`\\$\\{\\{\\s*${expr.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\}\\}`, "g")
  for (let l = script.from; l <= script.to; l++) {
    lines[l] = lines[l].replace(pattern, (match, offset: number, whole: string) => {
      const state = shellQuote(whole.slice(0, offset))
      // Inside "…" the variable expands as is; inside '…' it has to close and reopen the quotes.
      return state === '"' ? `\${${name}}` : state === "'" ? `'"\${${name}}"'` : `"\${${name}}"`
    })
  }
  if (step.kind !== "map") return rebuild(source, lines)
  const indent = " ".repeat(step.indent)
  const env = get(step, "env")
  const entry = `${name}: \${{ ${expr} }}`
  if (env?.value?.kind === "map" && env.value.entries.length) {
    const last = env.value.entries[env.value.entries.length - 1]
    if (!env.value.entries.some((e) => e.key === name)) lines.splice(last.line + 1, 0, " ".repeat(env.value.indent) + entry)
  } else {
    // After the step's last line, so it also works when the step starts with `- run:`.
    lines.splice(endLine(step) + 1, 0, `${indent}env:`, `${indent}  ${entry}`)
  }
  return rebuild(source, lines)
}

/** Reviews a workflow file. Issues are sorted by line. */
export function checkWorkflow(text: string, context: WorkflowContext = {}): WorkflowIssue[] {
  const source = typeof text === "string" ? text : ""
  const root = parseYaml(source)
  if (root?.kind !== "map") return []
  const issues: WorkflowIssue[] = []
  const lines = () => toLines(source)
  const on = get(root, "on") ?? get(root, "true")
  const triggers = list(on?.value)
  const target = triggers.includes("pull_request_target")
  const privileged = target || triggers.includes("workflow_run")
  // issue_comment runs in the base repo with secrets; checking out the PR it was posted on runs the fork's code.
  const commentTrigger = triggers.includes("issue_comment")
  const all = steps(root)

  for (const { node: step, job } of all) {
    const uses = str(get(step, "uses")?.value)
    const run = get(step, "run")?.value
    const ref = str(get(get(step, "with")?.value, "ref")?.value)
    // Pwn request: a privileged trigger that checks out and runs the PR's code.
    const checksOutHead = (/^actions\/checkout@/.test(uses) && /pull_request\.(head\.(sha|ref)|merge_commit_sha)|github\.head_ref|refs\/pull\/|workflow_run\.head_(sha|branch)/.test(ref)) || (run?.kind === "scalar" && /gh pr checkout|git (checkout|fetch)[^\n]*(pull\/|head_ref|head\.sha|head\.ref)/.test(run.value))
    if ((privileged || commentTrigger) && checksOutHead) {
      const triggerLine = on?.value?.kind === "map" ? on.value.entries.find((e) => e.key === "pull_request_target")?.line : on?.line
      let fix: string | undefined
      if (target && triggerLine !== undefined) {
        const next = lines()
        next[triggerLine] = next[triggerLine].replace("pull_request_target", "pull_request")
        fix = rebuild(source, next)
      }
      issues.push({ kind: "pwn-request", severity: "error", line: get(step, "uses")?.line ?? get(step, "run")?.line ?? step.line, detail: target ? "pull_request_target" : triggers.includes("workflow_run") ? "workflow_run" : "issue_comment", fix })
    }
    // Script injection: expressions are pasted into the script before the shell runs it.
    const scripts = [run, /^actions\/github-script@/.test(uses) ? get(get(step, "with")?.value, "script")?.value : undefined]
    for (const script of scripts) {
      if (script?.kind !== "scalar") continue
      const seen = new Set<string>()
      for (const m of script.value.matchAll(/\$\{\{\s*([^}]+?)\s*\}\}/g)) {
        const expr = m[1]
        if (seen.has(expr)) continue
        seen.add(expr)
        // A comparison or contains()/startsWith()/endsWith() yields true or false, so the text never reaches the shell (a || b yields a or b, so it still counts).
        if (/^(!|(contains|startsWith|endsWith)\s*\()/.test(expr.trim()) || /[=!]=|[<>]=?/.test(expr.replace(/'[^']*'/g, ""))) continue
        const untrusted = UNTRUSTED.test(expr)
        // Numbers, IDs and commit SHAs can't carry shell syntax (zizmor treats them as safe too); workflow_dispatch inputs need write access.
        const refs = expr.match(/github\.event\.[\w.*-]+/g) ?? []
        if (!untrusted && refs.every((ref) => /\.(number|id|run_number|run_attempt|sha|head_sha|base_sha|merge_commit_sha)$/.test(ref) || /^github\.event\.inputs\./.test(ref))) continue
        const fix = script === run ? moveToEnv(source, step, script, expr, envName(expr)) : undefined
        issues.push({ kind: untrusted ? "injection" : "event-in-run", severity: untrusted ? "error" : "warning", line: script.from === script.line ? script.line : script.from + script.value.split("\n").findIndex((l) => l.includes(m[0])), detail: expr, fix })
      }
      // Secrets in logs: echoed, dumped whole, or transformed so redaction can't match them.
      if (script !== run) continue
      const secretEnv = new Set([...(get(step, "env")?.value?.kind === "map" ? (get(step, "env")!.value as YNode & { kind: "map" }).entries : []), ...(get(all.find((s) => s.job === job)?.jobNode, "env")?.value?.kind === "map" ? ((get(all.find((s) => s.job === job)?.jobNode, "env")!.value as YNode & { kind: "map" }).entries) : [])].filter((e) => /secrets\./.test(str(e.value))).map((e) => e.key))
      script.value.split("\n").forEach((row, offset) => {
        const line = script.from === script.line ? script.line : script.from + offset
        const echoes = /\b(echo|printf|cat\s*<<)\b/.test(row)
        const usesSecret = /\$\{\{\s*secrets\.\w+/.test(row) || [...secretEnv].some((name) => new RegExp(`\\$\\{?${name}\\b`).test(row))
        const next = lines()
        next.splice(line, 1)
        if (/toJSON\(\s*secrets\s*\)|\$\{\{\s*secrets\s*\}\}/.test(row)) issues.push({ kind: "secret-dump", severity: "error", line, fix: script.from !== script.line ? rebuild(source, next) : undefined })
        else if (usesSecret && /\|\s*(base64|xxd|od|rev|tr|sed|hexdump)\b|base64\s+<<</.test(row)) issues.push({ kind: "secret-transform", severity: "error", line })
        else if (usesSecret && echoes && !/>>\s*"?\$GITHUB_(ENV|OUTPUT)|::add-mask::|>\s*\S/.test(row)) issues.push({ kind: "secret-echo", severity: "warning", line, fix: script.from !== script.line ? rebuild(source, next) : undefined })
      })
    }
  }

  // Unpinned actions: tags and branches can be moved to new code; a full commit SHA can't.
  const usesNodes = [...all.map((s) => get(s.node, "uses")), ...(get(root, "jobs")?.value?.kind === "map" ? (get(root, "jobs")!.value as YNode & { kind: "map" }).entries.map((job) => get(job.value, "uses")) : [])]
  for (const entry of usesNodes) {
    const uses = str(entry?.value)
    if (!entry || !uses || uses.startsWith("./") || uses.startsWith("docker://")) continue
    const [action, ref = ""] = uses.split("@")
    if (/^[0-9a-f]{40}$/.test(ref)) continue
    const firstParty = FIRST_PARTY.test(action)
    issues.push({ kind: "unpinned", severity: firstParty ? "info" : "warning", line: entry.line, detail: uses, pin: ref ? { action, ref } : undefined })
  }

  // Token permissions: a missing block falls back to the repo/org default, which can be read/write everything.
  const top = get(root, "permissions")
  const jobs = get(root, "jobs")?.value
  const jobEntries = jobs?.kind === "map" ? jobs.entries : []
  const jobsLine = get(root, "jobs")?.line
  if (!top && jobEntries.some((job) => !get(job.value, "permissions")) && jobsLine !== undefined) {
    const next = lines()
    next.splice(jobsLine, 0, "permissions:", "  contents: read", "")
    issues.push({ kind: "permissions-missing", severity: privileged ? "error" : "warning", line: jobsLine, fix: rebuild(source, next) })
  }
  for (const entry of [top, ...jobEntries.map((job) => get(job.value, "permissions"))]) {
    if (entry && str(entry.value) === "write-all") {
      const next = lines()
      const indent = next[entry.line].length - next[entry.line].trimStart().length
      next.splice(entry.line, 1, `${" ".repeat(indent)}permissions:`, `${" ".repeat(indent + 2)}contents: read`)
      issues.push({ kind: "write-all", severity: "error", line: entry.line, fix: rebuild(source, next) })
    }
  }

  // Self-hosted runners reachable from fork pull requests.
  if (triggers.some((trigger) => FORK_TRIGGERS.includes(trigger)) && context.visibility !== "private") {
    for (const job of jobEntries) {
      const runsOn = get(job.value, "runs-on")
      if (!runsOn || !list(runsOn.value).some((label) => /self-hosted/i.test(label))) continue
      const next = lines()
      const indent = next[runsOn.line].length - next[runsOn.line].trimStart().length
      const end = runsOn.value?.kind === "seq" && runsOn.value.line !== runsOn.line ? Math.max(...runsOn.value.items.map((item) => (item.kind === "scalar" ? item.to : runsOn.line))) : runsOn.line
      next.splice(runsOn.line, end - runsOn.line + 1, `${" ".repeat(indent)}runs-on: ubuntu-latest`)
      issues.push({ kind: "self-hosted", severity: context.visibility === "public" ? "error" : "warning", line: runsOn.line, detail: job.key, fix: rebuild(source, next) })
    }
  }
  // An aliased step or job (*name) repeats its anchor's findings on the same line: keep one.
  const seen = new Set<string>()
  return issues.filter((issue) => { const key = `${issue.kind}|${issue.line}|${issue.detail ?? ""}`; return !seen.has(key) && !!seen.add(key) }).sort((a, b) => a.line - b.line)
}

/** Replaces `uses: owner/repo@ref` on a line with the SHA, keeping the tag as a comment (Dependabot reads it). */
export function pinAction(text: string, line: number, sha: string) {
  if (!/^[0-9a-f]{40}$/.test(sha)) return text
  const lines = toLines(text)
  lines[line] = (lines[line] ?? "").replace(/(uses:\s*["']?)([^@\s"']+)@([^\s"'#]+)(["']?)(\s*#.*)?$/, (_, pre: string, action: string, ref: string, quote: string) => `${pre}${action}@${sha}${quote} # ${ref}`)
  return rebuild(text, lines)
}

/** Who can start the workflow and what its token can do, for the readback line. */
export function workflowSummary(text: string) {
  const root = parseYaml(text)
  if (root?.kind !== "map") return null
  const triggers = list((get(root, "on") ?? get(root, "true"))?.value)
  const top = get(root, "permissions")?.value
  const perms = !top ? null : top.kind === "scalar" ? top.value : top.kind === "map" ? top.entries.map((e) => `${e.key}: ${str(e.value)}`).join(", ") || "none" : null
  const jobs = get(root, "jobs")?.value
  return { triggers, permissions: perms, jobs: jobs?.kind === "map" ? jobs.entries.length : 0, forks: triggers.some((trigger) => FORK_TRIGGERS.includes(trigger)) }
}
