import type { Metadata } from "next"
import Link from "next/link"
import { ArrowRight, Check, ShieldCheck } from "lucide-react"
import { notFound } from "next/navigation"

import { InstallCommand } from "@/components/site/install-command"
import { CopyButton } from "@/components/site/copy-button"
import { RegistrySetup } from "@/components/site/registry-setup"
import { buttonPrimary } from "@/components/site/button-styles"
import { USE_CASES, findUseCaseBySlug } from "@/lib/use-cases"

type Props = { params: Promise<{ slug: string }> }

export function generateStaticParams() {
  return USE_CASES.map(({ slug }) => ({ slug }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const useCase = findUseCaseBySlug(slug)
  if (!useCase) return { title: "Use case not found" }
  return {
    title: useCase.eyebrow,
    description: useCase.description,
    alternates: { canonical: `/use-cases/${useCase.slug}` },
    openGraph: { title: useCase.title, description: useCase.description, url: `/use-cases/${useCase.slug}` },
  }
}

export default async function UseCasePage({ params }: Props) {
  const { slug } = await params
  const useCase = findUseCaseBySlug(slug)
  if (!useCase) notFound()

  return (
    <main>
      <section className="border-b">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-6 sm:py-20 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-end">
          <div className="max-w-3xl">
            <p className="font-mono text-[11px] font-medium tracking-[0.14em] text-brand uppercase">{useCase.eyebrow}</p>
            <h1 className="mt-4 text-balance text-4xl font-semibold tracking-[-0.045em] sm:text-5xl">{useCase.title}</h1>
            <p className="mt-5 max-w-2xl text-lg leading-relaxed text-muted-foreground">{useCase.description}</p>
          </div>
          <Link href="/playground" className={buttonPrimary}>
            Try the guard rails <ArrowRight aria-hidden />
          </Link>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-6 sm:py-20 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">A small safety layer for one real flow.</h2>
          <ul className="mt-7 divide-y rounded-xl border">
            {useCase.components.map((component) => (
              <li key={component.name} className="flex flex-col gap-3 p-5 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h3 className="font-medium">{component.title}</h3>
                  <p className="mt-1 max-w-xl text-sm leading-relaxed text-muted-foreground">{component.reason}</p>
                </div>
                <Link href={`/components/${component.name}`} className="shrink-0 rounded-md text-sm font-medium underline decoration-border underline-offset-4 outline-none hover:decoration-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50">
                  View component
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <aside className="h-fit rounded-xl border bg-surface p-5">
          <span aria-hidden className="grid size-9 place-items-center rounded-lg border bg-background text-brand"><ShieldCheck className="size-4" /></span>
          <h2 className="mt-4 text-lg font-semibold tracking-tight">Review before the request.</h2>
          <ul className="mt-4 grid gap-3 text-sm leading-relaxed text-muted-foreground">
            {useCase.checks.map((check) => <li key={check} className="flex gap-2"><Check aria-hidden className="mt-0.5 size-4 shrink-0 text-brand" />{check}</li>)}
          </ul>
        </aside>
      </section>

      <section className="border-y bg-background">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-14">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div><p className="font-mono text-[11px] font-medium tracking-[0.14em] text-brand uppercase">Integration recipe</p><h2 className="mt-2 text-2xl font-semibold tracking-tight">A starting point for your flow.</h2></div>
            <CopyButton value={useCase.recipe} label={`Copy ${useCase.eyebrow} integration recipe`} className="h-9 px-3">Copy recipe</CopyButton>
          </div>
          <pre className="mt-5 overflow-x-auto rounded-xl border bg-surface p-4 text-xs leading-relaxed sm:p-5"><code>{useCase.recipe}</code></pre>
          <p className="mt-4 max-w-4xl text-sm leading-relaxed text-muted-foreground"><strong className="font-medium text-foreground">Server boundary:</strong> {useCase.serverBoundary}</p>
        </div>
      </section>

      <section className="border-y bg-surface">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-16">
          <p className="font-mono text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">One command for this flow</p>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight">{useCase.packLabel}.</h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">Start with the related components, then edit the copied source in your own product.</p>
          <InstallCommand name={useCase.pack} className="mt-5 max-w-2xl bg-background" />
          <RegistrySetup className="mt-8 max-w-2xl rounded-xl border bg-background p-5" />
        </div>
      </section>
    </main>
  )
}
