import { cn } from "@/lib/utils"

/** The shared heading block for landing sections: eyebrow, title, one line of support. */
export function SectionHeading({
  id,
  eyebrow,
  title,
  children,
  className,
}: {
  id: string
  eyebrow: string
  title: string
  children?: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn("max-w-2xl", className)}>
      <p className="text-sm font-bold text-muted-foreground">{eyebrow}</p>
      <h2 id={id} className="mt-2 text-2xl font-bold tracking-tight text-balance sm:text-4xl">
        {title}
      </h2>
      {children && <p className="mt-3 text-pretty text-muted-foreground sm:text-lg">{children}</p>}
    </div>
  )
}
