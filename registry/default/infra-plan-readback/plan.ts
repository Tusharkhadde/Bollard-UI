/** What a resource change does, read from `change.actions` in `terraform show -json` / `tofu show -json`. */
export type PlanAction = "create" | "update" | "replace" | "destroy"

export interface PlanChange {
  address: string
  type: string
  action: PlanAction
  /** For replace: "create-first" (create_before_destroy) or "destroy-first", the default that leaves a gap. */
  order?: "create-first" | "destroy-first"
  /** Holds data that a destroy or replace throws away (databases, buckets, volumes, keys…). */
  stateful: boolean
  /** Attribute paths that force the replacement, from `replace_paths`, with before → after where they're not sensitive. */
  forcedBy: { path: string; before?: string; after?: string }[]
  /** Plain reason from `action_reason`. */
  reason?: string
  /** Extra consequences read from the before-state (force_destroy, skip_final_snapshot, deletion_protection). */
  notes: string[]
  importing: boolean
  movedFrom?: string
  /** Set when the change is to a deposed object (an older copy left by create_before_destroy), not the current one. */
  deposed?: string
}

export interface PlanReadback {
  ok: boolean
  /** Why the plan couldn't be read. */
  error?: string
  changes: PlanChange[]
  counts: Record<PlanAction, number> & { import: number; moved: number }
  /** True when `errored` is set or `applyable` is false. */
  notApplyable: boolean
  /** var.environment / var.env / var.stage when the plan carries one. */
  environmentVar?: { name: string; value: string }
}

/** Resource types whose destroy loses data. Extend with `statefulTypes`. */
export const STATEFUL_TYPES = [
  "aws_db_instance", "aws_rds_cluster", "aws_docdb_cluster", "aws_neptune_cluster", "aws_redshift_cluster", "aws_dynamodb_table",
  "aws_s3_bucket", "aws_ebs_volume", "aws_efs_file_system", "aws_fsx_lustre_file_system", "aws_elasticache_cluster",
  "aws_elasticache_replication_group", "aws_memorydb_cluster", "aws_opensearch_domain", "aws_elasticsearch_domain",
  "aws_kinesis_stream", "aws_sqs_queue", "aws_kms_key", "aws_secretsmanager_secret", "aws_backup_vault", "aws_ecr_repository",
  "google_sql_database_instance", "google_sql_database", "google_storage_bucket", "google_compute_disk", "google_bigquery_dataset",
  "google_bigquery_table", "google_spanner_instance", "google_spanner_database", "google_filestore_instance", "google_redis_instance",
  "google_kms_crypto_key", "google_firestore_database", "google_bigtable_instance",
  "azurerm_storage_account", "azurerm_storage_container", "azurerm_mssql_database", "azurerm_mssql_server", "azurerm_postgresql_flexible_server",
  "azurerm_mysql_flexible_server", "azurerm_cosmosdb_account", "azurerm_managed_disk", "azurerm_key_vault", "azurerm_redis_cache",
  "kubernetes_persistent_volume_claim", "kubernetes_persistent_volume", "kubernetes_persistent_volume_claim_v1", "kubernetes_persistent_volume_v1",
  "digitalocean_database_cluster", "digitalocean_volume", "digitalocean_spaces_bucket", "cloudflare_r2_bucket", "cloudflare_d1_database",
]

const REASONS: Record<string, string> = {
  replace_because_tainted: "Marked tainted, so Terraform replaces it.",
  replace_because_cannot_update: "A changed attribute can't be updated in place.",
  replace_by_request: "Replaced because -replace asked for it.",
  delete_because_no_resource_config: "Removed from the configuration.",
  delete_because_no_module: "Its module is no longer in the configuration.",
  delete_because_wrong_repetition: "Its key doesn't fit the resource's count/for_each.",
  delete_because_count_index: "count was lowered below this index.",
  delete_because_each_key: "This key is no longer in for_each.",
  replace_by_triggers: "A resource in its replace_triggered_by changed.",
}

const record = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {})

const at = (value: unknown, path: (string | number)[]) =>
  path.reduce<unknown>((cur, key) => (cur && typeof cur === "object" ? (cur as Record<string | number, unknown>)[key] : undefined), value)

/** True when the path, or any block above it, is marked in a `*_sensitive` / `after_unknown` tree. */
const marked = (tree: unknown, path: (string | number)[]) => {
  let cur = tree
  for (const key of [undefined, ...path]) {
    if (key !== undefined) cur = cur && typeof cur === "object" ? (cur as Record<string | number, unknown>)[key] : undefined
    if (cur === true) return true
  }
  return false
}

const show = (v: unknown) => {
  if (v === undefined) return undefined
  const text = typeof v === "string" ? v : JSON.stringify(v)
  return text.length > 60 ? `${text.slice(0, 57)}…` : text
}

