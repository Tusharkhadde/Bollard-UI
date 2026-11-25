import { catalog, readProps } from "@/lib/catalog"
import { GUIDES } from "@/lib/guides"
import { REPO_URL, SITE_URL } from "@/lib/site"

export const revalidate = 3600

const STANDALONE_GUIDES = [
  {
    title: "Prevent Duplicate Form Submissions in React",
    path: "/guides/react-prevent-duplicate-form-submit",
    install: "npx shadcn@4.21.0 add @bollard/safe-submit",
  },
  {
    title: "React Form Validation for India: Aadhaar, IFSC, UPI & PIN codes",
    path: "/guides/react-india-form-validation",
    install: "npx shadcn@4.21.0 add @bollard/aadhaar-input",
  },
  {
    title: "React Type to Confirm Dialogs for Destructive Actions",
    path: "/guides/react-type-to-confirm-dialog",
    install: "npx shadcn@4.21.0 add @bollard/type-to-confirm",
  },
  {
    title: "Email Typo Detection in React: Suggest, Don't Edit",
    path: "/guides/react-email-typo-detection",
    install: "npx shadcn@4.21.0 add @bollard/email-input",
  },
  {
    title: "Human in the Loop AI Agent Approvals in React",
    path: "/guides/human-in-the-loop-ai-agent-approvals",
    install: "npx shadcn@4.21.0 add @bollard/agent-action-approve",
  },
  {
    title: "Bollard UI vs Zod Validation: Complementary Guardrails",
    path: "/guides/bollard-ui-vs-zod-validation",
    install: "npx shadcn@4.21.0 add @bollard/amount-input",
  },
  {
    title: "Bollard UI vs React Hook Form: A Complementary Pair",
    path: "/guides/bollard-ui-vs-react-hook-form",
    install: "npx shadcn@4.21.0 add @bollard/use-bollard-field",
  },
  {
    title: "Bollard UI vs Modal Confirm Dialogs",
    path: "/guides/bollard-ui-vs-confirm-dialogs",
    install: "npx shadcn@4.21.0 add @bollard/hold-to-confirm",
  },
]

/** A compact, generated map for coding agents and other documentation consumers. */
export function GET() {
  const essential = catalog.filter((item) => item.essential).slice(0, 15)
  const text = [
    "# Bollard UI",
    "",
    "> Copy-paste React guardrails for mistakes in forms and critical actions. Built for React 19, Tailwind CSS v4, and shadcn CLI installation.",
    "",
    "## Getting started",
    `- [Setup](${SITE_URL}/docs): prerequisites, CLI installation, manual installation, and updates.`,
    `- [About Bollard UI](${SITE_URL}/about): creator, philosophy, and architectural boundaries.`,
    `- [Component catalog](${SITE_URL}/components): search 341 components by problem, flow, field, or integration.`,
    `- [Flow Hubs](${SITE_URL}/flows): grouped by user journey (checkout, onboarding, settings, destructive, AI).`,
    `- [Guides](${SITE_URL}/guides): in-depth technical guides for form safety patterns.`,
    `- [TypeScript compatibility](${REPO_URL}/blob/main/docs/registry-compatibility.md): ES2020 notes for BigInt-based items.`,
    "",
    "## Install",
    "Use `npx shadcn@4.21.0 add @bollard/<component>`. The command copies source files into the user's project; URL installs at /r/<component>.json remain supported.",
    "",
    "## Common questions",
    "- What is Bollard UI? An open-source registry of 341 copy-paste React components for preventing mistakes in forms and critical actions, plus a headless validation hook for existing controls.",
    "- Does it require shadcn/ui components? No. Styled components use a shadcn setup and Tailwind v4 tokens; the headless hook works with any React controls.",
    "- Which versions does it target? React 19+, Tailwind CSS v4, and shadcn CLI installation. See the setup guide for framework-specific details.",
    "- Can I edit installed components? Yes. The CLI copies source into the app, so the installed code can be changed locally.",
    "- What does the UI guarantee? It helps prevent accidental human mistakes; validate permissions, business rules and sensitive operations on the server.",
    "",
    "## Topic Guides & Comparisons",
    ...STANDALONE_GUIDES.map(
      (g) => `- [${g.title}](${SITE_URL}${g.path}): Install \`${g.install}\`.`,
    ),
    ...GUIDES.map(
      (guide) => `- [${guide.title}](${SITE_URL}/guides/${guide.slug}): Install \`${guide.installCommand}\`.`,
    ),
    "",
    "## Essential components",
    ...essential.map(
      (item) =>
        `- [${item.title}](${SITE_URL}/components/${item.name}) ([Markdown doc](${SITE_URL}/components/${item.name}.md)): ${item.summary ?? item.description}`,
    ),
    "",
    "## Component index (Markdown docs available for all components at /components/<name>.md)",
    ...catalog.map((item) => {
      const props = readProps(item.name)?.props ?? []
      const propText = props.length
        ? ` Props: ${props.map((prop) => `\`${prop.name}${prop.required ? " (required)" : ""}\``).join(", ")}.`
        : ""
      const deps = item.dependencies.length
        ? ` Runtime dependencies: ${item.dependencies.join(", ")}.`
        : " Zero runtime dependencies."
      return `- [${item.name}](${SITE_URL}/components/${item.name}.md) — ${item.category}; ${item.summary ?? item.description} Install: \`npx shadcn@4.21.0 add @bollard/${item.name}\`.${deps}${propText}`
    }),
    "",
    "## Registry & Sitemaps",
    `- [Registry index](${SITE_URL}/r/registry.json)`,
    `- [Sitemap](${SITE_URL}/sitemap.xml)`,
  ].join("\n")

  return new Response(text, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400",
    },
  })
}
