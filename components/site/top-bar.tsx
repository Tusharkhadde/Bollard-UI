"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Menu, Search } from "lucide-react"

import { GITHUB_URL } from "@/lib/site"
import { cn } from "@/lib/utils"
import { EnvironmentBadge } from "@/registry/default/environment-badge/environment-badge"
import { GithubIcon } from "./github-icon"
import { Logo } from "./logo"
import { useSite } from "./site-shell"
import { ThemeButton } from "./theme"

const navLink =
  "relative rounded-md px-2.5 py-1.5 text-[13px] text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"

/**
 * Sticky site header: logo, primary nav, ⌘K search, GitHub and the theme switch.
 * Blurred translucent background with a hairline bottom border. Below lg the
 * menu button opens the drawer (the docs sidebar).
 */
export function TopBar({ env }: { env?: string }) {
  const { openSearch, openDrawer } = useSite()
  const pathname = usePathname()
  const nav = [
    { href: "/components", label: "Components", active: pathname.startsWith("/components") },
    { href: "/#flows", label: "Flows", active: false },
  ]
  return (
    <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur-md supports-[backdrop-filter]:bg-background/65">
      <div className="mx-auto flex h-14 max-w-[90rem] items-center gap-2 px-4 sm:px-6">
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
        {env && <EnvironmentBadge env={env} variant="badge" className="ml-1 hidden sm:inline-flex" />}
        <nav aria-label="Main" className="ml-4 hidden items-center gap-0.5 md:flex">
          {nav.map((item) => (
            <Link key={item.href} href={item.href} aria-current={item.active ? "page" : undefined} className={cn(navLink, item.active && "text-foreground")}>
              {item.label}
            </Link>
          ))}
          <a href={GITHUB_URL} className={navLink}>
            GitHub
          </a>
        </nav>
        <div className="ml-auto flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => openSearch()}
            data-search-trigger
            aria-label="Search components"
            aria-keyshortcuts="Meta+K Control+K"
            className="flex h-8 items-center gap-2 rounded-md border bg-surface px-2 text-[13px] text-muted-foreground outline-none transition-colors hover:border-border-strong hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 sm:w-56 sm:px-2.5 lg:w-64"
          >
            <Search className="size-3.5 shrink-0" aria-hidden />
            <span className="hidden flex-1 text-left sm:inline">Search components…</span>
            <kbd className="pointer-events-none hidden h-5 items-center rounded border bg-background px-1.5 font-mono text-[10px] font-medium sm:pointer-fine:inline-flex">
              ⌘K
            </kbd>
          </button>
          <a
            href={GITHUB_URL}
            aria-label="Bollard UI on GitHub"
            className="grid size-8 place-items-center rounded-md text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 md:hidden"
          >
            <GithubIcon className="size-4" />
          </a>
          <ThemeButton />
        </div>
      </div>
    </header>
  )
}
