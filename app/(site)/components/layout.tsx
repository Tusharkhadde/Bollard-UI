import { Sidebar } from "@/components/site/sidebar"

/** Docs frame: the sticky category sidebar on lg+, the page to its right. Same max width as the top bar. */
export default function ComponentsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex w-full max-w-[90rem] lg:px-2">
      <aside className="sticky top-14 hidden h-[calc(100dvh-3.5rem)] w-64 shrink-0 border-r border-border/70 lg:block xl:w-[17rem]" data-docs-sidebar>
        <Sidebar className="h-full" />
      </aside>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  )
}
