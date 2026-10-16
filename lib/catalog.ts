// Server-only view of the registry: names, titles, categories, dependencies and
// the discovery fields (stops, mistakes, aliases, flows, fields), read from
// registry.json so no page has to import every demo to list them.
import fs from "node:fs"
import path from "node:path"

import registry from "@/registry.json"
import { ESSENTIALS, FIELD_IDS, FLOW_IDS, KITS } from "@/lib/kits"
import { GITHUB_URL, SITE_URL } from "@/lib/site"
import type { SearchItem } from "@/lib/search"

/** What the client gets per component: enough to search, filter and draw a card. */
export type CatalogItem = SearchItem

export interface CatalogEntry extends SearchItem {
  files: string[]
  dependencies: string[]
  registryDependencies: string[]
}

interface RegistryItem {
  name: string
  title: string
  description: string
  categories?: string[]
  files: { path: string }[]
  dependencies?: string[]
  registryDependencies?: string[]
  meta?: { stops?: unknown; mistakes?: unknown; aliases?: unknown; flows?: unknown; fields?: unknown }
}

const list = (value: unknown) => (Array.isArray(value) ? value.filter((v): v is string => typeof v === "string" && v.length > 0) : undefined)

/** "Prevents paying ten times too much by …" → "Paying ten times too much". Used until a component has its own `stops` line. */
export function headlineFrom(description: string) {
  let text = description.replace(/^(prevents|stops|catches|guards against|avoids|flags|enforces)\s+/i, "")
  text = text.split(/\s+by\s+|:\s|;\s|\s+—\s+|\.\s/)[0]
  text = text.replace(/\s*\([^)]*\)/g, "").trim()
  if (text.length > 64) text = text.slice(0, 62).replace(/\s+\S*$/, "") + "…"
  return text.charAt(0).toUpperCase() + text.slice(1)
}

/** Field types guessed from the component name, only for components not tagged yet. */
const FIELD_GUESS: [RegExp, string][] = [
  [/email/, "email"],
  [/phone|sms|callback/, "phone"],
  [/amount|salary|price|tip|refund|emi|ctc|tax-inclusive|charge|payment|split/, "amount"],
  [/date|time|dob|epoch|duration|timezone|deadline|schedule|cutoff|stay-length|recurrence/, "datetime"],
  [/secret|key|env|jwt|ssh|cert|password|otp|token/, "secret"],
  [/file|upload|attachment|import|photo|image/, "file"],
  [/aadhaar|tax-id|ifsc|mrz|passport|invoice-number|checksum|upi-id|pincode|gst/, "id-number"],
  [/url|link|redirect|webhook|utm|cors|embed/, "url"],
  [/json|yaml|regex|sql|dockerfile|csp|glob|cron|markdown|iam|workflow/, "code"],
  [/address|coordinate|pin-drop/, "address"],
  [/name/, "name"],
]
const guessFields = (name: string) => [...new Set(FIELD_GUESS.filter(([re]) => re.test(name)).map(([, field]) => field))].slice(0, 2)

function discovery(item: RegistryItem) {
  const meta = item.meta ?? {}
  const stops = typeof meta.stops === "string" && meta.stops.trim() ? meta.stops.trim() : undefined
  const tagged = list(meta.flows)?.filter((f) => FLOW_IDS.includes(f))
  const kitFlows: string[] = KITS.filter((kit) => kit.components.includes(item.name)).map((kit) => kit.flow)
  const flows = tagged?.length ? tagged : kitFlows
  const fields = list(meta.fields)?.filter((f) => FIELD_IDS.includes(f)) ?? guessFields(item.name)
  return {
    headline: stops ?? headlineFrom(item.description),
    stops,
    mistakes: list(meta.mistakes) ?? [],
    aliases: list(meta.aliases) ?? [],
    flows,
    fields,
    essential: ESSENTIALS.includes(item.name),
  }
}

export const catalog: CatalogEntry[] = (registry.items as RegistryItem[])
  .filter((item) => fs.existsSync(path.join(process.cwd(), "components", "demos", `${item.name}.tsx`)))
  .map((item) => ({
    name: item.name,
    title: item.title,
    description: item.description,
    category: item.categories?.[0] ?? "More",
    files: item.files.map((file) => file.path),
    dependencies: item.dependencies ?? [],
    registryDependencies: item.registryDependencies ?? [],
    ...discovery(item),
  }))

/** The slim list the client needs for the sidebar, the finder and search. */
export const catalogItems: CatalogItem[] = catalog.map(
  ({ name, title, description, category, headline, stops, mistakes, aliases, flows, fields, essential }) => ({
    name,
    title,
    description,
    category,
    headline,
    ...(stops ? { stops } : {}),
    mistakes,
    aliases,
    flows,
    fields,
    ...(essential ? { essential } : {}),
  }),
)

export const categories = Array.from(new Set(catalog.map((item) => item.category))).map((name) => {
  const items = catalog.filter((item) => item.category === name)
  return { name, slug: slugify(name), count: items.length, first: items[0].name }
})

export function slugify(text: string) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
}

/** Reads a registry file such as "registry/default/copy-confirm/copy-confirm.tsx" at build time. */
export function readSource(file: string) {
  const [, , name, base] = file.split("/")
  return fs.readFileSync(path.join(process.cwd(), "registry", "default", name, base), "utf8")
}

/** Reads a demo file (components/demos/<name>.tsx), or null when there isn't one. */
export function readDemo(name: string) {
  const file = path.join(process.cwd(), "components", "demos", `${name}.tsx`)
  return fs.existsSync(file) ? fs.readFileSync(file, "utf8") : null
}

export { GITHUB_URL, SITE_URL }

export const registryBase = `${SITE_URL}/r/`
export const installCommand = (name: string) => `npx shadcn@latest add ${registryBase}${name}.json`
