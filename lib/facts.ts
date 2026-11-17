import { catalog, categories, type CatalogEntry } from "./catalog"
import { FLOWS } from "./kits"

export const CANONICAL_TOTAL_COMPONENTS = 341
export const CANONICAL_TOTAL_CATEGORIES = 11
export const CANONICAL_TOTAL_FLOWS = 9
export const CANONICAL_VERSION = "0.1.0"
export const CANONICAL_LICENSE = "MIT License (free, commercial-friendly)"
export const CANONICAL_PRICE = "$0 (100% Free and Open Source)"
export const CANONICAL_REQUIREMENTS = "React 19+, Tailwind CSS v4, shadcn CLI"
export const CANONICAL_SSR_SUPPORT =
  "Fully compatible (SSR & Server Components safe, client-hydrated controls)"
export const CANONICAL_CORE_LIMITATION =
  "Client-side guardrails catch honest mistakes in the browser; they do not replace server-side validation, database constraints, or backend authorization."

export type FactRow = {
  property: string
  value: string
  note?: string
}

/** Validates that catalog counts match canonical numbers. Fails build if counts diverge. */
export function assertFactsConsistency(): void {
  if (catalog.length !== CANONICAL_TOTAL_COMPONENTS) {
    throw new Error(
      `Facts consistency error: catalog length (${catalog.length}) does not match CANONICAL_TOTAL_COMPONENTS (${CANONICAL_TOTAL_COMPONENTS}).`,
    )
  }
  if (categories.length !== CANONICAL_TOTAL_CATEGORIES) {
    throw new Error(
      `Facts consistency error: categories length (${categories.length}) does not match CANONICAL_TOTAL_CATEGORIES (${CANONICAL_TOTAL_CATEGORIES}).`,
    )
  }
  if (FLOWS.length !== CANONICAL_TOTAL_FLOWS) {
    throw new Error(
      `Facts consistency error: flows length (${FLOWS.length}) does not match CANONICAL_TOTAL_FLOWS (${CANONICAL_TOTAL_FLOWS}).`,
    )
  }
}

/** Generates canonical facts for the Homepage. */
export function getSiteFacts(): FactRow[] {
  return [
    { property: "Component count", value: `${CANONICAL_TOTAL_COMPONENTS} copy-paste components` },
    { property: "Categories & Flows", value: `${CANONICAL_TOTAL_CATEGORIES} categories across ${CANONICAL_TOTAL_FLOWS} application flows` },
    { property: "License", value: CANONICAL_LICENSE },
    { property: "Price", value: CANONICAL_PRICE },
    { property: "Architecture", value: "Copy-paste into your repository via shadcn CLI (zero node_modules bloat)" },
    { property: "Software requirements", value: CANONICAL_REQUIREMENTS },
    { property: "SSR / Next.js support", value: CANONICAL_SSR_SUPPORT },
    { property: "Default install command", value: "npx shadcn@4.21.0 add @bollard/<component>" },
    { property: "Core limitation", value: CANONICAL_CORE_LIMITATION },
  ]
}

/** Generates canonical facts for /docs. */
export function getDocsFacts(): FactRow[] {
  return [
    { property: "Distribution model", value: "shadcn registry (source code copied directly to your app)" },
    { property: "Pinned shadcn CLI", value: "npx shadcn@4.21.0 add @bollard/<name>" },
    { property: "Current version", value: CANONICAL_VERSION },
    { property: "React support", value: "React 19+ (React 18 supported via standard JSX)" },
    { property: "Styling engine", value: "Tailwind CSS v4 (shadcn color tokens & CSS variables)" },
    { property: "SSR & Server Components", value: CANONICAL_SSR_SUPPORT },
    { property: "License", value: CANONICAL_LICENSE },
    { property: "Primary limitation", value: CANONICAL_CORE_LIMITATION },
  ]
}

/** Generates canonical facts for a specific component page. */
export function getComponentFacts(item: CatalogEntry, lastUpdated: string): FactRow[] {
  const deps = item.dependencies.length > 0 ? item.dependencies.join(", ") : "0 runtime dependencies"
  const a11y = item.hasA11yGuidance
    ? "WAI-ARIA compliant, keyboard navigability and screen-reader announcements verified"
    : "Standard accessible HTML controls and ARIA attributes"

  return [
    { property: "Component name", value: item.title },
    { property: "Registry identifier", value: `@bollard/${item.name}` },
    { property: "Install command", value: `npx shadcn@4.21.0 add @bollard/${item.name}` },
    { property: "License", value: CANONICAL_LICENSE },
    { property: "Price", value: CANONICAL_PRICE },
    { property: "Version", value: CANONICAL_VERSION },
    { property: "Requirements", value: CANONICAL_REQUIREMENTS },
    { property: "SSR support", value: CANONICAL_SSR_SUPPORT },
    { property: "Dependencies", value: deps },
    { property: "Accessibility", value: a11y },
    { property: "Last updated", value: lastUpdated },
    { property: "Scope limitation", value: CANONICAL_CORE_LIMITATION },
  ]
}
