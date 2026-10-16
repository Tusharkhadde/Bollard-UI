import type { Metadata } from "next"
import Link from "next/link"

import { DocPage, Prose, inlineCode, proseLink } from "@/components/site/doc-page"
import { readRepoFile } from "@/lib/markdown"

const description = "Bollard UI is MIT licensed: free for personal and commercial use. The full licence text and what it means for copied components."

export const metadata: Metadata = {
  title: "License",
  description,
  alternates: { canonical: "/license" },
  openGraph: { title: "License · Bollard UI", description, url: "/license" },
}

export default function LicensePage() {
  const text = readRepoFile("LICENSE")?.trim() ?? "MIT License"
  return (
    <DocPage title="License" lead="MIT licensed. Source copied into your project, free for personal and commercial use.">
      <Prose className="pt-8">
        <p>
          When you add a component, its source becomes part of your codebase. Keep the copyright and permission notice below with the copied code, for example
          in your project&apos;s own <code className={inlineCode}>LICENSE</code> or third-party notices file. Packages a component depends on (such as{" "}
          <code className={inlineCode}>motion</code> or <code className={inlineCode}>lucide-react</code>) carry their own licences; each component page lists
          them under Dependencies.
        </p>
      </Prose>
      <pre className="mt-6 overflow-x-auto rounded-xl border bg-surface p-5 font-mono text-[12.5px] leading-6 whitespace-pre-wrap text-foreground/90 sm:p-6" data-license>
        {text}
      </pre>
      <p className="mt-6 text-sm text-muted-foreground">
        Questions about the licence? See{" "}
        <Link className={proseLink} href="/security">
          Security
        </Link>{" "}
        for contact details.
      </p>
    </DocPage>
  )
}
