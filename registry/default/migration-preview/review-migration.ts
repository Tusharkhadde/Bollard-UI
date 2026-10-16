// Bollard UI — migration-preview · MIT licence · https://bollard-ui.vercel.app/components/migration-preview

export type MigrationRiskKind =
  | "drop-table" | "drop-column" | "truncate" | "delete-all" | "not-null-no-default" | "volatile-default" | "rewrite-column"
  | "type-change" | "set-not-null" | "index-blocking" | "drop-index-blocking" | "concurrently-in-tx" | "constraint-validate"
  | "unique-constraint" | "rename-column" | "rename-table" | "update-all" | "lock-timeout" | "reindex-blocking" | "table-rewrite"

/** What other sessions can't do while the step holds its lock. */
export type MigrationLock = "reads-writes" | "writes" | "none"

export interface MigrationRisk {
  kind: MigrationRiskKind
  severity: "danger" | "warning" | "info"
  /** Replacement SQL for the step (a safer sequence). Undefined: no safe automatic fix. */
  fix?: string
  /** Filled into the message: a column, an expression, a row count. */
  detail?: string
}

export interface MigrationStep {
  /** 0-based position in the migration. */
  index: number
  /** The statement as written, comments included. */
  sql: string
  /** Character range in the source. */
  start: number
  end: number
  /** Table the step acts on, unquoted, when one could be read. */
  table?: string
  /** Known row count for that table, from `tableSizes`. */
  rows?: number
  lock: MigrationLock
  /** Rewrites or scans every row while locked, so the lock lasts as long as the table is big. */
  slow: boolean
  /** Can't be reversed by a down migration: the data is gone. */
  irreversible: boolean
  risks: MigrationRisk[]
}

export interface MigrationContext {
  /** Row counts by table name (or schema.table). Unknown tables are treated as big. */
  tableSizes?: Record<string, number>
  /** Tables at or above this many rows count as big. */
  largeTableRows?: number
  /** Your runner wraps the file in a transaction (Rails, Prisma and Django do by default). */
  inTransaction?: boolean
}

/** Splits SQL into statements, ignoring ; inside strings (E'' escapes too), quoted names, dollar quotes and comments. Never throws. */
export function splitStatements(sql: string) {
  const statements: { sql: string; code: string; start: number; end: number }[] = []
  let code = ""
  let start = 0
  let i = 0
  const push = (end: number) => {
    const text = sql.slice(start, end)
    const lead = text.length - text.trimStart().length
    if (code.trim()) statements.push({ sql: text.trim(), code: code.replace(/\s+/g, " ").trim(), start: start + lead, end: start + text.trimEnd().length })
    code = ""
    start = end + 1
  }
  while (i < sql.length) {
    const ch = sql[i]
    const next = sql[i + 1]
    if (ch === "-" && next === "-") {
      const stop = sql.indexOf("\n", i)
      i = stop < 0 ? sql.length : stop
    } else if (ch === "/" && next === "*") {
      const stop = sql.indexOf("*/", i + 2)
      i = stop < 0 ? sql.length : stop + 2
      code += " "
    } else if (ch === "'") {
      // E'it\'s' strings allow backslash escapes; ordinary strings only escape by doubling the quote.
      const escapes = /[eE]/.test(sql[i - 1] ?? "") && !/[\w$]/.test(sql[i - 2] ?? "")
      let j = i + 1
      while (j < sql.length && !(sql[j] === "'" && sql[j + 1] !== "'")) j += sql[j] === "'" || (escapes && sql[j] === "\\") ? 2 : 1
      code += "'?'"
      i = j + 1
    } else if (ch === '"') {
      const stop = sql.indexOf('"', i + 1)
      code += sql.slice(i, stop < 0 ? sql.length : stop + 1)
      i = stop < 0 ? sql.length : stop + 1
    } else if (ch === "$" && !/[\w$]/.test(sql[i - 1] ?? "") && /^\$(?:[A-Za-z_]\w*)?\$/.test(sql.slice(i))) {
      const tag = sql.slice(i).match(/^\$(?:[A-Za-z_]\w*)?\$/)?.[0] ?? "$$"
      const stop = sql.indexOf(tag, i + tag.length)
      code += "'?'"
      i = stop < 0 ? sql.length : stop + tag.length
    } else if (ch === ";") {
      push(i)
      i++
    } else {
      code += ch
      i++
    }
  }
  push(sql.length)
  return statements
}

