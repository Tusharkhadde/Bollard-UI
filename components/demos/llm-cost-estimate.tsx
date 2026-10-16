"use client"

import * as React from "react"

import { LlmCostEstimate, type ModelPrice } from "@/registry/default/llm-cost-estimate/llm-cost-estimate"

// Example price table for the demo only, not live vendor prices. Pass the rates you read, and when.
const MODELS: ModelPrice[] = [
  { id: "large", label: "Large (example)", input: 3, output: 15, contextWindow: 200_000, maxOutput: 64_000, batchDiscount: 0.5 },
  { id: "small", label: "Small (example)", input: 0.15, output: 0.6, contextWindow: 128_000, maxOutput: 16_384, batchDiscount: 0.5 },
  { id: "long", label: "Long context (example)", input: 1.25, output: 10, contextWindow: 1_000_000, maxOutput: 65_536, batchDiscount: 0.5 },
]

export function Demo() {
  const [ran, setRan] = React.useState<string>()
  return (
    <div className="w-full max-w-md space-y-2">
      <p className="text-xs text-muted-foreground">Classify 50,000 support tickets (one label each)</p>
      <LlmCostEstimate
        models={MODELS}
        pricesAsOf="2026-10-01"
        now={new Date(2026, 9, 14, 11).getTime()}
        items={50_000}
        inputTokens={1_240}
        expectedOutputTokens={60}
        lastRunCost={3.1}
        locale="en-US"
        onRun={(run) => new Promise<void>((resolve) => setTimeout(() => { setRan(`Started on ${run.model}${run.batch ? " as a batch job" : ""}, max_tokens ${run.maxTokens ?? "not set"}`); resolve() }, 600))}
      />
      {ran && <p className="text-xs text-muted-foreground">{ran}</p>}
    </div>
  )
}