/** Maps an `actions` array to one action. Anything with "delete" in it is treated as a delete, as the JSON docs advise. */
export function actionOf(actions: unknown): { action?: PlanAction; order?: PlanChange["order"] } {
  const list = Array.isArray(actions) ? actions.filter((a): a is string => typeof a === "string") : []
  const del = list.indexOf("delete")
  const create = list.indexOf("create")
  if (del >= 0 && create >= 0) return { action: "replace", order: create < del ? "create-first" : "destroy-first" }
  if (del >= 0) return { action: "destroy" }
  if (create >= 0) return { action: "create" }
  if (list.includes("update")) return { action: "update" }
  return {}
}

/** Reads a `terraform show -json` (or OpenTofu) plan. Accepts the parsed object or its text, with a BOM or CRLF. */
export function readPlan(input: unknown, options: { statefulTypes?: string[]; isStateful?: (type: string) => boolean } = {}): PlanReadback {
  const counts = { create: 0, update: 0, replace: 0, destroy: 0, import: 0, moved: 0 }
  const empty = (error: string): PlanReadback => ({ ok: false, error, changes: [], counts, notApplyable: true })
  let plan: Record<string, unknown>
  try {
    plan = record(typeof input === "string" ? JSON.parse(input.replace(/^\uFEFF/, "")) : input)
  } catch {
    return empty("This isn't valid JSON. Use the output of terraform show -json <planfile>.")
  }
  const version = String(plan.format_version ?? "")
  if (!Array.isArray(plan.resource_changes)) return empty("No resource_changes found. Use terraform show -json on a saved plan file.")
  if (version && !/^1\./.test(version)) return empty(`Plan format ${version} isn't supported (expected 1.x).`)

  const stateful = new Set([...STATEFUL_TYPES, ...(options.statefulTypes ?? [])])
  const changes: PlanChange[] = []
  for (const raw of plan.resource_changes) {
    const rc = record(raw)
    if (rc.mode === "data") continue
    const change = record(rc.change)
    const { action, order } = actionOf(change.actions)
    const importing = !!change.importing
    if (importing) counts.import++
    if (typeof rc.previous_address === "string") counts.moved++
    if (!action) continue
    counts[action]++
    const type = typeof rc.type === "string" ? rc.type : String(rc.address ?? "").split(".").slice(-2, -1)[0] ?? ""
    const before = change.before
    const beforeSensitive = change.before_sensitive
    const afterSensitive = change.after_sensitive
    const paths = Array.isArray(change.replace_paths) ? change.replace_paths.filter(Array.isArray) : []
    const forcedBy = action === "replace"
      ? paths.map((p) => {
          const path = p as (string | number)[]
          // Plan JSON carries sensitive values in clear; a marker on any parent block hides everything under it.
          const hidden = marked(beforeSensitive, path) || marked(afterSensitive, path)
          const unknown = marked(change.after_unknown, path)
          return {
            path: path.map((s, i) => (typeof s === "number" ? `[${s}]` : i ? `.${s}` : s)).join(""),
            before: hidden ? "(sensitive)" : show(at(before, path)),
            after: hidden ? "(sensitive)" : unknown ? undefined : show(at(change.after, path)),
          }
        })
      : []
    const notes: string[] = []
    const b = record(before)
    if (action === "destroy" || action === "replace") {
      if (b.force_destroy === true) notes.push("force_destroy is on: every object inside is deleted with it.")
      if (b.skip_final_snapshot === true) notes.push("skip_final_snapshot is on: no snapshot is taken before it goes.")
      if (b.deletion_protection === true) notes.push("deletion_protection is on, so the apply fails partway, possibly after other changes have already run.")
    }
    changes.push({
      address: String(rc.address ?? type),
      type,
      action,
      order,
      stateful: (options.isStateful?.(type) ?? stateful.has(type)),
      forcedBy,
      reason: typeof rc.action_reason === "string" ? REASONS[rc.action_reason] : undefined,
      notes,
      importing,
      movedFrom: typeof rc.previous_address === "string" ? rc.previous_address : undefined,
      deposed: typeof rc.deposed === "string" ? rc.deposed : undefined,
    })
  }

  const rank = (c: PlanChange) => (c.action === "destroy" || c.action === "replace" ? (c.stateful ? 0 : 1) : c.action === "update" ? 2 : 3)
  changes.sort((a, b) => rank(a) - rank(b))
  const vars = record(plan.variables)
  const envName = ["environment", "env", "stage", "environment_name"].find((n) => typeof record(vars[n]).value === "string")
  return {
    ok: true,
    changes,
    counts,
    notApplyable: plan.errored === true || plan.applyable === false,
    environmentVar: envName ? { name: envName, value: String(record(vars[envName]).value) } : undefined,
  }
}

/** True for names like "prod", "eu-prod-2", "production", "live"; false for "nonprod", "pre-prod" and "preprod". */
export function isProductionName(name: string) {
  const words = String(name ?? "").toLowerCase().split(/[^a-z0-9]+/).filter(Boolean)
  return words.some((w, i) => /^(prod|prd|production|live)\d*$/.test(w) && !/^(pre|non|not)$/.test(words[i - 1] ?? ""))
}
