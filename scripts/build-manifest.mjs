import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const status = (condition, details, verified = condition, reason) => ({
  status: reason ? "not-applicable" : condition ? "present" : "missing",
  ...(details ? { details } : {}),
  ...(reason ? { reason } : {}),
  verified,
})

const tracked = (meta, field, condition, details, verified = condition) =>
  status(condition, details, verified, meta.notApplicable?.[field])

export function buildManifest(base = root) {
  const registry = JSON.parse(fs.readFileSync(path.join(base, "registry.json"), "utf8"))
  const props = JSON.parse(fs.readFileSync(path.join(base, "lib/props.json"), "utf8"))
  const docsPageExists = fs.existsSync(path.join(base, "app/(site)/components/[name]/page.tsx"))
  const components = registry.items.map((item) => {
    const meta = item.meta ?? {}
    const demoPath = path.join(base, "components/demos", `${item.name}.tsx`)
    const componentProps = props[item.name]
    const sourceFiles = (item.files ?? []).map((file) => file.path)
    const rules = meta.rules ?? {}
    const researchAudit = meta.researchAudit ?? {}
    const rulesVerified = researchAudit.primarySourceConfirmed === true && typeof researchAudit.verified === "string" && Array.isArray(researchAudit.sources) && researchAudit.sources.length > 0
    const tests = fs.existsSync(path.join(base, "tests", `${item.name}.test.mjs`))
    const fields = {
      name: tracked(meta, "name", typeof item.name === "string" && !!item.name, "Registry item identifier."),
      category: tracked(meta, "category", Array.isArray(item.categories) && item.categories.length > 0, item.categories?.join(", ") ?? ""),
      flows: tracked(meta, "flows", Array.isArray(meta.flows), Array.isArray(meta.flows) ? meta.flows.join(", ") || "Explicitly tagged as no flow." : "Add flow tags to metadata."),
      registryDependencies: tracked(meta, "registryDependencies", Array.isArray(item.registryDependencies) || item.registryDependencies === undefined, (item.registryDependencies ?? []).join(", ") || "No other Bollard registry items required."),
      docsPage: tracked(meta, "docsPage", docsPageExists, "Rendered by the shared dynamic component-doc route."),
      mistakeLine: tracked(meta, "mistakeLine", typeof meta.stops === "string" && meta.stops.trim().length > 0, meta.stops ?? "Add a one-line mistake/outcome."),
      installCommand: tracked(meta, "installCommand", sourceFiles.length > 0, `npx shadcn@latest add ${registry.homepage}/r/${item.name}.json`, false),
      usageExample: tracked(meta, "usageExample", fs.existsSync(demoPath), fs.existsSync(demoPath) ? `components/demos/${item.name}.tsx` : "Add a minimal runnable example."),
      exampleRuns: tracked(meta, "exampleRuns", meta.exampleRunsVerified === true, "Must be confirmed by the example typecheck or clean-install fixture."),
      propsTable: tracked(meta, "propsTable", Array.isArray(componentProps?.props) && componentProps.props.length > 0, componentProps?.props?.length ? `${componentProps.props.length} source-extracted props.` : "No extracted public props table."),
      reactHookFormZodExample: tracked(meta, "reactHookFormZodExample", typeof meta.reactHookFormZodExample === "string" && meta.reactHookFormZodExample.trim().length > 0, "Add a copy-paste RHF + Zod example or an explicit not-applicable reason."),
      customControlExample: item.type === "registry:hook"
        ? tracked(meta, "customControlExample", typeof meta.customControlExample === "string" && meta.customControlExample.trim().length > 0, "Headless hook requires an example wired to a consumer-owned control.")
        : status(false, "Custom-control integration example is specific to headless hook items.", false, "Only required for registry:hook entries."),
      a11yNotes: tracked(meta, "a11yNotes", Array.isArray(meta.a11y) && meta.a11y.length > 0, `${meta.a11y?.length ?? 0} accessibility notes in registry metadata.`),
      whenNotToUse: tracked(meta, "whenNotToUse", typeof meta.whenNotToUse === "string" && meta.whenNotToUse.trim().length > 0, "Add a clear non-fit / limitation section; generic limits alone do not satisfy this field."),
      serverSideRule: tracked(meta, "serverSideRule", typeof meta.server === "string" && meta.server.trim().length > 0, meta.server ?? "Add the matching server-side rule."),
      serverSideFunction: tracked(meta, "serverSideFunction", typeof meta.serverFunction === "string" && meta.serverFunction.trim().length > 0, "Add/export a pure framework-free function or mark not applicable with a reason."),
      tests: tracked(meta, "tests", tests, tests ? `Existing test file: tests/${item.name}.test.mjs` : "No dedicated test file for this registry item."),
      baselineTests: tracked(meta, "baselineTests", meta.baselineTestsVerified === true, "Requires verified renders, invalid input safety, rejected-handler value retention, double-submit blocking, and keyboard coverage."),
      version: tracked(meta, "version", typeof meta.version === "string" && meta.version.trim().length > 0, meta.version ?? "Add a registry-item version."),
      changelogNote: tracked(meta, "changelogNote", typeof meta.changelog === "string" && meta.changelog.trim().length > 0, "Add a short item-level change note."),
      sourcesLine: tracked(meta, "sourcesLine", Array.isArray(rules.sources) && rules.sources.length > 0, "Add the relevant source link to the component documentation."),
      researched: tracked(meta, "researched", Array.isArray(researchAudit.sources) && researchAudit.sources.length > 0, "Map dated extracted sources to this component; existing meta.rules links are not independently audited by this script."),
      ruleVerified: tracked(meta, "ruleVerified", rulesVerified, "No per-component primary-source audit recorded for this run."),
    }
    const requiredDocs = ["mistakeLine", "installCommand", "usageExample", "propsTable", "reactHookFormZodExample", "a11yNotes", "whenNotToUse", "serverSideRule", "serverSideFunction", "sourcesLine", "version", "changelogNote"]
    fields.docsComplete = status(requiredDocs.every((field) => fields[field].status !== "missing"), "Computed from required per-component documentation fields.")
    for (const [field, value] of Object.entries(fields)) {
      if (value.status === "not-applicable") {
        if (!value.reason) throw new Error(`${item.name}.${field}: not-applicable requires a reason`)
      }
    }
    return {
      name: item.name,
      category: item.categories?.[0] ?? "",
      flows: meta.flows ?? [],
      registryDependencies: item.registryDependencies ?? [],
      files: sourceFiles,
      fields,
    }
  })

  const totals = {}
  for (const field of Object.keys(components[0]?.fields ?? {})) {
    totals[field] = { present: 0, missing: 0, notApplicable: 0 }
    for (const component of components) {
      const value = component.fields[field].status
      totals[field][value === "not-applicable" ? "notApplicable" : value]++
    }
  }
  return { schemaVersion: 1, source: "registry.json + registry item metadata + generated props", components, totals }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const manifest = buildManifest()
  fs.writeFileSync(path.join(root, "components.manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`)
  console.log(`${manifest.components.length} components inventoried`)
  for (const [field, total] of Object.entries(manifest.totals)) {
    console.log(`${field}: ${total.present} present, ${total.missing} missing, ${total.notApplicable} not applicable`)
  }
}
