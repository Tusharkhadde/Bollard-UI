"use client"

import { TriangleAlert } from "lucide-react"

import { AbbrGlossary, AbbrHint, GlossaryText, findUndefinedAbbreviations, type Glossary } from "@/registry/default/abbr-hint/abbr-hint"

const glossary: Glossary = {
  TAT: { expansion: "turnaround time", definition: "How long we take from your request to the money being back." },
  NEFT: { expansion: "National Electronic Funds Transfer", definition: "The bank-to-bank route refunds travel on." },
  SLA: { expansion: "service level agreement", definition: "The deadline we've promised to meet." },
  kWh: { expansion: "kilowatt-hour", definition: "A 1,000-watt appliance running for one hour." },
}

const reply =
  "Your refund is on its way by NEFT. The TAT is 5 business days, which is our SLA for card refunds. If the TAT is missed, the SLA gives you a ₹200 credit. Your KYC is already complete."

export function Demo() {
  const missing = findUndefinedAbbreviations(reply, glossary)
  return (
    <AbbrGlossary glossary={glossary}>
      <div className="grid w-full max-w-md gap-4">
        <div className="grid gap-1.5 rounded-lg border bg-background p-4">
          <p className="text-xs font-medium text-muted-foreground">Support reply · first use spelled out, later uses tappable</p>
          <p className="text-sm leading-relaxed">
            <GlossaryText>{reply}</GlossaryText>
          </p>
          {missing.length > 0 && (
            <p aria-live="polite" className="mt-1.5 flex gap-1.5 text-xs text-amber-700 dark:text-amber-400">
              <TriangleAlert aria-hidden className="mt-0.5 size-3.5 shrink-0" />
              <span>
                Not in the glossary: <span className="font-medium">{missing.join(", ")}</span>. Readers won&apos;t get a hint for it.
              </span>
            </p>
          )}
        </div>
        <div className="overflow-x-auto rounded-lg border bg-background">
          <table className="w-full text-left text-sm">
            <caption className="px-4 pt-3 text-left text-xs font-medium text-muted-foreground">Scrolling table · the hint escapes the clipped box</caption>
            <tbody>
              <tr className="border-b">
                <th scope="row" className="px-4 py-2 font-normal text-muted-foreground">Charger</th>
                <td className="px-4 py-2 text-right tabular-nums">
                  7.4 <AbbrHint side="top">kWh</AbbrHint>
                </td>
              </tr>
              <tr>
                <th scope="row" className="px-4 py-2 font-normal text-muted-foreground">Refund route</th>
                <td className="px-4 py-2 text-right">
                  <AbbrHint>NEFT</AbbrHint>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </AbbrGlossary>
  )
}
