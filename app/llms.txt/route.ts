import { catalog } from "@/lib/catalog"
import { GUIDES } from "@/lib/guides"
import { SITE_URL } from "@/lib/site"

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
    "",
    "## Install",
    "Use `npx shadcn@latest add @bollard/<component>`. The command copies source files into the user's project; URL installs at /r/<component>.json remain supported.",
    "",
    "## High-intent guides",
    ...GUIDES.map((guide) => `- [${guide.title}](${SITE_URL}/guides/${guide.slug}): install \`${guide.installCommand}\`.`),
    "",
    "## Essential components",
    ...essential.map((item) => `- [${item.title}](${SITE_URL}/components/${item.name}): ${item.summary ?? item.description}`),
    "",
    "## Registry",
    `- [Registry index](${SITE_URL}/r/registry.json)`,
    `- [Sitemap](${SITE_URL}/sitemap.xml)`,
  ].join("\n")
  return new Response(text, { headers: { "content-type": "text/plain; charset=utf-8" } })
}
