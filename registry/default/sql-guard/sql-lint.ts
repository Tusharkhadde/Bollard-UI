// Bollard UI — sql-guard · MIT licence · https://bollard-ui.vercel.app/components/sql-guard

/** A small, dependency-free SQL tokenizer and the risk checks behind SqlGuard. Server safe. */

export type SqlTokenType = "space" | "comment" | "string" | "ident" | "number" | "word" | "punct"
export interface SqlToken {
  type: SqlTokenType
  value: string
  start: number
}

const rules: [SqlTokenType, RegExp][] = [
  ["space", /\s+/y],
  // "#" is a MySQL line comment; "#>" and "#-" (Postgres JSON operators) are left alone.
  ["comment", /--[^\n]*|#(?![>-])[^\n]*|\/\*[\s\S]*?(?:\*\/|$)/y],
  ["string", /[eEnN]?'(?:[^'\\]|''|\\.)*'?|\$(\w*)\$[\s\S]*?(?:\$\1\$|$)/y],
  ["ident", /"(?:[^"]|"")*"?|`[^`]*`?|\[[^\]]*\]?/y],
  ["number", /\d+(?:\.\d+)?/y],
  ["word", /[\p{L}_][\p{L}\p{N}_$]*/uy],
  ["punct", /<>|!=|<=|>=|::|[^\s]/y],
]

/** Splits SQL into tokens. Comments and strings stay whole, so "-- WHERE id = 4" never counts as a WHERE. */
export function tokenizeSql(sql: string): SqlToken[] {
  const tokens: SqlToken[] = []
  let i = 0
  while (i < sql.length) {
    for (const [type, re] of rules) {
      re.lastIndex = i
      const m = re.exec(sql)
      if (m && m[0]) {
        tokens.push({ type, value: m[0], start: i })
        i += m[0].length
        break
      }
    }
  }
  return tokens
}

export interface SqlRisk {
  /** no-where · commented-where · always-true · drop · truncate */
  code: "no-where" | "commented-where" | "always-true" | "drop" | "truncate"
  message: string
}

export interface SqlStatementInfo {
  /** The statement's own text, without the trailing semicolon. */
  text: string
  /** SELECT, UPDATE, DELETE, DROP… */
  verb: string
  /** Target table as written, quotes removed ("public.users"). */
  table?: string
  /** True for anything that writes: INSERT, UPDATE, DELETE, MERGE, DDL. */
  writes: boolean
  /** Risks that touch every row or the whole table; running needs the table name typed. */
  risks: SqlRisk[]
}

const VERBS = ["SELECT", "INSERT", "UPDATE", "DELETE", "MERGE", "DROP", "TRUNCATE", "ALTER", "CREATE", "GRANT", "REVOKE", "REPLACE"]
// What may follow an always-true term for the whole WHERE to stay always true. AND is
// left out on purpose: "WHERE 1=1 AND status = 'x'" (the query-builder pattern) narrows it.
const ENDS = new Set(["OR", "ORDER", "LIMIT", "RETURNING", "GROUP", ")"])
const unquote = (t: SqlToken) => (t.type === "ident" ? t.value.slice(1, -1).replace(/""/g, '"') : t.value)
const isName = (t?: SqlToken) => !!t && (t.type === "word" || t.type === "ident")

/** Reads a dotted name starting at `i`: public."Users" → public.Users. */
function readName(code: SqlToken[], i: number) {
  if (!isName(code[i])) return undefined
  let name = unquote(code[i])
  while (code[i + 1]?.value === "." && isName(code[i + 2])) {
    name += "." + unquote(code[i + 2])
    i += 2
  }
  return name
}

