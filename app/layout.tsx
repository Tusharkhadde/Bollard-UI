import type { Metadata, Viewport } from "next"
import { Comic_Neue } from "next/font/google"

import { SITE_URL } from "@/lib/site"
import { themeScript } from "@/lib/theme-script"
import "./globals.css"

const comic = Comic_Neue({ subsets: ["latin"], weight: ["400", "700"], variable: "--font-comic", display: "swap" })

const title = "Bollard UI: build interfaces your users can't break"
const description =
  "Copy-paste React components that catch wrong amounts, leaked secrets, typo'd emails and accidental deletes. Built for shadcn/ui. Open source."

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: title,
    template: "%s · Bollard UI",
  },
  description,
  openGraph: {
    type: "website",
    siteName: "Bollard UI",
    title,
    description,
    url: "/",
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
  },
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={comic.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-dvh font-sans">{children}</body>
    </html>
  )
}
