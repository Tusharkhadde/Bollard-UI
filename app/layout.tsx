import type { Metadata, Viewport } from "next"
import Script from "next/script"
import { GeistMono } from "geist/font/mono"
import { GeistSans } from "geist/font/sans"

import { Analytics } from "@/components/site/analytics"
import { SITE_URL } from "@/lib/site"
import { themeScript } from "@/lib/theme-script"
import "./globals.css"

/**
 * GA4 loads only when a measurement ID is configured (set NEXT_PUBLIC_GA_MEASUREMENT_ID
 * in Vercel), and never in development unless NEXT_PUBLIC_GA_DEV_ANALYTICS=1 is also set.
 * The ID is shape-checked so a bad value can't break the inline bootstrap below.
 */
const gaMeasurementId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID
const gaEnabled =
  typeof gaMeasurementId === "string" &&
  /^G-[A-Z0-9]+$/.test(gaMeasurementId) &&
  (process.env.NODE_ENV === "production" || process.env.NEXT_PUBLIC_GA_DEV_ANALYTICS === "1")

const title = "Bollard UI: React form guardrails and validation"
const description =
  "Copy-paste React guardrails for forms and risky actions. Install with shadcn, or add a headless validation hook to existing controls. MIT licensed."

const structuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${SITE_URL}/#organization`,
      name: "Bollard UI",
      url: SITE_URL,
      logo: `${SITE_URL}/icon.svg`,
    },
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      name: "Bollard UI",
      url: SITE_URL,
      description,
      publisher: { "@id": `${SITE_URL}/#organization` },
      inLanguage: "en",
    },
  ],
}

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: title,
    template: "%s · Bollard UI",
  },
  description,
  applicationName: "Bollard UI",
  authors: [{ name: "Bollard UI" }],
  creator: "Bollard UI",
  publisher: "Bollard UI",
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1, "max-video-preview": -1 } },
  openGraph: {
    type: "website",
    siteName: "Bollard UI",
    title,
    description,
    url: "/",
    images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: "React components for safer forms and critical actions" }],
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
    images: [{ url: "/opengraph-image", alt: "React components for safer forms and critical actions" }],
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
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />
      </head>
      <body className="min-h-dvh font-sans">{children}</body>
      {gaEnabled && (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${gaMeasurementId}`}
            strategy="afterInteractive"
          />
          <Script id="google-analytics" strategy="afterInteractive">
            {`
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', '${gaMeasurementId}', { send_page_view: true });
            `}
          </Script>
          {/* Global link clicks (page views are handled by gtag config + enhanced measurement). */}
          <Analytics />
        </>
      )}
    </html>
  )
}
