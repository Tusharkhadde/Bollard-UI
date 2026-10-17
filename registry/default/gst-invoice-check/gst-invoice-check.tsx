"use client"

// Bollard UI — gst-invoice-check · MIT licence · https://bollard-ui.vercel.app/components/gst-invoice-check

import * as React from "react"
import { ArrowRight, CircleAlert, CircleCheck, Info, TriangleAlert } from "lucide-react"

import { cn } from "@/lib/utils"
import { checkGstInvoice, type GstCharged, type GstHead, type GstInvoice, type GstIssue } from "@/registry/default/gst-invoice-check/gst"
import { GST_STATES } from "@/registry/default/tax-id-input/tax-id"

export * from "@/registry/default/gst-invoice-check/gst"

const HEADS: Record<GstHead, string> = { cgst: "CGST", sgst: "SGST", utgst: "UTGST", igst: "IGST" }

/** Every sentence the check shows. Override any of them to reword or translate. */
export const GST_INVOICE_CHECK_MESSAGES = {
  title: "GST check",
  intra: (local: string) => `Same state · CGST + ${local}`,
  inter: "Inter-state · IGST",
  sez: "SEZ supply · IGST",
  export: "Export · IGST",
  onInvoice: "On invoice",
  shouldBe: "Should be",
  total: "Total",
  ok: "Tax head, rates and totals check out.",
  gstin: (party: string) => `The ${party} GSTIN isn't valid, so the state code can't be trusted.`,
  noPos: "Add the place of supply. It decides between CGST + SGST and IGST.",
  headInter: (from: string, to: string) => `${from} to ${to} is an inter-state supply. Charge IGST, not CGST + SGST.`,
  headIntra: (state: string) => `Supplier and place of supply are both in ${state}. Charge CGST + SGST, not IGST.`,
  headSez: "Supplies to an SEZ are inter-state even within one state. Charge IGST.",
  utHead: (wanted: string) => `This union territory charges ${wanted}, not ${wanted === "UTGST" ? "SGST" : "UTGST"}.`,
  split: (cgst: string, other: string) => `CGST (${cgst}) and the state share (${other}) must be equal halves.`,
  rate: (line: string, rate: string, retired: boolean, endedOn?: string, rare?: boolean) =>
    !retired
      ? `${line}: ${rate} isn't a GST rate.`
      : endedOn === "2026-02-01"
        ? `${line}: the ${rate} slab ended on 1 Feb 2026. Tobacco and pan masala moved to 40%, bidis to 18%.`
        : rare && rate === "28%"
          ? `${line}: since 22 Sep 2025, 28% is only for tobacco and pan masala (and from 1 Feb 2026 they move to 40%). Most items moved to 18%.`
          : rare
          ? `${line}: ${rate} ended on 22 Sep 2025 for almost everything (it survives only for some older housing projects). Most items moved to 5% or 18%.`
          : `${line}: the ${rate} slab ended on 22 Sep 2025. Most items moved to 5% or 18%.`,
  lut: "Under an LUT this supply is zero-rated: charge no GST, and note \"supply meant for export under LUT without payment of IGST\" on the invoice.",
  amount: (head: string, charged: string, expected: string) => `${head} is ${charged}; at these rates it should be ${expected}.`,
  totalOff: (charged: string, expected: string) => `The total ${charged} doesn't add up: taxable value plus tax is ${expected}.`,
  lutHint: "Exporting under an LUT? Then no IGST is right.",
  posDiffers: (state: string) => `Place of supply differs from the buyer's GSTIN state (${state}). Fine for bill-to / ship-to, otherwise check it.`,
  fix: (label: string) => `Use ${label}`,
}

export interface GstInvoiceCheckProps extends Omit<React.ComponentProps<"section">, "onChange">, GstInvoice {
  /** Offers a one-tap fix that applies the expected tax heads and total. */
  onFix?: (charged: GstCharged) => void
  /** Reword or translate any sentence. */
  messages?: Partial<typeof GST_INVOICE_CHECK_MESSAGES>
}

const fixClass =
  "inline-flex h-6 items-center rounded-md border border-amber-500/40 px-2 font-medium text-amber-900 transition-colors hover:bg-amber-500/10 dark:text-amber-200 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"

/**
 * An invoice tax check for India. It reads the supplier's state from the GSTIN, compares it
 * with the place of supply and says whether the invoice needs CGST + SGST (or UTGST) or IGST,
 * then checks each rate against the slabs in force on the invoice date, the CGST/SGST split,
 * every tax amount and the total, with a one-tap fix to the right heads.
 */
