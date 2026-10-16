// Pure Unix permission parsing and checks (POSIX chmod modes, OpenSSH key and
// StrictModes rules). No DOM: safe on the server.

export type FileKind = "file" | "directory" | "script" | "data" | "private-key" | "pem" | "public-key" | "ssh-dir" | "authorized-keys" | "secrets" | "ssh-config" | "home-dir"

export type ModeIssueCode =
  | "invalid"
  | "decimal"
  | "short"
  | "world-writable"
  | "world-writable-dir"
  | "sticky-dir"
  | "setuid"
  | "setgid"
  | "setuid-dir"
  | "setgid-dir"
  | "sticky-file"
  | "key-too-open"
  | "pem-too-open"
  | "key-unreadable"
  | "ssh-dir-writable"
  | "ssh-dir-open"
  | "authorized-keys-writable"
  | "ssh-config-writable"
  | "home-writable"
  | "secrets-world"
  | "secrets-group"
  | "public-writable"
  | "data-executable"
  | "script-not-executable"
  | "dir-not-openable"
  | "group-writable"
  | "owner-less"
  | "no-access"

export interface ModeIssue {
  code: ModeIssueCode
  severity: "danger" | "error" | "warning" | "info"
  /** The mode to use instead, for a one-tap fix. */
  fix?: number
  detail?: string
}

export interface ParsedMode {
  /** The resulting mode (permission and special bits), or null when it can't be read. */
  mode: number | null
  form: "octal" | "symbolic" | "ls" | "empty" | "invalid"
  /** The mode a symbolic change started from. */
  base?: number
  /** Symbolic change with no u/g/o, so the umask limited it. */
  umaskApplied?: boolean
}

export interface ModeOptions {
  /** Starting mode for symbolic changes like u+x. Defaults to 644 for files, 755 for directories. */
  current?: number
  /** Umask for symbolic changes that name no u/g/o. Default 022. */
  umask?: number
  /** The group is meant to share write access (a team folder), so group write isn't flagged. */
  groupShared?: boolean
}

const DATA = /\.(csv|tsv|json|txt|md|log|png|jpe?g|gif|webp|svg|pdf|html?|css|js|mjs|ts|ya?ml|xml|sql|ini|conf|toml|zip|gz|tgz|tar|mp4|mov|mp3|docx?|xlsx?)$/i
const SCRIPT = /\.(sh|bash|zsh|fish|py|rb|pl|cgi|command|run)$/i

/** Guesses what a path is from its name: a key, a .ssh folder, a script, a data file… */
export function inferKind(path: string | undefined, fallback: FileKind = "file"): FileKind {
  const raw = (path ?? "").trim()
  if (!raw) return fallback
  const isDir = raw.endsWith("/")
  const trimmed = raw.replace(/\/+$/, "")
  const name = trimmed.split("/").pop()?.toLowerCase() ?? ""
  // sshd's StrictModes also checks the home folder: ~, $HOME, /home/<user>, /Users/<user>.
  if (/^(~|\$HOME|\/(home|Users)\/[^/]+|\/root)$/.test(trimmed)) return "home-dir"
  if (name === ".ssh") return "ssh-dir"
  if (isDir) return "directory"
  if (name === "authorized_keys" || name === "authorized_keys2") return "authorized-keys"
  if (name === "config" && /(^|\/)\.ssh\/config$/.test(trimmed)) return "ssh-config"
  if (name.endsWith(".pub")) return "public-key"
  if (/^id_(rsa|dsa|ecdsa|ed25519)(_sk)?$/.test(name) || /\.(key|ppk|p12|pfx|p8)$/.test(name)) return "private-key"
  if (name.endsWith(".pem")) return "pem"
  // Files that hold passwords or tokens: env files, registry and cloud credentials, kubeconfig, keystores.
  if (
    /^\.env(\..+)?$/.test(name) ||
    /^(\.netrc|\.pgpass|\.my\.cnf|credentials|\.git-credentials|\.npmrc|\.pypirc|\.htpasswd|wp-config\.php|kubeconfig|secrets?\.(json|ya?ml|toml))$/.test(name) ||
    /\.(jks|keystore|kdbx)$/.test(name) ||
    /(^|\/)\.(kube\/config|docker\/config\.json)$/.test(trimmed)
  )
    return "secrets"
  if (SCRIPT.test(name)) return "script"
  if (DATA.test(name)) return "data"
  return fallback
}

const COMMON = [0o644, 0o755, 0o600, 0o700, 0o664, 0o775, 0o640, 0o750, 0o400, 0o444, 0o777, 0o666]
/** Modes worth offering when a decimal is spotted: never the world-writable ones. */
const SAFE = COMMON.slice(0, 10)
const WHO: Record<string, number> = { u: 0o4700, g: 0o2070, o: 0o1007 }
const CLASS_SHIFT: Record<string, number> = { u: 6, g: 3, o: 0 }

