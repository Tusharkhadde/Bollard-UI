"use client"

import { ChecksumInput } from "@/registry/default/checksum-input/checksum-input"

export function Demo() {
  return (
    <form className="grid w-full max-w-sm gap-3" onSubmit={(event) => event.preventDefault()}>
      <ChecksumInput kind="iban" label="Payee IBAN" defaultValue="DE89 3704 0044 0523 0130 00" />
      <ChecksumInput kind="ifsc" label="IFSC" defaultValue="SBINO001234" />
      <ChecksumInput kind="card" label="Card number" placeholder="1234 5678 9012 3456" hint="Try 4242 4242 4242 4224." />
    </form>
  )
}
