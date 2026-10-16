"use client"

import * as React from "react"

import { CurrencyHint, type ExchangeRates } from "@/registry/default/currency-hint/currency-hint"

const RATES: ExchangeRates = { base: "EUR", date: "2026-10-12", rates: { INR: 92.24, USD: 1.09 } }

export function Demo() {
  // Rates are "yesterday's" so the demo never ages into a stale-rate warning.
  const [rates, setRates] = React.useState(RATES)
  React.useEffect(() => setRates({ ...RATES, date: new Date(Date.now() - 86_400_000).toISOString().slice(0, 10) }), [])

  return (
    <div className="grid w-full max-w-sm gap-6">
      <div className="grid gap-1.5">
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Hotel Lumière, Paris · 1 night</p>
        <CurrencyHint
          amount={49}
          currency="EUR"
          viewerCurrency="INR"
          rates={rates}
          source="ECB"
          locale="en-IN"
          defaultValue="INR"
          dccAmount={4790}
          cardFeePercent={3.5}
          feeTaxPercent={18}
        />
      </div>
      <div className="grid gap-1.5 border-t pt-4">
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Figma Professional · monthly</p>
        <CurrencyHint amount={20} currency="USD" viewerCurrency="INR" rates={rates} source="ECB" locale="en-IN" cardFeePercent={3.5} feeTaxPercent={18} />
      </div>
    </div>
  )
}
