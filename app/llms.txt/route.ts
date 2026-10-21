import { catalog, readProps } from "@/lib/catalog"
import { GUIDES } from "@/lib/guides"
import { REPO_URL, SITE_URL } from "@/lib/site"

export const revalidate = 3600

/** A compact, generated map for coding agents and other documentation consumers. */
export function GET() {
  const essential = catalog.filter((item) => item.essential).slice(0, 15)
  const text = [
    "# Bollard UI",
    "",
    "> Copy-paste React guardrails for mistakes in forms and critical actions. Styled components use shadcn tokens; useBollardField is headless for any React control.",
    "",
    "## Getting started",
    `- [Setup](${SITE_URL}/docs): prerequisites, CLI installation, manual installation, and updates.`,
    `- [Component catalog](${SITE_URL}/components): search by problem, flow, field, integration, or dependency.`,
    `- [Guides](${SITE_URL}/guides): implementation pages for common React form and action problems.`,
    `- [TypeScript compatibility](${REPO_URL}/blob/main/docs/registry-compatibility.md): ES2020 notes for BigInt-based items.`,
    "",
    "## Install",
    "Use `npx shadcn@4.21.0 add @bollard/<component>`. The command copies source files into the user's project; URL installs at /r/<component>.json remain supported.",
    "",
    "## High-intent guides",
    ...GUIDES.map((guide) => `- [${guide.title}](${SITE_URL}/guides/${guide.slug}): install \`${guide.installCommand}\`.`),
    "",
    "## Essential components",
    ...essential.map((item) => `- [${item.title}](${SITE_URL}/components/${item.name}): ${item.summary ?? item.description}`),
    "",
    "## Component index",
    ...catalog.map((item) => {
      const props = readProps(item.name)?.props ?? []
      const propText = props.length ? ` Props: ${props.map((prop) => `\`${prop.name}${prop.required ? " (required)" : ""}\``).join(", ")}.` : ""
      const deps = item.dependencies.length ? ` Runtime dependencies: ${item.dependencies.join(", ")}.` : " Zero runtime dependencies."
      return `- [${item.name}](${SITE_URL}/components/${item.name}) — ${item.category}; ${item.summary ?? item.description} Install: \`npx shadcn@4.21.0 add @bollard/${item.name}\`.${deps}${propText}`
    }),
    "",
    "## Registry",
    `- [Registry index](${SITE_URL}/r/registry.json)`,
    `- [Sitemap](${SITE_URL}/sitemap.xml)`,
  ].join("\n")
  return new Response(text, { headers: { "content-type": "text/plain; charset=utf-8" } })
}
