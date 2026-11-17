import { type ComponentFaq } from "@/lib/component-faq"

export function ComponentFaqSection({
  faqs,
  componentTitle,
}: {
  faqs: ComponentFaq[]
  componentTitle: string
}) {
  if (!faqs || faqs.length === 0) return null

  return (
    <div className="space-y-4" aria-label={`Frequently asked questions about ${componentTitle}`}>
      <div className="divide-y divide-border/60 rounded-xl border bg-surface/50 px-4 sm:px-6">
        {faqs.map((faq, index) => (
          <details key={index} className="group py-4 first:pt-4 last:pb-4">
            <summary className="flex cursor-pointer items-center justify-between font-medium text-sm sm:text-[15px] text-foreground outline-none transition-colors hover:text-brand focus-visible:ring-[3px] focus-visible:ring-ring/50">
              <span>{faq.question}</span>
              <span className="ml-2 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden>
                ↓
              </span>
            </summary>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground max-w-3xl">
              {faq.answer}
            </p>
          </details>
        ))}
      </div>
    </div>
  )
}