/** Applies a POSIX symbolic mode ("u+x,go-w", "a=r", "g=u") to a starting mode. */
function applySymbolic(input: string, base: number, isDir: boolean, umask: number): { mode: number; umaskApplied: boolean } | null {
  let mode = base
  let umaskApplied = false
  for (const clause of input.split(",")) {
    const match = clause.match(/^([ugoa]*)((?:[-+=](?:[ugo]|[rwxXst]*))+)$/)
    if (!match) return null
    const classes = match[1].replace(/a/g, "ugo") || "ugo"
    const limit = match[1] ? 0o7777 : ~umask & 0o7777
    if (!match[1]) umaskApplied = true
    for (const action of match[2].matchAll(/([-+=])([ugo]|[rwxXst]*)/g)) {
      const [, op, perms] = action
      let bits = 0
      for (const who of new Set(classes)) {
        const shift = CLASS_SHIFT[who]
        if (/^[ugo]$/.test(perms)) {
          bits |= ((mode >> CLASS_SHIFT[perms]) & 7) << shift
          continue
        }
        for (const perm of perms) {
          if (perm === "r") bits |= 4 << shift
          else if (perm === "w") bits |= 2 << shift
          else if (perm === "x" || (perm === "X" && (isDir || mode & 0o111))) bits |= 1 << shift
          else if (perm === "s" && who === "u") bits |= 0o4000
          else if (perm === "s" && who === "g") bits |= 0o2000
          else if (perm === "t" && who === "o") bits |= 0o1000
        }
      }
      bits &= limit
      const affected = [...new Set(classes)].reduce((sum, who) => sum | WHO[who], 0) & limit
      if (op === "+") mode |= bits
      else if (op === "-") mode &= ~bits
      else mode = (mode & ~affected) | bits
    }
  }
  return { mode: mode & 0o7777, umaskApplied }
}

/** Reads 644, 0644, 0o644, 4755, u+x,go-w or -rwxr-xr-x into a numeric mode. */
export function parseMode(raw: unknown, kind: FileKind = "file", options: ModeOptions = {}): ParsedMode {
  const text = (typeof raw === "string" ? raw : typeof raw === "number" && Number.isFinite(raw) ? raw.toString(8) : "").replace(/^\uFEFF/, "").trim().slice(0, 200)
  if (!text) return { mode: null, form: "empty" }
  const isDir = kind === "directory" || kind === "ssh-dir" || kind === "home-dir"
  const octal = text.replace(/^0o/i, "")
  if (/^[0-7]{1,5}$/.test(octal) && Number.parseInt(octal, 8) <= 0o7777) return { mode: Number.parseInt(octal, 8), form: "octal" }
  const ls = text.match(/^[-dlbcps]?([r-])([w-])([xsS-])([r-])([w-])([xsS-])([r-])([w-])([xtT-])[.+@]?$/)
  if (ls) {
    const [, ur, uw, ux, gr, gw, gx, or, ow, ox] = ls
    let mode = 0
    const bit = (char: string, on: string, value: number) => (char !== "-" && on.includes(char) ? value : 0)
    mode |= bit(ur, "r", 0o400) | bit(uw, "w", 0o200) | bit(ux, "xs", 0o100) | (/[sS]/.test(ux) ? 0o4000 : 0)
    mode |= bit(gr, "r", 0o040) | bit(gw, "w", 0o020) | bit(gx, "xs", 0o010) | (/[sS]/.test(gx) ? 0o2000 : 0)
    mode |= bit(or, "r", 0o004) | bit(ow, "w", 0o002) | bit(ox, "xt", 0o001) | (/[tT]/.test(ox) ? 0o1000 : 0)
    return { mode, form: "ls" }
  }
  const base = options.current ?? (isDir ? 0o755 : 0o644)
  const symbolic = /^[ugoa+\-=rwxXst,]+$/.test(text) ? applySymbolic(text, base & 0o7777, isDir, options.umask ?? 0o022) : null
  if (symbolic) return { mode: symbolic.mode, form: "symbolic", base, umaskApplied: symbolic.umaskApplied }
  return { mode: null, form: "invalid" }
}

/** Formats a mode the way `ls -l` shows it (without the type letter). */
export function toRwx(mode: number): string {
  const triple = (shift: number, special: number, on: string, off: string) => {
    const bits = (mode >> shift) & 7
    const exec = bits & 1
    const x = mode & special ? (exec ? on : off) : exec ? "x" : "-"
    return `${bits & 4 ? "r" : "-"}${bits & 2 ? "w" : "-"}${x}`
  }
  return triple(6, 0o4000, "s", "S") + triple(3, 0o2000, "s", "S") + triple(0, 0o1000, "t", "T")
}

export const toOctal = (mode: number) => (mode & 0o7777).toString(8).padStart(4, "0")

