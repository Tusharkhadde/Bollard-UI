import { SiteShell } from "@/components/site/site-shell"
import { SiteFooter } from "@/components/site/site-footer"
import { TopBar } from "@/components/site/top-bar"
import { catalogItems, categories } from "@/lib/catalog"

// Marks preview deployments and local builds; production shows nothing.
const env = process.env.VERCEL_ENV === "production" ? undefined : process.env.VERCEL_ENV === "preview" ? "preview" : process.env.VERCEL ? undefined : "development"

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
