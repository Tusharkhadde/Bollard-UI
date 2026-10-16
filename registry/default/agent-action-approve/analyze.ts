// Bollard UI — agent-action-approve · MIT licence · https://bollard-ui.vercel.app/components/agent-action-approve

/** How far a call reaches, narrowest first. */
export type Scope = "none" | "item" | "folder" | "project" | "outside" | "home" | "drive" | "remote" | "prod"
export const SCOPES: Scope[] = ["item", "folder", "project", "outside", "home", "drive", "remote", "prod"]
export type Undo = "none" | "easy" | "hard" | "never"
export type Risk = "low" | "medium" | "high"

/** One tool call as an agent proposes it. Pass `command` for shell tools, `sql` for databases, or `args` for anything else. */
export interface ToolCall {
  /** Tool name, e.g. "Bash", "run_terminal", "delete_file", "query". */
  tool?: string
  command?: string
  sql?: string
  args?: Record<string, unknown>
  /** What the agent said it was doing, e.g. "Clear the Vite cache". */
  intent?: string
  /** Working folder the command runs in; a bare `\` resolves to the root of its drive. */
  cwd?: string
  /** Known variables. A variable that is missing or empty here is treated as possibly empty. */
  env?: Record<string, string | undefined>
  /** Where a database call lands. */
  environment?: "dev" | "staging" | "prod"
  /** MCP tool annotations the server sent. Untrusted: shown only when they disagree with the call. */
  hints?: { readOnlyHint?: boolean; destructiveHint?: boolean }
}

export interface Finding {
  id: string
  level: "danger" | "warn"
  /** Short plain-words title. */
  title: string
  detail: string
}

export interface Token {
  text: string
  /** The token that makes the call do something other than it seems. */
  slip?: string
}

export interface Analysis {
  /** Plain-words readback of what will happen. */
  does: string
  target: string
  scope: Scope
  undo: Undo
  risk: Risk
  findings: Finding[]
  /** The command or call as tokens, with any slip marked. */
  tokens: Token[]
  /** The rule "always allow" would save, or null when one isn't offered. */
  rule: string | null
  /** Why "always allow" isn't offered. */
  ruleRefused?: "wrapper" | "chain" | "irreversible" | "empty"
  /** Other calls the rule would also let through. */
  ruleAlso: string[]
  /** The says-vs-does gap, when the intent and the call disagree. */
  mismatch: boolean
}

const SECRET_FILE = /(^|[\\/@])(\.env(\.[\w.-]+)?|id_rsa|id_ed25519|\.npmrc|\.pypirc|\.git-credentials|credentials|[\w.-]+\.(pem|key|p12|pfx)|\.netrc)$/i
const WRAPPERS = new Set(["npx", "bunx", "sudo", "eval", "env", "xargs", "exec"])
const STOP = new Set(["the", "a", "an", "and", "or", "to", "of", "for", "in", "on", "my", "this", "that", "it", "up", "out", "all", "clear", "clean", "remove", "delete", "wipe", "reset", "folder", "directory", "dir", "files", "file", "please", "old", "now", "just", "run", "cache"])

/** Splits a command into words, keeping quoted parts whole. Backslashes stay literal (Windows paths). */
export function tokenize(input: string): string[] {
  return tokenizeRaw(input).map((t) => t.text)
}

/** Like tokenize, but keeps each word as written too (quotes included), so the readback shows the exact command. */
export function tokenizeRaw(input: string): { text: string; raw: string }[] {
  const out: { text: string; raw: string }[] = []
  let cur = ""
  let raw = ""
  let quote: string | null = null
  let started = false
  const flush = () => {
    if (started || cur) out.push({ text: cur, raw })
    cur = ""
    raw = ""
    started = false
  }
  for (const ch of typeof input === "string" ? input : "") {
    if (quote) {
      raw += ch
      if (ch === quote) quote = null
      else cur += ch
    } else if (ch === '"' || ch === "'") {
      quote = ch
      raw += ch
      started = true
    } else if (/\s/.test(ch)) {
      flush()
    } else if (ch === ";" || ch === "|" || ch === "&") {
      flush()
      const last = out[out.length - 1]
      if ((ch === "|" || ch === "&") && last?.text === ch && last.raw === ch) out[out.length - 1] = { text: ch + ch, raw: ch + ch }
      else out.push({ text: ch, raw: ch })
    } else {
      cur += ch
      raw += ch
      started = true
    }
  }
  flush()
  return out
}