/** Breaks a script into statements and checks each one. */
export function analyzeSql(sql: string): SqlStatementInfo[] {
  const statements: SqlToken[][] = [[]]
  for (const t of tokenizeSql(sql)) {
    if (t.type === "punct" && t.value === ";") statements.push([])
    else statements[statements.length - 1].push(t)
  }
  return statements.flatMap((tokens) => {
    const code = tokens.filter((t) => t.type !== "space" && t.type !== "comment")
    if (!code.length) return []
    let depth = 0
    const top: number[] = [] // indexes of depth-0 tokens
    code.forEach((t, i) => {
      if (t.value === "(") depth++
      if (depth === 0) top.push(i)
      if (t.value === ")") depth = Math.max(0, depth - 1)
    })
    const word = (i: number) => (code[i]?.type === "word" ? code[i].value.toUpperCase() : (code[i]?.value ?? ""))
    // "WITH x AS (…) DELETE …" and "INSERT … SELECT" are judged by their writing verb.
    const v = top.find((i) => VERBS.includes(word(i)) && word(i) !== "SELECT") ?? top.find((i) => word(i) === "SELECT") ?? 0
    const verb = word(v)
    const text = tokens.map((t) => t.value).join("").trim()
    const risks: SqlRisk[] = []
    let table: string | undefined

    if (verb === "UPDATE") table = readName(code, word(v + 1) === "ONLY" ? v + 2 : v + 1)
    if (verb === "DELETE") table = readName(code, word(v + 1) === "FROM" ? v + 2 : v + 1)
    if (verb === "DROP" || verb === "TRUNCATE") {
      let i = v + 1
      const kind = verb === "TRUNCATE" ? "TABLE" : word(i)
      if (["TABLE", "DATABASE", "SCHEMA", "VIEW", "INDEX"].includes(word(i))) i++
      if (word(i) === "IF" && word(i + 1) === "EXISTS") i += 2
      table = readName(code, i)
      if (verb === "DROP" && ["TABLE", "DATABASE", "SCHEMA"].includes(kind))
        risks.push({ code: "drop", message: `DROP ${kind} deletes ${table ?? "it"} and everything in it.` })
      if (verb === "TRUNCATE") risks.push({ code: "truncate", message: `TRUNCATE empties ${table ?? "the table"} in one go.` })
    }

    if (verb === "UPDATE" || verb === "DELETE") {
      const where = top.find((i) => i > v && word(i) === "WHERE")
      const target = table ?? "the table"
      if (where === undefined) {
        const hidden = tokens.some((t) => t.type === "comment" && /\bwhere\b/i.test(t.value))
        risks.push(
          hidden
            ? { code: "commented-where", message: `The WHERE is commented out, so this ${verb === "DELETE" ? "deletes" : "changes"} every row in ${target}.` }
            : { code: "no-where", message: `${verb} without WHERE ${verb === "DELETE" ? "deletes" : "changes"} every row in ${target}.` },
        )
      } else {
        // WHERE 1=1, WHERE true, OR 'a'='a', OR id = id: a condition that is always true.
        for (let i = where + 1; i < code.length; i++) {
          if (word(i - 1) !== "WHERE" && word(i - 1) !== "OR") continue
          const a = code[i]
          const single = (a.type === "number" && a.value !== "0") || word(i) === "TRUE"
          const same = code[i + 1]?.value === "=" && code[i + 2] && a.type !== "punct" && unquote(a).toLowerCase() === unquote(code[i + 2]).toLowerCase()
          const next = same ? i + 3 : i + 1
          if ((single || same) && (next >= code.length || ENDS.has(word(next)))) {
            const shown = code.slice(i, next).map((t) => t.value).join(same ? "" : " ")
            risks.push({ code: "always-true", message: `“${word(i - 1)} ${shown}” is always true, so this ${verb === "DELETE" ? "deletes" : "changes"} every row in ${target}.` })
            break
          }
        }
      }
    }
    const writes = verb !== "SELECT" && VERBS.includes(verb)
    return [{ text, verb, table, writes, risks }]
  })
}

/** Removes the comment marker in front of a commented-out WHERE. */
export function uncommentWhere(sql: string) {
  return sql.replace(/(?:--|#)\s*(where\b)/i, "$1").replace(/\/\*\s*(where\b[\s\S]*?)\s*\*\//i, "$1")
}
