import { DocsFrame } from "@/components/site/docs-frame"

/** Getting started, Start here, License, Changelog, Security and Quality share the components docs frame. */
export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return <DocsFrame>{children}</DocsFrame>
}
