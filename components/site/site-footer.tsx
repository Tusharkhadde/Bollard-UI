import Link from "next/link"
import { ArrowUpRight } from "lucide-react"

import { LogoMark } from "@/components/site/logo"
import { ThemeToggle } from "@/components/site/theme"
import { registryBase } from "@/lib/catalog"
import { FEEDBACK_HREF, REPO_PUBLIC, REPO_URL, SECURITY_HREF, links } from "@/lib/site"

type FooterLink = { label: string; href: string; external?: boolean }

const columns: { title: string; links: FooterLink[] }[] = [
  {
    title: "Library",
    links: [
      { label: "Getting started", href: "/docs" },
      { label: "Start here", href: "/start-here" },
      { label: "Components", href: "/components" },
      { label: "Browse by flow", href: "/#flows" },
      { label: "FAQ", href: "/#faq" },
    ],
  },
  {
    title: "Resources",
    links: [
      ...(REPO_PUBLIC
        ? [
            { label: "GitHub", href: REPO_URL, external: true },
            { label: "README", href: links.readme, external: true },
          ]
        : []),
      { label: "Changelog", href: "/changelog" },
      { label: "Quality", href: "/quality" },
      { label: "Security", href: "/security" },
      { label: "License", href: links.license, external: REPO_PUBLIC },
      { label: "Registry JSON", href: `${registryBase}registry.json`, external: true },
    ],
  },
  {
    title: "Community",
    links: [
      REPO_PUBLIC
        ? { label: "Report an issue", href: links.issues, external: true }
        : { label: "Send feedback", href: FEEDBACK_HREF, external: true },
      { label: "Report a vulnerability", href: SECURITY_HREF, external: true },
      { label: "X @devtushark", href: "https://x.com/devtushark", external: true },
      { label: "GitHub @Tusharkhadde", href: "https://github.com/Tusharkhadde", external: true },
    ],
  },
]

const linkClass =
  "group inline-flex items-center gap-1 rounded-sm text-[13px] text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"

/** Site-wide footer, shadcn-style: brand blurb, three link columns, then a quiet bottom bar with the theme switch. */
export function SiteFooter() {
  return (
    <footer className="border-t">
      <div className="mx-auto max-w-6xl px-4 pt-14 pb-[max(3rem,env(safe-area-inset-bottom))] sm:px-6 sm:pb-14">
        <div className="grid grid-cols-2 gap-x-6 gap-y-10 md:grid-cols-[minmax(0,1.5fr)_repeat(3,minmax(0,1fr))]">
          <div className="col-span-2 max-w-xs md:col-span-1">
            <Link href="/" className="inline-flex items-center gap-2 rounded-md text-sm font-semibold tracking-tight outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50">
              <span className="grid size-6 place-items-center rounded-md bg-primary text-primary-foreground">
                <LogoMark className="size-5" />
              </span>
              Bollard UI
            </Link>
            <p className="mt-3 text-[13px] leading-relaxed text-pretty text-muted-foreground">
              React components that catch the mistake before your users make it. MIT licensed. Source copied into your project.
            </p>
          </div>
          {columns.map((column) => (
            <nav key={column.title} aria-label={column.title} className="min-w-0">
              <h2 className="text-[13px] font-medium">{column.title}</h2>
              <ul className="mt-3 grid gap-2">
                {column.links.map((link) => (
                  <li key={link.label} className="min-w-0">
                    {link.external ? (
                      <a href={link.href} className={linkClass}>
                        {link.label}
                        <ArrowUpRight aria-hidden className="size-3 opacity-0 transition-opacity group-hover:opacity-60" />
                      </a>
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
        <div className="mt-14 flex flex-wrap items-center justify-between gap-4 border-t pt-6">
          <p className="text-[13px] text-muted-foreground">
            © 2026 Bollard UI. Built by{" "}
            <a href="https://github.com/Tusharkhadde" className="rounded-sm text-foreground outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50">
              Tushar Khadde
            </a>
            .
          </p>
          <ThemeToggle />
        </div>
      </div>
    </footer>
  )
}
