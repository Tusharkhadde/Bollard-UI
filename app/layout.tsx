import type { Metadata, Viewport } from "next"
import Script from "next/script"
import { GeistMono } from "geist/font/mono"
import { GeistSans } from "geist/font/sans"

import { SITE_URL } from "@/lib/site"
import { themeScript } from "@/lib/theme-script"
import "./globals.css"

const title = "Bollard UI: React guardrails for forms and critical actions"
const description =
  "Copy-paste React guardrails for shadcn/ui, plus a headless validation hook for any React controls. Catch invalid input and risky actions. MIT licensed; edit the source in your app."

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
    { media: "(prefers-color-scheme: dark)", color: "#09090b" },
  ],
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-dvh font-sans">{children}</body>
      <Script
        src="https://www.googletagmanager.com/gtag/js?id=G-JX4N0EV7CG"
        strategy="afterInteractive"
      />
      <Script id="google-analytics" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', 'G-JX4N0EV7CG');
        `}
      </Script>
    </html>
  )
}
