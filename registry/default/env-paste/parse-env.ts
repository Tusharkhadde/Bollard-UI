/** The environment a pasted .env is meant for. */
export type EnvTarget = "production" | "staging" | "development" | "test"

export interface EnvIssue {
  /** Stable kind, handy for tests and analytics. */
  kind: "invalid-key" | "lowercase-key" | "spaced-equals" | "stray-quote" | "smart-quote" | "whitespace" | "hash" | "empty" | "duplicate" | "wrong-env" | "not-assignment"
  /** Errors break the file; warnings are probably a mistake. */
  severity: "error" | "warning"
  message: string
  /** The corrected line, `null` to delete it, or `undefined` when there is no safe fix. */
  fix?: string | null
  fixLabel?: string
}

export interface EnvEntry {
  /** 0-based line index in the pasted text. */
  line: number
  key: string
  /** The value as a dotenv loader would read it. */
  value: string
  issues: EnvIssue[]
}

const KEY = /^[A-Za-z_][A-Za-z0-9_]*$/
const SMART = /[“”„‟″‘’‚‛′]/
const TEST_SECRET = /\b(?:sk|pk|rk|whsec)_test_|\brzp_test_|\bpk_test_|\bAKIA[A-Z0-9]*TEST/
const LIVE_SECRET = /\b(?:sk|rk)_live_|\brzp_live_/
const LOCAL_URL = /:\/\/(?:localhost|127\.0\.0\.1|0\.0\.0\.0)\b/

/** Turns `api-key.v2` into `API_KEY_V2` and `2FA` into `_2FA`. */
export function toEnvKey(key: string) {
  const clean = key.trim().replace(/[^A-Za-z0-9_]+/g, "_").toUpperCase()
  return /^[0-9]/.test(clean) ? `_${clean}` : clean || "_"
}

