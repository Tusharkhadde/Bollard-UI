import { notFound } from "next/navigation"

import { catalog, readDemo, readProps } from "@/lib/catalog"
import { SITE_URL } from "@/lib/site"

export const revalidate = 3600

export async function GET(
  _request: Request,
  context: { params: Promise<{ name: string }> },
) {
  const { name } = await context.params
  const item = catalog.find((c) => c.name === name)

  if (!item) {
    notFound()
  }

  const propsDoc = readProps(item.name)
  const demoCode = readDemo(item.name)

  const propsTable =
    propsDoc?.props && propsDoc.props.length > 0
      ? [
          "| Prop | Type | Required | Description |",
          "| :--- | :--- | :--- | :--- |",
          ...propsDoc.props.map(
            (p) =>
              `| \`${p.name}\` | \`${p.type.replace(/\|/g, "\\|")}\` | ${p.required ? "Yes" : "No"} | ${p.description || "—"} |`,
          ),
        ].join("\n")
      : "Standard HTML attributes and custom callbacks."

  const markdown = [
    `# ${item.title}`,
    "",
    `> ${item.stops ?? item.description}`,
    "",
    `${item.title} is a copy-paste React component from Bollard UI that stops user mistakes in forms and risky actions before submission.`,
    "",
    "## Installation",
    "",
    "```bash",
    `npx shadcn@4.21.0 add @bollard/${item.name}`,
    "```",
    "",
    "## Metadata",
    `- **Component:** \`${item.name}\``,
    `- **Category:** ${item.category}`,
    `- **Mistake prevented:** ${item.stops ?? item.description}`,
    `- **License:** MIT`,
    `- **Dependencies:** ${item.dependencies.length > 0 ? item.dependencies.map((d) => `\`${d}\``).join(", ") : "None (zero external dependencies)"}`,
    `- **Documentation URL:** ${SITE_URL}/components/${item.name}`,
    "",
    "## Props API",
    "",
    propsTable,
    "",
    demoCode
      ? [
          "## Example Usage",
          "",
          "```tsx",
          demoCode.trim(),
          "```",
        ].join("\n")
      : "",
    "",
    "## Security and Server Boundaries",
    "Bollard UI components provide accessible, immediate guardrails in the browser. They do not replace server-side validation, database constraints, CSRF protection, or authorization. Always validate submitted data on the server.",
    "",
    "## Related Components",
    ...catalog
      .filter((c) => c.name !== item.name && c.category === item.category)
      .slice(0, 5)
      .map((c) => `- [${c.title}](${SITE_URL}/components/${c.name}.md): ${c.stops ?? c.description}`),
  ]
    .filter(Boolean)
    .join("\n")

  return new Response(markdown, {
    headers: {
      "content-type": "text/markdown; charset=utf-8",
      "cache-control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400",
    },
  })
}
