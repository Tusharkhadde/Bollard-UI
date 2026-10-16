"use client"

import * as React from "react"

import { AiCitationCheck, type Reference, type VerifyResult } from "@/registry/default/ai-citation-check/ai-citation-check"

// A brief drafted with a chatbot, like the one sanctioned in Mata v. Avianca (S.D.N.Y. 2023): Varghese
// is one of the cases ChatGPT invented there. The research note mixes a real DOI with retyped and
// mismatched ones, the kind found in Deloitte's refunded report for the Australian government (2025).
const DRAFT = `Courts have consistently tolled the Montreal Convention's two-year limit. See Varghese v. China Southern Airlines Co., 925 F.3d 1339 (11th Cir. 2019); Martinez v. Delta Air Lines, Inc., 41 F.3d 220 (5th Cir. 2023); cf. Zicherman v. Korean Air Lines Co., 516 U.S. 217 (1996).

AlphaFold changed structure prediction (Nature, 2021) doi:10.1038/s41586–021–03819–2, building on Nature 10.1016/j.nature.2019.11.004 :contentReference[oaicite:2]{index=2}.

As one review put it, "automated debt raising without human review shifted the burden of proof onto vulnerable people who often had no records left to show they never owed anything at all."`

// Stand-in for Crossref and CourtListener lookups.
const KNOWN: Record<string, VerifyResult> = {
  "516 U.S. 217": { status: "found", title: "Zicherman v. Korean Air Lines Co. (1996)", url: "https://www.courtlistener.com/?q=516+U.S.+217" },
  "10.1038/s41586-021-03819-2": { status: "found", title: "Highly accurate protein structure prediction with AlphaFold", url: "https://doi.org/10.1038/s41586-021-03819-2" },
}

export function Demo() {
  const [text, setText] = React.useState(DRAFT)
  const [done, setDone] = React.useState(false)

  return (
    <div className="grid w-full max-w-md gap-2">
      <label htmlFor="citation-demo" className="text-sm font-medium">
        Brief, drafted with AI
      </label>
      <AiCitationCheck
        id="citation-demo"
        value={text}
        onValueChange={(v) => {
          setText(v)
          setDone(false)
        }}
        year={2026}
        sourceName="Crossref or CourtListener"
        verify={async (ref: Reference) => {
          await new Promise((r) => setTimeout(r, 500 + (ref.start % 5) * 150))
          return KNOWN[ref.key ?? ""] ?? false
        }}
        onSubmit={async () => {
          await new Promise((r) => setTimeout(r, 400))
          setDone(true)
        }}
      />
      {done && <p className="text-xs text-muted-foreground">Filed.</p>}
    </div>
  )
}