/** Strips one pair of matching quotes the way dotenv does. */
function unquote(raw: string) {
  const match = raw.match(/^(["'`])([\s\S]*)\1$/)
  return match ? match[2] : raw
}

/**
 * Parses KEY=VALUE text line by line and lists every slip a loader would
 * silently accept: stray or smart quotes, padded values, an unquoted ` #` that
 * cuts the value short, duplicate keys (the last one wins), bad key names,
 * empty values and test or live secrets in the wrong environment.
 */
export function parseEnv(text: string, environment?: EnvTarget): EnvEntry[] {
  const lines = text.split(/\r?\n/)
  const entries: EnvEntry[] = []
  lines.forEach((source, line) => {
    const trimmed = source.trimStart()
    if (!trimmed.trim() || trimmed.startsWith("#")) return
    const issues: EnvIssue[] = []
    const body = trimmed.replace(/^export\s+/, "")
    const prefix = body === trimmed ? "" : "export "
    const eq = body.indexOf("=")
    if (eq < 1) {
      entries.push({ line, key: trimmed.trim().slice(0, 40), value: "", issues: [{ kind: "not-assignment", severity: "error", message: "Not a KEY=VALUE line.", fix: null, fixLabel: "Remove line" }] })
      return
    }
    const rawKey = body.slice(0, eq)
    let rawValue = body.slice(eq + 1)
    const key = rawKey.trim()
    const rebuild = (k: string, v: string) => `${prefix}${k}=${v}`

    if (rawKey !== key || /^\s/.test(rawValue)) {
      issues.push({ kind: "spaced-equals", severity: "warning", message: "Spaces around = break shell and Docker loaders.", fix: rebuild(key, rawValue.trim()), fixLabel: "Remove spaces" })
      rawValue = rawValue.trimStart()
    }
    if (!KEY.test(key)) {
      issues.push({ kind: "invalid-key", severity: "error", message: "Keys allow only A–Z, 0–9 and _.", fix: rebuild(toEnvKey(key), rawValue), fixLabel: `Rename to ${toEnvKey(key)}` })
    } else if (/[a-z]/.test(key)) {
      issues.push({ kind: "lowercase-key", severity: "warning", message: "Lowercase key; code usually reads uppercase.", fix: rebuild(key.toUpperCase(), rawValue), fixLabel: `Use ${key.toUpperCase()}` })
    }

    const value = rawValue.trim()
    const opener = value[0]
    const quoted = /^(["'`]).*\1$/s.test(value) && value.length > 1
    if (SMART.test(value)) {
      issues.push({ kind: "smart-quote", severity: "error", message: "Curly quotes from a doc or chat end up in the value.", fix: rebuild(key, value.replace(/[“”„‟″]/g, '"').replace(/[‘’‚‛′]/g, "'")), fixLabel: "Use straight quotes" })
    } else if (/^["'`]/.test(value) && !quoted) {
      issues.push({ kind: "stray-quote", severity: "error", message: `Unclosed ${opener} becomes part of the value.`, fix: rebuild(key, value.slice(1).replace(/["'`]$/, "")), fixLabel: "Remove stray quote" })
    } else if (!quoted && /["']$/.test(value) && value.split(value.slice(-1)).length === 2) {
      issues.push({ kind: "stray-quote", severity: "error", message: "Unopened quote becomes part of the value.", fix: rebuild(key, value.slice(0, -1)), fixLabel: "Remove stray quote" })
    } else if (/^(["'])\1.+\1\1$/.test(value)) {
      issues.push({ kind: "stray-quote", severity: "error", message: "Quoted twice; one pair stays in the value.", fix: rebuild(key, value.slice(1, -1)), fixLabel: "Remove extra quotes" })
    } else if (!quoted && rawValue !== value && value) {
      issues.push({ kind: "whitespace", severity: "warning", message: "Trailing spaces: Docker keeps them, dotenv doesn't.", fix: rebuild(key, value), fixLabel: "Trim spaces" })
    } else if (quoted && unquote(value) !== unquote(value).trim()) {
      issues.push({ kind: "whitespace", severity: "warning", message: "Spaces inside the quotes are kept in the value.", fix: rebuild(key, `${opener}${unquote(value).trim()}${opener}`), fixLabel: "Trim inside quotes" })
    }

    let parsed = quoted ? unquote(value) : value
    const hash = !quoted ? value.search(/\s#/) : -1
    if (hash > 0) {
      parsed = value.slice(0, hash).trim()
      issues.push({ kind: "hash", severity: "warning", message: `" #" starts a comment: value is cut to "${parsed}".`, fix: rebuild(key, `"${value}"`), fixLabel: "Wrap in quotes" })
    }
    if (!parsed && !issues.some((issue) => issue.severity === "error")) {
      issues.push({ kind: "empty", severity: "warning", message: "Empty value; most code treats it as unset." })
    }
    if ((environment === "production" || environment === "staging") && TEST_SECRET.test(parsed)) {
      issues.push({ kind: "wrong-env", severity: "error", message: `Test key in ${environment}: nothing really charges.` })
    } else if ((environment === "development" || environment === "test") && LIVE_SECRET.test(parsed)) {
      issues.push({ kind: "wrong-env", severity: "error", message: `Live key in ${environment}: tests move real money.` })
    } else if (environment === "production" && LOCAL_URL.test(parsed)) {
      issues.push({ kind: "wrong-env", severity: "warning", message: "Points at localhost on a production server." })
    }
    entries.push({ line, key: KEY.test(key) ? key : toEnvKey(key), value: parsed, issues })
  })

  // Duplicates: every earlier definition is silently overridden by the last one.
  const last = new Map(entries.map((entry) => [entry.key, entry.line]))
  for (const entry of entries) {
    const winner = last.get(entry.key)
    if (winner !== undefined && winner !== entry.line) {
      entry.issues.unshift({ kind: "duplicate", severity: "warning", message: `Ignored: line ${winner + 1} sets it again and wins.`, fix: null, fixLabel: "Remove this line" })
    }
  }
  return entries
}

/** Replaces (or with `null`, deletes) one line of the text. */
export function applyEnvFix(text: string, line: number, fix: string | null) {
  const lines = text.split(/\r?\n/)
  if (fix === null) lines.splice(line, 1)
  else lines[line] = fix
  return lines.join("\n")
}

/** Fixes that can't change what the author meant. A ` #` or a non-assignment line needs a human. */
export const isSafeFix = (issue: EnvIssue) => issue.fix !== undefined && issue.kind !== "hash" && issue.kind !== "not-assignment"

/** Applies every safe fix, bottom-up so line numbers stay valid, until nothing changes. */
export function fixAllEnv(text: string, environment?: EnvTarget) {
  let current = text
  for (let pass = 0; pass < 5; pass++) {
    const fixable = parseEnv(current, environment).filter((entry) => entry.issues.some(isSafeFix))
    if (!fixable.length) break
    for (const entry of [...fixable].reverse()) {
      const issue = entry.issues.find(isSafeFix)
      if (issue) current = applyEnvFix(current, entry.line, issue.fix ?? null)
    }
  }
  return current
}
