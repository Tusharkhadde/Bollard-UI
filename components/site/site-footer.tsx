import Link from "next/link"

import { LogoMark } from "@/components/site/logo"
import { ThemeToggle } from "@/components/site/theme"
import { GITHUB_URL, registryBase } from "@/lib/catalog"
import { ExternalLink } from "@/registry/default/external-link/external-link"

type FooterLink = { label: string; href: string; external?: boolean }

const columns: { title: string; links: FooterLink[] }[] = [
  {
    title: "Product",
    links: [
      { label: "Components", href: "/components" },
      { label: "Flows", href: "/#flows" },
      { label: "Get started", href: "/#get-started" },
    ],
  },
  {
    title: "Resources",
    links: [
      { label: "GitHub repo", href: GITHUB_URL, external: true },
      { label: "Docs (README)", href: `${GITHUB_URL}#readme`, external: true },
      { label: "Registry JSON", href: `${registryBase}registry.json`, external: true },
      { label: "License", href: `${GITHUB_URL}/blob/main/LICENSE`, external: true },
    ],
  },
  {
    title: "Community",
    links: [
      { label: "GitHub @Tusharkhadde", href: "https://github.com/Tusharkhadde", external: true },
      { label: "X @devtushark", href: "https://x.com/devtushark", external: true },
      { label: "Report an issue", href: `${GITHUB_URL}/issues`, external: true },
    ],
  },
]

const linkClass =
  "rounded-sm text-sm font-normal text-muted-foreground no-underline outline-none transition-colors hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 [&>svg]:size-3 [&>svg]:opacity-60"

/** Site-wide footer: brand and license on the left, three link columns, then copyright and theme. */
export function SiteFooter() {
  const year = 2026
  return (
    <footer className="border-t bg-muted/20">
      <div className="mx-auto max-w-[90rem] px-4 pt-12 pb-8 sm:px-6 sm:pt-16">
        <div className="grid grid-cols-2 gap-x-6 gap-y-10 md:grid-cols-[minmax(0,1.6fr)_repeat(3,minmax(0,1fr))]">
          <div className="col-span-2 max-w-xs md:col-span-1">
            <Link href="/" className="inline-flex items-center gap-2 rounded-md font-bold tracking-tight outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50">
              <span className="grid size-7 place-items-center rounded-lg bg-primary text-primary-foreground">
                <LogoMark className="size-6" />
              </span>
              Bollard UI
            </Link>
            <p className="mt-3 text-sm text-pretty text-muted-foreground">React components that catch the mistake before your users make it.</p>
            <p className="mt-2 text-sm text-muted-foreground">MIT licensed. Free for personal and commercial use.</p>
          </div>
          {columns.map((column) => (
            <nav key={column.title} aria-label={column.title} className="min-w-0">
              <h2 className="text-sm font-bold">{column.title}</h2>
              <ul className="mt-3 grid gap-2.5">
                {column.links.map((link) => (
                  <li key={link.label} className="min-w-0">
                    {link.external ? (
                      <ExternalLink href={link.href} confirm="risky" className={linkClass}>
                        {link.label}
                      </ExternalLink>
                    ) : (
                      <Link href={link.href} className={linkClass}>
                        {link.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>
        <div className="mt-12 flex flex-wrap items-center justify-between gap-4 border-t pt-6 text-sm text-muted-foreground">
          <p>
            © {year} Bollard UI · Built by{" "}
            <ExternalLink href="https://github.com/Tusharkhadde" confirm="risky" className={linkClass + " text-foreground [&>svg]:hidden"}>
              Tushar Khadde
            </ExternalLink>
          </p>
          <ThemeToggle />
        </div>
      </div>
    </footer>
  )
}
