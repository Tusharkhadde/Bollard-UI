import Link from "next/link"
import { Plus } from "lucide-react"

import { CONTACT_EMAIL, FEEDBACK_HREF, REPO_PUBLIC, SECURITY_HREF, links } from "@/lib/site"

import { Reveal } from "./reveal"
import { Section, SectionHeading } from "./section-heading"

const code = "rounded border bg-surface px-1 py-0.5 font-mono text-[0.85em] text-foreground"
const linkCls = "text-foreground underline decoration-border underline-offset-4 hover:decoration-foreground"

const items: { q: string; a: React.ReactNode }[] = [
  {
    q: "Is it free?",
    a: "Yes. Every component is MIT licensed, free for personal and commercial projects. Keep the license notice and do what you like with the code.",
  },
  {
    q: "Does it need shadcn/ui?",
    a: (
      <>
        It needs a shadcn/ui setup, not shadcn&apos;s components. Run <code className={code}>npx shadcn@latest init</code> once for Tailwind v4, the
        theme variables and the <code className={code}>cn()</code> helper. That is all Bollard UI uses from it.
      </>
    ),
  },
  {
    q: "Do I need to install a package?",
    a: "No. The CLI copies the component's source into your project. Most components need only React and lucide-react. When one needs more, such as motion or date-fns, its registry entry lists it, the CLI installs it, and the component's page shows exactly what it needs.",
  },
  {
    q: "Does it work with Next.js, Vite and Remix?",
    a: (
      <>
        Yes, anywhere the shadcn CLI works with React 19 and Tailwind v4. Components carry <code className={code}>&quot;use client&quot;</code> where they
        use hooks and never touch <code className={code}>window</code> or <code className={code}>document</code> during render, so server rendering is safe.
      </>
    ),
  },
  {
    q: "Is it accessible?",
    a: (
      <>
        It is part of every component&apos;s brief: real labels, keyboard support, warnings announced politely while you type, alerts only for real errors,
        and motion that respects reduced-motion settings. Component pages list what each one actually does under Accessibility. If you find a gap,{" "}
        <a className={linkCls} href={links.issues}>
          please tell us
        </a>
        .
      </>
    ),
  },
  {
    q: "Can I customise it?",
    a: "Completely. It is your file. Components use the standard shadcn theme tokens, so they follow your theme, and accept className and native props. Most user-facing strings are props with English defaults you can reword or translate; a few, such as amounts spelled out in words, are generated in English, so check the Props table before you localise.",
  },
  {
    q: "Which versions is it built against?",
    a: (
      <>
        The site and registry are built and type-checked with React 19, Next.js 16, Tailwind CSS v4, TypeScript 5 and the shadcn CLI v4. React 18 and Tailwind
        v3 aren&apos;t targeted. The <Link className={linkCls} href="/quality">Quality page</Link> lists the exact versions and the checks that run.
      </>
    ),
  },
  {
    q: "What is the minimum setup for Next.js or Vite?",
    a: (
      <>
        A React 19 app with Tailwind v4, a <code className={code}>@/</code> path alias and <code className={code}>npx shadcn@latest init</code>. Next.js App
        Router needs nothing else. For Vite, add the alias to both <code className={code}>tsconfig.json</code> and <code className={code}>vite.config.ts</code>{" "}
        first, as the shadcn Vite guide shows. <Link className={linkCls} href="/docs">Getting started</Link> walks through both.
      </>
    ),
  },
  {
    q: "What if my project uses custom path aliases?",
    a: (
      <>
        The CLI reads the aliases in your <code className={code}>components.json</code> and rewrites imports to match, so{" "}
        <code className={code}>@/components/ui</code> becomes whatever you configured. If you copy files by hand, update the{" "}
        <code className={code}>@/lib/utils</code> and component imports yourself.
      </>
    ),
  },
  {
    q: "How do I update a component after copying it?",
    a: (
      <>
        Nothing updates on its own: the code is yours. Check the <Link className={linkCls} href="/changelog">changelog</Link>, then either re-run the add command with{" "}
        <code className={code}>--overwrite</code> (it replaces your copy, so commit first) or diff your file against the source in{" "}
        <code className={code}>/r/&lt;name&gt;.json</code> and merge by hand.
      </>
    ),
  },
  {
    q: "Where are known issues listed?",
    a: REPO_PUBLIC ? (
      <>
        In the <a className={linkCls} href={links.issues}>issue tracker</a>, with fixes recorded in the <Link className={linkCls} href="/changelog">changelog</Link>.
      </>
    ) : (
      <>
        Fixes and known issues go in the <Link className={linkCls} href="/changelog">changelog</Link>. To report one, email{" "}
        <a className={linkCls} href={FEEDBACK_HREF}>
          {CONTACT_EMAIL}
        </a>{" "}
        with the component name and what you saw.
      </>
    ),
  },
  {
    q: "Which components are experimental?",
    a: (
      <>
        There are no formal stable or experimental labels yet, and we won&apos;t invent them. The <Link className={linkCls} href="/start-here">Start here</Link> set
        is the curated core to begin with. Components that bake in tax, legal or finance rules show when those rules were last checked.
      </>
    ),
  },
  {
    q: "Isn't this the server's job?",
    a: "Yes, and it stays the server's job. These components are UX guard rails: they catch honest mistakes before the request is sent. They don't replace server-side validation, authorization, rate limits, idempotency keys or database constraints, and a determined user can always bypass client code. Pages for security, payment and destructive components say what the server still has to enforce.",
  },
  {
    q: "How do I report a vulnerability privately?",
    a: (
      <>
        Email{" "}
        <a className={linkCls} href={SECURITY_HREF}>
          {CONTACT_EMAIL}
        </a>{" "}
        and don&apos;t post details publicly. The <Link className={linkCls} href="/security">security policy</Link> says what to include and when to expect a reply.
      </>
    ),
  },
]

/** Native <details> (the registry has no disclosure component): keyboard, find-in-page and screen readers work for free. */
export function Faq() {
  return (
    <Section id="faq" labelledBy="faq-heading">
      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)] lg:gap-16">
        <SectionHeading id="faq-heading" eyebrow="FAQ" title="Questions, answered." />
        <Reveal className="min-w-0">
          <div className="divide-y border-y">
            {items.map(({ q, a: answer }) => (
              <details key={q} className="group">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 rounded-md py-5 text-[15px] font-medium tracking-tight outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 [&::-webkit-details-marker]:hidden">
                  {q}
                  <Plus aria-hidden className="size-4 shrink-0 text-muted-foreground transition-transform duration-200 group-open:rotate-45 motion-reduce:transition-none" />
                </summary>
                <div className="pr-8 pb-5 text-[15px] leading-relaxed text-pretty text-muted-foreground">{answer}</div>
              </details>
            ))}
          </div>
        </Reveal>
      </div>
    </Section>
  )
}
