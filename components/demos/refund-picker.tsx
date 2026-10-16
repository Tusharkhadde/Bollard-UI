"use client"

import { RefundPicker } from "@/registry/default/refund-picker/refund-picker"

export function Demo() {
  return (
    <RefundPicker
      now="2026-10-13T10:00:00+05:30"
      items={[
        { id: "buds", name: "Wireless earbuds", quantity: 1, unitPrice: 2499, restockingPercent: 10, restockingReason: "opened" },
        { id: "case", name: "Silicone case", quantity: 2, unitPrice: 299 },
        { id: "card", name: "₹500 gift card", quantity: 1, unitPrice: 500, nonRefundable: "Gift cards can't be refunded" },
      ]}
      defaultValue={{ buds: 1, case: 1 }}
      shippingPaid={79}
      returnShippingFee={60}
      methods={[
        { id: "card", label: "Original card", detail: "Visa •••• 4242", days: [5, 7] },
        { id: "upi", label: "UPI", detail: "tushar@okhdfcbank", days: [2, 3] },
        { id: "credit", label: "Store credit", days: [0, 0], waivesFees: true, caveat: "Can't be moved to your bank later" },
      ]}
      onConfirm={() => new Promise((resolve) => setTimeout(resolve, 900))}
    />
  )
}