export function GstInvoiceCheck({
  supplierGstin,
  recipientGstin,
  placeOfSupply,
  supplyType,
  lines,
  charged,
  invoiceDate,
  roundOff,
  lut,
  onFix,
  messages,
  className,
  ...props
}: GstInvoiceCheckProps) {
  const m = { ...GST_INVOICE_CHECK_MESSAGES, ...messages }
  const result = checkGstInvoice({ supplierGstin, recipientGstin, placeOfSupply, supplyType, lines, charged, invoiceDate, roundOff, lut })
  const { from, pos, intra, type, localHead, expected, issues } = result
  const money = (n: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(n)
  const state = (code?: string) => (code && GST_STATES[code] ? `${GST_STATES[code]} (${code})` : code ?? "—")
  const pct = (n: number) => `${n}%`

  const describe = (issue: GstIssue): [string, "error" | "warn" | "info"] => {
    switch (issue.kind) {
      case "gstin": return [m.gstin(issue.party), "error"]
      case "no-pos": return [m.noPos, "warn"]
      case "head": return [type === "sez" ? m.headSez : issue.wanted === "inter" ? m.headInter(state(from), state(pos)) : m.headIntra(state(from)), "error"]
      case "ut-head": return [m.utHead(HEADS[issue.wanted]), "warn"]
      case "split": return [m.split(money(issue.cgst), money(issue.other)), "error"]
      case "rate": return [m.rate(lines[issue.line]?.description ?? `Line ${issue.line + 1}`, pct(issue.rate), issue.retired, issue.endedOn, issue.rare), "warn"]
      case "lut": return [m.lut, "error"]
      case "amount": {
        const text = m.amount(HEADS[issue.head], money(issue.charged), money(issue.expected))
        return [issue.head === "igst" && issue.charged === 0 && (type === "export" || type === "sez") ? `${text} ${m.lutHint}` : text, "error"]
      }
      case "total": return [m.totalOff(money(issue.charged), money(issue.expected)), "error"]
      case "pos-differs": return [m.posDiffers(state(issue.recipientState)), "info"]
    }
  }
  const fixable = issues.some((i) => i.kind === "head" || i.kind === "amount" || i.kind === "split" || i.kind === "ut-head" || i.kind === "total" || i.kind === "lut")
  const fixLabel = expected.igst === 0 && !intra ? `IGST ${money(0)}` : intra ? `CGST + ${HEADS[localHead]} ${money((expected.cgst ?? 0) * 2)}` : `IGST ${money(expected.igst ?? 0)}`
  const heads = (["cgst", "sgst", "utgst", "igst"] as const).filter((h) => charged[h] || expected[h])
  const badge = type === "sez" ? m.sez : type === "export" ? m.export : intra ? m.intra(HEADS[localHead]) : m.inter
  const tone = { error: "text-destructive", warn: "text-amber-700 dark:text-amber-400", info: "text-muted-foreground" }
  const Icon = { error: CircleAlert, warn: TriangleAlert, info: Info }
  const off = (a = 0, b = 0) => Math.abs(a - b) > 0.5

  return (
    <section data-slot="gst-invoice-check" aria-label={m.title} className={cn("grid w-full min-w-0 max-w-sm gap-3 rounded-xl border bg-card p-4 text-sm text-card-foreground", className)} {...props}>
      <div className="grid gap-1">
        <p className="font-medium">{m.title}</p>
        <p className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          <span>{state(from)}</span>
          <ArrowRight aria-label="to" className="size-3.5" />
          <span>{state(pos)}</span>
          <span className="rounded-full bg-muted px-2 py-0.5 font-medium text-foreground">{badge}</span>
        </p>
      </div>

      <table className="w-full text-xs tabular-nums">
        <thead className="text-muted-foreground">
          <tr>
            <th scope="col" className="pb-1 text-left font-normal"><span className="sr-only">Tax</span></th>
            <th scope="col" className="pb-1 text-right font-normal">{m.onInvoice}</th>
            <th scope="col" className="pb-1 text-right font-normal">{m.shouldBe}</th>
          </tr>
        </thead>
        <tbody>
          {[...heads, "total" as const].map((h) => {
            const bad = off(charged[h] ?? (h === "total" ? undefined : 0), expected[h] ?? 0) && (h !== "total" || charged.total !== undefined)
            return (
              <tr key={h} className={cn("border-t", h === "total" && "font-medium")}>
                <th scope="row" className="py-1.5 text-left font-medium">{h === "total" ? m.total : `${HEADS[h]}`}</th>
                <td className={cn("py-1.5 text-right", bad && "text-destructive line-through decoration-destructive/50")}>{charged[h] !== undefined ? money(charged[h]) : "—"}</td>
                <td className={cn("py-1.5 text-right", bad && expected[h] !== undefined && "font-medium text-emerald-700 dark:text-emerald-400")}>{expected[h] !== undefined ? money(expected[h]) : "—"}</td>
              </tr>
            )
          })}
        </tbody>
      </table>

      <ul aria-live="polite" className="grid gap-1.5 text-xs">
        {issues.length === 0 ? (
          <li className="flex gap-1.5 text-emerald-700 dark:text-emerald-400">
            <CircleCheck aria-hidden className="mt-0.5 size-3.5 shrink-0" />
            <span>{m.ok}</span>
          </li>
        ) : (
          issues
            .map(describe)
            .sort((a, b) => ["error", "warn", "info"].indexOf(a[1]) - ["error", "warn", "info"].indexOf(b[1]))
            .map(([text, level], i) => {
            const I = Icon[level]
            return (
              <li key={i} className={cn("flex gap-1.5", tone[level])}>
                <I aria-hidden className="mt-0.5 size-3.5 shrink-0" />
                <span>{text}</span>
              </li>
            )
          })
        )}
      </ul>

      {onFix && fixable && (
        <button type="button" onClick={() => onFix({ ...expected })} className={cn(fixClass, "w-fit text-xs")}>
          {m.fix(fixLabel)}
        </button>
      )}
    </section>
  )
}
