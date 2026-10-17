// Bollard UI — curl-pipe-guard · MIT licence · https://bollard-ui.vercel.app/components/curl-pipe-guard

// Pure parsing and review for "curl … | sh"-style install one-liners. Safe on the server.

export type PipeIssueKind = "http" | "implied-http" | "ip" | "shortener" | "other-domain" | "code-host" | "sudo" | "insecure" | "no-checksum" | "no-fail" | "unparsed"

export interface PipeIssue {
  kind: PipeIssueKind
  severity: "danger" | "warning" | "info"
}

export interface PipeInstall {
  /** "unix" for curl/wget into a shell, "powershell" for iwr/irm into iex. */
  platform: "unix" | "powershell"
  fetcher: string
  url: string
  /** Lowercased host, without port. Empty when no URL was found. */
  host: string
  scheme: "https" | "http"
  /** The URL had no scheme, so curl/wget fall back to plain http. */
  impliedHttp: boolean
  /** The program the script is fed to: sh, bash, zsh, python3, source, ".", iex… */
  runner: string
  /** Arguments passed to the script itself, e.g. ["--yes"] from `sh -s -- --yes`, as written (quotes kept). */
  args: string[]
  /** The runner's own options, e.g. ["-x"] from `bash -x`. */
  runnerOptions: string[]
  /** What runs the runner, as written: `sudo -E`, `env FOO=1`, `ENV="$HOME/.bashrc"`. Empty when nothing does. */
  prefix: string
  /** Commands chained after the install with `&&` or `;`, e.g. `sudo apt-get install -y nodejs`. */
  then: string
  /** The script itself runs as root (`| sudo bash`, `sudo sh -c "$(curl …)"`). */
  sudo: boolean
  insecure: boolean
  /** curl was given -f/--fail, so an HTTP error page isn't piped into the shell. */
  fail: boolean
}

export interface PipeReviewOptions {
  /** The product's docs domain, e.g. "bun.sh". The script host should be it or a subdomain of it. */
  docsDomain?: string
  /** SHA-256 the docs publish for the script (64 hex characters). */
  checksum?: string
  /** A signature check the docs give, e.g. `gpg --verify install.sh.asc install.sh`. */
  verify?: string
  /** Hosts or host/path prefixes you trust, e.g. "raw.githubusercontent.com/Homebrew". */
  trustedSources?: string[]
}

const SHORTENERS = new Set(["bit.ly", "tinyurl.com", "t.co", "goo.gl", "is.gd", "ow.ly", "buff.ly", "rebrand.ly", "cutt.ly", "shorturl.at", "rb.gy", "tiny.cc", "git.io", "s.id", "v.gd", "t.ly", "lnkd.in", "bl.ink", "short.io"])
// Two-label public suffixes, so "example.co.uk" (not "co.uk") is the registrable domain.
const TWO_LABEL = new Set(["co.uk", "org.uk", "ac.uk", "gov.uk", "com.au", "net.au", "org.au", "co.in", "net.in", "org.in", "co.jp", "com.br", "com.cn", "co.nz", "co.za", "com.mx", "com.sg", "com.tr", "github.io", "gitlab.io", "vercel.app", "netlify.app", "pages.dev", "workers.dev", "herokuapp.com", "web.app", "firebaseapp.com"])
const CODE_HOSTS: Record<string, string> = { "raw.githubusercontent.com": "GitHub", "github.com": "GitHub", "gist.githubusercontent.com": "GitHub Gist", "objects.githubusercontent.com": "GitHub", "gitlab.com": "GitLab", "bitbucket.org": "Bitbucket", "codeberg.org": "Codeberg" }
const RUNNERS = "sh|bash|zsh|dash|ksh|fish|python3?|node|perl|ruby|iex|invoke-expression"

export const isIpHost = (host: string) => /^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.startsWith("[") || /^[0-9a-f:]+$/i.test(host) && host.includes(":")

/** "get.example.co.uk" → "example.co.uk". IPs come back unchanged. */
export function registrableDomain(host: string) {
  const h = host.toLowerCase().replace(/\.$/, "")
  if (isIpHost(h)) return h
  const labels = h.split(".")
  const take = TWO_LABEL.has(labels.slice(-2).join(".")) ? 3 : 2
  return labels.slice(-take).join(".")
}

/** Owner/repo for scripts on a code host, where anyone can publish under any name. */
export function codeHostSource(url: string) {
  try {
    const u = new URL(url)
    const site = CODE_HOSTS[u.hostname.toLowerCase()]
    if (!site) return null
    const [owner = "", repo = ""] = u.pathname.split("/").filter(Boolean)
    return { site, repo: [owner, repo].filter(Boolean).join("/") }
  } catch {
    return null
  }
}

