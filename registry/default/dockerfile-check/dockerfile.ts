// Bollard UI — dockerfile-check · MIT licence · https://bollard-ui.vercel.app/components/dockerfile-check

/**
 * Dockerfile reader and rules, checked against docs.docker.com (Dockerfile reference, building best practices,
 * build checks and build secrets). Pure functions: safe on the server and with any input.
 */

export interface Instruction {
  /** Upper-cased keyword: FROM, RUN, COPY… */
  keyword: string
  /** Arguments with line continuations joined (flags included). */
  args: string
  /** First and last 0-based source line (heredoc bodies included). */
  start: number
  end: number
  stage: number
}

export interface Stage {
  index: number
  name?: string
  /** The base image as written, with global ARG defaults (ARG before the first FROM) filled in where known. */
  image: string
  line: number
  /** Index of the stage this one is built FROM, when it's a stage of this file. */
  parent?: number
}

export type DockerIssueKind =
  | "root-user" | "unpinned-base" | "secret-arg" | "secret-env" | "secret-file" | "stage-leak" | "copy-before-install"
  | "dockerignore" | "apt" | "apt-update-alone" | "add-url" | "curl-pipe" | "shell-form" | "entrypoint-shell"

export interface DockerIssue {
  kind: DockerIssueKind
  severity: "error" | "warning" | "info"
  /** 0-based line of the instruction. */
  line: number
  /** Filled into the message: a key, an image, missing pieces, a build command. */
  detail?: string
  /** The whole Dockerfile with the fix applied. */
  fix?: string
}

export interface DockerContext {
  /** The .dockerignore text, `null` when there is none, `undefined` when unknown. */
  dockerignore?: string | null
}

const toLines = (text: string) => text.replace(/^\uFEFF/, "").split(/\r\n|\r|\n/)
const rebuild = (original: string, lines: string[]) => (original.startsWith("\uFEFF") ? "\uFEFF" : "") + lines.join(/\r\n/.test(original) ? "\r\n" : "\n")

/** Fills `$VAR`, `${VAR}`, `${VAR:-default}` and `${VAR:+alt}` from global ARG defaults; unknown variables stay as written. */
export function expandArgs(text: string, args: Record<string, string>) {
  return text.replace(/\$\{(\w+)(?::([-+])([^}]*))?\}|\$(\w+)/g, (match, braced: string | undefined, op: string | undefined, word: string | undefined, bare: string | undefined) => {
    const name = braced ?? bare ?? ""
    const set = Object.prototype.hasOwnProperty.call(args, name) && args[name] !== ""
    if (op === "-") return set ? args[name] : word ?? ""
    if (op === "+") return set ? word ?? "" : ""
    return set ? args[name] : match
  })
}

