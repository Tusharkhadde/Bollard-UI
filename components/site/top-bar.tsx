"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Menu, Search } from "lucide-react"

import { cn } from "@/lib/utils"
import { ExternalLink } from "@/registry/default/external-link/external-link"
import { EnvironmentBadge } from "@/registry/default/environment-badge/environment-badge"
import { GithubIcon } from "./github-icon"
import { Logo } from "./logo"
import { useSite } from "./site-shell"
import { ThemeToggle } from "./theme"

const GITHUB_URL = "https://github.com/Tusharkhadde/CraftedUI"

export function TopBar({ env }: { env?: string }) {
  const { openSearch, openDrawer } = useSite()
  const pathname = usePathname()
  const nav = [
    { href: "/", label: "Home", active: pathname === "/" },
    { href: "/components", label: "Components", active: pathname.startsWith("/components") },
  ]
  return (
    <header className="sticky top-0 z-40 border-b bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="mx-auto flex h-14 max-w-[90rem] items-center gap-3 px-4 sm:px-6">
        <button
          type="button"
          onClick={openDrawer}
          aria-label="Open navigation"
          data-drawer-trigger
          className="-ml-1.5 grid size-8 place-items-center rounded-md text-muted-foreground outline-none hover:bg-accent hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 lg:hidden"
        >
          <Menu className="size-4" aria-hidden />
        </button>
        <Logo />
        {env && <EnvironmentBadge env={env} variant="badge" className="hidden sm:inline-flex" />}
        <nav aria-label="Main" className="ml-2 hidden items-center gap-1 text-sm md:flex">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={item.active ? "page" : undefined}
              className={cn(
                "rounded-md px-2.5 py-1.5 text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50",
                item.active && "text-foreground font-medium",
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={() => openSearch()}
            data-search-trigger
            aria-label="Search components"
            aria-keyshortcuts="Meta+K Control+K"
            className="flex h-8 items-center gap-2 rounded-md border bg-muted/40 px-2.5 text-sm text-muted-foreground shadow-xs outline-none transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 sm:w-56 lg:w-64"
          >
            <Search className="size-4 shrink-0" aria-hidden />
            <span className="hidden flex-1 text-left sm:inline">Search components…</span>
            <kbd className="pointer-events-none hidden rounded border bg-background px-1.5 font-mono text-[10px] font-medium sm:pointer-fine:inline">
              ⌘K
            </kbd>
          </button>
          <ThemeToggle />
          <ExternalLink
            href={GITHUB_URL}
            aria-label="Bollard UI on GitHub"
            className="grid h-8 place-items-center gap-0 rounded-md px-1.5 text-muted-foreground no-underline hover:bg-accent hover:text-foreground [&>svg:last-child]:hidden"
          >
            <GithubIcon className="size-4" />
          </ExternalLink>
        </div>
      </div>
    </header>
  )
}