/** Lists what is risky or surprising about a mode for this kind of file. */
export function checkMode(raw: unknown, kind: FileKind = "file", options: ModeOptions = {}): { parsed: ParsedMode; issues: ModeIssue[] } {
  const parsed = parseMode(raw, kind, options)
  const issues: ModeIssue[] = []
  const text = typeof raw === "string" ? raw.trim() : ""
  if (/^\d+$/.test(text)) {
    const decimal = Number.parseInt(text, 10)
    const asOctal = COMMON.find((mode) => mode === decimal)
    if (asOctal !== undefined && !COMMON.includes(parsed.mode ?? -1)) issues.push({ code: "decimal", severity: "error", fix: SAFE.includes(asOctal) ? asOctal : undefined, detail: asOctal.toString(8) })
  }
  if (parsed.mode === null) {
    if (parsed.form === "invalid" && !issues.length) issues.push({ code: "invalid", severity: "error" })
    return { parsed, issues }
  }
  if (issues.length) return { parsed, issues }
  const m = parsed.mode
  // "64" is read as 064. Flag it (and skip the noise that follows from it), unless it is a plain 0.
  const digits = text.replace(/^0o/i, "")
  const short = parsed.form === "octal" && digits.length < 3 && m !== 0
  if (short) issues.push({ code: "short", severity: "warning", detail: toOctal(m).slice(1), fix: Number.parseInt(digits.padEnd(3, "0"), 8) })
  const isDir = kind === "directory" || kind === "ssh-dir" || kind === "home-dir"
  const owner = (m >> 6) & 7
  const group = (m >> 3) & 7
  const other = m & 7

  if (m & 0o002) {
    if (isDir && m & 0o1000) issues.push({ code: "sticky-dir", severity: "info" })
    else issues.push({ code: isDir ? "world-writable-dir" : "world-writable", severity: "danger", fix: m & ~0o022 })
  }
  if (m & 0o4000) issues.push(isDir ? { code: "setuid-dir", severity: "warning", fix: m & ~0o4000 } : { code: "setuid", severity: "danger", fix: m & ~0o4000 })
  if (m & 0o2000) issues.push(isDir ? { code: "setgid-dir", severity: "info" } : { code: "setgid", severity: "warning", fix: m & ~0o2000 })
  if (m & 0o1000 && !isDir) issues.push({ code: "sticky-file", severity: "info", fix: m & ~0o1000 })

  if (kind === "private-key" || kind === "pem") {
    if (m & 0o077) issues.push({ code: kind === "pem" ? "pem-too-open" : "key-too-open", severity: kind === "pem" ? "warning" : "error", fix: 0o600, detail: toOctal(m) })
    else if (!(m & 0o400)) issues.push({ code: "key-unreadable", severity: "error", fix: 0o600 })
  } else if (kind === "ssh-dir") {
    if (m & 0o022) issues.push({ code: "ssh-dir-writable", severity: "error", fix: 0o700 })
    else if (m & 0o055) issues.push({ code: "ssh-dir-open", severity: "warning", fix: 0o700 })
  } else if (kind === "authorized-keys") {
    if (m & 0o022) issues.push({ code: "authorized-keys-writable", severity: "error", fix: 0o600 })
  } else if (kind === "ssh-config") {
    if (m & 0o022) issues.push({ code: "ssh-config-writable", severity: "error", fix: 0o600 })
  } else if (kind === "home-dir") {
    if (m & 0o022) issues.push({ code: "home-writable", severity: "error", fix: m & ~0o022 })
  } else if (kind === "secrets") {
    if (m & 0o007) issues.push({ code: "secrets-world", severity: "error", fix: 0o600 })
    else if (m & 0o070) issues.push({ code: "secrets-group", severity: "warning", fix: 0o600 })
  } else if (kind === "public-key") {
    if (m & 0o022) issues.push({ code: "public-writable", severity: "warning", fix: 0o644 })
  } else if (kind === "data" && m & 0o111) {
    issues.push({ code: "data-executable", severity: "warning", fix: m & ~0o111 })
  } else if (kind === "script" && !(m & 0o100)) {
    issues.push({ code: "script-not-executable", severity: "warning", fix: m | ((m & 0o444) >> 2) })
  } else if (kind === "directory" && !(m & 0o100)) {
    issues.push({ code: "dir-not-openable", severity: "warning", fix: m | 0o100 | ((m & 0o044) >> 2) })
  }
  const generic = kind === "file" || kind === "directory" || kind === "script" || kind === "data"
  if (generic && !short && m & 0o020 && !(m & 0o002) && !options.groupShared) issues.push({ code: "group-writable", severity: "warning", fix: m & ~0o020, detail: toOctal(m & ~0o020).replace(/^0/, "") })
  if (!(m & 0o777)) issues.push({ code: "no-access", severity: "warning" })
  else if (generic && !short && ((group | other) & ~owner) !== 0) issues.push({ code: "owner-less", severity: "warning" })
  return { parsed, issues }
}
