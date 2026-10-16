import { cn } from "@/lib/utils"

/** The shared page width for landing (and any marketing-style) sections. */
export const container = "mx-auto w-full max-w-6xl px-4 sm:px-6"

/** A full-width landing section: hairline top border and the standard vertical rhythm. */
export function Section({
  id,
  labelledBy,
  className,
  children,
  bordered = true,
}: {
  id?: string
  labelledBy: string
  className?: string
  children: React.ReactNode
  bordered?: boolean
}) {
  return (
    <section id={id} aria-labelledby={labelledBy} className={cn("scroll-mt-16", bordered && "border-t", className)}>
      <div className={cn(container, "py-20 sm:py-28")}>{children}</div>
    </section>
  )
}

/** Small mono label above a section title, with the amber tick from the logo band. */
export function Eyebrow({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <p className={cn("inline-flex items-center gap-2 font-mono text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase", className)}>
      <span aria-hidden className="h-px w-4 bg-brand" />
      {children}
    </p>
  )
}

/** The shared heading block for landing sections: eyebrow, title, one line of support. */
export function SectionHeading({
  id,
  eyebrow,
  title,
  children,
  align = "left",
  className,
}: {
  id: string
  eyebrow?: string
  title: React.ReactNode
  children?: React.ReactNode
  align?: "left" | "center"
  className?: string
}) {
  return (
    <div className={cn("max-w-2xl", align === "center" && "mx-auto text-center", className)}>
      {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
      <h2 id={id} className={cn("text-3xl font-semibold tracking-[-0.03em] text-balance sm:text-[2.5rem]", eyebrow && "mt-4")}>
        {title}
      </h2>
      {children && <p className="mt-4 text-base leading-relaxed text-pretty text-muted-foreground sm:text-lg">{children}</p>}
    </div>
  )
}