type Segment = { text: string; op: string }

/** Splits on top-level `|`, `||`, `&&`, `;`, `&`, leaving quotes and `$( )`/`<( )` groups whole. */
function splitTop(cmd: string) {
  const out: Segment[] = []
  let quote = ""
  let depth = 0
  let cur = ""
  for (let i = 0; i < cmd.length; i++) {
    const ch = cmd[i]
    if (quote) {
      if (ch === quote) quote = ""
      else if (ch === "\\" && quote === '"') cur += ch + (cmd[++i] ?? "")
      else if (quote === '"' && ch === "$" && cmd[i + 1] === "(") depth++
      if (ch !== "\\") cur += ch
      continue
    }
    if (ch === "'" || ch === '"') quote = ch
    else if (ch === "(") depth++
    else if (ch === ")") depth = Math.max(0, depth - 1)
    else if (!depth && /[|;&]/.test(ch)) {
      const op = /[|&]/.test(cmd[i + 1] ?? "") && cmd[i + 1] === ch ? ch + cmd[++i] : ch
      out.push({ text: cur.trim(), op })
      cur = ""
      continue
    }
    cur += ch
  }
  out.push({ text: cur.trim(), op: "" })
  return out
}

/** Shell words with quotes and `$( )`/`<( )` groups kept as written. */
function words(text: string) {
  const out: string[] = []
  let quote = ""
  let depth = 0
  let cur = ""
  for (const ch of text) {
    if (quote) {
      if (ch === quote) quote = ""
    } else if (ch === "'" || ch === '"') quote = ch
    else if (ch === "(") depth++
    else if (ch === ")") depth = Math.max(0, depth - 1)
    else if (!depth && ch === " ") {
      if (cur) out.push(cur)
      cur = ""
      continue
    }
    cur += ch
  }
  if (cur) out.push(cur)
  return out
}

const RUNNER_RE = new RegExp(`^(?:[\\w./-]*/)?(${RUNNERS}|source|\\.)$`, "i")
// sudo options that take a value: `sudo -u deploy bash`.
const SUDO_ARG = /^-[ughpCDrtUT]$/

/** `sudo -E env FOO=1 bash -x -s -- --yes` → prefix, runner, its own options and the script's arguments. */
function readRunner(list: string[]) {
  let i = 0
  const prefix: string[] = []
  let sudo = false
  if (list[i] === "sudo") {
    sudo = true
    prefix.push(list[i++])
    while (i < list.length && list[i].startsWith("-")) {
      prefix.push(list[i])
      if (SUDO_ARG.test(list[i++]) && i < list.length) prefix.push(list[i++])
    }
  }
  if (list[i] === "env") {
    prefix.push(list[i++])
    while (i < list.length && list[i].startsWith("-")) prefix.push(list[i++])
  }
  while (i < list.length && /^[A-Za-z_]\w*=/.test(list[i])) prefix.push(list[i++])
  const m = list[i]?.match(RUNNER_RE)
  if (!m) return null
  const runner = m[1].toLowerCase()
  const options: string[] = []
  let j = i + 1
  let stdin = false
  for (; j < list.length; j++) {
    const w = list[j]
    if (w === "--" || w === "-" || w === "/dev/stdin") {
      stdin = true
      j++
      if (w !== "--" && list[j] === "--") j++
      break
    }
    if (w === "-s") {
      stdin = true
      j++
      if (list[j] === "--") j++
      break
    }
    if (!w.startsWith("-")) break
    options.push(w)
  }
  return { runner, prefix: prefix.join(" "), sudo, options, rest: list.slice(j), stdin }
}

