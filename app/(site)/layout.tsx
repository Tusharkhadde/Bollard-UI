import { SiteShell } from "@/components/site/site-shell"
import { SiteFooter } from "@/components/site/site-footer"
import { TopBar } from "@/components/site/top-bar"
import { catalogItems, categories } from "@/lib/catalog"

// Mark preview deployments without adding a local development badge.
const env = process.env.VERCEL_ENV === "preview" ? "preview" : undefined

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <SiteShell items={catalogItems} categories={categories}>
      <div className="flex min-h-dvh flex-col">
        <TopBar env={env} />
        <div className="flex-1">{children}</div>
        <SiteFooter />
      </div>
    </SiteShell>
  )
}