const OPS = new Set([";", "|", "||", "&&", "&"])
const driveOf = (cwd?: string) => cwd?.match(/^([a-z]):/i)?.[1]?.toUpperCase()

/** What a path argument really points at. */
function resolveTarget(raw: string, call: ToolCall): { scope: Scope; label: string; slip?: string } {
  const p = raw.trim()
  const unset = p.match(/^\$\{?(\w+)\}?|^%(\w+)%/)
  if (unset) {
    const name = unset[1] ?? unset[2]
    const known = call.env?.[name]
    if (/^(HOME|USERPROFILE)$/i.test(name)) return { scope: "home", label: "your home folder" }
    if (known) return resolveTarget(p.replace(unset[0], known), call)
    const rest = p.slice(unset[0].length)
    if (/^[\\/]\*?$/.test(rest) || rest === "/*")
      return { scope: "drive", label: `/ (if ${name} is empty)`, slip: `If ${name} is empty or unset, ${p} becomes ${rest}, the root of the disk.` }
    return { scope: "folder", label: p }
  }
  if (p === "\\" || p === "/" || p === "/*" || p === "\\*") {
    const d = driveOf(call.cwd)
    const label = p.startsWith("/") ? "/" : d ? `${d}:\\` : "the root of the current drive"
    return { scope: "drive", label, slip: `A lone ${p.replace("*", "")} means the root of the whole ${p.startsWith("/") ? "disk" : "drive"}${d && !p.startsWith("/") ? ` (${d}:\\)` : ""}, not this folder.` }
  }
  if (/^[a-z]:[\\/]?\*?$/i.test(p)) return { scope: "drive", label: `${p[0].toUpperCase()}:\\`, slip: `${p} is the whole ${p[0].toUpperCase()}: drive.` }
  if (/^~[\\/]?\*?$/.test(p) || /^[a-z]:[\\/]users[\\/][^\\/]+[\\/]?$/i.test(p) || /^\/(home|Users)\/[^/]+\/?$/.test(p)) {
    const short = /~\d/.test(p.replace(/^~[\\/]?/, "")) ? ` ${p} is a short (8.3) name for a user folder.` : ""
    return { scope: "home", label: "your home folder", slip: `${p} is your whole home folder.${short}` }
  }
  if (/^\.\.([\\/]|$)/.test(p) && !/^\.\.[\\/][^\\/.*]/.test(p)) return { scope: "outside", label: "the parent folder", slip: `${p} is the folder above this project, with everything in it.` }
  if (/^\.\.[\\/]/.test(p)) return { scope: "outside", label: p }
  if (p === "." || p === "*" || p === "./" || p === "./*") return { scope: "project", label: "everything in this folder" }
  // Absolute and home-relative paths reach outside the working folder, unless they sit inside it.
  if (/^(?:\/|~[\\/]|[a-z]:[\\/]|\\\\)/i.test(p)) {
    const norm = (s: string) => s.replace(/\\/g, "/").replace(/\/+$/, "").toLowerCase()
    const cwd = call.cwd ? norm(call.cwd) : ""
    if (cwd && (norm(p) === cwd || norm(p).startsWith(`${cwd}/`))) return { scope: /[\\/]$|\*$/.test(p) || !/\.\w{1,5}$/.test(p) ? "folder" : "item", label: p }
    if (/^\/tmp\//.test(p)) return { scope: "folder", label: p }
    return { scope: "outside", label: p }
  }
  return { scope: /[\\/]$|\*$/.test(p) || !/\.\w{1,5}$/.test(p) ? "folder" : "item", label: p }
}

const wider = (a: Scope, b: Scope) => (SCOPES.indexOf(a) >= SCOPES.indexOf(b) ? a : b)
/** Words an agent uses for a folder that don't appear in its name. */
const ALIASES: Record<string, string[]> = {
  dependencies: ["node_modules", "vendor", "venv", ".venv", "packages"],
  deps: ["node_modules", "vendor", "venv", ".venv"],
  packages: ["node_modules", "vendor"],
  reinstall: ["node_modules", "vendor", "venv", ".venv", "lock"],
  build: ["dist", "out", ".next", "target", "bin", "obj"],
  output: ["dist", "out", "build", "target"],
  artifacts: ["dist", "out", "build", "target"],
  logs: ["log"],
  temp: ["tmp", "temp"],
  vite: [".vite"],
  next: [".next"],
  python: ["__pycache__", ".venv", "venv"],
}
const keywords = (s: string) => (s.toLowerCase().match(/[a-z0-9_-]{3,}/g) ?? []).filter((w) => !STOP.has(w))

interface Seg {
  verb: string
  args: string[]
  op?: string
}

function segments(tokens: string[]): Seg[] {
  const segs: Seg[] = []
  let cur: string[] = []
  let op: string | undefined
  const push = () => {
    if (cur.length) segs.push({ verb: cur[0], args: cur.slice(1), op })
    cur = []
  }
  for (const t of tokens) {
    if (OPS.has(t)) {
      push()
      op = t
    } else cur.push(t)
  }
  push()
  return segs
}

/** "npm run test" → "npm run test *": script runners keep three words, other commands two. */
function ruleFor(words: string[]): string {
  const runner = /^(npm|pnpm|yarn|bun)$/.test(words[0]) && words[1] === "run"
  const keep = runner ? 3 : /^(git|docker|kubectl|cargo|go|npm|pnpm|yarn|bun|pip|make)$/.test(words[0]) ? 2 : 1
  return `${words.slice(0, keep).join(" ")} *`
}

/**
 * Reads an agent's tool call the way a careful reviewer would: what it deletes, sends or changes, how
 * far that reaches (item → folder → project → outside → home → drive → remote → prod), whether it can
 * be undone, the one token that makes it do something else (`\` alone, an unset `$VAR`, `../`), and
 * whether that matches what the agent said. Never throws; null or junk gives an empty, low-risk result.
 */
export function analyzeToolCall(input: ToolCall | null | undefined, opts: { allowedHosts?: string[] } = {}): Analysis {
  const call: ToolCall = input && typeof input === "object" ? input : {}
  const findings: Finding[] = []
  const add = (f: Finding) => findings.some((x) => x.id === f.id) || findings.push(f)
  let scope: Scope = "none"
  let undo = "none" as Undo
  const targets: string[] = []
  const actions: string[] = []
  const slips = new Map<string, string>()
  let destructive = false
  const raise = (u: Undo) => {
    const order: Undo[] = ["none", "easy", "hard", "never"]
    if (order.indexOf(u) > order.indexOf(undo)) undo = u
  }

  // AI SDK and MCP shell tools usually put the command in their input: { command: "…" }.
  const rawCommand = typeof call.command === "string" ? call.command : typeof call.args?.command === "string" ? (call.args.command as string) : ""
  const command = rawCommand.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n").trim()
  const sql = typeof call.sql === "string" ? call.sql.replace(/\r\n?/g, "\n").trim() : ""
  let tokens: Token[] = []
  let rule: string | null = null
  let ruleRefused: Analysis["ruleRefused"]
  let ruleAlso: string[] = []
  let mutating = false

  if (command) {
    const rawWords = tokenizeRaw(command.replace(/\n/g, " ; "))
    const words = rawWords.map((w) => w.text)
    // A queue, so a shell wrapper's inner command (bash -c "…", cmd /c "…", powershell -Command "…") is read too.
    const queue: Seg[] = segments(words)
    const chained = queue.length > 1
    let wrapped = false
    const PIPE_EXEC = /^(sh|bash|zsh|dash|ksh|fish|python3?|node|perl|ruby|iex|invoke-expression|pwsh|powershell|cmd)$/
    const FETCHERS = /^(curl|wget|iwr|irm|invoke-webrequest|invoke-restmethod|fetch)$/
    for (let qi = 0; qi < queue.length && qi < 60; qi++) {
      const seg = queue[qi]
      let { verb, args } = seg
      const lower = verb.toLowerCase().replace(/\.exe$/, "")
      // Code passed to an interpreter inline: python -c, node -e, perl -e, ruby -e, deno eval.
      const inlineCode = /^(python3?|node|perl|ruby|deno|php)$/.test(lower) && /^(-c|-e|--eval|-r|eval)$/.test(args[0] ?? "")
      const shellInner =
        ((lower === "bash" || lower === "sh" || lower === "zsh" || lower === "dash") && args[0] === "-c") || (lower === "cmd" && /^\/[ck]$/i.test(args[0] ?? "")) || (/^(powershell|pwsh)$/.test(lower) && /^-(c|command)$/i.test(args[0] ?? ""))
      const encoded = /^(powershell|pwsh)$/.test(lower) && /^-(e|ec|enc|encodedcommand)$/i.test(args[0] ?? "")
      if (WRAPPERS.has(lower) || shellInner || encoded || inlineCode || (/^(pnpm|yarn)$/.test(lower) && args[0] === "dlx")) {
        wrapped = true
        if (lower === "sudo") add({ id: "sudo", level: "warn", title: "Runs as administrator", detail: "sudo lifts every permission check for this command." })
        if (lower === "npx" || lower === "bunx" || args[0] === "dlx") {
          actions.push(`downloads and runs ${args.find((a, i) => i > (args[0] === "dlx" ? 0 : -1) && !a.startsWith("-")) ?? "a package"} from the registry`)
          raise("hard")
          scope = wider(scope, "remote")
        }
        if (inlineCode) {
          actions.push(`runs ${verb} code passed inline`)
          raise("hard")
          const code = args.slice(1).join(" ")
          if (/\b(rmtree|rmSync|rmdirSync|unlinkSync|os\.remove|os\.unlink|fs\.rm|File\.delete|rm_rf|unlink|drop\s+table)\b/i.test(code)) {
            destructive = true
            raise("never")
            scope = wider(scope, /\(\s*['"](?:\/|~|[a-z]:[\\/]?)['"]\s*\)/i.test(code) ? "drive" : "project")
            add({ id: "inline", level: "danger", title: "Inline code deletes files", detail: `The ${verb} code passed to ${args[0]} deletes things, and nothing here can tell how far it reaches.` })
          } else add({ id: "inline", level: "warn", title: "Runs code it wrote itself", detail: `${verb} ${args[0]} runs whatever code follows. Read it: nothing here can tell what it does.` })
        }
        if (shellInner || encoded) {
          let inner = args.slice(1).join(" ")
          if (encoded) {
            try {
              const bin = atob(args[1] ?? "")
              let s = ""
              for (let i = 0; i + 1 < bin.length; i += 2) s += String.fromCharCode(bin.charCodeAt(i) | (bin.charCodeAt(i + 1) << 8))
              inner = s
              add({ id: "encoded", level: "danger", title: "Hidden command", detail: `The real command is base64-encoded so you can't read it. Decoded, it is: ${s.slice(0, 160)}` })
            } catch {
              inner = ""
              add({ id: "encoded", level: "danger", title: "Hidden command", detail: "The real command is encoded so you can't read it." })
            }
          }
          const innerSegs = segments(tokenize(inner.replace(/\n/g, " ; ")))
          if (innerSegs.length) innerSegs[0] = { ...innerSegs[0], op: seg.op }
          queue.splice(qi + 1, 0, ...innerSegs)
          continue
        }
        if (lower === "sudo" || lower === "env" || lower === "exec" || lower === "xargs") {
          verb = args[0] ?? ""
          args = args.slice(1)
        } else continue
      }
      const v = verb.toLowerCase().replace(/\.exe$/, "")
      // Redirects: `> file` overwrites it.
      const redirect = args.findIndex((a) => a === ">" || a === ">|")
      if (redirect >= 0 && args[redirect + 1] && !/^(\/dev\/null|nul)$/i.test(args[redirect + 1])) {
        const t = resolveTarget(args[redirect + 1], call)
        scope = wider(scope, t.scope)
        targets.push(t.label)
        if (t.slip) slips.set(args[redirect + 1], t.slip)
        destructive = true
        raise("never")
        actions.push(`overwrites ${t.label}`)
        args = args.slice(0, redirect)
      }
      const flags = args.filter((a) => /^(-|\/[a-z]$)/i.test(a)).map((a) => a.toLowerCase())
      const paths = args.filter((a) => !/^(-|\/[a-z]$)/i.test(a) && a !== ">>")
      const recursive = flags.some((f) => /^-[a-z]{1,4}$/i.test(f) && /r/i.test(f)) || flags.some((f) => /^(--recursive|-recurse)$/.test(f) || f === "/s")
      const force = flags.some((f) => (/^-[a-z]{1,4}$/.test(f) && f.includes("f")) || f === "--force" || f === "-force" || f === "/q")
      const isDelete = v === "rm" || v === "rmdir" || v === "rd" || v === "del" || v === "erase" || v === "unlink" || v === "shred" || /^(remove-item|ri)$/i.test(v) || (v === "find" && args.includes("-delete"))
      const pipeFrom = (): Seg[] => {
        // Every earlier segment of this pipeline, nearest first.
        const out: Seg[] = []
        for (let j = qi; j > 0 && queue[j].op === "|"; j--) out.push(queue[j - 1])
        return out
      }
      if (isDelete) {
        destructive = true
        raise("never")
        const mine: string[] = []
        const list = v === "find" ? paths.slice(0, 1) : paths
        for (const p of list.length ? list : ["."]) {
          const t = resolveTarget(p, call)
          scope = wider(scope, t.scope)
          targets.push(t.label)
          mine.push(t.label)
          if (t.slip) slips.set(p, t.slip)
        }
        actions.push(`permanently deletes ${recursive || v === "find" ? "everything in " : ""}${mine.join(" and ")}${force ? ", without asking" : ""}`)
      } else if (v === "git" && args[0] === "reset" && args.includes("--hard")) {
        destructive = true
        raise("never")
        scope = wider(scope, "project")
        actions.push("throws away every uncommitted change in this repository")
      } else if (v === "git" && ((args[0] === "checkout" && (args.includes(".") || args.includes("--") || flags.includes("-f"))) || (args[0] === "restore" && !flags.includes("--staged")))) {
        destructive = true
        raise("never")
        scope = wider(scope, "project")
        const which = paths.filter((p) => p !== "checkout" && p !== "restore" && p !== "--" && p !== ".")
        actions.push(`throws away uncommitted changes to ${which.join(", ") || "every file"}`)
      } else if (v === "git" && args[0] === "clean" && flags.some((f) => /f/.test(f))) {
        destructive = true
        raise("never")
        scope = wider(scope, "project")
        actions.push(`deletes every untracked file${flags.some((f) => /x/.test(f)) ? ", including ignored ones like .env" : ""}`)
      } else if (v === "git" && args[0] === "push" && (flags.some((f) => /^(-f|--force)$/.test(f) || f.startsWith("--force")) || paths.some((p) => /^\+/.test(p)) || flags.includes("--delete") || flags.includes("--mirror"))) {
        destructive = true
        raise("hard")
        scope = wider(scope, "remote")
        const branch = (paths[paths.length - 1] ?? "the branch").replace(/^\+/, "")
        actions.push(flags.includes("--delete") ? `deletes ${branch} on the remote for everyone` : `overwrites ${branch} on the remote for everyone`)
        if (paths.some((p) => /^\+/.test(p))) slips.set(paths.find((p) => /^\+/.test(p))!, "A leading + in a refspec forces the push, the same as --force.")
      } else if (v === "git" && ((args[0] === "branch" && flags.includes("-d") && args.includes("-D")) || (args[0] === "stash" && /^(clear|drop)$/.test(args[1] ?? "")))) {
        destructive = true
        raise("hard")
        scope = wider(scope, "project")
        actions.push(args[0] === "stash" ? `${args[1] === "clear" ? "deletes every stash" : "deletes a stash"}` : `deletes branch ${paths[paths.length - 1] ?? ""} even if it isn't merged`)
      } else if (FETCHERS.test(v) || v === "http" || v === "nc" || v === "scp" || v === "rsync" || v === "sftp") {
        const remoteDest = v === "scp" || v === "rsync" ? paths.find((a) => /^(?:[^\s@/\\]+@)?[\w.-]{2,}:/.test(a)) : undefined
        const fileArg =
          args.find((a, i) => /^@/.test(a) && /^(-d|--data|--data-binary|--data-raw|--data-urlencode|-F|--form|-T|--upload-file|-InFile|-infile)$/i.test(args[i - 1] ?? "")) ??
          args.find((a, i) => /^(-T|--upload-file|-InFile)$/i.test(args[i - 1] ?? "") && !!a) ??
          args.find((a) => /=@|^@/.test(a)) ??
          (remoteDest ? paths.find((p) => p !== remoteDest) : undefined)
        const piped = seg.op === "|"
        const url = remoteDest ?? args.find((a) => /^https?:\/\//i.test(a) || /^[\w-]+(\.[\w-]+)+(\/|$)/.test(a))
        const host = (remoteDest ? remoteDest.replace(/^[^@]*@/, "").split(":")[0] : url?.replace(/^https?:\/\//i, "").split(/[/:?#]/)[0]) || "a remote server"
        const known = (opts.allowedHosts ?? []).some((h) => host === h || host.endsWith(`.${h}`))
        if (fileArg || piped || remoteDest || args.includes("--post-file")) {
          const file = fileArg?.replace(/^.*@/, "") ?? (piped ? "-" : "a file")
          const fromPipe = file === "-" || (piped && !fileArg)
          const source = fromPipe ? pipeFrom().flatMap((s) => s.args).find((a) => SECRET_FILE.test(a)) : undefined
          const secret = (!fromPipe && SECRET_FILE.test(file)) || !!source
          actions.push(`uploads ${source ?? (fromPipe ? "the output of the previous command" : file)} to ${host}`)
          scope = wider(scope, "remote")
          raise("never")
          destructive = true
          targets.push(host)
          if (secret) add({ id: "exfil", level: "danger", title: "Sends your secrets off this machine", detail: `${source ?? file} usually holds passwords and API keys. Once it reaches ${host}, it can't be taken back.` })
          if (!known) add({ id: "host", level: secret ? "danger" : "warn", title: "Unknown destination", detail: `${host} isn't on your list of trusted hosts.` })
        } else actions.push(`fetches ${url ?? "a URL"}`)
      } else if (PIPE_EXEC.test(v) && seg.op === "|") {
        // curl … | bash: whatever the server sends runs as code.
        const fetcher = pipeFrom().find((s) => FETCHERS.test(s.verb.toLowerCase().replace(/\.exe$/, "")))
        const src = fetcher?.args.find((a) => /^https?:\/\//i.test(a) || /^[\w-]+(\.[\w-]+)+\//.test(a))
        const srcHost = src?.replace(/^https?:\/\//i, "").split(/[/:?#]/)[0]
        destructive = true
        raise("never")
        scope = wider(scope, fetcher ? "remote" : "project")
        const lang = /^(iex|invoke-expression|pwsh|powershell)$/.test(v) ? "PowerShell" : /^python/.test(v) ? "Python" : v === "cmd" ? "cmd" : verb
        actions.push(fetcher ? `runs whatever ${srcHost ?? "the server"} sends back, as a ${lang} script` : `runs the previous command's output as a ${lang} script`)
        const knownSrc = !!srcHost && (opts.allowedHosts ?? []).some((h) => srcHost === h || srcHost.endsWith(`.${h}`))
        add({ id: "pipe-exec", level: fetcher && !knownSrc ? "danger" : "warn", title: fetcher ? "Runs code straight from the internet" : "Runs text as code", detail: fetcher ? `Nobody, including the agent, has read what ${srcHost ?? "that server"} will send. It runs with your permissions the moment it arrives.` : `Whatever the previous command prints is run by ${verb}.` })
        if (srcHost && slips.size === 0) slips.set(src!, `This script runs without anyone reading it first.`)
      } else if (/^(mkfs|format|dd|diskpart)$/.test(v.replace(/\..*$/, "")) || /^mkfs\./.test(v)) {
        destructive = true
        raise("never")
        scope = wider(scope, "drive")
        actions.push("erases a whole disk")
      } else if (/^(chmod|chown|icacls|takeown)$/.test(v) && paths.length > 1) {
        const mode = paths[0]
        const mine: string[] = []
        for (const p of paths.slice(1)) {
          const t = resolveTarget(p, call)
          scope = wider(scope, t.scope)
          targets.push(t.label)
          mine.push(t.label)
          if (t.slip) slips.set(p, t.slip)
        }
        destructive = true
        raise("hard")
        actions.push(`changes ${v === "chmod" ? "permissions" : "the owner"} of ${recursive ? "everything in " : ""}${mine.join(" and ")}`)
        if (/^0?777$|^a\+w|o\+w/.test(mode)) add({ id: "world-writable", level: "warn", title: "Anyone can change these files", detail: `${mode} lets every user and program on this machine write to them.` })
      } else if (/^(mv|move|move-item|ren|rename)$/i.test(v) && paths.length >= 2) {
        const dest = paths[paths.length - 1]
        const srcs = paths.slice(0, -1)
        for (const p of [...srcs, dest]) {
          const t = resolveTarget(p, call)
          scope = wider(scope, t.scope)
          if (t.slip) slips.set(p, t.slip)
        }
        if (/^(\/dev\/null|nul)$/i.test(dest)) {
          destructive = true
          raise("never")
          targets.push(...srcs)
          actions.push(`destroys ${srcs.join(" and ")} by moving it to ${dest}`)
        } else {
          raise("easy")
          actions.push(`moves ${srcs.join(" and ")} to ${dest}`)
        }
      } else if (/^(cat|type|get-content|gc|less|head|tail)$/.test(v) && paths.length) {
        actions.push(`reads ${paths.join(", ")}`)
      } else if (v) {
        actions.push(`runs ${[verb, ...args].join(" ")}`)
      }
    }
    // Mark the slip token; inside a wrapper's quoted command, mark the whole quoted part.
    const slipFor = (w: string) => slips.get(w) ?? [...slips.entries()].find(([k]) => w.split(/\s+/).includes(k))?.[1]
    tokens = rawWords.map((w) => ({ text: w.raw, slip: slipFor(w.text) }))
    if (wrapped) ruleRefused = "wrapper"
    else if (chained) ruleRefused = "chain"
    else if (undo === "never") ruleRefused = "irreversible"
    else if (!words.length) ruleRefused = "empty"
    else {
      rule = `${call.tool || "Bash"}(${ruleFor(words)})`
      const base = ruleFor(words).slice(0, -2)
      ruleAlso = [`${base} --any-flags`, `${base} ${words.length > base.split(" ").length ? "<other arguments>" : "<any arguments>"}`]
      if (/^(npm|pnpm|yarn|bun) run /.test(base)) ruleAlso.push(`whatever the "${words[2]}" script in package.json is changed to, including by the agent`)
      else if (/^(make|just|python|node|bash|sh)\b/.test(base)) ruleAlso.push("whatever that script is edited to do, including by the agent")
      else if (/^git push$/.test(base)) ruleAlso.push("git push --force, which overwrites the remote branch for everyone")
    }
  } else if (sql) {
    const clean = sql.replace(/--[^\n]*|\/\*[\s\S]*?\*\//g, " ").replace(/'(?:[^']|'')*'/g, "''")
    const prod = call.environment === "prod"
    for (const stmt of clean.split(";").map((s) => s.trim()).filter(Boolean)) {
      // SQL Server and MySQL accept DELETE without FROM.
      const m = stmt.replace(/^delete\s+(?!from\b)/i, "delete from ").match(/^(delete\s+from|update|drop\s+table|truncate(?:\s+table)?|drop\s+(?:database|schema)|alter\s+table)\s+(?:if\s+exists\s+)?([\w."`\[\]]+)/i)
      if (!m) {
        actions.push(/^\s*select\b/i.test(stmt) ? "reads data" : `runs ${stmt.split(/\s+/)[0]?.toUpperCase() ?? "SQL"}`)
        continue
      }
      const kind = m[1].toLowerCase().replace(/\s+/g, " ")
      const table = m[2].replace(/["`\[\]]/g, "")
      targets.push(`the ${table} table`)
      destructive = true
      // Only the statement's own WHERE counts, not one inside a subquery; and WHERE 1=1 is no filter at all.
      let top = stmt
      while (/\([^()]*\)/.test(top)) top = top.replace(/\([^()]*\)/g, "")
      const tautology = /\bwhere\s+(?:1\s*=\s*1|0\s*=\s*0|true|1|''\s*=\s*'')\s*(?:$|\bor\b|;)|\bor\s+(?:1\s*=\s*1|true|''\s*=\s*'')\b/i.test(top)
      const noWhere = (kind === "delete from" || kind === "update") && (!/\bwhere\b/i.test(top) || tautology)
      if (kind.startsWith("drop") || kind.startsWith("truncate") || noWhere) {
        raise("never")
        actions.push(`${kind.startsWith("update") ? "changes" : "deletes"} every row in ${table}${kind.startsWith("drop") ? ", and the table itself" : ""}`)
        if (noWhere) add({ id: "where", level: "danger", title: tautology ? "WHERE that matches everything" : "No WHERE clause", detail: `This ${kind.split(" ")[0].toUpperCase()} hits every row in ${table}, not just some.` })
      } else {
        raise("hard")
        actions.push(`${kind.startsWith("update") ? "changes" : kind.startsWith("alter") ? "alters" : "deletes"} matching rows in ${table}`)
      }
    }
    scope = prod ? "prod" : call.environment === "staging" ? "remote" : targets.length ? "project" : "none"
    if (prod && destructive) add({ id: "prod", level: "danger", title: "On production", detail: "Real customers' data. Only a backup restore can bring it back." })
    tokens = [{ text: sql }]
    ruleRefused = undo === "never" ? "irreversible" : undefined
    rule = ruleRefused ? null : `${call.tool || "query"}(${sql.split(/\s+/).slice(0, 2).join(" ")} *)`
    ruleAlso = rule ? ["the same statement on any table, with any condition"] : []
  } else if (call.tool) {
    const args = call.args && typeof call.args === "object" ? call.args : {}
    const name = String(call.tool)
    // Word parts only, so "terraform" or "confirm" never read as rm: delete_file, deleteFile, rm, purge-cache.
    const parts = name.replace(/([a-z0-9])([A-Z])/g, "$1_$2").toLowerCase().split(/[^a-z0-9]+/)
    const del = parts.some((w) => /^(delete|remove|drop|wipe|purge|destroy|rm|rmdir|unlink|erase|truncate|trash)$/.test(w))
    const pathArg = Object.entries(args).find(([k, v]) => typeof v === "string" && /path|file|dir|folder|target/i.test(k))
    if (pathArg) {
      const t = resolveTarget(String(pathArg[1]), call)
      scope = t.scope
      targets.push(t.label)
      if (t.slip) slips.set(String(pathArg[1]), t.slip)
    }
    mutating = !del && parts.some((w) => /^(write|update|create|send|post|put|set|insert|move|rename|upload|edit|patch|append|commit|push|deploy|publish|exec|execute|run|replace|merge|transfer|pay|charge)$/.test(w))
    if (del) {
      destructive = true
      raise("never")
      actions.push(`deletes ${targets[0] ?? "something"}`)
    } else if (mutating) {
      raise("hard")
      actions.push(`calls ${name}, which changes ${targets[0] ?? "things"}`)
    } else actions.push(`calls ${name}`)
    tokens = [{ text: `${name}(` }, ...Object.entries(args).map(([k, v], i) => ({ text: `${i ? ", " : ""}${k}: ${JSON.stringify(v) ?? "undefined"}`, slip: typeof v === "string" ? slips.get(v) : undefined })), { text: ")" }]
    if (del) ruleRefused = "irreversible"
    else {
      rule = `${name}(*)`
      ruleAlso = [`every ${name} call, with any arguments`]
    }
  } else ruleRefused = "empty"

  if (call.hints?.readOnlyHint && (destructive || mutating))
    add({ id: "hint", level: "danger", title: "Says read-only, isn't", detail: "The tool labels itself read-only, but this call changes things. MCP treats these labels as untrusted for exactly this reason." })
  for (const [token, detail] of slips) add({ id: `slip-${token}`, level: "danger", title: `${token} doesn't mean what it looks like`, detail })

  let mismatch = false
  const intent = typeof call.intent === "string" ? call.intent.trim() : ""
  if (intent && destructive && targets.length) {
    const want = keywords(intent).flatMap((w) => [w, ...(ALIASES[w] ?? [])])
    const hay = targets.join(" ").toLowerCase()
    const overlap = want.some((w) => hay.includes(w) || hay.includes(`.${w}`))
    const far = SCOPES.indexOf(scope) >= SCOPES.indexOf("outside") && scope !== "remote"
    mismatch = far ? true : want.length > 0 && !overlap
    // Far reach is a clear mismatch; a word miss inside the project is only a hint.
    if (mismatch) add({ id: "mismatch", level: far ? "danger" : "warn", title: "Says one thing, does another", detail: `The agent said "${intent}", but this reaches ${targets.join(" and ")}.` })
  }

  if (scope === "prod" || undo === "never") undo = destructive ? "never" : undo
  const danger = findings.some((f) => f.level === "danger")
  const risk: Risk = danger || (undo === "never" && SCOPES.indexOf(scope) >= SCOPES.indexOf("project")) ? "high" : destructive || mutating || scope === "remote" || findings.length ? "medium" : "low"
  if (risk === "high" && !ruleRefused) {
    rule = null
    ruleRefused = "irreversible"
    ruleAlso = []
  }
  const does = actions.length ? actions.join(", then ").replace(/^./, (c) => c.toUpperCase()) + "." : "Nothing to run."
  return { does, target: targets.join(", ") || "—", scope, undo, risk, findings, tokens, rule, ruleRefused, ruleAlso, mismatch }
}
