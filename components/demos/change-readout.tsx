import { ChangeReadout } from "@/registry/default/change-readout/change-readout"

const rows = [
  { label: "Pro plan price", node: <ChangeReadout from={1200} to={1500} currency="INR" goodDirection="down" /> },
  { label: "Checkout conversion", node: <ChangeReadout from={4} to={6} kind="percent" /> },
  { label: "Quarterly profit", node: <ChangeReadout from={-20000} to={15000} currency="INR" /> },
  { label: "Monthly loss", node: <ChangeReadout from={-8000} to={-5000} currency="INR" /> },
  { label: "Revenue", node: <ChangeReadout from={240000} to={600000} currency="INR" /> },
  { label: "Signups from referrals", node: <ChangeReadout from={0} to={48} /> },
]

export function Demo() {
  return (
    <dl className="w-full max-w-md divide-y rounded-lg border bg-background">
      {rows.map((row) => (
        <div key={row.label} className="grid gap-0.5 px-3 py-2">
          <dt className="text-xs text-muted-foreground">{row.label}</dt>
          <dd>{row.node}</dd>
        </div>
      ))}
    </dl>
  )
}