/** Splits a Dockerfile into instructions the way BuildKit does: escape directive, continuations, comments, heredocs. */
export function parseDockerfile(text: string): { instructions: Instruction[]; stages: Stage[] } {
  const lines = toLines(typeof text === "string" ? text : "")
  let escape = "\\"
  let i = 0
  for (; i < lines.length; i++) {
    const directive = /^#\s*([a-z]+)\s*=\s*(\S+)\s*$/i.exec(lines[i])
    if (!directive) break
    if (directive[1].toLowerCase() === "escape" && (directive[2] === "`" || directive[2] === "\\")) escape = directive[2]
  }
  const instructions: Instruction[] = []
  const stages: Stage[] = []
  const globals: Record<string, string> = {}
  for (; i < lines.length && instructions.length < 5000; i++) {
    const first = lines[i].trim()
    if (!first || first.startsWith("#")) continue
    const start = i
    let args = lines[i].trimStart()
    while (args.endsWith(escape) && i + 1 < lines.length) {
      args = args.slice(0, -1)
      i++
      while (i < lines.length && /^\s*#/.test(lines[i])) i++
      args += " " + (lines[i] ?? "").trim()
    }
    const heredoc = /<<(-?)["']?([A-Za-z_]\w*)["']?/.exec(args)
    if (heredoc && /^(RUN|COPY|ADD)\b/i.test(args)) {
      const body: string[] = []
      while (i + 1 < lines.length && (heredoc[1] ? lines[i + 1].trim() : lines[i + 1]) !== heredoc[2]) body.push(lines[++i])
      if (i + 1 < lines.length) i++
      args += "\n" + body.join("\n")
    }
    const match = /^(\S+)\s*([\s\S]*)$/.exec(args)
    if (!match) continue
    const keyword = match[1].toUpperCase()
    if (keyword === "ARG" && !stages.length) {
      for (const m of match[2].matchAll(/([A-Za-z_]\w*)=("[^"]*"|'[^']*'|\S*)/g)) globals[m[1]] = m[2].replace(/^(["'])(.*)\1$/, "$2")
    }
    if (keyword === "FROM") {
      const parts = expandArgs(match[2].replace(/--\S+/g, "").trim(), globals).split(/\s+/)
      const name = /^as$/i.test(parts[1] ?? "") ? parts[2] : undefined
      const parent = stages.findIndex((stage) => stage.name && stage.name.toLowerCase() === (parts[0] ?? "").toLowerCase())
      stages.push({ index: stages.length, name, image: parts[0] ?? "", line: start, parent: parent >= 0 ? parent : undefined })
    }
    instructions.push({ keyword, args: match[2], start, end: i, stage: Math.max(0, stages.length - 1) })
  }
  return { instructions, stages }
}

/** BuildKit's SecretsUsedInArgOrEnv rule: a secret word as the whole key or its first/last word, unless "public", "file" or "version". */
export const isSecretKey = (key: string) => /(?:_|^)(?:apikey|auth|credential|credentials|key|password|pword|passwd|secret|token)(?:_|$)/i.test(key) && !/(?:_|^)(?:public|file|version)(?:_|$)/i.test(key)
/** Bases whose default user isn't root: distroless :nonroot tags and Chainguard images. */
const NONROOT_BASE = /(:|-)nonroot(\b|$)|^cgr\.dev\/chainguard\//i
/** Windows container bases: they have no root user, but run as ContainerAdministrator unless told otherwise. */
/** Official images whose entrypoint or server drops root itself (gosu, or root master with unprivileged workers): USER would break them. */
const SELF_DROPPING_BASE = /^(docker\.io\/)?(library\/)?(nginx|httpd|postgres|mysql|mariadb|redis|mongo|rabbitmq|memcached)(:|@|$)/i
export const WINDOWS_BASE = /^mcr\.microsoft\.com\/(windows|dotnet\/framework|powershell:.*(nanoserver|windowsservercore))|servercore|nanoserver/i
const SECRET_FILE = /(^|\/)(\.npmrc|\.netrc|\.pypirc|\.git-credentials|\.env(\.(?!(example|sample|template|dist|defaults)$)[\w.-]+)?|id_(rsa|ed25519|ecdsa)|credentials(\.json)?|auth\.json|[\w.-]+\.(pem|key|p12))$/i
const INSTALL: [RegExp, string][] = [
  // Global tool installs (npm i -g pnpm) don't read the manifest; bare `yarn` is an install, `yarn lint` is not.
  [/\bnpm (ci|install|i)\b(?![^&;|\n]*\s(-g|--global)\b)/, "package*.json ./"],
  [/(?:^|[;&|]|\b(?:then|do|else)\b)\s*yarn(\s+install\b|(?=\s*($|&&|;|\|\||\s--)))/, "package.json yarn.lock ./"],
  [/\bpnpm (i|install)\b/, "package.json pnpm-lock.yaml ./"],
  [/\bpip3? install\b[^&|;]*-r\s+(\S+)/, "$1 ./"],
  [/\bpoetry install\b/, "pyproject.toml poetry.lock ./"],
  [/\bgo mod download\b/, "go.mod go.sum ./"],
  [/\bbundle install\b/, "Gemfile Gemfile.lock ./"],
  [/\bcomposer install\b/, "composer.json composer.lock ./"],
]

/** Splits leading `--flag=value` options from the rest of an instruction's arguments. */
function splitFlags(args: string) {
  const flags: Record<string, string> = {}
  let rest = args.trimStart()
  for (let m = /^--([\w-]+)(?:=(\S*))?\s*/.exec(rest); m; m = /^--([\w-]+)(?:=(\S*))?\s*/.exec(rest)) {
    flags[m[1].toLowerCase()] = m[2] ?? "true"
    rest = rest.slice(m[0].length)
  }
  return { flags, rest }
}
const words = (rest: string) => (rest.trim().startsWith("[") ? safeJson(rest) : rest.trim().split(/\s+/)).filter(Boolean)
function safeJson(text: string): string[] {
  try {
    const value = JSON.parse(text)
    return Array.isArray(value) ? value.map(String) : []
  } catch {
    return []
  }
}
const globMatch = (glob: string, name: string) => glob === name || (glob.includes("*") && new RegExp(`^${glob.replace(/[.+^$()|[\]\\]/g, "\\$&").replace(/\*/g, ".*").replace(/\?/g, ".")}$`).test(name))
const joinPath = (dir: string, path: string) => (path.startsWith("/") ? path : `${dir.replace(/\/$/, "")}/${path.replace(/^\.\/?/, "")}`).replace(/\/{2,}/g, "/")
const basename = (path: string) => path.replace(/\/$/, "").split("/").pop() ?? path
const secretId = (name: string) => name.toLowerCase().replace(/^\./, "").replace(/[^a-z0-9_-]+/g, "_")

/** Adds a `--mount=...` flag right after `RUN` on an instruction's first line. */
function withMount(lines: string[], ins: Instruction, mount: string) {
  lines[ins.start] = lines[ins.start].replace(/^(\s*RUN)(\s+)/i, `$1 ${mount}$2`)
}

/** Reviews a Dockerfile. Issues are sorted by line. */
export function checkDockerfile(text: string, context: DockerContext = {}): DockerIssue[] {
  const source = typeof text === "string" ? text : ""
  const { instructions, stages } = parseDockerfile(source)
  const issues: DockerIssue[] = []
  if (!stages.length) return issues
  const finalStage = stages.length - 1
  const inStage = (stage: number) => instructions.filter((ins) => ins.stage === stage && ins.keyword !== "FROM")
  const lines = () => toLines(source)
  const workdirAt = (ins: Instruction) => instructions.filter((other) => other.stage === ins.stage && other.keyword === "WORKDIR" && other.start < ins.start).reduce((dir, other) => joinPath(dir, other.args.trim()), "/")

  // Base images: only the tag basics here; image-tag-input reads references in depth.
  for (const stage of stages) {
    const image = stage.image
    if (!image || stage.parent !== undefined || /^scratch$/i.test(image) || image.includes("$")) continue
    const last = image.split("/").pop() ?? ""
    if (!image.includes("@") && (!last.includes(":") || /:latest$/i.test(last))) issues.push({ kind: "unpinned-base", severity: "warning", line: stage.line, detail: image })
  }

  // Root at run time: the final stage (or the stage chain it's built on) never switches USER.
  const chain = stageChain(stages)
  const users = instructions.filter((ins) => ins.keyword === "USER" && chain.includes(ins.stage))
  const lastUser = users.sort((a, b) => b.start - a.start)[0]
  const base = stages[chain[chain.length - 1]].image
  const runs = instructions.some((ins) => chain.includes(ins.stage) && (ins.keyword === "CMD" || ins.keyword === "ENTRYPOINT"))
  // Skipped: an export stage (FROM scratch, nothing to run), a base we can't resolve, and bases that already run as non-root.
  // Nano Server images (Microsoft's and .NET's) default to ContainerUser.
  const unknown = base.includes("$") || (/^scratch$/i.test(base) && !runs) || NONROOT_BASE.test(base) || /nanoserver/i.test(base)
  if (!unknown && !lastUser && SELF_DROPPING_BASE.test(base)) {
    issues.push({ kind: "root-user", severity: "info", line: stages[finalStage].line, detail: `drops|${base}` })
  } else if (!unknown && (!lastUser || /^(root|0|ContainerAdministrator)(:|$)/i.test(lastUser.args.trim()))) {
    const windows = WINDOWS_BASE.test(base)
    // Reuse a non-root user the file already switched to (USER app … USER root for a setup step).
    const earlier = users.find((ins) => !/^(root|0|ContainerAdministrator)(:|$)/i.test(ins.args.trim()))?.args.trim()
    const user = earlier ?? (windows ? "ContainerUser" : /(^|\/)node(:|$)/.test(base) ? "node" : "10001:10001")
    const before = inStage(finalStage).find((ins) => ins.keyword === "CMD" || ins.keyword === "ENTRYPOINT")
    const next = lines()
    if (before) next.splice(before.start, 0, `USER ${user}`)
    else next.push(`USER ${user}`)
    issues.push({ kind: "root-user", severity: windows ? "info" : "warning", line: lastUser?.start ?? stages[finalStage].line, detail: user, fix: rebuild(source, next) })
  }

  // Secrets in ARG/ENV: Docker's own key rule, plus literal values that look like live credentials.
  const reported = new Set<string>()
  for (const ins of instructions) {
    if (ins.keyword !== "ARG" && ins.keyword !== "ENV") continue
    const pairs = [...ins.args.matchAll(/([A-Za-z_][\w]*)(?:=("[^"]*"|'[^']*'|\S*))?/g)].map((m) => ({ key: m[1], value: m[2] }))
    const legacy = ins.keyword === "ENV" && !ins.args.includes("=")
    const secret = (legacy ? pairs.slice(0, 1) : pairs).find((pair) => isSecretKey(pair.key) || /\b(ghp_|github_pat_|sk_live_|AKIA[0-9A-Z]{16}|xox[bp]-|glpat-)/.test(pair.value ?? ""))
    if (!secret || reported.has(`${ins.keyword}:${secret.key}`)) continue
    reported.add(`${ins.keyword}:${secret.key}`)
    const id = secretId(secret.key)
    const uses = new RegExp(`\\$\\{?${secret.key}\\b`)
    // One fix for the key everywhere: drop every declaration of it (global ARG, per-stage ARG, ENV) and mount it into each RUN that reads it.
    const decls = instructions.filter((other) => other.keyword === ins.keyword && [...other.args.matchAll(/([A-Za-z_]\w*)/g)].some((m) => m[1] === secret.key))
    const runsUsing = instructions.filter((other) => other.keyword === "RUN" && other.start > ins.start && uses.test(other.args))
    let fix: string | undefined
    const next = lines()
    const removable = decls.every((decl) => decl.start === decl.end || (ins.keyword === "ENV" && !decl.args.includes("=")))
    // An ENV no RUN reads is a run-time setting: removing it would break the app, so it gets advice, not a fix.
    const runtime = ins.keyword === "ENV" && !runsUsing.length
    // An ARG no RUN names may still be read from the environment (an .npmrc with ${NPM_TOKEN}): deleting it would break the build.
    if (removable && !runtime && runsUsing.length) {
      for (const run of runsUsing) if (!new RegExp(`id=${id}\\b`).test(next[run.start])) withMount(next, run, `--mount=type=secret,id=${id},env=${secret.key}`)
      for (const decl of [...decls].sort((a, b) => b.start - a.start)) {
        const legacyDecl = decl.keyword === "ENV" && !decl.args.includes("=")
        const rest = legacyDecl ? "" : decl.args.replace(new RegExp(`(^|\\s)${secret.key}(=("[^"]*"|'[^']*'|\\S*))?(?=\\s|$)`), "").trim()
        if (rest) next[decl.start] = next[decl.start].replace(decl.args.trim(), rest)
        else next.splice(decl.start, decl.end - decl.start + 1)
      }
      fix = rebuild(source, next)
    }
    const command = `docker build --secret id=${id},env=${secret.key} .`
    issues.push({ kind: ins.keyword === "ENV" ? "secret-env" : "secret-arg", severity: "error", line: ins.start, detail: `${secret.key}|${runtime ? `docker run -e ${secret.key}` : command}|${runtime ? "runtime" : ""}`, fix })
  }

  // Secret files copied into a stage: baked into the final image, or carried there by COPY --from / FROM <stage>.
  for (const ins of instructions) {
    if ((ins.keyword !== "COPY" && ins.keyword !== "ADD") || /--from/i.test(ins.args)) continue
    const parts = words(splitFlags(ins.args).rest)
    const dest = parts.pop() ?? ""
    for (const src of parts.filter((part) => SECRET_FILE.test(part))) {
      const target = joinPath(workdirAt(ins), dest.endsWith("/") || dest === "." || parts.length > 1 ? `${dest.replace(/^\.$/, "")}/${basename(src)}` : dest)
      const reaches = chain.includes(ins.stage)
      const copiedBy = instructions.find((other) => other.keyword === "COPY" && other.stage !== ins.stage && chain.includes(other.stage) && new RegExp(`--from=${stages[ins.stage].name ?? ins.stage}\\b`, "i").test(other.args) && words(splitFlags(other.args).rest).slice(0, -1).some((from) => { const root = joinPath("/", from).replace(/\/$/, ""); return root === "" || target === root || target.startsWith(root + "/") }))
      if (!reaches && !copiedBy) continue
      const run = instructions.find((other) => other.keyword === "RUN" && other.stage === ins.stage && other.start > ins.start)
      let fix: string | undefined
      if (run && parts.length === 1) {
        const next = lines()
        withMount(next, run, `--mount=type=secret,id=${secretId(basename(src))},target=${target}`)
        next.splice(ins.start, ins.end - ins.start + 1)
        fix = rebuild(source, next)
      }
      issues.push({ kind: reaches ? "secret-file" : "stage-leak", severity: "error", line: ins.start, detail: `${basename(src)}|${copiedBy ? copiedBy.start + 1 : ""}|docker build --secret id=${secretId(basename(src))},src=${src} .`, fix })
    }
  }

  let ignoreReported = false
  for (const stage of stages) {
    const steps = inStage(stage.index)
    // COPY . . before the install step: every source change re-downloads every dependency.
    const copyAll = steps.find((ins) => (ins.keyword === "COPY" || ins.keyword === "ADD") && !/--from/i.test(ins.args) && words(splitFlags(ins.args).rest).slice(0, -1).some((src) => src === "." || src === "./"))
    if (copyAll) {
      const install = steps.find((ins) => ins.keyword === "RUN" && ins.start > copyAll.start && INSTALL.some(([re]) => re.test(ins.args)))
      if (install) {
        const [re, manifest] = INSTALL.find(([pattern]) => pattern.test(install.args))!
        const files = manifest.replace("$1", re.exec(install.args)?.[1] ?? "requirements.txt")
        const between = steps.some((ins) => ins.start > copyAll.start && ins.start < install.start && /^(WORKDIR|USER|ARG|ENV)$/.test(ins.keyword))
        let fix: string | undefined
        // `RUN npm ci && npm run build`: only the install moves up; the build still needs the sources.
        const segments = install.start === install.end ? install.args.split(/\s*&&\s*/) : [install.args]
        const splittable = segments.length === 1 || INSTALL.some(([pattern]) => pattern.test(segments[0]))
        if (!between && splittable) {
          const next = lines()
          // The manifests may already be copied (COPY ["package.json", "package-lock.json", "./"]): then only the install moves.
          const manifestNames = files.split(/\s+/).slice(0, -1)
          const copied = steps.some((ins) => ins.keyword === "COPY" && ins.start < copyAll.start && words(splitFlags(ins.args).rest).slice(0, -1).some((src) => manifestNames.some((name) => globMatch(name, basename(src)) || globMatch(basename(src), name))))
          const head = copied ? [] : [`COPY ${files}`]
          if (segments.length > 1) {
            next[install.start] = `RUN ${segments.slice(1).join(" && ")}`
            next.splice(copyAll.start, 0, ...head, `RUN ${segments[0]}`)
          } else {
            const block = next.splice(install.start, install.end - install.start + 1)
            next.splice(copyAll.start, 0, ...head, ...block)
          }
          fix = rebuild(source, next)
        }
        issues.push({ kind: "copy-before-install", severity: "warning", line: copyAll.start, detail: files, fix })
      }
      const ignore = context.dockerignore
      const patterns = typeof ignore === "string" ? toLines(ignore).map((row) => row.trim().replace(/^(\*\*\/|\/)+/, "").replace(/\/(\*\*?)?$/, "")) : []
      const missing = typeof ignore === "string" ? [".git", ".env", ...(/package/.test(source) ? ["node_modules"] : [])].filter((entry) => !patterns.some((row) => row === entry || row === `${entry}*`)) : []
      if (!ignoreReported && (ignore === null || ignore === undefined || missing.length) && (ignoreReported = true)) issues.push({ kind: "dockerignore", severity: ignore === undefined ? "info" : "warning", line: copyAll.start, detail: missing.join(", ") })
    }
  }

  for (const ins of instructions) {
    const args = ins.args
    if (ins.keyword === "RUN") {
      if (/\bapt(-get)? +(-\S+ +)*install\b/.test(args)) {
        const missing: string[] = []
        // -y in any short-flag cluster (-yq, -qy); apt-get's -qq implies -y too.
        if (!/\s(-[a-zA-Z]*y[a-zA-Z]*|--yes|--assume-yes|-qq|--quiet=2|-q=2)(?=\s|$)/.test(args)) missing.push("-y")
        if (!/--no-install-recommends/.test(args)) missing.push("--no-install-recommends")
        const cached = /--mount=type=cache[^ ]*\/var\/lib\/apt/.test(args)
        if (!cached && !/rm -rf \/var\/lib\/apt\/lists/.test(args)) missing.push("rm -rf /var/lib/apt/lists/*")
        if (missing.length) {
          const next = lines()
          for (let l = ins.start; l <= ins.end; l++) {
            next[l] = next[l].replace(/\b(apt(?:-get)?)( +(?:-\S+ +)*)install\b/, (_, cmd: string, opts: string) => `${cmd}${opts}install${missing.includes("-y") ? " -y" : ""}${missing.includes("--no-install-recommends") ? " --no-install-recommends" : ""}`)
          }
          if (missing.includes("rm -rf /var/lib/apt/lists/*")) next[ins.end] = `${next[ins.end].replace(/\s*$/, "")} && rm -rf /var/lib/apt/lists/*`
          issues.push({ kind: "apt", severity: missing.includes("-y") ? "error" : "warning", line: ins.start, detail: missing.join(", "), fix: /<</.test(args) ? undefined : rebuild(source, next) })
        }
      } else if (/\bapt(-get)? +update\b/.test(args) && !/\binstall\b/.test(args)) issues.push({ kind: "apt-update-alone", severity: "warning", line: ins.start })
      // A download piped into a shell: skipped when pipefail is on (the build then fails on a failed download).
      const pipefail = /pipefail/.test(args) || instructions.some((other) => other.keyword === "SHELL" && other.stage === ins.stage && other.start < ins.start && /pipefail/.test(other.args))
      const pipe = /\b(curl|wget)\b([^|;&\n]*?)(https?:\/\/[^\s|;&'"]+)([^|;&\n]*)\|\s*(sudo\s+)?((?:ba|z|da)?sh)\b((?:\s+-s)?(?:\s+--)?)([^;&|\n]*)/.exec(args)
      const ps = /\b(?:iwr|irm|curl|wget|Invoke-WebRequest|Invoke-RestMethod)\b[^|\n]*?(https?:\/\/[^\s|;'"]+)[^|\n]*\|\s*(?:iex|Invoke-Expression)\b/i.exec(args)
      if (pipe && !pipefail) {
        let fix: string | undefined
        if (ins.start === ins.end) {
          // Keep the user's own options (auth headers, proxies) and add -f so curl fails on HTTP errors.
          const opts = `${pipe[2]}${pipe[3]}${pipe[4]}`.replace(/\s+$/, "")
          const download = pipe[1] === "curl"
            ? `curl${/(^|\s)(-[a-zA-Z]*f[a-zA-Z]*|--fail)\b/.test(opts) ? "" : " -f"}${opts} -o /tmp/install.sh`
            : `wget${opts.replace(/(\s-[a-zA-Z]*?)O\s*-(?=\s|$)/, "$1").replace(/\s-(?=\s|$)/, "").replace(/\s--output-document=-/, "")} -O /tmp/install.sh`
          const next = lines()
          next[ins.start] = next[ins.start].replace(pipe[0], `${download} && ${pipe[5] ?? ""}${pipe[6]} /tmp/install.sh${pipe[8].trimEnd() ? " " + pipe[8].trim() : ""} && rm /tmp/install.sh`)
          fix = rebuild(source, next)
        }
        issues.push({ kind: "curl-pipe", severity: "warning", line: ins.start, detail: pipe[3], fix })
      } else if (ps) issues.push({ kind: "curl-pipe", severity: "warning", line: ins.start, detail: ps[1] })
    }
    if (ins.keyword === "ADD") {
      const { flags, rest } = splitFlags(args)
      const url = words(rest).slice(0, -1).find((src) => /^(https?:\/\/|git@)/.test(src))
      if (url && !flags.checksum) issues.push({ kind: "add-url", severity: "warning", line: ins.start, detail: url })
    }
    if ((ins.keyword === "CMD" || ins.keyword === "ENTRYPOINT") && ins.stage === finalStage && args.trim() && !args.trim().startsWith("[")) {
      const simple = !/[$&|;<>`*?()~"'\\]/.test(args) && !/^exec\b/.test(args.trim())
      const next = lines()
      if (simple && ins.start === ins.end) next[ins.start] = `${ins.keyword} ${JSON.stringify(args.trim().split(/\s+/))}`
      if (!/^exec\b/.test(args.trim())) issues.push({ kind: ins.keyword === "ENTRYPOINT" ? "entrypoint-shell" : "shell-form", severity: "warning", line: ins.start, fix: simple && ins.start === ins.end ? rebuild(source, next) : undefined })
    }
  }
  return issues.sort((a, b) => a.line - b.line)
}

/** A starting .dockerignore for COPY . builds. */
export const STARTER_DOCKERIGNORE = [".git", ".env", ".env.*", "!.env.example", "node_modules", "npm-debug.log", "Dockerfile*", ".dockerignore", "*.pem", "*.key", ".DS_Store", "coverage", "dist"].join("\n")

/** The final stage followed by the stages it's built FROM, nearest first. */
export function stageChain(stages: Stage[]) {
  const chain: number[] = []
  for (let s: number | undefined = stages.length - 1; s !== undefined && s >= 0 && !chain.includes(s); s = stages[s].parent) chain.push(s)
  return chain
}

/** What the final image is: its base image, how many stages build it, and the user it runs as (null = root). */
export function finalImageSummary(text: string) {
  const { instructions, stages } = parseDockerfile(text)
  if (!stages.length) return null
  const chain = stageChain(stages)
  const user = instructions.filter((ins) => ins.keyword === "USER" && chain.includes(ins.stage)).sort((a, b) => a.start - b.start).pop()?.args.trim()
  const image = stages[chain[chain.length - 1]].image
  const fallback = NONROOT_BASE.test(image) ? "nonroot" : /nanoserver/i.test(image) ? "ContainerUser" : null
  return { image, stages: stages.length, user: user ? (/^(root|0|ContainerAdministrator)(:|$)/i.test(user) ? null : user) : fallback, windows: WINDOWS_BASE.test(image) }
}