const NAME = String.raw`(?:"[^"]+"|[\w$]+)(?:\.(?:"[^"]+"|[\w$]+))?`
const unquote = (name: string) => name.replace(/"/g, "")
const VOLATILE = /\b(clock_timestamp|random|gen_random_uuid|uuid_generate_v\d\w*|nextval|timeofday)\s*\(/i
const re = (source: string) => new RegExp(source, "i")

/** Splits "ADD COLUMN a int, DROP COLUMN b" into its actions, ignoring commas inside parentheses. */
function splitActions(actions: string) {
  const parts: string[] = []
  let depth = 0
  let from = 0
  for (let i = 0; i < actions.length; i++) {
    if (actions[i] === "(") depth++
    else if (actions[i] === ")") depth = Math.max(0, depth - 1)
    else if (actions[i] === "," && depth === 0 && /^\s*(ADD|DROP|ALTER|RENAME|SET|VALIDATE)\b/i.test(actions.slice(i + 1))) {
      parts.push(actions.slice(from, i).trim())
      from = i + 1
    }
  }
  parts.push(actions.slice(from).trim())
  return parts.filter(Boolean)
}

/** Reads a Postgres migration step by step: what each one locks, what it rewrites, and what can't be undone. */
export function reviewMigration(sql: string, { tableSizes = {}, largeTableRows = 1_000_000, inTransaction = false }: MigrationContext = {}): MigrationStep[] {
  const statements = splitStatements(sql)
  let inTx = inTransaction
  const steps = statements.map(({ sql: text, code, start, end }, index): MigrationStep => {
    const step: MigrationStep = { index, sql: text, start, end, lock: "none", slow: false, irreversible: false, risks: [] }
    const add = (kind: MigrationRiskKind, severity: MigrationRisk["severity"], extra: Partial<MigrationRisk> = {}) => step.risks.push({ kind, severity, ...extra })
    if (/^(BEGIN|START TRANSACTION)\b/i.test(code)) inTx = true
    if (/^(COMMIT|END|ROLLBACK)\b/i.test(code)) inTx = inTransaction
    const alter = code.match(re(`^ALTER TABLE (?:IF EXISTS )?(?:ONLY )?(${NAME}) (.*)$`))
    const target =
      alter?.[1] ??
      code.match(re(`^(?:DROP TABLE (?:IF EXISTS )?|TRUNCATE (?:TABLE )?|DELETE FROM |UPDATE (?:ONLY )?|REINDEX (?:\\([^)]*\\) )?TABLE (?:CONCURRENTLY )?|VACUUM (?:FULL|\\([^)]*\\bFULL\\b[^)]*\\)) (?:\\w+ )*?|CLUSTER (?:VERBOSE )?)(${NAME})`))?.[1] ??
      code.match(re(`^CREATE (?:UNIQUE )?INDEX .*?\\bON (?:ONLY )?(${NAME})`))?.[1]
    if (target) {
      step.table = unquote(target)
      const size = tableSizes[step.table] ?? tableSizes[step.table.split(".").pop() ?? ""]
      if (size !== undefined) step.rows = size
    }
    const big = step.rows === undefined || step.rows >= largeTableRows
    // CONCURRENTLY can't run inside a transaction, so offering it there would trade one problem for a failing step.
    const concurrently = (fix: string) => (inTx ? undefined : fix)
    const slow = (kind: MigrationRiskKind, extra: Partial<MigrationRisk> = {}) => {
      step.slow = true
      add(kind, big ? "warning" : "info", extra)
    }

    if (re(`^DROP TABLE`).test(code)) {
      step.lock = "reads-writes"
      step.irreversible = true
      add("drop-table", "danger")
    } else if (re(`^TRUNCATE`).test(code)) {
      step.lock = "reads-writes"
      step.irreversible = true
      add("truncate", "danger")
    } else if (re(`^DELETE FROM ${NAME}(?: (?:AS )?\\w+)?$`).test(code)) {
      step.irreversible = true
      add("delete-all", "danger")
    } else if (re(`^UPDATE (?:ONLY )?${NAME} .*\\bSET\\b`).test(code) && !/\bWHERE\b/i.test(code)) {
      if (big) add("update-all", "warning")
    } else if (/^CREATE (UNIQUE )?INDEX\b/i.test(code)) {
      if (/\bCONCURRENTLY\b/i.test(code)) {
        if (inTx) add("concurrently-in-tx", "danger")
      } else {
        step.lock = "writes"
        slow("index-blocking", { fix: concurrently(text.replace(/\bINDEX\b/i, "INDEX CONCURRENTLY")) })
      }
    } else if (/^DROP INDEX\b/i.test(code)) {
      if (/\bCONCURRENTLY\b/i.test(code)) {
        if (inTx) add("concurrently-in-tx", "danger")
      } else {
        step.lock = "reads-writes"
        add("drop-index-blocking", big ? "warning" : "info", { fix: concurrently(text.replace(/\bINDEX\b/i, "INDEX CONCURRENTLY")) })
      }
    } else if (/^REINDEX\b/i.test(code)) {
      if (/\bCONCURRENTLY\b/i.test(code)) {
        if (inTx) add("concurrently-in-tx", "danger")
      } else if (!/^REINDEX (\([^)]*\) )?(SYSTEM|DATABASE)\b/i.test(code)) {
        step.lock = "writes"
        slow("reindex-blocking", { fix: concurrently(text.replace(/\b(INDEX|TABLE|SCHEMA)\b/i, "$1 CONCURRENTLY")) })
      }
    } else if (/^(VACUUM (FULL\b|\([^)]*\bFULL\b)|CLUSTER\b)/i.test(code)) {
      step.lock = "reads-writes"
      slow("table-rewrite")
    } else if (alter) {
      const table = alter[1]
      const actions = splitActions(alter[2])
      // Rebuilt fixes only make sense for a single-action ALTER; the rest still get flagged.
      const single = actions.length === 1
      const leading = text.match(/^(?:\s*(?:--[^\n]*(?:\n|$)|\/\*[\s\S]*?\*\/))*\s*/)?.[0] ?? ""
      const rebuilt = (fix: string) => (single ? leading + fix : undefined)
      step.lock = actions.every((action) => /^VALIDATE CONSTRAINT\b/i.test(action)) ? "none" : actions.every((action) => /^ADD (CONSTRAINT \S+ )?FOREIGN KEY\b/i.test(action)) ? "writes" : "reads-writes"
      for (const action of actions) {
        const column = action.match(re(`^ADD (?:COLUMN )?(?:IF NOT EXISTS )?(?!CONSTRAINT\\b|FOREIGN KEY\\b|CHECK\\b|UNIQUE\\b|PRIMARY KEY\\b|EXCLUDE\\b)(${NAME}) (.+)$`))
        const addConstraint = action.match(re(`^ADD (?:CONSTRAINT (${NAME}) )?(FOREIGN KEY|CHECK|UNIQUE|PRIMARY KEY|EXCLUDE)\\b(.*)$`))
        if (/^RENAME COLUMN|^RENAME (?!TO\b|CONSTRAINT\b)/i.test(action)) add("rename-column", "warning", { detail: unquote(action.match(/^RENAME (?:COLUMN )?("?[\w$]+"?)/i)?.[1] ?? "") })
        else if (/^RENAME TO\b/i.test(action)) add("rename-table", "warning")
        else if (/^DROP (COLUMN )?(?!CONSTRAINT\b)/i.test(action)) {
          step.irreversible = true
          add("drop-column", "danger", { detail: unquote(action.match(re(`^DROP (?:COLUMN )?(?:IF EXISTS )?(${NAME})`))?.[1] ?? "") })
        } else if (addConstraint) {
          const [, name, type, rest] = addConstraint
          if (/^(UNIQUE|PRIMARY KEY)$/i.test(type) && !/\bUSING INDEX\b/i.test(rest)) {
            const cols = rest.match(/^\s*\(([^)]*)\)/)?.[1]
            slow("unique-constraint", name && cols && /UNIQUE/i.test(type) && !inTx ? { fix: rebuilt(`CREATE UNIQUE INDEX CONCURRENTLY ${unquote(name)}_idx ON ${table} (${cols});\nALTER TABLE ${table} ADD CONSTRAINT ${name} UNIQUE USING INDEX ${unquote(name)}_idx;`) } : {})
          } else if (/^(FOREIGN KEY|CHECK)$/i.test(type) && !/\bNOT VALID\b/i.test(rest)) {
            slow("constraint-validate", name && single ? { fix: `${text} NOT VALID;\nALTER TABLE ${table} VALIDATE CONSTRAINT ${name};` } : {})
          }
        } else if (column) {
          const [, name, definition] = column
          const type = definition.match(/^([\w ]+?(?:\([^)]*\))?(?:\[\])?)(?= NOT| NULL| DEFAULT| GENERATED| PRIMARY| UNIQUE| REFERENCES| CHECK| CONSTRAINT| COLLATE|$)/i)?.[1] ?? definition
          const fullDefault = text.match(/\bDEFAULT\s+([\s\S]+?)(?=\s+(?:NOT\s+NULL|NULL|CHECK|REFERENCES|UNIQUE|PRIMARY|CONSTRAINT|GENERATED)\b|\s*$)/i)?.[1]
          if (/\bNOT NULL\b/i.test(definition) && !/\bDEFAULT\b/i.test(definition) && !/\bGENERATED\b/i.test(definition)) {
            // The SET NOT NULL stays commented out: run here, before the backfill, it would fail just the same.
            add("not-null-no-default", step.rows === 0 ? "info" : "danger", { detail: unquote(name), fix: rebuilt(`-- Backfill ${unquote(name)} in batches, then in a later migration:\n-- ALTER TABLE ${table} ALTER COLUMN ${name} SET NOT NULL;\nALTER TABLE ${table} ADD COLUMN ${name} ${type}`) })
          } else if (/\bDEFAULT\b/i.test(definition) && VOLATILE.test(definition)) {
            const notNull = /\bNOT NULL\b/i.test(definition) ? `\n-- Once backfilled, in a later migration: ALTER TABLE ${table} ALTER COLUMN ${name} SET NOT NULL;` : ""
            slow("volatile-default", { detail: fullDefault, fix: fullDefault ? rebuilt(`ALTER TABLE ${table} ADD COLUMN ${name} ${type};\n-- New rows get the default; backfill old rows in batches.${notNull}\nALTER TABLE ${table} ALTER COLUMN ${name} SET DEFAULT ${fullDefault};`) : undefined })
          } else if (/\b(BIG|SMALL)?SERIAL\b|\bGENERATED\b.*\bSTORED\b|\bGENERATED\b.*\bIDENTITY\b/i.test(definition)) slow("rewrite-column", { detail: unquote(name) })
        } else if (/^ALTER (?:COLUMN )?\S+ (?:SET DATA )?TYPE\b/i.test(action)) slow("type-change", { detail: unquote(action.match(/^ALTER (?:COLUMN )?(\S+)/i)?.[1] ?? "") })
        else if (/^ALTER (?:COLUMN )?\S+ SET NOT NULL\b/i.test(action)) {
          const name = action.match(/^ALTER (?:COLUMN )?(\S+)/i)?.[1] ?? ""
          const check = `${unquote(table).split(".").pop()}_${unquote(name)}_not_null`
          slow("set-not-null", { detail: unquote(name), fix: rebuilt(`ALTER TABLE ${table} ADD CONSTRAINT ${check} CHECK (${name} IS NOT NULL) NOT VALID;\nALTER TABLE ${table} VALIDATE CONSTRAINT ${check};\nALTER TABLE ${table} ALTER COLUMN ${name} SET NOT NULL;`) })
        }
      }
    }
    return step
  })
  // Only a lock_timeout set before the first locking step protects it; one in a comment or at the end does nothing.
  const locking = steps.find((step) => step.lock !== "none")
  const guarded = locking && statements.slice(0, locking.index).some(({ code }) => /^SET (SESSION |LOCAL )?lock_timeout\b/i.test(code))
  if (locking && !guarded) locking.risks.unshift({ kind: "lock-timeout", severity: "warning", fix: `SET lock_timeout = '5s';\n${locking.sql}` })
  return steps
}

/** Replaces one step's statement in the source, keeping everything around it. */
export function replaceStep(sql: string, step: Pick<MigrationStep, "start" | "end">, replacement: string) {
  const body = replacement.replace(/;\s*$/, "")
  return sql.slice(0, step.start) + body + sql.slice(step.end)
}
