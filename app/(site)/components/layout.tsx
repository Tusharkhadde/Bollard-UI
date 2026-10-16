import { Sidebar } from "@/components/site/sidebar"

export default function ComponentsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex max-w-[90rem]">
      <aside className="sticky top-14 hidden h-[calc(100dvh-3.5rem)] w-64 shrink-0 border-r lg:block">
        <Sidebar className="h-full" />
      </aside>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  )
}