/** Reads a curl/wget/iwr/irm one-liner. Returns null when it isn't a download fed to an interpreter. */
export function parsePipeInstall(input: unknown): PipeInstall | null {
  if (typeof input !== "string") return null
  let cmd = input.replace(/^\uFEFF/, "").replace(/\\\r?\n/g, " ").replace(/\r?\n/g, " ").replace(/\s+/g, " ").trim().slice(0, 4000)
  cmd = cmd.replace(/^\$\s+/, "").replace(/^PS [^>]*>\s*/, "")
  // powershell -c "irm … | iex" — look inside the quoted command.
  const wrapped = cmd.match(/^(?:powershell|pwsh)(?:\.exe)?(?:\s+-\w+(?:\s+(?!-c)\w+)?)*?\s+-c(?:ommand)?\s+(["'])(.*)\1/i)
  if (wrapped) cmd = wrapped[2]
  const FETCH = /\b(curl|wget|iwr|irm|invoke-webrequest|invoke-restmethod)\b(?:\.exe)?/i
  const fetch = cmd.match(FETCH)
  if (!fetch) return null
  const fetcher = fetch[1].toLowerCase()
  const powershell = /^(iwr|irm|invoke-)/.test(fetcher) || /\b(iex|invoke-expression)\b/i.test(cmd)

  let runner = ""
  let prefix = ""
  let sudo = false
  let options: string[] = []
  let args: string[] = []
  let then = ""
  let fetchPart = ""

  if (powershell) {
    // `irm … | iex`, `iex (irm …)`, `iex "& { $(irm …) } -Arg"`.
    const after = cmd.slice(fetch.index! + fetch[0].length)
    const piped = after.match(/\|\s*(iex|invoke-expression)\b/i)
    const before = cmd.slice(0, fetch.index)
    if (!piped && !/\b(iex|invoke-expression)\b/i.test(before)) return null
    runner = "iex"
    fetchPart = piped ? after.slice(0, piped.index) : after.split(")")[0]
    const scriptArgs = !piped && after.match(/\)\s*\}\s*([^"']*)["']/)
    if (scriptArgs) args = scriptArgs[1].trim().split(" ").filter(Boolean)
  } else {
    const segments = splitTop(cmd)
    const k = segments.findIndex((s) => FETCH.test(s.text))
    let last = k
    const seg = segments[k].text
    const inner = seg.match(/(?:\$\(|<\()([^)]*)\)/)
    if (inner && FETCH.test(inner[1])) {
      // `bash -c "$(curl …)" "" --flag`, `bash <(curl …) --flag`, `source <(curl …)`.
      const list = words(seg)
      const at = list.findIndex((w) => FETCH.test(w))
      const r = readRunner(list.slice(0, at).concat("--"))
      if (!r) return null
      ;({ runner, prefix, sudo } = r)
      options = r.options.filter((o) => o !== "-c")
      args = list.slice(at + 1)
      if (r.options.includes("-c")) args = args.slice(1) // the first word after -c "…" is $0
      fetchPart = inner[1].slice((inner[1].match(FETCH)?.index ?? 0) + fetch[0].length)
    } else {
      fetchPart = seg.slice((seg.match(FETCH)?.index ?? 0) + fetch[0].length)
      // Skip pass-through stages such as `| tee install.sh |`.
      for (let i = k; i < segments.length - 1 && segments[i].op === "|"; i++) {
        const r = readRunner(words(segments[i + 1].text))
        if (r) {
          ;({ runner, prefix, sudo, options } = r)
          args = r.rest
          last = i + 1
          break
        }
        if (!/^(tee|cat|dd)\b/.test(segments[i + 1].text)) return null
      }
      if (!runner) return null
    }
    // `… | bash - && sudo apt-get install -y nodejs`: keep what runs afterwards as its own step.
    then = segments.slice(last + 1).map((s) => s.text + (s.op && s.op !== ";" ? " " + s.op : "")).join(" ").trim().replace(/\s*(&&|\|\||;)$/, "")
    if (segments[last].op === "|" || segments[last].op === "&") then = ""
  }

  const explicit = fetchPart.match(/\bhttps?:\/\/[^\s'"|;)<>`]+/i)
  const bare = explicit ? null : fetchPart.split(" ").find((tok) => !tok.startsWith("-") && /^[\w-]+(\.[\w-]+)+(:\d+)?(\/\S*)?$/.test(tok.replace(/^['"]|['"]$/g, "")))
  const url = explicit ? explicit[0] : bare ? `http://${bare.replace(/^['"]|['"]$/g, "")}` : ""
  let host = ""
  let scheme: "https" | "http" = "https"
  try {
    const u = new URL(url)
    host = u.hostname.toLowerCase()
    scheme = u.protocol === "http:" ? "http" : "https"
  } catch {
    // No usable URL; the review reports it as unparsed.
  }
  const flags = fetchPart.split(" ").filter((tok) => tok.startsWith("-"))
  const shortHas = (letter: string) => flags.some((f) => /^-[a-zA-Z]+$/.test(f) && f.includes(letter))
  const curl = fetcher === "curl"
  return {
    platform: powershell ? "powershell" : "unix",
    fetcher,
    url,
    host,
    scheme,
    impliedHttp: !!bare,
    runner: runner === "invoke-expression" ? "iex" : runner,
    args,
    runnerOptions: options,
    prefix,
    then,
    sudo,
    insecure: (curl && (shortHas("k") || flags.includes("--insecure"))) || flags.includes("--no-check-certificate") || /-SkipCertificateCheck\b/i.test(fetchPart),
    fail: !curl || shortHas("f") || flags.some((f) => f === "--fail" || f === "--fail-with-body"),
  }
}

const isChecksum = (value?: string) => typeof value === "string" && /^[a-f0-9]{64}$/i.test(value.trim())

/** Everything worth flagging before the one-liner is copied or run, most serious first. */
export function reviewPipeInstall(install: PipeInstall | null, options: PipeReviewOptions = {}): PipeIssue[] {
  if (!install || !install.host) return [{ kind: "unparsed", severity: "warning" }]
  const issues: PipeIssue[] = []
  const add = (kind: PipeIssueKind, severity: PipeIssue["severity"]) => issues.push({ kind, severity })
  const trusted = (options.trustedSources ?? []).some((src) => {
    const bare = install.url.replace(/^https?:\/\//i, "").toLowerCase()
    const s = src.toLowerCase().replace(/^https?:\/\//, "").replace(/\/$/, "")
    return bare === s || bare.startsWith(s + "/") || install.host === s
  })
  if (install.impliedHttp) add("implied-http", "danger")
  else if (install.scheme === "http") add("http", "danger")
  if (isIpHost(install.host)) add("ip", "danger")
  else if (SHORTENERS.has(install.host)) add("shortener", "danger")
  else if (options.docsDomain && !trusted) {
    const docs = registrableDomain(options.docsDomain.replace(/^https?:\/\//i, "").split("/")[0])
    if (registrableDomain(install.host) !== docs) add(codeHostSource(install.url) ? "code-host" : "other-domain", "warning")
  }
  if (install.insecure) add("insecure", "danger")
  if (install.sudo) add("sudo", "warning")
  if (!isChecksum(options.checksum) && !options.verify?.trim()) add("no-checksum", "warning")
  if (!install.fail) add("no-fail", "info")
  return issues
}

/** The same install as separate steps: download to a file, read it, verify it, then run it. */
export function safeInstallSteps(install: PipeInstall, options: Pick<PipeReviewOptions, "checksum" | "verify"> = {}) {
  const url = install.url.replace(/^http:/i, "https:")
  const base = (() => {
    try {
      return new URL(url).pathname.split("/").pop() ?? ""
    } catch {
      return ""
    }
  })()
  const sum = isChecksum(options.checksum) ? options.checksum!.trim() : ""
  const args = install.args.length ? " " + install.args.join(" ") : ""
  if (install.platform === "powershell") {
    const file = /^[\w.-]+\.ps1$/i.test(base) ? base : "install.ps1"
    return [
      `Invoke-WebRequest -Uri "${url}" -OutFile ${file} -UseBasicParsing`,
      `notepad ${file}`,
      ...(sum ? [`if ((Get-FileHash ${file} -Algorithm SHA256).Hash -ne "${sum.toUpperCase()}") { throw "Checksum mismatch" }`] : []),
      ...(options.verify?.trim() ? [options.verify.trim()] : []),
      `powershell -ExecutionPolicy Bypass -File .\\${file}${args}`,
    ]
  }
  const ext = install.runner.startsWith("python") ? ".py" : install.runner === "node" ? ".js" : install.runner === "perl" ? ".pl" : install.runner === "ruby" ? ".rb" : ".sh"
  const file = /^[\w.-]+\.(sh|bash|py|js|pl|rb)$/i.test(base) ? base : `install${ext}`
  const download = install.fetcher === "wget" ? `wget -O ${file} "${url}"` : `curl -fsSL --proto '=https' --tlsv1.2 -o ${file} "${url}"`
  const runner = install.runner === "iex" ? "sh" : install.runner
  // `.`/`source` look a bare name up in PATH first, so point at the file.
  const target = runner === "." || runner === "source" ? `./${file}` : file
  const prefix = install.prefix ?? (install.sudo ? "sudo" : "")
  const opts = install.runnerOptions?.length ? " " + install.runnerOptions.join(" ") : ""
  return [
    download,
    `less ${file}`,
    ...(sum ? [`echo "${sum.toLowerCase()}  ${file}" | shasum -a 256 -c`] : []),
    ...(options.verify?.trim() ? [options.verify.trim()] : []),
    `${prefix ? prefix + " " : ""}${runner}${opts} ${target}${args}`,
    ...(install.then ? [install.then] : []),
  ]
}
