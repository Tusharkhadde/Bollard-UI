import { DocsFrame } from "@/components/site/docs-frame"

export default function ComponentsLayout({ children }: { children: React.ReactNode }) {
  return <DocsFrame>{children}</DocsFrame>
}
